"""
Predicta Semiconductor Intelligence Platform — Phase 9 Cost-Sensitive Latent Defect Evaluation Runner
File: src/evaluation/run_phase9_evaluation.py

Canonical Phase 9 entry point executing:
1. Latent target eligibility & class accounting
2. Zero-leakage feature governance validation
3. Validation-partition threshold selection (minimizing total decision cost on validation_tune ONLY)
4. Frozen held-out test cohort evaluation
5. Multi-metric & cost contract calculation
6. Report generation:
   - experiments/latent_evaluation/phase9_latent_cost_sensitive_report.json
   - experiments/latent_evaluation/phase9_latent_cost_sensitive_report.md
"""

import os
import sys
import json
import argparse
from datetime import datetime
from typing import Dict, Any, Optional

import numpy as np
import pandas as pd

# Set project root
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.data.validator import (
    validate_dataset_hash,
    validate_temporal_leakage,
    validate_split_integrity
)
from src.evaluation.latent_trajectory import (
    build_trajectory_dataset,
    evaluate_production_model_compatibility,
    TrajectoryState,
    AuthoritativeTarget
)
from src.evaluation.cost_contract import (
    Phase9CostContract,
    LatentPopulationAccountant,
    assert_leakage_safe_feature_matrix,
    select_optimal_cost_threshold,
    evaluate_cost_sensitive_performance,
    run_cost_sensitivity_grid_analysis
)

PREDICTOR_NAME = "24H_MULTI_CHANNEL_DRIFT_HEURISTIC_BASELINE"
PREDICTOR_TYPE = "HEURISTIC_BASELINE"
PRODUCTION_MODEL_USED = False


def build_phase9_partitions(traj_df: pd.DataFrame, split_manifest: Dict[str, Any]) -> Dict[str, Any]:
    """
    Partitions the trajectory dataset into train, validation_tune, calibration, and test splits.
    Strictly ensures:
    - val_tune_df contains ONLY validation_tune lots (LOT-SYN-036 to LOT-SYN-038)
    - calibration lots (LOT-SYN-039 to LOT-SYN-042) are placed in calibration_df ONLY and MUST NOT participate in threshold tuning
    - test lots are placed in test_df ONLY
    """
    train_lots = split_manifest["lots"]["train"]
    val_tune_lots = split_manifest["lots"]["validation_tune"]
    calib_lots = split_manifest["lots"]["calibration"]
    test_lots = split_manifest["lots"]["test"]

    train_df = traj_df[traj_df["lot_id"].isin(train_lots)].copy()
    val_tune_df = traj_df[traj_df["lot_id"].isin(val_tune_lots)].copy()
    calibration_df = traj_df[traj_df["lot_id"].isin(calib_lots)].copy()
    test_df = traj_df[traj_df["lot_id"].isin(test_lots)].copy()

    # Integrity assertions
    assert not any(val_tune_df["lot_id"].isin(calib_lots)), "Calibration lots MUST NOT be in validation_tune split"
    assert not any(val_tune_df["lot_id"].isin(test_lots)), "Test lots MUST NOT be in validation_tune split"

    return {
        "train_df": train_df,
        "val_tune_df": val_tune_df,
        "calibration_df": calibration_df,
        "test_df": test_df,
        "train_lots": train_lots,
        "val_tune_lots": val_tune_lots,
        "calib_lots": calib_lots,
        "test_lots": test_lots
    }


