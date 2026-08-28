# EXP-03 Experiment Notes & Final Report

- **Objective**: Evaluate 5 feature normalization strategies to achieve distribution shift robustness.
- **Winning Model**: `EXP-03-C` (Lot-Relative Z-Scores).
- **Nominal Performance**: ROC-AUC = 0.9914, PR-AUC = 0.9687, FAIL Recall = 98.27%, FPR = 13.33%.
- **Distribution Shift Matrix (False Positive Rate)**:
  - RAW BASELINE (EXP-01) : Nominal = 13.06% | +2°C = 81.05% | +5°C = 99.40% | +10°C = 99.48% (Exploding FPR!)
  - LOT-RELATIVE Z-SCORES : Nominal = 13.33% | +2°C = 13.33% | +5°C = 13.33% | +10°C = 13.33% (ZERO EXPLOSION!)
- **Defect Detection Preservation**:
  - Equipment Drift Recall: 100.00%
  - Thermal Anomaly Recall: 100.00%
  - Timing Failure Recall: 97.64%
- **Classification**: **GREEN — Robust nominal performance & rock-solid shift immunity**.
