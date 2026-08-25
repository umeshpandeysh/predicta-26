import numpy as np
import pandas as pd
from .aging import bti_threshold_drift
from .timing import calculate_propagation_delay
from .leakage import calculate_leakage

def generate_lot_components(
    lot_id: str,
    num_components: int,
    time_points: list,
    temp_c: float,
    voltage_v: float,
    configs: dict
) -> pd.DataFrame:
    \"\"\"Generates a complete simulated lot matching researched distributions.\"\"\"
    records = []

    # Seed local parameter variation
    lot_mean_iddq = np.random.normal(10.0, 0.5)
    lot_mean_ileak = np.random.normal(1.4, 0.05)
    lot_mean_tpd = np.random.normal(120.0, 2.0)

    n_exp = configs.get("bti_time_exponent", 0.2)
    Ea_bti = configs.get("bti_activation_energy_ev", 0.12)
    noise_std = configs.get("measurement_noise_std", 0.01)

    # Distribute health states
    health_choices = ["HEALTHY", "BORDERLINE", "LATENT_DEFECT", "FAILED"]
    health_probs = [0.95, 0.02, 0.02, 0.01]

    defect_choices = ["GATE_OXIDE_SHORT", "TIMING_OFFSET", "STEP_BREAKDOWN"]
    defect_probs = [0.4, 0.3, 0.3]

    for c_idx in range(num_components):
        comp_id = f"COMP-SYN-{lot_id.split('-')[-1]}-{c_idx+1:03d}"

        # Ingest health states
        health = np.random.choice(health_choices, p=health_probs)
        defect = "NONE"
        if health in ["LATENT_DEFECT", "FAILED"]:
            defect = np.random.choice(defect_choices, p=defect_probs)

        # Initial 0h measurements (LogNormal process distributions)
        # Borderline parts start at the lot tail
        mult = 1.5 if health == "BORDERLINE" else 1.0

        iddq_0h = np.random.lognormal(np.log(lot_mean_iddq * mult), 0.1)
        ileak_0h = np.random.lognormal(np.log(lot_mean_ileak * mult), 0.05)
        tpd_0h = np.random.normal(lot_mean_tpd * mult, 3.0)

        # Defect characteristics
        onset_hour = np.random.choice([24, 96]) if defect != "NONE" else 999
        amp_multiplier = 4.0 if health == "LATENT_DEFECT" else 10.0 if health == "FAILED" else 1.0

        # Map time series
        for t in time_points:
            # 1. Aging shift
            vth_shift = bti_threshold_drift(t, temp_c, voltage_v, 1.5 * amp_multiplier, n_exp, Ea_bti)

            # 2. Timing calculation
            tpd_val = calculate_propagation_delay(tpd_0h, temp_c, vth_shift, 45.0)
            # Inject timing offset defect
            if defect == "TIMING_OFFSET" and t >= onset_hour:
                tpd_val += 12.0 * (t/168.0)

            # 3. Leakage calculation
            ileak_val = calculate_leakage(ileak_0h, temp_c, vth_shift, defect, t, onset_hour)
            iddq_val = calculate_leakage(iddq_0h, temp_c, vth_shift, defect, t, onset_hour)

            # Add measurement noise
            tpd_val += np.random.normal(0, tpd_val * noise_std)
            ileak_val += np.random.normal(0, ileak_val * noise_std)
            iddq_val += np.random.normal(0, iddq_val * noise_std)

            # Flag labels
            is_anomaly = 1 if health in ["LATENT_DEFECT", "FAILED"] else 0
            is_failure = 1 if (tpd_val > 135.1 or iddq_val > 24.5 or ileak_val > 3.12) else 0

            records.append({
                "component_id": comp_id,
                "lot_id": lot_id,
                "manufacturer": "ISRO_MOCK",
                "component_family": "CMOS_LOGIC",
                "component_type": "HEX_INVERTER",
                "package": "CERAMIC_FP",
                "burn_in_hour": t,
                "temperature_c": temp_c,
                "voltage_v": voltage_v,
                "iddq": abs(iddq_val),
                "ileak": abs(ileak_val),
                "tpd": abs(tpd_val),
                "vth": vth_shift,
                "health_state": health,
                "defect_type": defect,
                "anomaly_label": is_anomaly,
                "failure_label": is_failure,
                "source_type": "synthetic",
                "source_dataset": "ps170_synthetic",
                "generation_method": "physics_RD_power_law",
                "generation_version": "0.1"
            })

    return pd.DataFrame(records)
