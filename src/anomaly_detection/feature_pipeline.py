import pandas as pd

def prepare_24h_features(df: pd.DataFrame) -> pd.DataFrame:
    """Prepares absolute, lot-relative, and temporal features available at 24h."""
    # Pivot time series records into wide components format
    df_0h = df[df['burn_in_hour'] == 0].set_index('component_id')
    df_24h = df[df['burn_in_hour'] == 24].set_index('component_id')

    features = pd.DataFrame(index=df_24h.index)
    features['lot_id'] = df_24h['lot_id']
    features['anomaly_label'] = df_24h['anomaly_label']

    # Absolute parameters
    features['iddq_24h'] = df_24h['iddq'].astype(float)
    features['ileak_24h'] = df_24h['ileak'].astype(float)
    features['tpd_24h'] = df_24h['tpd'].astype(float)

    # Temporal changes from 0h
    features['iddq_drift'] = df_24h['iddq'].astype(float) - df_0h['iddq'].astype(float)
    features['ileak_drift'] = df_24h['ileak'].astype(float) - df_0h['ileak'].astype(float)
    features['tpd_drift'] = df_24h['tpd'].astype(float) - df_0h['tpd'].astype(float)

    required_idx = df_24h.index.intersection(df_0h.index)
    features = features.loc[required_idx]
    if features.isna().any().any():
        raise ValueError("Missing/non-numeric anomaly feature values; explicit data remediation is required")
    return features