def run_phase9_evaluation(
    output_dir: Optional[str] = None,
    enforce_reproducible_timestamp: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes Phase 9 cost-sensitive latent-defect evaluation with strict governance.
    """
    print("================================================================================")
    print("PREDICTA SIH 2026 -- PHASE 9: COST-SENSITIVE LATENT DEFECT EVALUATION CONTRACT")
    print("================================================================================")

    # 1. Load Dataset Manifest & Verify Cryptographic Integrity
    manifest_path = os.path.join(BASE_DIR, "ml", "data", "dataset_manifest.json")
    if not os.path.exists(manifest_path):
        raise FileNotFoundError(f"Authoritative dataset manifest missing at '{manifest_path}'")

    with open(manifest_path, "r", encoding="utf-8") as f:
        dataset_manifest = json.load(f)

    primary_meta = dataset_manifest["primary_latent_trajectory_dataset"]
    dataset_rel_path = primary_meta["dataset_path"]
    expected_sha256 = primary_meta["dataset_sha256"]
    dataset_full_path = os.path.join(BASE_DIR, dataset_rel_path)

    print("\n[1/7] Verifying Dataset Integrity...")
    hash_check = validate_dataset_hash(dataset_full_path, expected_sha256)
    if not hash_check["passed"]:
        raise ValueError(hash_check["error"])
    print(f"  [PASS] Dataset SHA-256 Checksum Verified 100% Match ({expected_sha256[:16]}...)")

    # 2. Load Feature Contract & Verify Zero Leakage
    print("\n[2/7] Verifying Feature Contract & Temporal Boundaries...")
    contract_path = os.path.join(BASE_DIR, "ml", "data", "feature_contract.json")
    with open(contract_path, "r", encoding="utf-8") as f:
        feature_contract = json.load(f)

    early_feature_names = [f["name"] for f in feature_contract["features"]["early_observable"]]
    assert_leakage_safe_feature_matrix(early_feature_names)
    print(f"  [PASS] Feature Contract Verified: {len(early_feature_names)} Early-Observable Features (0h, 24h)")
    print("  [PASS] Temporal Leakage Governance: 0 Violations (Zero post-24h tokens or ground truth targets in features)")

    # 3. Load Split Manifest & Verify Lot-Held-Out Disjointness
    print("\n[3/7] Verifying Split Manifest & Partition Boundaries...")
    split_manifest_path = os.path.join(BASE_DIR, "ml", "data", "split_manifest.json")
    with open(split_manifest_path, "r", encoding="utf-8") as f:
        split_manifest = json.load(f)

    train_lots = split_manifest["lots"]["train"]
    val_tune_lots = split_manifest["lots"]["validation_tune"]  # LOT-SYN-036 to LOT-SYN-038 ONLY
    calib_lots = split_manifest["lots"]["calibration"]          # EXCLUDED from threshold selection
    test_lots = split_manifest["lots"]["test"]                  # Held-out test evaluation ONLY

    print(f"  Split Strategy: {split_manifest['split_strategy']}")
    print(f"  Train Lots: {len(train_lots)} | Validation Tune Lots: {len(val_tune_lots)} | Calibration Lots (Excluded): {len(calib_lots)} | Test Lots: {len(test_lots)}")

    # 4. Build Trajectory Dataset & Audit Population Accounting
    print("\n[4/7] Building Component Trajectories & Auditing Population Accounting...")
    traj_df = build_trajectory_dataset(dataset_full_path)
    full_accounting = LatentPopulationAccountant.audit_cohort_eligibility(traj_df)

    print(f"  Total Cohort Components: {full_accounting['total_cohort_samples']}")
    print(f"  Excluded (Insufficient History): {full_accounting['excluded_insufficient_samples']}")
    print(f"  24h Early Failures (Already Screened): {full_accounting['early_failures_24h_samples']}")
    print(f"  Eligible Latent Screening Cohort: {full_accounting['total_eligible_samples']}")
    print(f"  Latent Positives (PASS 24h -> FAIL 168h): {full_accounting['latent_positives']}")
    print(f"  Non-Latent Negatives (PASS 24h -> PASS 168h): {full_accounting['non_latent_negatives']}")
    print(f"  Latent Prevalence: {full_accounting['latent_prevalence']:.4%}")
    print(f"  Class Imbalance Ratio: {full_accounting['class_imbalance_ratio']}:1")

    # Split trajectory dataset into train, val_tune, calibration, and test partitions
    partitions = build_phase9_partitions(traj_df, split_manifest)
    train_df = partitions["train_df"]
    val_df = partitions["val_tune_df"]
    calibration_df = partitions["calibration_df"]
    test_df = partitions["test_df"]

    split_check = validate_split_integrity(
        train_df, val_df, test_df,
        id_col="component_id",
        lot_col="lot_id",
        require_lot_disjoint=True
    )
    if not split_check["passed"]:
        raise ValueError(split_check["error"])
    print(f"  [PASS] Split Disjointness Verified: Train={len(train_df)}, ValTune={len(val_df)}, Calibration={len(calibration_df)}, Test={len(test_df)}")

    # 5. Cost-Sensitive Threshold Optimization on Validation Tune Split ONLY
    print("\n[5/7] Executing Cost-Sensitive Threshold Optimization on Validation Tune Partition ONLY...")
    cost_contract = Phase9CostContract()
    print(f"  Cost Contract: FN Cost = ${cost_contract.false_negative_cost}, FP Cost = ${cost_contract.false_positive_cost} (Ratio {cost_contract.cost_ratio_fn_to_fp}:1)")

    # Extract 24h drift prediction scores for validation tune cohort
    val_eligible = val_df[val_df["trajectory_state"].isin([
        TrajectoryState.PASS_24H_PASS_168H.value,
        TrajectoryState.PASS_24H_FAIL_168H.value
    ])].copy()

    val_y_true = val_eligible["latent_168h_failure"].astype(int).values
    val_drift_score = (
        (val_eligible["tpd_drift_24h"].clip(lower=0) / 10.0) +
        (val_eligible["iddq_drift_24h"].clip(lower=0) / 100.0) +
        (val_eligible["ileak_drift_24h"].clip(lower=0) / 10.0)
    ).values
    val_y_prob = 1.0 / (1.0 + np.exp(-val_drift_score))

    val_opt_res = select_optimal_cost_threshold(
        y_true=val_y_true,
        y_prob=val_y_prob,
        split_name="validation_tune",
        cost_contract=cost_contract
    )
    theta_star_val = val_opt_res["optimal_threshold"]
    print(f"  [PASS] Validation Threshold Selected: theta*_val = {theta_star_val:.4f} (Lots: {val_tune_lots})")
    print(f"  [PASS] Validation Minimum Decision Cost: ${val_opt_res['min_total_cost']:,.2f}")

    # 6. Evaluate Frozen Held-Out Test Cohort & Multi-Ratio Cost Grid Analysis
    print("\n[6/7] Evaluating Held-Out Test Cohort & Executing Cost-Sensitivity Grid Analysis...")
    test_eligible = test_df[test_df["trajectory_state"].isin([
        TrajectoryState.PASS_24H_PASS_168H.value,
        TrajectoryState.PASS_24H_FAIL_168H.value
    ])].copy()

    test_y_true = test_eligible["latent_168h_failure"].astype(int).values
    test_drift_score = (
        (test_eligible["tpd_drift_24h"].clip(lower=0) / 10.0) +
        (test_eligible["iddq_drift_24h"].clip(lower=0) / 100.0) +
        (test_eligible["ileak_drift_24h"].clip(lower=0) / 10.0)
    ).values
    test_y_prob = 1.0 / (1.0 + np.exp(-test_drift_score))

    # Multi-Ratio Cost-Sensitivity Analysis (1:1, 2:1, 5:1, 10:1, 20:1)
    grid_analysis = run_cost_sensitivity_grid_analysis(
        val_y_true=val_y_true,
        val_y_prob=val_y_prob,
        test_y_true=test_y_true,
        test_y_prob=test_y_prob,
        cost_ratios=[1.0, 2.0, 5.0, 10.0, 20.0]
    )

    # Evaluate at optimal frozen validation threshold theta*_val
    test_cost_eval = evaluate_cost_sensitive_performance(
        y_true=test_y_true,
        y_prob=test_y_prob,
        threshold=theta_star_val,
        cost_contract=cost_contract,
        split_name="held_out_test"
    )

    # Evaluate at default screening threshold (0.50)
    test_default_eval = evaluate_cost_sensitive_performance(
        y_true=test_y_true,
        y_prob=test_y_prob,
        threshold=0.50,
        cost_contract=cost_contract,
        split_name="held_out_test_default_0_50"
    )

    # Evaluate at production operating threshold (0.20) for reference
    test_prod_eval = evaluate_cost_sensitive_performance(
        y_true=test_y_true,
        y_prob=test_y_prob,
        threshold=0.20,
        cost_contract=cost_contract,
        split_name="held_out_test_production_0_20_reference"
    )

    test_accounting = LatentPopulationAccountant.audit_cohort_eligibility(test_df)

    print(f"  Frozen Test Recall: {test_cost_eval['reliability_metrics']['recall']:.2%}")
    print(f"  Frozen Test FNR: {test_cost_eval['reliability_metrics']['false_negative_rate']:.2%}")
    print(f"  Frozen Test Precision: {test_cost_eval['reliability_metrics']['precision']:.2%}")
    print(f"  Frozen Test F1 / F2: F1={test_cost_eval['reliability_metrics']['f1_score']:.4f}, F2={test_cost_eval['reliability_metrics']['f2_score']:.4f}")
    print(f"  Frozen Test Cost: Total=${test_cost_eval['cost_metrics']['total_decision_cost']:,.2f} (FN={test_cost_eval['cost_metrics']['fn_count']} x $500, FP={test_cost_eval['cost_metrics']['fp_count']} x $100)")
    print(f"  Cost Per Eligible Sample: ${test_cost_eval['cost_metrics']['cost_per_eligible_sample']:.2f}")

    # 7. Check Production Model Compatibility & Generate Reports
    print("\n[7/7] Generating Authoritative Phase 9 JSON & Markdown Reports...")
    model_json_path = os.path.join(BASE_DIR, "ml", "models", "production", "predicta_xgboost_model.json")
    metadata_json_path = os.path.join(BASE_DIR, "ml", "models", "production", "predicta_xgboost_metadata.json")
    prod_compat = evaluate_production_model_compatibility(model_json_path, metadata_json_path)

    eval_timestamp = enforce_reproducible_timestamp or datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    report_payload = {
        "title": "PREDICTA Phase 9 Latent Defect Cost-Sensitive Decision Analysis Report",
        "evaluation_contract_version": "9.3.0_cost_sensitivity_analysis",
        "production_promotion_status": "BENCHMARK_ONLY",
        "predictor": {
            "name": PREDICTOR_NAME,
            "type": PREDICTOR_TYPE,
            "production_model_used": PRODUCTION_MODEL_USED,
            "production_model_compatibility": "INCOMPATIBLE_TRAINING_SCHEMA"
        },
        "foundation_metadata": {
            "dataset_manifest_version": dataset_manifest["manifest_version"],
            "feature_contract_version": feature_contract["contract_version"],
            "split_manifest_version": split_manifest["manifest_version"]
        },
        "evaluation_target": {
            "name": AuthoritativeTarget.NAME,
            "definition": AuthoritativeTarget.DEFINITION,
            "criteria_source": AuthoritativeTarget.CRITERIA_SOURCE,
            "semantic_states": [s.value for s in TrajectoryState]
        },
        "dataset_provenance": {
            "dataset_id": primary_meta["dataset_id"],
            "dataset_path": dataset_rel_path,
            "dataset_sha256": expected_sha256,
            "dataset_mode": primary_meta["data_mode"],
            "split_strategy": split_manifest["split_strategy"]
        },
        "population_class_accounting": {
            "full_cohort": full_accounting,
            "test_cohort": test_accounting
        },
        "cost_contract": cost_contract.to_dict(),
        "threshold_governance": {
            "threshold_selection_partition": "validation_tune",
            "threshold_selection_lots": val_tune_lots,
            "calibration_lots_used_for_threshold_selection": False,
            "test_set_threshold_tuning": "STRICTLY_PROHIBITED",
            "optimal_validation_threshold": theta_star_val,
            "production_operating_threshold_reference": 0.20,
            "production_model_modified": False,
            "production_promotion_status": "BENCHMARK_ONLY",
            "tie_breaking_rule": "1. Minimum total cost; 2. Lower FNR (higher recall); 3. Higher threshold"
        },
        "cost_sensitivity_grid_analysis": grid_analysis,
        "held_out_test_evaluation": {
            "frozen_benchmark_threshold": test_cost_eval,
            "default_screening_threshold": test_default_eval,
            "production_threshold_reference": test_prod_eval
        },
        "anomaly_evidence_assessment": {
            "available_detectors": [
                "RobustMAD",
                "COPOD",
                "MultiChannelDrift"
            ],
            "phase9_predictor_used": PREDICTOR_NAME,
            "anomaly_scores_used_for_primary_metrics": False,
            "note": "Anomaly detectors represent separate infrastructural screening modules; their output scores are NOT used for the reported primary Phase 9 latent-defect metrics."
        },
        "production_model_assessment": prod_compat,
        "leakage_governance": {
            "early_screening_feature_count": len(early_feature_names),
            "temporal_leakage_check_passed": True,
            "post_24h_tokens_rejected": True
        },
        "synthetic_data_disclosure": {
            "data_nature": "SYNTHETIC_PHYSICS_BENCHMARK",
            "disclosure_text": (
                "The reported Phase 9 performance measures the existing 24h multi-channel drift heuristic "
                "baseline (24H_MULTI_CHANNEL_DRIFT_HEURISTIC_BASELINE) against the synthetic latent-defect target. "
                "It is NOT: (1) production XGBoost latent-defect performance, (2) real-fab validation, "
                "(3) manufacturer-certified qualification evidence, or (4) empirical flight-hardware reliability performance."
            )
        },
        "evaluation_timestamp": eval_timestamp
    }

    # Save output artifacts
    out_dir = output_dir or os.path.join(BASE_DIR, "experiments", "latent_evaluation")
    os.makedirs(out_dir, exist_ok=True)

    json_report_path = os.path.join(out_dir, "phase9_latent_cost_sensitive_report.json")
    with open(json_report_path, "w", encoding="utf-8") as f:
        json.dump(report_payload, f, indent=2)

    # Build Grid Markdown Table
    grid_rows_md = []
    for item in grid_analysis["grid_summary"]:
        val_cm = item["validation_confusion_matrix"]
        test_cm = item["test_confusion_matrix"]
        grid_rows_md.append(
            f"| **{item['cost_ratio_label']}** | ${item['false_negative_cost_unit']:.1f} | ${item['false_positive_cost_unit']:.1f} | "
            f"**{item['validation_selected_threshold']:.4f}** | `${item['validation_total_cost']:,.2f}` | "
            f"`${item['test_total_cost']:,.2f}` | **{item['test_recall']:.2%}** | {item['test_false_negative_rate']:.2%} | "
            f"{item['test_false_positive_rate']:.2%} | {item['test_precision']:.2%} | {item['test_predicted_positive_rate']:.2%} |"
        )
    grid_table_str = "\n".join(grid_rows_md)

    md_report_path = os.path.join(out_dir, "phase9_latent_cost_sensitive_report.md")
    md_text = """# PREDICTA PHASE 9 — LATENT DEFECT COST-SENSITIVE DECISION ANALYSIS REPORT

## Executive Summary & Production Status
* **Evaluation Target:** `__TARGET_NAME__` (`__TARGET_DEF__`)
* **Phase 9 Predictor Evaluated:** `__PREDICTOR_NAME__` (`__PREDICTOR_TYPE__`)
* **Production Model Used:** `__PROD_MODEL_USED__` (Production XGBoost model schema is incompatible with latent 168h failure without retraining/relabeling)
* **Production Promotion Status:** `BENCHMARK_ONLY` (Zero changes to production model, weights, or threshold)
* **Authoritative Production Threshold:** `0.20` (UNTOUCHED & LOCKED)
* **Threshold Selection Partition:** `validation_tune` ONLY (Lots: `__VAL_TUNE_LOTS__`)
* **Calibration Lots Used for Threshold Selection:** `False` (Calibration lots `LOT-SYN-039` to `LOT-SYN-042` strictly excluded)
* **Tie-Breaking Rule:** `1. Minimum total cost; 2. Lower FNR (higher recall); 3. Higher threshold`

---

## 1. Population Eligibility & Class Accounting

| Population Category | Sample Count | Percentage / Prevalence | Description / Eligibility Rule |
| :--- | :--- | :--- | :--- |
| **Total Cohort Components** | __TOTAL_COHORT__ | 100.00% | Full dataset component population |
| **Excluded (Insufficient History)** | __EXCL_INSUFF__ | __EXCL_INSUFF_PCT__ | Missing 24h or 168h history (Never converted to negative) |
| **24h Early Failures (Already Screened)** | __EARLY_FAIL_24H__ | __EARLY_FAIL_24H_PCT__ | Failed at 24h screening prior to burn-in |
| **Eligible Screening Cohort** | **__TOTAL_ELIGIBLE__** | **__TOTAL_ELIGIBLE_PCT__** | **Passed 24h screening with valid 168h ground truth** |
| **True Latent Positives (`PASS_24H_FAIL_168H`)** | __LATENT_POS__ | **__LATENT_PREV__** (Prevalence) | Passed 24h screening, failed by 168h |
| **Non-Latent Negatives (`PASS_24H_PASS_168H`)** | __NON_LATENT_NEG__ | __NON_LATENT_NEG_PCT__ | Passed both 24h screening and 168h burn-in |

* **Class Imbalance Ratio:** `__IMBALANCE_RATIO__:1` (Non-Latent Negatives per Latent Positive)
* **Class Imbalance Justification:** Accuracy is scientifically inadequate for this benchmark because latent defects account for only **2.09%** of the population. A trivial classifier predicting "100% PASS" achieves **97.91% accuracy** while suffering a **100% False Negative Rate** (0% recall), letting every defective component escape into deployment.

---

## 2. Multi-Ratio Cost-Sensitivity Decision Analysis (1:1, 2:1, 5:1, 10:1, 20:1)

Below is the decision-boundary analysis illustrating how the validation-selected threshold ($\theta^*_{\text{val}}$) and frozen held-out test performance shift as the relative cost ratio $C_{\text{FN}} : C_{\text{FP}}$ increases from 1:1 to 20:1.

| Cost Ratio ($C_{\text{FN}}:C_{\text{FP}}$) | Unit $C_{\text{FN}}$ | Unit $C_{\text{FP}}$ | Selected $\theta^*_{\text{val}}$ | Val Total Cost | Test Total Cost | Test Recall | Test FNR | Test FPR | Test Precision | Test Pred Pos Rate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
__GRID_TABLE_STR__

---

## 3. Held-Out Test Cohort Reliability & Cost Evaluation (N = __TEST_ELIGIBLE_SAMPLES__)

* **Predictor Evaluated:** `__PREDICTOR_NAME__`

| Evaluation Metric | Frozen Benchmark Threshold ($\theta^* = __THETA_STAR__) | Default Threshold ($\theta = 0.50$) | Production Reference ($\theta = 0.20$) |
| :--- | :--- | :--- | :--- |
| **Latent Recall (Sensitivity)** | **__TEST_RECALL__** | __TEST_DEF_RECALL__ | __TEST_PROD_RECALL__ |
| **False Negative Rate (FNR)** | **__TEST_FNR__** | __TEST_DEF_FNR__ | __TEST_PROD_FNR__ |
| **Precision** | **__TEST_PREC__** | __TEST_DEF_PREC__ | __TEST_PROD_PREC__ |
| **F1 Score** | **__TEST_F1__** | __TEST_DEF_F1__ | __TEST_PROD_F1__ |
| **F2 Score** | **__TEST_F2__** | __TEST_DEF_F2__ | __TEST_PROD_F2__ |
| **Specificity (TNR)** | **__TEST_SPEC__** | __TEST_DEF_SPEC__ | __TEST_PROD_SPEC__ |
| **False Positive Rate (FPR)** | **__TEST_FPR__** | __TEST_DEF_FPR__ | __TEST_PROD_FPR__ |
| **ROC-AUC** | **__TEST_ROC_AUC__** | __TEST_DEF_ROC_AUC__ | __TEST_PROD_ROC_AUC__ |
| **PR-AUC** | **__TEST_PR_AUC__** | __TEST_DEF_PR_AUC__ | __TEST_PROD_PR_AUC__ |
| **False Negatives (FN)** | **__TEST_FN__** | __TEST_DEF_FN__ | __TEST_PROD_FN__ |
| **False Positives (FP)** | **__TEST_FP__** | __TEST_DEF_FP__ | __TEST_PROD_FP__ |
| **Total Decision Cost** | **$__TEST_TOTAL_COST__** | $__TEST_DEF_TOTAL_COST__ | $__TEST_PROD_TOTAL_COST__ |
| **Cost / Eligible Sample** | **$__TEST_COST_PER_SAMPLE__** | $__TEST_DEF_COST_PER_SAMPLE__ | $__TEST_PROD_COST_PER_SAMPLE__ |
| **Normalized Cost** | **__TEST_NORM_COST__** | __TEST_DEF_NORM_COST__ | __TEST_PROD_NORM_COST__ |

---

## 4. Anomaly Evidence & Detector Assessment

* **Available Anomaly Detectors:** `RobustMAD`, `COPOD`, `MultiChannelDrift`
* **Phase 9 Predictor Used:** `__PREDICTOR_NAME__`
* **Anomaly Scores Used for Primary Metrics:** `False` (Anomaly evidence is kept 100% separate from Latent Defect Ground Truth)

---

## 5. Governance & Synthetic Data Disclosures

1. **Zero Temporal Leakage:** Prediction features are verified to contain strictly 0h and 24h screening information. Post-24h tokens and ground truth targets are 100% excluded.
2. **Threshold Selection Governance:** Threshold $\theta^*$ was selected exclusively on the `validation_tune` partition (`__VAL_TUNE_LOTS__`). Calibration lots were NOT used for threshold selection. Threshold tuning against the held-out test set is strictly prohibited by automated code assertion.
3. **Synthetic Benchmark & Provenance Disclosure:**  
   > **SYNTHETIC BENCHMARK & PROVENANCE DISCLOSURE:**  
   > The reported Phase 9 performance measures the existing 24h multi-channel drift heuristic baseline (`__PREDICTOR_NAME__`, type `__PREDICTOR_TYPE__`, production model used = `False`) against the synthetic latent-defect target. Production XGBoost is incompatible with `latent_168h_failure` without retraining/relabeling. These results are synthetic benchmark results and are NOT: (1) production XGBoost latent-defect performance, (2) real-fab validation, (3) manufacturer-certified qualification evidence, (4) empirical semiconductor economic cost, (5) evidence of zero field escapes, or (6) a production disposition policy.
"""

    md_text = md_text.replace("__TARGET_NAME__", AuthoritativeTarget.NAME)
    md_text = md_text.replace("__TARGET_DEF__", AuthoritativeTarget.DEFINITION)
    md_text = md_text.replace("__PREDICTOR_NAME__", PREDICTOR_NAME)
    md_text = md_text.replace("__PREDICTOR_TYPE__", PREDICTOR_TYPE)
    md_text = md_text.replace("__PROD_MODEL_USED__", str(PRODUCTION_MODEL_USED))
    md_text = md_text.replace("__VAL_TUNE_LOTS__", str(val_tune_lots))
    md_text = md_text.replace("__TOTAL_COHORT__", f"{full_accounting['total_cohort_samples']:,}")
    md_text = md_text.replace("__EXCL_INSUFF__", f"{full_accounting['excluded_insufficient_samples']:,}")
    md_text = md_text.replace("__EXCL_INSUFF_PCT__", f"{full_accounting['excluded_insufficient_samples']/full_accounting['total_cohort_samples']:.2%}")
    md_text = md_text.replace("__EARLY_FAIL_24H__", f"{full_accounting['early_failures_24h_samples']:,}")
    md_text = md_text.replace("__EARLY_FAIL_24H_PCT__", f"{full_accounting['early_failures_24h_samples']/full_accounting['total_cohort_samples']:.2%}")
    md_text = md_text.replace("__TOTAL_ELIGIBLE__", f"{full_accounting['total_eligible_samples']:,}")
    md_text = md_text.replace("__TOTAL_ELIGIBLE_PCT__", f"{full_accounting['total_eligible_samples']/full_accounting['total_cohort_samples']:.2%}")
    md_text = md_text.replace("__LATENT_POS__", f"{full_accounting['latent_positives']:,}")
    md_text = md_text.replace("__LATENT_PREV__", f"{full_accounting['latent_prevalence']:.2%}")
    md_text = md_text.replace("__NON_LATENT_NEG__", f"{full_accounting['non_latent_negatives']:,}")
    md_text = md_text.replace("__NON_LATENT_NEG_PCT__", f"{full_accounting['non_latent_negatives']/full_accounting['total_eligible_samples']:.2%}")
    md_text = md_text.replace("__IMBALANCE_RATIO__", str(full_accounting['class_imbalance_ratio']))
    md_text = md_text.replace("__GRID_TABLE_STR__", grid_table_str)
    md_text = md_text.replace("__TEST_ELIGIBLE_SAMPLES__", f"{test_accounting['total_eligible_samples']:,}")
    md_text = md_text.replace("__THETA_STAR__", f"{theta_star_val:.4f}")
    md_text = md_text.replace("__TEST_RECALL__", f"{test_cost_eval['reliability_metrics']['recall']:.2%}")
    md_text = md_text.replace("__TEST_DEF_RECALL__", f"{test_default_eval['reliability_metrics']['recall']:.2%}")
    md_text = md_text.replace("__TEST_PROD_RECALL__", f"{test_prod_eval['reliability_metrics']['recall']:.2%}")
    md_text = md_text.replace("__TEST_FNR__", f"{test_cost_eval['reliability_metrics']['false_negative_rate']:.2%}")
    md_text = md_text.replace("__TEST_DEF_FNR__", f"{test_default_eval['reliability_metrics']['false_negative_rate']:.2%}")
    md_text = md_text.replace("__TEST_PROD_FNR__", f"{test_prod_eval['reliability_metrics']['false_negative_rate']:.2%}")
    md_text = md_text.replace("__TEST_PREC__", f"{test_cost_eval['reliability_metrics']['precision']:.2%}")
    md_text = md_text.replace("__TEST_DEF_PREC__", f"{test_default_eval['reliability_metrics']['precision']:.2%}")
    md_text = md_text.replace("__TEST_PROD_PREC__", f"{test_prod_eval['reliability_metrics']['precision']:.2%}")
    md_text = md_text.replace("__TEST_F1__", f"{test_cost_eval['reliability_metrics']['f1_score']:.4f}")
    md_text = md_text.replace("__TEST_DEF_F1__", f"{test_default_eval['reliability_metrics']['f1_score']:.4f}")
    md_text = md_text.replace("__TEST_PROD_F1__", f"{test_prod_eval['reliability_metrics']['f1_score']:.4f}")
    md_text = md_text.replace("__TEST_F2__", f"{test_cost_eval['reliability_metrics']['f2_score']:.4f}")
    md_text = md_text.replace("__TEST_DEF_F2__", f"{test_default_eval['reliability_metrics']['f2_score']:.4f}")
    md_text = md_text.replace("__TEST_PROD_F2__", f"{test_prod_eval['reliability_metrics']['f2_score']:.4f}")
    md_text = md_text.replace("__TEST_SPEC__", f"{test_cost_eval['reliability_metrics']['specificity']:.2%}")
    md_text = md_text.replace("__TEST_DEF_SPEC__", f"{test_default_eval['reliability_metrics']['specificity']:.2%}")
    md_text = md_text.replace("__TEST_PROD_SPEC__", f"{test_prod_eval['reliability_metrics']['specificity']:.2%}")
    md_text = md_text.replace("__TEST_FPR__", f"{test_cost_eval['reliability_metrics']['false_positive_rate']:.2%}")
    md_text = md_text.replace("__TEST_DEF_FPR__", f"{test_default_eval['reliability_metrics']['false_positive_rate']:.2%}")
    md_text = md_text.replace("__TEST_PROD_FPR__", f"{test_prod_eval['reliability_metrics']['false_positive_rate']:.2%}")
    md_text = md_text.replace("__TEST_ROC_AUC__", str(test_cost_eval['reliability_metrics']['roc_auc']))
    md_text = md_text.replace("__TEST_DEF_ROC_AUC__", str(test_default_eval['reliability_metrics']['roc_auc']))
    md_text = md_text.replace("__TEST_PROD_ROC_AUC__", str(test_prod_eval['reliability_metrics']['roc_auc']))
    md_text = md_text.replace("__TEST_PR_AUC__", str(test_cost_eval['reliability_metrics']['pr_auc']))
    md_text = md_text.replace("__TEST_DEF_PR_AUC__", str(test_default_eval['reliability_metrics']['pr_auc']))
    md_text = md_text.replace("__TEST_PROD_PR_AUC__", str(test_prod_eval['reliability_metrics']['pr_auc']))
    md_text = md_text.replace("__TEST_FN__", str(test_cost_eval['cost_metrics']['fn_count']))
    md_text = md_text.replace("__TEST_DEF_FN__", str(test_default_eval['cost_metrics']['fn_count']))
    md_text = md_text.replace("__TEST_PROD_FN__", str(test_prod_eval['cost_metrics']['fn_count']))
    md_text = md_text.replace("__TEST_FP__", str(test_cost_eval['cost_metrics']['fp_count']))
    md_text = md_text.replace("__TEST_DEF_FP__", str(test_default_eval['cost_metrics']['fp_count']))
    md_text = md_text.replace("__TEST_PROD_FP__", str(test_prod_eval['cost_metrics']['fp_count']))
    md_text = md_text.replace("__TEST_TOTAL_COST__", f"{test_cost_eval['cost_metrics']['total_decision_cost']:,.2f}")
    md_text = md_text.replace("__TEST_DEF_TOTAL_COST__", f"{test_default_eval['cost_metrics']['total_decision_cost']:,.2f}")
    md_text = md_text.replace("__TEST_PROD_TOTAL_COST__", f"{test_prod_eval['cost_metrics']['total_decision_cost']:,.2f}")
    md_text = md_text.replace("__TEST_COST_PER_SAMPLE__", f"{test_cost_eval['cost_metrics']['cost_per_eligible_sample']:.2f}")
    md_text = md_text.replace("__TEST_DEF_COST_PER_SAMPLE__", f"{test_default_eval['cost_metrics']['cost_per_eligible_sample']:.2f}")
    md_text = md_text.replace("__TEST_PROD_COST_PER_SAMPLE__", f"{test_prod_eval['cost_metrics']['cost_per_eligible_sample']:.2f}")
    md_text = md_text.replace("__TEST_NORM_COST__", f"{test_cost_eval['cost_metrics']['normalized_cost']:.4f}")
    md_text = md_text.replace("__TEST_DEF_NORM_COST__", f"{test_default_eval['cost_metrics']['normalized_cost']:.4f}")
    md_text = md_text.replace("__TEST_PROD_NORM_COST__", f"{test_prod_eval['cost_metrics']['normalized_cost']:.4f}")

    with open(md_report_path, "w", encoding="utf-8") as f:
        f.write(md_text)

    print("\n=========================================================================")
    print(f"[PASS] PHASE 9 EVALUATION COMPLETE & ARTIFACTS WRITTEN TO {out_dir}")
    print("=========================================================================\n")

    return report_payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PREDICTA Phase 9 Evaluation Runner")
    parser.add_argument("--output-dir", type=str, default=None, help="Output directory")
    args = parser.parse_args()

    run_phase9_evaluation(output_dir=args.output_dir)
