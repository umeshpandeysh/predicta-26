# PREDICTA-26 — ML Authority & Certification Master Specification

**Repository:** `umeshpandeysh/predicta-26`
**Problem Statement:** SIH 2026 PS-170 — Semiconductor Burn-In Telemetry & Latent Defect Screening
**Status:** AUTHORITATIVE MASTER SPECIFICATION (SINGLE SOURCE OF TRUTH)
**Version:** `1.0.0_authoritative`

---

## 1. Executive Summary & Single Source of Truth Hierarchy

This document serves as the **Single Source of Truth (SSOT)** for all Machine Learning (ML) authority, model lineage, cryptographic provenance, operational thresholds, subsystem component boundaries, and documentation classification within the PREDICTA-26 platform.

All downstream documentation, performance reports, API schemas, and user interfaces MUST strictly conform to the hierarchy below:

```text
ML_AUTHORITY_AND_CERTIFICATION_MASTER (docs/ML_AUTHORITY_AND_CERTIFICATION_MASTER.md)
└── 1. Production Manifest (ml/models/production/predicta_production_manifest.json)
    └── 2. Production Metadata & Model (ml/models/production/predicta_xgboost_metadata.json & predicta_xgboost_model.json)
        └── 3. Evaluation & Governance Contracts (src/evaluation/ & ml/models/production/predicta_gpr_kernel_artifacts.json)
            └── 4. System Documentation & UI Summaries (README.md, REPOSITORY_AUTHORITY.md, dashboard)
```

No downstream document or user-interface layer may alter, override, or invent model identifiers, version tags, cryptographic hashes, or operating thresholds.

---

## 2. System Versioning & Lineage Terminology Standard

To eliminate ambiguity across code repositories, scientific publications, and automated audit tools, PREDICTA-26 explicitly differentiates **System Release Versioning** from **Model Lineage Versioning**:

| Version Dimension | Authoritative Tag | Description / Scope |
|---|---|---|
| **System Release Version** | `2.0_production` / `v2.0.0` | Represents the full-stack software system release, including API gateways, interactive workstation dashboard, risk fusion engine, persistence adapters, and security guard layers. |
| **Model Lineage Version** | `4.0.0` | Represents the supervised ML model iteration lineage trained on the v4 synthetic production dataset (`predicta_dataset_v4_production.csv`). |
| **Metadata Model Identifier** | `4.0.0_authoritative` | The exact version tag embedded in `predicta_production_manifest.json` and `predicta_xgboost_metadata.json`. |

> **Reviewer Guidance Notice:** System Release Version `2.0_production` and Model Lineage Version `4.0.0_authoritative` are complementary identifiers. `2.0_production` denotes the platform software release, while `4.0.0_authoritative` denotes the 4th major evolution of the XGBoost classifier architecture (v1.0 initial research $\rightarrow$ v2.0 feature engineering $\rightarrow$ v3.0 50k tuning $\rightarrow$ v4.0.0 authoritative production dataset & Platt scaling).

---

## 3. Immutable Cryptographic Production Artifact Register

The following five production artifacts are immutable and cryptographically bound to the production build:

| Parameter / Artifact | Authoritative Value | Authoritative Source Artifact | Status |
|---|---|---|---|
| **Production Model Path** | `ml/models/production/predicta_xgboost_model.json` | `predicta_production_manifest.json` | `LOCKED` |
| **Model SHA-256** | `91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98` | `predicta_production_manifest.json` | `IMMUTABLE` |
| **Model Version** | `4.0.0_authoritative` | `predicta_production_manifest.json` | `LOCKED` |
| **Production Dataset Path** | `ml/data/synthetic/predicta_dataset_v4_production.csv` | `predicta_production_manifest.json` | `LOCKED` |
| **Dataset SHA-256** | `9a8367a96a7d2dcf83a62e9c0e02ab41502b6069deebc116a0e9cd0ef45fab24` | `predicta_production_manifest.json` | `IMMUTABLE` |
| **GPR Artifact Path** | `ml/models/production/predicta_gpr_kernel_artifacts.json` | `predicta_production_manifest.json` | `LOCKED` |
| **GPR SHA-256** | `1d5fd207ecbd8fed31c09c9e0e8f4655b72f2596ba6c9faf421c7d54fd6a3fcf` | `predicta_production_manifest.json` | `IMMUTABLE` |
| **Production Manifest Path**| `ml/models/production/predicta_production_manifest.json` | Repository Governance Gate | `LOCKED` |
| **Manifest SHA-256 (LF)** | `065a278afa4c45636e6235bb879d68e19c1e0f44e8ff13682ff6ccffbfb5bb11` | `.gitattributes` (`eol=lf`) | `IMMUTABLE` |
| **Operating Threshold ($\theta^*$)** | `0.20` | `predicta_production_manifest.json` | `LOCKED` |
| **Feature Schema Count** | 28 Features (16 raw ATE + 7 engineered + 5 one-hot) | `predicta_xgboost_metadata.json` | `LOCKED` |

