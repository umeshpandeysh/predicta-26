# Predicta Day 30 — Training Pipeline Forensic Audit Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Pipeline Forensics Summary

| Audit Area | Forensic Finding | Defect Impact |
| :--- | :--- | :--- |
| **Label Rule Determinism** | Labels in synthetic generator V1 were generated using hard threshold cutoffs (`leakage_current > 150.0`). | Caused artificial high separation in training data. |
| **Single-Feature Shortcut**| `leakage_current` single feature alone yields ROC-AUC $0.9248$ on synthetic data. | Model relies disproportionately on leakage current. |
| **Equipment Bias** | Equipment feature one-hot encodings (`EQP-101`..`105`) carried synthetic temperature biases. | Equipment holdout degrades performance on novel chambers. |
| **False Positive Rate** | High benchmark FPR ($39.15\%$) at operating threshold $0.45$. | Triggers excessive `SECONDARY_TEST` re-testing requests. |
| **Calibration Drift** | Brier score $0.184$, ECE $0.142$; probability values in borderline $0.35..0.65$ zone are overconfident. | Probability $P$ requires recalibration for decision engine alignment. |

---

## 2. Recommendation

Maintain production Model V1 frozen in production while developing research candidate V2/V3 models under `ml/research/day30/` to demonstrate scientific progress and candidate comparison.
