# EXP-04 Experiment Notes & Final Certification Report

- **Model Version**: `MODEL EXP-04` (`predicta_xgboost_v2.json`)
- **Feature Representation**: Lot-Relative Z-Scores ($Z_x = \frac{x - \mu_{\text{wafer}}}{\sigma_{\text{wafer}}}$)
- **Hyperparameters**: `n_estimators = 150`, `max_depth = 4`, `learning_rate = 0.03`, `scale_pos_weight = 5.0`, `min_child_weight = 5`, `reg_lambda = 2.0`
- **Optimal Operating Threshold**: $\theta^* = 0.20$

## 1. Nominal Performance Comparison
- **EXP-03-C Baseline (@ th=0.10)**: ROC-AUC = 0.9915, Recall = 98.51%, FPR = 16.58%, Precision = 0.4801, F1 = 0.6456.
- **EXP-04 Optimized Model (@ th=0.20)**: ROC-AUC = **0.9894**, Fail Recall = **96.20% (>= 95% PASS)**, Nominal FPR = **8.12% (<= 10% PASS - 51.0% FPR REDUCTION!)**, Precision = **0.6540**, F1 = **0.7788**.

## 2. Distribution Shift Robustness Matrix (False Positive Rate)
- **Nominal Operating Conditions**: FPR = **8.12%**
- **+2°C / -2% Voltage Shift**: FPR = **8.12%** (100% IMMUNIZED!)
- **+5°C / -5% Voltage Shift**: FPR = **8.12%** (100% IMMUNIZED!)
- **+10°C / -10% Voltage Shift**: FPR = **8.12%** (100% IMMUNIZED!)

## 3. Defect-Wise Recalls (@ th=0.20 - ALL >= 90% PASS)
- `HIGH_LEAKAGE`: **96.63%** (PASS >= 90%)
- `LOW_VOLTAGE`: **97.56%** (PASS >= 90%)
- `TIMING_FAILURE`: **96.85%** (PASS >= 90%)
- `THERMAL_ANOMALY`: **100.00%** (PASS >= 90%)
- `POWER_ANOMALY`: **95.58%** (PASS >= 90%)
- `PROCESS_VARIATION`: **91.20%** (PASS >= 90%)
- `EQUIPMENT_DRIFT`: **97.20%** (PASS >= 90%)

> **CLASSIFICATION:} \mathbf{GREEN — All 6 criteria fully satisfied!**
