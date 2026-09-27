# PREDICTA-26 — FINAL REPOSITORY AUTHORITY & CANONICAL TRUTH

> **AUTHORITATIVE GOVERNANCE RECORD — SIH 2026**  
> **Problem Statement:** PS-26170 — AI-Driven Anomaly Detection in Component Burn-In & Screening  
> **Live Deployment:** [https://predicta-26-pi.vercel.app](https://predicta-26-pi.vercel.app)  
> **Repository:** [https://github.com/umeshpandeysh/predicta-26](https://github.com/umeshpandeysh/predicta-26)  
> **Baseline Commit:** `ae1ecc518f8a45282c242aaa2454d740c4e71459`  

---

## 1. Executive Authority Lock

This document establishes the single source of truth for all cryptographic identities, model artifacts, datasets, operating thresholds, and architectural paths in the **PREDICTA-26** system.

Any claim, documentation file, test assertion, or presentation asset that contradicts the values in this document is non-authoritative.

---

## 2. Cryptographic Provenance & Artifact Hashes

| Domain / Asset | Canonical Path | SHA-256 Hash | Governance Status |
|:---|:---|:---|:---|
| **Production XGBoost Model** | `ml/models/production/predicta_xgboost_model.json` | `91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98` | **PRODUCTION_PRIMARY** |
| **Production Classification Dataset** | `ml/data/synthetic/predicta_dataset_v4_production.csv` | `9a8367a96a7d2dcf83a62e9c0e02ab41502b6069deebc116a0e9cd0ef45fab24` | **PRODUCTION_DATASET** |
| **Prognostic Trajectory Dataset** | `data/synthetic/semiconductor_synthetic_full.csv` | `e2b969c458864b11ed61a6073ed1356adcbfd6775bb2c44b28023446bf9771fa` | **BENCHMARK_PROGNOSTIC** |
| **Locked Benchmark Test Set** | `ml/data/processed/test.csv` | `413ec0b7a5175dca99742c96e106718552a213a273e4ec5a314125f1f2b936b2` | **LOCKED_TEST_SPLIT** |
| **Conformal Calibration Artifact** | `ml/models/production/conformal_calibration_artifacts.json` | `198eaa50f5af96aa85721f168abc947a6cabfc02d91f77d1a032c343f85e7e7e` | **RESEARCH_CANDIDATE** |
| **Production Architecture Specification** | `docs/architecture/canonical-production-path.md` | *Repository Tracked* | **AUTHORITATIVE_SPEC** |

---

## 3. Decision Contract & Operating Thresholds

* **Authoritative Production Operating Threshold:** `θ* = 0.20`
* **Mathematical Definition:**
  $$\text{Decision}(x) = \begin{cases} \text{FAIL / REJECT} & \text{if } P_{\text{fail}}(x) \ge 0.20 \lor \text{AnomalyStatus}(x) = \text{REJECT} \\ \text{MONITOR / REVIEW} & \text{if } 0.10 \le P_{\text{fail}}(x) < 0.20 \lor \text{AnomalyStatus}(x) = \text{MONITOR} \\ \text{PASS} & \text{if } P_{\text{fail}}(x) < 0.10 \land \text{AnomalyStatus}(x) = \text{NORMAL} \end{cases}$$
* **Threshold Selection Rationale:** Minimizes catastrophic latent-defect escapes (False Negatives) where uncaptured semiconductor degradation causes orbital or mission failure ($C_{\text{FN}} \gg C_{\text{FP}}$).
* **Historical Thresholds:** All historical references to threshold `0.45` were intermediate experimental artifacts and are strictly deprecated and non-authoritative.

---

## 4. Production Performance & Benchmark Truth (Locked Test Partition)

Measured on the locked, lot-disjoint 7,500-sample test partition (`ml/data/processed/test.csv`) via `npm run benchmark:ps26170`:

| Metric / Parameter | Authoritative Value | Verification Protocol | Governance Status |
|:---|:---|:---|:---|
| **Defect Detection Recall** | **0.9462 (94.62%)** | Locked test set (3,700 defects) | **PRODUCTION_VERIFIED** |
| **False Negative Rate (FNR)** | **0.0538 (5.38%)** | Locked test set | **PRODUCTION_VERIFIED** |
| **False Positive Rate (FPR)** | **0.6462 (64.62%)** | Conservative fail-closed screening | **PRODUCTION_VERIFIED** |
| **Precision** | **0.5365** | Locked test set | **PRODUCTION_VERIFIED** |
| **F1-Score** | **0.6847** | Harmonic mean (P/R) | **PRODUCTION_VERIFIED** |
| **ROC-AUC** | **0.9631** | Disjoint test evaluation | **PRODUCTION_VERIFIED** |
| **PR-AUC** | **0.9658** | Precision-Recall curve area | **PRODUCTION_VERIFIED** |
| **Mean Detection Lead Time** | **144.0 hours** | Early screening at $t=24\text{h}$ vs $168\text{h}$ | **PRODUCTION_VERIFIED** |
| **Inference Latency (Avg)** | **27.58 ms** (Python) / **9 ms** (JS) | Single-request end-to-end | **PRODUCTION_VERIFIED** |
| **P95 Latency Limit** | **< 50 ms** | CI Phase 4 Security & Perf Suite | **PRODUCTION_VERIFIED** |
| **Primary Evaluation Protocol** | **Lot-Disjoint Held-Out Split** | Zero train/test lot overlap | **AUTHORITATIVE_PROTOCOL** |
| **Calibration Status** | **Platt Scaled (Synthetic)** | `NOT_CALIBRATED` for flight qualification | **GOVERNED_BENCHMARK** |

---

## 5. Feature Contract & Inference Pipeline

* **Input Vector:** 16 raw continuous physical telemetry features + 1 equipment ID.
* **Engineered Feature Contract:** Exactly **28 continuous engineered features** (StandardScaler normalized, including interaction terms, non-linear physical degradation ratios, and one-hot equipment encoding).
* **Production Classifier:** 300-tree gradient boosted decision tree (Native XGBoost).
* **Parity Guarantee:** Dual-engine JavaScript runtime (`src/api/inference.js`) and Python service (`src/api/inference_service.py`) verified to achieve absolute mathematical decision parity ($|\Delta P| < 10^{-6}$).

---

## 6. Architectural Separation of Concerns

### A. Live Synchronous Production Path
The real-time screening loop executed for every semiconductor component under test:
1. **Input Ingestion & Schema Validation**: Physical bounds checking, missing-field fail-closed handling.
2. **Feature Engineering**: Deterministic 28-feature transform.
3. **Primary ML Inference**: XGBoost tree evaluation producing calibrated failure probability $P_{\text{fail}}$.
4. **Authoritative Anomaly Stack**: Multi-detector fusion (PAT-MAD + COPOD + Isolation Forest).
5. **Operational Disposition Engine**: Fail-closed decision synthesis ($\theta^* = 0.20$).
6. **Digital Twin Telemetry Snapshot**: Emits trace-linked immutable decision event.

### B. Offline / Governance / Forensic Path
Asynchronous, forensic, and review tools that operate outside the synchronous latency-critical inference path:
1. **EvidenceCardGenerator**: Post-hoc generation of full multi-page forensic audit cards.
2. **DiscriminationEngine**: Forensic attribution of root-cause physical mechanism (Thermal vs Electromigration vs Gate Oxide).
3. **OOD Classifier**: Benchmark screening filter tagged `BENCHMARK_SCREENING_ONLY` (non-authoritative).
4. **Conformal Uncertainty**: Platt-scaled on synthetic validation split; governed as `NOT_CALIBRATED` for physical flight qualification.

---

## 7. Governance Classifications

| Classification | Meaning & Scope |
|:---|:---|
| **CURRENT / AUTHORITATIVE** | Production ML models, $\theta^* = 0.20$, 28-feature contract, live inference engines, and locked test evaluation. |
| **HISTORICAL** | Deprecated exploration checkpoints (e.g., initial exploratory threshold $0.45$), explicitly archived. |
| **BENCHMARK** | Comparative baselines (Static Limits, PAT-MAD, Isolation Forest, Mahalanobis Challenger, HistGradientBoosting). |
| **EXTERNAL VALIDATION** | External datasets (ST AWFD, UCI SECOM, NASA PCoE) evaluated for out-of-distribution generalization. |
| **CALIBRATION_PENDING** | Conformal prediction intervals awaiting real-world foundry qualification lot data. |
