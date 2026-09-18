"""
Predicta Semiconductor Intelligence Platform — Standardized Evaluation Metrics
File: src/evaluation/metrics.py

Provides robust, division-by-zero-safe calculation of:
- TP, TN, FP, FN
- Precision, Recall (Sensitivity), False Negative Rate (FNR = 1 - Recall), Specificity, FPR
- F1-Score, F2-Score (Safety-weighted towards recall)
- PR-AUC, ROC-AUC
- Support breakdown (Positives, Negatives, Total)
- Structured Confusion Matrix
"""

from typing import Dict, Any, List, Optional, Union
import numpy as np


def compute_binary_confusion_matrix(
    y_true: Union[List[int], np.ndarray, List[bool]],
    y_pred: Union[List[int], np.ndarray, List[bool]]
) -> Dict[str, int]:
    """
    Computes integer TP, TN, FP, FN with strict input verification.
    """
    y_t = np.asarray(y_true).astype(int)
    y_p = np.asarray(y_pred).astype(int)

    if len(y_t) != len(y_p):
        raise ValueError(f"Length mismatch: len(y_true)={len(y_t)} vs len(y_pred)={len(y_p)}")

    tp = int(np.sum((y_t == 1) & (y_p == 1)))
    tn = int(np.sum((y_t == 0) & (y_p == 0)))
    fp = int(np.sum((y_t == 0) & (y_p == 1)))
    fn = int(np.sum((y_t == 1) & (y_p == 0)))

    return {
        "tp": tp,
        "tn": tn,
        "fp": fp,
        "fn": fn
    }


def compute_pr_auc_trapz(
    y_true: np.ndarray,
    y_prob: np.ndarray
) -> float:
    """
    Computes PR-AUC using trapezoidal integration across probability thresholds.
    Safe against empty positive classes.
    """
    if np.sum(y_true == 1) == 0:
        return 0.0

    thresholds = np.linspace(0.0, 1.0, 101)
    precisions = []
    recalls = []

    for t in thresholds:
        pred = (y_prob >= t).astype(int)
        tp = np.sum((y_true == 1) & (pred == 1))
        fp = np.sum((y_true == 0) & (pred == 1))
        fn = np.sum((y_true == 1) & (pred == 0))

        prec = float(tp / (tp + fp)) if (tp + fp) > 0 else 1.0
        rec = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0

        precisions.append(prec)
        recalls.append(rec)

    # Sort by recall ascending for trapezoid integration
    points = sorted(zip(recalls, precisions), key=lambda x: x[0])
    sorted_recalls = [p[0] for p in points]
    sorted_precisions = [p[1] for p in points]

    auc = 0.0
    for i in range(1, len(points)):
        dx = sorted_recalls[i] - sorted_recalls[i - 1]
        avg_y = (sorted_precisions[i] + sorted_precisions[i - 1]) / 2.0
        auc += dx * avg_y

    return float(np.clip(auc, 0.0, 1.0))


def compute_roc_auc_trapz(
    y_true: np.ndarray,
    y_prob: np.ndarray
) -> float:
    """
    Computes ROC-AUC using trapezoidal integration across probability thresholds.
    Safe against empty positive or negative classes.
    """
    pos_count = np.sum(y_true == 1)
    neg_count = np.sum(y_true == 0)

    if pos_count == 0 or neg_count == 0:
        return 0.5

    thresholds = np.linspace(0.0, 1.0, 101)
    tprs = []
    fprs = []

    for t in thresholds:
        pred = (y_prob >= t).astype(int)
        tp = np.sum((y_true == 1) & (pred == 1))
        fp = np.sum((y_true == 0) & (pred == 1))
        fn = np.sum((y_true == 1) & (pred == 0))
        tn = np.sum((y_true == 0) & (pred == 0))

        tpr = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
        fpr = float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0

        tprs.append(tpr)
        fprs.append(fpr)

    # Sort by FPR ascending
    points = sorted(zip(fprs, tprs), key=lambda x: x[0])
    sorted_fprs = [p[0] for p in points]
    sorted_tprs = [p[1] for p in points]

    auc = 0.0
    for i in range(1, len(points)):
        dx = sorted_fprs[i] - sorted_fprs[i - 1]
        avg_y = (sorted_tprs[i] + sorted_tprs[i - 1]) / 2.0
        auc += dx * avg_y

    return float(np.clip(auc, 0.0, 1.0))


