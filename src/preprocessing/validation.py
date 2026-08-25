import pandas as pd
import numpy as np

def validate_dataset(df: pd.DataFrame) -> dict:
    \"\"\"Performs structural, numeric, time, and physical validation on dataset.\"\"\"
    issues = []

    # 1. Structure check
    required = ["component_id", "lot_id", "burn_in_hour", "iddq", "ileak", "tpd"]
    for req in required:
        if req not in df.columns:
            issues.append(f"Missing required field: {req}")

    if issues:
        return {"status": "INVALID", "issues": issues}

    # 2. Infinite & Type checks
    nan_count = df[required].isna().sum().sum()
    if nan_count > 0:
        issues.append(f"Contains {nan_count} missing/NaN values in core fields")

    # 3. Temporal consistency
    for _, group in df.groupby('component_id'):
        hours = group['burn_in_hour'].values
        if not np.all(np.diff(hours) >= 0):
            issues.append(f"Component out-of-order time points found: {hours}")

    # 4. Physics checks
    if (df['temperature_c'] < -100).any() or (df['temperature_c'] > 300).any():
        issues.append("Temperature values out of plausible physical limits")
    if (df['tpd'] < 0).any():
        issues.append("Contains negative propagation delays")
    if (df['iddq'] < 0).any() or (df['ileak'] < 0).any():
        issues.append("Contains negative supply/leakage current values")

    status = "WARNING" if issues else "VALID"
    return {
        "status": status,
        "issues": issues,
        "lot_count": df['lot_id'].nunique(),
        "component_count": df['component_id'].nunique(),
        "row_count": len(df)
    }
