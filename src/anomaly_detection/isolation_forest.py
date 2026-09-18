"""
Predicta Semiconductor Intelligence Platform — Isolation Forest Outlier Detector
File: src/anomaly_detection/isolation_forest.py

Implements deterministic multi-dimensional Isolation Forest anomaly detection:
  - Strict random_state=42 reproducibility
  - Feature-order locking: ["iddq", "ileak", "tpd"]
  - Preprocessing and tree fitting strictly on training partition
  - Complete JSON tree serialization (split indices, thresholds, leaf sample counts)
  - Native tree traversal evaluator for zero-dependency runtime evaluation
  - High-precision parity with scikit-learn IsolationForest scoring
"""

import math
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from .base import AnomalyDetector


CANONICAL_ANOMALY_FEATURES = ["iddq", "ileak", "tpd"]


def euler_harmonic_c(n: int) -> float:
    """Average path length of unsuccessful search in Binary Search Tree (BST)."""
    if n <= 1:
        return 0.0
    if n == 2:
        return 1.0
    # c(n) = 2 * (ln(n - 1) + 0.5772156649) - 2 * (n - 1) / n
    return float(2.0 * (math.log(n - 1) + 0.5772156649015329) - (2.0 * (n - 1) / float(n)))


class IsolationForestDetector(AnomalyDetector):
    def __init__(
        self,
        n_estimators: int = 100,
        contamination: float = 0.03,
        random_state: int = 42,
        warning_score: float = 0.55,
        reject_score: float = 0.65,
        forest_data: Optional[Dict[str, Any]] = None,
    ):
        self.n_estimators = int(n_estimators)
        self.contamination = float(contamination)
        self.random_state = int(random_state)
        self.warning_score = float(warning_score)
        self.reject_score = float(reject_score)
        self.feature_names: List[str] = list(CANONICAL_ANOMALY_FEATURES)
        self.trees: List[Dict[str, Any]] = []
        self.max_samples_fit: int = 256
        self.offset: float = -0.5
        self.c_factor: float = 1.0
        self.sklearn_model: Optional[IsolationForest] = None

        if forest_data:
            self.load_from_dict(forest_data)

    def load_from_dict(self, data: Dict[str, Any]):
        """Loads serialized forest artifact."""
        self.feature_names = data.get("feature_names", self.feature_names)
        self.n_estimators = int(data.get("n_estimators", len(data.get("trees", []))))
        self.contamination = float(data.get("contamination", self.contamination))
        self.random_state = int(data.get("random_state", 42))
        self.max_samples_fit = int(data.get("max_samples", 256))
        self.offset = float(data.get("offset", -0.5))
        self.c_factor = float(data.get("c_factor", euler_harmonic_c(self.max_samples_fit)))
        self.trees = data.get("trees", [])
        if "thresholds" in data:
            self.warning_score = float(data["thresholds"].get("warning_score", self.warning_score))
            self.reject_score = float(data["thresholds"].get("reject_score", self.reject_score))

    def fit(self, X: pd.DataFrame, lot_ids: Optional[pd.Series] = None):
        """Fits sklearn IsolationForest strictly on training partition."""
        if not isinstance(X, pd.DataFrame) or X.empty:
            raise ValueError("IsolationForest requires a non-empty DataFrame")
        if list(X.columns) != CANONICAL_ANOMALY_FEATURES:
            raise ValueError(
                f"Feature schema/order mismatch. Expected exact canonical features {CANONICAL_ANOMALY_FEATURES}, got {list(X.columns)}"
            )

        self.feature_names = list(CANONICAL_ANOMALY_FEATURES)
        X_mat = X[self.feature_names].to_numpy(dtype=np.float32)

        self.sklearn_model = IsolationForest(
            n_estimators=self.n_estimators,
            contamination=self.contamination,
            random_state=self.random_state,
            max_samples="auto",
            n_jobs=-1,
        )
        self.sklearn_model.fit(X_mat)

        self.max_samples_fit = int(self.sklearn_model.max_samples_)
        self.offset = float(self.sklearn_model.offset_)
        self.c_factor = euler_harmonic_c(self.max_samples_fit)

        # Serialize tree structures
        self.trees = []
        for estimator in self.sklearn_model.estimators_:
            tree = estimator.tree_
            self.trees.append({
                "node_count": int(tree.node_count),
                "children_left": tree.children_left.tolist(),
                "children_right": tree.children_right.tolist(),
                "feature": tree.feature.tolist(),
                "threshold": [round(float(t), 6) for t in tree.threshold.tolist()],
                "n_node_samples": tree.n_node_samples.tolist(),
            })

    def _score_tree(self, tree: Dict[str, Any], feat_vec: List[float]) -> Tuple[float, Optional[int]]:
        """Evaluates path length h(x) on a single decision tree."""
        left = tree["children_left"]
        right = tree["children_right"]
        feat_idx = tree["feature"]
        thresh = tree["threshold"]
        samples = tree["n_node_samples"]

        node = 0
        depth = 0
        split_feature_hit = None

        while node >= 0 and node < len(left):
            if left[node] == -1 and right[node] == -1:
                # Leaf reached
                n_samples = samples[node]
                h = float(depth) + (euler_harmonic_c(n_samples) if n_samples > 1 else 0.0)
                return h, split_feature_hit

            f_id = feat_idx[node]
            if split_feature_hit is None and f_id >= 0:
                split_feature_hit = f_id

            val = feat_vec[f_id]
            node = left[node] if val <= thresh[node] else right[node]
            depth += 1

        return float(depth), split_feature_hit

    def score_single(self, features: Dict[str, float]) -> Dict[str, Any]:
        """Calculates normalized anomaly score and feature attributions."""
        if not isinstance(features, dict):
            raise ValueError("Input features must be a dictionary")

        # Strict canonical feature schema and exact key insertion order enforcement
        feature_keys = list(features.keys())
        if feature_keys != self.feature_names:
            raise ValueError(
                f"Feature schema/order mismatch. Expected exact canonical dictionary keys {self.feature_names} in exact order, got {feature_keys}"
            )

        feat_vec = []
        for col in self.feature_names:
            val_raw = features[col]
            if val_raw is None or isinstance(val_raw, (str, bool)) or not np.isfinite(float(val_raw)):
                raise ValueError(f"Invalid non-numeric or non-finite value for feature '{col}': {val_raw}")
            feat_vec.append(float(val_raw))

        if not self.trees:
            raise ValueError("Isolation Forest model has not been fitted or loaded")

        total_path = 0.0
        feat_depth_sum = [0.0] * len(self.feature_names)
        feat_split_count = [0] * len(self.feature_names)

        for tree in self.trees:
            h, split_f = self._score_tree(tree, feat_vec)
            total_path += h
            if split_f is not None and 0 <= split_f < len(self.feature_names):
                feat_depth_sum[split_f] += h
                feat_split_count[split_f] += 1

        mean_path = total_path / float(len(self.trees))
        c_denom = self.c_factor if self.c_factor > 1e-6 else 1.0

        # Anomaly score s = 2 ^ (- mean_path / c)
        anomaly_score = float(2.0 ** (-mean_path / c_denom))

        # Normalized feature anomaly evidence
        feature_attributions: Dict[str, float] = {}
        for j, col in enumerate(self.feature_names):
            if feat_split_count[j] > 0:
                avg_f_depth = feat_depth_sum[j] / float(feat_split_count[j])
                # Shorter depth = higher anomaly contribution
                f_score = float(2.0 ** (-avg_f_depth / c_denom))
                feature_attributions[col] = round(f_score, 4)
            else:
                feature_attributions[col] = round(anomaly_score, 4)

        status = "REJECT" if anomaly_score > self.reject_score else ("MONITOR" if anomaly_score > self.warning_score else "PASS")

        return {
            "score": round(anomaly_score, 4),
            "status": status,
            "mean_path_length": round(mean_path, 4),
            "anomaly_evidence": feature_attributions,
        }

    def score(
        self,
        X: pd.DataFrame,
        lot_ids: Optional[Union[pd.Series, List[str]]] = None,
    ) -> np.ndarray:
        """Batch scoring for evaluation datasets."""
        if not isinstance(X, pd.DataFrame):
            raise ValueError("Input X must be a pandas DataFrame")
        if list(X.columns) != CANONICAL_ANOMALY_FEATURES:
            raise ValueError(
                f"Feature schema/order mismatch. Expected exact canonical features {CANONICAL_ANOMALY_FEATURES}, got {list(X.columns)}"
            )

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
        """Serializes Isolation Forest parameters and tree structures."""
        return {
            "algorithm": "IsolationForest",
            "feature_names": self.feature_names,
            "n_estimators": len(self.trees),
            "contamination": self.contamination,
            "random_state": self.random_state,
            "max_samples": self.max_samples_fit,
            "offset": self.offset,
            "c_factor": round(self.c_factor, 6),
            "thresholds": {
                "warning_score": self.warning_score,
                "reject_score": self.reject_score,
            },
            "trees": self.trees,
        }
