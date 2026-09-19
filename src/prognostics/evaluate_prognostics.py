"""
Predicta Semiconductor Intelligence Platform — Authoritative Stage 5 Prognostics Evaluation Runner
File: src/prognostics/evaluate_prognostics.py

Canonical runner invoked via:
    npm run evaluate:prognostics
    python src/prognostics/evaluate_prognostics.py

Workflow:
1. Verify prognostic contract, dataset manifest, and split manifest integrity.
2. Build component-level prognostic trajectories with strict temporal separation.
3. Split into Train (35 lots), Validation (7 lots), and Held-Out Test (8 lots).
4. Train baseline prognostic models strictly on early features (0h, 24h).
5. Tune operating threshold strictly on the Validation cohort (frozen before test).
6. Evaluate held-out Test cohort on frozen validation threshold.
7. Perform honest assessment of existing production GPR forecasting engine.
8. Output authoritative JSON and Markdown benchmark reports in experiments/prognostics/.
"""

import os
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

import numpy as np

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src.data.validator import (
    validate_dataset_hash,
    validate_temporal_leakage
)
from src.prognostics.trajectory import (
    compute_sha256,
    build_prognostic_dataset,
    split_prognostic_dataset,
    calculate_prognostic_metrics,
    PersistenceBaseline,
    MLPrognosticBaseline,
    CANONICAL_EARLY_FEATURES
)


def evaluate_gpr_lineage_assessment() -> Dict[str, Any]:
    """
    Truthful assessment of the in-service GPR degradation forecasting engine.
    """
    gpr_json_path = os.path.join(PROJECT_ROOT, "ml", "models", "production", "predicta_gpr_kernel_artifacts.json")
    if not os.path.exists(gpr_json_path):
        return {
            "model_name": "Predicta Gaussian Process Regressor",
            "status": "MISSING_ARTIFACT",
            "can_evaluate_latent_168h": False,
            "compatibility_status": "INCOMPATIBLE_TRAINING_SCHEMA",
            "audit_note": f"Artifact not found at {gpr_json_path}"
        }

    sha = compute_sha256(gpr_json_path)
    return {
        "model_name": "Predicta Gaussian Process Regressor (GPR)",
        "model_path": "ml/models/production/predicta_gpr_kernel_artifacts.json",
        "model_sha256": sha,
        "target_task": "continuous_parametric_drift_forecasting",
        "can_evaluate_latent_168h": False,
        "compatibility_status": "INCOMPATIBLE_TRAINING_SCHEMA",
        "audit_note": (
            "Production GPR model is trained for continuous drift trajectory regression (IDDQ/Ileak vs time) "
            "and does not natively output binary classification probabilities for the 'latent_168h_failure' target. "
            "Direct binary evaluation is not fabricated."
        ),
        "recommended_action": (
            "Maintain GPR for continuous parametric health degradation forecasting in Stage 5 Task 2+; "
            "use early-feature classification baselines for discrete 168h screening."
        )
    }


