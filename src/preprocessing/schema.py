import pandas as pd

CANONICAL_COLUMNS = [
    "component_id", "lot_id", "manufacturer", "component_family", "component_type", "package",
    "burn_in_hour", "temperature_c", "voltage_v", "iddq", "ileak", "tpd", "vth",
    "health_state", "defect_type", "anomaly_label", "failure_label",
    "source_type", "source_dataset", "generation_method", "generation_version"
]

def enforce_canonical_schema(df):
    """Conforms a DataFrame to the canonical schema, filling missing fields with None."""
    res = pd.DataFrame()
    for col in CANONICAL_COLUMNS:
        if col in df.columns:
            res[col] = df[col]
        else:
            res[col] = None
    return res
