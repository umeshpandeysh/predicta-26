"""
Predicta Semiconductor Test Analytics Prototype — Native XGBoost Trainer
File: ml/training/train_native_xgboost.py

Authoritative native XGBoost training pipeline that:
1. Loads synthetic semiconductor dataset (ml/data/synthetic/predicta_dataset_v3_50000.csv)
2. Validates schema and dataset integrity (50,000 records)
3. Constructs locked 28-feature production vector (16 raw + 7 engineered + 5 one-hot)
4. Computes empirical feature standardization statistics (mean, std)
5. Fits genuine native xgboost.XGBClassifier model with reproducible random_state=42
6. Saves model using native XGBoost JSON serialization (model.save_model)
7. Generates authoritative metadata and production manifest artifacts with SHA-256 checksum
"""

import os
import sys
import json
import hashlib
from datetime import datetime
import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, log_loss, accuracy_score

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
DATASET_PATH = os.path.join(BASE_DIR, "ml", "data", "synthetic", "predicta_dataset_v3_50000.csv")
MODEL_OUT_PATH = os.path.join(BASE_DIR, "ml", "models", "production", "predicta_xgboost_model.json")
METADATA_OUT_PATH = os.path.join(BASE_DIR, "ml", "models", "production", "predicta_xgboost_metadata.json")
MANIFEST_OUT_PATH = os.path.join(BASE_DIR, "ml", "models", "production", "predicta_production_manifest.json")

RAW_NUMERICAL_FEATURES = [
    "supply_voltage", "output_voltage", "current", "leakage_current",
    "resistance", "capacitance", "threshold_voltage", "frequency",
    "propagation_delay", "setup_time", "hold_time", "timing_margin",
    "temperature", "dynamic_power", "total_power", "test_duration"
]

ENGINEERED_FEATURES = [
    "voltage_headroom", "voltage_utilization", "leakage_fraction",
    "power_per_current", "normalized_timing_margin", "frequency_delay_product",
    "thermal_delta"
]

EQUIPMENT_IDS = ["EQP-101", "EQP-102", "EQP-103", "EQP-104", "EQP-105"]
EQUIPMENT_ONE_HOT_COLS = [f"eq_{eq}" for eq in EQUIPMENT_IDS]

ALL_28_FEATURES = RAW_NUMERICAL_FEATURES + ENGINEERED_FEATURES + EQUIPMENT_ONE_HOT_COLS

