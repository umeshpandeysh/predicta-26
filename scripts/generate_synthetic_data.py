import os
import sys
import yaml
import argparse
import numpy as np
import pandas as pd

# Fix path to load src
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.physics.generator import generate_lot_components
from src.preprocessing.schema import enforce_canonical_schema
from src.preprocessing.validation import validate_dataset
from src.preprocessing.normalization import lot_robust_standardization

def main():
    parser = argparse.ArgumentParser(description="Generate AIPS Physics-informed Synthetic Dataset")
    parser.add_argument("--config", type=str, default="configs/synthetic_burnin.yaml")
    parser.add_argument("--outdir", type=str, default="data/synthetic")
    args = parser.parse_args()
    
    # Ingest config
    with open(args.config, 'r') as f:
        configs = yaml.safe_load(f)
        
    np.random.seed(configs.get("random_seed", 42))
    
    num_lots = configs.get("number_of_lots", 50)
    parts_per_lot = configs.get("components_per_lot", 100)
    time_pts = configs.get("time_points", [0, 24, 96, 168])
    temp = configs.get("stress_temperature_c", 125)
    volt = configs.get("stress_voltage_v", 1.5)
    
    print(f"Starting simulation of {num_lots} lots ({parts_per_lot} components each)...")
    
    all_lots = []
    for l_idx in range(num_lots):
        lot_id = f"LOT-SYN-{l_idx+1:03d}"
        lot_df = generate_lot_components(lot_id, parts_per_lot, time_pts, temp, volt, configs)
        all_lots.append(lot_df)
        
    combined_df = pd.concat(all_lots, ignore_index=True)
    
    # Robust normalization & Schema check
    normalized_df = lot_robust_standardization(combined_df)
    canonical_df = enforce_canonical_schema(normalized_df)
    
    # Run validation
    val_report = validate_dataset(canonical_df)
    print(f"Validation Status: {val_report['status']}")
    if val_report['issues']:
        print("Issues found:")
        for iss in val_report['issues']:
            print(f" - {iss}")
            
    # Leakage-safe lot-based split
    # Training (lots 1-35), Val (lots 36-42), Test (lots 43-50)
    train_lots = [f"LOT-SYN-{i:03d}" for i in range(1, 36)]
    val_lots = [f"LOT-SYN-{i:03d}" for i in range(36, 43)]
    test_lots = [f"LOT-SYN-{i:03d}" for i in range(43, 51)]
    
    train_df = canonical_df[canonical_df['lot_id'].isin(train_lots)]
    val_df = canonical_df[canonical_df['lot_id'].isin(val_lots)]
    test_df = canonical_df[canonical_df['lot_id'].isin(test_lots)]
    
    # Write files
    os.makedirs(args.outdir, exist_ok=True)
    
    canonical_df.to_csv(os.path.join(args.outdir, "ps170_synthetic_full.csv"), index=False)
    train_df.to_csv(os.path.join(args.outdir, "ps170_synthetic_train.csv"), index=False)
    val_df.to_csv(os.path.join(args.outdir, "ps170_synthetic_val.csv"), index=False)
    test_df.to_csv(os.path.join(args.outdir, "ps170_synthetic_test.csv"), index=False)
    
    print(f"Datasets written to {args.outdir}/ successfully!")
    print(f"Full rows: {len(canonical_df)}, Train: {len(train_df)}, Val: {len(val_df)}, Test: {len(test_df)}")

if __name__ == "__main__":
    main()
