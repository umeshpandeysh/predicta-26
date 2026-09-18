"""
Predicta Semiconductor Intelligence Platform — Multi-Criteria Anomaly Fusion
File: src/anomaly_detection/fusion.py

Implements deterministic multi-criteria anomaly fusion combining:
  1. Robust MAD (Part Average Testing)
  2. COPOD (Tail-copula outlier probabilities)
  3. Isolation Forest (Multi-dimensional partitioning)

Policies:
  - CONSERVATIVE_FUSION: Alarm raised if any detector exceeds reject threshold
  - WEIGHTED_SCORE_FUSION: Calibrated linear combination:
      S_fusion = w_mad * norm(S_mad) + w_copod * norm(S_copod) + w_iso * norm(S_iso)
"""

from typing import Any, Dict, List, Optional, Union
import numpy as np
import pandas as pd

from .base import AnomalyDetector
from .robust_mad import RobustMADDetector
from .copod import COPODDetector
from .isolation_forest import IsolationForestDetector


CANONICAL_ANOMALY_FEATURES = ["iddq", "ileak", "tpd"]

DEFAULT_NORMALIZATION_SCALES = {
    "mad_scale": 6.0,
    "copod_scale": 9.5,
    "iso_min": 0.40,
    "iso_scale": 0.30,
}


