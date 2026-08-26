# Predicta Day 23 — Research Probability Calibration & Brier Score Analysis

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Probability Calibration Bins & Reliability Analysis

- **Brier Score Baseline V1**: `0.3421` (On V1 test set)
- **Brier Score V3 Benchmark**: **`0.2564`** (On independent Generator V3 dataset)
- **Expected Calibration Error (ECE)**: `0.1185`

---

## 2. Operational Decision Risk Zone Calibration

| Risk Zone | Probability Interval | Empirical Defect Rate | Operational Action |
| :--- | :--- | :--- | :--- |
| **`LOW_RISK`** | $P < 0.35$ | $2.1\%$ | Standard production routing (PASS) |
| **`REVIEW`** | $0.35 \le P < 0.65$ | $48.5\%$ | Mandatory secondary ATE re-test |
| **`CRITICAL_FAILURE`** | $P \ge 0.65$ | $97.8\%$ | Immediate quarantine disposition (FAIL) |
