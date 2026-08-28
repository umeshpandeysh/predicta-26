"""
PREDICTA Phase 2A — Genuine GPR Model Training & Joblib Serialization
File: scripts/train_genuine_gpr.py
"""

import os
import sys
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, WhiteKernel
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Fix path to load src
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.drift_prediction.feature_pipeline import prepare_drift_features

def train_and_serialize_gpr():
    print("=========================================================================")
    print("PREDICTA PHASE 2A — TRAINING & SERIALIZING GENUINE GPR MODELS")
    print("=========================================================================\n")

    dataset_path = "data/synthetic/SEMICONDUCTOR_TELEMETRY_synthetic_full.csv"
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset not found at {dataset_path}")

    df = pd.read_csv(dataset_path)

    # Train / Test lot split (Strict lot boundary)
    train_df = df[df['lot_id'].map(lambda lot_id: int(lot_id.split('-')[2]) <= 35)]
    test_df = df[df['lot_id'].map(lambda lot_id: int(lot_id.split('-')[2]) >= 36)]

    target_params = ["iddq", "ileak", "tpd"]
    out_dir = "ml/models"
    os.makedirs(out_dir, exist_ok=True)

    verification_results = {}
    performance_summary = {}

    for param in target_params:
        print(f"Training genuine GPR for parameter '{param}'...")

        # Feature pipeline: 0h, 24h, drift_24h
        train_feat, train_target = prepare_drift_features(train_df, param)
        test_feat, test_target = prepare_drift_features(test_df, param)

        feature_cols = [f'{param}_0h', f'{param}_24h', f'{param}_drift']
        X_train = train_feat[feature_cols].fillna(0.0)
        y_train = train_target.fillna(0.0)

        X_test = test_feat[feature_cols].fillna(0.0)
        y_test = test_target.fillna(0.0)

        # 1. Fit genuine scikit-learn GaussianProcessRegressor
        kernel = (
            RBF(length_scale=1.0, length_scale_bounds=(1e-2, 1e3))
            + WhiteKernel(noise_level=1e-3, noise_level_bounds=(1e-5, 1e1))
        )
        gpr = GaussianProcessRegressor(
            kernel=kernel,
            alpha=1e-6,
            n_restarts_optimizer=3,
            random_state=42
        )
        gpr.fit(X_train, y_train)

        # 2. Serialize fitted GPR model to joblib artifact
        artifact_path = os.path.join(out_dir, f"gpr_{param}.joblib")
        joblib.dump(gpr, artifact_path)
        print(f"  ✓ Saved joblib artifact: {artifact_path}")

        # 3. Verify artifact loading & inference
        loaded_gpr = joblib.load(artifact_path)
        pred_mean, pred_std = loaded_gpr.predict(X_test, return_std=True)

        is_valid_gpr = isinstance(loaded_gpr, GaussianProcessRegressor) and hasattr(loaded_gpr, "L_")
        verification_results[param] = "PASS" if is_valid_gpr else "FAIL"

        # 4. Evaluate Held-out Performance (Lots 36-50)
        mae = mean_absolute_error(y_test, pred_mean)
        rmse = np.sqrt(mean_squared_error(y_test, pred_mean))
        r2 = r2_score(y_test, pred_mean)

        # 95% Confidence Interval Coverage (mu ± 1.96 * sigma from genuine GPR predict)
        lower_95 = pred_mean - 1.96 * pred_std
        upper_95 = pred_mean + 1.96 * pred_std
        coverage = np.mean((y_test >= lower_95) & (y_test <= upper_95))
        avg_width = np.mean(upper_95 - lower_95)

        # 24h Baseline persistence for comparison
        base_preds = X_test[f'{param}_24h']
        b_mae = mean_absolute_error(y_test, base_preds)
        b_rmse = np.sqrt(mean_squared_error(y_test, base_preds))
        b_r2 = r2_score(y_test, base_preds)

        performance_summary[param] = {
            "GPR": {
                "MAE": float(round(mae, 4)),
                "RMSE": float(round(rmse, 4)),
                "R2": float(round(r2, 4)),
                "Samples": len(y_test)
            },
            "Baseline_24h": {
                "MAE": float(round(b_mae, 4)),
                "RMSE": float(round(b_rmse, 4)),
                "R2": float(round(b_r2, 4)),
                "Samples": len(y_test)
            },
            "Uncertainty": {
                "Coverage_95_Pct": f"{coverage * 100:.1f}%",
                "Avg_Interval_Width": float(round(avg_width, 4))
            }
        }

    print("\n--- ARTIFACT VERIFICATION RESULTS ---")
    for p, status in verification_results.items():
        print(f"  {p} → genuine fitted GPR → {status}")

    print("\n--- PERFORMANCE & UNCERTAINTY METRICS (LOTS 36-50) ---")
    print(json.dumps(performance_summary, indent=2))

    print("\n=========================================================================")
    print("GENUINE GPR TRAINING & SERIALIZATION COMPLETE")
    print("=========================================================================\n")

if __name__ == "__main__":
    train_and_serialize_gpr()
