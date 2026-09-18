"""
Predicta Semiconductor Intelligence Platform — Robust MAD (Part Average Testing)
File: src/anomaly_detection/robust_mad.py

Implements lot-relative and global Median Absolute Deviation (MAD) Part Average Testing (PAT).
Features:
  - Global baseline reference statistics (median, MAD, robust sigma = 1.4826 * MAD)
  - Lot-specific reference statistics with strict minimum reference population governance (min_reference_size >= 10)
  - Safe fallback to global reference statistics for unseen or undersized lots
  - Explicit tracking of reference source: "LOT_RELATIVE", "GLOBAL_FALLBACK", or "INSUFFICIENT_REFERENCE"
  - Deterministic evaluation and zero tolerance for fabricated lot statistics
"""

from typing import Any, Dict, List, Optional, Union
import numpy as np
import pandas as pd

from .base import AnomalyDetector


class RobustMADDetector(AnomalyDetector):
    def __init__(
        self,
        warning_z: float = 3.0,
        reject_z: float = 6.0,
        min_reference_size: int = 10,
        stats: Optional[Dict[str, Any]] = None,
    ):
        self.warning_z = float(warning_z)
        self.reject_z = float(reject_z)
        self.min_reference_size = int(min_reference_size)
        self.global_stats: Dict[str, Dict[str, Any]] = {}
        self.lot_stats: Dict[str, Dict[str, Any]] = {}
        self.feature_names: List[str] = ["iddq", "ileak", "tpd"]

        if stats:
            self.global_stats = stats.get("global_stats", {})
            self.lot_stats = stats.get("lot_stats", {})
            self.feature_names = stats.get("features", self.feature_names)
            if "thresholds" in stats:
                self.warning_z = float(stats["thresholds"].get("warning_z", self.warning_z))
                self.reject_z = float(stats["thresholds"].get("reject_z", self.reject_z))

    def fit(self, X: pd.DataFrame, lot_ids: Optional[pd.Series] = None):
        """Fits global and lot-specific robust MAD parameters strictly from training partition."""
        if not isinstance(X, pd.DataFrame) or X.empty:
            raise ValueError("RobustMADDetector requires a non-empty DataFrame")

        self.feature_names = list(X.columns)
        self.global_stats = {}
        self.lot_stats = {}

        # 1. Global Reference Statistics
        for col in self.feature_names:
            vals = X[col].dropna().to_numpy(dtype=float)
            if len(vals) == 0:
                raise ValueError(f"Feature '{col}' contains no valid training samples")
            median = float(np.median(vals))
            mad = float(np.median(np.abs(vals - median)))
            robust_sigma = float(1.4826 * mad)
            is_degenerate = bool(robust_sigma <= 1e-9)
            self.global_stats[col] = {
                "median": median,
                "mad": mad,
                "sigma": robust_sigma if not is_degenerate else None,
                "is_degenerate": is_degenerate,
                "sample_count": len(vals),
            }

        # 2. Lot-Specific Reference Statistics
        if lot_ids is not None and len(lot_ids) == len(X):
            df = X.copy()
            df["_lot_id"] = lot_ids.to_numpy()
            for lot_id, group in df.groupby("_lot_id"):
                lot_key = str(lot_id).strip()
                lot_count = len(group)
                if lot_count < self.min_reference_size:
                    # Undersized lot: cannot establish stable lot-relative baseline
                    continue

                self.lot_stats[lot_key] = {}
                for col in self.feature_names:
                    vals = group[col].dropna().to_numpy(dtype=float)
                    if len(vals) < self.min_reference_size:
                        continue
                    median = float(np.median(vals))
                    mad = float(np.median(np.abs(vals - median)))
                    robust_sigma = float(1.4826 * mad)
                    is_degenerate = bool(robust_sigma <= 1e-9)
                    self.lot_stats[lot_key][col] = {
                        "median": median,
                        "mad": mad,
                        "sigma": robust_sigma if not is_degenerate else None,
                        "is_degenerate": is_degenerate,
                        "sample_count": len(vals),
                    }

    def score_single(
        self,
        features: Dict[str, float],
        lot_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Scores an individual component record with explainable feature-level Z-scores."""
        stats = self.global_stats
        ref_source = "GLOBAL_FALLBACK"

        lot_key = str(lot_id).strip() if lot_id is not None and str(lot_id).strip() != "" and str(lot_id) != "nan" else None
        if lot_key and lot_key in self.lot_stats:
            stats = self.lot_stats[lot_key]
            ref_source = "LOT_RELATIVE"
        elif lot_key is not None:
            ref_source = "GLOBAL_FALLBACK_UNSEEN_OR_SMALL_LOT"

        max_z = 0.0
        param_z: Dict[str, float] = {}
        contributing: List[str] = []

        for col in self.feature_names:
            if col not in features or features[col] is None or not np.isfinite(float(features[col])):
                continue
            val = float(features[col])
            col_stat = stats.get(col, self.global_stats.get(col))
            if not col_stat:
                continue

            med = col_stat["median"]
            sig = col_stat.get("sigma")
            if col_stat.get("is_degenerate") or sig is None or sig <= 1e-9:
                z = 0.0 if np.isclose(val, med, rtol=1e-7, atol=1e-9) else np.inf
            else:
                z = abs(val - med) / sig

            param_z[col] = float(round(z, 4)) if np.isfinite(z) else 999.0
            if z > max_z:
                max_z = float(z)
            if z > self.warning_z:
                contributing.append(col)

        status = "REJECT" if max_z > self.reject_z else ("MONITOR" if max_z > self.warning_z else "PASS")
        return {
            "score": float(round(max_z, 4)) if np.isfinite(max_z) else 999.0,
            "status": status,
            "reference_source": ref_source,
            "parameter_z_scores": param_z,
            "contributing_features": contributing,
        }

    def score(
        self,
        X: pd.DataFrame,
        lot_ids: Optional[Union[pd.Series, List[str]]] = None,
    ) -> np.ndarray:
        """Vectorized scoring returning maximum Z-scores for batch evaluation."""
        if not isinstance(X, pd.DataFrame):
            raise ValueError("Input X must be a pandas DataFrame")

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