---

## 4. Component Scope & Boundary Declarations

Every subsystem component in PREDICTA-26 declares its explicit operational scope and scientific boundaries:

1. **Supervised XGBoost Classifier:**
   - **Status:** `PRODUCTION_AUTHORIZED`
   - **Operating Threshold:** Locked at $\theta^* = 0.20$.
   - **Scope:** Primary inference classifier for latent defect screening. Calibrated via Platt sigmoid scaling on the synthetic dataset split.

2. **Gaussian Process Regression (GPR) Degradation Forecaster:**
   - **Status:** `REPRODUCIBLE_HISTORICAL_LINEAGE` / `BENCHMARK_PROGNOSTIC_COMPONENT`
   - **Scope:** In-process degradation trajectory forecasting from pre-computed RBF kernel weights (`predicta_gpr_kernel_artifacts.json`, SHA-256 `1d5fd207...`) evaluated on synthetic lot splits. Zero runtime server-side retraining. Detailed provenance in [`docs/GPR_LINEAGE_AND_PROVENANCE.md`](docs/GPR_LINEAGE_AND_PROVENANCE.md).

3. **Conformal Uncertainty Bounds:**
   - **Status:** `BENCHMARK_EVALUATION_ONLY` / `NOT_EMPIRICALLY_CALIBRATED_PRODUCTION_BASELINE`
   - **Scope:** Conformal prediction intervals evaluated in synthetic scenario benchmarks (`ml/models/production/conformal_calibration_artifacts.json`). Not claimed as empirically calibrated on physical fab production lines.

4. **Out-of-Distribution (OOD) Anomaly Router:**
   - **Status:** `BENCHMARK_SCREENING_ONLY` (`is_authoritative_decision_input: false`)
   - **Scope:** Operates as an observational screening layer using PAT/MAD Z-Scores and COPOD copulas. Cannot override supervised production decisions.

5. **External Dataset Benchmarks (ST-AWFD, UCI SECOM, NASA MOSFET):**
   - **Status:** `TRANSFER_EVALUATION_ONLY`
   - **Scope:** Evaluated in `ml/benchmarks/` to measure generalizability and domain transfer limits. Used for scientific benchmarking; zero physical fab flight deployment claims.

6. **Synthetic Dataset Baseline Disclosure:**
   - **Status:** `SYNTHETIC_PHYSICS_GROUND_TRUTH` / `SYNTHETIC_BENCHMARK`
   - **Scope:** All 50,000 dataset records originate from physics-informed synthetic generation (`generator.py`). Physical commercial fab ATE hardware pilot integration is designated future work.

---

## 5. Operating Threshold Evolution & Discrepancy Resolution Protocol

### 5.1 Operating Threshold Evolution

> [!NOTE]
> **HISTORICAL / EXPERIMENTAL CONFIGURATION**
> This section records earlier milestone experiments where an operating threshold of 0.45 was evaluated.
> Operating threshold 0.45 is not used by the active production system.
> The current authoritative production operating threshold is strictly **0.20**.

- **Historical Milestone Threshold (`0.45`):** During early research (Days 19–20), an operating threshold of `0.45` was evaluated. Historical milestone documents record this configuration for engineering traceability. All historical files carry an explicit disclaimer banner.
- **Authoritative Operating Threshold (`0.20`):** The active production threshold is locked at `0.20` across all runtime code (`src/api/inference_service.py`, `src/api/inference.js`), manifests (`predicta_production_manifest.json`), metadata, and unit/parity tests.

