# PREDICTA-26 — Production Authority & Canonical Truth (05_PRODUCTION_AUTHORITY)

> **AUTHORITATIVE GOVERNANCE RECORD — CANONICAL ARTIFACT 05**  
> **Problem Statement:** PS-26170 / SIH-170 — AI-Driven Anomaly Detection in Component Burn-In & Screening  
> **Live Deployment:** [https://predicta-26-pi.vercel.app](https://predicta-26-pi.vercel.app)  
> **Repository:** [https://github.com/umeshpandeysh/predicta-26](https://github.com/umeshpandeysh/predicta-26)  
> **Primary Authority Reference:** [`docs/FINAL_AUTHORITY.md`](file:///c:/Users/UMESH%20PANDEY/Downloads/ceenew/docs/FINAL_AUTHORITY.md)  

---

## 1. Executive Authority Lock

This document establishes the single source of truth for all cryptographic identities, model artifacts, datasets, operating thresholds, and architectural paths in the **PREDICTA-26** system.

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
| **Inference Latency (Avg)** | **27.58 ms** (Python) / **6.33 ms** (JS) | Single-request end-to-end | **PRODUCTION_VERIFIED** |
| **Warm Inference P95 Latency** | **35.08 ms** (Python) / **9.21 ms** (JS) | Measured across 500 warm samples | **PRODUCTION_VERIFIED** |
| **P95 Latency Requirement** | **< 50.0 ms** | CI Phase 4 Security & Perf Suite | **PRODUCTION_VERIFIED** |
| **Primary Evaluation Protocol** | **Lot-Disjoint Held-Out Split** | Zero train/test lot overlap | **AUTHORITATIVE_PROTOCOL** |
| **Calibration Status** | **Platt Scaled (Synthetic)** | `NOT_CALIBRATED` for flight qualification | **GOVERNED_BENCHMARK** |

---

## 5. Canonical Five-Artifact Package Map

1. **`01_PS26170_FINAL_BENCHMARK`**: [`docs/01_PS26170_FINAL_BENCHMARK.md`](file:///c:/Users/UMESH%20PANDEY/Downloads/ceenew/docs/01_PS26170_FINAL_BENCHMARK.md)
2. **`02_SYNTHETIC_REALISM_AUDIT`**: [`docs/02_SYNTHETIC_REALISM_AUDIT.md`](file:///c:/Users/UMESH%20PANDEY/Downloads/ceenew/docs/02_SYNTHETIC_REALISM_AUDIT.md)
3. **`03_ABLATION_STUDY`**: [`docs/03_ABLATION_STUDY.md`](file:///c:/Users/UMESH%20PANDEY/Downloads/ceenew/docs/03_ABLATION_STUDY.md)
4. **`04_TEMPORAL_LEAKAGE_AUDIT`**: [`docs/04_TEMPORAL_LEAKAGE_AUDIT.md`](file:///c:/Users/UMESH%20PANDEY/Downloads/ceenew/docs/04_TEMPORAL_LEAKAGE_AUDIT.md)
5. **`05_PRODUCTION_AUTHORITY`**: [`docs/05_PRODUCTION_AUTHORITY.md`](file:///c:/Users/UMESH%20PANDEY/Downloads/ceenew/docs/05_PRODUCTION_AUTHORITY.md)
