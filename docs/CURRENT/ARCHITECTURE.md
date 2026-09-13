# PREDICTA-26 — Technical System Architecture

---

## 1. End-to-End Pipeline Data Flow

`	ext
ATE Hardware Telemetry (16 Physical Channels)
   │
   ▼
[Data Quality Gate] ──▶ Reject NaNs, Infinities, and Out-of-Physical-Bounds
   │
   ▼
[28-Feature Physics Engine] ──▶ Voltage Headroom, Thermal Delta, Elmore Delay Kinetics
   │
   ├───────────────────────────────┬───────────────────────────────┬───────────────────────────────┐
   ▼                               ▼                               ▼                               ▼
[Native XGBoost Model]     [Multiclass Defect]          [Open-Set Anomaly]             [GPR Degradation]
350 Trees, θ* = 0.20       8 Physical Classes           Robust MAD + COPOD             RBF Kernel Forecaster
Calibrated P(Fail)         Specific Defect Tag          Normal / Unknown Reject        168h Drift Horizon
   │                               │                               │                               │
   └───────────────────────────────┴───────────────────────────────┴───────────────────────────────┘
                                   │
                                   ▼
                [Operational Decision Precedence Matrix]
                                   │
             ┌─────────────────────┼─────────────────────┐
             ▼                     ▼                     ▼
          🟢 PASS              🟡 MONITOR            🔴 REJECT
      P < 0.20 & Normal     0.20 ≤ P < 0.65       P ≥ 0.65, Anomaly,
      Standard Packaging    Secondary Screening   or Drift Exceeded
`

## 2. Component Specifications
- **Data Ingestion Gate (src/ingestion/data_quality_gate.js):** Intercepts corrupt telemetry, unphysical measurements (e.g. negative supply voltage or resistance), and enforces strict positivity bounds.
- **Physics Feature Contract (src/features/feature_contract.py):** Transforms 16 raw channels into 28 continuous parameters, including voltage utilization, leakage fraction, and frequency-delay products.
- **Binary Failure Classifier (ml/models/production/predicta_xgboost_model.json):** 350-tree Native XGBoost model trained with scale-position weight 10.835 and Platt calibration.
- **Defect Classifier (ml/models/production/predicta_defect_multiclass.json):** Softmax gradient booster classifying 8 known physical failure mechanisms with 94.67% test accuracy.
- **Anomaly Screening Engine (ml/models/production/predicta_anomaly_artifacts.json):** Part Average Testing (PAT) using Robust MAD and empirical copula tail estimators.
- **Degradation Forecaster (ml/models/production/predicta_gpr_kernel_artifacts.json):** Gaussian Process Regression modeling BTI/HCI wear-out kinetics with 95% Bayesian credible intervals.
- **Decision Engine (src/api/inference.js / src/api/inference_service.py):** Deterministic state machine mapping fused model evidence to four operational tiers (PASS, MONITOR, REJECT, QUARANTINE).
