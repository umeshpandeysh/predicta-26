"""
Predicta Semiconductor Reliability — Model Selection Benchmark
File: ml/analysis/run_model_selection_benchmark.py

Benchmarks 4 candidate model families on the authoritative Validation set:
  1. Majority Class Baseline (Always predicts PASS / empirical failure prior)
  2. Regularized Logistic Regression (StandardScaler + class_weight='balanced')
  3. Balanced Random Forest (100 trees, max_depth=8, class_weight='balanced')
  4. Native Tuned XGBoost (Production configuration, scale_pos_weight)

Evaluates on the exact 28 production features using identical group-isolated data splits.
Generates ml/analysis/reports/model_selection_report.json.
"""

import os
import sys
import time
import json
from typing import Dict, Any, Tuple
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    roc_auc_score,
    precision_recall_curve,
    auc,
    brier_score_loss,
    f1_score,
    recall_score,
    precision_score,
    confusion_matrix,
)
import xgboost as xgb

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
sys.path.insert(0, BASE_DIR)

from src.features.feature_contract import ALL_28_FEATURE_NAMES

REPORT_DIR = os.path.join(BASE_DIR, "ml", "analysis", "reports")
REPORT_PATH = os.path.join(REPORT_DIR, "model_selection_report.json")


def find_optimal_threshold(y_true: np.ndarray, y_probs: np.ndarray) -> Tuple[float, float]:
    """Finds threshold maximizing F1 score."""
    thresholds = np.linspace(0.05, 0.95, 91)
    best_th = 0.5
    best_f1 = -1.0
    for th in thresholds:
        preds = (y_probs >= th).astype(int)
        score = f1_score(y_true, preds, zero_division=0)
        if score > best_f1:
            best_f1 = score
            best_th = float(th)
    return round(best_th, 4), round(best_f1, 4)


def measure_latency_ms(model_predict_fn, X_sample: np.ndarray, n_iterations: int = 500) -> float:
    """Measures single-sample prediction latency in milliseconds."""
    # Warmup
    for _ in range(20):
        _ = model_predict_fn(X_sample[:1])

    start = time.perf_counter()
    for _ in range(n_iterations):
        _ = model_predict_fn(X_sample[:1])
    elapsed = time.perf_counter() - start
    return round((elapsed / n_iterations) * 1000.0, 4)


def evaluate_predictions(
    y_true: np.ndarray,
    y_probs: np.ndarray,
    model_name: str,
    latency_ms: float,
    forced_optimal_th: float = None,
) -> Dict[str, Any]:
    """Calculates comprehensive classification metrics at 0.5 and optimal thresholds."""
    y_probs = np.clip(y_probs, 1e-7, 1.0 - 1e-7)

    try:
        roc = float(roc_auc_score(y_true, y_probs))
    except Exception:
        roc = 0.5

    try:
        prec_c, rec_c, _ = precision_recall_curve(y_true, y_probs)
        pr_auc = float(auc(rec_c, prec_c))
    except Exception:
        pr_auc = float(y_true.mean())

    brier = float(brier_score_loss(y_true, y_probs))

    # Metrics at default theta = 0.5
    preds_50 = (y_probs >= 0.50).astype(int)
    tn50, fp50, fn50, tp50 = confusion_matrix(y_true, preds_50).ravel()
    prec50 = float(precision_score(y_true, preds_50, zero_division=0))
    rec50 = float(recall_score(y_true, preds_50, zero_division=0))
    f1_50 = float(f1_score(y_true, preds_50, zero_division=0))

    # Metrics at optimal theta
    if forced_optimal_th is not None:
        opt_th = forced_optimal_th
        preds_opt = (y_probs >= opt_th).astype(int)
        opt_f1 = float(f1_score(y_true, preds_opt, zero_division=0))
    else:
        opt_th, opt_f1 = find_optimal_threshold(y_true, y_probs)
        preds_opt = (y_probs >= opt_th).astype(int)

    tn_opt, fp_opt, fn_opt, tp_opt = confusion_matrix(y_true, preds_opt).ravel()
    prec_opt = float(precision_score(y_true, preds_opt, zero_division=0))
    rec_opt = float(recall_score(y_true, preds_opt, zero_division=0))

    return {
        "model_name": model_name,
        "roc_auc": round(roc, 4),
        "pr_auc": round(pr_auc, 4),
        "brier_score": round(brier, 5),
        "default_threshold_0_50": {
            "threshold": 0.50,
            "precision": round(prec50, 4),
            "recall": round(rec50, 4),
            "f1": round(f1_50, 4),
            "confusion_matrix": {"tn": int(tn50), "fp": int(fp50), "fn": int(fn50), "tp": int(tp50)},
        },
        "optimal_threshold": {
            "threshold": round(opt_th, 4),
            "precision": round(prec_opt, 4),
            "recall": round(rec_opt, 4),
            "f1": round(opt_f1, 4),
            "confusion_matrix": {"tn": int(tn_opt), "fp": int(fp_opt), "fn": int(fn_opt), "tp": int(tp_opt)},
        },
        "latency_ms_per_sample": latency_ms,
    }


