# Predicta Day 21 — Research Feature Ablation Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Feature Ablation Results Matrix

| Feature Ablation Scenario | Defect Recall (%) | False Positive Rate (%) | Impact Analysis |
| :--- | :--- | :--- | :--- |
| **Full Baseline Vector (28 Features)** | **`99.64%`** | **`45.03%`** | Full feature set baseline |
| **Ablate `thermal_delta`** | **`87.36%`** | **`42.96%`** | Neutralizing temperature lowers recall, proving temperature features carry genuine thermal defect signals. |
| **Ablate `leakage_current`** | **`96.08%`** | **`42.13%`** | Leakage defects are partially compensated by total current and power features. |
| **Ablate `propagation_delay`** | **`99.13%`** | **`29.91%`** | Timing margin and setup time features maintain high recall even when delay is neutralized. |

---

## 2. Red Team Summary

1. **Multi-Feature Redundancy Resilience**: Neutralizing a single physical feature does not crash defect recall because Predicta's feature engineering creates multi-measurement coverage (e.g. timing margin compensates for propagation delay).
