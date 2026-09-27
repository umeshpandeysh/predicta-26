# PREDICTA-26
## Predictive Reliability Engine for Dynamic Identification, Component Testing & Analysis

[![SIH 2026](https://img.shields.io/badge/SIH-2026-orange.svg)](https://sih.gov.in)
[![Problem Statement 170](https://img.shields.io/badge/PS--170-ISRO_%2F_DoS-blue.svg)](docs/PS170_TRACEABILITY_MATRIX.md)
[![Live Production](https://img.shields.io/badge/Production-Live_Vercel_Edge-success.svg)](https://predicta-26-pi.vercel.app)
[![Decision Model](https://img.shields.io/badge/Decision_Model-Native_XGBoost_v4-green.svg)](ml/models/production/predicta_xgboost_model.json)
[![Operating Threshold](https://img.shields.io/badge/Operating_Threshold-θ*_=_0.20_Locked-blueviolet.svg)](ml/models/production/predicta_production_manifest.json)
[![Tests](https://img.shields.io/badge/Tests-88%2F88_Passing_(100%25)-brightgreen.svg)](tests/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

> 🚀 **SIH 2026 Evaluator Fast-Track:**
> * ⏱️ **60-Second Orientation:** [**Judge & Reviewer Guide**](docs/JUDGE_GUIDE.md) — Fast-track walkthrough of problem, models, and evidence.
> * 🗺️ **Canonical Production Path:** [**Architecture Specification**](docs/architecture/canonical-production-path.md) — Authoritative stage-by-stage data flow and source mapping.
> * 📋 **Model & Governance Catalog:** [**Model Registry**](docs/models/model-registry.md) — Definitive status (`PRODUCTION`, `CHALLENGER`, `BENCHMARK`, `CALIBRATION_PENDING`) for all models.
> * 🔬 **Phase 2 Scientific Validation:** [**Validation Report**](docs/validation/phase2-scientific-validation.md) — Empirical evidence on Mahalanobis challenger, conformal calibration, and external datasets.
> * 📋 **PS-170 Traceability Matrix:** [**Traceability Index**](docs/PS170_TRACEABILITY_MATRIX.md) — Requirement-to-code mapping for PS170-01 through PS170-15.
> * 🌐 **Live Cloud Workstation:** [**https://predicta-26-pi.vercel.app**](https://predicta-26-pi.vercel.app) — Zero-install production deployment.

---

## 1. Problem Statement & Executive Summary

* **Problem Statement (SIH 2026 PS-170 / ISRO):** In high-reliability spaceflight electronics, integrated circuits undergo 168 hours of high-temperature (125°C) electrical burn-in testing. Conventional screening evaluates only static, point-in-time tolerance limits ($L_{\text{min}} \le X \le L_{\text{max}}$). Latent defects (gate-oxide micro-voids, interface traps, metallization thinning) pass static limits initially at 0h/24h but degrade catastrophically during flight missions.
* **The PREDICTA Solution:** PREDICTA-26 is a physics-informed, fail-closed semiconductor screening engine that analyzes early electrical telemetry ($0\text{h}$ and $24\text{h}$), detects out-of-family multivariate anomalies (PAT-MAD, COPOD, Isolation Forest), forecasts continuous 168h degradation trajectories with Bayesian GPR, validates physical degradation kinetics (Arrhenius, Black's EM, BTI), and synthesizes governed factory dispositions (`PASS`, `MONITOR`, `REJECT`) backed by an immutable Digital Reliability Twin audit trail.

---

## 2. What PREDICTA Does

| Dimension | Specification |
| :--- | :--- |
| **What is PREDICTA?** | An automated, fail-closed semiconductor qualification and latent defect screening engine for aerospace and spaceflight electronics. |
| **Why does it matter?** | Eliminates in-flight mission failures caused by latent defects escaping static ATE checks, while preventing wasteful scrap of healthy silicon caused by benign process drift. |
| **What goes in?** | Early burn-in parametric telemetry at $0\text{h}$ baseline and $24\text{h}$ checkpoint: supply voltage ($V_{\text{dd}}$), standby leakage ($I_{\text{ddq}}$), gate leakage ($I_{\text{leak}}$), propagation delay ($t_{\text{pd}}$), threshold voltage ($V_{\text{th}}$), temperature, and equipment station ID. |
| **What comes out?** | 1. Defect probability $P(\text{Defect}) \in [0, 1]$ from calibrated Native XGBoost.<br>2. Lot-relative anomaly status and multivariate Z-scores.<br>3. Continuous 168h parameter drift forecast with 95% Bayesian confidence bounds.<br>4. Governed operational disposition (`PASS` / `MONITOR` / `REJECT`) locked at threshold $\theta^* = 0.20$.<br>5. Deterministic **Evidence Card** explaining risk attributions and immutable **Reliability Twin** audit trail in PostgreSQL. |

---

## 3. 60-Second Engineering Flow

```text
    Raw Telemetry (0h, 24h)
              │
              ▼
    [ Data Quality Gate ] ──────── Rejects unphysical ranges & non-numeric data
              │
              ▼
    [ Multi-Model Core ] ──────── Native XGBoost + PAT-MAD + COPOD + Bayesian GPR 168h + Arrhenius Kinetics
              │
              ▼
    [ Governed Risk Fusion ] ──── Fuses anomaly scores, forecast bounds & defect risk deterministically
              │
              ▼
    [ Operational Disposition ] ── PASS (Ship) / MONITOR (Secondary QA) / REJECT (Quarantine) [θ* = 0.20]
              │
              ▼
    [ Evidence & Reliability Twin ] PostgreSQL Append-Only Ledger + Cryptographic State Hash
```

---

## 4. ML / Statistical / Physics Components

Every component currently in the PREDICTA architecture is explicitly cataloged with its operational status:

| Component | Role | Production Status | Input | Output | Why It Exists |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Native XGBoost Classifier** | Core Latent Defect Risk Estimation | **`PRODUCTION`** | 28 Continuous Engineered Features | Defect Probability $P \in [0, 1]$ | Primary supervised risk model for subtle non-linear defect separation. |
| **Robust PAT-MAD Detector** | Univariate Part Average Testing Outlier Screening | **`PRODUCTION`** | Normalized $(I_{\text{ddq}}, I_{\text{leak}}, t_{\text{pd}})$ | Parameter $Z$-scores & Status | First line of defense against extreme parametric drift ($Z > 6.0$). |
| **COPOD Empirical Copula Detector** | Multivariate Tail Anomaly Screening | **`PRODUCTION`** | Canonical $(I_{\text{ddq}}, I_{\text{leak}}, t_{\text{pd}})$ | Tail probability score & Status | Non-parametric detection of joint distribution shifts across parameters. |
| **Isolation Forest Detector** | Unsupervised Multi-Parameter Partitioning | **`PRODUCTION`** | Normalized 3D parameter vectors | Partition anomaly score & Status | Catches non-linear spatial parameter anomalies within nominal bounds. |
| **Bayesian GPR Forecaster** | 168h Continuous Degradation Forecasting | **`PRODUCTION`** | $0\text{h}$ baseline & $24\text{h}$ telemetry | 168h forecast mean $\mu$ and 95% CI | Projects continuous physical parameter trajectories to 168h burn-in endpoint. |
| **Physics Kinetics Engine** | Reliability & Degradation Validation | **`PRODUCTION`** | Voltage, Temperature ($T$), Frequency | Acceleration factors ($AF$), stress bounds | Enforces physical consistency (Arrhenius $E_a=0.7\text{ eV}$, Black's EM, BTI). |
| **Governed Risk Fusion Engine** | Multi-Criteria Decision Synthesis | **`PRODUCTION`** | ML $P$, Anomaly scores, GPR bounds | `PASS` / `MONITOR` / `REJECT` | Fail-closed operational policy; guarantees zero uncorroborated escapes. |
| **Mahalanobis Distance Challenger** | Covariance-Aware Outlier Challenger | **`CHALLENGER / BENCHMARK`** | Normalized $(I_{\text{ddq}}, I_{\text{leak}}, t_{\text{pd}})$ | Mahalanobis Distance $D_M$ | Standalone challenger baseline (Evaluated: ROC-AUC = 0.7894; adds 0 unique TPs). |
| **Split-Conformal Uncertainty** | Distribution-Free Prediction Intervals | **`BENCHMARK_ONLY / CALIBRATION_PENDING`** | GPR forecast residuals | 90% / 95% conformal intervals | Evaluated candidate intervals; held as benchmark pending physical silicon fab data. |
| **HistGradientBoosting (HGB)** | Tree Baseline Benchmark | **`BENCHMARK`** | 28 Engineered Features | Failure probability | Offline scientific baseline comparing XGBoost vs HGB vs RF. |
| **Random Forest / Logistic Reg.** | Classical Baselines | **`BENCHMARK`** | Raw numerical features | Binary classification | Demonstrates necessity of non-linear gradient boosted trees. |
| **Latent Trajectory Evaluator** | Oracle Retrospective Ground-Truth | **`VALIDATED`** | Full $0\text{h} \to 24\text{h} \to 168\text{h}$ trajectory | Latent defect verification | Ground-truth verification oracle used for retrospective benchmarking. |

---

## 5. Production vs Benchmark vs Challenger Model Hierarchy

The judge and reviewer can easily distinguish active production code from experimental research:

* **`PRODUCTION`**: Actively executing in the real-time serving loop ([`src/api/inference.js`](src/api/inference.js) / [`src/api/inference_service.py`](src/api/inference_service.py)), protected by cryptographic manifest hashes and verified by deterministic cross-runtime parity tests.
* **`CHALLENGER`**: Alternative model architectures (e.g. Mahalanobis Distance) scientifically evaluated on disjoint test lots and retained offline for auditability.
* **`BENCHMARK`**: Comparative baselines (HGB, Random Forest, Logistic Regression, External Datasets) used during ablation studies.
* **`CALIBRATION_PENDING`**: Statistical uncertainty frameworks (Split-Conformal prediction intervals) implemented and verified on synthetic cohorts, strictly marked `NOT_CALIBRATED` for production qualification pending real fab telemetry.
* **`VALIDATED`**: Offline oracle evaluators used for retrospective ground-truth scoring.
* **`HISTORICAL`**: Development milestone records (Days 1–35) preserved with explicit disclaimer banners for complete engineering provenance.

---

## 6. Development History vs. Canonical Production Path

```text
CURRENT PRODUCTION PATH (docs/architecture/canonical-production-path.md)
  └── Authoritative real-time serving path: Quality Gate → XGBoost + PAT/COPOD/GPR → Risk Fusion → PostgreSQL Twin

VALIDATED SUPPORTING EVIDENCE (docs/validation/phase2-scientific-validation.md)
  └── Mahalanobis Challenger Benchmark (ROC-AUC 0.7894) + Conformal Stability + External Datasets

RESEARCH & DEVELOPMENT HISTORY (docs/day*.md, ml/experiments/)
  └── 35-day iterative hardening milestones preserved for engineering auditability
```

> **Note for Judges:** You do NOT need to inspect all historical day documents. The **Canonical Production Path** ([`docs/architecture/canonical-production-path.md`](docs/architecture/canonical-production-path.md)) and the **Model Registry** ([`docs/models/model-registry.md`](docs/models/model-registry.md)) define what the active production system does.

---

## 7. Dataset & Provenance

* **Primary Production Dataset:** [`ml/data/synthetic/predicta_dataset_v3_50000.csv`](ml/data/synthetic/predicta_dataset_v3_50000.csv) (50,000 records, 17.77 MB).
* **Cohort Disjointness (`split_manifest.json`):**
  * **Train:** Lots `LOT-SYN-001` through `LOT-SYN-035` (3,500 dies) — Model parameter fitting.
  * **Validation/Tune:** Lots `LOT-SYN-036` through `LOT-SYN-038` (300 dies) — Hyperparameter tuning.
  * **Calibration:** Lots `LOT-SYN-039` through `LOT-SYN-042` (400 dies) — Conformal residual estimation only.
  * **Test (Held-Out):** Lots `LOT-SYN-043` through `LOT-SYN-050` (800 dies / 7,500 observations) — Frozen evaluation.
* **Cryptographic Hashes:**
  * Dataset SHA-256: `e2b969c458864b11ed61a6073ed1356adcbfd6775bb2c44b28023446bf9771fa`
  * Model SHA-256: `91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98`
* **Synthetic Data Disclosure:** The primary dataset is a physics-modeled synthetic qualification cohort generated to simulate JEDEC JESD22 burn-in standards. It is explicitly identified as synthetic data to maintain complete scientific honesty.

---

## 8. Validation Evidence & Proofs

1. **Cross-Runtime Numerical Parity ($\Delta = 0.000000$):** Dual implementations in pure Node.js Edge JavaScript ([`src/api/inference.js`](src/api/inference.js)) and Python ([`src/api/inference_service.py`](src/api/inference_service.py)) yield bit-level identical probabilities across all 12 nominal, borderline, and adversarial test vectors.
2. **Automated Test Suite (100% Passing):** 88 automated tests covering physics boundaries, risk fusion contracts, threshold governance, and cross-runtime parity:
   * `pytest tests/` $\to$ **83/83 PASSED**
   * `node tests/test_threshold_contract.js` $\to$ **11/11 PASSED**
   * `node tests/test_js_python_parity.js` $\to$ **12/12 PASSED**
   * `node tests/test_docs_threshold_consistency.js` $\to$ **PASSED (387 files checked)**
3. **Three Canonical Demonstration Cases ([`src/governance/canonical_demo_data.json`](src/governance/canonical_demo_data.json)):**
   * **Case A (`NORMAL`):** Nominal device ($I_{\text{leak}} = 111.7\,\mu\text{A}, V_{\text{th}} = 0.45\,\text{V}$) $\to$ **PASS** ($P = 0.0048$).
   * **Case B (`LATENT_DEFECT`):** Static ATE escape ($I_{\text{leak}} = 145\,\mu\text{A} < 250\,\mu\text{A}$ static limit, but PAT $Z = 6.08$ and 168h drift) $\to$ **REJECT** (Catches latent failure before packaging).
   * **Case C (`FALSE_ALARM`):** Benign process variation ($T_{\text{pd}} = 11.89\,\text{ns}$) $\to$ **MONITOR** (Prevents wasteful scrap of healthy flight silicon).

---

## 9. External Validation — What It Proves / What It Does Not Prove

To evaluate generalization across industrial semiconductor manufacturing and power devices, PREDICTA was benchmarked against four external datasets ([`experiments/external_benchmarks/`](experiments/external_benchmarks/)):

| Dataset | Nature & Size | Demonstrated (What It Proves) | NOT Demonstrated (What It Does Not Prove) |
| :--- | :--- | :--- | :--- |
| **ST-AWFD (D1/D2)** | 728k rows / 6,260 real wafer lots | **Group-Aware Generalization:** Zero-leakage GroupKFold cross-lot anomaly detection achieves $\text{ROC-AUC} \ge 0.82$. | Anonymous E-test columns do not map to physical CMOS parameters ($V_{\text{th}}, I_{\text{ddq}}$). |
| **UCI SECOM** | 1,567 wafers / 591 sensors | **Baseline Yield Benchmarking:** Leakage-safe preprocessor pipeline on high-dimensional manufacturing sensors. | High missingness and single-point in-line timestamps do not support longitudinal 168h prognostics. |
| **UCI AI4I 2020** | 10,000 synthetic milling samples | **Temporal Failure Separation:** Isolated temporal sensor features achieve $\text{ROC-AUC} = 0.884$ without diagnostic feature leakage. | Mechanical milling tool failure physics differ from silicon CMOS degradation kinetics. |
| **NASA IGBT** | Accelerated aging SMU sweeps | **Causal Degradation Defense:** Target current strictly excluded from feature matrix to prevent instantaneous target leakage. | Static SMU I-V sweeps lack longitudinal aging timestamps required for time-series degradation forecasting. |

---

## 10. Scientific Scope & Limitations

1. **Synthetic Telemetry Baseline:** Primary telemetry is generated via physics-informed simulation. While calibrated against standard CMOS parameters ($E_a = 0.70\text{ eV}$), full spaceflight qualification requires physical fab silicon data.
2. **168h Burn-In Evaluation Horizon:** 168 hours represents the standard JEDEC JESD22 burn-in screening duration, **not** an operational Mean Time Between Failures (MTBF) lifetime claim.
3. **External Datasets Are Benchmarks:** External datasets demonstrate statistical generalization only; they do not constitute multi-fab production qualification.
4. **Conformal Uncertainty Status:** Conformal prediction intervals are classified as **`BENCHMARK_ONLY / CALIBRATION_PENDING`**; production promotion is strictly locked until empirical silicon fab telemetry is available.
5. **Statistical Attribution vs. Physical Causality:** ML feature importance values indicate statistical attribution within the feature space, not direct physical causality.
6. **Fail-Closed Screening Trade-Off:** The governed operational disposition prioritizes catching all critical latent escapes over raw False Positive Rate, routing borderline dies to secondary ATE inspection (`MONITOR`).

---

## 11. PS-170 Requirement Coverage

| Requirement | Description | Implementation | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **PS170-01** | Early screening & temporal leakage control | `src/api/inference.js`, `src/api/inference_service.py` | [`tests/test_ps170_intelligence.py`](tests/test_ps170_intelligence.py) |
| **PS170-02** | Dynamic outlier screening (PAT, COPOD, IF) | `src/anomaly_detection/` | [`tests/test_risk_fusion.py`](tests/test_risk_fusion.py) |
| **PS170-03** | Failure-risk scoring (XGBoost $\theta^*=0.20$) | `ml/models/production/predicta_xgboost_model.json` | [`tests/test_threshold_contract.js`](tests/test_threshold_contract.js) |
| **PS170-04** | 168h prognostics & uncertainty | `src/prognostics/` | [`docs/ml/conformal_calibration.md`](docs/ml/conformal_calibration.md) |
| **PS170-05** | Physics consistency validation (Arrhenius/BTI) | `src/physics/` | [`tests/test_physics_boundaries.py`](tests/test_physics_boundaries.py) |
| **PS170-06** | Sensor / equipment / silicon discrimination | `src/governance/discrimination_engine.*` | [`tests/test_js_python_parity.js`](tests/test_js_python_parity.js) |
| **PS170-07** | Distribution shift & OOD screening | `src/governance/ood_classifier.*` | [`tests/test_governance_gate.py`](tests/test_governance_gate.py) |
| **PS170-08** | Governed risk fusion decision engine | `src/risk_fusion/` | [`src/risk_fusion/risk_fusion.js`](src/risk_fusion/risk_fusion.js) |
| **PS170-09** | Deterministic engineering evidence card | `src/governance/evidence_card.*` | [`docs/demo_evidence_packet.html`](docs/demo_evidence_packet.html) |
| **PS170-10** | Immutable Reliability Twin audit trail | `src/reliability_twin/` | [`supabase/schema.sql`](supabase/schema.sql) |

*(See full 15-point mapping in [**docs/PS170_TRACEABILITY_MATRIX.md**](docs/PS170_TRACEABILITY_MATRIX.md))*

---

## 12. Judge: Where Should I Look?

| What You Want to Inspect | Primary File / Document |
| :--- | :--- |
| **5-Minute Technical Overview** | [**`docs/JUDGE_GUIDE.md`**](docs/JUDGE_GUIDE.md) |
| **Canonical Production Architecture** | [**`docs/architecture/canonical-production-path.md`**](docs/architecture/canonical-production-path.md) |
| **Model Registry & Governance Tiers** | [**`docs/models/model-registry.md`**](docs/models/model-registry.md) |
| **Scientific Validation & Mahalanobis Benchmark** | [**`docs/validation/phase2-scientific-validation.md`**](docs/validation/phase2-scientific-validation.md) |
| **Conformal Calibration Audit & Protocol** | [**`docs/ml/conformal_calibration.md`**](docs/ml/conformal_calibration.md) |
| **PS-170 Traceability Matrix** | [**`docs/PS170_TRACEABILITY_MATRIX.md`**](docs/PS170_TRACEABILITY_MATRIX.md) |
| **External Industrial Dataset Benchmarks** | [**`experiments/external_benchmarks/external_benchmark_report.md`**](experiments/external_benchmarks/external_benchmark_report.md) |
| **Production Serving Code (Node.js Edge)** | [**`src/api/inference.js`**](src/api/inference.js) |
| **Production Serving Code (Python Service)** | [**`src/api/inference_service.py`**](src/api/inference_service.py) |
| **Live Production Health & Database Verification** | [**https://predicta-26-pi.vercel.app/api/health**](https://predicta-26-pi.vercel.app/api/health) |

---

## 13. Quick 5-Step Demo Sequence for SIH Judges

1. Open the live cloud workstation: **[https://predicta-26-pi.vercel.app](https://predicta-26-pi.vercel.app)**.
2. Click **Case A (`NORMAL`)**: Observe nominal screening ($\text{PASS}$, $P < 1\%$).
3. Click **Case B (`LATENT_DEFECT`)**: Observe static limit escape detection—single-point ATE passed, but lot PAT outlier ($Z = 6.08$) and 168h drift trigger governed $\text{REJECT}$.
4. Click **Case C (`FALSE_ALARM`)**: Observe scrap prevention—benign process shift routed to non-destructive $\text{MONITOR}$ rather than wasteful scrap.
5. Inspect **Evidence Card & Reliability Twin**: Verify parameter Z-scores, forecast confidence bounds, and PostgreSQL compliance ledger.

---

## 14. Local Installation & Test Execution

```bash
# 1. Clone Repository
git clone https://github.com/umeshpandeysh/predicta-26.git
cd predicta-26

# 2. Run Automated Verification Tests
pytest tests/ -v
node tests/test_threshold_contract.js
node tests/test_js_python_parity.js
node tests/test_docs_threshold_consistency.js
```

---

**PREDICTA-26** · Semiconductor Burn-In Telemetry & Latent Defect Screening  
Authoritative Repository: [https://github.com/umeshpandeysh/predicta-26](https://github.com/umeshpandeysh/predicta-26)  
Live Production: [https://predicta-26-pi.vercel.app](https://predicta-26-pi.vercel.app)
