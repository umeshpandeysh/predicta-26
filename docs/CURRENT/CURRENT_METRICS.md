# PREDICTA-26 ? Final Current Production Benchmark

---

## FINAL PRODUCTION MODEL ? CURRENT BENCHMARK

The benchmark numbers below represent the verified evaluation of the active production model (`ml/models/production/predicta_xgboost_model.json`) evaluated on the **locked test set** (Lots 18-20, 7,500 samples; zero leakage) via `scripts/evaluate_production.py`.

| Dimension | Metric | Measured Value | Operational Significance |
| :--- | :--- | :--- | :--- |
| **Dataset** | Total Records | **50,000 dies** | Modeled across 20 manufacturing lots |
| **Partitioning** | Locked Test Partition | **7,500 dies** | Lots 18, 19, 20 (zero leakage) |
| **Model** | Architecture | **Native XGBoost GBDT** | Depth 5, subsample 0.85, eta 0.04 |
| **Complexity** | Decision Tree Count | **350 trees** | Certified by artifact learner inspection |
| **Features** | Schema Dimensionality | **28 features** | 16 raw + 7 engineered + 5 equipment |
| **Operating Point** | Decision Threshold (theta*) | **0.20** | Cost-sensitive minimum under C_FN = 10 * C_FP |
| **Discrimination** | ROC-AUC Score | **0.9997** | Perfect ranking discrimination |
| **Discrimination** | PR-AUC Score | **0.9995** | High precision across all recall thresholds |
| **Field Safety** | Defect Recall | **99.52%** | 2,673 / 2,686 defective dies captured |
| **Field Safety** | False Negative Rate (FNR) | **0.48%** | Customer escapes minimized to near-zero |
| **Yield Protection** | Precision | **98.06%** | 2,673 / 2,726 flagged dies were true defects |
| **Yield Protection** | False Positive Rate (FPR) | **1.10%** | Unnecessary scrap capped at 1.1% |
| **Overall Balance** | F1 Score | **0.9878** | Harmonic mean of precision and recall |
| **Calibration** | Brier Score | **0.0058** | Platt sigmoid scaling (A = -1.0412, B = 1.0037) |
| **Calibration** | Expected Calibration Error | **0.0023** | Well-calibrated 10-bin reliability risk |
| **Multiclass** | Defect Mechanism Accuracy | **94.67%** | Correctly isolates 8 failure types |
| **Holdout Tool** | Unseen Machine Recall (`EQP-105`) | **99.46%** | ROC-AUC 0.9998 on zero-shot holdout tool |
| **Degradation** | GPR Drift MAE | **0.0110 V** | 96.67% empirical coverage of 95% CI |
| **Latency** | Single Die Inference Time | **0.35 ms** | Sub-millisecond real-time ATE throughput |

### Confusion Matrix (Locked Test Partition, 7,500 Dies)
```text
                  Predicted PASS    Predicted FAIL
Actual PASS            4,761 (TN)          53 (FP)
Actual FAIL               13 (FN)       2,673 (TP)
```
- **Total Samples:** 7,500
- **Total Defects:** 2,686 (35.81% base rate in stressed test partition)
- **Defects Captured:** 2,673 (99.52% recall)
- **Escapes:** 13 dies (0.48% escape rate)