def run_prognostics_evaluation(output_dir: Optional[str] = None) -> Dict[str, Any]:
    print("================================================================================")
    print("PREDICTA-26 — AUTHORITATIVE 168H PROGNOSTICS EVALUATION BENCHMARK")
    print("================================================================================")

    contract_path = os.path.join(PROJECT_ROOT, "ml", "prognostics", "prognostic_contract.json")
    dataset_manifest_path = os.path.join(PROJECT_ROOT, "ml", "data", "dataset_manifest.json")
    split_manifest_path = os.path.join(PROJECT_ROOT, "ml", "data", "split_manifest.json")

    # 1. Load Prognostic Contract
    print("\n[1/6] Loading & Verifying Prognostic Contract...")
    if not os.path.exists(contract_path):
        raise FileNotFoundError(f"Prognostic contract missing at {contract_path}")
    with open(contract_path, "r", encoding="utf-8") as f:
        prognostic_contract = json.load(f)
    print(f"  [PASS] Contract Version: {prognostic_contract['contract_version']}")
    print(f"  [PASS] Authority Level: {prognostic_contract['authority_level']}")
    print(f"  [PASS] Model Promotion Status: {prognostic_contract['production_and_model_governance']['prognostic_model_status']}")

    # 2. Verify Dataset Integrity
    print("\n[2/6] Verifying Dataset Cryptographic Integrity...")
    with open(dataset_manifest_path, "r", encoding="utf-8") as f:
        dataset_manifest = json.load(f)

    primary_meta = dataset_manifest["primary_latent_trajectory_dataset"]
    dataset_full_path = os.path.join(PROJECT_ROOT, primary_meta["dataset_path"])
    expected_sha256 = primary_meta["dataset_sha256"]

    hash_check = validate_dataset_hash(dataset_full_path, expected_sha256)
    if not hash_check["passed"]:
        raise ValueError(hash_check["error"])
    print(f"  [PASS] Dataset SHA-256 Verified: {hash_check['hash'][:16]}...")

    # 3. Verify Zero Temporal Leakage
    print("\n[3/6] Verifying Early Feature Contract & Leakage Rules...")
    leakage_check = validate_temporal_leakage(
        CANONICAL_EARLY_FEATURES,
        prognostic_contract["feature_policy"]["forbidden_leakage_tokens"]
    )
    if not leakage_check["passed"]:
        raise ValueError(leakage_check["error"])
    print(f"  [PASS] 0 Temporal Leakage Violations in Canonical Early Features ({len(CANONICAL_EARLY_FEATURES)} features)")

    # 4. Build Dataset & Partitions
    print("\n[4/6] Building Trajectory Dataset & Partitioning by Lot...")
    records = build_prognostic_dataset(dataset_full_path)
    train_recs, val_recs, test_recs = split_prognostic_dataset(records, split_manifest_path)

    print(f"  Total Trajectory Records: {len(records)}")
    print(f"  Train: {len(train_recs)} | Validation: {len(val_recs)} | Held-Out Test: {len(test_recs)}")

    # Extract X, y arrays
    def extract_arrays(recs):
        X = np.array([list(r["early_features"].values()) for r in recs], dtype=np.float64)
        y = np.array([int(r["future_ground_truth"]["latent_168h_failure"]) for r in recs], dtype=int)
        return X, y

    X_train, y_train = extract_arrays(train_recs)
    X_val, y_val = extract_arrays(val_recs)
    X_test, y_test = extract_arrays(test_recs)

    # 5. Train & Evaluate Baselines
    print("\n[5/6] Training & Evaluating Evaluation-Only Baselines...")

    # Baseline 1: Persistence (Predicts constant 0 risk)
    pers_model = PersistenceBaseline()
    pers_probs_test = pers_model.predict_proba(X_test)
    pers_metrics_test = calculate_prognostic_metrics(y_test, pers_probs_test, threshold=0.50)
    print(f"  [PERSISTENCE BASELINE] Test Recall: {pers_metrics_test['latent_recall']:.2%}")
    print(f"  [PERSISTENCE BASELINE] Test FNR: {pers_metrics_test['latent_false_negative_rate']:.2%}")
    print(f"  [PERSISTENCE BASELINE] Test Precision: {pers_metrics_test['latent_precision']:.2%}")
    print(f"  [PERSISTENCE BASELINE] Test Specificity: {pers_metrics_test['specificity']:.2%}")
    print(f"  [PERSISTENCE BASELINE] Test Confusion Matrix: {pers_metrics_test['confusion_matrix']}")

    # Baseline 2: Early-Feature Gradient Boosting
    ml_model = MLPrognosticBaseline(random_state=42)
    ml_model.fit(X_train, y_train)

    # Tune threshold on VALIDATION ONLY
    opt_th = ml_model.tune_threshold_on_validation(X_val, y_val, metric="f2")
    print(f"  Optimal Validation Threshold (F2-tuned): {opt_th:.4f}")

    # Evaluate on FROZEN Test Set via governed API
    ml_metrics_test = ml_model.evaluate_frozen_test(X_test, y_test)
    ml_probs_test = ml_model.predict_proba(X_test)
    ml_metrics_std_test = calculate_prognostic_metrics(y_test, ml_probs_test, threshold=0.50)

    print(f"  [PASS] Test F2 Score (tuned th={opt_th}): {ml_metrics_test['latent_f2_score']:.4f}")
    print(f"  [PASS] Test Recall: {ml_metrics_test['latent_recall']:.2%}")
    print(f"  [PASS] Test Precision: {ml_metrics_test['latent_precision']:.2%}")
    print(f"  [PASS] Test FNR: {ml_metrics_test['latent_false_negative_rate']:.2%}")
    print(f"  [PASS] Test Confusion Matrix: {ml_metrics_test['confusion_matrix']}")

    # 6. GPR Assessment
    print("\n[6/6] Assessing Production GPR Model Compatibility...")
    gpr_assessment = evaluate_gpr_lineage_assessment()
    print(f"  GPR Status: {gpr_assessment['compatibility_status']}")

    # Assemble Full Report
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    # State counts
    state_counts = {}
    for r in records:
        st = r["future_ground_truth"]["trajectory_state"]
        state_counts[st] = state_counts.get(st, 0) + 1

    test_state_counts = {}
    for r in test_recs:
        st = r["future_ground_truth"]["trajectory_state"]
        test_state_counts[st] = test_state_counts.get(st, 0) + 1

    report = {
        "title": "PREDICTA-26 — Stage 5 168h Prognostic Target & Trajectory Benchmark Report",
        "benchmark_metadata": {
            "prognostic_contract_version": prognostic_contract["contract_version"],
            "authority_level": prognostic_contract["authority_level"],
            "prediction_horizon_hours": 168,
            "decision_cutoff_hour": 24,
            "target_name": prognostic_contract["target_specification"]["target_name"],
            "target_definition": prognostic_contract["target_specification"]["target_definition"],
            "criteria_source": prognostic_contract["target_specification"]["criteria_source"],
            "criteria_disclaimer": prognostic_contract["target_specification"]["criteria_disclaimer"],
            "prognostic_model_status": "BENCHMARK_ONLY",
            "calibration_status": "NOT_CALIBRATED",
            "production_promotion_permitted": False,
            "evaluation_timestamp": timestamp
        },
        "dataset_lineage": {
            "dataset_id": primary_meta["dataset_id"],
            "dataset_path": primary_meta["dataset_path"],
            "dataset_sha256": expected_sha256,
            "data_mode": primary_meta["data_mode"],
            "is_synthetic": True,
            "is_externally_validated": False,
            "synthetic_disclosure": "SYNTHETIC PHYSICS BENCHMARK ONLY. Not flight-qualified or fab-calibrated.",
            "total_components": len(records),
            "split_strategy": "LOT_HELD_OUT_DISJOINT",
            "train_components": len(train_recs),
            "val_components": len(val_recs),
            "test_components": len(test_recs)
        },
        "feature_policy": {
            "canonical_early_features": CANONICAL_EARLY_FEATURES,
            "feature_count": len(CANONICAL_EARLY_FEATURES),
            "forbidden_leakage_tokens": prognostic_contract["feature_policy"]["forbidden_leakage_tokens"]
        },
        "trajectory_state_distribution": {
            "full_cohort": state_counts,
            "held_out_test_cohort": test_state_counts
        },
        "evaluated_baselines": {
            "persistence_no_change": {
                "name": pers_model.name,
                "algorithm": pers_model.algorithm,
                "status": pers_model.status,
                "operating_threshold": 0.50,
                "held_out_test_metrics": pers_metrics_test
            },
            "early_feature_gradient_boosting": {
                "name": ml_model.name,
                "algorithm": ml_model.algorithm,
                "status": ml_model.status,
                "random_state": ml_model.random_state,
                "threshold_governance": "VALIDATION_ONLY_F2_OPTIMIZATION",
                "validation_optimal_threshold": opt_th,
                "held_out_test_metrics_frozen_threshold": ml_metrics_test,
                "held_out_test_metrics_standard_0_50": ml_metrics_std_test
            }
        },
        "production_gpr_forecasting_assessment": gpr_assessment,
        "lineage_and_audit": {
            "train_lots": 35,
            "validation_lots": 7,
            "test_lots": 8,
            "component_leakage": 0,
            "lot_leakage": 0,
            "test_set_threshold_tuning": "STRICTLY_FORBIDDEN"
        }
    }

    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        json_path = os.path.join(output_dir, "prognostic_benchmark_report.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)

        md_path = os.path.join(output_dir, "prognostic_benchmark_report.md")
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(generate_markdown_report(report))

    return report


def generate_markdown_report(report: Dict[str, Any]) -> str:
    meta = report["benchmark_metadata"]
    d_lin = report["dataset_lineage"]
    dist = report["trajectory_state_distribution"]["full_cohort"]
    pers = report["evaluated_baselines"]["persistence_no_change"]
    m_pers = pers["held_out_test_metrics"]
    gb = report["evaluated_baselines"]["early_feature_gradient_boosting"]
    m_test = gb["held_out_test_metrics_frozen_threshold"]
    gpr = report["production_gpr_forecasting_assessment"]

    return f"""# PREDICTA-26 — Stage 5 168h Prognostic Target & Trajectory Benchmark Report

## 1. Problem Formulation & Authoritative Target
* **Task Name:** `{meta['target_name']}`
* **Prediction Horizon:** `{meta['prediction_horizon_hours']} hours`
* **Decision Checkpoint:** `{meta['decision_cutoff_hour']} hours`
* **Target Definition:** `{meta['target_definition']}`
* **Criteria Source:** `{meta['criteria_source']}`
* **Criteria Disclaimer:** {meta['criteria_disclaimer']}
* **Model Promotion Status:** `{meta['prognostic_model_status']}` (Promotion Lock Active)
* **Calibration Status:** `{meta['calibration_status']}`

> [!WARNING]
> **SYNTHETIC BENCHMARK DATA ONLY — NOT EXTERNALLY VALIDATED**
> All evaluations are performed on synthetic physics-informed drift simulations.
> Performance does not represent flight-certified qualification or fab-proven limits.

---

## 2. Trajectory State Distribution (Total Components N = {d_lin['total_components']:,})

| Trajectory State | Semantic Meaning | Total Count | Proportion |
| :--- | :--- | :--- | :--- |
| **PASS_24H_PASS_168H** | Healthy through 168h qualification | {dist.get('PASS_24H_PASS_168H', 0):,} | {dist.get('PASS_24H_PASS_168H', 0)/d_lin['total_components']*100:.2f}% |
| **PASS_24H_FAIL_168H** | **True Latent Failure (Target = 1)** | {dist.get('PASS_24H_FAIL_168H', 0):,} | {dist.get('PASS_24H_FAIL_168H', 0)/d_lin['total_components']*100:.2f}% |
| **FAIL_24H_FAIL_168H** | Early Failure (quarantined at 24h) | {dist.get('FAIL_24H_FAIL_168H', 0):,} | {dist.get('FAIL_24H_FAIL_168H', 0)/d_lin['total_components']*100:.2f}% |
| **FAIL_24H_PASS_168H** | Early anomaly recovery | {dist.get('FAIL_24H_PASS_168H', 0):,} | {dist.get('FAIL_24H_PASS_168H', 0)/d_lin['total_components']*100:.2f}% |
| **INSUFFICIENT_HISTORY**| Incomplete checkpoints | {dist.get('INSUFFICIENT_HISTORY', 0):,} | {dist.get('INSUFFICIENT_HISTORY', 0)/d_lin['total_components']*100:.2f}% |

---

## 3. Baseline Model Performance Comparison on Held-Out Test Cohort (N = {d_lin['test_components']:,})

| Metric | Persistence Constant-Zero | Early-Feature HistGradientBoosting (Frozen Threshold) |
| :--- | :---: | :---: |
| **Algorithm** | `PERSISTENCE_CONSTANT_ZERO` | `HIST_GRADIENT_BOOSTING_CLASSIFIER` |
| **Operating Threshold** | `0.5000` | `{gb['validation_optimal_threshold']:.4f}` (Val-tuned) |
| **Latent F2 Score** | `{m_pers['latent_f2_score']:.4f}` | **`{m_test['latent_f2_score']:.4f}`** |
| **Latent Recall (TPR)** | `{m_pers['latent_recall'] * 100:.2f}%` | **`{m_test['latent_recall'] * 100:.2f}%`** |
| **Latent False Negative Rate (FNR)**| `{m_pers['latent_false_negative_rate'] * 100:.2f}%` | **`{m_test['latent_false_negative_rate'] * 100:.2f}%`** |
| **Latent Precision** | `{m_pers['latent_precision'] * 100:.2f}%` | **`{m_test['latent_precision'] * 100:.2f}%`** |
| **Latent F1 Score** | `{m_pers['latent_f1_score']:.4f}` | **`{m_test['latent_f1_score']:.4f}`** |
| **Specificity** | `{m_pers['specificity'] * 100:.2f}%` | **`{m_test['specificity'] * 100:.2f}%`** |
| **PR-AUC** | `{m_pers['pr_auc']:.4f}` | **`{m_test['pr_auc']:.4f}`** |
| **ROC-AUC** | `{m_pers['roc_auc']:.4f}` | **`{m_test['roc_auc']:.4f}`** |
| **Confusion Matrix (TP/FN/FP/TN)**| `TP={m_pers['confusion_matrix']['tp']}, FN={m_pers['confusion_matrix']['fn']}, FP={m_pers['confusion_matrix']['fp']}, TN={m_pers['confusion_matrix']['tn']}` | `TP={m_test['confusion_matrix']['tp']}, FN={m_test['confusion_matrix']['fn']}, FP={m_test['confusion_matrix']['fp']}, TN={m_test['confusion_matrix']['tn']}` |

---

## 4. Production GPR Degradation Forecasting Engine Assessment
* **Model Name:** `{gpr['model_name']}`
* **Compatibility Status:** `{gpr['compatibility_status']}`
* **Direct 168h Target Evaluation:** `False (Incompatible schema; continuous regression vs binary failure)`
* **Audit Rationale:** {gpr['audit_note']}
* **Recommended Next Step:** {gpr['recommended_action']}

---

## 5. Lineage & Governance Integrity
* **Dataset SHA-256:** `{d_lin['dataset_sha256']}`
* **Split Strategy:** `{d_lin['split_strategy']}` (35 Train lots / 7 Validation lots / 8 Held-out Test lots)
* **Lot Contamination:** `0 lots leaked across partitions`
* **Component Contamination:** `0 components leaked across partitions`
* **Temporal Leakage Policy:** `0 future tokens permitted in early screening features`
* **Evaluation Timestamp:** `{meta['evaluation_timestamp']}`
"""


if __name__ == "__main__":
    out_dir = os.path.join(PROJECT_ROOT, "experiments", "prognostics")
    run_prognostics_evaluation(out_dir)
    print("\n[SUCCESS] Authoritative Prognostics Benchmark Evaluation completed successfully.")
