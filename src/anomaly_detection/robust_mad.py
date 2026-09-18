"""
Predicta Semiconductor Intelligence Platform — Robust MAD (Part Average Testing)
File: src/anomaly_detection/robust_mad.py

Implements lot-relative and global Median Absolute Deviation (MAD) Part Average Testing (PAT).
Features:
  - Global baseline reference statistics (median, MAD, robust sigma = 1.4826 * MAD)
  - Lot-specific reference statistics with strict reference governance (min_reference_size >= 10)
  - Reference population quality evaluation (sample count, non-finite values, near-zero scale)
  - Explicit tracking of reference status ("LOT_RELATIVE", "INSUFFICIENT_REFERENCE", "UNKNOWN_LOT")
  - Explicit tracking of reference source ("LOT_RELATIVE", "GLOBAL_FALLBACK")
  - Strict canonical schema locking ["iddq", "ileak", "tpd"]
  - Reference store immutability and zero test-lot leakage
"""

from typing import Any, Dict, List, Optional, Union
import numpy as np
import pandas as pd

from .base import AnomalyDetector

CANONICAL_ANOMALY_FEATURES = ["iddq", "ileak", "tpd"]
MIN_REFERENCE_SIZE = 10
MIN_ROBUST_SCALE = 1e-9


class RobustMADDetector(AnomalyDetector):
    def __init__(
        self,
        warning_z: float = 3.0,
        reject_z: float = 6.0,
        min_reference_size: int = MIN_REFERENCE_SIZE,
        stats: Optional[Dict[str, Any]] = None,
    ):
        self.warning_z = float(warning_z)
        self.reject_z = float(reject_z)
        self.min_reference_size = int(min_reference_size)
        self.global_stats: Dict[str, Dict[str, Any]] = {}
        self.lot_stats: Dict[str, Dict[str, Any]] = {}
        self.feature_names: List[str] = list(CANONICAL_ANOMALY_FEATURES)

        if stats:
            self.global_stats = stats.get("global_stats", {})
            self.lot_stats = stats.get("lot_stats", {})
            self.feature_names = stats.get("features", self.feature_names)
            self.min_reference_size = stats.get("min_reference_size", self.min_reference_size)
            if "thresholds" in stats:
                self.warning_z = float(stats["thresholds"].get("warning_z", self.warning_z))
                self.reject_z = float(stats["thresholds"].get("reject_z", self.reject_z))

    def fit(self, X: pd.DataFrame, lot_ids: Optional[pd.Series] = None):
        """Fits global and lot-specific robust MAD parameters strictly from training partition."""
        if not isinstance(X, pd.DataFrame) or X.empty:
            raise ValueError("RobustMADDetector requires a non-empty DataFrame")
        if list(X.columns) != CANONICAL_ANOMALY_FEATURES:
            raise ValueError(
                f"Feature schema/order mismatch. Expected exact canonical features {CANONICAL_ANOMALY_FEATURES}, got {list(X.columns)}"
            )

        self.feature_names = list(CANONICAL_ANOMALY_FEATURES)
        self.global_stats = {}
        self.lot_stats = {}

        # 1. Global Reference Statistics
        for col in self.feature_names:
            vals = X[col].to_numpy(dtype=float)
            if len(vals) == 0:
                raise ValueError(f"Feature '{col}' contains no valid training samples")
            if not np.all(np.isfinite(vals)):
                raise ValueError(f"Feature '{col}' contains non-finite values (NaN or Inf)")

            median = float(np.median(vals))
            mad = float(np.median(np.abs(vals - median)))
            robust_sigma = float(1.4826 * mad)
            is_degenerate = bool(robust_sigma <= MIN_ROBUST_SCALE)
            quality_status = "DEGENERATE_SCALE" if is_degenerate else "VALID"

            self.global_stats[col] = {
                "median": median,
                "mad": mad,
                "sigma": robust_sigma if not is_degenerate else None,
                "is_degenerate": is_degenerate,
                "sample_count": len(vals),
                "quality_status": quality_status,
            }

        # 2. Lot-Specific Reference Statistics
        if lot_ids is not None and len(lot_ids) == len(X):
            df = X.copy()
            df["_lot_id"] = lot_ids.to_numpy()
            for lot_id, group in df.groupby("_lot_id"):
                lot_key = str(lot_id).strip()
                if not lot_key or lot_key.lower() in ("none", "nan", "null"):
                    continue

                lot_count = len(group)
                if lot_count < self.min_reference_size:
                    # Undersized lot: cannot establish stable lot-relative baseline
                    self.lot_stats[lot_key] = {
                        "sample_count": lot_count,
                        "reference_source": "GLOBAL_FALLBACK",
                        "reference_status": "INSUFFICIENT_REFERENCE",
                        "quality_status": "INSUFFICIENT_SAMPLE_SIZE",
                        "features": {},
                    }
                    continue

                # Evaluate lot reference quality
                lot_feature_stats = {}
                has_non_finite = False
                has_degenerate_scale = False

                for col in self.feature_names:
                    vals = group[col].to_numpy(dtype=float)
                    if not np.all(np.isfinite(vals)):
                        has_non_finite = True
                        break

                    median = float(np.median(vals))
                    mad = float(np.median(np.abs(vals - median)))
                    robust_sigma = float(1.4826 * mad)
                    is_degenerate = bool(robust_sigma <= MIN_ROBUST_SCALE)
                    if is_degenerate:
                        has_degenerate_scale = True

                    lot_feature_stats[col] = {
                        "median": median,
                        "mad": mad,
                        "sigma": robust_sigma if not is_degenerate else None,
                        "is_degenerate": is_degenerate,
                        "sample_count": len(vals),
                        "quality_status": "DEGENERATE_SCALE" if is_degenerate else "VALID",
                    }

                if has_non_finite:
                    self.lot_stats[lot_key] = {
                        "sample_count": lot_count,
                        "reference_source": "GLOBAL_FALLBACK",
                        "reference_status": "INSUFFICIENT_REFERENCE",
                        "quality_status": "CONTAINS_NON_FINITE",
                        "features": {},
                    }
                elif has_degenerate_scale:
                    self.lot_stats[lot_key] = {
                        "sample_count": lot_count,
                        "reference_source": "GLOBAL_FALLBACK",
                        "reference_status": "INSUFFICIENT_REFERENCE",
                        "quality_status": "DEGENERATE_SCALE",
                        "features": lot_feature_stats,
                    }
                else:
                    self.lot_stats[lot_key] = {
                        "sample_count": lot_count,
                        "reference_source": "LOT_RELATIVE",
                        "reference_status": "LOT_RELATIVE",
                        "quality_status": "VALID",
                        "features": lot_feature_stats,
                    }

    def score_single(
        self,
        features: Dict[str, float],
        lot_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Scores an individual component record with explainable feature-level Z-scores."""
        if not isinstance(features, dict):
            raise ValueError("Input features must be a dictionary")

        # Strict canonical feature schema and exact key insertion order enforcement
        feature_keys = list(features.keys())
        if feature_keys != CANONICAL_ANOMALY_FEATURES:
            raise ValueError(
                f"Feature schema/order mismatch. Expected exact canonical dictionary keys {CANONICAL_ANOMALY_FEATURES} in exact order, got {feature_keys}"
            )

        # Validate numeric finite values
        for col in CANONICAL_ANOMALY_FEATURES:
            val_raw = features[col]
            if val_raw is None or isinstance(val_raw, (str, bool)) or not np.isfinite(float(val_raw)):
                raise ValueError(f"Invalid non-numeric or non-finite value for feature '{col}': {val_raw}")

        # Determine reference context
        clean_lot = str(lot_id).strip() if lot_id is not None and str(lot_id).strip() != "" and str(lot_id).lower() not in ("nan", "none", "null") else None

        if clean_lot is None:
            ref_status = "UNKNOWN_LOT"
            ref_source = "GLOBAL_FALLBACK"
            ref_sample_count = 0
            stats = self.global_stats
        elif clean_lot not in self.lot_stats:
            ref_status = "UNKNOWN_LOT"
            ref_source = "GLOBAL_FALLBACK"
            ref_sample_count = 0
            stats = self.global_stats
        else:
            lot_entry = self.lot_stats[clean_lot]
            ref_sample_count = lot_entry.get("sample_count", 0)
            quality_status = lot_entry.get("quality_status", "VALID")
            ref_status = lot_entry.get("reference_status", "LOT_RELATIVE")
            ref_source = lot_entry.get("reference_source", "LOT_RELATIVE")

            if ref_source == "LOT_RELATIVE" and quality_status == "VALID" and "features" in lot_entry and lot_entry["features"]:
                stats = lot_entry["features"]
            else:
                stats = self.global_stats

        max_z = 0.0
        param_z: Dict[str, float] = {}
        contributing: List[str] = []

        for col in self.feature_names:
            val = float(features[col])
            col_stat = stats.get(col, self.global_stats.get(col, {}))
            if not col_stat:
                continue

            med = col_stat["median"]
            sig = col_stat.get("sigma")
            if col_stat.get("is_degenerate") or sig is None or sig <= MIN_ROBUST_SCALE:
                z = 0.0 if np.isclose(val, med, rtol=1e-7, atol=1e-9) else 999.0
            else:
                z = abs(val - med) / sig

            param_z[col] = float(round(z, 4)) if np.isfinite(z) else 999.0
            if z > max_z:
                max_z = float(z)
            if z > self.warning_z:
                contributing.append(col)

        status = "REJECT" if max_z > self.reject_z else ("MONITOR" if max_z > self.warning_z else "PASS")
        norm_score = float(round(min(1.0, max(0.0, max_z / 6.0)), 4)) if np.isfinite(max_z) else 1.0

        return {
            "detector": "robust_mad",
            "score": float(round(max_z, 4)) if np.isfinite(max_z) else 999.0,
            "normalized_score": norm_score,
            "threshold": float(self.reject_z),
            "status": status,
            "feature_scores": param_z,
            "parameter_z_scores": param_z,
            "contributing_features": contributing,
            "reference_status": ref_status,
            "reference_source": ref_source,
            "reference_sample_count": ref_sample_count,
            "lot_id": clean_lot,
            "reference_context": {
                "lot_id": clean_lot,
                "status": ref_status,
                "source": ref_source,
                "sample_count": ref_sample_count,
            },
            "calibration_status": "NOT_CALIBRATED",
            "validation_status": "PROJECT_DEFINED_SCREENING_CRITERION",
        }

    def score(
        self,
        X: pd.DataFrame,
        lot_ids: Optional[Union[pd.Series, List[str]]] = None,
    ) -> np.ndarray:
        """Vectorized scoring returning maximum Z-scores for batch evaluation."""
        if not isinstance(X, pd.DataFrame):
            raise ValueError("Input X must be a pandas DataFrame")
        if list(X.columns) != CANONICAL_ANOMALY_FEATURES:
            raise ValueError(
                f"Feature schema/order mismatch. Expected exact canonical features {CANONICAL_ANOMALY_FEATURES}, got {list(X.columns)}"
            )

        scores = np.zeros(len(X), dtype=float)
        lot_list = [None] * len(X)
        if lot_ids is not None:
            if isinstance(lot_ids, pd.Series):
                lot_list = lot_ids.tolist()
            else:
                lot_list = list(lot_ids)

        for i in range(len(X)):
            row_dict = X.iloc[i].to_dict()
            lot_id = lot_list[i] if i < len(lot_list) else None
            res = self.score_single(row_dict, lot_id)
            scores[i] = res["score"]

        return scores

    def predict(
        self,
        X: pd.DataFrame,
        lot_ids: Optional[Union[pd.Series, List[str]]] = None,
        threshold: Optional[float] = None,
    ) -> np.ndarray:
        th = float(threshold) if threshold is not None else self.reject_z
        scores = self.score(X, lot_ids)
        return (scores >= th).astype(int)

    def export_parameters(self) -> Dict[str, Any]:
        """Serializes robust MAD parameters into production artifact format."""
        return {
            "features": self.feature_names,
            "min_reference_size": self.min_reference_size,
            "global_stats": self.global_stats,
            "lot_stats": self.lot_stats,
            "thresholds": {
                "warning_z": self.warning_z,
                "reject_z": self.reject_z,
            },
        }
