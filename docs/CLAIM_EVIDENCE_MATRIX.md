# PREDICTA-26 — Canonical Claim-to-Evidence Matrix

> **AUTHORITATIVE SCIENTIFIC & TECHNICAL AUDIT MAP — SIH 2026 PS-26170**
> **Problem Statement:** PS-26170 (ISRO / DoS — AI-Driven Anomaly Detection in Component Burn-In & Screening)
> **Authoritative Baseline SHA:** `9c1880d0fe50077b390eea22f4fb545ff9044a74`
> **Live Deployment:** [https://predicta-26-pi.vercel.app](https://predicta-26-pi.vercel.app)
> **Production Operating Threshold:** `θ* = 0.20 (LOCKED_IMMUTABLE)`

---

## 1. Executive Purpose

This document provides technical reviewers and SIH judges with a **1:1 verifiable traceability map** connecting every major technical, mathematical, scientific, and economic claim in PREDICTA-26 directly to its source code, reproducible command, evidence artifact, and operational boundary.

---

## 2. Master Claim-to-Evidence Verification Matrix

| Claim ID | Core Technical Claim | Primary Evidence Artifact | Reproducible CLI Command | Data Source / Split | Governance Tier | Known Limitation & Boundary Disclosure |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CLM-01** | **Early Latent Defect Separation ($t=24\text{h}$)**<br>Native XGBoost catches 94.62% of latent defects escaping static ATE limits. | [`docs/01_PS26170_FINAL_BENCHMARK.md`](01_PS26170_FINAL_BENCHMARK.md) | `npm run benchmark:ps26170` | `ml/data/processed/test.csv` ($N=7,500$ held-out dies) | **PRODUCTION** | Primary telemetry is physics-informed synthetic simulation modeled on JESD22 burn-in. |
| **CLM-02** | **Dynamic Multi-Detector Anomaly Screening**<br>PAT-MAD, COPOD, and Isolation Forest screen multivariate distribution outliers. | [`docs/02_SYNTHETIC_REALISM_AUDIT.md`](02_SYNTHETIC_REALISM_AUDIT.md) | `npm run evaluate:realism` | `ml/data/processed/test.csv` (10 Difficulty Tiers) | **PRODUCTION** | Evaluated on controlled synthetic drift and stress transformations. |
| **CLM-03** | **Continuous 168h Longitudinal Prognostics**<br>Bayesian GPR forecasts parameter trajectories ($I_{\text{ddq}}, I_{\text{leak}}, t_{\text{pd}}$) with 94.88% empirical coverage. | [`docs/03_ABLATION_STUDY.md`](03_ABLATION_STUDY.md)<br>[`docs/MODULE_B_TEMPORAL_CONTRACT.md`](MODULE_B_TEMPORAL_CONTRACT.md) | `npm run evaluate:prognostics:continuous` | `data/synthetic/semiconductor_synthetic_full.csv` (800 held-out dies) | **BENCHMARK / RESEARCH** | Conformal intervals remain `NOT_CALIBRATED` for physical flight qualification pending fab lots. |
| **CLM-04** | **Zero Temporal & Metadata Leakage**<br>0 future tokens ($t > 24\text{h}$) in features; zero exact duplicate rows; zero metadata shortcuts. | [`docs/04_TEMPORAL_LEAKAGE_AUDIT.md`](04_TEMPORAL_LEAKAGE_AUDIT.md) | `npm run evaluate:leakage` | `ml/data/processed/` (32.5k train, 7.5k test) | **PRODUCTION_VERIFIED** | Near-duplicate distance audit disclosed as `NOT_VERIFIED` (no artificial fudge factors). |
| **CLM-05** | **Cryptographic Production Authority**<br>Model SHA `91bb598a...`, Dataset SHA `9a8367a9...`, Threshold $\theta^* = 0.20$ immutable. | [`docs/05_PRODUCTION_AUTHORITY.md`](05_PRODUCTION_AUTHORITY.md)<br>[`docs/FINAL_AUTHORITY.md`](FINAL_AUTHORITY.md) | `node tests/test_threshold_contract.js` | `ml/models/production/` | **PRODUCTION** | Cryptographically locked; test-set threshold sweeps strictly prohibited. |
| **CLM-06** | **Synthetic-Generator Independence**<br>Frozen model maintains Recall = 96.60% and ROC-AUC = 0.7836 on independent heavy-tailed generator. | [`docs/SYNTHETIC_GENERATOR_INDEPENDENCE.md`](SYNTHETIC_GENERATOR_INDEPENDENCE.md) | `python src/evaluation/evaluate_synthetic_generator_independence.py` | `experiments/benchmarks/generator_independence.json` ($N=5,000$) | **CHALLENGE_BENCHMARK** | Classified as `FROZEN_MODEL_EXTERNAL_GENERATOR_CHALLENGE`, not real-world fab validation. |
| **CLM-07** | **Fail-Closed OOD & Insufficient Evidence Safety**<br>Unseen equipment, sensor glitches, and tail anomalies block automated PASS. | [`docs/OOD_INSUFFICIENT_EVIDENCE_CASE.md`](OOD_INSUFFICIENT_EVIDENCE_CASE.md) | `python src/evaluation/evaluate_ood_insufficient_evidence.py` | `experiments/benchmarks/ood_insufficient_evidence_case.json` (5 cases) | **PRODUCTION_SAFETY** | System routes to secondary QA (`MONITOR` / 400 rejection); does not manufacture false confidence. |
| **CLM-08** | **Economic & Chamber Optimization Proof**<br>144h potential early-termination window yields net savings under eligible early-disposition scenarios. | [`docs/ECONOMIC_IMPACT_MODEL.md`](ECONOMIC_IMPACT_MODEL.md) | `python src/evaluation/economic_impact_model.py` | `experiments/benchmarks/economic_impact_model.json` | **DECISION_ANALYSIS** | `144h = potential window ≠ guaranteed savings`. Plant-specific currency ROI requires fab schedules. |
| **CLM-09** | **Cross-Runtime Numerical Parity ($\Delta = 0.000000$)**<br>Pure Node.js Edge JavaScript and Python Native engines produce bit-level identical probabilities. | [`tests/test_js_python_parity.js`](file:///c:/Users/UMESH%20PANDEY/Downloads/ceenew/tests/test_js_python_parity.js) | `node tests/test_js_python_parity.js` | 12 nominal, borderline, and adversarial test vectors | **PRODUCTION** | Parity verified across all 12 validation vectors. |
| **CLM-10** | **Multi-Dataset External Validation**<br>Transfer anomaly detection evaluated across ST-AWFD (728k rows), UCI SECOM, AI4I, and NASA IGBT. | [`experiments/external_benchmarks/external_benchmark_report.md`](file:///c:/Users/UMESH%20PANDEY/Downloads/ceenew/experiments/external_benchmarks/external_benchmark_report.md) | `pytest tests/test_external_dataset_benchmarks.py` | Industrial public semiconductor & power datasets | **EXTERNAL_BENCHMARK** | Validates methodological components under mapped tasks; NOT a substitute for ISRO fab telemetry. |
| **CLM-11** | **Immutable Reliability Twin Audit Trail**<br>Append-only decision ledger in PostgreSQL tracks component lifecycle and human overrides. | [`src/reliability_twin/`](file:///c:/Users/UMESH%20PANDEY/Downloads/ceenew/src/reliability_twin/) | `pytest tests/test_reliability_twin.py` | PostgreSQL schema / JSON fallback store | **PRODUCTION** | Production persistence depends on Supabase backend configuration. |
| **CLM-12** | **Challenger Mahalanobis Benchmark**<br>Covariance-aware baseline evaluated on held-out test split (ROC-AUC = 0.7894, 11 unique TPs at $\chi^2_{0.99}$). | [`docs/validation/phase2-scientific-validation.md`](file:///c:/Users/UMESH%20PANDEY/Downloads/ceenew/docs/validation/phase2-scientific-validation.md) | `npm run evaluate:mahalanobis` | `ml/data/processed/test.csv` | **CHALLENGER_BASELINE** | Mahalanobis is retained offline as an audited benchmark; XGBoost + PAT/COPOD remains production. |

---

## 3. Audited Performance Metrics Single Source of Truth

All reported metrics in the table below are compiled from machine-readable benchmark JSONs generated from source code:

| Metric Name | Value | Dataset / Split | Source Artifact |
| :--- | :--- | :--- | :--- |
| **Defect Detection Recall** | **94.62%** (3,501 / 3,700) | `ml/data/processed/test.csv` ($N=7,500$) | `experiments/benchmarks/01_ps26170_final_benchmark.json` |
| **False Negative Rate (FNR)** | **5.38%** (199 / 3,700) | `ml/data/processed/test.csv` ($N=7,500$) | `experiments/benchmarks/01_ps26170_final_benchmark.json` |
| **False Positive Rate (FPR)** | **64.62%** (2,456 / 3,800) | `ml/data/processed/test.csv` ($N=7,500$) | `experiments/benchmarks/01_ps26170_final_benchmark.json` |
| **Precision** | **53.65%** | `ml/data/processed/test.csv` ($N=7,500$) | `experiments/benchmarks/01_ps26170_final_benchmark.json` |
| **ROC-AUC** | **0.9631** | `ml/data/processed/test.csv` ($N=7,500$) | `experiments/benchmarks/01_ps26170_final_benchmark.json` |
| **PR-AUC** | **0.9658** | `ml/data/processed/test.csv` ($N=7,500$) | `experiments/benchmarks/01_ps26170_final_benchmark.json` |
| **Inference Latency (Avg)** | **27.58 ms** (Python) / **6.33 ms** (Node) | Single Request Serving Loop | `experiments/benchmarks/01_ps26170_final_benchmark.json` |
| **Warm P95 Latency** | **35.08 ms** (Python) / **9.21 ms** (Node) | 500 Warm Inferences | `experiments/benchmarks/01_ps26170_final_benchmark.json` |
| **Prognostic $I_{\text{ddq}}$ 168h MAE** | **23.22 $\mu\text{A}$** | `semiconductor_synthetic_full.csv` ($N=800$) | `experiments/benchmarks/03_ablation_study.json` |
| **Prognostic $I_{\text{leak}}$ 168h MAE** | **3.13 $\mu\text{A}$** | `semiconductor_synthetic_full.csv` ($N=800$) | `experiments/benchmarks/03_ablation_study.json` |
| **Prognostic $t_{\text{pd}}$ 168h MAE** | **2.95 ns** | `semiconductor_synthetic_full.csv` ($N=800$) | `experiments/benchmarks/03_ablation_study.json` |
| **Challenge Generator Recall** | **96.60%** | `generator_independence.json` ($N=5,000$) | `experiments/benchmarks/generator_independence.json` |
| **Challenge Generator ROC-AUC** | **0.7836** | `generator_independence.json` ($N=5,000$) | `experiments/benchmarks/generator_independence.json` |

---

## 4. Full Reproducibility Verification Command Sequence

To reproduce all 12 claims on a clean system:

```bash
# 1. Clone repository
git clone https://github.com/umeshpandeysh/predicta-26.git
cd predicta-26

# 2. Run Comprehensive Test Suite (832 Python tests + Node suites)
pytest tests/ -v
node tests/test_threshold_contract.js
node tests/test_js_python_parity.js
node tests/test_docs_threshold_consistency.js

# 3. Reproduce Canonical 5-Artifact Scientific Benchmark Package
npm run benchmark:ps26170
npm run evaluate:realism
npm run evaluate:phase3
npm run evaluate:leakage
npm run evaluate:mahalanobis

# 4. Reproduce Final Hardening Proofs
python src/evaluation/economic_impact_model.py
python src/evaluation/evaluate_synthetic_generator_independence.py
python src/evaluation/evaluate_ood_insufficient_evidence.py

# 5. Run Authoritative Production Certification
npm run certify:production
```
