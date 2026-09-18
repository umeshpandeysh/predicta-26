"""
Predicta Semiconductor Intelligence Platform — Multi-Criteria Anomaly Fusion
File: src/anomaly_detection/fusion.py

Implements authoritative multi-criteria anomaly fusion combining:
  1. Robust MAD (Part Average Testing)
  2. COPOD (Tail-copula outlier probabilities)
  3. Isolation Forest (Multi-dimensional partitioning)

Policies:
  - CONSERVATIVE_MAX_FUSION: Alarm raised if any active detector exceeds reject threshold
  - WEIGHTED_SCORE_FUSION: Calibrated linear combination:
      S_fusion = sum_{d in active} (w_d / sum_w) * norm(S_d)
  - TWO_THRESHOLD_POLICY: MONITOR_THRESHOLD (0.35) and REJECT_THRESHOLD (0.50)
  - ZERO_DETECTOR_FAIL_CLOSED: Emits INSUFFICIENT_EVIDENCE if zero detectors active
"""

from typing import Any, Dict, List, Optional, Union
import numpy as np
import pandas as pd

from .base import AnomalyDetector
from .robust_mad import RobustMADDetector
from .copod import COPODDetector
from .isolation_forest import IsolationForestDetector
from .normalization import (
    DEFAULT_NORMALIZATION_SCALES,
    CALIBRATION_STATUS,
    VALIDATION_STATUS,
    normalize_detector_score,
)


CANONICAL_ANOMALY_FEATURES = ["iddq", "ileak", "tpd"]


