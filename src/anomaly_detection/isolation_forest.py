import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from .base import AnomalyDetector

class IsolationForestDetector(AnomalyDetector):
    def __init__(self, n_estimators=100, contamination=0.03, random_seed=42):
        self.lot_stats = {}
        self.model = IsolationForest(
            n_estimators=n_estimators,
            contamination=contamination,
            random_state=random_seed
        )

    def fit(self, X: pd.DataFrame, lot_ids: pd.Series):
        X_norm = self._robust_normalize(X, lot_ids)
        self.model.fit(X_norm)

    def _robust_normalize(self, X, lot_ids):
        df = X.copy()
        df['lot_id'] = lot_ids
        X_norm = pd.DataFrame(index=X.index, columns=X.columns)
        for lot_id, group in df.groupby('lot_id'):
            for col in X.columns:
                vals = group[col]
                median = np.median(vals) if len(vals) > 0 else 0.0
                mad = np.median(np.abs(vals - median)) if len(vals) > 0 else 0.0
                sigma = 1.4826 * mad
                self.lot_stats.setdefault(lot_id, {})[col] = (median, sigma)
                if sigma == 0:
                    X_norm.loc[group.index, col] = np.where(np.isclose(vals, median, rtol=1e-9, atol=1e-12), 0.0, np.nan)
                else:
                    X_norm.loc[group.index, col] = (vals - median) / sigma
        if X_norm.isna().any().any():
            raise ValueError("Degenerate or missing values cannot be silently normalized for Isolation Forest")
        return X_norm.astype(float)

    def score(self, X: pd.DataFrame, lot_ids: pd.Series) -> np.ndarray:
        X_norm = self._robust_normalize(X, lot_ids)
        return -self.model.score_samples(X_norm)

    def predict(
        self, X: pd.DataFrame, lot_ids: pd.Series, threshold: float
    ) -> np.ndarray:
        scores = self.score(X, lot_ids)
        return (scores > threshold).astype(int)
