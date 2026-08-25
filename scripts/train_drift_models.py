import os
import sys
import yaml
import json
import argparse
import pandas as pd
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.drift_prediction.feature_pipeline import prepare_drift_features
from src.drift_prediction.linear import LinearDriftPredictor
from src.drift_prediction.gpr import GPRDriftPredictor

def main():
    parser = argparse.ArgumentParser(description="AIPS Module B Training CLI")
    parser.add_argument("--config", type=str, default="configs/drift_prediction.yaml")
    parser.add_argument("--outdir", type=str, default="experiments/drift_prediction")
    args = parser.parse_args()

    with open(args.config) as f:
        configs = yaml.safe_load(f)

    df = pd.read_csv(configs["dataset_path"])

    # Filter splits
    train_df = df[df['lot_id'].map(lambda lot_id: int(lot_id.split('-')[2]) <= 35)]
    test_df = df[df['lot_id'].map(lambda lot_id: int(lot_id.split('-')[2]) >= 43)]

    metrics_summary = {}

    for param in configs["target_parameters"]:
        print(f"\nProcessing target parameter: {param}...")
        train_feat, train_target = prepare_drift_features(train_df, param)
        test_feat, test_target = prepare_drift_features(test_df, param)

        feature_cols = [f'{param}_0h', f'{param}_24h', f'{param}_drift']
        X_train = train_feat[feature_cols]
        X_test = test_feat[feature_cols]

        # 1. Persistence Baseline
        persistence_preds = X_test[f'{param}_24h']
        p_mae = mean_absolute_error(test_target, persistence_preds)
        p_rmse = np.sqrt(mean_squared_error(test_target, persistence_preds))

        # 2. Linear Regression Baseline
        lin_pred = LinearDriftPredictor()
        lin_pred.fit(X_train, train_target)
        l_mean, _ = lin_pred.predict(X_test)
        l_mae = mean_absolute_error(test_target, l_mean)
        l_rmse = np.sqrt(mean_squared_error(test_target, l_mean))

        # 3. GPR
        gpr_pred = GPRDriftPredictor(random_seed=configs["random_seed"])
        gpr_pred.fit(X_train, train_target)
        g_mean, g_std = gpr_pred.predict(X_test)
        g_mae = mean_absolute_error(test_target, g_mean)
        g_rmse = np.sqrt(mean_squared_error(test_target, g_mean))

        # Calculate coverage (what % of values fall in 95% Confidence Interval)
        upper_bounds = g_mean + 1.96 * g_std
        lower_bounds = g_mean - 1.96 * g_std
        coverage = np.mean((test_target >= lower_bounds) & (test_target <= upper_bounds))

        metrics_summary[param] = {
            "Persistence": {"MAE": float(p_mae), "RMSE": float(p_rmse)},
            "LinearRegression": {"MAE": float(l_mae), "RMSE": float(l_rmse)},
            "GPR": {
                "MAE": float(g_mae),
                "RMSE": float(g_rmse),
                "95_Coverage": float(coverage),
                "Avg_Interval_Width": float(np.mean(upper_bounds - lower_bounds))
            }
        }

    os.makedirs(args.outdir, exist_ok=True)
    with open(os.path.join(args.outdir, "drift_benchmark_metrics.json"), 'w') as f:
        json.dump(metrics_summary, f, indent=2)

    print("\nDrift Model Benchmarking Complete:")
    print(json.dumps(metrics_summary, indent=2))

if __name__ == "__main__":
    main()
