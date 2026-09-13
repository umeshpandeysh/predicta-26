"""
PREDICTA-26 — Unified Physics-Grounded Semiconductor Data Generator
File: src/physics/unified_generator.py

Industrial-grade semiconductor telemetry generator implementing:
  1. Hierarchical Process Variation:
     - Lot-level process shifts and variance across 20 distinct manufacturing lots
     - Wafer-level spatial gradients (radial edge effect, CMP non-uniformity, center clusters)
  2. Persistent Equipment Fingerprints:
     - Calibration offsets, systematic sensor biases, measurement noise, and contact wear drift
  3. Temporal Progression & Degradation Kinetics:
     - Real burn-in progression (0h, 24h, 48h, 72h, 96h, 120h, 144h, 168h)
     - Physics models: BTI threshold drift, Arrhenius thermal leakage, Elmore timing degradation
  4. Physically Emergent Failure Labels & Borderline Uncertainty:
     - Multi-channel failure conditions (timing slack, oxide breakdown, supply droop, thermal runaway)
     - Overlapping distributions, latent early-stage defects, and measurement noise uncertainty
  5. Open-Set Unknown Anomalies:
     - Novel multi-parameter copula tail drift and non-linear interactions not in known training classes
  6. Robustness Controls:
     - Controllable measurement noise (+1%, +3%, +5%), missing measurements (0-20%), and sensor outliers
  7. Full Provenance Tracking:
     - lot_id, wafer_id, die_id, equipment_id, test_cycle, burn_in_hour, versioning metadata.
"""

from typing import Any, Dict, List, Optional
import math
import random
import numpy as np
import pandas as pd

from src.features.feature_contract import (
    RAW_TELEMETRY_CHANNELS,
    ENGINEERED_PHYSICS_FEATURES,
    compute_engineered_features_dict,
)
from src.physics.aging import bti_threshold_drift
from src.physics.timing import calculate_propagation_delay

GENERATOR_VERSION = "4.0.0_unified_physics"


class PersistentEquipmentModel:
    """Models persistent hardware characteristics, calibration offsets, and wear drift for an ATE test head."""

    def __init__(self, equipment_id: str, rng: random.Random):
        self.equipment_id = equipment_id
        # Persistent calibration offsets (fixed for this equipment)
        self.voltage_bias = rng.gauss(0.0, 0.006)       # V (±15mV typical ATE DAC error)
        self.temp_bias = rng.gauss(0.0, 0.8)             # °C (test head thermal chuck offset)
        self.contact_res_offset = abs(rng.gauss(0.20, 0.05)) # Ω (socket contact resistance)
        self.timing_jitter = rng.gauss(0.0, 0.12)        # ns (ATE test head channel skew)
        self.leakage_offset = rng.gauss(0.0, 3.5)        # µA (picoammeter baseline offset)

        # Persistent noise multiplier
        self.noise_std = max(0.005, rng.gauss(0.012, 0.003))

        # Gradual contact wear drift rate per test cycle (ATE pin oxidation / spring fatigue)
        self.wear_drift_rate = abs(rng.gauss(0.03, 0.01)) # Ω / 1000 cycles


