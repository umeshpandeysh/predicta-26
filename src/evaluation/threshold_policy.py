"""
Predicta Semiconductor Intelligence Platform — Decision Threshold Governance Policy
File: src/evaluation/threshold_policy.py

Enforces strict boundaries around operating threshold selection:
1. Threshold optimization is PERMITTED on:
   - "train" partition
   - "validation" / "tuning" partition
2. Threshold optimization is STRICTLY FORBIDDEN on:
   - "test" / "held_out_test" / "locked_test" partition
3. Every threshold used in production or evaluation must carry an explicit
   provenance record (source, split, value, policy version).
"""

from enum import Enum
from typing import Dict, Any, Union, List
import numpy as np


class ThresholdSource(str, Enum):
    """Permitted sources for threshold selection."""
    TRAIN_OPTIMIZED = "TRAIN_OPTIMIZED"
    VALIDATION_OPTIMIZED = "VALIDATION_OPTIMIZED"
    AUTHORITATIVE_LOCKED_SPEC = "AUTHORITATIVE_LOCKED_SPEC"
    SAFETY_CALIBRATED_OPERATING_POINT = "SAFETY_CALIBRATED_OPERATING_POINT"


class ForbiddenTestThresholdOptimizationError(Exception):
    """Raised when an attempt is made to tune or optimize thresholds using test set data."""
    pass


class ThresholdPolicy:
    """
    Authoritative manager and validator for operating thresholds.
    """
    POLICY_VERSION = "1.0.0_authoritative"
    DEFAULT_OPERATING_THRESHOLD = 0.20
    DEFAULT_SCREENING_THRESHOLD = 0.50

    @staticmethod
    def assert_split_allowed_for_optimization(split_name: str) -> bool:
        """
        Guarantees that test sets cannot be used for threshold tuning.
        """
        split_lower = str(split_name).lower().strip()
        forbidden_splits = ["test", "held_out_test", "locked_test", "evaluation_test", "test_set"]

        for f_split in forbidden_splits:
            if f_split in split_lower:
                raise ForbiddenTestThresholdOptimizationError(
                    f"CRITICAL GOVERNANCE VIOLATION: Decision threshold optimization attempted on test split '{split_name}'. "
                    f"Test partitions are strictly reserved for unbiased evaluation and must never participate in threshold tuning!"
                )
        return True

    @staticmethod
    def select_optimal_safety_threshold(
        y_true: Union[List[int], np.ndarray],
        y_prob: Union[List[float], np.ndarray],
        split_name: str,
        target_recall: float = 1.0,
        beta: float = 2.0
    ) -> Dict[str, Any]:
        """
        Selects an optimal threshold on TRAIN or VALIDATION_TUNE partitions that maximizes F2
        subject to target recall constraint.
        """
        # Enforce governance rule
        ThresholdPolicy.assert_split_allowed_for_optimization(split_name)

        y_t = np.asarray(y_true).astype(int)
        y_p = np.asarray(y_prob).astype(float)

        threshold_grid = np.linspace(0.01, 0.99, 99)
        best_threshold = 0.50
        best_f2 = -1.0
        best_recall = 0.0

        for t in threshold_grid:
            pred = (y_p >= t).astype(int)
            tp = np.sum((y_t == 1) & (pred == 1))
            fp = np.sum((y_t == 0) & (pred == 1))
            fn = np.sum((y_t == 1) & (pred == 0))

            rec = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
            prec = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0

            beta_sq = beta ** 2
            f2 = ((1 + beta_sq) * prec * rec) / ((beta_sq * prec) + rec) if ((beta_sq * prec) + rec) > 0 else 0.0

            # Prioritize meeting target recall first, then maximizing F2
            if rec >= target_recall:
                if f2 > best_f2:
                    best_f2 = f2
                    best_threshold = float(t)
                    best_recall = rec
            elif best_f2 < 0 and rec > best_recall:
                best_threshold = float(t)
                best_recall = rec

        source = ThresholdSource.VALIDATION_OPTIMIZED.value if "val" in split_name.lower() else ThresholdSource.TRAIN_OPTIMIZED.value

        return {
            "threshold": round(best_threshold, 4),
            "threshold_source": source,
            "selection_split": split_name,
            "target_recall_constraint": target_recall,
            "validation_recall_achieved": round(best_recall, 4),
            "validation_f2_achieved": round(best_f2, 4),
            "policy_version": ThresholdPolicy.POLICY_VERSION
        }