class AnomalyFusionEngine(AnomalyDetector):
    def __init__(
        self,
        mad_detector: Optional[RobustMADDetector] = None,
        copod_detector: Optional[COPODDetector] = None,
        iso_detector: Optional[IsolationForestDetector] = None,
        weights: Optional[Dict[str, float]] = None,
        fusion_threshold: float = 0.50,
        norm_scales: Optional[Dict[str, float]] = None,
    ):
        self.mad_detector = mad_detector
        self.copod_detector = copod_detector
        self.iso_detector = iso_detector
        self.weights = weights or {"mad": 0.35, "copod": 0.35, "isolation_forest": 0.30}
        self.fusion_threshold = float(fusion_threshold)
        self.norm_scales = norm_scales or dict(DEFAULT_NORMALIZATION_SCALES)
        self.feature_names = list(CANONICAL_ANOMALY_FEATURES)

    def fit(self, X: pd.DataFrame, lot_ids: Optional[pd.Series] = None):
        """Fits all underlying detectors on the training partition."""
        if not isinstance(X, pd.DataFrame) or X.empty:
            raise ValueError("AnomalyFusionEngine requires a non-empty DataFrame")
        if list(X.columns) != CANONICAL_ANOMALY_FEATURES:
            raise ValueError(
                f"Feature schema/order mismatch. Expected exact canonical features {CANONICAL_ANOMALY_FEATURES}, got {list(X.columns)}"
            )

        if self.mad_detector:
            self.mad_detector.fit(X, lot_ids)
        if self.copod_detector:
            self.copod_detector.fit(X, lot_ids)
        if self.iso_detector:
            self.iso_detector.fit(X, lot_ids)

    def evaluate_component(
        self,
        features: Dict[str, float],
        lot_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Evaluates all individual detectors and synthesizes authoritative anomaly evidence."""
        mad_res = self.mad_detector.score_single(features, lot_id) if self.mad_detector else {"score": 0.0, "status": "PASS"}
        copod_res = self.copod_detector.score_single(features) if self.copod_detector else {"score": 0.0, "status": "PASS"}
        iso_res = self.iso_detector.score_single(features) if self.iso_detector else {"score": 0.0, "status": "PASS"}

        # Normalize individual scores to [0, 1] relative to explicit screening scales
        mad_scale = float(self.norm_scales.get("mad_scale", 6.0))
        copod_scale = float(self.norm_scales.get("copod_scale", 9.5))
        iso_min = float(self.norm_scales.get("iso_min", 0.40))
        iso_scale = float(self.norm_scales.get("iso_scale", 0.30))

        norm_mad = min(1.0, max(0.0, mad_res["score"] / mad_scale))
        norm_copod = min(1.0, max(0.0, copod_res["score"] / copod_scale))
        norm_iso = min(1.0, max(0.0, (iso_res["score"] - iso_min) / iso_scale)) if iso_res["score"] >= iso_min else 0.0

        w_mad = self.weights.get("mad", 0.35)
        w_copod = self.weights.get("copod", 0.35)
        w_iso = self.weights.get("isolation_forest", 0.30)
        total_w = w_mad + w_copod + w_iso
        w_mad, w_copod, w_iso = w_mad / total_w, w_copod / total_w, w_iso / total_w

        weighted_score = (w_mad * norm_mad) + (w_copod * norm_copod) + (w_iso * norm_iso)

        # Conservative Rule
        conservative_reject = (
            mad_res["status"] == "REJECT" or
            copod_res["status"] == "REJECT" or
            iso_res["status"] == "REJECT"
        )
        conservative_monitor = (
            mad_res["status"] == "MONITOR" or
            copod_res["status"] == "MONITOR" or
            iso_res["status"] == "MONITOR"
        )

        overall_status = "REJECT" if conservative_reject else ("MONITOR" if conservative_monitor else "PASS")

        return {
            "overall_status": overall_status,
            "weighted_fusion_score": round(weighted_score, 4),
            "conservative_alarm": bool(conservative_reject),
            "evidence": {
                "mad": mad_res,
                "copod": copod_res,
                "isolation_forest": iso_res,
            },
        }

    def score(
        self,
        X: pd.DataFrame,
        lot_ids: Optional[Union[pd.Series, List[str]]] = None,
    ) -> np.ndarray:
        """Computes weighted fusion scores for a batch DataFrame."""
        if not isinstance(X, pd.DataFrame):
            raise ValueError("Input X must be a pandas DataFrame")
        if list(X.columns) != CANONICAL_ANOMALY_FEATURES:
            raise ValueError(
                f"Feature schema/order mismatch. Expected exact canonical features {CANONICAL_ANOMALY_FEATURES}, got {list(X.columns)}"
            )

        scores = np.zeros(len(X), dtype=float)
        lot_list = [None] * len(X)
        if lot_ids is not None:
            lot_list = lot_ids.tolist() if isinstance(lot_ids, pd.Series) else list(lot_ids)

        for i in range(len(X)):
            row_dict = X.iloc[i].to_dict()
            lot_id = lot_list[i] if i < len(lot_list) else None
            res = self.evaluate_component(row_dict, lot_id)
            scores[i] = res["weighted_fusion_score"]

        return scores

    def score_conservative(
        self,
        X: pd.DataFrame,
        lot_ids: Optional[Union[pd.Series, List[str]]] = None,
    ) -> np.ndarray:
        """Returns 1 if any detector alarms on sample, 0 otherwise."""
        if not isinstance(X, pd.DataFrame):
            raise ValueError("Input X must be a pandas DataFrame")
        if list(X.columns) != CANONICAL_ANOMALY_FEATURES:
            raise ValueError(
                f"Feature schema/order mismatch. Expected exact canonical features {CANONICAL_ANOMALY_FEATURES}, got {list(X.columns)}"
            )

        scores = np.zeros(len(X), dtype=float)
        lot_list = [None] * len(X)
        if lot_ids is not None:
            lot_list = lot_ids.tolist() if isinstance(lot_ids, pd.Series) else list(lot_ids)

        for i in range(len(X)):
            row_dict = X.iloc[i].to_dict()
            lot_id = lot_list[i] if i < len(lot_list) else None
            res = self.evaluate_component(row_dict, lot_id)
            scores[i] = 1.0 if res["conservative_alarm"] else 0.0

        return scores

    def predict(
        self,
        X: pd.DataFrame,
        lot_ids: Optional[Union[pd.Series, List[str]]] = None,
        threshold: Optional[float] = None,
    ) -> np.ndarray:
        th = float(threshold) if threshold is not None else self.fusion_threshold
        scores = self.score(X, lot_ids)
        return (scores >= th).astype(int)

    def export_parameters(self) -> Dict[str, Any]:
        """Serializes full fusion engine parameters."""
        return {
            "fusion_policy": "CONSERVATIVE_AND_WEIGHTED_SCORE",
            "weights": self.weights,
            "fusion_threshold": self.fusion_threshold,
            "normalization_scales": self.norm_scales,
            "mad_parameters": self.mad_detector.export_parameters() if self.mad_detector else None,
            "copod_parameters": self.copod_detector.export_parameters() if self.copod_detector else None,
            "isolation_forest_parameters": self.iso_detector.export_parameters() if self.iso_detector else None,
        }
