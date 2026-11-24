# PREDICTA-26 — FINAL REPOSITORY AUTHORITY & CANONICAL TRUTH

> **AUTHORITATIVE GOVERNANCE RECORD — SIH 2026**  
> **Problem Statement:** PS-26170 — AI-Driven Anomaly Detection in Component Burn-In & Screening  
> **Live Deployment:** [https://predicta-26-pi.vercel.app](https://predicta-26-pi.vercel.app)  
> **Repository:** [https://github.com/umeshpandeysh/predicta-26](https://github.com/umeshpandeysh/predicta-26)  
> **Production Baseline Commit:** `ae1ecc518f8a45282c242aaa2454d740c4e71459`  
> **Phase 1 Authority Lock Commit:** `2c975aae14e6ef93156d604da5e89bd0c4f7655f`  

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
* **Historical Thresholds:** All historical exploration thresholds (e.g. Evaluation Sweep / initial 0.4500) were intermediate experimental artifacts and are strictly deprecated and non-authoritative.

---

## 4. Early-screening performance

The early-screening evaluation verifies the locked 7,500-row source partition and evaluates its 1,920 measurements at or before 24h. Under its positive decision rule, the full pipeline recorded 614 true positives, 90 false negatives, 322 false positives and 894 true negatives. The earlier all-checkpoint results are historical. [Current benchmark and full disposition counts](PS26170_FINAL_BENCHMARK.md)

## 5. Scientific integrity

The three ATE test lots (LOT-001, LOT-016 and LOT-018) are disjoint from the 13 ATE training lots. The benchmark checks the source checksum, lot identity, exact measurement overlap, screening timestamps and the frozen classifier threshold. Its snapshot target supports evaluation of same-checkpoint classification. Paired 0h/24h measurements with a separate 168h outcome support the longitudinal evaluation. [Dataset and target definitions](../README.md#validation-snapshot)

## 6. Feature Contract & Inference Pipeline

* **Input Vector:** 16 raw continuous physical telemetry features + 1 equipment ID.
* **Engineered Feature Contract:** Exactly **28 continuous engineered features** (StandardScaler normalized, including interaction terms, non-linear physical degradation ratios, and one-hot equipment encoding).
* **Production Classifier:** 300-tree gradient boosted decision tree (Native XGBoost).
* **Parity Guarantee:** Dual-engine JavaScript runtime (`src/api/inference.js`) and Python service (`src/api/inference_service.py`) verified to achieve absolute mathematical decision parity ($|\Delta P| < 10^{-6}$).

---

## 7. Architectural Separation of Concerns

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

## 8. Governance Classifications

| Classification | Meaning & Scope |
|:---|:---|
| **CURRENT / AUTHORITATIVE** | Production ML models, $\theta^* = 0.20$, 28-feature contract, live inference engines, and locked test evaluation. |
| **HISTORICAL** | Deprecated exploration checkpoints (e.g. Evaluation Sweep / initial 0.4500), explicitly archived. |
| **BENCHMARK** | Comparative baselines (Static Limits, PAT-MAD, Isolation Forest, Mahalanobis Challenger, HistGradientBoosting). |
| **EXTERNAL VALIDATION** | External datasets (ST AWFD, UCI SECOM, NASA PCoE) evaluated for out-of-distribution generalization. |
| **CALIBRATION_PENDING** | Conformal prediction intervals awaiting real-world foundry qualification lot data. |
