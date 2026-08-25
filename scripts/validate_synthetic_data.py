import os
import sys
import pandas as pd

# Fix path to load src
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.preprocessing.validation import validate_dataset

def main():
    filepath = "data/synthetic/ps170_synthetic_full.csv"
    if not os.path.exists(filepath):
        print(f"Error: dataset file '{filepath}' not found. Run generator first.")
        sys.exit(1)

    df = pd.read_csv(filepath)
    report = validate_dataset(df)

    print("==================================================")
    print("           AIPS DATA VALIDATION REPORT            ")
    print("==================================================")
    print(f"Dataset File: {filepath}")
    print(f"Overall Status: {report['status']}")
    print(f"Total Rows: {report.get('row_count', 0)}")
    print(f"Lots Count: {report.get('lot_count', 0)}")
    print(f"Components Count: {report.get('component_count', 0)}")

    # Class distribution analysis
    print("\nHealth State Populations:")
    h_states = df.drop_duplicates('component_id')['health_state'].value_counts()
    for state, count in h_states.items():
        pct = (count / len(h_states)) * 100
        print(f" - {state}: {count} ({pct:.1f}%)")

    # Anomaly/Failure rates
    anomaly_rate = df['anomaly_label'].mean() * 100
    failure_rate = df['failure_label'].mean() * 100
    print(f"\nAnomaly Record Rate: {anomaly_rate:.2f}%")
    print(f"Failure Specification Violation Rate: {failure_rate:.2f}%")

    # Physics trend checks
    mean_tpd_0h = df[df['burn_in_hour'] == 0]['tpd'].mean()
    mean_tpd_168h = df[df['burn_in_hour'] == 168]['tpd'].mean()
    print(f"\nPhysics Drift Check (tpd):")
    print(f" - Mean Delay (0h): {mean_tpd_0h:.2f} ns")
    print(f" - Mean Delay (168h): {mean_tpd_168h:.2f} ns")
    if mean_tpd_168h > mean_tpd_0h:
        print(" - Directional Drift: PASS (Timing slows down under stress)")
    else:
        print(" - Directional Drift: FAIL (Timing did not degrade)")

    print("\nValidation completed successfully!")

if __name__ == "__main__":
    main()
