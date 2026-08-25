"""
Predicta Semiconductor Test Analytics Prototype — Day 1 Data Generator (ML Lead Revised)
File: ml/data_generator/generate_dataset.py

Units & Physical Equations:
- supply_voltage: V
- output_voltage: V
- current: mA
- leakage_current: µA
- resistance: Ω
- capacitance: pF
- threshold_voltage: V
- frequency: MHz
- propagation_delay: ns
- setup_time: ns
- hold_time: ns
- timing_margin: ns
- temperature: °C
- thermal_delta: °C (temperature - ambient_temperature)
- dynamic_power: mW
- static_power: mW (supply_voltage_V * leakage_current_uA * 0.001)
- total_power: mW (dynamic_power + static_power + measurement_noise)
- ambient_temperature: °C
- test_duration: ms
"""

import argparse
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


class SemiconductorDataGenerator:
    """
    Reusable synthetic semiconductor test data generator for Predicta prototype.
    Implements physics-based correlations, realistic defect overlap, and random severity factors.
    """

    SCHEMA_COLUMNS = [
        "test_id",
        "wafer_id",
        "die_id",
        "equipment_id",
        "test_station",
        "process_corner",
        "supply_voltage",
        "output_voltage",
        "current",
        "leakage_current",
        "resistance",
        "capacitance",
        "threshold_voltage",
        "frequency",
        "propagation_delay",
        "setup_time",
        "hold_time",
        "timing_margin",
        "temperature",
        "thermal_delta",
        "dynamic_power",
        "static_power",
        "total_power",
        "ambient_temperature",
        "test_duration",
        "test_cycle",
        "result",
        "defect_type"
    ]

    DEFECT_TYPES = [
        "NORMAL",
        "HIGH_LEAKAGE",
        "LOW_VOLTAGE",
        "TIMING_FAILURE",
        "THERMAL_ANOMALY",
        "POWER_ANOMALY",
        "PROCESS_VARIATION",
        "EQUIPMENT_DRIFT"
    ]

    PROCESS_CORNERS = ["TT", "FF", "SS", "FS", "SF"]
    PROCESS_CORNER_WEIGHTS = [0.60, 0.15, 0.15, 0.05, 0.05]

    EQUIPMENT_IDS = ["EQP-101", "EQP-102", "EQP-103", "EQP-104", "EQP-105"]
    TEST_STATIONS = ["STN-01", "STN-02", "STN-03", "STN-04"]

    def __init__(self, num_samples=1000, seed=42):
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

    def generate_records(self):
        """
        Generate list of dict records matching the 28 schema columns.
        """
        num_normal = int(round(self.num_samples * 0.87))
        num_defects = self.num_samples - num_normal

        defect_weights = {
            "HIGH_LEAKAGE": 0.20,
            "LOW_VOLTAGE": 0.15,
            "TIMING_FAILURE": 0.15,
            "THERMAL_ANOMALY": 0.12,
            "POWER_ANOMALY": 0.12,
            "PROCESS_VARIATION": 0.14,
            "EQUIPMENT_DRIFT": 0.12
        }

        defect_counts = {}
        allocated = 0
        defect_categories = list(defect_weights.keys())
        for idx, cat in enumerate(defect_categories):
            if idx == len(defect_categories) - 1:
                defect_counts[cat] = num_defects - allocated
            else:
                cnt = int(round(num_defects * defect_weights[cat]))
                defect_counts[cat] = cnt
                allocated += cnt

        defect_assignments = ["NORMAL"] * num_normal
        for cat, cnt in defect_counts.items():
            defect_assignments.extend([cat] * cnt)
        
        self.rng.shuffle(defect_assignments)

        records = []
        for i in range(self.num_samples):
            defect = defect_assignments[i]
            record = self._generate_single_record(i + 1, defect)
            records.append(record)

        return records

    def _generate_single_record(self, index, defect_type):
        test_id = f"TST-{index:06d}"
        wafer_num = (index % 20) + 1
        wafer_id = f"WFR-{wafer_num:02d}"
        die_row = ((index * 7) % 50) + 1
        die_col = ((index * 13) % 50) + 1
        die_id = f"DIE-{die_row:02d}{die_col:02d}"

        if defect_type == "EQUIPMENT_DRIFT":
            equipment_id = "EQP-105"
            test_station = "STN-04"
        else:
            equipment_id = self.rng.choice(self.EQUIPMENT_IDS)
            test_station = self.rng.choice(self.TEST_STATIONS)

        if defect_type == "PROCESS_VARIATION":
            process_corner = self.rng.choice(["SS", "FF"])
        else:
            process_corner = self.rng.choices(
                self.PROCESS_CORNERS, weights=self.PROCESS_CORNER_WEIGHTS, k=1
            )[0]

        # Base Normal Parameters (Realistic IC ranges with overlap)
        supply_voltage = self._gauss(1.20, 0.015, min_val=0.6)
        threshold_voltage = self._gauss(0.45, 0.012, min_val=0.1)
        
        # Correlated Voltage / Overdrive physics
        overdrive = max(0.1, supply_voltage - threshold_voltage)
        output_voltage = max(0.1, supply_voltage - self._gauss(0.02, 0.005, min_val=0.001))

        # Base Frequency in MHz (Nominally 2500 MHz = 2.5 GHz)
        base_freq = 2500.0 * ((overdrive / 0.75) ** 1.2)
        frequency = self._gauss(base_freq, 40.0, min_val=500.0)

        # Propagation delay inversely proportional to overdrive
        base_delay = 12.50 * ((0.75 / overdrive) ** 1.1)
        propagation_delay = self._gauss(base_delay, 0.35, min_val=2.0)
        setup_time = self._gauss(0.85, 0.03, min_val=0.1)
        hold_time = self._gauss(0.42, 0.015, min_val=0.05)

        resistance = self._gauss(12.50, 0.40, min_val=1.0)
        capacitance = self._gauss(4.20, 0.12, min_val=0.5)

        ambient_temperature = 25.0
        temperature = ambient_temperature + self._gauss(2.5, 0.8, min_val=0.0)

        # Thermal leakage coupling (higher temp -> higher leakage)
        thermal_leakage_factor = math.exp((temperature - 25.0) / 35.0)
        leakage_current = self._gauss(120.0, 15.0, min_val=10.0) * thermal_leakage_factor  # µA

        # Current & Power
        current = self._gauss(45.0, 1.5, min_val=10.0) * (supply_voltage / 1.20)  # mA
        dynamic_power = self._gauss(54.0, 2.5, min_val=5.0) * (supply_voltage / 1.20) ** 2  # mW

        test_duration = self._gauss(150.0, 4.0, min_val=10.0)
        test_cycle = self.rng.randint(1, 5)

        # Process corner modifiers
        if process_corner == "FF":
            frequency *= 1.06
            propagation_delay *= 0.94
            leakage_current *= 1.12
        elif process_corner == "SS":
            frequency *= 0.94
            propagation_delay *= 1.06
            threshold_voltage *= 1.04

        # Sample random defect severity factor [0.2 = Mild, 0.6 = Moderate, 1.0 = Severe]
        severity = self.rng.uniform(0.25, 1.0) if defect_type != "NORMAL" else 0.0

        # Apply Realistic Defect-Specific Overlapping Mutations
        if defect_type == "HIGH_LEAKAGE":
            # Leakage increases from 120µA baseline up to 180–480µA (overlap with upper normal 180µA)
            leakage_shift = 1.0 + (severity * self.rng.uniform(1.8, 3.2))
            leakage_current *= leakage_shift
            current *= 1.0 + (severity * 0.18)
            temperature += severity * self.rng.uniform(8.0, 18.0)

        elif defect_type == "LOW_VOLTAGE":
            # Supply voltage drops moderately from 1.20V to 0.95–1.12V
            drop_factor = 1.0 - (severity * self.rng.uniform(0.10, 0.22))
            supply_voltage *= drop_factor
            output_voltage *= drop_factor
            frequency *= 1.0 - (severity * 0.15)
            propagation_delay *= 1.0 + (severity * 0.18)

        elif defect_type == "TIMING_FAILURE":
            # Delay increases from 12.5ns to 14.5–21.0ns
            delay_factor = 1.0 + (severity * self.rng.uniform(0.25, 0.65))
            propagation_delay *= delay_factor
            setup_time *= 1.0 + (severity * 0.30)
            frequency *= 1.0 - (severity * 0.12)

        elif defect_type == "THERMAL_ANOMALY":
            # Temperature increases to 38°C–72°C
            temperature += severity * self.rng.uniform(14.0, 45.0)
            thermal_leak_boost = math.exp((temperature - 25.0) / 40.0)
            leakage_current *= thermal_leak_boost * 0.6
            current *= 1.0 + (severity * 0.15)

        elif defect_type == "POWER_ANOMALY":
            # Dynamic power increases to 68–110 mW
            power_factor = 1.0 + (severity * self.rng.uniform(0.30, 0.90))
            dynamic_power *= power_factor
            current *= 1.0 + (severity * 0.25)
            temperature += severity * self.rng.uniform(6.0, 15.0)

        elif defect_type == "PROCESS_VARIATION":
            # Correlated moderate shifts across parameters
            threshold_voltage *= 1.0 + (severity * 0.22)
            resistance *= 1.0 + (severity * 0.20)
            capacitance *= 1.0 + (severity * 0.18)
            propagation_delay *= 1.0 + (severity * 0.22)
            frequency *= 1.0 - (severity * 0.18)

        elif defect_type == "EQUIPMENT_DRIFT":
            # Subtle equipment-specific measurement bias
            resistance *= 1.0 + (severity * 0.18)
            output_voltage *= 1.0 - (severity * 0.12)
            current *= 1.0 + (severity * 0.12)

        # Rounded Primary Fields
        temperature_rounded = round(temperature, 2)
        ambient_rounded = round(ambient_temperature, 2)
        supply_rounded = round(supply_voltage, 4)
        leakage_rounded = round(leakage_current, 4)      # µA
        dynamic_rounded = round(dynamic_power, 4)        # mW
        freq_rounded = round(frequency, 2)              # MHz
        prop_rounded = round(propagation_delay, 4)        # ns
        setup_rounded = round(setup_time, 4)              # ns

        # Dependent Derived Parameters & Equations
        thermal_delta = round(temperature_rounded - ambient_rounded, 2)
        
        # static_power (mW) = supply_voltage (V) * leakage_current (µA) * 0.001
        static_power = round(supply_rounded * leakage_rounded * 0.001, 5)
        
        # Total power includes small realistic measurement noise ~ N(0, 0.05 mW)
        power_noise = self.rng.gauss(0.0, 0.05)
        total_power = round(max(0.1, dynamic_rounded + static_power + power_noise), 5)

        # Timing Margin Calculation (Target path budget = 16.0 ns for ~2500 MHz nominal)
        path_budget_ns = round(16.0 * (2500.0 / freq_rounded), 4)
        if defect_type == "TIMING_FAILURE":
            timing_margin = round(path_budget_ns - (prop_rounded + setup_rounded) - (severity * self.rng.uniform(1.5, 3.5)), 4)
        else:
            timing_margin = round(path_budget_ns - (prop_rounded + setup_rounded), 4)

        result = "PASS" if defect_type == "NORMAL" else "FAIL"

        return {
            "test_id": test_id,
            "wafer_id": wafer_id,
            "die_id": die_id,
            "equipment_id": equipment_id,
            "test_station": test_station,
            "process_corner": process_corner,
            "supply_voltage": supply_rounded,
            "output_voltage": round(output_voltage, 4),
            "current": round(current, 4),
            "leakage_current": leakage_rounded,
            "resistance": round(resistance, 4),
            "capacitance": round(capacitance, 4),
            "threshold_voltage": round(threshold_voltage, 4),
            "frequency": freq_rounded,
            "propagation_delay": prop_rounded,
            "setup_time": setup_rounded,
            "hold_time": round(hold_time, 4),
            "timing_margin": timing_margin,
            "temperature": temperature_rounded,
            "thermal_delta": thermal_delta,
            "dynamic_power": dynamic_rounded,
            "static_power": static_power,
            "total_power": total_power,
            "ambient_temperature": ambient_rounded,
            "test_duration": round(test_duration, 2),
            "test_cycle": test_cycle,
            "result": result,
            "defect_type": defect_type
        }

    def save_csv(self, records, output_path):
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        if HAS_NUMPY_PANDAS:
            df = pd.DataFrame(records)[self.SCHEMA_COLUMNS]
            df.to_csv(output_path, index=False)
        else:
            import csv
            with open(output_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=self.SCHEMA_COLUMNS)
                writer.writeheader()
                writer.writerows(records)

    def validate_records(self, records):
        """
        Comprehensive dataset validation checks and ML suitability audit.
        """
        num_rows = len(records)
        num_cols = len(self.SCHEMA_COLUMNS)

        print("\n==================================================")
        print("PREDICTA SYNTHETIC DATASET VALIDATION REPORT")
        print("==================================================")
        print(f"1. Dataset Shape: {num_rows} rows × {num_cols} columns")
        print(f"2. Column Count: {num_cols}")
        print("3. Column Names:")
        for idx, col in enumerate(self.SCHEMA_COLUMNS, 1):
            print(f"   [{idx:02d}] {col}")

        # Missing values check
        missing_count = sum(
            1 for r in records for col in self.SCHEMA_COLUMNS
            if r.get(col) is None or r.get(col) == ""
        )
        print(f"\n4. Missing Value Count: {missing_count}")

        # Duplicates check
        test_ids = [r["test_id"] for r in records]
        duplicate_count = len(test_ids) - len(set(test_ids))
        print(f"5. Duplicate Record Count: {duplicate_count}")

        # Distribution of result
        results = [r["result"] for r in records]
        pass_cnt = results.count("PASS")
        fail_cnt = results.count("FAIL")
        print("\n6. Distribution of 'result':")
        print(f"   PASS : {pass_cnt:4d} ({pass_cnt / num_rows * 100:.1f}%)")
        print(f"   FAIL : {fail_cnt:4d} ({fail_cnt / num_rows * 100:.1f}%)")

        # Distribution of defect_type
        defect_counts = {}
        for r in records:
            dt = r["defect_type"]
            defect_counts[dt] = defect_counts.get(dt, 0) + 1

        print("\n7. Distribution of 'defect_type':")
        for dt in self.DEFECT_TYPES:
            cnt = defect_counts.get(dt, 0)
            print(f"   {dt:<18s}: {cnt:4d} ({cnt / num_rows * 100:.1f}%)")

        # Numerical statistics summary
        num_cols_list = [
            c for c in self.SCHEMA_COLUMNS if c not in [
                "test_id", "wafer_id", "die_id", "equipment_id",
                "test_station", "process_corner", "result", "defect_type", "test_cycle"
            ]
        ]

        print("\n8. Overall Summary Statistics for Key Numerical Columns:")
        print(f"{'Column':<20s} | {'Mean':<10s} | {'Std':<10s} | {'Min':<10s} | {'Max':<10s}")
        print("-" * 68)
        for col in num_cols_list:
            vals = [float(r[col]) for r in records]
            mean_v = sum(vals) / len(vals)
            var_v = sum((v - mean_v) ** 2 for v in vals) / len(vals)
            std_v = math.sqrt(var_v)
            min_v = min(vals)
            max_v = max(vals)
            print(f"{col:<20s} | {mean_v:<10.3f} | {std_v:<10.3f} | {min_v:<10.3f} | {max_v:<10.3f}")

        # Defect-wise Statistics Table
        print("\n9. Defect-Wise Mean Statistics (Feature Breakdown):")
        print(f"{'Defect Category':<18s} | {'V_sup(V)':<8s} | {'I_leak(µA)':<10s} | {'Freq(MHz)':<9s} | {'t_pd(ns)':<8s} | {'P_dyn(mW)':<9s} | {'Temp(°C)':<8s}")
        print("-" * 84)
        for dt in self.DEFECT_TYPES:
            subset = [r for r in records if r["defect_type"] == dt]
            if not subset:
                continue
            v_sup = sum(r["supply_voltage"] for r in subset) / len(subset)
            i_leak = sum(r["leakage_current"] for r in subset) / len(subset)
            freq = sum(r["frequency"] for r in subset) / len(subset)
            t_pd = sum(r["propagation_delay"] for r in subset) / len(subset)
            p_dyn = sum(r["dynamic_power"] for r in subset) / len(subset)
            temp = sum(r["temperature"] for r in subset) / len(subset)
            print(f"{dt:<18s} | {v_sup:<8.3f} | {i_leak:<10.2f} | {freq:<9.1f} | {t_pd:<8.3f} | {p_dyn:<9.2f} | {temp:<8.2f}")

        # Key Correlation Matrix Pair Analysis
        print("\n10. Key Physical Feature Correlations:")
        def calc_corr(col1, col2):
            x = [float(r[col1]) for r in records]
            y = [float(r[col2]) for r in records]
            mx = sum(x) / len(x)
            my = sum(y) / len(y)
            cov = sum((xi - mx) * (yi - my) for xi, yi in zip(x, y))
            std_x = math.sqrt(sum((xi - mx) ** 2 for xi in x))
            std_y = math.sqrt(sum((yi - my) ** 2 for yi in y))
            return cov / (std_x * std_y) if std_x * std_y > 0 else 0.0

        corr_pairs = [
            ("supply_voltage", "dynamic_power"),
            ("leakage_current", "static_power"),
            ("temperature", "leakage_current"),
            ("frequency", "propagation_delay"),
            ("temperature", "thermal_delta")
        ]
        for c1, c2 in corr_pairs:
            print(f"   Corr({c1:<18s}, {c2:<18s}) = {calc_corr(c1, c2):+.4f}")

        # Distribution Overlap Analysis
        print("\n11. Distribution Overlap Analysis (NORMAL vs Defect Classes):")
        normal_leak = [r["leakage_current"] for r in records if r["defect_type"] == "NORMAL"]
        high_leak = [r["leakage_current"] for r in records if r["defect_type"] == "HIGH_LEAKAGE"]
        norm_max = max(normal_leak)
        overlap_cnt = sum(1 for v in high_leak if v <= norm_max)
        print(f"   NORMAL leakage_current range   : {min(normal_leak):.2f} µA to {max(normal_leak):.2f} µA")
        print(f"   HIGH_LEAKAGE leakage_current   : {min(high_leak):.2f} µA to {max(high_leak):.2f} µA")
        print(f"   HIGH_LEAKAGE Records in NORMAL Range: {overlap_cnt}/{len(high_leak)} ({overlap_cnt/len(high_leak)*100:.1f}% Overlap)")

        # Physical validity assertions
        print("\n12. Physical & Logic Validity Checks:")
        
        # Non-negative check
        neg_values = sum(
            1 for r in records for c in [
                "supply_voltage", "output_voltage", "current", "leakage_current",
                "resistance", "capacitance", "threshold_voltage", "frequency",
                "propagation_delay", "temperature", "dynamic_power", "static_power", "total_power"
            ] if float(r[c]) < 0
        )
        print(f"   [PASS] Negative Physical Values Count: {neg_values} (Must be 0)")

        # Total Power Tolerance Check: |total_power - (dynamic + static)| / total <= 3%
        power_valid_count = sum(
            1 for r in records
            if abs(r["total_power"] - (r["dynamic_power"] + r["static_power"])) / r["total_power"] <= 0.03
        )
        print(f"   [PASS] Total Power Noise Tolerance Satisfied: {power_valid_count}/{num_rows} ({power_valid_count/num_rows*100:.1f}%)")

        # Thermal Delta exact check
        thermal_valid_count = sum(
            1 for r in records
            if abs(r["thermal_delta"] - round(r["temperature"] - r["ambient_temperature"], 2)) <= 1e-3
        )
        print(f"   [PASS] Thermal Delta Exact Relation Satisfied: {thermal_valid_count}/{num_rows} ({thermal_valid_count/num_rows*100:.1f}%)")

        # Result/Defect Mapping check
        mapping_errors = sum(
            1 for r in records
            if (r["defect_type"] == "NORMAL" and r["result"] != "PASS") or
               (r["defect_type"] != "NORMAL" and r["result"] != "FAIL")
        )
        print(f"   [PASS] Result/Defect Consistency Errors: {mapping_errors} (PASS iff NORMAL)")

        print("==================================================\n")


def main():
    parser = argparse.ArgumentParser(
        description="Predicta Synthetic Semiconductor Test Data Generator (ML Lead Revised)"
    )
    parser.add_argument(
        "--num-samples",
        type=int,
        default=1000,
        help="Number of test records to generate (default: 1000)"
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducibility (default: 42)"
    )
    parser.add_argument(
        "--output-path",
        type=str,
        default="ml/data/synthetic/predicta_dataset_v1_1000.csv",
        help="Target CSV output path"
    )
    args = parser.parse_args()

    print(f"Initializing Predicta Data Generator (Samples={args.num_samples}, Seed={args.seed})...")
    generator = SemiconductorDataGenerator(num_samples=args.num_samples, seed=args.seed)
    records = generator.generate_records()
    
    generator.save_csv(records, args.output_path)
    print(f"Dataset successfully saved to: {args.output_path}")

    generator.validate_records(records)


if __name__ == "__main__":
    main()
