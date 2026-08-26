# Predicta Day 31 — Final Model V1 vs Research Candidate V2 Comparison

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Multi-Seed & Independent Test Set Matrix

| Metric Dimension | Production Model V1 | Candidate V2 (Mean ± SD) | 95% Bootstrap CI | Winner | Justification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FAIL Recall** | `99.20%` | `98.80% ± 0.15%` | `[98.50%, 99.10%]` | V1 | V1 achieves slightly higher recall on synthetic test set. |
| **False Positive Rate (FPR)** | `39.15%` | `24.50% ± 0.35%` | `[23.80%, 25.20%]` | V2 | V2 reduces FPR by 14.65 percentage points. |
| **Precision** | `71.80%` | `82.40% ± 0.28%` | `[81.90%, 82.90%]` | V2 | V2 significantly improves positive predictive value. |
| **F1 Score** | `0.8330` | `0.8980 ± 0.002` | `[0.8940, 0.9020]` | V2 | V2 improves harmonic mean of precision & recall. |
| **ROC-AUC** | `0.9421` | `0.9580 ± 0.001` | `[0.9560, 0.9600]` | V2 | V2 offers higher discriminative capacity. |
| **Brier Calibration Score** | `0.1840` | `0.0920 ± 0.003` | `[0.0860, 0.0980]` | V2 | V2 offers superior probability calibration. |
| **Equipment Holdout** | `84.20%` | `92.10% ± 0.45%` | `[91.20%, 93.00%]` | V2 | V2 generalizes better across unseen ATE chambers. |
| **50 Golden Challenge Recall**| `100.0%` | `100.0%` | `[100.0%, 100.0%]` | Tie | Both models accurately catch all 25 golden FAIL cases. |

---

## 2. Safety Rule Compliance

Production Model V1 remains **FROZEN IN PRODUCTION**. Candidate V2 is preserved under `ml/research/day31/promotion_candidate/` for evaluation purposes.
