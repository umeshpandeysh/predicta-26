# PREDICTA-26 — PS26170_FINAL_BENCHMARK Report

**Problem Statement:** PS-26170 / SIH-170 — AI-Driven Anomaly Detection in Component Burn-In & Screening  
**Authoritative Model SHA-256:** `91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98`  
**Operating Threshold:** `θ* = 0.20`  
**Locked Test Set:** `ml/data/processed/test.csv` (7500 samples, SHA-256: `413ec0b7a5175dca99742c96e106718552a213a273e4ec5a314125f1f2b936b2`)  
**Generated:** `2026-09-27T09:54:11Z`  

---

## 1. Comparative Screening Benchmark (Locked Test Partition)

| Approach ID | Approach Name | Category | Recall | FNR | FPR | Precision | F1-Score | ROC-AUC | PR-AUC | Lead Time (Mean) | Latency (Avg) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **BASELINE_A** | Baseline A — Static Datasheet Limits | `BENCHMARK` | **0.0411** | 0.9589 | 0.0000 | 1.0000 | 0.0789 | 0.5205 | 0.7322 | 144.0h | 0.06 ms |
| **BASELINE_B** | Baseline B — Lot-Relative Statistical Screening | `BENCHMARK` | **0.5899** | 0.4101 | 0.4968 | 0.4841 | 0.5318 | 0.5682 | 0.5230 | 144.0h | 0.18 ms |
| **BASELINE_C** | Baseline C — Mahalanobis Distance Challenger | `CHALLENGER` | **0.1060** | 0.8940 | 0.0098 | 0.8954 | 0.1896 | 0.8038 | 0.7539 | 144.0h | 0.00 ms |
| **BASELINE_D** | Baseline D — Isolation Forest | `BENCHMARK` | **0.0000** | 1.0000 | 0.0000 | 0.0000 | 0.0000 | 0.5000 | 0.7207 | N/A | 0.12 ms |
| **BASELINE_E** | Baseline E — PREDICTA Anomaly Stack | `PRODUCTION_SUBSYSTEM` | **0.8747** | 0.1253 | 0.8138 | 0.4593 | 0.6023 | 0.5847 | 0.5373 | 144.0h | 0.44 ms |
| **BASELINE_F** | Baseline F — PREDICTA Full Pipeline | `PRODUCTION` | **0.9462** | 0.0538 | 0.6462 | 0.5365 | 0.6847 | 0.9631 | 0.9658 | 144.0h | 28.39 ms |

---

## 2. Four Canonical PS-26170 Operational Cases

| Case | Scenario | Expected Behavior | Observed Decision | Actual Risk Probability | Key Differentiator |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Case A** | Nominal Healthy Die | `PASS` | **`PASS`** | P = 47.88mA baseline | Healthy silicon verified without false alarm scrap. |
| **Case B** | Static-Limit Escape | `REJECT` (Lot Anomaly) | **`REJECT`** | P = 0.9900 | Catches subtle drift ($I_{\text{leak}} = 145\mu\text{A} < 250\mu\text{A}$ limit) via lot PAT outlier ($Z=6.08$). |
| **Case C** | 24h Normal $\to$ 168h Failure | `REJECT` (Early Warning) | **`REJECT`** | P = 0.9900 | 168h GPR prognostic forecast detects end-of-test limit breach at $t=24\text{h}$. |
| **Case D** | Benign Process Drift | `MONITOR` (Scrap Prevented) | **`MONITOR`** | P = 0.0040 | Prevents wasteful scrap by routing benign variation to non-destructive secondary ATE inspection. |

---

## 3. Leakage Controls & Integrity Verification

- **Lot Overlap:** `0` overlapping lots between training and test sets.
- **Temporal Leakage:** `Zero temporal leakage (24h cutoff for screening decisions)`
- **Threshold Governance:** `Forbidden and strictly absent (theta*=0.20 frozen from Phase 10)`
- **Reproducibility Command:** `npm run benchmark:ps26170` or `python src/evaluation/ps26170_final_benchmark.py`
