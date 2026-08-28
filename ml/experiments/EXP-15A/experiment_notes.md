# PREDICTA EXP-15A PROBABILITY CALIBRATION REPORT

## Executive Summary
EXP-15A evaluated **Platt Scaling** (logistic sigmoid on log-odds) and **Isotonic Regression** (Pool Adjacent Violators monotonic step function) as challenger probability calibration layers for PREDICTA's XGBoost model.

## 1. Locked Test Set Calibration Benchmark (`test.csv`, 10,000 Records)

| Model Variant | Brier Score | Expected Calibration Error (ECE) | Fail Recall ($	heta^* = 0.20$) | Nominal FPR ($	heta^* = 0.20$) | ROC-AUC | F1 Score |
|---|---|---|---|---|---|---|
| **Current Champion (Uncalibrated)** | **0.0521** | **0.0384** | **97.31%** | **7.70%** | **0.9901** | **0.7822** |
| **Platt Scaling Layer** | 0.0482 | 0.0215 | 96.84% | 7.92% | 0.9901 | 0.7761 |
| **Isotonic Regression Layer** | 0.0491 | 0.0241 | 96.95% | 7.85% | 0.9901 | 0.7780 |

## 2. Key Findings & Scientific Conclusion
1. **Probability Reliability**: Platt Scaling reduced ECE from $0.0384$ down to $0.0215$, producing more reliable raw probability bounds.
2. **Operational Performance**: At the certified operating threshold ($	heta^* = 0.20$), the uncalibrated champion maintains superior Fail Recall ($97.31%$ vs $96.84%$) and lower False Positive Rate ($7.70%$ vs $7.92%$).
3. **Defect Preservation**: All 7 defect categories maintained $ge 95.54%$ recall on the uncalibrated champion.

$$\mathbf{CHALLENGER\ DECISION:}\ \mathbf{C.\ UNCALIBRATED\ CHAMPION\ REMAINS\ BEST}$$
Production remains strictly `v2.0.0-SIH2026`.
