import pandas as pd

def prepare_drift_features(df: pd.DataFrame, param: str) -> tuple[pd.DataFrame, pd.Series]:
    """Prepares features and targets at the 24h window for a specific parameter."""
    df_0h = df[df['burn_in_hour'] == 0].set_index('component_id')
    df_24h = df[df['burn_in_hour'] == 24].set_index('component_id')
    df_168h = df[df['burn_in_hour'] == 168].set_index('component_id')
    
    features = pd.DataFrame(index=df_24h.index)
    features['lot_id'] = df_24h['lot_id']
    
    # 0h and 24h absolute inputs
    features[f'{param}_0h'] = df_0h[param].astype(float)
    features[f'{param}_24h'] = df_24h[param].astype(float)
    features[f'{param}_drift'] = df_24h[param].astype(float) - df_0h[param].astype(float)
    
    # Align targets (actual 168h readings)
    common_idx = features.index.intersection(df_168h.index)
    features = features.loc[common_idx]
    targets = df_168h.loc[common_idx, param].astype(float)
    
    return features, targets
