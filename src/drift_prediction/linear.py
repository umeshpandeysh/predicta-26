import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from .base import DriftPredictor

class LinearDriftPredictor(DriftPredictor):
    def __init__(self):
        self.model = LinearRegression()

    @staticmethod
    def _validate(X, y=None):
        Xv = X.apply(pd.to_numeric, errors="raise")
        if Xv.empty or not np.isfinite(Xv.to_numpy(dtype=float)).all():
            raise ValueError("Linear drift input must be non-empty and finite")
        if y is not None:
            yv = pd.to_numeric(y, errors="raise")
            if len(yv) != len(Xv) or not np.isfinite(yv.to_numpy(dtype=float)).all():
                raise ValueError("Linear drift target must be finite and aligned")
            return Xv, yv
        return Xv

    def fit(self, X: pd.DataFrame, y: pd.Series):
        Xv, yv = self._validate(X, y)
        self.model.fit(Xv, yv)

    def predict(self, X: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
        preds = self.model.predict(self._validate(X))
        # Linear regression doesn't naturally output prediction intervals;
        # We output a constant baseline variance proxy (5% relative std deviation)
        stds = np.abs(preds) * 0.05
        return preds, stds
