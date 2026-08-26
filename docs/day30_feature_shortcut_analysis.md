# Predicta Day 30 — Feature Shortcut Analysis Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Feature Ablation Experiment Matrix

| Feature Set | ROC-AUC | PR-AUC | FAIL Recall | False Positive Rate | Shortcut Dependence Rating |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **All 28 Features (Production V1)** | `0.9421` | `0.9610` | `99.20%` | `39.15%` | 🟠 **Moderate Shortcut** |
| **Without Equipment Features** | `0.9380` | `0.9540` | `98.90%` | `36.80%` | 🟢 **Stable Generalization** |
| **Single Feature (`leakage_current`)**| `0.9248` | `0.9380` | `97.50%` | `41.20%` | 🔴 **High Shortcut Risk** |
| **Raw Physical 16 Features Only** | `0.9350` | `0.9510` | `98.60%` | `38.10%` | 🟢 **Physically Grounded** |
| **Engineered Features Only** | `0.9280` | `0.9420` | `97.80%` | `40.50%` | 🟠 **Derived Dependence** |

---

## 2. Forensic Findings

The single feature `leakage_current` alone yields an ROC-AUC of $0.9248$, confirming that the production model relies heavily on leakage current threshold cutoffs. The 3-zone decision engine successfully handles this by routing borderline predictions ($0.35 \le P < 0.65$) to `SECONDARY_TEST` re-testing.
