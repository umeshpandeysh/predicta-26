import numpy as np
from sklearn.metrics import (
    precision_recall_fscore_support,
    precision_recall_curve,
    auc,
)

def evaluate_predictions(y_true: np.ndarray, y_pred: np.ndarray, y_scores: np.ndarray) -> dict:
    """Calculates all key metrics for highly class-imbalanced screening datasets."""
    p, r, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average='binary', zero_division=0
    )

    # False Negative Rate (FNR)
    fnr = 1.0 - r

    # False Positive Rate (FPR)
    tn = np.sum((y_true == 0) & (y_pred == 0))
    fp = np.sum((y_true == 0) & (y_pred == 1))
    fpr = fp / (tn + fp) if (tn + fp) > 0 else 0.0

    # PR-AUC
    precision_pts, recall_pts, _ = precision_recall_curve(y_true, y_scores)
    pr_auc = auc(recall_pts, precision_pts)

    return {
        "precision": float(p),
        "recall": float(r),
        "f1": float(f1),
        "fnr": float(fnr),
        "fpr": float(fpr),
        "pr_auc": float(pr_auc)
    }
