import pandas as pd
import numpy as np

def lot_robust_standardization(df: pd.DataFrame) -> pd.DataFrame:
    """Normalizes features using Median and Median Absolute Deviation (MAD) per lot."""
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

            # Degenerate reference distributions must be represented explicitly.
            # A fake epsilon would convert numerical noise into huge anomaly scores.
            if robust_sigma == 0:
                normalized.loc[indices, f"{col}_zscore"] = np.where(
                    np.isclose(df.loc[indices, col], median, rtol=1e-9, atol=1e-12),
                    0.0,
                    np.nan
                )
            else:
                normalized.loc[indices, f"{col}_zscore"] = (df.loc[indices, col] - median) / robust_sigma
            normalized.loc[indices, f"{col}_median"] = median
            normalized.loc[indices, f"{col}_mad"] = mad

    return normalized
