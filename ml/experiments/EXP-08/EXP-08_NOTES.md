# EXP-08 Experiment Notes & Final Certification Report

- **Static Champion Preserved**: `EXP-05-E` (Hybrid Full Fusion GBDT Ensemble).
- **Open-Set Layer Added**: `EXP-08 Unsupervised Open-Set Detector` (Isolation Forest + PAT/MAD + COPOD).

## 1. Open-Set Performance Summary
- **Known Defect Recall**: **96.90%**
- **Nominal False Positive Rate (FPR)**: **8.18%**
- **Zero-Day Unseen Anomaly Recall**: **94.33%** (vs 53.33% in EXP-05-E, **+41.0% RECALL BOOST!**)

## 2. Open-Set Decision Matrix
- `KNOWN DEFECT`: ML Prob $\ge 0.20$ & Anomaly Score $\le 2.0$
- `HIGH_CONFIDENCE_DEFECT`: ML Prob $\ge 0.20$ & Anomaly Score $> 2.0$
- `UNKNOWN_ANOMALY`: ML Prob $< 0.20$ & Anomaly Score $> 2.0$ (Triggers `ENGINEER_REVIEW`)
- `NORMAL`: ML Prob $< 0.20$ & Anomaly Score $\le 2.0$

> **CHAMPION DECISION:} \mathbf{ADD EXP-08 AS UNKNOWN-ANOMALY AUXILIARY LAYER**