class AnomalyFusionEngine(AnomalyDetector):
    def __init__(
        self,
        mad_detector: Optional[RobustMADDetector] = None,
        copod_detector: Optional[COPODDetector] = None,
        iso_detector: Optional[IsolationForestDetector] = None,
        weights: Optional[Dict[str, float]] = None,
        fusion_threshold: float = 0.50,
        monitor_threshold: float = 0.35,
        reject_threshold: float = 0.50,
        norm_scales: Optional[Dict[str, float]] = None,
    ):
        self.mad_detector = mad_detector
        self.copod_detector = copod_detector
        self.iso_detector = iso_detector
        self.weights = weights or {"robust_mad": 0.35, "copod": 0.35, "isolation_forest": 0.30}
        self.fusion_threshold = float(fusion_threshold)
        self.monitor_threshold = float(monitor_threshold)
        self.reject_threshold = float(reject_threshold if reject_threshold is not None else fusion_threshold)
        self.norm_scales = norm_scales or dict(DEFAULT_NORMALIZATION_SCALES)
        self.feature_names = list(CANONICAL_ANOMALY_FEATURES)

    def _clean_lot_id(self, lot_id: Optional[str]) -> Optional[str]:
        if lot_id is None:
            return None
        s = str(lot_id).strip()
        if not s or s.lower() in ("none", "nan", "null"):
            return None
        return s

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
        if not isinstance(features, dict):
            raise ValueError("Input features must be a dictionary")

        # Strict canonical feature schema and exact key insertion order enforcement
        feature_keys = list(features.keys())
        if feature_keys != CANONICAL_ANOMALY_FEATURES:
            raise ValueError(
                f"Feature schema/order mismatch. Expected exact canonical dictionary keys {CANONICAL_ANOMALY_FEATURES} in exact order, got {feature_keys}"
            )

        for col in CANONICAL_ANOMALY_FEATURES:
            val_raw = features[col]
            if val_raw is None or isinstance(val_raw, (str, bool)) or not np.isfinite(float(val_raw)):
                raise ValueError(f"Invalid non-numeric or non-finite value for feature '{col}': {val_raw}")

        clean_lot = self._clean_lot_id(lot_id)

        # Detect active sub-detectors
        active_detectors: List[str] = []
        detector_evidence: Dict[str, Any] = {}
        raw_weights: Dict[str, float] = {}

        w_mad = self.weights.get("robust_mad", self.weights.get("mad", 0.35))
        w_copod = self.weights.get("copod", 0.35)
        w_iso = self.weights.get("isolation_forest", self.weights.get("iso", 0.30))

        mad_res: Optional[Dict[str, Any]] = None
        copod_res: Optional[Dict[str, Any]] = None
        iso_res: Optional[Dict[str, Any]] = None

        if self.mad_detector is not None:
            mad_res = self.mad_detector.score_single(features, lot_id=clean_lot)
            active_detectors.append("robust_mad")
            detector_evidence["robust_mad"] = mad_res
            raw_weights["robust_mad"] = w_mad

        if self.copod_detector is not None:
            copod_res = self.copod_detector.score_single(features)
            active_detectors.append("copod")
            detector_evidence["copod"] = copod_res
            raw_weights["copod"] = w_copod

        if self.iso_detector is not None:
            iso_res = self.iso_detector.score_single(features)
            active_detectors.append("isolation_forest")
            detector_evidence["isolation_forest"] = iso_res
            raw_weights["isolation_forest"] = w_iso

        # Policy: Zero active detectors fail-closed
        if not active_detectors:
            return {
                "anomaly_score": None,
                "anomaly_status": "INSUFFICIENT_EVIDENCE",
                "overall_status": "INSUFFICIENT_EVIDENCE",
                "weighted_fusion_score": None,
                "conservative_alarm": False,
                "fusion_method": "NO_ACTIVE_DETECTORS",
                "contributing_detectors": [],
                "detector_evidence": {},
                "evidence": {},
                "reference_status": "INSUFFICIENT_EVIDENCE",
                "reference_source": "NONE",
                "reference_sample_count": 0,
                "lot_id": clean_lot,
                "reference_context": {
                    "lot_id": clean_lot,
                    "status": "INSUFFICIENT_EVIDENCE",
                    "source": "NONE",
                    "sample_count": 0,
                },
                "calibration_status": CALIBRATION_STATUS,
                "validation_status": VALIDATION_STATUS,
                "promotion_status": "BENCHMARK_ONLY",
            }

        # Dynamic weight re-normalization across active detectors
        total_w = sum(raw_weights[d] for d in active_detectors)
        if total_w <= 0.0:
            total_w = float(len(active_detectors))
            norm_w = {d: 1.0 / total_w for d in active_detectors}
        else:
            norm_w = {d: raw_weights[d] / total_w for d in active_detectors}

        weighted_score = 0.0
        for d in active_detectors:
            ev = detector_evidence[d]
            norm_s = ev.get("normalized_score")
            if norm_s is None:
                norm_s = normalize_detector_score(d, ev["score"], self.norm_scales)
            weighted_score += norm_w[d] * norm_s

        # Two-Threshold & Conservative Alarm Synthesis
        is_reject = any(detector_evidence[d]["status"] == "REJECT" for d in active_detectors)
        is_monitor = any(detector_evidence[d]["status"] == "MONITOR" for d in active_detectors)

        if weighted_score >= self.reject_threshold or is_reject:
            overall_status = "REJECT"
        elif weighted_score >= self.monitor_threshold or is_monitor:
            overall_status = "MONITOR"
        else:
            overall_status = "PASS"

        # Reference Context Propagation
        if mad_res is not None:
            ref_status = mad_res.get("reference_status", "UNKNOWN_LOT")
            ref_source = mad_res.get("reference_source", "GLOBAL_FALLBACK")
            ref_count = mad_res.get("reference_sample_count", 0)
            final_lot = mad_res.get("lot_id", clean_lot)
        else:
            ref_status = "UNKNOWN_LOT"
            ref_source = "GLOBAL_FALLBACK"
            ref_count = 0
            final_lot = clean_lot

        legacy_evidence = {
            "mad": mad_res if mad_res is not None else {"score": 0.0, "status": "PASS", "reference_source": "GLOBAL_FALLBACK"},
            "copod": copod_res if copod_res is not None else {"score": 0.0, "status": "PASS"},
            "isolation_forest": iso_res if iso_res is not None else {"score": 0.0, "status": "PASS"},
        }

        return {
            "anomaly_score": round(weighted_score, 4),
            "anomaly_status": overall_status,
            "overall_status": overall_status,
            "weighted_fusion_score": round(weighted_score, 4),
            "conservative_alarm": bool(is_reject),
            "fusion_method": "WEIGHTED_SCORE_FUSION",
            "contributing_detectors": active_detectors,
            "detector_evidence": detector_evidence,
            "evidence": legacy_evidence,
            "reference_status": ref_status,
            "reference_source": ref_source,
            "reference_sample_count": ref_count,
            "lot_id": final_lot,
            "reference_context": {
                "lot_id": final_lot,
                "status": ref_status,
                "source": ref_source,
                "sample_count": ref_count,
            },
            "calibration_status": CALIBRATION_STATUS,
            "validation_status": VALIDATION_STATUS,
            "promotion_status": "BENCHMARK_ONLY",
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

        if not self.mad_detector and not self.copod_detector and not self.iso_detector:
            raise ValueError("No anomaly detectors are configured in the fusion engine")

        scores = np.zeros(len(X), dtype=float)
        lot_list = [None] * len(X)
        if lot_ids is not None:
            lot_list = lot_ids.tolist() if isinstance(lot_ids, pd.Series) else list(lot_ids)

        for i in range(len(X)):
            row_dict = X.iloc[i].to_dict()
            lot_id = lot_list[i] if i < len(lot_list) else None
            res = self.evaluate_component(row_dict, lot_id)
            scores[i] = res["weighted_fusion_score"] if res["weighted_fusion_score"] is not None else 0.0

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
        th = float(threshold) if threshold is not None else self.reject_threshold
        scores = self.score(X, lot_ids)
        return (scores >= th).astype(int)

    def export_parameters(self) -> Dict[str, Any]:
        """Serializes full fusion engine parameters."""
        return {
            "fusion_policy": "CONSERVATIVE_AND_WEIGHTED_SCORE",
            "weights": self.weights,
            "fusion_threshold": self.fusion_threshold,
            "monitor_threshold": self.monitor_threshold,
            "reject_threshold": self.reject_threshold,
            "normalization_scales": self.norm_scales,
            "mad_parameters": self.mad_detector.export_parameters() if self.mad_detector else None,
            "copod_parameters": self.copod_detector.export_parameters() if self.copod_detector else None,
            "isolation_forest_parameters": self.iso_detector.export_parameters() if self.iso_detector else None,
            "calibration_status": CALIBRATION_STATUS,
            "validation_status": VALIDATION_STATUS,
            "promotion_status": "BENCHMARK_ONLY",
        }

