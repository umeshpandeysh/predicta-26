import numpy as np
import pandas as pd
from .base import AnomalyDetector

class COPODDetector(AnomalyDetector):
    def __init__(self):
        self.ecdfs = {}

    def fit(self, X: pd.DataFrame, lot_ids: pd.Series):
        df = X.copy()
        df['lot_id'] = lot_ids
        for lot_id, group in df.groupby('lot_id'):
            self.ecdfs[lot_id] = {}
            for col in X.columns:
                sorted_vals = np.sort(group[col].values)
                self.ecdfs[lot_id][col] = sorted_vals

    def _get_ecdf_val(self, val, sorted_vals):
        n = len(sorted_vals)
        if n == 0:
            return 0.5
        pos = np.searchsorted(sorted_vals, val, side='right')
        return max(1e-9, min(1.0 - 1e-9, pos / n))

    def score(self, X: pd.DataFrame, lot_ids: pd.Series) -> np.ndarray:
        df = X.copy()
        df['lot_id'] = lot_ids
        scores = []
        for idx, row in df.iterrows():
            lot_id = row['lot_id']
            left_tail_sum = 0.0
            right_tail_sum = 0.0

            for col in X.columns:
                val = row[col]
                sorted_vals = self.ecdfs.get(lot_id, {}).get(col, np.array([]))
                ecdf_val = self._get_ecdf_val(val, sorted_vals)

                left_tail_sum += -np.log(ecdf_val)
                right_tail_sum += -np.log(1.0 - ecdf_val)

            scores.append(max(left_tail_sum, right_tail_sum))
        return np.array(scores)

    def predict(
        self, X: pd.DataFrame, lot_ids: pd.Series, threshold: float
    ) -> np.ndarray:
        scores = self.score(X, lot_ids)
        return (scores > threshold).astype(int)
