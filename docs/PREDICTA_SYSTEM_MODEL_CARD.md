# PREDICTA UNIFIED SYSTEM MODEL CARD (v2.0.0)

## Executive Summary
PREDICTA is an end-to-end semiconductor fab intelligence system for **Production 2026 Semiconductor Telemetry Requirements**. It unifies static die-level anomaly classification, unsupervised open-set zero-day detection, physics domain root-cause attribution, and temporal GPR predictive maintenance forecasting.

---

## 1. Complete Unified Architecture
```text
DATA TELEMETRY
     │
     ▼
DATA QUALITY GATE ──► SENSOR_UNRELIABLE (Preempts Classifier on Sensor Inversion)
     │
     ▼
LOT-RELATIVE NORMALIZATION (Wafer-level Z_x = (x - μ_wafer) / σ_wafer)
     │
     ▼
PHYSICS FEATURE ENGINEERING (Arrhenius Factor, Mobility Scaling, Elmore RC)
     │
     ▼
EXP-05-E HYBRID GBDT ENSEMBLE (150 Trees, Max Depth 4)
     │
     ├──────────────────────────┐
     ▼                          ▼
OPEN-SET DETECTORS         PHYSICS ROOT-CAUSE ENGINE
(iForest + PAT/MAD + COPOD) (Thermal, Leakage, Interconnect, Timing)
     │                          │
     ▼                          ▼
EXP-06 GPR DRIFT FORECASTER (3.5 - 7 Wafers Advance Notice)
     │
     ▼
UNIFIED DECISION ENGINE (Actionable Diagnostics & Confidence Bounds)
```

---

## 2. System Decision States & Action Mapping

| Decision State | System Action | Severity | Confidence Level | Trigger Condition |
|---|---|---|---|---|
| `NORMAL` | `PASS` | LOW | HIGH | $P_{	ext{static}} < 0.20$ & Open-Set $le 2.0$ |
| `KNOWN_DEFECT` | `AUTOMATED_BINNING_REJECT` | HIGH | MEDIUM | $P_{	ext{static}} ge 0.20$ & Open-Set $le 2.0$ |
| `HIGH_CONFIDENCE_DEFECT` | `AUTOMATED_BINNING_REJECT` | CRITICAL | HIGH | $P_{	ext{static}} ge 0.20$ & Open-Set $> 2.0$ |
| `UNKNOWN_ANOMALY` | `ENGINEER_REVIEW_FAILURE_ANALYSIS` | HIGH | MEDIUM | $P_{	ext{static}} < 0.20$ & Open-Set $> 2.0$ |
| `EARLY_WARNING` | `MONITOR_EQUIPMENT_SCHEDULE_MAINTENANCE` | MEDIUM | HIGH | Normal Die + GPR $H+5 ge 13.5,Omega$ |
| `SENSOR_UNRELIABLE` | `SENSOR_CALIBRATION_REQUIRED` | HIGH | HIGH | Telemetry Inversion / Out-of-bounds |

---

## 3. Verified Benchmark Metrics (Locked Test Set `test.csv`, 10,000 Records)

- **Accuracy**: **92.95%**
- **ROC-AUC**: **0.9901**
- **PR-AUC**: **0.9705**
- **FAIL Recall**: **97.31%** (1,266 / 1,301 semiconductor failures caught)
- **False Positive Rate (FPR)**: **7.70%** (670 false alarms out of 8,699 normal dies)
- **Zero-Day Unseen Anomaly Recall**: **94.33%**
- **Early Warning Lead Time**: **6.23 Wafers in Advance**
- **P95 Latency**: **0.08 ms / request**

---

## 4. Final System Decision

> **DECISION:} \mathbf{PRODUCTION CANDIDATE WITH KNOWN LIMITATIONS**
