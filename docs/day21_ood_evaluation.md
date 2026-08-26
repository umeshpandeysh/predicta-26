# Predicta Day 21 — Research OOD Dataset Evaluation Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Research OOD Dataset Benchmark

- **Dataset Size**: 500 records (350 PASS, 150 FAIL) generated with independent noise and equipment sensor offsets.
- **Defect Recall**: **`98.67%`** (148 / 150 defects caught)
- **False Positive Rate (FPR)**: **`8.00%`** (28 / 350 false alarms)
- **F1 Score**: **`90.80%`**
- **Verdict**: Research Model V2 maintains high defect recall under independent OOD shift while reducing false positive rate to $8.00\%$.
