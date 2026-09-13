"""
Predicta Semiconductor Test Analytics — Unified Data Generator CLI
File: ml/data_generator/generate_dataset.py

Authoritative entrypoint for generating semiconductor test datasets.
Bridges single-point ATE screening telemetry and time-series degradation kinetics.
"""

import argparse
import os
import sys
import pandas as pd

# Add repository root to path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.physics.unified_generator import (
    UnifiedSemiconductorGenerator,
    generate_and_save_datasets,
    GENERATOR_VERSION,
)


def main():
    parser = argparse.ArgumentParser(
        description="Predicta Unified Physics-Grounded Semiconductor Telemetry Generator"
    )
    parser.add_argument(
        "--num-samples",
        type=int,
        default=50000,
        help="Number of test records to generate (default: 50000)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducibility (default: 42)",
    )
    parser.add_argument(
        "--output-path",
        type=str,
        default="ml/data/synthetic/predicta_dataset_v4_50000.csv",
        help="Target CSV output path",
    )
    parser.add_argument(
        "--generate-all-suites",
        action="store_true",
        help="Generate production, unseen equipment, and distribution shift benchmark suites",
    )
    parser.add_argument(
        "--noise-level",
        type=float,
        default=0.0,
        help="Additional sensor measurement noise standard deviation (e.g. 0.01, 0.03, 0.05)",
    )
    parser.add_argument(
        "--missing-rate",
        type=float,
        default=0.0,
        help="Fraction of measurements randomly missing (e.g. 0.05, 0.10, 0.20)",
    )
    parser.add_argument(
        "--distribution-shift",
        action="store_true",
        help="Inject severe process corner shift and temperature variance",
    )

    args = parser.parse_args()

    output_dir = os.path.dirname(os.path.abspath(args.output_path))
    os.makedirs(output_dir, exist_ok=True)

    if args.generate_all_suites:
        print(f"Generating full benchmark suites in {output_dir} (Version={GENERATOR_VERSION})...")
        generate_and_save_datasets(output_dir, total_samples=args.num_samples, seed=args.seed)
        return

    print(
        f"Generating {args.num_samples} records with Unified Semiconductor Generator (Seed={args.seed}, "
        f"Noise={args.noise_level}, Missing={args.missing_rate})..."
    )
    generator = UnifiedSemiconductorGenerator(
        num_samples=args.num_samples,
        seed=args.seed,
        noise_level=args.noise_level,
        missing_rate=args.missing_rate,
        is_distribution_shift=args.distribution_shift,
    )
    records = generator.generate_records()
    df = pd.DataFrame(records)
    df.to_csv(args.output_path, index=False)
    print(f"Successfully saved {len(df)} records to: {args.output_path}")

    # Summary diagnostics
    pass_cnt = int((df["result"] == "PASS").sum())
    fail_cnt = int((df["result"] == "FAIL").sum())
    anom_cnt = int((df["is_anomaly"] == 1).sum())
    unknown_cnt = int((df["is_unknown_anomaly"] == 1).sum())
    borderline_cnt = int((df["is_borderline"] == 1).sum())

    print("\n--- Dataset Summary Diagnostics ---")
    print(f"Total Records     : {len(df)}")
    print(f"PASS / FAIL       : {pass_cnt} PASS ({pass_cnt/len(df)*100:.2f}%) / {fail_cnt} FAIL ({fail_cnt/len(df)*100:.2f}%)")
    print(f"Known Anomalies   : {anom_cnt - unknown_cnt}")
    print(f"Unknown Anomalies : {unknown_cnt}")
    print(f"Borderline Parts  : {borderline_cnt}")
    print(f"Lots Represented  : {df['lot_id'].nunique()}")
    print(f"Wafers Represented: {df['wafer_id'].nunique()}")
    print(f"Equipment Units   : {df['equipment_id'].nunique()} ({sorted(df['equipment_id'].unique())})")
    print("-----------------------------------\n")


if __name__ == "__main__":
    main()
