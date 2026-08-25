import os
import sys
import yaml
import json
import argparse
import pandas as pd
import numpy as np

# Fix path to load src
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.anomaly_detection.feature_pipeline import prepare_24h_features
from src.anomaly_detection.robust_mad import RobustMADDetector
from src.anomaly_detection.isolation_forest import IsolationForestDetector
from src.anomaly_detection.copod import COPODDetector
from src.anomaly_detection.evaluation import evaluate_predictions

def main():
    parser = argparse.ArgumentParser(description="AIPS Module A Training CLI")
    parser.add_argument("--config", type=str, default="configs/anomaly_detection.yaml")
    parser.add_argument("--outdir", type=str, default="experiments/anomaly_detection")
    args = parser.parse_args()

    with open(args.config) as f:
        configs = yaml.safe_load(f)

    df = pd.read_csv(configs["dataset_path"])

    # Ingest 24h features
    print("Preparing 24h features...")
    features_df = prepare_24h_features(df)

    # Separate train/test lots
    # Training lots (LOT-SYN-001 to LOT-SYN-035), Test lots (LOT-SYN-043 to LOT-SYN-050)
    train_df = features_df[features_df['lot_id'].map(lambda lot_id: int(lot_id.split('-')[2]) <= 35)]
    test_df = features_df[features_df['lot_id'].map(lambda lot_id: int(lot_id.split('-')[2]) >= 43)]

    X_train = train_df[configs["features"]]

    X_test = test_df[configs["features"]]
    y_test = test_df["anomaly_label"]

    print(f"Train samples: {len(X_train)}, Test samples: {len(X_test)}")

    # 1. Train Robust MAD
    print("Training Robust MAD baseline...")
    mad_det = RobustMADDetector(threshold_sigma=configs["models"]["robust_mad"]["threshold_sigma"])
    mad_det.fit(X_train, train_df["lot_id"])
    mad_scores = mad_det.score(X_test, test_df["lot_id"])
    mad_preds = mad_det.predict(X_test, test_df["lot_id"], configs["models"]["robust_mad"]["threshold_sigma"])
    mad_metrics = evaluate_predictions(y_test, mad_preds, mad_scores)

    # 2. Train Isolation Forest
    print("Training Isolation Forest benchmark...")
    if_config = configs["models"]["isolation_forest"]
    if_det = IsolationForestDetector(n_estimators=if_config["n_estimators"], random_seed=configs["random_seed"])
    if_det.fit(X_train, train_df["lot_id"])
    if_scores = if_det.score(X_test, test_df["lot_id"])
    if_threshold = np.percentile(if_scores, 100.0 * (1.0 - configs["contamination"]))
    if_preds = (if_scores > if_threshold).astype(int)
    if_metrics = evaluate_predictions(y_test, if_preds, if_scores)

    # 3. Train COPOD
    print("Training COPOD detector...")
    copod_det = COPODDetector()
    copod_det.fit(X_train, train_df["lot_id"])
    copod_scores = copod_det.score(X_test, test_df["lot_id"])
    copod_threshold = np.percentile(copod_scores, configs["models"]["copod"]["threshold_percentile"])
    copod_preds = (copod_scores > copod_threshold).astype(int)
    copod_metrics = evaluate_predictions(y_test, copod_preds, copod_scores)

    # Compare results
    comparison = {
        "Robust_MAD": mad_metrics,
        "Isolation_Forest": if_metrics,
        "COPOD": copod_metrics
    }

    os.makedirs(args.outdir, exist_ok=True)
    with open(os.path.join(args.outdir, "benchmark_metrics.json"), 'w') as f:
        json.dump(comparison, f, indent=2)

    print("\nBenchmark Comparison Metrics:")
    print(json.dumps(comparison, indent=2))

    # Select best model based on F-3/Recall priority
    best_model = "COPOD" if copod_metrics["recall"] > if_metrics["recall"] else "Isolation_Forest"
    print(f"\nModel selected for production screening: {best_model}")

if __name__ == "__main__":
    main()