def main():
    print("=" * 75)
    print(" PREDICTA-26 — AUTHORITATIVE MODEL SELECTION BENCHMARK (Directive 35)")
    print("=" * 75)

    os.makedirs(REPORT_DIR, exist_ok=True)
    train_path = os.path.join(BASE_DIR, "ml", "data", "processed", "train.csv")
    val_path = os.path.join(BASE_DIR, "ml", "data", "processed", "validation.csv")

    if not os.path.exists(train_path) or not os.path.exists(val_path):
        raise FileNotFoundError(f"Processed splits not found. Missing: {train_path} or {val_path}")

    print(f"[INFO] Loading training data: {train_path}")
    train_df = pd.read_csv(train_path)
    print(f"[INFO] Loading validation data: {val_path}")
    val_df = pd.read_csv(val_path)

    X_train = train_df[ALL_28_FEATURE_NAMES].to_numpy(dtype=np.float32)
    y_train = (train_df["result"] == "FAIL").astype(int).to_numpy()

    X_val = val_df[ALL_28_FEATURE_NAMES].to_numpy(dtype=np.float32)
    y_val = (val_df["result"] == "FAIL").astype(int).to_numpy()

    print(f"[INFO] Train samples: {len(X_train)} (Failures: {y_train.sum()} / {y_train.mean():.2%})")
    print(f"[INFO] Val samples:   {len(X_val)} (Failures: {y_val.sum()} / {y_val.mean():.2%})")

    results = {}

    # 1. Majority Baseline
    print("\n--- 1. Evaluating Majority Class Baseline ---")
    train_prior = float(y_train.mean())
    maj_probs = np.full(len(y_val), train_prior, dtype=np.float32)
    maj_latency = measure_latency_ms(lambda x: np.array([train_prior]), X_val)
    results["Majority_Baseline"] = evaluate_predictions(
        y_val, maj_probs, "Majority_Baseline", maj_latency, forced_optimal_th=0.5
    )
    print(f"    ROC-AUC: {results['Majority_Baseline']['roc_auc']:.4f}, Brier: {results['Majority_Baseline']['brier_score']:.5f}")

    # 2. Logistic Regression (StandardScaler + class_weight='balanced')
    print("\n--- 2. Training Logistic Regression Baseline ---")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)

    lr = LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42)
    lr.fit(X_train_scaled, y_train)

    lr_probs = lr.predict_proba(X_val_scaled)[:, 1]
    lr_latency = measure_latency_ms(lambda x: lr.predict_proba(scaler.transform(x))[:, 1], X_val)
    results["Logistic_Regression"] = evaluate_predictions(
        y_val, lr_probs, "Logistic_Regression", lr_latency
    )
    print(f"    ROC-AUC: {results['Logistic_Regression']['roc_auc']:.4f}, PR-AUC: {results['Logistic_Regression']['pr_auc']:.4f}, F1: {results['Logistic_Regression']['optimal_threshold']['f1']:.4f}")

    # 3. Random Forest (100 trees, max_depth=8, class_weight='balanced')
    print("\n--- 3. Training Random Forest Baseline ---")
    rf = RandomForestClassifier(
        n_estimators=100, max_depth=8, class_weight="balanced", random_state=42, n_jobs=-1
    )
    rf.fit(X_train, y_train)

    rf_probs = rf.predict_proba(X_val)[:, 1]
    rf_latency = measure_latency_ms(lambda x: rf.predict_proba(x)[:, 1], X_val)
    results["Random_Forest"] = evaluate_predictions(
        y_val, rf_probs, "Random_Forest", rf_latency
    )
    print(f"    ROC-AUC: {results['Random_Forest']['roc_auc']:.4f}, PR-AUC: {results['Random_Forest']['pr_auc']:.4f}, F1: {results['Random_Forest']['optimal_threshold']['f1']:.4f}")

    # 4. Native Tuned XGBoost (Production configuration)
    print("\n--- 4. Training Production XGBoost ---")
    scale_pos = (len(y_train) - y_train.sum()) / max(1, y_train.sum())
    xgb_clf = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.08,
        scale_pos_weight=scale_pos,
        eval_metric="logloss",
        random_state=42,
        tree_method="hist",
    )
    xgb_clf.fit(X_train, y_train)

    xgb_probs = xgb_clf.predict_proba(X_val)[:, 1]
    xgb_latency = measure_latency_ms(lambda x: xgb_clf.predict_proba(x)[:, 1], X_val)
    results["Native_XGBoost"] = evaluate_predictions(
        y_val, xgb_probs, "Native_XGBoost", xgb_latency, forced_optimal_th=0.20
    )
    print(f"    ROC-AUC: {results['Native_XGBoost']['roc_auc']:.4f}, PR-AUC: {results['Native_XGBoost']['pr_auc']:.4f}, F1: {results['Native_XGBoost']['optimal_threshold']['f1']:.4f}")

    report = {
        "benchmark_title": "Predicta Semiconductor Model Selection Benchmark",
        "directive": "Directive 35",
        "dataset": {
            "validation_samples": len(X_val),
            "validation_failures": int(y_val.sum()),
            "failure_rate": round(float(y_val.mean()), 4),
            "feature_count": len(ALL_28_FEATURE_NAMES),
        },
        "models": results,
    }

    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\n[SUCCESS] Model selection benchmark report written to: {REPORT_PATH}")


if __name__ == "__main__":
    main()
