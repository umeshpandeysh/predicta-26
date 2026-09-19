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

import math
import os
import json
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

CONTRACT_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../../ml/anomaly/fusion_contract.json")
)


def load_authoritative_contract(contract_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Loads and strictly validates the authoritative anomaly fusion contract from JSON.
    Fails closed with RuntimeError if the contract is missing, malformed, or has missing/invalid fields.
    """
    path = contract_path or CONTRACT_PATH
    if not os.path.exists(path):
        raise RuntimeError(f"Authoritative anomaly fusion contract not found at {path}")
    try:
        with open(path, "r", encoding="utf-8") as f:
            contract = json.load(f)
    except Exception as e:
        raise RuntimeError(f"Authoritative anomaly fusion contract is unreadable or malformed JSON: {e}") from e

    if not isinstance(contract, dict):
        raise RuntimeError("Authoritative anomaly fusion contract must be a JSON object")

    fm = contract.get("fusion_methodology")
    if not isinstance(fm, dict):
        raise RuntimeError("Missing 'fusion_methodology' in authoritative anomaly fusion contract")

    weights = fm.get("default_weights")
    if not isinstance(weights, dict):
        raise RuntimeError("Missing 'default_weights' in authoritative anomaly fusion contract")

    required_detectors = ["robust_mad", "copod", "isolation_forest"]
    parsed_weights = {}
    for d in required_detectors:
        if d not in weights:
            raise RuntimeError(f"Missing required detector weight for '{d}' in authoritative anomaly fusion contract")
        w_val = weights[d]
        if not isinstance(w_val, (int, float)) or not math.isfinite(w_val) or w_val < 0:
            raise RuntimeError(f"Invalid non-finite or negative weight for '{d}' in authoritative anomaly fusion contract: {w_val}")
        parsed_weights[d] = float(w_val)

    if sum(parsed_weights.values()) <= 0:
        raise RuntimeError("Total sum of default weights in authoritative anomaly fusion contract must be positive")

    two_t = fm.get("two_threshold_policy")
    if not isinstance(two_t, dict):
        raise RuntimeError("Missing 'two_threshold_policy' in authoritative anomaly fusion contract")

    if "monitor_threshold" not in two_t:
        raise RuntimeError("Missing 'monitor_threshold' in authoritative anomaly fusion contract")
    mon_val = two_t["monitor_threshold"]
    if not isinstance(mon_val, (int, float)) or not math.isfinite(mon_val) or mon_val < 0 or mon_val > 1:
        raise RuntimeError(f"Invalid monitor_threshold in authoritative anomaly fusion contract: {mon_val}")

    if "reject_threshold" not in two_t:
        raise RuntimeError("Missing 'reject_threshold' in authoritative anomaly fusion contract")
    rej_val = two_t["reject_threshold"]
    if not isinstance(rej_val, (int, float)) or not math.isfinite(rej_val) or rej_val < 0 or rej_val > 1:
        raise RuntimeError(f"Invalid reject_threshold in authoritative anomaly fusion contract: {rej_val}")

    if float(mon_val) > float(rej_val):
        raise RuntimeError("monitor_threshold cannot exceed reject_threshold in authoritative anomaly fusion contract")

    return {
        "weights": parsed_weights,
        "monitor_threshold": float(mon_val),
        "reject_threshold": float(rej_val),
        "fusion_threshold": float(rej_val),
    }


class AnomalyFusionEngine(AnomalyDetector):
    def __init__(
        self,
        mad_detector: Optional[RobustMADDetector] = None,
        copod_detector: Optional[COPODDetector] = None,
        iso_detector: Optional[IsolationForestDetector] = None,
        weights: Optional[Dict[str, float]] = None,
        fusion_threshold: Optional[float] = None,
        monitor_threshold: Optional[float] = None,
        reject_threshold: Optional[float] = None,
        norm_scales: Optional[Dict[str, float]] = None,
        contract_path: Optional[str] = None,
    ):
        self.mad_detector = mad_detector
        self.copod_detector = copod_detector
        self.iso_detector = iso_detector

        # Resolve defaults strictly from contract if any are omitted
        if weights is None or monitor_threshold is None or reject_threshold is None or fusion_threshold is None:
            defaults = load_authoritative_contract(contract_path)
        else:
            defaults = None

        self.weights = weights if weights is not None else dict(defaults["weights"])
        self.monitor_threshold = float(monitor_threshold if monitor_threshold is not None else defaults["monitor_threshold"])
        self.reject_threshold = float(reject_threshold if reject_threshold is not None else defaults["reject_threshold"])
        self.fusion_threshold = float(
            fusion_threshold if fusion_threshold is not None else (
                reject_threshold if reject_threshold is not None else defaults["fusion_threshold"]
            )
        )
        self.norm_scales = norm_scales or dict(DEFAULT_NORMALIZATION_SCALES)
        self.feature_names = list(CANONICAL_ANOMALY_FEATURES)

    @classmethod
    def from_artifacts(
        cls,
        anomaly_artifacts: Optional[Dict[str, Any]] = None,
        weights: Optional[Dict[str, float]] = None,
        fusion_threshold: Optional[float] = None,
        monitor_threshold: Optional[float] = None,
        reject_threshold: Optional[float] = None,
        norm_scales: Optional[Dict[str, float]] = None,
        contract_path: Optional[str] = None,
    ) -> "AnomalyFusionEngine":
        """Factory method to construct AnomalyFusionEngine directly from loaded artifacts dictionary."""
        if not anomaly_artifacts:
            return cls(
                mad_detector=None,
                copod_detector=None,
                iso_detector=None,
                weights=weights,
                fusion_threshold=fusion_threshold,
                monitor_threshold=monitor_threshold,
                reject_threshold=reject_threshold,
                norm_scales=norm_scales,
                contract_path=contract_path,
            )

        mad_det = (
            RobustMADDetector(stats=anomaly_artifacts.get("robust_mad", {}))
            if "robust_mad" in anomaly_artifacts
            else None
        )
        copod_det = (
            COPODDetector(model_data=anomaly_artifacts.get("copod", {}))
            if "copod" in anomaly_artifacts
            else None
        )
        iso_det = (
            IsolationForestDetector(forest_data=anomaly_artifacts.get("isolation_forest", {}))
            if "isolation_forest" in anomaly_artifacts
            and isinstance(anomaly_artifacts.get("isolation_forest"), dict)
            and "trees" in anomaly_artifacts.get("isolation_forest", {})
            else None
        )

        return cls(
            mad_detector=mad_det,
            copod_detector=copod_det,
            iso_detector=iso_det,
            weights=weights,
            fusion_threshold=fusion_threshold,
            monitor_threshold=monitor_threshold,
            reject_threshold=reject_threshold,
            norm_scales=norm_scales,
            contract_path=contract_path,
        )

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

        w_mad = self.weights.get("robust_mad", self.weights.get("mad"))
        w_copod = self.weights.get("copod")
        w_iso = self.weights.get("isolation_forest", self.weights.get("iso"))
        if w_mad is None or w_copod is None or w_iso is None:
            raise RuntimeError("AnomalyFusionEngine weights dictionary is missing required detector weights")

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

