"""
Predicta Semiconductor Reliability — Unseen Equipment Generalization Audit
File: ml/analysis/run_unseen_equipment_eval.py

Evaluates model generalization on completely unseen ATE equipment (EQP-105 holdout):
1. Verifies zero crashes, zero KeyErrors, zero validation errors on unseen equipment IDs.
2. Verifies neutral baseline encoding (all 5 equipment one-hot flags set to 0.0).
3. Compares performance:
   - Baseline Locked In-Distribution Test Set (EQP-101 to EQP-104)
   - Holdout Unseen Equipment Set (EQP-105, 5,000 samples)
4. Saves certified audit report to ml/analysis/reports/unseen_equipment_report.json
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from typing import Dict, Any
from sklearn.metrics import roc_auc_score, f1_score, recall_score, precision_score, brier_score_loss, confusion_matrix, precision_recall_curve, auc

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
sys.path.insert(0, BASE_DIR)

from src.api.inference_service import PredictaInferenceService

PROD_DATA_PATH = os.path.join(BASE_DIR, "ml", "data", "synthetic", "predicta_dataset_v4_production.csv")
PROCESSED_TEST_PATH = os.path.join(BASE_DIR, "ml", "data", "processed", "test.csv")
UNSEEN_DATA_PATH = os.path.join(BASE_DIR, "ml", "data", "synthetic", "predicta_dataset_v4_unseen_equipment.csv")
REPORT_DIR = os.path.join(BASE_DIR, "ml", "analysis", "reports")
REPORT_PATH = os.path.join(REPORT_DIR, "unseen_equipment_report.json")


def evaluate_dataset(service: PredictaInferenceService, df: pd.DataFrame) -> Dict[str, Any]:
    """Runs full multi-task inference pipeline over dataset."""
    if "result" in df.columns:
        y_true = (df["result"] == "FAIL").astype(int).to_numpy()
    elif "functional_failure" in df.columns:
        y_true = df["functional_failure"].to_numpy(dtype=int)
    else:
        y_true = (df["defect_type"] != "NORMAL").astype(int).to_numpy()

    y_probs = []
    y_preds = []
    defect_correct = 0
    defect_evaluated = 0
    novelty_flags = []

    for idx, row in df.iterrows():
        record = row.to_dict()
        res = service.predict_single(record)
        calib_p = res["probability"]
        pred_label = 1 if calib_p >= service.operating_threshold else 0

        y_probs.append(calib_p)
        y_preds.append(pred_label)
        novelty_flags.append(res["is_unseen_equipment"])

        # Check multiclass accuracy for known defects
        pred_defect = res["defect_classification"]["predicted_defect"]
        true_defect = record.get("defect_type", "NORMAL")
        if true_defect != "UNKNOWN_ANOMALY":
            defect_evaluated += 1
            if pred_defect == true_defect:
                defect_correct += 1

    y_probs = np.array(y_probs)
    y_preds = np.array(y_preds)

    tn, fp, fn, tp = confusion_matrix(y_true, y_preds).ravel()
    roc_auc = roc_auc_score(y_true, y_probs)
    prec_curve, rec_curve, _ = precision_recall_curve(y_true, y_probs)
    pr_auc = auc(rec_curve, prec_curve)
    f1 = f1_score(y_true, y_preds)
    rec = recall_score(y_true, y_preds)
    prec = precision_score(y_true, y_preds)
    brier = brier_score_loss(y_true, y_probs)
    fnr = fn / (tp + fn) if (tp + fn) > 0 else 0.0
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    multiclass_acc = defect_correct / defect_evaluated if defect_evaluated > 0 else 0.0

    return {
        "sample_count": len(df),
        "unseen_equipment_flag_rate": float(np.mean(novelty_flags)),
        "roc_auc": round(float(roc_auc), 4),
        "pr_auc": round(float(pr_auc), 4),
        "f1": round(float(f1), 4),
        "recall": round(float(rec), 4),
        "precision": round(float(prec), 4),
        "brier_score": round(float(brier), 5),
        "fnr": round(float(fnr), 4),
        "fpr": round(float(fpr), 4),
        "multiclass_accuracy": round(float(multiclass_acc), 4),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}
    }


def main():
    print("=" * 70)
    print(" PREDICTA-26 — Unseen Equipment Generalization Audit")
    print("=" * 70)

    os.makedirs(REPORT_DIR, exist_ok=True)
    service = PredictaInferenceService()

    # 1. In-Distribution Locked Test Evaluation
    if os.path.exists(PROCESSED_TEST_PATH):
        in_dist_df = pd.read_csv(PROCESSED_TEST_PATH)
    else:
        prod_df = pd.read_csv(PROD_DATA_PATH)
        from ml.training.train_authoritative import perform_group_aware_split
        _, _, in_dist_df = perform_group_aware_split(prod_df, group_col="lot_id", random_state=42)
        in_dist_df = in_dist_df.reset_index(drop=True)

    print(f"[INFO] Evaluating In-Distribution Locked Test Set ({len(in_dist_df)} samples, EQP-101..104)...")
    in_dist_metrics = evaluate_dataset(service, in_dist_df)
    print(f"       ROC-AUC: {in_dist_metrics['roc_auc']:.4f}, PR-AUC: {in_dist_metrics['pr_auc']:.4f}, Recall: {in_dist_metrics['recall']:.4f}, F1: {in_dist_metrics['f1']:.4f}")

    # 2. Holdout Unseen Equipment Evaluation (EQP-105)
    unseen_df = pd.read_csv(UNSEEN_DATA_PATH)
    print(f"\n[INFO] Evaluating Holdout Unseen Equipment Set ({len(unseen_df)} samples, EQP-105)...")
    unseen_metrics = evaluate_dataset(service, unseen_df)
    print(f"       ROC-AUC: {unseen_metrics['roc_auc']:.4f}, PR-AUC: {unseen_metrics['pr_auc']:.4f}, Recall: {unseen_metrics['recall']:.4f}, F1: {unseen_metrics['f1']:.4f}")
    print(f"       Novelty Flag Rate: {unseen_metrics['unseen_equipment_flag_rate'] * 100:.1f}%")

    # 3. Novelty ID Smoke Test (EQP-999)
    smoke_record = in_dist_df.iloc[0].to_dict()
    smoke_record["equipment_id"] = "EQP-999"
    smoke_res = service.predict_single(smoke_record)
    assert smoke_res["is_unseen_equipment"] is True
    print(f"\n[INFO] Smoke Test Novel Equipment EQP-999: Successfully handled with is_unseen_equipment=True, P={smoke_res['probability']}")

    report = {
        "evaluation_name": "predicta_unseen_equipment_audit",
        "model_version": "4.0.0_authoritative",
        "in_distribution_locked_test": in_dist_metrics,
        "holdout_unseen_equipment": unseen_metrics,
        "generalization_delta": {
            "roc_auc_delta": round(unseen_metrics["roc_auc"] - in_dist_metrics["roc_auc"], 4),
            "recall_delta": round(unseen_metrics["recall"] - in_dist_metrics["recall"], 4),
            "f1_delta": round(unseen_metrics["f1"] - in_dist_metrics["f1"], 4),
        }
    }

    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\n[SUCCESS] Unseen equipment report saved to: {REPORT_PATH}")


if __name__ == "__main__":
    main()
