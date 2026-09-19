"""
Predicta Semiconductor Intelligence Platform — Authoritative Stage 5 Prognostics Foundation
File: src/prognostics/trajectory.py

Implements:
1. Reusable Prognostic Data Builder with explicit separation:
   - early_features (0h and 24h observable)
   - future_ground_truth (168h retrospective evaluation only)
   - metadata (identifiers, lots, wafers)
2. Strict Temporal Leakage Protection:
   - Rejection of 168h/future telemetry from early prediction feature sets
   - Rejection of target/label leakage
   - Strict schema order validation and non-numeric/NaN/Inf protection
3. Authoritative Trajectory Semantics:
   - PASS_24H_PASS_168H (Healthy through 168h)
   - PASS_24H_FAIL_168H (True Latent Failure)
   - FAIL_24H_FAIL_168H (Early Failure visible at 24h)
   - FAIL_24H_PASS_168H (Early 24h anomaly, recovered by 168h)
   - INSUFFICIENT_HISTORY (Missing 24h or 168h checkpoint)
4. Lot-Held-Out Disjoint Split Management
5. Standardized Prognostic Evaluation Metrics (Recall, FNR, Precision, F1, F2, PR-AUC, ROC-AUC)
6. Evaluation-only Baseline Models (Persistence & ML Early-Feature Baseline)
"""

import os
import json
import hashlib
from enum import Enum
from typing import Dict, Any, List, Optional, Tuple, Union

import numpy as np
import pandas as pd


class FeatureProvenance(str, Enum):
    """Authoritative classification of feature provenance."""
    EARLY_OBSERVABLE = "EARLY_OBSERVABLE"
    FUTURE_GROUND_TRUTH = "FUTURE_GROUND_TRUTH"
    IDENTIFIER = "IDENTIFIER"
    METADATA = "METADATA"
    TARGET = "TARGET"


class TrajectoryState(str, Enum):
    """Authoritative semantic trajectory states."""
    PASS_24H_PASS_168H = "PASS_24H_PASS_168H"
    PASS_24H_FAIL_168H = "PASS_24H_FAIL_168H"
    FAIL_24H_FAIL_168H = "FAIL_24H_FAIL_168H"
    FAIL_24H_PASS_168H = "FAIL_24H_PASS_168H"
    INSUFFICIENT_HISTORY = "INSUFFICIENT_HISTORY"


CANONICAL_EARLY_FEATURES = [
    "iddq_0h",
    "ileak_0h",
    "tpd_0h",
    "iddq_24h",
    "ileak_24h",
    "tpd_24h",
    "iddq_drift_24h",
    "ileak_drift_24h",
    "tpd_drift_24h"
]

CANONICAL_FUTURE_FIELDS = [
    "iddq_168h_ground_truth",
    "ileak_168h_ground_truth",
    "tpd_168h_ground_truth",
    "state_168h",
    "latent_168h_failure"
]

FORBIDDEN_LEAKAGE_TOKENS = [
    "168",
    "96",
    "48",
    "future",
    "ground_truth",
    "post_burn_in",
    "state_168",
    "result_168",
    "target"
]

DEFAULT_SPEC_LIMITS = {
    "iddq": 5000.0,   # µA max
    "ileak": 500.0,   # µA max
    "tpd": 250.0      # ns max
}


