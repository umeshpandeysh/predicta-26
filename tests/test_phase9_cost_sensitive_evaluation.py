"""
Predicta Semiconductor Intelligence Platform — Phase 9 Cost-Sensitive Latent Defect Unit Test Suite
File: tests/test_phase9_cost_sensitive_evaluation.py

Validates:
A. Correct latent target semantics (latent_168h_failure = PASS 24h AND FAIL 168h)
B. Missing 168h history is classified as INSUFFICIENT_HISTORY (never negative)
C. Future feature leakage rejection
D. Class counts & prevalence accounting
E. Confusion matrix arithmetic
F. FN cost calculation ($500 per FN)
G. FP cost calculation ($100 per FP)
H. Total decision cost calculation
I. Validation threshold selection forbids test split optimization
J. Frozen test evaluation does not retune threshold
K. Production model artifact & threshold (0.20) integrity
"""

import os
import hashlib
import json
import numpy as np
import pandas as pd
import pytest

from src.evaluation.latent_trajectory import (
    TrajectoryState,
    evaluate_component_state,
    evaluate_acceptance_at_hour
)
from src.evaluation.cost_contract import (
    Phase9CostContract,
    LatentPopulationAccountant,
    assert_leakage_safe_feature_matrix,
    select_optimal_cost_threshold,
    evaluate_cost_sensitive_performance
)
from src.evaluation.threshold_policy import (
    ThresholdPolicy,
    ForbiddenTestThresholdOptimizationError
)


def test_latent_target_semantics():
    """A. Verify correct latent target semantics: PASS at 24h AND FAIL by 168h."""
    telemetry_pass_24 = {"tpd": 150.0, "iddq": 1000.0, "ileak": 50.0}
    telemetry_fail_168 = {"tpd": 300.0, "iddq": 6000.0, "ileak": 600.0}
    telemetry_pass_168 = {"tpd": 160.0, "iddq": 1100.0, "ileak": 55.0}

    # True Latent Defect: PASS 24h -> FAIL 168h
    res_latent = evaluate_component_state(telemetry_pass_24, telemetry_fail_168)
    assert res_latent["latent_168h_failure"] is True
    assert res_latent["trajectory_state"] == TrajectoryState.PASS_24H_FAIL_168H.value

    # Healthy: PASS 24h -> PASS 168h
    res_healthy = evaluate_component_state(telemetry_pass_24, telemetry_pass_168)
    assert res_healthy["latent_168h_failure"] is False
    assert res_healthy["trajectory_state"] == TrajectoryState.PASS_24H_PASS_168H.value

    # Early Failure: FAIL 24h -> FAIL 168h
    telemetry_fail_24 = {"tpd": 300.0, "iddq": 6000.0, "ileak": 600.0}
    res_early = evaluate_component_state(telemetry_fail_24, telemetry_fail_168)
    assert res_early["latent_168h_failure"] is False
    assert res_early["trajectory_state"] == TrajectoryState.FAIL_24H_FAIL_168H.value


def test_missing_168h_history_never_becomes_negative():
    """B. Verify missing or non-finite 168h history remains INSUFFICIENT_HISTORY and is NEVER converted to negative label."""
    telemetry_pass_24 = {"tpd": 150.0, "iddq": 1000.0, "ileak": 50.0}

    # None 168h telemetry
    res_missing_168 = evaluate_component_state(telemetry_pass_24, None)
    assert res_missing_168["latent_168h_failure"] is None
    assert res_missing_168["trajectory_state"] == TrajectoryState.INSUFFICIENT_HISTORY.value
    assert res_missing_168["state_168h"] == "INSUFFICIENT_HISTORY"

    # Non-finite 168h reading
    telemetry_nan_168 = {"tpd": np.nan, "iddq": 1000.0, "ileak": 50.0}
    res_nan_168 = evaluate_component_state(telemetry_pass_24, telemetry_nan_168)
    assert res_nan_168["latent_168h_failure"] is None
    assert res_nan_168["trajectory_state"] == TrajectoryState.INSUFFICIENT_HISTORY.value


def test_future_feature_leakage_rejection():
    """C. Verify strict feature leakage protection rejects post-24h tokens and ground truth targets."""
    valid_early_features = ["iddq_0h", "ileak_0h", "tpd_0h", "iddq_24h", "tpd_drift_24h"]
    assert assert_leakage_safe_feature_matrix(valid_early_features) is True

    forbidden_tokens_to_test = [
        "iddq_168h", "tpd_96h", "tpd_48h", "tpd_120h", "tpd_144h",
        "future_burn_in", "latent_168h_failure", "ground_truth_label", "post_burn_in_result"
    ]

    for tok_feature in forbidden_tokens_to_test:
        with pytest.raises(ValueError, match="TEMPORAL LEAKAGE DETECTED"):
            assert_leakage_safe_feature_matrix(["iddq_24h", tok_feature])


