"""
Predicta Semiconductor Intelligence Platform — COPOD Outlier Detection
File: src/anomaly_detection/copod.py

Implements Empirical Copula-Based Outlier Detection (COPOD).
Features:
  - Non-parametric tail probability estimation using empirical cumulative distribution functions (ECDFs)
  - Left-tail (-log(F(x))) and right-tail (-log(1 - F(x))) copula sum evaluation
  - Deterministic bisect-based empirical quantile ranking
  - Safe clipping against numerical singularity (1e-6)
  - Exportable ECDF reference parameters for Node.js / runtime parity
"""

import bisect
import math
from typing import Any, Dict, List, Optional, Union
import numpy as np
import pandas as pd

from .base import AnomalyDetector


class COPODDetector(AnomalyDetector):
    def __init__(
        self,
        warning_score: float = 6.5,
        reject_score: float = 9.5,
        ecdfs: Optional[Dict[str, List[float]]] = None,
    ):
        self.warning_score = float(warning_score)
        self.reject_score = float(reject_score)
        self.global_ecdfs: Dict[str, List[float]] = ecdfs or {}
        self.feature_names: List[str] = ["iddq", "ileak", "tpd"]

    def fit(self, X: pd.DataFrame, lot_ids: Optional[pd.Series] = None):
        """Fits empirical copula distributions strictly from training partition."""
        if not isinstance(X, pd.DataFrame) or X.empty:
            raise ValueError("COPOD requires a non-empty DataFrame")

        self.feature_names = list(X.columns)
        self.global_ecdfs = {}

        for col in self.feature_names:
            vals = X[col].dropna().to_numpy(dtype=float)
            if len(vals) == 0:
                raise ValueError(f"Feature '{col}' contains no valid training samples")
            sorted_vals = np.sort(vals).tolist()
            self.global_ecdfs[col] = sorted_vals

    def score_single(self, features: Dict[str, float]) -> Dict[str, Any]:
        """Calculates tail copula score for an individual component."""
        left_tail_sum = 0.0
        right_tail_sum = 0.0
        feature_scores: Dict[str, float] = {}

        for col in self.feature_names:
            if col not in features or features[col] is None or not np.isfinite(float(features[col])):
                continue
            val = float(features[col])
            sorted_ref = self.global_ecdfs.get(col, [])
            if not sorted_ref:
                continue

            n_ref = len(sorted_ref)
            pos = bisect.bisect_right(sorted_ref, val)
            pct = max(1e-6, min(1.0 - 1e-6, pos / n_ref))

            left_tail = -math.log(pct)
            right_tail = -math.log(1.0 - pct)
            dim_score = max(left_tail, right_tail)
            feature_scores[col] = round(dim_score, 4)

            left_tail_sum += left_tail
            right_tail_sum += right_tail

        total_score = max(left_tail_sum, right_tail_sum)
        status = "REJECT" if total_score > self.reject_score else ("MONITOR" if total_score > self.warning_score else "PASS")

        return {
            "score": round(total_score, 4),
            "status": status,
            "feature_scores": feature_scores,
            "left_tail_sum": round(left_tail_sum, 4),
            "right_tail_sum": round(right_tail_sum, 4),
        }

    def score(
        self,
        X: pd.DataFrame,
        lot_ids: Optional[Union[pd.Series, List[str]]] = None,
    ) -> np.ndarray:
        """Batch scoring for evaluation datasets."""
        if not isinstance(X, pd.DataFrame):
            raise ValueError("Input X must be a pandas DataFrame")

        scores = np.zeros(len(X), dtype=float)
        for i in range(len(X)):
            row_dict = X.iloc[i].to_dict()
            res = self.score_single(row_dict)
            scores[i] = res["score"]
        return scores

    def predict(
        self,
        X: pd.DataFrame,
        lot_ids: Optional[Union[pd.Series, List[str]]] = None,
        threshold: Optional[float] = None,
    ) -> np.ndarray:
        th = float(threshold) if threshold is not None else self.reject_score
        scores = self.score(X, lot_ids)
        return (scores >= th).astype(int)

    def export_parameters(self) -> Dict[str, Any]:
        """Serializes COPOD parameters into production artifact format."""
        return {
            "features": self.feature_names,
            "global_ecdfs": self.global_ecdfs,
            "thresholds": {
                "warning_score": self.warning_score,
                "reject_score": self.reject_score,
            },
        }
