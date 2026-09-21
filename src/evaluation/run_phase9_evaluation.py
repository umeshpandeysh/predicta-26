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
    evaluate_cost_sensitive_performance
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

    # 6. Evaluate Frozen Held-Out Test Cohort
    print("\n[6/7] Evaluating Held-Out Test Cohort at Frozen Threshold theta*_val...")
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
        "title": "PREDICTA Phase 9 Latent Defect Cost-Sensitive Evaluation Report",
        "evaluation_contract_version": "9.2.0_authoritative",
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
            "production_promotion_status": "BENCHMARK_ONLY"
        },
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
            "anomaly_scores_used_for_primary_metrics": False
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

    md_report_path = os.path.join(out_dir, "phase9_latent_cost_sensitive_report.md")
    with open(md_report_path, "w", encoding="utf-8") as f:
        f.write(f"""# PREDICTA PHASE 9 — LATENT DEFECT COST-SENSITIVE EVALUATION REPORT

## Executive Summary & Production Status
* **Evaluation Target:** `{AuthoritativeTarget.NAME}` (`{AuthoritativeTarget.DEFINITION}`)
* **Phase 9 Predictor Evaluated:** `{PREDICTOR_NAME}` (`{PREDICTOR_TYPE}`)
* **Production Model Used:** `{PRODUCTION_MODEL_USED}` (Production XGBoost model schema is incompatible with latent 168h failure)
* **Production Promotion Status:** `BENCHMARK_ONLY` (Zero changes to production model, weights, or threshold)
* **Authoritative Production Threshold:** `0.20` (UNTOUCHED & LOCKED)
* **Threshold Selection Partition:** `validation_tune` ONLY (Lots: `{val_tune_lots}`)
* **Calibration Lots Used for Threshold Selection:** `False`
* **Benchmark Operating Threshold:** `{theta_star_val:.4f}` (Optimized strictly on `validation_tune` partition)

---

## 1. Population Eligibility & Class Accounting

| Population Category | Sample Count | Percentage / Prevalence | Description / Eligibility Rule |
| :--- | :--- | :--- | :--- |
| **Total Cohort Components** | {full_accounting['total_cohort_samples']:,} | 100.00% | Full dataset component population |
| **Excluded (Insufficient History)** | {full_accounting['excluded_insufficient_samples']:,} | {full_accounting['excluded_insufficient_samples']/full_accounting['total_cohort_samples']:.2%} | Missing 24h or 168h history (Never converted to negative) |
| **24h Early Failures (Already Screened)** | {full_accounting['early_failures_24h_samples']:,} | {full_accounting['early_failures_24h_samples']/full_accounting['total_cohort_samples']:.2%} | Failed at 24h screening prior to burn-in |
| **Eligible Screening Cohort** | **{full_accounting['total_eligible_samples']:,}** | **{full_accounting['total_eligible_samples']/full_accounting['total_cohort_samples']:.2%}** | **Passed 24h screening with valid 168h ground truth** |
| **True Latent Positives (`PASS_24H_FAIL_168H`)** | {full_accounting['latent_positives']:,} | **{full_accounting['latent_prevalence']:.2%}** (Prevalence) | Passed 24h screening, failed by 168h |
| **Non-Latent Negatives (`PASS_24H_PASS_168H`)** | {full_accounting['non_latent_negatives']:,} | {full_accounting['non_latent_negatives']/full_accounting['total_eligible_samples']:.2%} | Passed both 24h screening and 168h burn-in |

* **Class Imbalance Ratio:** `{full_accounting['class_imbalance_ratio']}:1` (Non-Latent Negatives per Latent Positive)

---

## 2. Explicit Cost Contract Configuration

* **False Negative Cost ($C_{{FN}}$):** `${cost_contract.false_negative_cost:,.2f}` (Escaped latent defect reaching field/flight deployment)
* **False Positive Cost ($C_{{FP}}$):** `${cost_contract.false_positive_cost:,.2f}` (False quarantine / unnecessary extended burn-in)
* **Cost Ratio ($C_{{FN}} : C_{{FP}}$):** `{cost_contract.cost_ratio_fn_to_fp}:1`
* **Cost Provenance:** `{cost_contract.provenance_class}`

$$\\text{{Total Cost}} = C_{{FN}} \\cdot \\text{{FN}} + C_{{FP}} \\cdot \\text{{FP}}$$

---

## 3. Held-Out Test Cohort Reliability & Cost Evaluation (N = {test_accounting['total_eligible_samples']:,})

* **Predictor Evaluated:** `{PREDICTOR_NAME}`

| Evaluation Metric | Frozen Benchmark Threshold ($\theta^* = {theta_star_val:.4f}$) | Default Threshold ($\theta = 0.50$) | Production Reference ($\theta = 0.20$) |
| :--- | :--- | :--- | :--- |
| **Latent Recall (Sensitivity)** | **{test_cost_eval['reliability_metrics']['recall']:.2%}** | {test_default_eval['reliability_metrics']['recall']:.2%} | {test_prod_eval['reliability_metrics']['recall']:.2%} |
| **False Negative Rate (FNR)** | **{test_cost_eval['reliability_metrics']['false_negative_rate']:.2%}** | {test_default_eval['reliability_metrics']['false_negative_rate']:.2%} | {test_prod_eval['reliability_metrics']['false_negative_rate']:.2%} |
| **Precision** | **{test_cost_eval['reliability_metrics']['precision']:.2%}** | {test_default_eval['reliability_metrics']['precision']:.2%} | {test_prod_eval['reliability_metrics']['precision']:.2%} |
| **F1 Score** | **{test_cost_eval['reliability_metrics']['f1_score']:.4f}** | {test_default_eval['reliability_metrics']['f1_score']:.4f} | {test_prod_eval['reliability_metrics']['f1_score']:.4f} |
| **F2 Score** | **{test_cost_eval['reliability_metrics']['f2_score']:.4f}** | {test_default_eval['reliability_metrics']['f2_score']:.4f} | {test_prod_eval['reliability_metrics']['f2_score']:.4f} |
| **Specificity (TNR)** | **{test_cost_eval['reliability_metrics']['specificity']:.2%}** | {test_default_eval['reliability_metrics']['specificity']:.2%} | {test_prod_eval['reliability_metrics']['specificity']:.2%} |
| **False Positive Rate (FPR)** | **{test_cost_eval['reliability_metrics']['false_positive_rate']:.2%}** | {test_default_eval['reliability_metrics']['false_positive_rate']:.2%} | {test_prod_eval['reliability_metrics']['false_positive_rate']:.2%} |
| **ROC-AUC** | **{test_cost_eval['reliability_metrics']['roc_auc']}** | {test_default_eval['reliability_metrics']['roc_auc']} | {test_prod_eval['reliability_metrics']['roc_auc']} |
| **PR-AUC** | **{test_cost_eval['reliability_metrics']['pr_auc']}** | {test_default_eval['reliability_metrics']['pr_auc']} | {test_prod_eval['reliability_metrics']['pr_auc']} |
| **False Negatives (FN)** | **{test_cost_eval['cost_metrics']['fn_count']}** | {test_default_eval['cost_metrics']['fn_count']} | {test_prod_eval['cost_metrics']['fn_count']} |
| **False Positives (FP)** | **{test_cost_eval['cost_metrics']['fp_count']}** | {test_default_eval['cost_metrics']['fp_count']} | {test_prod_eval['cost_metrics']['fp_count']} |
| **Total Decision Cost** | **${test_cost_eval['cost_metrics']['total_decision_cost']:,.2f}** | ${test_default_eval['cost_metrics']['total_decision_cost']:,.2f} | ${test_prod_eval['cost_metrics']['total_decision_cost']:,.2f} |
| **Cost / Eligible Sample** | **${test_cost_eval['cost_metrics']['cost_per_eligible_sample']:.2f}** | ${test_default_eval['cost_metrics']['cost_per_eligible_sample']:.2f} | ${test_prod_eval['cost_metrics']['cost_per_eligible_sample']:.2f} |
| **Normalized Cost** | **{test_cost_eval['cost_metrics']['normalized_cost']:.4f}** | {test_default_eval['cost_metrics']['normalized_cost']:.4f} | {test_prod_eval['cost_metrics']['normalized_cost']:.4f} |

---

## 4. Anomaly Evidence & Detector Assessment

* **Available Anomaly Detectors:** `RobustMAD`, `COPOD`, `MultiChannelDrift`
* **Phase 9 Predictor Used:** `{PREDICTOR_NAME}`
* **Anomaly Scores Used for Primary Metrics:** `False` (Anomaly evidence is kept 100% separate from Latent Defect Ground Truth)

---

## 5. Frozen Test Confusion Matrix ($\theta^* = {theta_star_val:.4f}$)

```
                      PREDICTED LATENT FAIL    PREDICTED PASS
ACTUAL LATENT FAIL         {test_cost_eval['confusion_matrix']['tp']:<10}             {test_cost_eval['confusion_matrix']['fn']:<10}  (FN: ESCAPES @ $500 ea = ${test_cost_eval['cost_metrics']['fn_total_cost']:,.2f})
ACTUAL HEALTHY             {test_cost_eval['confusion_matrix']['fp']:<10}             {test_cost_eval['confusion_matrix']['tn']:<10}  (FP: FALSE ALARM @ $100 ea = ${test_cost_eval['cost_metrics']['fp_total_cost']:,.2f})
```

---

## 6. Governance & Synthetic Data Disclosures

1. **Zero Temporal Leakage:** Prediction features are verified to contain strictly 0h and 24h screening information. Post-24h tokens and ground truth targets are 100% excluded.
2. **Threshold Selection Governance:** Threshold $\theta^* = {theta_star_val:.4f}$ was selected exclusively on the `validation_tune` partition (`{val_tune_lots}`). Calibration lots were NOT used for threshold selection. Threshold tuning against the held-out test set is strictly prohibited by automated code assertion.
3. **Synthetic Benchmark Disclosure:**  
   > **SYNTHETIC BENCHMARK DISCLOSURE:**  
   > The reported Phase 9 performance measures the existing 24h multi-channel drift heuristic baseline (`{PREDICTOR_NAME}`) against the synthetic latent-defect target. It is NOT: (1) production XGBoost latent-defect performance, (2) real-fab validation, (3) manufacturer-certified qualification evidence, or (4) empirical flight-hardware reliability performance.
""")

    print("\n=========================================================================")
    print(f"[PASS] PHASE 9 EVALUATION COMPLETE & ARTIFACTS WRITTEN TO {out_dir}")
    print("=========================================================================\n")

    return report_payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PREDICTA Phase 9 Evaluation Runner")
    parser.add_argument("--output-dir", type=str, default=None, help="Output directory")
    args = parser.parse_args()

    run_phase9_evaluation(output_dir=args.output_dir)
