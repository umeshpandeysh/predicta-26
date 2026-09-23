# PREDICTA-26 — REPOSITORY AUTHORITY SPECIFICATION

**Repository:** `umeshpandeysh/predicta-26`  
**Problem Statement:** SIH 2026 PS-170 — Semiconductor Burn-In Telemetry & Latent Defect Screening  
**Status:** AUTHORITATIVE ARCHITECTURAL STANDARD  
**Version:** `1.0.0_authoritative`  

---

## 1. Single Source of Truth Hierarchy

All architectural decisions, release gating, performance documentation, and user interfaces within the PREDICTA-26 platform must strictly adhere to the following single source of truth hierarchy:

```text
REPOSITORY_AUTHORITY
└── 1. Production Manifest (ml/models/production/predicta_production_manifest.json)
    └── 2. Production Metadata (ml/models/production/predicta_xgboost_metadata.json)
        └── 3. Evaluation & Governance Artifacts (experiments/ & ml/reports/)
            └── 4. Documentation & UI Summaries (README.md, dashboard, evidence cards)
```

No downstream document or user-interface layer may alter, override, or invent model identifiers, version tags, cryptographic hashes, or operating thresholds.

---

## 2. Protected Production Authority Constants

The following parameters are immutable and cryptographically bound to the production build:

| Parameter | Authoritative Value | Authoritative Source Artifact | Status |
|---|---|---|---|
| **Production Model Path** | `ml/models/production/predicta_xgboost_model.json` | `predicta_production_manifest.json` | LOCKED |
| **Model SHA-256** | `91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98` | `predicta_production_manifest.json` | IMMUTABLE |
| **Model Version** | `4.0.0_authoritative` | `predicta_production_manifest.json` | LOCKED |
| **Production Dataset Path**| `ml/data/synthetic/predicta_dataset_v4_production.csv` | `predicta_production_manifest.json` | LOCKED |
| **Dataset SHA-256** | `9a8367a96a7d2dcf83a62e9c0e02ab41502b6069deebc116a0e9cd0ef45fab24` | `predicta_production_manifest.json` | IMMUTABLE |
| **GPR Artifact Path** | `ml/models/production/predicta_gpr_kernel_artifacts.json` | `predicta_production_manifest.json` | LOCKED |
| **GPR SHA-256** | `1d5fd207ecbd8fed31c09c9e0e8f4655b72f2596ba6c9faf421c7d54fd6a3fcf` | `predicta_production_manifest.json` | IMMUTABLE |
| **Operating Threshold ($\theta^*$)** | `0.20` | `predicta_production_manifest.json` | LOCKED |
| **Feature Schema Count** | 28 Features (16 raw + 7 engineered + 5 one-hot) | `predicta_xgboost_metadata.json` | LOCKED |

---

## 3. Calibration & Governance Status Declarations

To prevent evidence fabrication and misrepresentation, every subsystem declares its exact provenance and calibration scope:

1. **Production XGBoost Classifier:**
   - *Status:* `PRODUCTION_AUTHORIZED`
   - *Calibration:* Platt sigmoid empirical scaling on synthetic dataset split (`predicta_xgboost_metadata.json`).
2. **Conformal Uncertainty Bounds:**
   - *Status:* `BENCHMARK_EVALUATION_ONLY` / `NOT_CALIBRATED`
   - *Scope:* Validated in synthetic scenario benchmarks; not empirically calibrated on physical fab production lines.
3. **Out-of-Distribution (OOD) Classifier:**
   - *Status:* `GOVERNED_HEURISTIC_SPECIFICATION` / `NOT_EMPIRICALLY_CALIBRATED_PRODUCTION_BASELINE`
   - *Scope:* `BENCHMARK_SCREENING_ONLY` (`is_authoritative_decision_input: false`). Operates as an observational screening layer and cannot override production decisions.
4. **Reliability Twin:**
   - *Status:* `EVIDENCE_READ_MODEL_ONLY`
   - *Scope:* Append-only immutable record derived solely from verified pipeline evidence; zero speculative state mutations.
5. **Gaussian Process Regression (GPR) Degradation Forecaster:**
   - *Status:* `REPRODUCIBLE_HISTORICAL_LINEAGE` / `BENCHMARK_PROGNOSTIC_COMPONENT`
   - *Scope:* In-process degradation trajectory forecasting from pre-computed RBF kernel weights (`predicta_gpr_kernel_artifacts.json`, SHA-256 `1d5fd207...`) evaluated on synthetic lot splits; zero runtime retraining. Detailed provenance in `docs/GPR_LINEAGE_AND_PROVENANCE.md`.

---

## 4. Discrepancy Resolution Protocol

Whenever a metric or claim appears in documentation or test scripts:
1. Verify against `predicta_production_manifest.json`.
2. Trace numerical performance to the exact split and evaluation artifact:
   - *Training Split Metrics:* `predicta_xgboost_metadata.json` (ROC-AUC: 0.9939, Log Loss: 0.0590, Accuracy: 0.9639).
   - *Locked Test Partition Metrics:* `predicta_xgboost_metadata.json` (ROC-AUC: 0.9997, Accuracy: 0.9912, Recall: 0.9952, Precision: 0.9806).
   - *Scenario Fixture Metrics:* `ml/reports/ps170_latent_escape_report.json` (Scenario Fixture Routing Benchmark).
3. If an evaluation cannot be performed with available data, the status must remain `NOT_ESTABLISHED` rather than fabricating metrics.