def calculate_standardized_metrics(
    y_true: Union[List[int], np.ndarray, List[bool]],
    y_pred: Union[List[int], np.ndarray, List[bool]],
    y_prob: Optional[Union[List[float], np.ndarray]] = None,
    threshold: Optional[float] = None,
    split_name: str = "held_out_test"
) -> Dict[str, Any]:
    """
    Calculates the complete standardized suite of screening metrics.

    Prominently emphasizes:
    - recall (sensitivity)
    - false_negative_rate (fnr = 1 - recall)
    - f2_score (recall-weighted F-beta)
    """
    cm = compute_binary_confusion_matrix(y_true, y_pred)
    tp, tn, fp, fn = cm["tp"], cm["tn"], cm["fp"], cm["fn"]

    positives = tp + fn
    negatives = tn + fp
    total = positives + negatives

    # Metric calculations with safe zero-division fallbacks
    recall = float(tp / positives) if positives > 0 else 0.0
    fnr = float(fn / positives) if positives > 0 else 0.0
    precision = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
    specificity = float(tn / negatives) if negatives > 0 else 0.0
    fpr = float(fp / negatives) if negatives > 0 else 0.0

    # F1 Score
    if (precision + recall) > 0:
        f1 = float(2.0 * (precision * recall) / (precision + recall))
    else:
        f1 = 0.0

    # F2 Score (beta = 2, emphasizing recall 4x more than precision)
    beta = 2.0
    beta_sq = beta ** 2
    if ((beta_sq * precision) + recall) > 0:
        f2 = float((1.0 + beta_sq) * (precision * recall) / ((beta_sq * precision) + recall))
    else:
        f2 = 0.0

    # Accuracy & Balanced Accuracy
    accuracy = float((tp + tn) / total) if total > 0 else 0.0
    balanced_accuracy = float((recall + specificity) / 2.0)

    # Curve AUCs if probabilities provided
    pr_auc = None
    roc_auc = None
    if y_prob is not None:
        y_p_arr = np.asarray(y_prob).astype(float)
        y_t_arr = np.asarray(y_true).astype(int)
        pr_auc = round(compute_pr_auc_trapz(y_t_arr, y_p_arr), 4)
        roc_auc = round(compute_roc_auc_trapz(y_t_arr, y_p_arr), 4)

    return {
        "evaluation_split": split_name,
        "operating_threshold": threshold,
        "safety_primary_metrics": {
            "latent_recall": round(recall, 4),
            "latent_false_negative_rate": round(fnr, 4),
            "latent_f2_score": round(f2, 4),
            "safety_verdict": "ZERO_ESCAPE_ACHIEVED" if fn == 0 and tp > 0 else ("ESCAPES_DETECTED" if fn > 0 else "NO_POSITIVES")
        },
        "standard_classification_metrics": {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(f1, 4),
            "f2_score": round(f2, 4),
            "specificity": round(specificity, 4),
            "false_positive_rate": round(fpr, 4),
            "accuracy": round(accuracy, 4),
            "balanced_accuracy": round(balanced_accuracy, 4),
            "pr_auc": pr_auc,
            "roc_auc": roc_auc
        },
        "confusion_matrix": {
            "tp": tp,
            "tn": tn,
            "fp": fp,
            "fn": fn,
            "raw_matrix": [
                [tn, fp],
                [fn, tp]
            ]
        },
        "support": {
            "total_samples": total,
            "positive_samples": positives,
            "negative_samples": negatives,
            "positive_prevalence_pct": round(float(positives / total * 100.0), 2) if total > 0 else 0.0
        }
    }
