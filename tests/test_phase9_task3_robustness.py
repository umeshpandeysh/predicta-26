"""
Predicta Semiconductor Intelligence Platform — Phase 9 Task 3 Latent Defect Decision Robustness Unit Test Suite
File: tests/test_phase9_task3_robustness.py

Validates:
1. Deterministic reproducibility of perturbation scenarios and flip calculations
2. Analytical prevalence sensitivity calculations (PPV, NPV, FPs/1k, FNs/1k, Cost/1k, Cost/10k)
3. Automated Adversarial Governance Attacks A through G
4. Report JSON schema (contract version 9.4.0_decision_robustness_analysis)
5. Report Markdown numerical & text parity
6. Production model SHA-256 and threshold 0.20 immutability
"""

import os
import hashlib
import json
import numpy as np
import pandas as pd
import pytest

from src.evaluation.latent_trajectory import (
    TrajectoryState,
    build_trajectory_dataset
)
from src.evaluation.cost_contract import (
    Phase9CostContract,
    select_optimal_cost_threshold,
    evaluate_cost_sensitive_performance
)
from src.evaluation.threshold_policy import (
    ThresholdPolicy,
    ForbiddenTestThresholdOptimizationError
)
from src.evaluation.robustness_contract import (
    PROBES_PREDICTOR_NAME,
    PROBES_PREDICTOR_TYPE,
    PROBES_PRODUCTION_MODEL_USED,
    evaluate_score_perturbations,
    evaluate_prevalence_sensitivity,
    run_adversarial_governance_suite
)
from src.evaluation.run_phase9_robustness_evaluation import run_phase9_robustness_evaluation

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def test_deterministic_score_perturbations_reproducibility():
    """1. Verify score perturbations yield deterministic, 100% reproducible results."""
    val_y_true = np.array([1, 1, 0, 0, 0, 0])
    val_y_prob = np.array([0.95, 0.92, 0.10, 0.05, 0.08, 0.02])
    test_y_true = np.array([1, 0, 1, 0])
    test_y_prob = np.array([0.94, 0.04, 0.91, 0.01])

    res1 = evaluate_score_perturbations(val_y_true, val_y_prob, test_y_true, test_y_prob, seed=42)
    res2 = evaluate_score_perturbations(val_y_true, val_y_prob, test_y_true, test_y_prob, seed=42)

    assert res1["scenarios_summary"][0]["validation_selected_threshold"] == res2["scenarios_summary"][0]["validation_selected_threshold"]
    assert res1["scenarios_summary"][3]["flip_analysis"]["total_flips"] == res2["scenarios_summary"][3]["flip_analysis"]["total_flips"]


def test_analytical_prevalence_sensitivity_math():
    """2. Verify analytical prevalence sensitivity math (PPV, NPV, FPs/1k, FNs/1k, Cost/1k)."""
    # Suppose recall=1.0, FPR=0.0 (perfect classification)
    res_perf = evaluate_prevalence_sensitivity(test_recall=1.0, test_fpr=0.0, assumed_prevalences=[0.01, 0.05])
    scen1 = res_perf["prevalence_scenarios"][0]
    assert scen1["expected_precision_ppv"] == 1.0
    assert scen1["expected_npv"] == 1.0
    assert scen1["expected_fp_per_1k"] == 0.0
    assert scen1["expected_fn_per_1k"] == 0.0
    assert scen1["expected_cost_per_1k_units"] == 0.0

    # Suppose recall=0.8, FPR=0.10 under pi=0.05
    res_imperfect = evaluate_prevalence_sensitivity(test_recall=0.8, test_fpr=0.10, assumed_prevalences=[0.05], fn_cost=500.0, fp_cost=100.0)
    scen_imp = res_imperfect["prevalence_scenarios"][0]
    # expected_ppv = (0.05 * 0.8) / (0.05 * 0.8 + 0.95 * 0.10) = 0.04 / (0.04 + 0.095) = 0.04 / 0.135 = 0.296296...
    assert abs(scen_imp["expected_precision_ppv"] - 0.296296) < 1e-4
    # expected_fp_per_1k = 1000 * 0.95 * 0.10 = 95.0
    assert scen_imp["expected_fp_per_1k"] == 95.0
    # expected_fn_per_1k = 1000 * 0.05 * 0.20 = 10.0
    assert scen_imp["expected_fn_per_1k"] == 10.0
    # cost_per_1k = 10 * 500 + 95 * 100 = 5000 + 9500 = 14500.0
    assert scen_imp["expected_cost_per_1k_units"] == 14500.0


