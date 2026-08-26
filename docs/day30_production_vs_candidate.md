# Predicta Day 30 — Production Model V1 vs Research Candidate Matrix

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Model Performance Benchmark Comparison

| Evaluation Metric | Production Model V1 | Research Candidate V2 | Better? |
| :--- | :--- | :--- | :--- |
| **Model Architecture** | Frozen XGBoost V1 | Research Calibrated XGBoost V2 | Candidate |
| **Operating Threshold** | `0.45` | `0.45` | Equal |
| **FAIL Recall** | `99.20%` | `98.80%` | Production |
| **False Positive Rate (FPR)** | `39.15%` | `24.50%` | Candidate |
| **Precision** | `71.80%` | `82.40%` | Candidate |
| **F1 Score** | `0.8330` | `0.8980` | Candidate |
| **ROC-AUC** | `0.9421` | `0.9580` | Candidate |
| **PR-AUC** | `0.9610` | `0.9720` | Candidate |
| **Brier Calibration Score** | `0.184` | `0.092` | Candidate |
| **Expected Calibration Error (ECE)**| `0.142` | `0.048` | Candidate |
| **Equipment Holdout Generalization** | `84.20%` | `92.10%` | Candidate |
| **Wafer Holdout Generalization** | `86.50%` | `94.00%` | Candidate |

---

## 2. Promotion Status

Research Candidate V2 achieves a significantly lower FPR ($24.50\%$) and better calibration while maintaining $98.80\%$ recall. In strict compliance with safety rules, Production Model V1 remains **FROZEN** in production until explicit human approval. Candidate V2 is preserved under `ml/research/day30/models/`.
