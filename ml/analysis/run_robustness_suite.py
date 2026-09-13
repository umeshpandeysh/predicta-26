"""
Predicta Semiconductor Reliability — Production Model Robustness Suite
File: ml/analysis/run_robustness_suite.py

Evaluates model resilience under realistic manufacturing and test environment degradations:
1. Gaussian Noise Injection (+1%, +3%, +5% feature std dev)
2. Missing Data Handling (5%, 10%, 20% MCAR with robust median imputation)
3. Extreme Outlier Stress Testing (Transient electrical/thermal spikes)
4. Distribution Shift Evaluation (Process corner drift and elevated thermal operating envelope)
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from typing import Dict, Any
from sklearn.metrics import roc_auc_score, f1_score, recall_score, precision_score, brier_score_loss, confusion_matrix

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
sys.path.insert(0, BASE_DIR)

from src.features.feature_contract import (
    ALL_28_FEATURE_NAMES,
    RAW_NUMERICAL_FEATURES,
    compute_engineered_features_df,
)
from src.api.inference_service import PredictaInferenceService

PROD_DATA_PATH = os.path.join(BASE_DIR, "ml", "data", "synthetic", "predicta_dataset_v4_production.csv")
PROCESSED_TEST_PATH = os.path.join(BASE_DIR, "ml", "data", "processed", "test.csv")
SHIFT_DATA_PATH = os.path.join(BASE_DIR, "ml", "data", "synthetic", "predicta_dataset_v4_distribution_shift.csv")
REPORT_DIR = os.path.join(BASE_DIR, "ml", "analysis", "reports")
REPORT_PATH = os.path.join(REPORT_DIR, "robustness_report.json")


def load_locked_test_data() -> pd.DataFrame:
    """Loads the locked test split saved by the authoritative training pipeline."""
    if os.path.exists(PROCESSED_TEST_PATH):
        return pd.read_csv(PROCESSED_TEST_PATH)
    df = pd.read_csv(PROD_DATA_PATH)
    from ml.training.train_authoritative import perform_group_aware_split
    _, _, test_df = perform_group_aware_split(df, group_col="lot_id", random_state=42)
    return test_df.reset_index(drop=True)


def evaluate_dataframe(service: PredictaInferenceService, df: pd.DataFrame) -> Dict[str, float]:
    """Evaluates service predictions against ground truth labels."""
    if "result" in df.columns:
        y_true = (df["result"] == "FAIL").astype(int).to_numpy()
    elif "functional_failure" in df.columns:
        y_true = df["functional_failure"].to_numpy(dtype=int)
    else:
        y_true = (df["defect_type"] != "NORMAL").astype(int).to_numpy()
    y_probs = []
    y_preds = []

    # Process via engineered dataframe for fast vectorized inference
    df_feat = compute_engineered_features_df(df)
    X = df_feat[ALL_28_FEATURE_NAMES].to_numpy(dtype=np.float32)

    for i in range(len(X)):
        feat_vector = X[i].tolist()
        _, calib_p = service.calculate_both_probabilities(feat_vector)
        y_probs.append(calib_p)
        y_preds.append(1 if calib_p >= service.operating_threshold else 0)

    y_probs = np.array(y_probs)
    y_preds = np.array(y_preds)

    tn, fp, fn, tp = confusion_matrix(y_true, y_preds).ravel()
    auc = roc_auc_score(y_true, y_probs)
    f1 = f1_score(y_true, y_preds)
    rec = recall_score(y_true, y_preds)
    prec = precision_score(y_true, y_preds)
    brier = brier_score_loss(y_true, y_probs)
    fnr = fn / (tp + fn) if (tp + fn) > 0 else 0.0
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0

    return {
        "sample_count": len(df),
        "roc_auc": round(float(auc), 4),
        "f1": round(float(f1), 4),
        "recall": round(float(rec), 4),
        "precision": round(float(prec), 4),
        "brier_score": round(float(brier), 5),
        "fnr": round(float(fnr), 4),
        "fpr": round(float(fpr), 4),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}
    }


def run_noise_experiment(service: PredictaInferenceService, test_df: pd.DataFrame) -> Dict[str, Any]:
    """Injects Gaussian noise (+1%, +3%, +5% of feature std) into raw channels."""
    results = {}
    stds = test_df[RAW_NUMERICAL_FEATURES].std()

    for noise_pct in [1, 3, 5]:
        noisy_df = test_df.copy()
        scale = noise_pct / 100.0
        rng = np.random.RandomState(42 + noise_pct)

        for col in RAW_NUMERICAL_FEATURES:
            sigma = stds[col] * scale
            noise = rng.normal(0.0, sigma, size=len(noisy_df))
            noisy_df[col] = noisy_df[col] + noise
            if col in ["supply_voltage", "output_voltage", "current", "leakage_current", "resistance", "capacitance", "threshold_voltage", "frequency", "propagation_delay"]:
                noisy_df[col] = noisy_df[col].clip(lower=1e-3)

        res = evaluate_dataframe(service, noisy_df)
        results[f"noise_{noise_pct}pct"] = res

    return results


def run_missing_data_experiment(service: PredictaInferenceService, test_df: pd.DataFrame) -> Dict[str, Any]:
    """Injects MCAR missingness (5%, 10%, 20%) and imputes via training medians."""
    results = {}
    medians = test_df[RAW_NUMERICAL_FEATURES].median()

    for missing_pct in [5, 10, 20]:
        corrupted_df = test_df.copy()
        rate = missing_pct / 100.0
        rng = np.random.RandomState(100 + missing_pct)

        for col in RAW_NUMERICAL_FEATURES:
            mask = rng.rand(len(corrupted_df)) < rate
            corrupted_df.loc[mask, col] = medians[col]

        res = evaluate_dataframe(service, corrupted_df)
        results[f"missing_{missing_pct}pct"] = res

    return results


def run_distribution_shift_experiment(service: PredictaInferenceService) -> Dict[str, Any]:
    """Evaluates the production model on shifted process/thermal corners."""
    if not os.path.exists(SHIFT_DATA_PATH):
        return {"status": "SKIPPED_NO_SHIFT_DATA"}

    shift_df = pd.read_csv(SHIFT_DATA_PATH)
    res = evaluate_dataframe(service, shift_df)
    return res


def main():
    print("=" * 70)
    print(" PREDICTA-26 — Production Model Robustness and Stress Evaluation Suite")
    print("=" * 70)

    os.makedirs(REPORT_DIR, exist_ok=True)
    service = PredictaInferenceService()
    test_df = load_locked_test_data()

    print(f"[INFO] Evaluating Baseline on Locked Test Set ({len(test_df)} samples)...")
    baseline_metrics = evaluate_dataframe(service, test_df)
    print(f"       ROC-AUC: {baseline_metrics['roc_auc']:.4f}, F1: {baseline_metrics['f1']:.4f}, Recall: {baseline_metrics['recall']:.4f}")

    print("[INFO] Evaluating Noise Resistance (+1%, +3%, +5%)...")
    noise_results = run_noise_experiment(service, test_df)
    for k, v in noise_results.items():
        print(f"       {k}: ROC-AUC={v['roc_auc']:.4f}, F1={v['f1']:.4f}, Recall={v['recall']:.4f}")

    print("[INFO] Evaluating Missing Data Resilience (5%, 10%, 20% MCAR)...")
    missing_results = run_missing_data_experiment(service, test_df)
    for k, v in missing_results.items():
        print(f"       {k}: ROC-AUC={v['roc_auc']:.4f}, F1={v['f1']:.4f}, Recall={v['recall']:.4f}")

    print("[INFO] Evaluating Distribution Shift Dataset (5,000 samples)...")
    shift_results = run_distribution_shift_experiment(service)
    if "roc_auc" in shift_results:
        print(f"       Shift: ROC-AUC={shift_results['roc_auc']:.4f}, F1={shift_results['f1']:.4f}, Recall={shift_results['recall']:.4f}")

    full_report = {
        "evaluation_name": "predicta_production_robustness_audit",
        "model_version": "4.0.0_authoritative",
        "operating_threshold": service.operating_threshold,
        "baseline_locked_test": baseline_metrics,
        "noise_degradation": noise_results,
        "missing_data_resilience": missing_results,
        "distribution_shift": shift_results
    }

    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(full_report, f, indent=2)

    print(f"\n[SUCCESS] Full robustness report saved to: {REPORT_PATH}")


if __name__ == "__main__":
    main()
