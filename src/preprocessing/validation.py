import pandas as pd
import numpy as np

def validate_dataset(df: pd.DataFrame) -> dict:
    """Performs structural, numeric, time, and physical validation on dataset."""
    issues = []

    # 1. Structure check
    required = ["component_id", "lot_id", "burn_in_hour", "iddq", "ileak", "tpd"]
    for req in required:
        if req not in df.columns:
            issues.append(f"Missing required field: {req}")

    if issues:
        return {"status": "INVALID", "issues": issues}

    # 2. Numeric, NaN and infinity checks
    numeric_required = ["burn_in_hour", "iddq", "ileak", "tpd"]
    numeric_frame = pd.DataFrame(index=df.index)
    for col in numeric_required:
        numeric_frame[col] = pd.to_numeric(df[col], errors="coerce")
    invalid_numeric = numeric_frame.isna().sum().sum()
    non_finite = (~np.isfinite(numeric_frame.to_numpy(dtype=float))).sum()
    if invalid_numeric > 0:
        issues.append(f"Contains {invalid_numeric} missing/invalid numeric values in core fields")
    if non_finite > 0:
        issues.append(f"Contains {non_finite} NaN/infinite numeric values in core fields")

    # 3. Temporal consistency (validate against chronological order, not input row order)
    for component_id, group in df.groupby('component_id'):
        hours = pd.to_numeric(group['burn_in_hour'], errors="coerce").dropna().values
        if len(hours) > 1 and len(np.unique(hours)) != len(hours):
            issues.append(f"Component duplicate burn-in time points found: {component_id}")
        if len(hours) > 1 and np.any(np.diff(hours) < 0):
            issues.append(f"Component out-of-order time points found: {component_id}")

    # 4. Physics checks
    if (df['temperature_c'] < -100).any() or (df['temperature_c'] > 300).any():
        issues.append("Temperature values out of plausible physical limits")
    if (df['tpd'] < 0).any():
        issues.append("Contains negative propagation delays")
    if (df['iddq'] < 0).any() or (df['ileak'] < 0).any():
        issues.append("Contains negative supply/leakage current values")

    fatal_markers = ("Missing required field", "missing/invalid numeric", "NaN/infinite", "duplicate burn-in")
    status = "INVALID" if any(any(marker in issue for marker in fatal_markers) for issue in issues) else ("WARNING" if issues else "VALID")
    return {
        "status": status,
        "issues": issues,
        "lot_count": df['lot_id'].nunique(),
        "component_count": df['component_id'].nunique(),
        "row_count": len(df)
    }
