# PREDICTA — Authoritative Model Registry & Governance Catalog

**Status:** Authoritative Governance Registry  
**Domain:** SIH 2026 Problem Statement 170 / 26170 (ISRO) — Semiconductor Burn-In Telemetry & Latent Defect Screening  
**Governance Policy:** Fail-closed model validation; strict cryptographic provenance; zero unverified production promotion.

---

## 1. Executive Summary

This registry catalogs every machine learning model, statistical detector, prognostic forecaster, and heuristic algorithm within the PREDICTA codebase. Each asset is assigned an explicit governance tier based on verified repository evidence.

### Governance Tier Definitions

*   **`PRODUCTION`**: Active in the real-time inference loop (`src/api/inference.js` / `src/api/inference_service.py`), backed by cryptographic manifest hashes and verified by deterministic test suites.
*   **`VALIDATED`**: Offline validation tools and oracle evaluators used strictly for benchmark scoring and post-hoc ground-truth verification.
*   **`BENCHMARK`**: Comparative baseline models evaluated during scientific ablation studies to justify production architecture choices.
*   **`RESEARCH`**: Experimental models executing in isolated shadow mode without decision-making authority.
*   **`CHALLENGER`**: Candidate architectures under offline evaluation.
*   **`CALIBRATION_PENDING`**: Statistical uncertainty components whose theoretical framework is implemented but whose calibration constants are restricted to synthetic benchmarks pending physical qualification.
*   **`LEGACY`**: Historical or superseded model iterations preserved for development provenance.

---

## 2. Comprehensive Model & Subsystem Registry

