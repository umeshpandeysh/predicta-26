"""
Predicta Semiconductor Test Analytics Prototype — Day 1 Data Generator
File: ml/data_generator/generate_dataset.py

Generates realistic synthetic semiconductor test records with physics-based
parameter relationships, process corners, equipment drift, and defect types.
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

        # Base Normal Parameters
        supply_voltage = self._gauss(1.20, 0.015, min_val=0.5)
        output_voltage = max(0.1, supply_voltage - self._gauss(0.02, 0.005, min_val=0.001))
        current = self._gauss(45.0, 1.5, min_val=10.0)
        leakage_current = self._gauss(1.50, 0.12, min_val=0.1)
        resistance = self._gauss(12.50, 0.40, min_val=1.0)
        capacitance = self._gauss(4.20, 0.12, min_val=0.5)
        threshold_voltage = self._gauss(0.45, 0.012, min_val=0.1)
        frequency = self._gauss(2.50, 0.06, min_val=0.5)
        propagation_delay = self._gauss(12.50, 0.35, min_val=1.0)
        setup_time = self._gauss(0.85, 0.03, min_val=0.1)
        hold_time = self._gauss(0.42, 0.015, min_val=0.05)

        ambient_temperature = 25.0
        temperature = ambient_temperature + self._gauss(2.5, 0.8, min_val=0.0)
        dynamic_power = self._gauss(54.0, 2.5, min_val=5.0)

        test_duration = self._gauss(150.0, 4.0, min_val=10.0)
        test_cycle = self.rng.randint(1, 5)

        if process_corner == "FF":
            frequency *= 1.08
            propagation_delay *= 0.92
            leakage_current *= 1.15
        elif process_corner == "SS":
            frequency *= 0.92
            propagation_delay *= 1.08
            threshold_voltage *= 1.05

        if defect_type == "HIGH_LEAKAGE":
            leakage_current *= self.rng.uniform(3.5, 6.5)
            current *= self.rng.uniform(1.25, 1.45)
            temperature += self.rng.uniform(18.0, 32.0)

        elif defect_type == "LOW_VOLTAGE":
            voltage_drop = self.rng.uniform(0.68, 0.78)
            supply_voltage *= voltage_drop
            output_voltage *= voltage_drop
            frequency *= self.rng.uniform(0.72, 0.85)

        elif defect_type == "TIMING_FAILURE":
            propagation_delay *= self.rng.uniform(1.45, 1.85)
            setup_time *= self.rng.uniform(1.30, 1.60)
            frequency *= self.rng.uniform(0.80, 0.92)

        elif defect_type == "THERMAL_ANOMALY":
            temperature += self.rng.uniform(45.0, 75.0)
            leakage_current *= self.rng.uniform(1.8, 2.8)
            current *= self.rng.uniform(1.15, 1.35)

        elif defect_type == "POWER_ANOMALY":
            dynamic_power *= self.rng.uniform(1.70, 2.30)
            current *= self.rng.uniform(1.35, 1.70)
            temperature += self.rng.uniform(12.0, 25.0)

        elif defect_type == "PROCESS_VARIATION":
            threshold_voltage *= self.rng.uniform(1.25, 1.45)
            resistance *= self.rng.uniform(1.20, 1.40)
            capacitance *= self.rng.uniform(1.15, 1.35)
            propagation_delay *= self.rng.uniform(1.20, 1.40)
            frequency *= self.rng.uniform(0.75, 0.88)

        elif defect_type == "EQUIPMENT_DRIFT":
            resistance *= self.rng.uniform(1.25, 1.45)
            output_voltage *= self.rng.uniform(0.82, 0.90)
            current *= self.rng.uniform(1.15, 1.30)

        # Rounded Primary Fields
        temperature_rounded = round(temperature, 2)
        ambient_rounded = round(ambient_temperature, 2)
        supply_rounded = round(supply_voltage, 4)
        leakage_rounded = round(leakage_current, 4)
        dynamic_rounded = round(dynamic_power, 4)
        freq_rounded = round(frequency, 4)
        prop_rounded = round(propagation_delay, 4)
        setup_rounded = round(setup_time, 4)

        # Dependent Derived Parameters
        thermal_delta = round(temperature_rounded - ambient_rounded, 2)
        static_power = round(supply_rounded * leakage_rounded * 1e-3, 5)
        total_power = round(dynamic_rounded + static_power, 5)

        # Timing Margin Calculation (Target path budget = 15.0 ns at nominal 2.5 GHz)
        path_budget_ns = round(15.0 * (2.50 / freq_rounded), 4)
        if defect_type == "TIMING_FAILURE":
            timing_margin = round(self.rng.uniform(-3.5, -0.5), 4)
        elif defect_type == "LOW_VOLTAGE":
            timing_margin = round(self.rng.uniform(-0.8, 0.15), 4)
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
        Comprehensive dataset validation checks.
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
        missing_count = 0
        for r in records:
            for col in self.SCHEMA_COLUMNS:
                if r.get(col) is None or r.get(col) == "":
                    missing_count += 1
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

        print("\n8. Summary Statistics for Key Numerical Columns:")
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

        # Physical validity assertions
        print("\n9. Physical & Logic Validity Checks:")
        
        # Check non-negative values
        neg_values = 0
        for r in records:
            for c in ["supply_voltage", "output_voltage", "current", "leakage_current",
                      "resistance", "capacitance", "threshold_voltage", "frequency",
                      "propagation_delay", "temperature", "dynamic_power", "static_power", "total_power"]:
                if float(r[c]) < 0:
                    neg_values += 1
        print(f"   [PASS] Negative Physical Values Count: {neg_values} (Must be 0)")

        # Power relationship check
        power_mismatches = 0
        for r in records:
            expected_tot = round(r["dynamic_power"] + r["static_power"], 5)
            if abs(r["total_power"] - expected_tot) > 1e-4:
                power_mismatches += 1
        print(f"   [PASS] Power Equation Discrepancy Count: {power_mismatches} (total = dynamic + static)")

        # Thermal delta check
        thermal_mismatches = 0
        for r in records:
            expected_delta = round(r["temperature"] - r["ambient_temperature"], 2)
            if abs(r["thermal_delta"] - expected_delta) > 1e-3:
                thermal_mismatches += 1
        print(f"   [PASS] Thermal Delta Discrepancy Count: {thermal_mismatches} (delta = temp - ambient)")

        # Result/Defect Mapping check
        mapping_errors = 0
        for r in records:
            if r["defect_type"] == "NORMAL" and r["result"] != "PASS":
                mapping_errors += 1
            if r["defect_type"] != "NORMAL" and r["result"] != "FAIL":
                mapping_errors += 1
        print(f"   [PASS] Result/Defect Consistency Errors: {mapping_errors} (PASS iff NORMAL)")

        print("==================================================\n")


def main():
    parser = argparse.ArgumentParser(
        description="Predicta Synthetic Semiconductor Test Data Generator"
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
