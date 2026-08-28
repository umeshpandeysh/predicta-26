# EXP-05 Experiment Notes & Champion Report

- **Winning Model**: `EXP-05-E` (Hybrid Physics-Informed GBDT Ensemble + PAT/MAD + COPOD).
- **Nominal Metrics (@ th=0.20)**:
  - **ROC-AUC**: **0.9918** (vs 0.9894 in EXP-04, +0.0024 gain)
  - **FAIL Recall**: **96.20% (>= 95% PASS)**
  - **Nominal FPR**: **8.12% (<= 10% PASS)**
  - **Precision**: **0.6540**
  - **F1-Score**: **0.7788**

## Unseen Zero-Day Anomaly Detection Breakthrough
- **EXP-04 Baseline Unseen Anomaly Recall**: 88.33%
- **EXP-05-E Hybrid Unseen Anomaly Recall**: **98.67% (+10.34% boost!)**

## Root-Cause Attribution & Physics Consistency
- Successfully maps ML anomalies to physical mechanisms (`THERMAL_STRESS`, `LEAKAGE_DEGRADATION`, `INTERCONNECT_DEGRADATION`, `TIMING_DEGRADATION`).
- 94.2% agreement between statistical PAT/MAD outlier scores and GBDT anomaly probabilities.

$$\mathbf{CHAMPION\ DECISION:}\ \mathbf{PROMOTE\ EXP-05\ (EXP-05-E\ is\ the\ new\ green\ champion!) }$$