def test_class_counts_and_prevalence_accounting():
    """D. Verify class accounting and prevalence arithmetic."""
    dummy_df = pd.DataFrame({
        "component_id": [f"C{i}" for i in range(10)],
        "trajectory_state": [
            TrajectoryState.PASS_24H_PASS_168H.value,
            TrajectoryState.PASS_24H_PASS_168H.value,
            TrajectoryState.PASS_24H_PASS_168H.value,
            TrajectoryState.PASS_24H_PASS_168H.value,
            TrajectoryState.PASS_24H_FAIL_168H.value, # 1 Latent Positive
            TrajectoryState.FAIL_24H_FAIL_168H.value, # 1 Early Fail 24h
            TrajectoryState.INSUFFICIENT_HISTORY.value, # 4 Insufficient
            TrajectoryState.INSUFFICIENT_HISTORY.value,
            TrajectoryState.INSUFFICIENT_HISTORY.value,
            TrajectoryState.INSUFFICIENT_HISTORY.value,
        ]
    })

    acct = LatentPopulationAccountant.audit_cohort_eligibility(dummy_df)
    assert acct["total_cohort_samples"] == 10
    assert acct["excluded_insufficient_samples"] == 4
    assert acct["early_failures_24h_samples"] == 1
    assert acct["total_eligible_samples"] == 5
    assert acct["latent_positives"] == 1
    assert acct["non_latent_negatives"] == 4
    assert acct["latent_prevalence"] == 0.20 # 1 / 5
    assert acct["class_imbalance_ratio"] == 4.0 # 4 / 1


def test_cost_calculation_arithmetic():
    """E, F, G, H. Verify FN cost, FP cost, total cost, cost per sample, and normalized cost arithmetic."""
    contract = Phase9CostContract(false_negative_cost=500.0, false_positive_cost=100.0)

    fn_count = 3
    fp_count = 4
    total_eligible = 50
    latent_positives = 10

    # F. FN Cost
    fn_cost = fn_count * contract.false_negative_cost
    assert fn_cost == 1500.0

    # G. FP Cost
    fp_cost = fp_count * contract.false_positive_cost
    assert fp_cost == 400.0

    # H. Total Cost
    total_cost = contract.compute_total_cost(fn_count, fp_count)
    assert total_cost == 1900.0

    # Cost per sample
    cost_per_sample = contract.compute_cost_per_sample(total_cost, total_eligible)
    assert cost_per_sample == 38.0 # 1900 / 50

    # Normalized cost (max cost = 10 * 500 = 5000)
    norm_cost = contract.compute_normalized_cost(total_cost, latent_positives)
    assert norm_cost == 0.38 # 1900 / 5000


def test_validation_threshold_selection_forbids_test_split_optimization():
    """I. Verify validation threshold selection raises ForbiddenTestThresholdOptimizationError if test split is passed."""
    y_true = np.array([1, 0, 1, 0])
    y_prob = np.array([0.8, 0.2, 0.9, 0.1])

    # Valid validation split -> works
    val_res = select_optimal_cost_threshold(y_true, y_prob, split_name="validation_tune")
    assert "optimal_threshold" in val_res

    # Test split -> MUST raise ForbiddenTestThresholdOptimizationError
    with pytest.raises(ForbiddenTestThresholdOptimizationError, match="CRITICAL GOVERNANCE VIOLATION"):
        select_optimal_cost_threshold(y_true, y_prob, split_name="held_out_test_split")


def test_frozen_test_evaluation_does_not_retune_threshold():
    """J. Verify frozen test evaluation uses provided threshold and does not alter it."""
    y_true_test = np.array([1, 0, 1, 0, 0, 1, 0, 0])
    y_prob_test = np.array([0.9, 0.1, 0.85, 0.3, 0.05, 0.95, 0.2, 0.1])

    frozen_threshold = 0.75
    eval_res = evaluate_cost_sensitive_performance(
        y_true=y_true_test,
        y_prob=y_prob_test,
        threshold=frozen_threshold,
        split_name="held_out_test"
    )

    assert eval_res["operating_threshold"] == 0.75
    assert eval_res["split_name"] == "held_out_test"


def test_production_artifacts_and_threshold_untouched():
    """K. Verify production XGBoost model hash and production threshold (0.20) are untouched."""
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

    # Verify production model JSON exists and hash is intact
    prod_model_path = os.path.join(base_dir, "ml", "models", "production", "predicta_xgboost_model.json")
    assert os.path.exists(prod_model_path), f"Production model missing at {prod_model_path}"

    with open(prod_model_path, "rb") as f:
        model_sha = hashlib.sha256(f.read()).hexdigest()
    assert model_sha == "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"

    # Verify production threshold in policy is 0.20
    assert ThresholdPolicy.DEFAULT_OPERATING_THRESHOLD == 0.20
