import pandas as pd
import numpy as np

def lot_robust_standardization(df: pd.DataFrame) -> pd.DataFrame:
    \"\"\"Normalizes features using Median and Median Absolute Deviation (MAD) per lot.\"\"\"
    normalized = df.copy()
    
    for lot_id, lot_group in df.groupby('lot_id'):
        indices = lot_group.index
        for col in ['iddq', 'ileak', 'tpd']:
            vals = lot_group[col].dropna()
            if len(vals) < 3:
                continue
                
            median = np.median(vals)
            mad = np.median(np.abs(vals - median))
            robust_sigma = 1.4826 * mad
            
            # Avoid division by zero for completely flat parameters
            if robust_sigma == 0:
                robust_sigma = 1e-9
                
            normalized.loc[indices, f"{col}_zscore"] = (df.loc[indices, col] - median) / robust_sigma
            normalized.loc[indices, f"{col}_median"] = median
            normalized.loc[indices, f"{col}_mad"] = mad
            
    return normalized
