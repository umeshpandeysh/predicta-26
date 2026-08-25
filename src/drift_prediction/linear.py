import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from .base import DriftPredictor

class LinearDriftPredictor(DriftPredictor):
    def __init__(self):
        self.model = LinearRegression()
        
    def fit(self, X: pd.DataFrame, y: pd.Series):
        self.model.fit(X.fillna(0.0), y.fillna(0.0))
        
    def predict(self, X: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
        preds = self.model.predict(X.fillna(0.0))
        # Linear regression doesn't naturally output prediction intervals;
        # We output a constant baseline variance proxy (5% relative std deviation)
        stds = np.abs(preds) * 0.05
        return preds, stds
