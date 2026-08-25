import numpy as np
import pandas as pd
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, WhiteKernel
from .base import DriftPredictor

class GPRDriftPredictor(DriftPredictor):
    def __init__(self, random_seed=42):
        kernel = RBF(length_scale=1.0, length_scale_bounds=(1e-2, 1e3)) + WhiteKernel(noise_level=1e-3, noise_level_bounds=(1e-5, 1e1))
        self.model = GaussianProcessRegressor(
            kernel=kernel,
            alpha=0.0,
            n_restarts_optimizer=5,
            random_state=random_seed
        )
        
    def fit(self, X: pd.DataFrame, y: pd.Series):
        self.model.fit(X.fillna(0.0), y.fillna(0.0))
        
    def predict(self, X: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
        mean, std = self.model.predict(X.fillna(0.0), return_std=True)
        return mean, std
