# PREDICTA-26
## Semiconductor Burn-In Telemetry & Latent Defect Screening

[![SIH 2026](https://img.shields.io/badge/SIH-2026-orange.svg)](https://sih.gov.in)
[![PS-170](https://img.shields.io/badge/PS-170-blue.svg)](https://github.com/umeshpandeysh/predicta-26)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB.svg?logo=python&logoColor=white)](https://python.org)
[![Node.js](https://img.shields.io/badge/Node.js-18%2F20-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org)
[![XGBoost](https://img.shields.io/badge/Decision_Model-XGBoost_v4-green.svg)](ml/models/production/predicta_xgboost_model.json)
[![Tests](https://img.shields.io/badge/Pytest-708_tests-informational.svg)](tests/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**SIH 2026 — Problem Statement 170**

> **PREDICTA addresses semiconductor burn-in qualification by linking early telemetry, anomaly detection, degradation analysis, 168h prognostics, reliability validation and traceable qualification decisions in one decision chain.**

> **About PREDICTA:** SIH PS-170 semiconductor burn-in qualification system combining telemetry analysis, anomaly detection, degradation prognostics, physics validation, risk fusion, and traceable disposition.

---

## PREDICTA at a Glance

- **INPUT:** Burn-in / ATE telemetry including electrical and thermal observations (`Iddq`, `Leakage`, `Tpd`, `Vth`, `Temp`).
- **ANALYSIS:** Dynamic anomaly detection (MAD, COPOD, Isolation Forest) and time-series degradation analysis.
- **PREDICTION:** 168h prognostic analysis with uncertainty information.
- **DECISION:** Multi-evidence qualification with **PASS / MONITOR / REJECT**, followed by governed human review and traceability.

---

## Core Positioning

> [!IMPORTANT]
> **PREDICTA does not stop at predicting whether a component may fail; it builds a traceable, physics-aware evidence chain for deciding whether that component should be trusted, monitored, or rejected.**

---

## PREDICTA Workflow

> **Telemetry → Anomaly Detection → Degradation Analysis → 168h Prognostics → Uncertainty → Physics Validation → Risk Fusion → PASS / MONITOR / REJECT → Human Review → Traceability**

1. **Telemetry Ingestion:** Receives raw parametric burn-in observations and computes derived reliability features.
2. **Anomaly Detection:** Evaluates whether a component deviates from its lot or population baseline.
3. **Degradation Analysis:** Examines time-series parameter drift across early burn-in checkpoints.
4. **168h Prognostics:** Projects early 0h+24h observations forward through the 168h burn-in horizon.
5. **Uncertainty Analysis:** Evaluates uncertainty bounds around projected degradation trajectories.
6. **Physics Validation:** Verifies ML-derived evidence against semiconductor degradation mechanisms (BTI, thermal, leakage, timing).
7. **Risk Fusion:** Combines independent evidence streams into an operational disposition.
8. **Qualification Decision:** Issues a governed **PASS / MONITOR / REJECT** determination at threshold $\theta^* = 0.20$.
9. **Human Review:** Routes flagged components to operator review and secondary-test adjudication.
10. **Traceability:** Logs complete decision provenance in the 10-stage Digital Reliability Twin.

---

## Two Core ML Modules

### Module A — Dynamic Outlier Detection

**Population → MAD / COPOD / Isolation Forest → Outlier Evidence**

Module A looks for components whose behaviour is unusual relative to their population or temporal context. It is intended to surface off-trend behaviour that may not be obvious from a single static measurement, including dies that pass static parametric limits but exhibit significant lot-relative deviation.

---

### Module B — Time-Series Drift / 168h Prognostics

**0h + 24h observations → future trajectory → 168h horizon**

Module B uses early observations (0h + 24h) to characterize how device behaviour may evolve through the 168h burn-in horizon, evaluating whether initial drift indicates an eventual reliability concern before a physical failure occurs.

---

## Why PREDICTA is Different

### Conventional Point-in-Time Screening
Checks whether measured values cross predefined static limits at a single test point. Components with subtle drift can pass fixed limits and fail later in the field.

### PREDICTA Evidence Chain
Connects early telemetry, abnormal behaviour, degradation, future 168h trajectory, uncertainty, physics evidence, risk fusion, qualification, human review and traceability into one continuous reliability decision chain.

---

## SIH Judge Remarks — What Makes PREDICTA Distinct

> **PREDICTA is not only an anomaly detector or a 168h predictor. It connects multiple reliability-evidence stages into one traceable qualification workflow.**

### 1. Latent-Defect Focus
PREDICTA looks beyond a single pass/fail measurement to identify abnormal behaviour that may precede an observable reliability failure.

### 2. Physics-Aware Validation
ML-derived evidence can be checked against reliability mechanisms including BTI, timing degradation, leakage and thermal behaviour.

### 3. Uncertainty-Aware Analysis
Future trajectory estimates are accompanied by uncertainty information. Where calibration is not authorized for production decision authority, it functions as supporting evaluation capability.

### 4. Multi-Evidence Decision Chain
The final screening process can combine anomaly, degradation, prognostic, physics and risk evidence rather than relying on one model score alone.

### 5. Explainable Screening
The system exposes supporting evidence and model counterfactual information for flagged cases.

### 6. Human-in-the-Loop
Model output can proceed to governed operator review and disposition.

### 7. Full Traceability
The Reliability Twin preserves the progression from observation through analysis, disposition and outcome evidence.

### 8. Engineering Governance
Protected artifacts, provenance, checksum controls, testing, security, threshold controls ($\theta^* = 0.20$) and calibration governance support the decision workflow.

---

## From Anomaly Detection to Reliability Qualification

**Anomaly Detection:**  
*"Something looks unusual."*

**PREDICTA Qualification:**  
*"Something looks unusual → where is it heading by 168h → is the behaviour physically consistent → what combined evidence supports the decision → what should happen next?"*

---

## System Structure

### Data Layer
Burn-in / ATE telemetry, production dataset v4 (50,000 records, SHA-256 verified) and supporting evaluation datasets (ST-AWFD, SECOM, AI4I, NASA PCoE IGBT #8).

### ML / Analytics Layer
Dynamic anomaly detection (MAD, COPOD, Isolation Forest), degradation analysis, 168h prognostics (XGBoost v4 + Platt calibration), uncertainty analysis and model counterfactual explainability.

### Reliability Layer
Physics consistency (BTI, thermal acceleration, leakage, timing), multi-evidence risk fusion and latent-defect screening matrix.

### Decision & Governance Layer
Governed qualification decision (PASS / MONITOR / REJECT @ $\theta^* = 0.20$), human disposition workflow, Digital Reliability Twin and lifecycle auditability.

---

## How PREDICTA Addresses SIH PS-170

| SIH PS-170 Need | PREDICTA Capability | Implementation Component |
|---|---|---|
| **Burn-in telemetry** | Telemetry ingestion and feature analysis | Ingestion Engine (`src/features/`) |
| **Latent defect identification** | Dynamic anomaly + degradation analysis | Module A (`src/anomaly_detection/`) |
| **Reliability prediction** | 168h prognostic trajectory analysis | Module B (`src/prognostics/`) |
| **Physical evidence** | Physics-aware validation | Physics Engine (`src/physics/`) |
| **Qualification decision** | Multi-evidence risk fusion | Risk Fusion (`src/risk_fusion/`) |
| **Human decision process** | Governed disposition workflow | Operator Interface (`frontend/`) |
| **Evidence retention** | Digital Reliability Twin traceability | Reliability Twin (`src/reliability_twin/`) |

---

## ML and Reliability Stack Details

| Component | Function / Role | Location |
|---|---|---|
| **XGBoost v4** | Primary automated failure-risk classifier | `ml/models/production/predicta_xgboost_model.json` |
| **Platt Calibration** | Sigmoid calibration ($A = -1.0412, B = 1.0037$) | `src/api/inference_service.py` |
| **Robust MAD / PAT** | Lot-relative univariate and bivariate anomaly detection | `src/anomaly_detection/` |
| **COPOD** | Copula-based multivariate tail anomaly estimation | `src/anomaly_detection/` |
| **Isolation Forest** | High-dimensional non-linear anomaly isolation | `src/anomaly_detection/` |
| **168h Trajectory Engine** | Extends early 0h+24h observations to 168h horizon | `src/prognostics/` |
| **GPR & Conformal** | Supporting continuous degradation and uncertainty analysis | `src/prognostics/` |
| **Physics Engine** | BTI, thermal, leakage, and timing consistency validation | `src/physics/` |
| **Risk Fusion** | Integrates independent evidence streams into operational disposition | `src/risk_fusion/` |
| **Counterfactual Engine** | Model-level feature change explanations for flagged devices | `src/explainability/` |
| **Reliability Twin** | 10-stage immutable audit trail across device lifecycle | `src/reliability_twin/` |

---

## Protected Production Artifacts

| Artifact | File Location | SHA-256 Checksum |
|---|---|---|
| **Production Telemetry Dataset v4** | `ml/data/synthetic/predicta_dataset_v4_production.csv` | `9a8367a96a7d2dcf83a62e9c0e02ab41502b6069deebc116a0e9cd0ef45fab24` |
| **Production XGBoost v4 Model** | `ml/models/production/predicta_xgboost_model.json` | `91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98` |
| **GPR Kernel Artifact** | `ml/models/production/gpr_kernel_config.json` | `1d5fd207ecbd8fed31c09c9e0e8f4655b72f2596ba6c9faf421c7d54fd6a3fcf` |
| **Conformal Calibration Artifact** | `ml/models/production/conformal_bounds.json` | `198eaa50f5af96aa85721f168abc947a6cabfc02d91f77d1a032c343f85e7e7e` |
| **Dataset Split Manifest** | `ml/models/production/dataset_split_manifest.json` | `dbe10900c5adda3610e562551af504ee7aaf1b31104ce945e8a71ff2d063ce7c` |

---

## Verification & Execution

```bash
# 1. Run Node.js & Pytest Governance Suites
npm test
python -m pytest tests/ -v

# 2. Verify Python / Node.js Parity
npm run test:parity

# 3. Certify Production Artifacts & Checksums
npm run certify:production

# 4. Run PS-170 Traceability Demonstration
node src/demo_ps170_traceability.js
```

---

## Project Structure

```
predicta-26/
├── src/
│   ├── api/                 Inference & REST API services
│   ├── anomaly_detection/   MAD, COPOD, Isolation Forest engines
│   ├── features/            Feature contract & validation rules
│   ├── physics/             BTI, Thermal, Leakage consistency checks
│   ├── prognostics/         168h trajectory & uncertainty analysis
│   ├── risk_fusion/         Multi-evidence fusion matrix
│   ├── decision_engine/     PASS / MONITOR / REJECT routing
│   ├── explainability/      Model counterfactual explanations
│   └── reliability_twin/    10-stage lifecycle audit trail
├── ml/
│   ├── data/                Primary, external, and evaluation datasets
│   ├── models/production/   SHA-256 protected model artifacts
│   └── research/            Supporting experimental scripts
├── docs/                    Architecture, API specs, and runbooks
├── frontend/                Operator-facing UI interface
├── tests/                   Automated test and security suites
└── index.html               Main demonstration application
```

---

**PREDICTA-26** · Semiconductor Burn-In Telemetry & Latent Defect Screening  
[GitHub Repository](https://github.com/umeshpandeysh/predicta-26)