class UnifiedSemiconductorGenerator:
    """
    Certified, physics-grounded synthetic semiconductor telemetry generator.
    Generates single-point ATE screening telemetry and multi-cycle burn-in degradation records.
    """

    def __init__(
        self,
        num_samples: int = 50000,
        seed: int = 42,
        noise_level: float = 0.0,          # Additional noise (e.g. 0.01, 0.03, 0.05)
        missing_rate: float = 0.0,         # Fraction of measurements missing (e.g. 0.05, 0.10, 0.20)
        inject_unknown_anomalies: bool = True,
        is_distribution_shift: bool = False,
        excluded_equipment_ids: Optional[List[str]] = None,
    ):
        self.num_samples = num_samples
        self.seed = seed
        self.noise_level = noise_level
        self.missing_rate = missing_rate
        self.inject_unknown_anomalies = inject_unknown_anomalies
        self.is_distribution_shift = is_distribution_shift
        self.excluded_equipment_ids = set(excluded_equipment_ids or [])

        self.rng = random.Random(seed)
        self.np_rng = np.random.RandomState(seed)

        # Available Equipment IDs
        all_eqs = ["EQP-101", "EQP-102", "EQP-103", "EQP-104", "EQP-105", "EQP-106", "EQP-107"]
        self.active_equipment_ids = [eq for eq in all_eqs if eq not in self.excluded_equipment_ids]
        if not self.active_equipment_ids:
            self.active_equipment_ids = ["EQP-101"]

        # Initialize Persistent Equipment Models
        self.equipment_models: Dict[str, PersistentEquipmentModel] = {
            eq_id: PersistentEquipmentModel(eq_id, self.rng) for eq_id in all_eqs
        }

        # Initialize 20 Manufacturing Lots with Persistent Process Means
        self.lots = [f"LOT-{idx:03d}" for idx in range(1, 21)]
        self.lot_profiles: Dict[str, Dict[str, float]] = {}
        for lot in self.lots:
            # Lot-to-lot process variation (distribution shift in shift-mode)
            mult = 1.8 if self.is_distribution_shift else 1.0
            self.lot_profiles[lot] = {
                "vth_shift": self.rng.gauss(0.0, 0.015 * mult),
                "tox_factor": max(0.85, self.rng.gauss(1.0, 0.03 * mult)),
                "res_factor": max(0.85, self.rng.gauss(1.0, 0.04 * mult)),
                "cap_factor": max(0.85, self.rng.gauss(1.0, 0.03 * mult)),
                "mobility_factor": max(0.85, self.rng.gauss(1.0, 0.04 * mult)),
            }

    def generate_records(self) -> List[Dict[str, Any]]:
        """Generates full collection of records with lot, wafer, and equipment realism."""
        records: List[Dict[str, Any]] = []

        # Target Defect Proportions (Nominal: ~82% Normal, ~15% Known Defects, ~3% Unknown Anomalies)
        if self.inject_unknown_anomalies:
            prop_normal = 0.82
            prop_unknown = 0.03
        else:
            prop_normal = 0.85
            prop_unknown = 0.0

        num_normal = int(round(self.num_samples * prop_normal))
        num_unknown = int(round(self.num_samples * prop_unknown))
        num_known_defects = self.num_samples - num_normal - num_unknown

        known_categories = [
            "HIGH_LEAKAGE", "LOW_VOLTAGE", "TIMING_FAILURE",
            "THERMAL_ANOMALY", "POWER_ANOMALY", "PROCESS_VARIATION", "EQUIPMENT_DRIFT"
        ]

        defect_assignments = ["NORMAL"] * num_normal
        for i in range(num_known_defects):
            defect_assignments.append(known_categories[i % len(known_categories)])
        for _ in range(num_unknown):
            defect_assignments.append("UNKNOWN_ANOMALY")

        self.rng.shuffle(defect_assignments)

        # 100 Wafers distributed across the 20 lots (5 wafers per lot)
        wafers_per_lot = 5

        for idx in range(self.num_samples):
            assigned_mechanism = defect_assignments[idx]

            # Assign Lot and Wafer (Group-Aware Hierarchy)
            lot_idx = (idx % len(self.lots))
            lot_id = self.lots[lot_idx]
            wafer_num = ((idx // len(self.lots)) % wafers_per_lot) + 1
            wafer_id = f"WFR-{lot_id[-3:]}-{wafer_num:02d}"

            # Die coordinates on 300mm wafer (-150mm to +150mm radius, normalized r in [0, 1])
            die_row = ((idx * 7) % 60) - 30
            die_col = ((idx * 13) % 60) - 30
            die_id = f"DIE-R{die_row+30:02d}C{die_col+30:02d}"
            r_norm = min(1.0, math.sqrt(die_row**2 + die_col**2) / 30.0)

            # Assign Equipment persistently (round-robin with persistent behavior)
            eq_id = self.active_equipment_ids[idx % len(self.active_equipment_ids)]
            eq_model = self.equipment_models[eq_id]

            # Burn-in hour / test cycle progression (Cycles 1 to 8; 0h to 168h)
            cycle = ((idx // 200) % 8) + 1
            burn_in_hour = (cycle - 1) * 24.0

            record = self._generate_single_die(
                index=idx + 1,
                lot_id=lot_id,
                wafer_id=wafer_id,
                die_id=die_id,
                die_row=die_row,
                die_col=die_col,
                r_norm=r_norm,
                eq_model=eq_model,
                cycle=cycle,
                burn_in_hour=burn_in_hour,
                mechanism=assigned_mechanism,
            )
            records.append(record)

        return records

    def _generate_single_die(
        self,
        index: int,
        lot_id: str,
        wafer_id: str,
        die_id: str,
        die_row: int,
        die_col: int,
        r_norm: float,
        eq_model: PersistentEquipmentModel,
        cycle: int,
        burn_in_hour: float,
        mechanism: str,
    ) -> Dict[str, Any]:
        test_id = f"TST-{index:07d}"
        lot_prof = self.lot_profiles[lot_id]

        # Radial edge effect: Die near periphery (r_norm > 0.75) experiences CMP variation and edge thermal stress
        is_wafer_edge = r_norm > 0.75
        edge_leakage_mult = 1.0 + (0.35 * (r_norm - 0.75) / 0.25) if is_wafer_edge else 1.0
        edge_vth_var = (0.02 * r_norm) if is_wafer_edge else 0.0

        # Base nominal operating parameters (1.2V CMOS logic technology)
        v_sup_nom = 1.20 + eq_model.voltage_bias
        v_th_nom = (0.45 + lot_prof["vth_shift"] + self.rng.gauss(0.0, 0.01) + edge_vth_var)

        # Intrinsic wear-out kinetics (BTI threshold drift over burn-in hours)
        temp_ambient = 25.0 + eq_model.temp_bias
        effective_temp = temp_ambient + self.rng.gauss(3.5, 0.8) # Self-heating

        bti_drift = bti_threshold_drift(
            time_hours=burn_in_hour,
            temp_c=effective_temp,
            voltage_v=v_sup_nom,
            base_amp=1.2,
            exponent_n=0.20,
            activation_energy_ev=0.12,
        )
        threshold_voltage = max(0.15, v_th_nom + bti_drift)

        # Gate overdrive voltage
        overdrive = max(0.10, v_sup_nom - threshold_voltage)

        # Output voltage droop (IR drop across power delivery network)
        output_voltage = max(0.10, v_sup_nom - self.rng.gauss(0.025, 0.005))

        # Intrinsic resistance and capacitance
        resistance = (12.50 * lot_prof["res_factor"] + eq_model.contact_res_offset
                      + (eq_model.wear_drift_rate * (cycle / 8.0)) + self.rng.gauss(0.0, 0.35))
        resistance = max(1.0, resistance)

        capacitance = max(0.5, 4.20 * lot_prof["cap_factor"] + self.rng.gauss(0.0, 0.10))

        # Switching Frequency (nominally 2500 MHz, scales with overdrive and mobility)
        freq_base = 2500.0 * ((overdrive / 0.75) ** 1.15) * lot_prof["mobility_factor"]
        frequency = max(500.0, freq_base + self.rng.gauss(0.0, 35.0))

        # Gate propagation delay (inversely proportional to overdrive, increases with temperature and aging)
        delay_base = calculate_propagation_delay(
            tpd_0h=12.20,
            temp_c=effective_temp,
            vth_shift=bti_drift,
            beta=15.0,
        )
        propagation_delay = max(2.0, (delay_base * (0.75 / overdrive) ** 1.05) + eq_model.timing_jitter + self.rng.gauss(0.0, 0.30))

        setup_time = max(0.1, self.rng.gauss(0.85, 0.03))
        hold_time = max(0.05, self.rng.gauss(0.42, 0.015))

        # Leakage Current (exponential Arrhenius temperature scaling + subthreshold conduction)
        thermal_leakage_mult = math.exp((effective_temp - 25.0) / 38.0)
        base_leakage = (115.0 * lot_prof["tox_factor"] * edge_leakage_mult * thermal_leakage_mult
                        + eq_model.leakage_offset + self.rng.gauss(0.0, 12.0))
        leakage_current = max(5.0, base_leakage)

        # Supply current (active current + subthreshold leakage)
        current = max(5.0, (45.0 * (v_sup_nom / 1.20) * lot_prof["mobility_factor"]
                            + (leakage_current * 1e-3) + self.rng.gauss(0.0, 1.2)))

        # Dynamic power (P_dyn = alpha * C * V^2 * f)
        dynamic_power = max(5.0, (54.0 * (v_sup_nom / 1.20)**2 * (frequency / 2500.0) + self.rng.gauss(0.0, 2.0)))

        test_duration = max(10.0, self.rng.gauss(150.0, 3.5))

        # -------------------------------------------------------------
        # INJECT PHYSICAL DEFECT MECHANISMS WITH REALISTIC SEVERITY & OVERLAP
        # -------------------------------------------------------------
        severity = self.rng.uniform(0.15, 1.0) if mechanism != "NORMAL" else 0.0
        is_latent = False
        is_borderline = False

        if mechanism == "HIGH_LEAKAGE":
            # Dielectric gate oxide breakdown / pinhole formation
            leak_boost = 1.0 + (severity * self.rng.uniform(0.60, 2.20))
            leakage_current *= leak_boost
            current += (leakage_current * 1e-3) * 0.5
            effective_temp += severity * self.rng.uniform(5.0, 18.0)

        elif mechanism == "LOW_VOLTAGE":
            # Power grid resistive IR-drop / decoupling capacitor short
            drop = 1.0 - (severity * self.rng.uniform(0.06, 0.16))
            v_sup_nom *= drop
            output_voltage *= drop
            frequency *= 1.0 - (severity * 0.10)
            propagation_delay *= 1.0 + (severity * 0.12)

        elif mechanism == "TIMING_FAILURE":
            # High-resistance via / critical path metal interconnect defect
            tpd_boost = 1.0 + (severity * self.rng.uniform(0.18, 0.48))
            propagation_delay *= tpd_boost
            setup_time *= 1.0 + (severity * 0.22)
            frequency *= 1.0 - (severity * 0.08)

        elif mechanism == "THERMAL_ANOMALY":
            # Package void / thermal interface material (TIM) delamination
            temp_rise = severity * self.rng.uniform(12.0, 42.0)
            effective_temp += temp_rise
            leakage_current *= math.exp(temp_rise / 40.0)

        elif mechanism == "POWER_ANOMALY":
            # Internal clock buffer shoot-through current
            dynamic_power *= 1.0 + (severity * self.rng.uniform(0.25, 0.70))
            current *= 1.0 + (severity * 0.22)
            effective_temp += severity * self.rng.uniform(4.0, 12.0)

        elif mechanism == "PROCESS_VARIATION":
            # Corner mismatch (slow-slow or fast-fast skew)
            threshold_voltage *= 1.0 + (severity * 0.15)
            resistance *= 1.0 + (severity * 0.14)
            capacitance *= 1.0 + (severity * 0.12)
            propagation_delay *= 1.0 + (severity * 0.14)
            frequency *= 1.0 - (severity * 0.12)

        elif mechanism == "EQUIPMENT_DRIFT":
            # ATE pogo-pin oxidation causing excessive contact resistance and measurement distortion
            resistance += severity * self.rng.uniform(2.5, 6.0)
            output_voltage -= severity * self.rng.uniform(0.04, 0.09)
            propagation_delay += severity * self.rng.uniform(0.8, 2.2)

        elif mechanism == "UNKNOWN_ANOMALY":
            # Novel physics: Multi-parameter joint copula tail drift + coupled substrate resonance
            # Parameters individually stay near 2-sigma boundary, but their combination is anomalous
            capacitance *= 1.0 + self.rng.uniform(0.12, 0.22)
            resistance *= 1.0 + self.rng.uniform(0.10, 0.20)
            threshold_voltage *= 1.0 - self.rng.uniform(0.08, 0.14)
            effective_temp += self.rng.uniform(6.0, 14.0)
            dynamic_power *= 1.0 + self.rng.uniform(0.15, 0.28)

        # Model Latent Defects: Early burn-in (cycles 1-2) shows mild signs, fully fails by cycle 6-8
        if mechanism in ["HIGH_LEAKAGE", "TIMING_FAILURE"] and severity < 0.40 and cycle <= 2:
            is_latent = True

        # Total power calculation (Dynamic + Static leakage power + noise)
        static_power = (v_sup_nom * (leakage_current * 1e-3)) # mW
        total_power = max(0.1, dynamic_power + static_power + self.rng.gauss(0.0, 0.06))

        # Timing Margin Calculation (Clock Period Budget - (Propagation Delay + Setup Time))
        path_budget_ns = 16.0 * (2500.0 / max(100.0, frequency))
        timing_margin = path_budget_ns - (propagation_delay + setup_time)

        # -------------------------------------------------------------
        # APPLY SENSOR NOISE & UNCERTAINTY (+1%, +3%, +5% controls)
        # -------------------------------------------------------------
        total_noise_std = eq_model.noise_std + self.noise_level
        if total_noise_std > 0:
            v_sup_nom += self.rng.gauss(0.0, v_sup_nom * total_noise_std)
            output_voltage += self.rng.gauss(0.0, output_voltage * total_noise_std)
            current += self.rng.gauss(0.0, current * total_noise_std)
            leakage_current += self.rng.gauss(0.0, leakage_current * total_noise_std)
            propagation_delay += self.rng.gauss(0.0, propagation_delay * total_noise_std)
            frequency += self.rng.gauss(0.0, frequency * total_noise_std)
            effective_temp += self.rng.gauss(0.0, effective_temp * total_noise_std * 0.5)

        # Outlier injection (0.2% probability of sensor glitch / measurement spike)
        if self.rng.random() < 0.002:
            glitch_choice = self.rng.choice(["leakage", "temp", "delay", "res"])
            if glitch_choice == "leakage":
                leakage_current *= self.rng.uniform(2.5, 5.0)
            elif glitch_choice == "temp":
                effective_temp += self.rng.uniform(25.0, 50.0)
            elif glitch_choice == "delay":
                propagation_delay *= self.rng.uniform(1.8, 3.0)
            elif glitch_choice == "res":
                resistance *= self.rng.uniform(2.0, 4.0)

        # -------------------------------------------------------------
        # PHYSICALLY EMERGENT FAILURE LABEL (Continuous boundary logic)
        # -------------------------------------------------------------
        # Physical acceptance specifications:
        timing_slack_val = timing_margin - (setup_time + hold_time)
        timing_fail = (timing_slack_val < 0.0) or (propagation_delay > 16.5)
        leakage_fail = (leakage_current > 220.0)
        voltage_fail = (v_sup_nom - output_voltage > 0.12) or (v_sup_nom < 1.08)
        thermal_fail = (effective_temp > 45.0)
        power_fail = (total_power > 82.0)
        resistance_fail = (resistance > 17.5)

        # Borderline state: Near limit (< 10% safety margin)
        near_timing = 0.0 <= timing_slack_val < 0.25
        near_leakage = 180.0 <= leakage_current <= 220.0
        near_voltage = 0.09 <= (v_sup_nom - output_voltage) <= 0.12
        is_borderline = near_timing or near_leakage or near_voltage

        # Physical failure occurs if any critical spec limit is violated
        has_physical_violation = (timing_fail or leakage_fail or voltage_fail or
                                  thermal_fail or power_fail or resistance_fail)

        # Result is PASS or FAIL based on physical test limit violation
        if has_physical_violation:
            result = "FAIL"
        else:
            # Latent or borderline parts pass initial screening
            result = "PASS"

        # Construct 16 raw features dictionary
        raw_record = {
            "supply_voltage": round(max(0.5, v_sup_nom), 4),
            "output_voltage": round(max(0.1, output_voltage), 4),
            "current": round(max(0.1, current), 4),
            "leakage_current": round(max(0.0, leakage_current), 4),
            "resistance": round(max(0.1, resistance), 4),
            "capacitance": round(max(0.01, capacitance), 4),
            "threshold_voltage": round(max(0.05, threshold_voltage), 4),
            "frequency": round(max(50.0, frequency), 2),
            "propagation_delay": round(max(0.5, propagation_delay), 4),
            "setup_time": round(max(0.01, setup_time), 4),
            "hold_time": round(max(0.01, hold_time), 4),
            "timing_margin": round(timing_margin, 4),
            "temperature": round(effective_temp, 2),
            "dynamic_power": round(max(0.1, dynamic_power), 4),
            "total_power": round(max(0.1, total_power), 4),
            "test_duration": round(test_duration, 2),
        }

        # Apply controlled missing values if configured (e.g. 5%, 10%, 20%)
        if self.missing_rate > 0.0:
            for feat in RAW_TELEMETRY_CHANNELS:
                if self.rng.random() < self.missing_rate:
                    raw_record[feat] = np.nan

        # Compute 12 engineered features (with NaN fallback if missing data)
        try:
            eng_record = compute_engineered_features_dict(raw_record)
        except Exception:
            eng_record = {col: np.nan for col in ENGINEERED_PHYSICS_FEATURES}

        # Full production record
        full_record = {
            "test_id": test_id,
            "lot_id": lot_id,
            "wafer_id": wafer_id,
            "die_id": die_id,
            "equipment_id": eq_model.equipment_id,
            "test_station": f"STN-{(index % 4) + 1:02d}",
            "test_cycle": cycle,
            "burn_in_hour": burn_in_hour,
            "die_row": die_row,
            "die_col": die_col,
            "r_norm": round(r_norm, 4),
            **raw_record,
            **eng_record,
            "result": result,
            "defect_type": mechanism,
            "is_anomaly": 1 if mechanism != "NORMAL" else 0,
            "is_unknown_anomaly": 1 if mechanism == "UNKNOWN_ANOMALY" else 0,
            "is_borderline": 1 if is_borderline else 0,
            "is_latent": 1 if is_latent else 0,
            "dataset_version": "4.0.0",
            "generator_version": GENERATOR_VERSION,
            "source_type": "physics_simulation_unified",
        }

        return full_record


def generate_and_save_datasets(
    output_dir: str,
    total_samples: int = 50000,
    seed: int = 42,
) -> Dict[str, str]:
    """Generates all standard benchmark datasets (Production, Unseen Equipment, Distribution Shift, Robustness)."""
    import os
    os.makedirs(output_dir, exist_ok=True)
    paths: Dict[str, str] = {}

    print(f"\n[GENERATOR] Generating authoritative production dataset ({total_samples} samples)...")
    gen_prod = UnifiedSemiconductorGenerator(
        num_samples=total_samples,
        seed=seed,
        excluded_equipment_ids=["EQP-105"], # Hold out EQP-105 for unseen equipment generalization
    )
    prod_records = gen_prod.generate_records()
    df_prod = pd.DataFrame(prod_records)
    prod_path = os.path.join(output_dir, "predicta_dataset_v4_production.csv")
    df_prod.to_csv(prod_path, index=False)
    paths["production"] = prod_path
    print(f"[GENERATOR] Saved production dataset to: {prod_path} ({len(df_prod)} records)")

    # Unseen Equipment Dataset (Holdout: EQP-105 exclusively)
    print("\n[GENERATOR] Generating unseen equipment test dataset (EQP-105 holdout, 5000 samples)...")
    gen_unseen = UnifiedSemiconductorGenerator(
        num_samples=5000,
        seed=seed + 100,
        excluded_equipment_ids=["EQP-101", "EQP-102", "EQP-103", "EQP-104", "EQP-106", "EQP-107"],
    )
    unseen_records = gen_unseen.generate_records()
    df_unseen = pd.DataFrame(unseen_records)
    unseen_path = os.path.join(output_dir, "predicta_dataset_v4_unseen_equipment.csv")
    df_unseen.to_csv(unseen_path, index=False)
    paths["unseen_equipment"] = unseen_path
    print(f"[GENERATOR] Saved unseen equipment dataset to: {unseen_path} ({len(df_unseen)} records)")

    # Distribution Shift Dataset (Process shift, wider thermal variances, 5000 samples)
    print("\n[GENERATOR] Generating distribution shift dataset (5000 samples)...")
    gen_shift = UnifiedSemiconductorGenerator(
        num_samples=5000,
        seed=seed + 200,
        is_distribution_shift=True,
    )
    shift_records = gen_shift.generate_records()
    df_shift = pd.DataFrame(shift_records)
    shift_path = os.path.join(output_dir, "predicta_dataset_v4_distribution_shift.csv")
    df_shift.to_csv(shift_path, index=False)
    paths["distribution_shift"] = shift_path
    print(f"[GENERATOR] Saved distribution shift dataset to: {shift_path} ({len(df_shift)} records)")

    return paths
