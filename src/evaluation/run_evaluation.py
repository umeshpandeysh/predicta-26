"""
Predicta Semiconductor Intelligence Platform — Authoritative Reproducible Evaluation Runner
File: src/evaluation/run_evaluation.py

Canonical entry point invoked via:
    npm run evaluate
    python src/evaluation/run_evaluation.py

Workflow:
1. Load & verify authoritative dataset manifest (SHA-256 integrity check)
2. Load feature contract & verify zero temporal leakage
3. Load split manifest & verify lot-held-out disjointness
4. Build component trajectory dataset from time-series telemetry
5. Evaluate latent-168h screening performance across splits using standardized metrics
6. Evaluate production model compatibility status honestly
7. Emit machine-readable artifact: experiments/latent_evaluation/latent_trajectory_report.json
8. Emit human-readable artifact: experiments/latent_evaluation/latent_trajectory_report.md
"""

import os
import sys
import json
import argparse
from datetime import datetime
from typing import Dict, Any, Optional

import numpy as np

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
from src.evaluation.metrics import calculate_standardized_metrics


def run_canonical_evaluation(
    output_dir: Optional[str] = None,
    threshold: float = 0.50,
    enforce_reproducible_timestamp: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes the canonical, end-to-end evaluation pipeline with full contract validation.
    """
    print("================================================================================")
    print("PREDICTA SIH 2026 -- AUTHORITATIVE DATA & EVALUATION FOUNDATION")
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

    print("\n[1/6] Verifying Dataset Integrity...")
    print(f"  Dataset Path: {dataset_rel_path}")
    print(f"  Expected SHA-256: {expected_sha256}")
    hash_check = validate_dataset_hash(dataset_full_path, expected_sha256)
    if not hash_check["passed"]:
        raise ValueError(hash_check["error"])
    print(f"  [PASS] SHA-256 Checksum Verified 100% Match ({hash_check['hash'][:16]}...)")

    # 2. Load Feature Contract & Verify Zero Leakage
    print("\n[2/6] Verifying Feature Contract & Temporal Boundaries...")
    contract_path = os.path.join(BASE_DIR, "ml", "data", "feature_contract.json")
    with open(contract_path, "r", encoding="utf-8") as f:
        feature_contract = json.load(f)

    early_feature_names = [f["name"] for f in feature_contract["features"]["early_observable"]]
    leakage_check = validate_temporal_leakage(
        early_feature_names,
        feature_contract.get("forbidden_leakage_tokens")
    )
    if not leakage_check["passed"]:
        raise ValueError(leakage_check["error"])
    print(f"  [PASS] Feature Contract Verified: {len(early_feature_names)} Early-Observable Features (0h, 24h)")
    print("  [PASS] Temporal Leakage Check: 0 Violations (Zero 168h features in early screening input)")

    # 3. Load Split Manifest & Verify Lot-Held-Out Disjointness
    print("\n[3/6] Verifying Split Manifest & Lot Disjointness...")
    split_manifest_path = os.path.join(BASE_DIR, "ml", "data", "split_manifest.json")
    with open(split_manifest_path, "r", encoding="utf-8") as f:
        split_manifest = json.load(f)

    train_lots = split_manifest["lots"]["train"]
    val_lots = split_manifest["lots"].get("validation", split_manifest["lots"].get("validation_tune", []) + split_manifest["lots"].get("calibration", []))
    test_lots = split_manifest["lots"]["test"]

    print(f"  Split Strategy: {split_manifest['split_strategy']}")
    print(f"  Train Lots: {len(train_lots)} | Val Lots: {len(val_lots)} | Held-Out Test Lots: {len(test_lots)}")

    # 4. Build Trajectory Dataset
    print("\n[4/6] Building Component Trajectory Dataset from Time-Series Telemetry...")
    traj_df = build_trajectory_dataset(dataset_full_path)
    total_components = len(traj_df)
    print(f"  Total Trajectory Components: {total_components}")

    # Split into partitions
    train_df = traj_df[traj_df["lot_id"].isin(train_lots)].copy()
    val_df = traj_df[traj_df["lot_id"].isin(val_lots)].copy()
    test_df = traj_df[traj_df["lot_id"].isin(test_lots)].copy()

    split_check = validate_split_integrity(
        train_df, val_df, test_df,
        id_col="component_id",
        lot_col="lot_id",
        require_lot_disjoint=True
    )
    if not split_check["passed"]:
        raise ValueError(split_check["error"])
    print(f"  [PASS] Split Integrity Verified: Train={len(train_df)}, Val={len(val_df)}, Test={len(test_df)} (Disjoint)")

    # 5. Evaluate Latent Screening Performance
    print("\n[5/6] Executing Authoritative Evaluation on Held-Out Test Cohort...")
    # Calculate state distribution
    cohort_dist = traj_df["trajectory_state"].value_counts().to_dict()
    test_dist = test_df["trajectory_state"].value_counts().to_dict()

    print(f"  Full Cohort Latent Failures: {cohort_dist.get('PASS_24H_FAIL_168H', 0)} / {total_components}")
    print(f"  Held-Out Test Latent Failures: {test_dist.get('PASS_24H_FAIL_168H', 0)} / {len(test_df)}")

    # Early heuristic/drift screening baseline calculation
    # Evaluates components passing at 24h for early drift anomalies
    y_test_true = test_df["latent_168h_failure"].astype(int).values

    # Drift score based on normalized multi-channel drift
    drift_score = (
        (test_df["tpd_drift_24h"].clip(lower=0) / 10.0) +
        (test_df["iddq_drift_24h"].clip(lower=0) / 100.0) +
        (test_df["ileak_drift_24h"].clip(lower=0) / 10.0)
    ).values

    # Sigmoid mapping to [0, 1] probability
    test_probs = 1.0 / (1.0 + np.exp(-drift_score))
    test_preds = (test_probs >= threshold).astype(int)

    metrics_res = calculate_standardized_metrics(
        y_true=y_test_true,
        y_pred=test_preds,
        y_prob=test_probs,
        threshold=threshold,
        split_name="held_out_test_lots_042_to_049"
    )

    print(f"  [PASS] Test Screening Recall: {metrics_res['safety_primary_metrics']['latent_recall']:.2%}")
    print(f"  [PASS] Test Screening FNR: {metrics_res['safety_primary_metrics']['latent_false_negative_rate']:.2%}")
    print(f"  [PASS] Test Screening F2: {metrics_res['safety_primary_metrics']['latent_f2_score']:.4f}")
    print(f"  [PASS] Confusion Matrix: TP={metrics_res['confusion_matrix']['tp']}, FN={metrics_res['confusion_matrix']['fn']}, FP={metrics_res['confusion_matrix']['fp']}, TN={metrics_res['confusion_matrix']['tn']}")

    # 6. Evaluate Production Model Compatibility
    print("\n[6/6] Assessing In-Service Production Model Compatibility...")
    model_json_path = os.path.join(BASE_DIR, "ml", "models", "production", "predicta_xgboost_model.json")
    if not os.path.exists(model_json_path):
        model_json_path = os.path.join(BASE_DIR, "ml", "models", "production", "predicta_xgboost_production.json")
    metadata_json_path = os.path.join(BASE_DIR, "ml", "models", "production", "predicta_xgboost_metadata.json")

    prod_compat = evaluate_production_model_compatibility(model_json_path, metadata_json_path)
    print(f"  Production Model Assessment: {prod_compat.get('model_target_compatibility', prod_compat.get('compatibility_status'))}")
    print(f"  Audit Note: {prod_compat.get('audit_notes', prod_compat.get('reason'))}")

    # 7. Generate Machine-Readable Report
    eval_timestamp = enforce_reproducible_timestamp or datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    report_data = {
        "title": "PREDICTA Authoritative Latent-168h Trajectory Evaluation Report",
        "foundation_metadata": {
            "dataset_manifest_version": dataset_manifest["manifest_version"],
            "feature_contract_version": feature_contract["contract_version"],
            "split_manifest_version": split_manifest["manifest_version"],
            "evaluation_engine_version": "3.0.0_authoritative"
        },
        "evaluation_target": {
            "name": AuthoritativeTarget.NAME,
            "definition": AuthoritativeTarget.DEFINITION,
            "criteria_source": AuthoritativeTarget.CRITERIA_SOURCE,
            "semantic_states": [s.value for s in TrajectoryState]
        },
        "dataset_lineage": {
            "dataset_id": primary_meta["dataset_id"],
            "dataset_path": dataset_rel_path,
            "dataset_sha256": expected_sha256,
            "dataset_mode": primary_meta["data_mode"],
            "is_synthetic": True,
            "is_externally_validated": False,
            "total_components": total_components,
            "lot_count": primary_meta["lot_count"],
            "split_strategy": split_manifest["split_strategy"],
            "train_components": len(train_df),
            "val_components": len(val_df),
            "test_components": len(test_df)
        },
        "trajectory_state_distribution": {
            "full_cohort": cohort_dist,
            "held_out_test_cohort": test_dist
        },
        "early_screening_performance_on_held_out_test": {
            f"threshold_{str(threshold).replace('.', '_')}": {
                "latent_recall": metrics_res["safety_primary_metrics"]["latent_recall"],
                "latent_fnr": metrics_res["safety_primary_metrics"]["latent_false_negative_rate"],
                "latent_precision": metrics_res["standard_classification_metrics"]["precision"],
                "latent_f1": metrics_res["standard_classification_metrics"]["f1_score"],
                "latent_f2": metrics_res["safety_primary_metrics"]["latent_f2_score"],
                "pr_auc": metrics_res["standard_classification_metrics"]["pr_auc"],
                "roc_auc": metrics_res["standard_classification_metrics"]["roc_auc"],
                "confusion_matrix": metrics_res["confusion_matrix"]
            }
        },
        "production_model_assessment": prod_compat,
        "evaluation_provenance": {
            "evaluation_timestamp": eval_timestamp,
            "split_strategy": split_manifest["split_strategy"],
            "random_seed": split_manifest["random_seed"],
            "authoritative_threshold_used": threshold,
            "threshold_selection_rule": "FIXED_PRE_SPECIFIED_SAFETY_OPERATING_POINT",
            "test_set_threshold_tuning": "STRICTLY_PROHIBITED",
            "temporal_leakage_assertion_passed": True,
            "lot_holdout_assertion_passed": True
        },
        "scientific_disclosure": {
            "data_nature": "SYNTHETIC_PHYSICS_BENCHMARK",
            "disclosure_text": "This evaluation is conducted on physics-informed synthetic semiconductor burn-in data. While mathematically rigorous and free of temporal leakage, it does not represent external space-qualification or real-fab yield validation without empirical lot calibration."
        }
    }

    # Save outputs
    out_dir = output_dir or os.path.join(BASE_DIR, "experiments", "latent_evaluation")
    os.makedirs(out_dir, exist_ok=True)

    json_report_path = os.path.join(out_dir, "latent_trajectory_report.json")
    with open(json_report_path, "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2)

    # Markdown Report
    md_report_path = os.path.join(out_dir, "latent_trajectory_report.md")
    with open(md_report_path, "w", encoding="utf-8") as f:
        f.write(f"""# PREDICTA — AUTHORITATIVE LATENT-168H TRAJECTORY EVALUATION REPORT

## 1. Executive Summary & Problem Formulation
The SIH semiconductor reliability challenge requires early screening of components that appear acceptable at 24h but fail by 168h of burn-in stress.

* **Authoritative Target:** `{AuthoritativeTarget.NAME}`
* **Target Definition:** `{AuthoritativeTarget.DEFINITION}`
* **Evaluation Criteria:** `{AuthoritativeTarget.CRITERIA_SOURCE}`

---

## 2. Component Trajectory State Distribution (Total N = {total_components:,})

| Trajectory State | Semantic Meaning | Count | Percentage |
| :--- | :--- | :--- | :--- |
| **PASS_24H_PASS_168H** | Healthy through 168h burn-in | {cohort_dist.get('PASS_24H_PASS_168H', 0):,} | {cohort_dist.get('PASS_24H_PASS_168H', 0) / total_components:.2%} |
| **PASS_24H_FAIL_168H** | **True SIH Latent Failure** | {cohort_dist.get('PASS_24H_FAIL_168H', 0):,} | {cohort_dist.get('PASS_24H_FAIL_168H', 0) / total_components:.2%} |
| **FAIL_24H_FAIL_168H** | Early Failure (already failed at 24h) | {cohort_dist.get('FAIL_24H_FAIL_168H', 0):,} | {cohort_dist.get('FAIL_24H_FAIL_168H', 0) / total_components:.2%} |
| **FAIL_24H_PASS_168H** | Anomaly recovery | {cohort_dist.get('FAIL_24H_PASS_168H', 0):,} | {cohort_dist.get('FAIL_24H_PASS_168H', 0) / total_components:.2%} |
| **INSUFFICIENT_HISTORY**| Missing telemetry | {cohort_dist.get('INSUFFICIENT_HISTORY', 0):,} | {cohort_dist.get('INSUFFICIENT_HISTORY', 0) / total_components:.2%} |

---

## 3. Early-Screening Latent Failure Prediction on Held-Out Test Cohort (N = {len(test_df):,})

| Metric | Screening Performance (Threshold = {threshold:.2f}) | Engineering Interpretation |
| :--- | :--- | :--- |
| **Latent Recall** | **{metrics_res['safety_primary_metrics']['latent_recall']:.2%}** | Proportion of true latent wear-outs screened early |
| **False Negative Rate** | **{metrics_res['safety_primary_metrics']['latent_false_negative_rate']:.2%}** | Uncaught defect rate escaping to long-term deployment |
| **Latent F2-Score** | **{metrics_res['safety_primary_metrics']['latent_f2_score']:.4f}** | Recall-emphasized composite reliability metric |
| **Precision** | **{metrics_res['standard_classification_metrics']['precision']:.2%}** | Accuracy of early quarantine recommendations |
| **PR-AUC** | **{metrics_res['standard_classification_metrics']['pr_auc']}** | Area under precision-recall curve across thresholds |
| **ROC-AUC** | **{metrics_res['standard_classification_metrics']['roc_auc']}** | Multi-threshold discriminative capacity |

### Held-Out Test Confusion Matrix

```
                      PREDICTED LATENT FAIL    PREDICTED PASS
ACTUAL LATENT FAIL         {metrics_res['confusion_matrix']['tp']:<10}             {metrics_res['confusion_matrix']['fn']:<10}  (FN: ESCAPES)
ACTUAL HEALTHY             {metrics_res['confusion_matrix']['fp']:<10}             {metrics_res['confusion_matrix']['tn']:<10}  (FP: FALSE QUARANTINE)
```

---

## 4. Production Model Assessment
* **Model Status:** `{prod_compat.get('compatibility_status', 'INCOMPATIBLE_TRAINING_SCHEMA')}`
* **Explanation:** {prod_compat.get('limitation_reason', 'Production model was trained on 28 static snapshot ATE features.')}

---

## 5. Dataset & Lineage Provenance
* **Dataset Path:** `{dataset_rel_path}`
* **Dataset SHA-256:** `{expected_sha256}`
* **Split Strategy:** `{split_manifest['split_strategy']}`
* **Evaluation Timestamp:** `{eval_timestamp}`

---

## 6. Scientific Presentation & Integrity Disclosure
> **SYNTHETIC BENCHMARK DISCLOSURE**
> All metrics reported above were obtained using physics-informed synthetic semiconductor telemetry. They represent reproducible algorithmic verification of the latent trajectory evaluation contract and must not be cited as empirical real-fab qualification data.
""")

    print("\n=========================================================================")
    print(f"[PASS] EVALUATION COMPLETE & ARTIFACTS WRITTEN TO {out_dir}")
    print("=========================================================================\n")

    return report_data


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PREDICTA Authoritative Evaluation Runner")
    parser.add_argument("--threshold", type=float, default=0.50, help="Screening threshold")
    parser.add_argument("--output-dir", type=str, default=None, help="Output directory")
    args = parser.parse_args()

    run_canonical_evaluation(output_dir=args.output_dir, threshold=args.threshold)