def test_classification_flip_accounting():
    """3. Verify classification flip accounting logic."""
    val_y_true = np.array([1, 1, 0, 0])
    val_y_prob = np.array([0.9, 0.8, 0.2, 0.1])
    test_y_true = np.array([1, 1, 0, 0])
    test_y_prob = np.array([0.9, 0.85, 0.15, 0.05])

    res = evaluate_score_perturbations(val_y_true, val_y_prob, test_y_true, test_y_prob, seed=42)
    scens = res["scenarios_summary"]
    # Baseline should have 0 flips vs itself
    assert scens[0]["flip_analysis"]["total_flips"] == 0
    assert scens[0]["flip_analysis"]["flip_rate"] == 0.0


def test_adversarial_governance_attacks_a_through_g():
    """4. Verify automated adversarial governance suite (Attacks A through G)."""
    dataset_path = os.path.join(BASE_DIR, "data", "synthetic", "semiconductor_synthetic_full.csv")
    ds_manifest = json.load(open(os.path.join(BASE_DIR, "ml", "data", "dataset_manifest.json")))
    expected_ds_sha = ds_manifest["primary_latent_trajectory_dataset"]["dataset_sha256"]

    prod_model_path = os.path.join(BASE_DIR, "ml", "models", "production", "predicta_xgboost_model.json")
    expected_model_sha = "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"

    val_y_true = np.array([1, 0, 1, 0])
    val_y_prob = np.array([0.9, 0.1, 0.85, 0.2])
    test_y_true = np.array([1, 0, 1, 0])
    test_y_prob = np.array([0.95, 0.05, 0.8, 0.15])

    adv_res = run_adversarial_governance_suite(
        val_y_true=val_y_true,
        val_y_prob=val_y_prob,
        test_y_true=test_y_true,
        test_y_prob=test_y_prob,
        dataset_path=dataset_path,
        expected_dataset_sha256=expected_ds_sha,
        production_model_path=prod_model_path,
        expected_model_sha256=expected_model_sha,
        production_threshold=0.20
    )

    assert adv_res["all_adversarial_tests_passed"] is True
    assert adv_res["attacks_evaluated_count"] == 7
    for atk in adv_res["attack_details"]:
        assert atk["passed"] is True, f"Attack {atk['attack_id']} failed!"


def test_task3_report_artifacts_schema_and_parity():
    """5. Verify Task 3 report artifacts schema (version 9.4.0) and Markdown parity."""
    report = run_phase9_robustness_evaluation()

    assert report["evaluation_contract_version"] == "9.4.0_decision_robustness_analysis"
    assert report["predictor"]["name"] == "24H_MULTI_CHANNEL_DRIFT_HEURISTIC_BASELINE"
    assert report["predictor"]["production_model_used"] is False

    json_path = os.path.join(BASE_DIR, "experiments", "latent_evaluation", "phase9_task3_robustness_report.json")
    md_path = os.path.join(BASE_DIR, "experiments", "latent_evaluation", "phase9_task3_robustness_report.md")

    assert os.path.exists(json_path)
    assert os.path.exists(md_path)

    json_data = json.load(open(json_path, "r", encoding="utf-8"))
    md_content = open(md_path, "r", encoding="utf-8").read()

    assert json_data["evaluation_contract_version"] == "9.4.0_decision_robustness_analysis"
    assert "score_perturbation_analysis" in json_data
    assert "prevalence_sensitivity_analysis" in json_data
    assert "adversarial_governance_suite" in json_data

    # Check 6 limitations in both artifacts
    limitations = [
        "NOT production XGBoost latent-defect performance",
        "NOT real-fab validation",
        "NOT manufacturer-certified qualification evidence",
        "NOT empirical semiconductor economic cost",
        "NOT evidence of zero field escapes",
        "NOT a production disposition policy"
    ]
    disc_text = json_data["synthetic_data_disclosure"]["disclosure_text"]
    for lim in limitations:
        phrase = lim.lower().replace("not ", "")
        assert phrase in disc_text.lower() or lim in json_data["synthetic_data_disclosure"].get("limitations", [])
        assert phrase in md_content.lower()


def test_production_model_sha_and_threshold_immutability():
    """6. Verify production model SHA and threshold remain strictly immutable."""
    prod_model_path = os.path.join(BASE_DIR, "ml", "models", "production", "predicta_xgboost_model.json")
    with open(prod_model_path, "rb") as f:
        model_sha = hashlib.sha256(f.read()).hexdigest()
    assert model_sha == "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"
    assert ThresholdPolicy.DEFAULT_OPERATING_THRESHOLD == 0.20
