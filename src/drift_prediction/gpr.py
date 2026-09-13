import numpy as np
import pandas as pd
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, WhiteKernel
from .base import DriftPredictor

class GPRDriftPredictor(DriftPredictor):
    def __init__(self, random_seed=42):
        kernel = (
            RBF(length_scale=1.0, length_scale_bounds=(1e-2, 1e3))
            + WhiteKernel(noise_level=1e-3, noise_level_bounds=(1e-5, 1e1))
        )
        self.model = GaussianProcessRegressor(
            kernel=kernel,
            alpha=0.0,
            n_restarts_optimizer=5,
            random_state=random_seed
        )

    @staticmethod
    def _validate_finite_frame(X: pd.DataFrame, name: str) -> pd.DataFrame:
        if not isinstance(X, pd.DataFrame) or X.empty:
            raise ValueError(f"{name} must be a non-empty pandas DataFrame")
        numeric = X.apply(pd.to_numeric, errors="raise")
        values = numeric.to_numpy(dtype=float)
        if not np.isfinite(values).all():
            raise ValueError(f"{name} contains missing, NaN, or infinite values; explicit imputation is required upstream")
        return numeric

    def fit(self, X: pd.DataFrame, y: pd.Series):
        X_valid = self._validate_finite_frame(X, "X")
        y_valid = pd.to_numeric(y, errors="raise")
        y_values = y_valid.to_numpy(dtype=float)
        if len(y_values) != len(X_valid) or not np.isfinite(y_values).all():
            raise ValueError("y must match X length and contain only finite values")
        self.model.fit(X_valid, y_valid)

    def predict(self, X: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
        X_valid = self._validate_finite_frame(X, "X")
        mean, std = self.model.predict(X_valid, return_std=True)
        return mean, std
