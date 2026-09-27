"""
Predicta Semiconductor Intelligence Platform — Mahalanobis Anomaly Challenger
File: src/anomaly_detection/mahalanobis_challenger.py

Status: CHALLENGER / BENCHMARK ONLY (Not in production decision path)
Domain: SIH 2026 PS-170 — Semiconductor Burn-In Telemetry & Screening

Implements a mathematically rigorous Multivariate Mahalanobis Distance outlier detector:
  - Robust training-only sample covariance estimation
  - Regularized covariance inversion (pinv + epsilon damping) for singular/near-singular stability
  - Chi-squared critical value gating for D=3 degrees of freedom
  - Zero evaluation-set fitting, zero future-information leakage
"""

from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd

from .base import AnomalyDetector

CANONICAL_ANOMALY_FEATURES = ["iddq", "ileak", "tpd"]

# Chi-squared critical thresholds for D=3 degrees of freedom
# chi2.ppf(0.95, 3) = 7.815 -> sqrt = 2.795
# chi2.ppf(0.99, 3) = 11.345 -> sqrt = 3.368
# chi2.ppf(0.999, 3) = 16.266 -> sqrt = 4.033
DEFAULT_WARNING_THRESHOLD = 2.795  # 95% quantile
DEFAULT_REJECT_THRESHOLD = 3.368   # 99% quantile


class MahalanobisChallenger(AnomalyDetector):
    """Multivariate Mahalanobis Distance Anomaly Detector (Challenger Baseline)."""

    def __init__(
        self,
        warning_threshold: float = DEFAULT_WARNING_THRESHOLD,
        reject_threshold: float = DEFAULT_REJECT_THRESHOLD,
        epsilon: float = 1e-6,
    ):
        self.warning_threshold = float(warning_threshold)
        self.reject_threshold = float(reject_threshold)
        self.epsilon = float(epsilon)
        self.mean_vector: Optional[np.ndarray] = None
        self.covariance_matrix: Optional[np.ndarray] = None
        self.inv_covariance: Optional[np.ndarray] = None
        self.feature_names: List[str] = list(CANONICAL_ANOMALY_FEATURES)
        self.is_fitted: bool = False

    def fit(self, X: Union[pd.DataFrame, np.ndarray], lot_ids: Optional[Any] = None) -> "MahalanobisChallenger":
        """Fits mean and covariance matrix strictly on training partition."""
        if isinstance(X, pd.DataFrame):
            data = X[self.feature_names].values.astype(np.float64)
        else:
            data = np.asarray(X, dtype=np.float64)

        if data.ndim != 2 or data.shape[1] != len(self.feature_names):
            raise ValueError(
                f"Expected 2D array with {len(self.feature_names)} features, got shape {data.shape}"
            )

        # Filter non-finite values if any
        valid_mask = np.all(np.isfinite(data), axis=1)
        data_clean = data[valid_mask]

        if len(data_clean) < len(self.feature_names) + 1:
            raise ValueError(f"Insufficient training samples ({len(data_clean)}) to estimate covariance.")

        self.mean_vector = np.mean(data_clean, axis=0)
        cov = np.cov(data_clean, rowvar=False)

        # Handle 1D case edge-case safely
        if cov.ndim == 0:
            cov = np.array([[cov]])

        # Regularize to guarantee positive definiteness & invertibility
        cov_reg = cov + self.epsilon * np.eye(cov.shape[0])
        self.covariance_matrix = cov_reg
        self.inv_covariance = np.linalg.pinv(cov_reg)
        self.is_fitted = True
        return self

    def compute_distance(self, X: Union[pd.DataFrame, np.ndarray]) -> np.ndarray:
        """Computes continuous Mahalanobis distance D_M for sample matrix X."""
        if not self.is_fitted:
            raise RuntimeError("MahalanobisChallenger must be fitted before computing distance.")

        if isinstance(X, pd.DataFrame):
            data = X[self.feature_names].values.astype(np.float64)
        else:
            data = np.asarray(X, dtype=np.float64)

        diff = data - self.mean_vector
        # Vectorized calculation: D^2 = sum((diff @ inv_cov) * diff, axis=1)
        d_sq = np.sum(diff @ self.inv_covariance * diff, axis=1)
        return np.sqrt(np.maximum(0.0, d_sq))

    def score(self, X: Union[pd.DataFrame, np.ndarray], lot_ids: Optional[Any] = None) -> np.ndarray:
        """Computes continuous anomaly scores (Mahalanobis distance) for matrix X."""
        return self.compute_distance(X)

    def predict(
        self,
        X: Union[pd.DataFrame, np.ndarray],
        lot_ids: Optional[Any] = None,
        threshold: Optional[float] = None,
    ) -> np.ndarray:
        """Binary anomaly prediction: 1 if distance >= threshold else 0."""
        thresh = float(threshold if threshold is not None else self.reject_threshold)
        scores = self.score(X, lot_ids)
        return (scores >= thresh).astype(int)

    def score_single(
        self,
        component_data: Dict[str, float],
        lot_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Scores a single component record and returns status + distance."""
        if not self.is_fitted:
            return {
                "score": None,
                "status": "INSUFFICIENT_EVIDENCE",
                "detector": "mahalanobis_challenger",
                "error": "Detector not fitted",
            }

        try:
            vec = np.array([[float(component_data[k]) for k in self.feature_names]], dtype=np.float64)
            d = float(self.compute_distance(vec)[0])

            if d >= self.reject_threshold:
                status = "REJECT"
            elif d >= self.warning_threshold:
                status = "MONITOR"
            else:
                status = "PASS"

            return {
                "score": round(d, 4),
                "status": status,
                "detector": "mahalanobis_challenger",
                "warning_threshold": self.warning_threshold,
                "reject_threshold": self.reject_threshold,
                "is_anomalous": status in ["MONITOR", "REJECT"],
            }
        except Exception as e:
            return {
                "score": None,
                "status": "CONFIGURATION_ERROR",
                "detector": "mahalanobis_challenger",
                "error": str(e),
            }
