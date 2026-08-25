import numpy as np
import pandas as pd
from .base import AnomalyDetector

class RobustMADDetector(AnomalyDetector):
    def __init__(self, threshold_sigma=6.0):
        self.threshold_sigma = threshold_sigma
        self.lot_stats = {}
        
    def fit(self, X: pd.DataFrame, lot_ids: pd.Series):
        df = X.copy()
        df['lot_id'] = lot_ids
        for lot_id, group in df.groupby('lot_id'):
            self.lot_stats[lot_id] = {}
            for col in X.columns:
                vals = group[col].dropna()
                median = np.median(vals) if len(vals) > 0 else 0.0
                mad = np.median(np.abs(vals - median)) if len(vals) > 0 else 0.0
                robust_sigma = 1.4826 * mad
                if robust_sigma == 0:
                    robust_sigma = 1e-9
                self.lot_stats[lot_id][col] = {'median': median, 'sigma': robust_sigma, 'mad': mad}
                
    def score(self, X: pd.DataFrame, lot_ids: pd.Series) -> np.ndarray:
        df = X.copy()
        df['lot_id'] = lot_ids
        scores = []
        for idx, row in df.iterrows():
            lot_id = row['lot_id']
            max_z = 0.0
            for col in X.columns:
                val = row[col]
                stats = self.lot_stats.get(lot_id, {}).get(col, {'median': 0.0, 'sigma': 1e-9})
                z = abs(val - stats['median']) / stats['sigma']
                if z > max_z:
                    max_z = z
            scores.append(max_z)
        return np.array(scores)
        
    def predict(
        self, X: pd.DataFrame, lot_ids: pd.Series, threshold: float
    ) -> np.ndarray:
        scores = self.score(X, lot_ids)
        return (scores > threshold).astype(int)
