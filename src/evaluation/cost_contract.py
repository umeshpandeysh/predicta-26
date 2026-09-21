"""
Predicta Semiconductor Intelligence Platform — Phase 9 Cost-Sensitive Latent Defect Contract
File: src/evaluation/cost_contract.py

Authoritative, machine-readable cost configuration and population accounting for Phase 9:
1. Single authoritative cost contract:
   - false_negative_cost = 500.0 (escaped latent defect reaching flight/field deployment)
   - false_positive_cost = 100.0 (false quarantine / unnecessary extended burn-in)
   - total_cost = false_negative_cost * FN + false_positive_cost * FP
   - cost_per_eligible_sample = total_cost / total_eligible_samples
   - normalized_cost = total_cost / (false_negative_cost * total_positives)

2. Strict Population Accounting & Eligibility Rules:
   - Population must pass 24h screening AND have valid 168h ground truth.
   - Missing 168h history is strictly classified as INSUFFICIENT_HISTORY (never converted to negative label).
   - Early 24h failures (FAIL_24H_FAIL_168H, FAIL_24H_PASS_168H) are recorded as 24h early failures (screened out at 24h).

3. Leakage Governance:
   - Features may contain ONLY 0h and 24h screening information.
   - Rejects future/post-burn-in tokens (48h, 72h, 96h, 120h, 144h, 168h, future, target, ground_truth, post_burn_in).
   - Rejects latent_168h_failure in input feature matrix.

4. Threshold Governance & Validation-Only Optimization:
   - Threshold optimization is strictly forbidden on test split (ForbiddenTestThresholdOptimizationError).
   - Sweeps threshold theta on validation split to find theta*_val minimizing total cost.
   - Held-out test set is evaluated using frozen theta*_val.
   - Production threshold (0.20) is reported separately and remains locked/untouched.

5. Synthetic-Data Disclosure & Production Isolation:
   - Explicitly designates data mode as SYNTHETIC_PHYSICS_BENCHMARK.
   - Sets production_promotion_status = "BENCHMARK_ONLY".
"""

import os
import json
from dataclasses import dataclass, asdict
from typing import Dict, Any, List, Optional, Tuple, Union
import numpy as np
import pandas as pd

from src.evaluation.latent_trajectory import (
    TrajectoryState,
    AuthoritativeTarget,
    evaluate_component_state,
    assert_no_temporal_leakage
)
from src.evaluation.metrics import (
    compute_binary_confusion_matrix,
    calculate_standardized_metrics
)
from src.evaluation.threshold_policy import (
    ThresholdPolicy,
    ThresholdSource,
    ForbiddenTestThresholdOptimizationError
)


@dataclass
class Phase9CostContract:
    """
    Authoritative cost contract configuration for Phase 9 cost-sensitive evaluation.
    PROVENANCE: PROJECT_DEFINED_SYNTHETIC_BENCHMARK
    """
    false_negative_cost: float = 500.0
    false_positive_cost: float = 100.0
    cost_ratio_fn_to_fp: float = 5.0
    provenance_class: str = "PROJECT_DEFINED_SYNTHETIC_BENCHMARK"
    cost_description: str = (
        "Project-defined benchmark cost model: False Negatives (escaped latent defects) "
        "cost $500, False Positives (false quarantines) cost $100. BENCHMARK_ONLY."
    )

    def compute_total_cost(self, fn: int, fp: int) -> float:
        """Computes total decision cost: fn * false_negative_cost + fp * false_positive_cost."""
        return float(fn * self.false_negative_cost + fp * self.false_positive_cost)

    def compute_cost_per_sample(self, total_cost: float, total_eligible_samples: int) -> float:
        """Computes expected cost per eligible screening sample."""
        if total_eligible_samples <= 0:
            return 0.0
        return float(total_cost / total_eligible_samples)

    def compute_normalized_cost(self, total_cost: float, total_positives: int) -> float:
        """
        Computes cost normalized against maximum worst-case cost (where 100% of latent defects escape as FNs).
        normalized_cost = total_cost / (false_negative_cost * total_positives)
        """
        max_possible_cost = self.false_negative_cost * total_positives
        if max_possible_cost <= 0:
            return 0.0
        return float(total_cost / max_possible_cost)

    def to_dict(self) -> Dict[str, Any]:
        """Returns JSON-serializable dictionary representation."""
        return asdict(self)


