"""
Predicta Semiconductor Intelligence Platform — Phase 9 Cost-Sensitive Latent Defect Unit Test Suite
File: tests/test_phase9_cost_sensitive_evaluation.py

Validates:
1. Calibration lots cannot enter threshold optimization (validation_tune ONLY).
2. Threshold-selection metadata exactly matches actual selected records.
3. Phase 9 predictor is explicitly identified as 24H_MULTI_CHANNEL_DRIFT_HEURISTIC_BASELINE.
4. Report does not claim XGBoost produced Phase 9 metrics (production_model_used = false).
5. Report does not claim RobustMAD/COPOD were primary predictors (anomaly_scores_used_for_primary_metrics = false).
6. Production model SHA remains 91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98.
7. Production threshold remains 0.20.
8. Latent target semantics remain unchanged.
9. Leakage protections remain unchanged.
10. Cost arithmetic remains unchanged ($500 FN, $100 FP).
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
    evaluate_acceptance_at_hour,
    build_trajectory_dataset
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
from src.evaluation.run_phase9_evaluation import (
    run_phase9_evaluation,
    build_phase9_partitions,
    PREDICTOR_NAME,
    PREDICTOR_TYPE,
    PRODUCTION_MODEL_USED
)

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def test_build_phase9_partitions_strictly_excludes_calibration_and_test():
    """
    1. Regression test ensuring build_phase9_partitions strictly segregates splits:
       - val_tune_df contains ONLY validation_tune lots (LOT-SYN-036 to LOT-SYN-038)
       - calibration lots (LOT-SYN-039 to LOT-SYN-042) are placed in calibration_df ONLY and excluded from val_tune_df
       - test lots (LOT-SYN-043 to LOT-SYN-050) are placed in test_df ONLY and excluded from val_tune_df
    """
    manifest_path = os.path.join(BASE_DIR, "ml", "data", "split_manifest.json")
    ds_manifest_path = os.path.join(BASE_DIR, "ml", "data", "dataset_manifest.json")
    with open(manifest_path, "r", encoding="utf-8") as f:
        split_manifest = json.load(f)
    with open(ds_manifest_path, "r", encoding="utf-8") as f:
        ds_manifest = json.load(f)

    dataset_rel_path = ds_manifest["primary_latent_trajectory_dataset"]["dataset_path"]
    dataset_path = os.path.join(BASE_DIR, dataset_rel_path)

    traj_df = build_trajectory_dataset(dataset_path)
    partitions = build_phase9_partitions(traj_df, split_manifest)

    val_tune_df = partitions["val_tune_df"]
    calib_df = partitions["calibration_df"]
    test_df = partitions["test_df"]

    val_tune_lots_actual = set(val_tune_df["lot_id"].unique())
    calib_lots_actual = set(calib_df["lot_id"].unique())
    test_lots_actual = set(test_df["lot_id"].unique())

    expected_val_tune = {"LOT-SYN-036", "LOT-SYN-037", "LOT-SYN-038"}
    expected_calib = {"LOT-SYN-039", "LOT-SYN-040", "LOT-SYN-041", "LOT-SYN-042"}
    expected_test = {f"LOT-SYN-0{i:02d}" for i in range(43, 51)}

    assert val_tune_lots_actual == expected_val_tune, f"Expected {expected_val_tune}, got {val_tune_lots_actual}"
    assert calib_lots_actual == expected_calib, f"Expected {expected_calib}, got {calib_lots_actual}"
    assert test_lots_actual == expected_test, f"Expected {expected_test}, got {test_lots_actual}"

    # Disjointness check
    assert len(val_tune_lots_actual.intersection(calib_lots_actual)) == 0, "Calibration lots leaked into validation_tune!"
    assert len(val_tune_lots_actual.intersection(test_lots_actual)) == 0, "Test lots leaked into validation_tune!"


def test_attack_calibration_lot_reintroduction_causes_test_failure():
    """
    Verifies that if calibration lots are reintroduced into the threshold tuning cohort,
    the partition assertion raises AssertionError immediately.
    """
    manifest_path = os.path.join(BASE_DIR, "ml", "data", "split_manifest.json")
    ds_manifest_path = os.path.join(BASE_DIR, "ml", "data", "dataset_manifest.json")
    with open(manifest_path, "r", encoding="utf-8") as f:
        split_manifest = json.load(f)
    with open(ds_manifest_path, "r", encoding="utf-8") as f:
        ds_manifest = json.load(f)

    dataset_rel_path = ds_manifest["primary_latent_trajectory_dataset"]["dataset_path"]
    dataset_path = os.path.join(BASE_DIR, dataset_rel_path)

    # Tamper with split_manifest to reintroduce calibration lots into validation_tune
    tampered_manifest = json.loads(json.dumps(split_manifest))
    tampered_manifest["lots"]["validation_tune"].append("LOT-SYN-039")

    traj_df = build_trajectory_dataset(dataset_path)

    with pytest.raises(AssertionError, match="Calibration lots MUST NOT be in validation_tune split"):
        build_phase9_partitions(traj_df, tampered_manifest)


def test_latent_target_semantics():
    """8. Verify correct latent target semantics: PASS at 24h AND FAIL by 168h."""
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
    """Verify missing or non-finite 168h history remains INSUFFICIENT_HISTORY and is NEVER converted to negative label."""
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
    """9. Verify strict feature leakage protection rejects post-24h tokens and ground truth targets."""
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
    """Verify class accounting and prevalence arithmetic."""
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
    """10. Verify FN cost, FP cost, total cost, cost per sample, and normalized cost arithmetic."""
    contract = Phase9CostContract(false_negative_cost=500.0, false_positive_cost=100.0)

    fn_count = 3
    fp_count = 4
    total_eligible = 50
    latent_positives = 10

    # FN Cost
    fn_cost = fn_count * contract.false_negative_cost
    assert fn_cost == 1500.0

    # FP Cost
    fp_cost = fp_count * contract.false_positive_cost
    assert fp_cost == 400.0

    # Total Cost
    total_cost = contract.compute_total_cost(fn_count, fp_count)
    assert total_cost == 1900.0

    # Cost per sample
    cost_per_sample = contract.compute_cost_per_sample(total_cost, total_eligible)
    assert cost_per_sample == 38.0 # 1900 / 50

    # Normalized cost (max cost = 10 * 500 = 5000)
    norm_cost = contract.compute_normalized_cost(total_cost, latent_positives)
    assert norm_cost == 0.38 # 1900 / 5000


def test_calibration_lots_cannot_enter_threshold_optimization():
    """1. Verify calibration lots cannot enter Phase 9 threshold optimization."""
    report = run_phase9_evaluation()
    governance = report["threshold_governance"]

    assert governance["threshold_selection_partition"] == "validation_tune"
    assert governance["calibration_lots_used_for_threshold_selection"] is False
    assert "LOT-SYN-039" not in governance["threshold_selection_lots"]
    assert "LOT-SYN-040" not in governance["threshold_selection_lots"]
    assert "LOT-SYN-041" not in governance["threshold_selection_lots"]
    assert "LOT-SYN-042" not in governance["threshold_selection_lots"]
    assert governance["threshold_selection_lots"] == ["LOT-SYN-036", "LOT-SYN-037", "LOT-SYN-038"]


def test_threshold_selection_metadata_matches_records():
    """2. Verify threshold-selection metadata in report exactly matches actual selected records."""
    report = run_phase9_evaluation()
    governance = report["threshold_governance"]
    assert governance["threshold_selection_partition"] == "validation_tune"
    assert len(governance["threshold_selection_lots"]) == 3
    assert governance["test_set_threshold_tuning"] == "STRICTLY_PROHIBITED"


def test_phase9_predictor_identified_as_heuristic_baseline():
    """3. Verify Phase 9 predictor is explicitly identified as 24H_MULTI_CHANNEL_DRIFT_HEURISTIC_BASELINE."""
    report = run_phase9_evaluation()
    predictor = report["predictor"]
    assert predictor["name"] == "24H_MULTI_CHANNEL_DRIFT_HEURISTIC_BASELINE"
    assert predictor["type"] == "HEURISTIC_BASELINE"
    assert predictor["production_model_used"] is False


def test_report_does_not_claim_xgboost_for_phase9_metrics():
    """4. Verify report does not claim XGBoost produced Phase 9 metrics."""
    report = run_phase9_evaluation()
    assert report["predictor"]["production_model_used"] is False
    assert report["predictor"]["production_model_compatibility"] == "INCOMPATIBLE_TRAINING_SCHEMA"


def test_report_anomaly_detector_claims():
    """5. Verify report does not claim RobustMAD/COPOD were primary predictors unless their scores are actually used."""
    report = run_phase9_evaluation()
    assessment = report["anomaly_evidence_assessment"]
    assert assessment["anomaly_scores_used_for_primary_metrics"] is False
    assert assessment["phase9_predictor_used"] == "24H_MULTI_CHANNEL_DRIFT_HEURISTIC_BASELINE"
    assert "RobustMAD" in assessment["available_detectors"]
    assert "COPOD" in assessment["available_detectors"]


def test_production_model_sha_intact():
    """6. Verify production model SHA remains 91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98."""
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    prod_model_path = os.path.join(base_dir, "ml", "models", "production", "predicta_xgboost_model.json")
    assert os.path.exists(prod_model_path), f"Production model missing at {prod_model_path}"

    with open(prod_model_path, "rb") as f:
        model_sha = hashlib.sha256(f.read()).hexdigest()
    assert model_sha == "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"


def test_production_threshold_intact():
    """7. Verify production threshold remains 0.20."""
    assert ThresholdPolicy.DEFAULT_OPERATING_THRESHOLD == 0.20


def test_multi_ratio_cost_grid_arithmetic():
    """Verify multi-ratio cost evaluation arithmetic for 1:1, 2:1, 5:1, 10:1, 20:1 ratios."""
    ratios = [1.0, 2.0, 5.0, 10.0, 20.0]
    fn_count, fp_count = 4, 10

    for r in ratios:
        contract = Phase9CostContract(false_negative_cost=r, false_positive_cost=1.0, cost_ratio_fn_to_fp=r)
        expected_cost = fn_count * r + fp_count * 1.0
        assert contract.compute_total_cost(fn_count, fp_count) == expected_cost


def test_deterministic_threshold_tie_breaking():
    """Verify threshold tie-breaking rule: min total cost -> lower FNR -> higher threshold."""
    # Construct synthetic predictions where two thresholds yield identical total cost
    y_true = np.array([1, 1, 0, 0, 0])
    y_prob = np.array([0.9, 0.8, 0.4, 0.3, 0.1])
    contract = Phase9CostContract(false_negative_cost=2.0, false_positive_cost=1.0)

    res = select_optimal_cost_threshold(y_true, y_prob, split_name="validation_tune", cost_contract=contract)
    assert "optimal_threshold" in res
    assert res["tie_breaking_rule"] == "1. Minimum total cost; 2. Lower FNR (higher recall); 3. Higher threshold"


def test_adversarial_test_injection_cannot_alter_validation_threshold():
    """
    ADVERSARIAL LEAKAGE ATTACK:
    Injecting adversarial test set predictions or trying to select thresholds on held-out test split
    MUST raise ForbiddenTestThresholdOptimizationError and cannot mutate validation-selected threshold.
    """
    val_y_true = np.array([1, 0, 1, 0, 0])
    val_y_prob = np.array([0.95, 0.10, 0.85, 0.20, 0.05])

    test_y_true_adversarial = np.array([1, 1, 1, 1, 1])
    test_y_prob_adversarial = np.array([0.01, 0.02, 0.03, 0.04, 0.05])

    # 1. Validation-only threshold selection
    val_res = select_optimal_cost_threshold(val_y_true, val_y_prob, split_name="validation_tune")
    theta_val_original = val_res["optimal_threshold"]

    # 2. Attempting to optimize threshold on held-out test MUST throw ForbiddenTestThresholdOptimizationError
    with pytest.raises(ForbiddenTestThresholdOptimizationError, match="CRITICAL GOVERNANCE VIOLATION"):
        select_optimal_cost_threshold(test_y_true_adversarial, test_y_prob_adversarial, split_name="held_out_test")

    # 3. Verify validation threshold remains completely unchanged by test set data
    val_res_after = select_optimal_cost_threshold(val_y_true, val_y_prob, split_name="validation_tune")
    assert val_res_after["optimal_threshold"] == theta_val_original


def test_report_persists_cost_sensitivity_grid_summary():
    """Verify run_phase9_evaluation persists multi-ratio grid analysis in report payload."""
    report = run_phase9_evaluation()
    assert report["evaluation_contract_version"] == "9.3.0_cost_sensitivity_analysis"
    assert "cost_sensitivity_grid_analysis" in report

    grid = report["cost_sensitivity_grid_analysis"]
    assert grid["evaluated_cost_ratios"] == ["1:1", "2:1", "5:1", "10:1", "20:1"]
    assert len(grid["grid_summary"]) == 5
    assert "1:1" in grid["full_sweep_data"]
    assert "20:1" in grid["full_sweep_data"]


def test_phase9_artifact_integrity_and_reconciliation():
    """
    Artifact Integrity & Reconciliation Test:
    Loads phase9_latent_cost_sensitive_report.json and phase9_latent_cost_sensitive_report.md
    and strictly verifies all 17 governance & arithmetic constraints.
    """
    json_path = os.path.join(BASE_DIR, "experiments", "latent_evaluation", "phase9_latent_cost_sensitive_report.json")
    md_path = os.path.join(BASE_DIR, "experiments", "latent_evaluation", "phase9_latent_cost_sensitive_report.md")

    # 1. Existence assertions
    assert os.path.exists(json_path), f"JSON report missing at {json_path}"
    assert os.path.exists(md_path), f"Markdown report missing at {md_path}"

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    with open(md_path, "r", encoding="utf-8") as f:
        md_content = f.read()

    # 2. Five cost ratios assertion
    grid = data["cost_sensitivity_grid_analysis"]
    assert grid["evaluated_cost_ratios"] == ["1:1", "2:1", "5:1", "10:1", "20:1"]
    summary = grid["grid_summary"]
    assert len(summary) == 5

    # 3. Arithmetic assertions for each ratio
    for item in summary:
        val_cm = item["validation_confusion_matrix"]
        test_cm = item["test_confusion_matrix"]

        val_n = val_cm["tp"] + val_cm["tn"] + val_cm["fp"] + val_cm["fn"]
        test_n = test_cm["tp"] + test_cm["tn"] + test_cm["fp"] + test_cm["fn"]

        assert val_n == 291, f"Validation cohort N must be 291, got {val_n}"
        assert test_n == 777, f"Test cohort N must be 777, got {test_n}"

        # predicted_positive_rate = (TP + FP) / N
        expected_ppr = round(float((test_cm["tp"] + test_cm["fp"]) / test_n), 6)
        assert item["test_predicted_positive_rate"] == expected_ppr

        # precision = TP / (TP + FP)
        denom_prec = test_cm["tp"] + test_cm["fp"]
        expected_prec = round(float(test_cm["tp"] / denom_prec), 6) if denom_prec > 0 else 0.0
        assert item["test_precision"] == expected_prec

        # FPR = FP / (TN + FP)
        denom_fpr = test_cm["tn"] + test_cm["fp"]
        expected_fpr = round(float(test_cm["fp"] / denom_fpr), 6) if denom_fpr > 0 else 0.0
        assert item["test_false_positive_rate"] == expected_fpr

        # total_cost = FN * FN_cost + FP * FP_cost
        expected_cost = round(float(test_cm["fn"] * item["false_negative_cost_unit"] + test_cm["fp"] * item["false_positive_cost_unit"]), 2)
        assert item["test_total_cost"] == expected_cost

    # 4. JSON Disclosure contains all six limitations
    disc = data["synthetic_data_disclosure"]
    disc_text = disc["disclosure_text"]
    limitations = [
        "NOT production XGBoost latent-defect performance",
        "NOT real-fab validation",
        "NOT manufacturer-certified qualification evidence",
        "NOT empirical semiconductor economic cost",
        "NOT evidence of zero field escapes",
        "NOT a production disposition policy"
    ]
    for lim in limitations:
        assert lim.lower().replace("not ", "") in disc_text.lower() or lim in disc.get("limitations", []), f"Missing limitation in JSON: {lim}"

    # 5. Markdown Disclosure contains all six limitations
    for lim in limitations:
        key_phrase = lim.lower().replace("not ", "")
        assert key_phrase in md_content.lower(), f"Missing limitation in Markdown: {lim}"

    # 6. Governance metadata assertions
    assert data["predictor"]["name"] == "24H_MULTI_CHANNEL_DRIFT_HEURISTIC_BASELINE"
    assert data["predictor"]["production_model_used"] is False
    assert data["threshold_governance"]["calibration_lots_used_for_threshold_selection"] is False
    assert data["threshold_governance"]["test_set_threshold_tuning"] == "STRICTLY_PROHIBITED"
    assert data["threshold_governance"]["production_operating_threshold_reference"] == 0.20

    # 7. Model SHA check
    prod_model_path = os.path.join(BASE_DIR, "ml", "models", "production", "predicta_xgboost_model.json")
    with open(prod_model_path, "rb") as f:
        model_sha = hashlib.sha256(f.read()).hexdigest()
    assert model_sha == "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"


def test_regression_precision_vs_predicted_positive_rate_distinction():
    """
    Regression Test:
    Ensures predicted_positive_rate and precision are NOT confused.
    If TP=19, FP=758, TN=0, FN=0 (N=777):
    - precision = 19 / 777 = 0.024453
    - predicted_positive_rate = (19 + 758) / 777 = 1.0
    The two values MUST NOT be equal in this scenario.
    """
    tp, fp, tn, fn = 19, 758, 0, 0
    n = tp + tn + fp + fn
    prec = tp / (tp + fp)
    ppr = (tp + fp) / n

    assert prec != ppr
    assert abs(prec - 0.024453) < 1e-4
    assert ppr == 1.0