def compute_sha256(filepath: str) -> str:
    """Compute cryptographic SHA-256 hash of a file."""
    if not os.path.exists(filepath):
        return "FILE_NOT_FOUND"
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def validate_early_feature_input(
    features: Union[Dict[str, Any], List[float], np.ndarray]
) -> np.ndarray:
    """
    Validates that an early prognostic feature input contains ONLY authorized 0h/24h features
    in canonical order with finite numeric values and zero temporal leakage.

    Returns:
        np.ndarray of shape (9,)
    """
    if isinstance(features, dict):
        keys = list(features.keys())
        # 1. Leakage Token Check on Dict Keys
        for k in keys:
            k_lower = str(k).lower()
            for token in FORBIDDEN_LEAKAGE_TOKENS:
                if token in k_lower:
                    raise ValueError(f"TEMPORAL_LEAKAGE_DETECTED: Forbidden token '{token}' in key '{k}'")

        # 2. Schema check: missing keys
        missing = [f for f in CANONICAL_EARLY_FEATURES if f not in features]
        if missing:
            raise ValueError(f"MISSING_REQUIRED_FEATURE: Missing early features: {missing}")

        # 3. Schema check: extra keys
        extra = [k for k in keys if k not in CANONICAL_EARLY_FEATURES]
        if extra:
            raise ValueError(f"EXTRA_FEATURE_DETECTED: Unauthorized extra keys: {extra}")

        # 4. Strict Order Check
        if keys != CANONICAL_EARLY_FEATURES:
            raise ValueError(
                f"SCHEMA_ORDER_MISMATCH: Expected exact order {CANONICAL_EARLY_FEATURES}, got {keys}"
            )

        # 5. Extract values and validate numeric integrity
        values = []
        for f in CANONICAL_EARLY_FEATURES:
            val = features[f]
            if val is None or isinstance(val, (bool, str)):
                raise ValueError(f"INVALID_NUMERIC_VALUE: Feature '{f}' has non-numeric value: {val}")
            try:
                f_val = float(val)
            except (ValueError, TypeError) as exc:
                raise ValueError(f"INVALID_NUMERIC_VALUE: Feature '{f}' cannot be converted to float: {val}") from exc
            if not np.isfinite(f_val):
                raise ValueError(f"NON_FINITE_VALUE: Feature '{f}' is non-finite (NaN or Inf): {f_val}")
            values.append(f_val)
        return np.array(values, dtype=np.float64)

    elif isinstance(features, (list, tuple, np.ndarray)):
        arr = np.asarray(features, dtype=np.float64)
        if arr.shape != (9,):
            raise ValueError(f"INVALID_DIMENSIONALITY: Expected 9 early features, got {arr.shape}")
        if not np.all(np.isfinite(arr)):
            raise ValueError("NON_FINITE_VALUE: Array contains non-finite values (NaN or Inf)")
        return arr
    else:
        raise ValueError(f"UNSUPPORTED_INPUT_TYPE: Expected dict or array, got {type(features)}")


def evaluate_acceptance_at_hour(
    telemetry: Optional[Dict[str, Any]],
    hour: int,
    spec_limits: Optional[Dict[str, float]] = None
) -> Tuple[bool, str]:
    """
    Evaluates whether a component telemetry measurement at a given hour is acceptable (PASS) or unacceptable (FAIL).
    """
    if telemetry is None or not isinstance(telemetry, dict):
        return False, "MISSING_TELEMETRY"

    # 1. Ground truth health state check if available
    health = telemetry.get("health_state")
    if health is not None:
        health_str = str(health).upper()
        if health_str == "FAILED":
            return False, "HEALTH_STATE_FAILED"
        if health_str == "LATENT_DEFECT":
            tpd_val = float(telemetry.get("tpd", 0.0) or 0.0)
            if hour >= 96 or (hour >= 24 and tpd_val > 230.0):
                return False, "LATENT_DEFECT_MANIFESTED"
            if hour == 24 and tpd_val <= 230.0:
                return True, "ACCEPTABLE_24H_LATENT_CANDIDATE"

    # 2. Parametric threshold checking
    limits = spec_limits or DEFAULT_SPEC_LIMITS
    reasons = []

    for param, default_lim in [("tpd", 250.0), ("iddq", 5000.0), ("ileak", 500.0)]:
        if param in telemetry and telemetry[param] is not None:
            try:
                val = float(telemetry[param])
                if not np.isfinite(val):
                    return False, f"NON_FINITE_{param.upper()}"
                limit = limits.get(param, default_lim)
                if val > limit:
                    reasons.append(f"{param.upper()}_EXCEEDED({val:.2f}>{limit:.1f})")
            except (ValueError, TypeError):
                return False, f"INVALID_NUMERIC_{param.upper()}"

    if reasons:
        return False, "; ".join(reasons)

    return True, "ACCEPTABLE_WITHIN_LIMITS"