class LatentPopulationAccountant:
    """
    Audits component trajectory cohorts and enforces strict eligibility rules for latent-defect evaluation.
    """

    @staticmethod
    def audit_cohort_eligibility(df: pd.DataFrame) -> Dict[str, Any]:
        """
        Calculates authoritative population accounting on a trajectory DataFrame.

        Required input columns: 'trajectory_state' (or state columns).

        Rules:
        - PASS_24H_FAIL_168H: Latent Defect Positive (latent_168h_failure = True)
        - PASS_24H_PASS_168H: Non-Latent Negative (latent_168h_failure = False)
        - FAIL_24H_FAIL_168H, FAIL_24H_PASS_168H: 24h Early Failures (Screened out at 24h)
        - INSUFFICIENT_HISTORY: Excluded (Missing 24h or 168h history; NEVER converted to negative label)
        """
        if "trajectory_state" not in df.columns:
            raise ValueError("DataFrame must contain 'trajectory_state' column for class accounting.")

        states = df["trajectory_state"].values
        total_cohort_samples = len(df)

        pass_24_pass_168 = int(np.sum(states == TrajectoryState.PASS_24H_PASS_168H.value))
        pass_24_fail_168 = int(np.sum(states == TrajectoryState.PASS_24H_FAIL_168H.value))
        fail_24_fail_168 = int(np.sum(states == TrajectoryState.FAIL_24H_FAIL_168H.value))
        fail_24_pass_168 = int(np.sum(states == TrajectoryState.FAIL_24H_PASS_168H.value))
        insufficient_history = int(np.sum(states == TrajectoryState.INSUFFICIENT_HISTORY.value))

        early_failures_24h = fail_24_fail_168 + fail_24_pass_168
        total_eligible_samples = pass_24_pass_168 + pass_24_fail_168
        latent_positives = pass_24_fail_168
        non_latent_negatives = pass_24_pass_168

        prevalence = float(latent_positives / total_eligible_samples) if total_eligible_samples > 0 else 0.0
        imbalance_ratio = float(non_latent_negatives / latent_positives) if latent_positives > 0 else 0.0

        return {
            "total_cohort_samples": total_cohort_samples,
            "excluded_insufficient_samples": insufficient_history,
            "early_failures_24h_samples": early_failures_24h,
            "total_eligible_samples": total_eligible_samples,
            "latent_positives": latent_positives,
            "non_latent_negatives": non_latent_negatives,
            "latent_prevalence": round(prevalence, 6),
            "class_imbalance_ratio": round(imbalance_ratio, 4),
            "state_breakdown": {
                TrajectoryState.PASS_24H_PASS_168H.value: pass_24_pass_168,
                TrajectoryState.PASS_24H_FAIL_168H.value: pass_24_fail_168,
                TrajectoryState.FAIL_24H_FAIL_168H.value: fail_24_fail_168,
                TrajectoryState.FAIL_24H_PASS_168H.value: fail_24_pass_168,
                TrajectoryState.INSUFFICIENT_HISTORY.value: insufficient_history,
            }
        }


def assert_leakage_safe_feature_matrix(
    feature_names: List[str],
    target_col: str = "latent_168h_failure"
) -> bool:
    """
    Strictly verifies that no future burn-in tokens or target columns enter prediction features.
    """
    forbidden_tokens = [
        "48h", "72h", "96h", "120h", "144h", "168h", "168",
        "future", "ground_truth", "target", "post_burn_in",
        "result_168", "state_168", "latent_168h_failure"
    ]
    violating = []

    for f in feature_names:
        f_lower = str(f).lower()
        if f_lower == target_col.lower():
            violating.append((f, "TARGET_COLUMN_IN_FEATURES"))

        for tok in forbidden_tokens:
            if tok in f_lower:
                violating.append((f, tok))

    if violating:
        raise ValueError(
            f"TEMPORAL LEAKAGE DETECTED! Features contain post-screening information: {violating}"
        )
    return True