def train_and_save_native_xgboost():
    print("=========================================================================")
    print("PREDICTA — NATIVE XGBOOST MODEL TRAINING PIPELINE")
    print("=========================================================================\n")

    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(f"Synthetic semiconductor dataset missing: {DATASET_PATH}")

    print(f"[DATA] Reading synthetic semiconductor dataset: {DATASET_PATH}")
    df = pd.read_csv(DATASET_PATH)
    total_records = len(df)
    print(f"[DATA] Loaded {total_records} records from synthetic semiconductor dataset.")

    if total_records != 50000:
        raise ValueError(f"DATASET_INTEGRITY_ERROR: Expected exactly 50,000 records, got {total_records}")

    # Validate target column
    if "result" in df.columns:
        y = (df["result"].astype(str).str.upper() == "FAIL").astype(int).values
    elif "failure_label" in df.columns:
        y = df["failure_label"].values
    elif "label" in df.columns:
        y = df["label"].values
    else:
        raise ValueError(f"Target label column not found in dataset. Columns: {list(df.columns)}")
    y = np.asarray(y, dtype=int)
    if not np.isin(y, [0, 1]).all():
        raise ValueError("DATASET_INTEGRITY_ERROR: Target labels must be binary PASS/FAIL values.")
    fail_count = int(np.sum(y == 1))
    pass_count = int(np.sum(y == 0))
    if fail_count == 0 or pass_count == 0:
        raise ValueError("DATASET_INTEGRITY_ERROR: Both PASS and FAIL classes are required for training.")
    scale_pos_weight = float(pass_count / fail_count)

    print(f"[DATA] Target distribution: {pass_count} PASS (0), {fail_count} FAIL (1). Calculated scale_pos_weight = {scale_pos_weight:.4f}")

    missing_raw = [col for col in RAW_NUMERICAL_FEATURES if col not in df.columns]
    if missing_raw:
        raise ValueError(f"DATASET_INTEGRITY_ERROR: Missing required raw features: {missing_raw}")
    if "equipment_id" not in df.columns:
        raise ValueError("DATASET_INTEGRITY_ERROR: Missing required equipment_id column.")

    # Feature Engineering
    v_sup = df["supply_voltage"].values
    v_th = df["threshold_voltage"].values
    i_tot = df["current"].values
    i_leak = df["leakage_current"].values
    p_dyn = df["dynamic_power"].values
    t_margin = df["timing_margin"].values
    t_pd = df["propagation_delay"].values
    freq = df["frequency"].values
    temp = df["temperature"].values

    df["voltage_headroom"] = v_sup - v_th
    df["voltage_utilization"] = np.where(v_sup > 0, v_th / v_sup, 0.0)
    df["leakage_fraction"] = np.where(i_tot > 0, (i_leak * 1e-3) / i_tot, 0.0)
    df["power_per_current"] = np.where(i_tot > 0, p_dyn / i_tot, 0.0)
    df["normalized_timing_margin"] = np.where(t_pd > 0, t_margin / t_pd, 0.0)
    df["frequency_delay_product"] = freq * t_pd
    df["thermal_delta"] = temp - 25.0

    # Equipment One-Hot Encodings
    eq_series = df["equipment_id"].astype(str)
    unknown_equipment = sorted(set(eq_series.unique()) - set(EQUIPMENT_IDS))
    if unknown_equipment:
        raise ValueError(f"DATASET_INTEGRITY_ERROR: Unknown equipment IDs: {unknown_equipment}")
    for eq in EQUIPMENT_IDS:
        df[f"eq_{eq}"] = (eq_series == eq).astype(float)

    # Verify 28 features exist
    for col in ALL_28_FEATURES:
        if col not in df.columns:
            raise ValueError(f"Missing feature in engineered dataframe: {col}")

    # Compute empirical reference statistics for numerical features
    num_feature_names = RAW_NUMERICAL_FEATURES + ENGINEERED_FEATURES
    reference_stats = {}
    X_mat = df[ALL_28_FEATURES].copy()

    for col in num_feature_names:
        col_mean = float(df[col].mean())
        col_std = float(df[col].std())
        if col_std <= 0:
            col_std = 1e-6
        reference_stats[col] = {
            "mean": round(col_mean, 6),
            "std": round(col_std, 6)
        }
        # Standardize numerical features for XGBoost model input
        X_mat[col] = (df[col] - col_mean) / col_std

    X = X_mat.values

    # Train / Test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print(f"[TRAIN] Training genuine native XGBClassifier on {len(X_train)} train samples, testing on {len(X_test)} samples...")

    # Genuine native XGBoost model configuration
    model = xgb.XGBClassifier(
        n_estimators=500,
        max_depth=5,
        learning_rate=0.03,
        objective="binary:logistic",
        eval_metric="logloss",
        scale_pos_weight=scale_pos_weight,
        random_state=42
    )

    model.fit(X_train, y_train)

    # Evaluate performance
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    y_pred_bin = (y_pred_proba >= 0.20).astype(int)

    auc = roc_auc_score(y_test, y_pred_proba)
    loss = log_loss(y_test, y_pred_proba)
    acc = accuracy_score(y_test, y_pred_bin)

    print(f"[EVAL] Model Performance Evaluation:")
    print(f"       ROC AUC:  {auc:.4f}")
    print(f"       LogLoss:  {loss:.4f}")
    print(f"       Accuracy: {acc:.4f} (at threshold 0.20)")

    # Save Native XGBoost Model Artifact
    os.makedirs(os.path.dirname(MODEL_OUT_PATH), exist_ok=True)
    model.save_model(MODEL_OUT_PATH)

    with open(MODEL_OUT_PATH, "r", encoding="utf-8") as f:
        model_json_obj = json.load(f)

    trees_arr = model_json_obj.get("learner", {}).get("gradient_booster", {}).get("model", {}).get("trees", [])
    model_json_obj["num_features"] = 28
    model_json_obj["features"] = ALL_28_FEATURES
    model_json_obj["model_version"] = "2.0_production"
    model_json_obj["trees_count"] = len(trees_arr)
    model_json_obj["trees"] = trees_arr

    with open(MODEL_OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(model_json_obj, f, indent=2)

    print(f"[SAVE] Saved genuine native XGBoost JSON model artifact to: {MODEL_OUT_PATH}")

    # Verify native reload capability
    reloaded_model = xgb.XGBClassifier()
    reloaded_model.load_model(MODEL_OUT_PATH)
    test_probs = reloaded_model.predict_proba(X_test[:5])[:, 1]
    print(f"[VERIFY] Successfully reloaded native XGBoost model. Sample test predictions: {np.round(test_probs, 4)}")

    # Compute SHA-256 Checksum
    with open(MODEL_OUT_PATH, "r", encoding="utf-8") as f:
        content = f.read().replace("\r\n", "\n")
        model_sha256 = hashlib.sha256(content.encode("utf-8")).hexdigest()

    print(f"[SECURITY] Computed Model Artifact SHA-256: {model_sha256}")

    # Generate Metadata Artifact
    metadata_data = {
        "model_version": "2.0_production",
        "training_date": datetime.utcnow().isoformat() + "Z",
        "dataset_description": "Synthetic semiconductor dataset containing 50,000 records",
        "dataset_path": "ml/data/synthetic/predicta_dataset_v3_50000.csv",
        "dataset_record_count": total_records,
        "class_distribution": {
            "total": total_records,
            "total_records": total_records,
            "pass_count": pass_count,
            "fail_count": fail_count,
            "scale_pos_weight": round(scale_pos_weight, 4)
        },
        "operating_threshold": 0.20,
        "hyperparameters": {
            "n_estimators": 500,
            "max_depth": 5,
            "learning_rate": 0.03,
            "objective": "binary:logistic",
            "eval_metric": "logloss",
            "scale_pos_weight": round(scale_pos_weight, 4),
            "random_state": 42
        },
        "metrics": {
            "auc": round(float(auc), 4),
            "log_loss": round(float(loss), 4),
            "accuracy": round(float(acc), 4)
        },
        "feature_contract": {
            "total_features": len(ALL_28_FEATURES),
            "raw_numerical_count": len(RAW_NUMERICAL_FEATURES),
            "engineered_count": len(ENGINEERED_FEATURES),
            "equipment_one_hot_count": len(EQUIPMENT_ONE_HOT_COLS),
            "feature_names": ALL_28_FEATURES
        },
        "reference_stats": reference_stats,
        "model_sha256": model_sha256
    }

    with open(METADATA_OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata_data, f, indent=2)
    print(f"[SAVE] Saved metadata artifact to: {METADATA_OUT_PATH}")

    # Generate Production Manifest Artifact
    manifest_data = {
        "active_version": "2.0_production",
        "xgboost_model": "ml/models/production/predicta_xgboost_model.json",
        "xgboost_metadata": "ml/models/production/predicta_xgboost_metadata.json",
        "model_sha256": model_sha256,
        "updated_at": datetime.utcnow().isoformat() + "Z"
    }

    with open(MANIFEST_OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2)
    print(f"[SAVE] Saved production manifest artifact to: {MANIFEST_OUT_PATH}")

    print("\n=========================================================================")
    print("[SUCCESS] NATIVE XGBOOST MODEL TRAINING & ARTIFACT GENERATION COMPLETED SUCCESSFULLY")
    print("=========================================================================")

if __name__ == "__main__":
    train_and_save_native_xgboost()
