# PREDICTA — FINAL ML SYSTEM BENCHMARK & CERTIFICATION REPORT

## Executive Summary
This document represents the final certification report for **PREDICTA** (SIH 2026 Problem Statement 170). The complete ML system has been evaluated end-to-end against the untouched locked test set (`test.csv`, 10,000 records / 20 Wafers) and subjected to comprehensive adversarial red-team stress testing.

---

## 1. Frozen Candidate Architecture
```text
DATA TELEMETRY
     │
     ▼
DATA QUALITY GATE
     │
     ▼
LOT-RELATIVE Z-SCORE NORMALIZATION (Z_x = (x - μ_wafer) / σ_wafer)
     │
     ▼
PHYSICS FEATURE ENGINEERING (Arrhenius Factor, Mobility Scaling, Elmore RC)
     │
     ▼
EXP-05-E HYBRID GBDT ENSEMBLE (150 Trees, Max Depth 4)
     │
     ├──────────────────────────┐
     ▼                          ▼
PAT/MAD & COPOD SCORES     PHYSICS ROOT-CAUSE ATTRIBUTION
     │                          │
     ▼                          ▼
EXP-06 GPR DRIFT FORECASTER (3.5 - 7 Wafers Lead Time Notice)
     │
     ▼
FINAL ACTIONABLE DIAGNOSTIC & EARLY WARNING ALERT
```

---

## 2. Locked Test Set Performance (`test.csv`, 10,000 Records / 20 Wafers)

- **Accuracy**: **92.95%**
- **ROC-AUC**: **0.9901**
- **PR-AUC**: **0.9705**
- **FAIL Recall**: **97.31%** (1,266 / 1,301 semiconductor failures caught)
- **Nominal False Positive Rate (FPR)**: **7.70%** (670 false alarms out of 8,699 normal dies)
- **Precision**: **0.6539**
- **F1-Score**: **0.7822**

### Defect-Wise Recalls (Locked Test Set - ALL >= 95% PASS)
- `HIGH_LEAKAGE`: **97.37%** ✅
- `LOW_VOLTAGE`: **97.81%** ✅
- `TIMING_FAILURE`: **95.65%** ✅
- `THERMAL_ANOMALY`: **100.00%** ✅
- `POWER_ANOMALY`: **98.01%** ✅
- `PROCESS_VARIATION`: **96.79%** ✅
- `EQUIPMENT_DRIFT`: **95.54%** ✅

---

## 3. Distribution Shift Robustness Matrix

- **Nominal Operating Conditions**: FPR = **7.70%**
- **+2°C / -2% Voltage Shift**: FPR = **7.70%** (100% IMMUNIZED!)
- **+5°C / -5% Voltage Shift**: FPR = **7.70%** (100% IMMUNIZED!)
- **+10°C / -10% Voltage Shift**: FPR = **7.70%** (100% IMMUNIZED!)

---

## 4. Latency & Throughput Benchmark

- **Inference Latency**: **0.0346 ms / request**
- **System Throughput**: **28,902 predictions / second**
- **Real-Time ATE Feasibility**: PASS (Runs 28.9x faster than 1.0 ms ATE probing deadline).

---

## 5. Documented System Limitations (Honest Disclosure)

1. **Zero-Day Unseen Anomaly Recall**: While standard synthetic defects maintain $>95.5\%$ recall on locked test data, unseen combined stress patterns (e.g. simultaneous thermal+leakage surges) achieve **53.3% - 60.7% recall**.
2. **Batch Wafer Requirement**: Lot-relative Z-score normalization requires batch measurement of $\ge 25$ dies per wafer for optimal baseline mean estimation.

---

## 6. Final Champion Decision

$$\mathbf{DECISION:}\ \mathbf{PRODUCTION\ CANDIDATE\ WITH\ KNOWN\ LIMITATIONS}$$

All core operational constraints (**Recall $\ge 95\%$, FPR $\le 10\%$, 100% Shift Immunity, $< 1\text{ms}$ Latency**) are fully satisfied on the locked test set.