def select_optimal_cost_threshold(
    y_true: Union[List[int], np.ndarray],
    y_prob: Union[List[float], np.ndarray],
    split_name: str,
    cost_contract: Optional[Phase9CostContract] = None
) -> Dict[str, Any]:
    """
    Selects the decision threshold on TRAIN or VALIDATION partitions that minimizes total decision cost.

    Enforces threshold governance: Throws ForbiddenTestThresholdOptimizationError if split_name is a test set.

    Deterministic tie-breaking rule:
    1. Minimum total cost on validation split;
    2. If tied, lower FNR (higher recall);
    3. If still tied, higher threshold value (theta).
    """
    # Governance assertion: Test partitions are strictly forbidden from tuning thresholds
    ThresholdPolicy.assert_split_allowed_for_optimization(split_name)

    contract = cost_contract or Phase9CostContract()
    y_t = np.asarray(y_true).astype(int)
    y_p = np.asarray(y_prob).astype(float)

    threshold_grid = np.linspace(0.00, 1.00, 101)
    best_key = (float("inf"), float("inf"), float("-inf"))
    best_threshold = 0.50
    min_cost = float("inf")
    best_cm = None

    sweep_results = []

    for t in threshold_grid:
        t_val = round(float(t), 4)
        pred = (y_p >= t_val).astype(int)
        cm = compute_binary_confusion_matrix(y_t, pred)
        total_cost = contract.compute_total_cost(cm["fn"], cm["fp"])
        pos_count = cm["tp"] + cm["fn"]
        neg_count = cm["tn"] + cm["fp"]

        recall = float(cm["tp"] / pos_count) if pos_count > 0 else 0.0
        fnr = float(cm["fn"] / pos_count) if pos_count > 0 else 0.0
        precision = float(cm["tp"] / (cm["tp"] + cm["fp"])) if (cm["tp"] + cm["fp"]) > 0 else 0.0
        fpr = float(cm["fp"] / neg_count) if neg_count > 0 else 0.0

        sweep_results.append({
            "threshold": t_val,
            "tp": cm["tp"],
            "tn": cm["tn"],
            "fp": cm["fp"],
            "fn": cm["fn"],
            "recall": round(recall, 6),
            "false_negative_rate": round(fnr, 6),
            "precision": round(precision, 6),
            "false_positive_rate": round(fpr, 6),
            "total_cost": round(total_cost, 2)
        })

        # Tie-breaker key: (total_cost ASC, fnr ASC, -t_val ASC -> threshold DESC)
        current_key = (total_cost, fnr, -t_val)
        if current_key < best_key:
            best_key = current_key
            min_cost = total_cost
            best_threshold = t_val
            best_cm = cm

    return {
        "optimal_threshold": best_threshold,
        "min_total_cost": round(min_cost, 2),
        "cost_contract": contract.to_dict(),
        "selection_split": split_name,
        "tie_breaking_rule": "1. Minimum total cost; 2. Lower FNR (higher recall); 3. Higher threshold",
        "confusion_matrix_at_optimal": best_cm,
        "threshold_sweep_data": sweep_results,
        "sweep_grid_samples": len(sweep_results)
    }


def run_cost_sensitivity_grid_analysis(
    val_y_true: np.ndarray,
    val_y_prob: np.ndarray,
    test_y_true: np.ndarray,
    test_y_prob: np.ndarray,
    cost_ratios: Optional[List[float]] = None
) -> Dict[str, Any]:
    """
    Executes a deterministic multi-ratio cost-sensitivity decision analysis.
    For each cost ratio (FN:FP = r:1):
    1. Sweeps threshold on validation_tune (0.00 to 1.00, step 0.01) using deterministic tie-breaking.
    2. Evaluates selected validation threshold ONCE against frozen held-out test split.
    3. Records decision boundary summary and full threshold sweep data.
    """
    ratios = cost_ratios or [1.0, 2.0, 5.0, 10.0, 20.0]
    grid_results = []
    sweep_data_by_ratio = {}

    for r in ratios:
        contract = Phase9CostContract(
            false_negative_cost=float(r),
            false_positive_cost=1.0,
            cost_ratio_fn_to_fp=float(r),
            provenance_class="PROJECT_DEFINED_SYNTHETIC_BENCHMARK",
            cost_description=f"Project-defined benchmark cost model: FN=${r:.1f}, FP=$1.0 (Ratio {r:.1f}:1). BENCHMARK_ONLY."
        )

        # 1. Validation tune threshold selection
        val_opt = select_optimal_cost_threshold(
            y_true=val_y_true,
            y_prob=val_y_prob,
            split_name="validation_tune",
            cost_contract=contract
        )
        theta_star = val_opt["optimal_threshold"]

        # 2. Frozen test evaluation at theta_star
        test_eval = evaluate_cost_sensitive_performance(
            y_true=test_y_true,
            y_prob=test_y_prob,
            threshold=theta_star,
            cost_contract=contract,
            split_name="held_out_test"
        )

        ratio_label = f"{int(r) if r.is_integer() else r}:1"
        test_rel = test_eval["reliability_metrics"]
        test_cost = test_eval["cost_metrics"]
        test_cm = test_eval["confusion_matrix"]
        val_cm = val_opt["confusion_matrix_at_optimal"]

        grid_results.append({
            "cost_ratio_label": ratio_label,
            "cost_ratio_fn_to_fp": float(r),
            "false_negative_cost_unit": float(r),
            "false_positive_cost_unit": 1.0,
            "validation_selected_threshold": theta_star,
            "validation_total_cost": val_opt["min_total_cost"],
            "validation_confusion_matrix": val_cm,
            "test_total_cost": test_cost["total_decision_cost"],
            "test_confusion_matrix": test_cm,
            "test_recall": test_rel["recall"],
            "test_false_negative_rate": test_rel["false_negative_rate"],
            "test_false_positive_rate": test_rel["false_positive_rate"],
            "test_precision": test_rel["precision"],
            "test_specificity": test_rel["specificity"],
            "test_f1_score": test_rel["f1_score"],
            "test_f2_score": test_rel["f2_score"],
            "test_pr_auc": test_rel["pr_auc"],
            "test_roc_auc": test_rel["roc_auc"],
            "test_predicted_positive_rate": round(float((test_cm["tp"] + test_cm["fp"]) / len(test_y_true)), 6),
            "test_normalized_cost": test_cost["normalized_cost"]
        })

        sweep_data_by_ratio[ratio_label] = val_opt["threshold_sweep_data"]

    return {
        "evaluated_cost_ratios": [f"{int(r) if r.is_integer() else r}:1" for r in ratios],
        "tie_breaking_rule": "1. Minimum total cost; 2. Lower FNR (higher recall); 3. Higher threshold",
        "grid_summary": grid_results,
        "full_sweep_data": sweep_data_by_ratio
    }