### 5.2 Discrepancy Resolution Protocol
Whenever a metric or claim appears in documentation or test scripts:
1. Verify against `ml/models/production/predicta_production_manifest.json`.
2. Trace numerical performance to the exact split and evaluation artifact:
   - *Training Split Metrics:* `predicta_xgboost_metadata.json` (ROC-AUC: 0.9939, Log Loss: 0.0590, Accuracy: 0.9639).
   - *Locked Test Partition Metrics:* `predicta_xgboost_metadata.json` (ROC-AUC: 0.9997, Accuracy: 0.9912, Recall: 0.9952, Precision: 0.9806).
   - *Scenario Fixture Metrics:* `ml/reports/ps170_latent_escape_report.json` (Scenario Fixture Routing Benchmark).
3. If an evaluation cannot be performed with available data, the status MUST remain `NOT_ESTABLISHED` rather than fabricating metrics.

---

## 6. Comprehensive Repository ML Document Classification Ledger

All ML-facing documentation across the repository is classified into four explicit governance categories:

### Category 1: CURRENT AUTHORITATIVE (Single Source of Truth Documents)
These documents specify active architectural standards, cryptographic hashes, line-ending governance, and system authority.

| Document Path | Description / Role |
|---|---|
| [`docs/ML_AUTHORITY_AND_CERTIFICATION_MASTER.md`](file:///c:/Users/UMESH%20PANDEY/Downloads/ceenew/docs/ML_AUTHORITY_AND_CERTIFICATION_MASTER.md) | Master ML Authority Specification & Document Ledger (This Document). |
| [`docs/REPOSITORY_AUTHORITY.md`](file:///c:/Users/UMESH%20PANDEY/Downloads/ceenew/docs/REPOSITORY_AUTHORITY.md) | Single Source of Truth Hierarchy and Protected Constants. |
| [`docs/DATA_AND_EVALUATION_AUTHORITY.md`](file:///c:/Users/UMESH%20PANDEY/Downloads/ceenew/docs/DATA_AND_EVALUATION_AUTHORITY.md) | Data engineering, feature contract, and split manifest authority chain. |
| [`docs/CURRENT_SYSTEM_AUTHORITY.md`](file:///c:/Users/UMESH%20PANDEY/Downloads/ceenew/docs/CURRENT_SYSTEM_AUTHORITY.md) | Executable system precedence and scientific presentation rules. |
| [`docs/GPR_LINEAGE_AND_PROVENANCE.md`](file:///c:/Users/UMESH%20PANDEY/Downloads/ceenew/docs/GPR_LINEAGE_AND_PROVENANCE.md) | GPR degradation forecaster lineage, math formulation, and cryptographic hash proof. |
| [`docs/PHASE12_TASK2_PARITY_CERTIFICATION.md`](file:///c:/Users/UMESH%20PANDEY/Downloads/ceenew/docs/PHASE12_TASK2_PARITY_CERTIFICATION.md) | Cross-runtime Node.js ↔ Python parity certification ($\le 10^{-6}$ error bound). |
| [`docs/PHASE_17_4_AUDIT.md`](file:///c:/Users/UMESH%20PANDEY/Downloads/ceenew/docs/PHASE_17_4_AUDIT.md) | Task 4 line-ending governance and canonical manifest identity audit. |
| [`docs/PHASE_16_FINAL_AUDIT.md`](file:///c:/Users/UMESH%20PANDEY/Downloads/ceenew/docs/PHASE_16_FINAL_AUDIT.md) | Phase 16 system audit, parity verification, and fail-closed security summary. |
| [`docs/PS170_TRACEABILITY_MATRIX.md`](file:///c:/Users/UMESH%20PANDEY/Downloads/ceenew/docs/PS170_TRACEABILITY_MATRIX.md) | SIH PS-170 14-step end-to-end component traceability matrix. |
| [`README.md`](file:///c:/Users/UMESH%20PANDEY/Downloads/ceenew/README.md) | Public platform overview, architecture diagrams, quickstart, and badges. |

### Category 2: HISTORICAL / EXPERIMENTAL (Preserved Milestone Logs)
These documents record earlier research iterations, historical threshold evaluations (`0.45`), daily development logs, and previous certification snapshots. They are preserved for engineering traceability with explicit historical banners.

| Document Path | Description / Role |
|---|---|
| `docs/day12_*` through `docs/day35_*` (100+ files) | Daily milestone reports, red-team audits, and experimental evaluation logs. |
| `docs/EXP-15A_*` through `docs/EXP-15E_*`, `docs/EXP-15_RESEARCH_SYNTHESIS.md` | Research challenger experiment logs (calibration, cost-sensitive, pruning). |
| `docs/adversarial_model_audit.md` | Historical adversarial audit evaluated at threshold `0.45`. |
| `docs/counterfactual_audit.md` | Historical counterfactual feature sensitivity audit evaluated at threshold `0.45`. |
| `docs/PREDICTA_PRODUCTION_CERTIFICATION.md` | Historical production certification snapshot (August 2026). |
| `docs/FINAL_PRODUCTION_CERTIFICATION.md` | Legacy release certificate snapshot. |
| `docs/RELEASE_CERTIFICATE_v2.0.0.md` | Historical release readiness certificate. |
| `docs/FINAL_PHASE3_PRODUCTION_CERTIFICATION.md` | Phase 3 completion certification snapshot. |
| `docs/SIH_FINAL_TECHNICAL_DEFENSE.md` | Technical defense slides and competition QA index. |
| `docs/SIH_JUDGE_TECHNICAL_DEFENSE.md` | Extended technical presentation for SIH jury review. |
| `docs/TECHNICAL_EVALUATION_DOSSIER.md` | Technical compilation for SIH evaluation panel. |

### Category 3: BENCHMARK / DEFERRED (Non-Production Evaluation Artifacts)
These documents record offline benchmark evaluation suites, external transfer checks, and non-authoritative screening experiments.

| Document Path | Description / Role |
|---|---|
| [`docs/FINAL_ML_BENCHMARK_REPORT.md`](file:///c:/Users/UMESH%20PANDEY/Downloads/ceenew/docs/FINAL_ML_BENCHMARK_REPORT.md) | Synthetic scenario fixture benchmark report (PS-170 routing benchmark). |
| `docs/datasets/stage8_external_ml_benchmarking.md` | External dataset transfer evaluation on NASA MOSFET, UCI SECOM, and ST-AWFD. |
| `src/evaluation/cost_contract.py` / `cost_contract.js` | Phase 9 cost-sensitive evaluation contracts (benchmark evaluation only). |
| `ml/models/production/conformal_calibration_artifacts.json` | Conformal uncertainty calibration benchmark artifacts. |

### Category 4: STALE / AMBIGUOUS (Superseded Operational Documents)
These documents contain legacy cloud/Vercel hosting claims, old setup notes, or superseded operational instructions. They are retained for historical context but overridden by Current Authoritative standards.

| Document Path | Description / Role |
|---|---|
| `docs/VERCEL_DEPLOYMENT_RECORD.md` | Legacy Vercel serverless deployment record (Superseded by local/Docker production API). |
| `docs/FINAL_LIVE_VERCEL_SUPABASE_VERIFICATION.md` | Historical Vercel/Supabase integration check. |
| `docs/FINAL_CLOUD_DEPLOYMENT_VERIFICATION.md` | Historical cloud infrastructure audit. |
| `docs/FINAL_VERCEL_DEPLOYMENT_AUDIT.md` | Legacy Vercel edge function audit. |
| `docs/PRODUCTION_DEPLOYMENT_STATUS.md` | Historical deployment status report. |

---

## 7. Canonical Execution Commands for Verification

| Action | Canonical Command |
|---|---|
| **Run Core Regression Suite** | `npm run test:core` |
| **Run Release Certification** | `npm run test:release` |
| **Run Full Production Certification** | `npm run certify:production` |
| **Run Python Unit & Pytest Suite** | `node scripts/run_pytest.js` |
| **Run Python Code Linter** | `& "C:\Users\UMESH PANDEY\python311\python.exe" -m ruff check src tests` |
| **Run Parity Test Suite** | `npm run test:parity` |
| **Run PS-170 Traceability Demo** | `node src/demo_ps170_traceability.js` & `python src/demo_ps170_traceability.py` |
