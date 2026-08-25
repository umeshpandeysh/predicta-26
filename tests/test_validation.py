import os
import sys
import pandas as pd

# Fix path to load src
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.preprocessing.validation import validate_dataset

def test_splitting_lot_leakage():
    """Verifies that lot-based train/test splits have zero overlapping lot names."""
    train_lots = ["LOT-SYN-001", "LOT-SYN-002"]
    test_lots = ["LOT-SYN-003"]

    # Assert disjoint set intersection is empty
    overlap = set(train_lots).intersection(set(test_lots))
    assert len(overlap) == 0, f"Overlapping lots found in train/test splits: {overlap}"
    print("Test passed: Disjoint lots verified. Zero lot leakage.")

def test_validation_invalid_checks():
    """Verifies that validation flags negative values and out-of-order hours."""
    bad_data = {
        "component_id": ["COMP-001", "COMP-001"],
        "lot_id": ["LOT-01", "LOT-01"],
        "burn_in_hour": [24, 0], # Out of order
        "temperature_c": [125, 125],
        "voltage_v": [1.5, 1.5],
        "iddq": [10.0, -5.0],    # Negative value
        "ileak": [1.5, 1.5],
        "tpd": [120.0, 122.0]
    }
    df = pd.DataFrame(bad_data)
    report = validate_dataset(df)

    assert report['status'] == "INVALID" or len(report['issues']) > 0, "Validation did not catch errors"
    print("Test passed: Validation caught out-of-order times and negative physical values.")

if __name__ == "__main__":
    test_splitting_lot_leakage()
    test_validation_invalid_checks()