def evaluate_trajectory_state(
    telemetry_24h: Optional[Dict[str, Any]],
    telemetry_168h: Optional[Dict[str, Any]],
    spec_limits: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Evaluates the authoritative 168h prognostic target and semantic trajectory state.
    """
    if telemetry_24h is None or not isinstance(telemetry_24h, dict):
        return {
            "state_24h": "INSUFFICIENT_HISTORY",
            "state_168h": "INSUFFICIENT_HISTORY" if telemetry_168h is None else ("PASS" if evaluate_acceptance_at_hour(telemetry_168h, 168, spec_limits)[0] else "FAIL"),
            "latent_168h_failure": None,
            "trajectory_state": TrajectoryState.INSUFFICIENT_HISTORY.value,
            "reason": "Missing 24h screening telemetry"
        }

    if telemetry_168h is None or not isinstance(telemetry_168h, dict):
        is_pass_24, reason_24 = evaluate_acceptance_at_hour(telemetry_24h, 24, spec_limits)
        return {
            "state_24h": "PASS" if is_pass_24 else "FAIL",
            "state_168h": "INSUFFICIENT_HISTORY",
            "latent_168h_failure": None,
            "trajectory_state": TrajectoryState.INSUFFICIENT_HISTORY.value,
            "reason": "Missing 168h longitudinal telemetry; ground truth unknown"
        }

    # Verify numerical finiteness
    for k in ["iddq", "ileak", "tpd"]:
        v24 = telemetry_24h.get(k)
        v168 = telemetry_168h.get(k)
        if v24 is not None:
            try:
                if not np.isfinite(float(v24)):
                    return {
                        "state_24h": "INSUFFICIENT_HISTORY",
                        "state_168h": "INSUFFICIENT_HISTORY",
                        "latent_168h_failure": None,
                        "trajectory_state": TrajectoryState.INSUFFICIENT_HISTORY.value,
                        "reason": f"Non-finite 24h reading for {k}: {v24}"
                    }
            except (ValueError, TypeError):
                return {
                    "state_24h": "INSUFFICIENT_HISTORY",
                    "state_168h": "INSUFFICIENT_HISTORY",
                    "latent_168h_failure": None,
                    "trajectory_state": TrajectoryState.INSUFFICIENT_HISTORY.value,
                    "reason": f"Invalid numeric 24h reading for {k}: {v24}"
                }

        if v168 is not None:
            try:
                if not np.isfinite(float(v168)):
                    return {
                        "state_24h": "PASS",
                        "state_168h": "INSUFFICIENT_HISTORY",
                        "latent_168h_failure": None,
                        "trajectory_state": TrajectoryState.INSUFFICIENT_HISTORY.value,
                        "reason": f"Non-finite 168h reading for {k}: {v168}"
                    }
            except (ValueError, TypeError):
                return {
                    "state_24h": "PASS",
                    "state_168h": "INSUFFICIENT_HISTORY",
                    "latent_168h_failure": None,
                    "trajectory_state": TrajectoryState.INSUFFICIENT_HISTORY.value,
                    "reason": f"Invalid numeric 168h reading for {k}: {v168}"
                }

    is_pass_24, reason_24 = evaluate_acceptance_at_hour(telemetry_24h, 24, spec_limits)
    is_pass_168, reason_168 = evaluate_acceptance_at_hour(telemetry_168h, 168, spec_limits)

    state_24 = "PASS" if is_pass_24 else "FAIL"
    state_168 = "PASS" if is_pass_168 else "FAIL"

    if is_pass_24 and not is_pass_168:
        # TRUE LATENT FAILURE
        return {
            "state_24h": state_24,
            "state_168h": state_168,
            "latent_168h_failure": True,
            "trajectory_state": TrajectoryState.PASS_24H_FAIL_168H.value,
            "reason": f"Latent wear-out: Passed at 24h ({reason_24}), failed by 168h ({reason_168})"
        }
    elif is_pass_24 and is_pass_168:
        return {
            "state_24h": state_24,
            "state_168h": state_168,
            "latent_168h_failure": False,
            "trajectory_state": TrajectoryState.PASS_24H_PASS_168H.value,
            "reason": "Healthy component: Passed both 24h and 168h screening"
        }
    elif not is_pass_24 and not is_pass_168:
        return {
            "state_24h": state_24,
            "state_168h": state_168,
            "latent_168h_failure": False,
            "trajectory_state": TrajectoryState.FAIL_24H_FAIL_168H.value,
            "reason": f"Early failure: Failed at 24h ({reason_24}); already quarantined before burn-in"
        }
    else:
        return {
            "state_24h": state_24,
            "state_168h": state_168,
            "latent_168h_failure": False,
            "trajectory_state": TrajectoryState.FAIL_24H_PASS_168H.value,
            "reason": f"Transient 24h anomaly ({reason_24}) followed by acceptable 168h reading"
        }


def extract_prognostic_record(
    row_0h: Optional[Dict[str, Any]],
    row_24h: Optional[Dict[str, Any]],
    row_168h: Optional[Dict[str, Any]],
    component_id: str,
    spec_limits: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Constructs an authoritative prognostic component record with strict structural separation:
    - metadata
    - early_features
    - future_ground_truth
    - state_24h
    """
    eval_res = evaluate_trajectory_state(row_24h, row_168h, spec_limits)

    lot_id = None
    wafer_id = None
    manufacturer = None
    pkg = None
    comp_family = None
    comp_type = None

    for r in [row_24h, row_0h, row_168h]:
        if r and isinstance(r, dict):
            lot_id = lot_id or r.get("lot_id")
            wafer_id = wafer_id or r.get("wafer_id")
            manufacturer = manufacturer or r.get("manufacturer")
            pkg = pkg or r.get("package")
            comp_family = comp_family or r.get("component_family")
            comp_type = comp_type or r.get("component_type")

    # Construct early features strictly from 0h and 24h
    has_early = bool(row_0h and row_24h and isinstance(row_0h, dict) and isinstance(row_24h, dict))

    if has_early:
        try:
            iddq_0 = float(row_0h["iddq"])
            ileak_0 = float(row_0h["ileak"])
            tpd_0 = float(row_0h["tpd"])
            iddq_24 = float(row_24h["iddq"])
            ileak_24 = float(row_24h["ileak"])
            tpd_24 = float(row_24h["tpd"])

            early_features = {
                "iddq_0h": iddq_0,
                "ileak_0h": ileak_0,
                "tpd_0h": tpd_0,
                "iddq_24h": iddq_24,
                "ileak_24h": ileak_24,
                "tpd_24h": tpd_24,
                "iddq_drift_24h": iddq_24 - iddq_0,
                "ileak_drift_24h": ileak_24 - ileak_0,
                "tpd_drift_24h": tpd_24 - tpd_0
            }
        except (KeyError, ValueError, TypeError):
            early_features = {f: np.nan for f in CANONICAL_EARLY_FEATURES}
    else:
        early_features = {f: np.nan for f in CANONICAL_EARLY_FEATURES}

    # Construct future ground truth strictly for retrospective evaluation
    has_168h = bool(row_168h and isinstance(row_168h, dict))
    if has_168h:
        try:
            future_gt = {
                "iddq_168h_ground_truth": float(row_168h["iddq"]),
                "ileak_168h_ground_truth": float(row_168h["ileak"]),
                "tpd_168h_ground_truth": float(row_168h["tpd"]),
                "state_168h": eval_res["state_168h"],
                "latent_168h_failure": eval_res["latent_168h_failure"],
                "trajectory_state": eval_res["trajectory_state"],
                "evaluation_reason": eval_res["reason"]
            }
        except (KeyError, ValueError, TypeError):
            future_gt = {
                "iddq_168h_ground_truth": np.nan,
                "ileak_168h_ground_truth": np.nan,
                "tpd_168h_ground_truth": np.nan,
                "state_168h": eval_res["state_168h"],
                "latent_168h_failure": eval_res["latent_168h_failure"],
                "trajectory_state": eval_res["trajectory_state"],
                "evaluation_reason": eval_res["reason"]
            }
    else:
        future_gt = {
            "iddq_168h_ground_truth": np.nan,
            "ileak_168h_ground_truth": np.nan,
            "tpd_168h_ground_truth": np.nan,
            "state_168h": eval_res["state_168h"],
            "latent_168h_failure": eval_res["latent_168h_failure"],
            "trajectory_state": eval_res["trajectory_state"],
            "evaluation_reason": eval_res["reason"]
        }

    return {
        "metadata": {
            "component_id": component_id,
            "lot_id": lot_id,
            "wafer_id": wafer_id,
            "manufacturer": manufacturer,
            "package": pkg,
            "component_family": comp_family,
            "component_type": comp_type,
            "has_complete_history": bool(row_0h and row_24h and row_168h)
        },
        "early_features": early_features,
        "future_ground_truth": future_gt,
        "state_24h": eval_res["state_24h"]
    }


def build_prognostic_dataset(
    df_or_path: Union[str, pd.DataFrame],
    spec_limits: Optional[Dict[str, float]] = None
) -> List[Dict[str, Any]]:
    """
    Builds the authoritative list of prognostic component records from raw time-series CSV.
    """
    if isinstance(df_or_path, str):
        df = pd.read_csv(df_or_path)
    else:
        df = df_or_path.copy()

    if "burn_in_hour" not in df.columns or "component_id" not in df.columns:
        raise ValueError("Dataset must contain 'component_id' and 'burn_in_hour' columns.")

    h0 = df[df["burn_in_hour"] == 0].set_index("component_id")
    h24 = df[df["burn_in_hour"] == 24].set_index("component_id")
    h168 = df[df["burn_in_hour"] == 168].set_index("component_id")

    all_comps = sorted(list(set(df["component_id"].unique())))
    records = []

    for c_id in all_comps:
        row_0 = h0.loc[c_id].to_dict() if c_id in h0.index else None
        row_24 = h24.loc[c_id].to_dict() if c_id in h24.index else None
        row_168 = h168.loc[c_id].to_dict() if c_id in h168.index else None

        rec = extract_prognostic_record(row_0, row_24, row_168, c_id, spec_limits)
        records.append(rec)

    return records


def split_prognostic_dataset(
    records: List[Dict[str, Any]],
    split_manifest_path: str
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Splits prognostic records strictly according to authoritative split manifest.
    Guarantees zero lot and zero component contamination across partitions.
    """
    if not os.path.exists(split_manifest_path):
        raise FileNotFoundError(f"Split manifest not found at {split_manifest_path}")

    with open(split_manifest_path, "r", encoding="utf-8") as f:
        split_manifest = json.load(f)

    train_lots = set(split_manifest["lots"]["train"])
    val_lots = set(split_manifest["lots"]["validation"])
    test_lots = set(split_manifest["lots"]["test"])

    train_recs = []
    val_recs = []
    test_recs = []

    for r in records:
        lot = r["metadata"]["lot_id"]
        if lot in train_lots:
            train_recs.append(r)
        elif lot in val_lots:
            val_recs.append(r)
        elif lot in test_lots:
            test_recs.append(r)

    # Verify disjointness
    train_comps = {r["metadata"]["component_id"] for r in train_recs}
    val_comps = {r["metadata"]["component_id"] for r in val_recs}
    test_comps = {r["metadata"]["component_id"] for r in test_recs}

    assert len(train_comps.intersection(val_comps)) == 0, "LEAKAGE: Overlapping components between train and validation!"
    assert len(train_comps.intersection(test_comps)) == 0, "LEAKAGE: Overlapping components between train and test!"
    assert len(val_comps.intersection(test_comps)) == 0, "LEAKAGE: Overlapping components between validation and test!"

    return train_recs, val_recs, test_recs


def calculate_prognostic_metrics(
    y_true: np.ndarray,
    y_pred_prob: np.ndarray,
    threshold: float = 0.5
) -> Dict[str, Any]:
    """
    Calculates standardized future-failure prognostic metrics:
    - support (total, positive, negative)
    - recall (sensitivity on true latent failures)
    - false negative rate (FNR = 1 - recall)
    - precision
    - F1 score
    - F2 score (beta=2, prioritizing recall)
    - specificity
    - PR-AUC
    - ROC-AUC
    - confusion matrix (TN, FP, FN, TP)
    """
    y_true = np.asarray(y_true, dtype=int)
    y_pred_prob = np.asarray(y_pred_prob, dtype=float)

    n_total = len(y_true)
    n_pos = int(np.sum(y_true == 1))
    n_neg = int(np.sum(y_true == 0))

    if n_total == 0:
        return {
            "support": {"total": 0, "positives": 0, "negatives": 0},
            "latent_recall": 0.0,
            "latent_false_negative_rate": 0.0,
            "latent_precision": 0.0,
            "latent_f1_score": 0.0,
            "latent_f2_score": 0.0,
            "specificity": 0.0,
            "pr_auc": 0.0,
            "roc_auc": 0.0,
            "confusion_matrix": {"tn": 0, "fp": 0, "fn": 0, "tp": 0},
            "operating_threshold": float(threshold)
        }

    y_pred_bin = (y_pred_prob >= threshold).astype(int)

    tp = int(np.sum((y_true == 1) & (y_pred_bin == 1)))
    fn = int(np.sum((y_true == 1) & (y_pred_bin == 0)))
    fp = int(np.sum((y_true == 0) & (y_pred_bin == 1)))
    tn = int(np.sum((y_true == 0) & (y_pred_bin == 0)))

    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    fnr = fn / (tp + fn) if (tp + fn) > 0 else 0.0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0.0

    f1 = (2.0 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    f2 = (5.0 * precision * recall) / (4.0 * precision + recall) if (4.0 * precision + recall) > 0 else 0.0

    pr_auc = 0.0
    roc_auc = 0.5

    if n_pos > 0 and n_neg > 0:
        try:
            from sklearn.metrics import average_precision_score, roc_auc_score
            pr_auc = float(average_precision_score(y_true, y_pred_prob))
            roc_auc = float(roc_auc_score(y_true, y_pred_prob))
        except Exception:
            pass
    elif n_pos > 0:
        pr_auc = 1.0 if tp > 0 else 0.0

    return {
        "support": {
            "total": n_total,
            "positives": n_pos,
            "negatives": n_neg
        },
        "latent_recall": float(round(recall, 6)),
        "latent_false_negative_rate": float(round(fnr, 6)),
        "latent_precision": float(round(precision, 6)),
        "latent_f1_score": float(round(f1, 6)),
        "latent_f2_score": float(round(f2, 6)),
        "specificity": float(round(specificity, 6)),
        "pr_auc": float(round(pr_auc, 6)),
        "roc_auc": float(round(roc_auc, 6)),
        "confusion_matrix": {
            "tn": tn,
            "fp": fp,
            "fn": fn,
            "tp": tp
        },
        "operating_threshold": float(threshold)
    }


class PersistenceBaseline:
    """
    Baseline model that assumes no degradation (predicts 0.0 risk for all components).
    """
    def __init__(self):
        self.name = "Persistence_NoChange_Baseline"
        self.algorithm = "PERSISTENCE_CONSTANT_ZERO"
        self.status = "BENCHMARK_ONLY"

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return np.zeros(len(X), dtype=np.float64)


class MLPrognosticBaseline:
    """
    Legitimate machine-learning baseline trained STRICTLY on 0h/24h early features.
    Provides validation-only threshold tuning.
    """
    def __init__(self, random_state: int = 42):
        self.name = "EarlyFeature_GradientBoosting_Baseline"
        self.algorithm = "HIST_GRADIENT_BOOSTING_CLASSIFIER"
        self.random_state = random_state
        self.model = None
        self.optimal_threshold = 0.50
        self.status = "BENCHMARK_ONLY"

    def fit(self, X_train: np.ndarray, y_train: np.ndarray):
        from sklearn.ensemble import HistGradientBoostingClassifier
        self.model = HistGradientBoostingClassifier(
            max_iter=100,
            learning_rate=0.05,
            max_leaf_nodes=15,
            random_state=self.random_state,
            class_weight="balanced"
        )
        self.model.fit(X_train, y_train)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if self.model is None:
            raise RuntimeError("Model has not been trained yet.")
        # Prob of positive class (latent_168h_failure = 1)
        probs = self.model.predict_proba(X)
        if probs.shape[1] == 2:
            return probs[:, 1]
        return np.zeros(len(X))

    def tune_threshold_on_validation(
        self,
        X_val: np.ndarray,
        y_val: np.ndarray,
        metric: str = "f2"
    ) -> float:
        """
        Finds optimal operating threshold on VALIDATION set ONLY.
        """
        probs = self.predict_proba(X_val)
        threshold_candidates = np.linspace(0.10, 0.90, 81)
        best_score = -1.0
        best_th = 0.50

        for th in threshold_candidates:
            metrics = calculate_prognostic_metrics(y_val, probs, threshold=th)
            score = metrics.get(f"latent_{metric}_score", metrics.get(metric, 0.0))
            if score > best_score:
                best_score = score
                best_th = th

        self.optimal_threshold = float(round(best_th, 4))
        return self.optimal_threshold