| Component / Model Name | Primary Purpose | Input Schema | Output Format | Governance Status | Training / Fit Source | Validation Evidence | Production Usage | Known Limitations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Native XGBoost Classifier** | Core Latent Defect Probability Estimation | 28 Continuous Engineered Features | Continuous Probability $P(\text{Defect}) \in [0, 1]$ | **`PRODUCTION`** | Trained on synthetic burn-in lot dataset (`ml/data/processed/train.csv`) via `train_native_xgboost.py` | 12/12 Deterministic test vectors with 0.000000 JS/Python numerical parity; Phase 12-16 evaluation gates | Authoritative risk probability engine for all live API predictions | Trained on synthetic benchmark telemetry; requires physical fab retraining for flight qualification. |
| **Robust PAT-MAD Detector** | Univariate Part Average Testing Outlier Screening | Normalized $(I_{\text{ddq}}, I_{\text{leak}}, t_{\text{pd}})$ | Parameter $Z$-scores, status (`PASS`/`MONITOR`/`REJECT`) | **`PRODUCTION`** | Fitted on clean lot baselines in `predicta_anomaly_artifacts.json` | Tested across 8 multi-lot datasets; catches extreme parametric drift ($Z > 6.0$) | First line of defense in `evaluatePatMad` / `AnomalyFusionEngine` | Assumes unimodal parametric distribution per lot; uses global fallback if lot size $< 10$. |
| **COPOD Empirical Copula Detector** | Multivariate Tail-Probability Anomaly Detection | Canonical $(I_{\text{ddq}}, I_{\text{leak}}, t_{\text{pd}})$ | Tail probability score & status (`PASS`/`MONITOR`/`REJECT`) | **`PRODUCTION`** | Empirical cumulative distribution functions (ECDFs) fitted in `predicta_anomaly_artifacts.json` | Validated in multi-model anomaly fusion tests | Evaluates joint parameter tail probabilities in real-time inference | Non-parametric; does not capture rotated interior correlation clusters. |
| **Isolation Forest Detector** | Unsupervised Multi-Parameter Partition Screening | Normalized 3D parameter vectors | Anomaly score, mean path length, status | **`PRODUCTION`** | 100 Isolation Trees serialized into `predicta_anomaly_artifacts.json` | Tested against synthetic cluster anomalies | Embedded in multi-detector anomaly fusion | Tree depth bounded at 10 for low-latency edge execution. |
| **Gaussian Process Regressor (GPR)** | 168h Continuous Parametric Drift Forecasting | $0\text{h}$ baseline & $24\text{h}$ telemetry points | 168h forecast mean $\mu$ and $95\%$ CI $[\mu - 1.96\sigma, \mu + 1.96\sigma]$ | **`PRODUCTION`** | Fitted RBF + WhiteNoise kernel parameters in `predicta_gpr_kernel_artifacts.json` | Continuous prognostics evaluation across 8 test lots; verified covariance inversion | Computes 168h end-of-test state and safety slope limits | Kernel evaluation is $O(N^3)$ (constrained to 3-point burn-in time horizons). |
| **Physics Kinetics Engine** | Thermal Acceleration, Electromigration & BTI Modeling | Temperature, voltage bias, operational frequency | Acceleration factors ($AF$), MTTF multiplier, thermal delta | **`PRODUCTION`** | Physical semiconductor equations ($E_a = 0.7\text{ eV}$, Black's EM, BTI kinetics) | Physics unit test suite (`tests/test_physics.py`) | Evaluates physical constraints and constructs physics-informed features | Model parameters ($E_a=0.7\text{eV}$) represent standard silicon CMOS defaults. |
| **Governed Risk Fusion Engine** | Deterministic Multi-Criteria Disposition Synthesis | XGBoost $P$, Anomaly scores, GPR Drift bounds | Unified Risk $(0\text{--}100)$, Disposition (`PASS`/`MONITOR`/`REJECT`) | **`PRODUCTION`** | Governed priority rules (`src/risk_fusion/risk_fusion.js`) | Verified by fail-closed contract suite (`assertNoContradictions`) | Synthesizes definitive factory disposition and recommended action | Fail-closed conservative policy prioritizes false negative prevention over scrap rate. |
| **Split-Conformal Uncertainty Quantiles** | Distribution-free Prediction Intervals | GPR forecast residuals | 90% & 95% non-conformity quantiles | **`CALIBRATION_PENDING`** | Computed on synthetic calibration split (`conformal_calibration_artifacts.json`) | Stage 6 Task 1-4 Governance Gate Audit | Documented as candidate benchmark intervals; status declared `NOT_CALIBRATED` | **Explicit Limitation:** Strictly benchmark-only; not certified for flight qualification without real-world telemetry. |
| **HistGradientBoosting (HGB) Classifier** | Tree Baseline Benchmark | 28 Continuous Engineered Features | Defect Probability | **`BENCHMARK`** | Trained via `src/evaluation/phase16_ablation_study.py` | Scientific ablation report comparing XGBoost vs HGB vs RF | Offline scientific comparison only (NOT in production path) | Lacks pure JavaScript edge zero-dependency runtime evaluation. |
| **Random Forest / Logistic Regression** | Classical Linear & Bagging Baselines | Raw 16 numerical features | Binary classification | **`BENCHMARK`** | Early baseline scripts in `ml/experiments/` | Documented in `docs/results/what-we-proved.md` | Offline comparison only | Inadequate non-linear latent defect separation compared to native XGBoost. |
| **Latent Trajectory Retrospective Evaluator** | Oracle Ground-Truth Trajectory Verification | Full $0\text{h} \to 24\text{h} \to 168\text{h}$ trajectory data | Latent defect ground-truth flag and failure mode | **`VALIDATED`** | Rule-based evaluator in `src/evaluation/latent_trajectory.py` | Verified against 100% test set labels in Stage 4 | Used for retrospective benchmarking and test validation | Requires post-test (168h) telemetry; cannot be run during real-time 24h screening. |
| **Mahalanobis Distance Detector** | Multivariate Covariance Outlier Screening | Normalized $(I_{\text{ddq}}, I_{\text{leak}}, t_{\text{pd}})$ | Distance metric $D_M$, status (`PASS`/`MONITOR`/`REJECT`) | **`CHALLENGER / BENCHMARK`** | Implemented in `src/anomaly_detection/mahalanobis_challenger.py`; fitted on clean train split | Evaluated on 8 disjoint test lots (ROC-AUC = 0.7894; 0 unique TPs beyond production stack); see [`docs/validation/phase2-scientific-validation.md`](../validation/phase2-scientific-validation.md) | **OFFLINE CHALLENGER ONLY** (Not in production path) | Redundant with non-linear COPOD/PAT/IF fusion stack; adds 0 unique detections while increasing matrix compute overhead. |
| **External Industrial Benchmarks** | Wafer & Sensor Generalization Benchmarking | Heterogeneous sensor & process telemetry | Outlier & failure predictions | **`BENCHMARK`** | Evaluated on ST-AWFD (602k rows), UCI SECOM, UCI AI4I 2020, NASA IGBT in `ml/benchmarks/external/` | GroupKFold & target-leakage defense test suite (`tests/test_external_dataset_benchmarks.py`) | **OFFLINE GENERALIZATION BENCHMARKS ONLY** | Disparate physical sensor domains; explicitly declared as non-transferable to internal 14-channel burn-in model. |

---

## 3. Cryptographic Artifact Integrity Verification

Production models are sealed with SHA-256 integrity hashes stored in [`ml/models/production/predicta_production_manifest.json`](../../ml/models/production/predicta_production_manifest.json):

*   **Production XGBoost Model:**  
    `91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98`
*   **Split Manifest:**  
    `1764dff377386bf41f95f9bb96afb71dd01404bf65bdec9e324ba31afcf7a8dd`
*   **Primary Latent Trajectory Dataset (`data/synthetic/semiconductor_synthetic_full.csv`):**  
    `e2b969c458864b11ed61a6073ed1356adcbfd6775bb2c44b28023446bf9771fa`
*   **Primary Manufacturing Dataset (`ml/data/synthetic/predicta_dataset_v4_production.csv`):**  
    `9a8367a96a7d2dcf83a62e9c0e02ab41502b6069deebc116a0e9cd0ef45fab24`
*   **Conformal Calibration Artifacts:**  
    `198eaa50f5af96aa85721f168abc947a6cabfc02d91f77d1a032c343f85e7e7e`

Any unauthorized modification of model weights or configuration files triggers immediate fail-closed initialization rejection (`CONFIGURATION_ERROR`) during service startup.