def evaluate_cost_sensitive_performance(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    threshold: float,
    cost_contract: Optional[Phase9CostContract] = None,
    split_name: str = "held_out_test"
) -> Dict[str, Any]:
    """
    Evaluates a frozen operating threshold against the Phase 9 cost contract and multi-metric reliability metrics.
    """
    contract = cost_contract or Phase9CostContract()
    y_t = np.asarray(y_true).astype(int)
    y_p = np.asarray(y_prob).astype(float)
    preds = (y_p >= threshold).astype(int)

    cm = compute_binary_confusion_matrix(y_t, preds)
    tp, tn, fp, fn = cm["tp"], cm["tn"], cm["fp"], cm["fn"]

    total_eligible = int(len(y_t))
    latent_positives = int(np.sum(y_t == 1))
    non_latent_negatives = int(np.sum(y_t == 0))

    # Reliability & Classification Metrics
    recall = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
    fnr = float(fn / (tp + fn)) if (tp + fn) > 0 else 0.0
    precision = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
    specificity = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
    fpr = float(fp / (tn + fp)) if (tn + fp) > 0 else 0.0

    f1 = float((2 * precision * recall) / (precision + recall)) if (precision + recall) > 0 else 0.0
    f2 = float((5 * precision * recall) / (4 * precision + recall)) if (4 * precision + recall) > 0 else 0.0

    # Trapezoidal AUC metrics from metrics.py
    std_metrics = calculate_standardized_metrics(y_t, preds, y_p, threshold=threshold, split_name=split_name)
    pr_auc = std_metrics["standard_classification_metrics"]["pr_auc"]
    roc_auc = std_metrics["standard_classification_metrics"]["roc_auc"]

    # Cost calculations
    total_cost = contract.compute_total_cost(fn, fp)
    cost_per_sample = contract.compute_cost_per_sample(total_cost, total_eligible)
    normalized_cost = contract.compute_normalized_cost(total_cost, latent_positives)

    return {
        "split_name": split_name,
        "operating_threshold": round(float(threshold), 4),
        "confusion_matrix": cm,
        "support": {
            "total_eligible_samples": total_eligible,
            "latent_positives": latent_positives,
            "non_latent_negatives": non_latent_negatives
        },
        "reliability_metrics": {
            "recall": round(recall, 6),
            "false_negative_rate": round(fnr, 6),
            "precision": round(precision, 6),
            "f1_score": round(f1, 6),
            "f2_score": round(f2, 6),
            "specificity": round(specificity, 6),
            "false_positive_rate": round(fpr, 6),
            "pr_auc": round(pr_auc, 6),
            "roc_auc": round(roc_auc, 6)
        },
        "cost_metrics": {
            "false_negative_cost_unit": contract.false_negative_cost,
            "false_positive_cost_unit": contract.false_positive_cost,
            "fn_count": fn,
            "fp_count": fp,
            "fn_total_cost": round(fn * contract.false_negative_cost, 2),
            "fp_total_cost": round(fp * contract.false_positive_cost, 2),
            "total_decision_cost": round(total_cost, 2),
            "cost_per_eligible_sample": round(cost_per_sample, 4),
            "normalized_cost": round(normalized_cost, 6),
            "cost_provenance": contract.provenance_class
        }
    }
