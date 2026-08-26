"""
Predicta Day 21 — Research Data Generator V2 (Scientifically Corrected)
File: ml/research/day21/data_generator_v2.py

RESEARCH ONLY — DO NOT REPLACE PRODUCTION DATASET GENERATOR
"""

import math
import os
import random
import sys

try:
    import numpy as np
    import pandas as pd
    HAS_NUMPY_PANDAS = True
except ImportError:
    HAS_NUMPY_PANDAS = False


class ResearchDataGeneratorV2:
    """
    Scientifically corrected research dataset generator (v2).
    Implements continuous severity, machine-specific equipment offsets & drift,
    correlated sensor noise, physical multi-measurement defect signatures,
    and specification-violation target label generation.
    """

    EQUIPMENT_OFFSETS = {
        "EQP-101": {"leakage_bias": 0.0, "temp_bias": 0.0, "delay_bias": 0.0},
        "EQP-102": {"leakage_bias": 3.5, "temp_bias": 0.8, "delay_bias": 0.15},
        "EQP-103": {"leakage_bias": 8.0, "temp_bias": 2.5, "delay_bias": 0.35}, # Drifting chamber
        "EQP-104": {"leakage_bias": -2.0, "temp_bias": -0.5, "delay_bias": -0.10},
        "EQP-105": {"leakage_bias": 4.0, "temp_bias": 1.2, "delay_bias": 0.20}
    }

    EQUIPMENT_IDS = ["EQP-101", "EQP-102", "EQP-103", "EQP-104", "EQP-105"]

    def __init__(self, num_samples=50000, seed=42):
        self.num_samples = num_samples
        self.seed = seed
        self.rng = random.Random(seed)
        if HAS_NUMPY_PANDAS:
            np.random.seed(seed)

    def _gauss(self, mean, std_dev, min_val=None):
        val = self.rng.gauss(mean, std_dev)
        if min_val is not None and val < min_val:
            val = min_val
        return val

    def generate_dataset(self):
        records = []
        num_normal = int(round(self.num_samples * 0.70)) # 70% Normal, 30% Defect
        num_defects = self.num_samples - num_normal

        defect_types = ["HIGH_LEAKAGE", "LOW_VOLTAGE", "TIMING_FAILURE", "THERMAL_ANOMALY", "POWER_ANOMALY", "PROCESS_VARIATION", "EQUIPMENT_DRIFT"]
        
        assignments = ["NORMAL"] * num_normal
        for i in range(num_defects):
            assignments.append(defect_types[i % len(defect_types)])
        
        self.rng.shuffle(assignments)

        for i in range(self.num_samples):
            defect = assignments[i]
            rec = self._generate_record(i + 1, defect)
            records.append(rec)

        return records

    def _generate_record(self, index, defect_type):
        test_id = f"RS-TST-{index:06d}"
        wafer_num = (index % 100) + 1
        wafer_id = f"WFR-V2-{wafer_num:03d}"
        
        # Equipment assignment
        equipment_id = self.rng.choice(self.EQUIPMENT_IDS)
        eq_bias = self.EQUIPMENT_OFFSETS[equipment_id]

        # Continuous defect severity [0.0 to 1.0]
        severity = self.rng.uniform(0.05, 0.95) if defect_type != "NORMAL" else 0.0

        # Base nominal physical parameters
        supply_voltage = self._gauss(1.20, 0.015, min_val=0.8)
        threshold_voltage = self._gauss(0.45, 0.012, min_val=0.2)
        overdrive = max(0.1, supply_voltage - threshold_voltage)
        output_voltage = max(0.1, supply_voltage - self._gauss(0.02, 0.005, min_val=0.001))

        base_freq = 2500.0 * ((overdrive / 0.75) ** 1.2)
        frequency = self._gauss(base_freq, 35.0, min_val=500.0)

        base_delay = 12.50 * ((0.75 / overdrive) ** 1.1)
        propagation_delay = self._gauss(base_delay, 0.30, min_val=3.0) + eq_bias["delay_bias"]
        setup_time = self._gauss(0.85, 0.03, min_val=0.1)
        hold_time = self._gauss(0.42, 0.015, min_val=0.05)

        resistance = self._gauss(12.50, 0.40, min_val=1.0)
        capacitance = self._gauss(4.20, 0.12, min_val=0.5)

        temperature = 25.0 + self._gauss(2.5, 0.8, min_val=0.0) + eq_bias["temp_bias"]
        thermal_leakage_factor = math.exp((temperature - 25.0) / 35.0)
        leakage_current = (self._gauss(115.0, 12.0, min_val=10.0) + eq_bias["leakage_bias"]) * thermal_leakage_factor

        current = self._gauss(44.0, 1.5, min_val=10.0) * (supply_voltage / 1.20)
        dynamic_power = self._gauss(52.0, 2.5, min_val=5.0) * (supply_voltage / 1.20) ** 2
        test_duration = self._gauss(150.0, 4.0, min_val=10.0)

        # Apply multi-measurement physical mutations with realistic distribution overlap
        if defect_type == "HIGH_LEAKAGE":
            leakage_current *= 1.0 + (severity * self.rng.uniform(0.35, 1.10))
            current *= 1.0 + (severity * 0.10)
            temperature += severity * self.rng.uniform(4.0, 12.0)
        elif defect_type == "LOW_VOLTAGE":
            drop = 1.0 - (severity * self.rng.uniform(0.06, 0.15))
            supply_voltage *= drop
            output_voltage *= drop
            propagation_delay *= 1.0 + (severity * 0.12)
        elif defect_type == "TIMING_FAILURE":
            propagation_delay *= 1.0 + (severity * self.rng.uniform(0.15, 0.45))
            setup_time *= 1.0 + (severity * 0.20)
            frequency *= 1.0 - (severity * 0.08)
        elif defect_type == "THERMAL_ANOMALY":
            temperature += severity * self.rng.uniform(8.0, 28.0)
            leakage_current *= math.exp((temperature - 25.0) / 45.0) * 0.4
        elif defect_type == "POWER_ANOMALY":
            dynamic_power *= 1.0 + (severity * self.rng.uniform(0.20, 0.60))
            current *= 1.0 + (severity * 0.15)
        elif defect_type == "PROCESS_VARIATION":
            threshold_voltage *= 1.0 + (severity * 0.15)
            resistance *= 1.0 + (severity * 0.14)
            propagation_delay *= 1.0 + (severity * 0.14)
        elif defect_type == "EQUIPMENT_DRIFT":
            # TIED DIRECTLY TO MACHINE ID OFFSET DRIFT (EQP-103 drifting chamber)
            if equipment_id == "EQP-103":
                leakage_current *= 1.0 + (severity * 0.40)
                temperature += severity * 6.0
                resistance *= 1.0 + (severity * 0.18)
            else:
                resistance *= 1.0 + (severity * 0.10)

        # Derived calculations
        path_budget = round(16.0 * (2500.0 / frequency), 4)
        timing_margin = round(path_budget - (propagation_delay + setup_time), 4)
        static_power = round(supply_voltage * leakage_current * 0.001, 5)
        total_power = round(dynamic_power + static_power + self.rng.gauss(0.0, 0.05), 5)
        thermal_delta = round(temperature - 25.0, 2)

        # Specification-Violation Target Label Generation (Not trivial lookup)
        # Latent Health Score Calculation
        health_score = (
            (leakage_current / 165.0) * 0.30 +
            (propagation_delay / 13.5) * 0.30 +
            (temperature / 36.0) * 0.20 +
            ((1.20 - supply_voltage) / 0.12) * 0.20
        )

        is_fail = 1 if (
            propagation_delay > 14.0 or
            leakage_current > 175.0 or
            supply_voltage < 1.10 or
            temperature > 38.0 or
            health_score > 1.10
        ) else 0

        result = "FAIL" if is_fail else "PASS"

        return {
            "test_id": test_id,
            "wafer_id": wafer_id,
            "equipment_id": equipment_id,
            "supply_voltage": round(supply_voltage, 4),
            "output_voltage": round(output_voltage, 4),
            "current": round(current, 4),
            "leakage_current": round(leakage_current, 4),
            "resistance": round(resistance, 4),
            "capacitance": round(capacitance, 4),
            "threshold_voltage": round(threshold_voltage, 4),
            "frequency": round(frequency, 2),
            "propagation_delay": round(propagation_delay, 4),
            "setup_time": round(setup_time, 4),
            "hold_time": round(hold_time, 4),
            "timing_margin": timing_margin,
            "temperature": round(temperature, 2),
            "thermal_delta": thermal_delta,
            "dynamic_power": round(dynamic_power, 4),
            "static_power": static_power,
            "total_power": total_power,
            "test_duration": round(test_duration, 2),
            "result": result,
            "defect_type": defect_type,
            "severity": round(severity, 4)
        }


def main():
    outdir = "ml/research/day21/data"
    os.makedirs(outdir, exist_ok=True)
    print("Generating Research Dataset V2 (50,000 records)...")

    gen = ResearchDataGeneratorV2(num_samples=50000, seed=42)
    records = gen.generate_dataset()

    if HAS_NUMPY_PANDAS:
        df = pd.DataFrame(records)
        # Train (35,000 records / 70 wafers), Val (15,000 records / 30 wafers)
        wafers = df['wafer_id'].unique()
        train_wafers = wafers[:70]
        val_wafers = wafers[70:]

        train_df = df[df['wafer_id'].isin(train_wafers)]
        val_df = df[df['wafer_id'].isin(val_wafers)]

        train_path = os.path.join(outdir, "train_v2.csv")
        val_path = os.path.join(outdir, "validation_v2.csv")

        train_df.to_csv(train_path, index=False)
        val_df.to_csv(val_path, index=False)

        print(f"✔ Written Research Datasets V2 successfully!")
        print(f"   • Train V2: {len(train_df)} rows ➔ {train_path}")
        print(f"   • Val V2:   {len(val_df)} rows ➔ {val_path}")


if __name__ == "__main__":
    main()
