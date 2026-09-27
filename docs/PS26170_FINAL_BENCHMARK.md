# PREDICTA-26 — PS26170_FINAL_BENCHMARK Report

**Problem Statement:** PS-26170 / SIH-170 — AI-Driven Anomaly Detection in Component Burn-In & Screening  
**Authoritative Model SHA-256:** `91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98`  
**Operating Threshold:** `θ* = 0.20`  
**Locked Test Set:** `ml/data/processed/test.csv` (7500 samples, SHA-256: `413ec0b7a5175dca99742c96e106718552a213a273e4ec5a314125f1f2b936b2`)  
**Generated:** `2026-09-27T23:30:26Z`  

---

## 1. Comparative Screening Benchmark (Locked Test Partition)

| Approach ID | Approach Name | Category | Recall | FNR | FPR | Precision | F1-Score | ROC-AUC | PR-AUC | Lead Time (Mean) | Latency (Avg) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **BASELINE_A** | Baseline A — Static Datasheet Limits | `BENCHMARK` | **0.0411** | 0.9589 | 0.0000 | 1.0000 | 0.0789 | 0.5205 | 0.7322 | 144.0h | 0.07 ms |
| **BASELINE_B** | Baseline B — Lot-Relative Statistical Screening | `BENCHMARK` | **0.1099** | 0.8901 | 0.0604 | 0.5900 | 0.1853 | 0.5000 | 0.7207 | 144.0h | 0.16 ms |
| **BASELINE_C** | Baseline C — Mahalanobis Distance Challenger | `CHALLENGER` | **0.1993** | 0.8007 | 0.0315 | 0.8333 | 0.3217 | 0.7894 | 0.7476 | 144.0h | 0.24 ms |
| **BASELINE_D** | Baseline D — Isolation Forest | `BENCHMARK` | **0.0000** | 1.0000 | 0.0000 | 0.0000 | 0.0000 | 0.5000 | 0.4415 | N/A | 0.09 ms |
| **BASELINE_E** | Baseline E — PREDICTA Anomaly Stack | `PRODUCTION_SUBSYSTEM` | **0.8747** | 0.1253 | 0.8138 | 0.4593 | 0.6023 | 0.5847 | 0.5373 | 144.0h | 0.17 ms |
| **BASELINE_F** | Baseline F — PREDICTA Full Pipeline | `PRODUCTION` | **0.9462** | 0.0538 | 0.6462 | 0.5365 | 0.6847 | 0.9631 | 0.9658 | 144.0h | 26.28 ms |

---

## 2. Four Canonical PS-26170 Operational Cases

| Case | Scenario | Expected Behavior | Observed Decision | Actual Risk Probability | Key Differentiator |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Case A** | Nominal Healthy Die | `PASS` | **`PASS`** | P = 47.88mA baseline | Healthy silicon verified without false alarm scrap. |
| **Case B** | Static-Limit Escape | `REJECT` (Lot Anomaly) | **`REJECT`** | P = 0.9900 | Catches subtle drift ($I_{\text{leak}} = 145\mu\text{A} < 250\mu\text{A}$ limit) via lot PAT outlier ($Z=6.08$). |
| **Case C** | 24h Normal $\to$ 168h Failure | `REJECT` (Early Warning) | **`REJECT`** | P = 0.9900 | 168h GPR prognostic forecast detects end-of-test limit breach at $t=24\text{h}$. |
| **Case D** | Benign Process Drift | `MONITOR` (Scrap Prevented) | **`MONITOR`** | P = 0.0040 | Prevents wasteful scrap by routing benign variation to non-destructive secondary ATE inspection. |

---

## 3. Scientific Integrity & Leakage Controls Audit

| Audit Domain | Parameter / Metric | Measured Value | Requirement / Boundary | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Exact Duplicate Contamination** | Cross-split duplicate count | `0` rows (`0.000%`) | 0 duplicates (Disjoint) | **`PASS`** |
| **Near-Duplicate Audit** | Continuous distance methodology | `NOT_VERIFIED — NO_DEFENSIBLE_EXISTING_METHOD` | Defensible metric contract | **DISCLOSED** |
| **Lot Overlap** | Train/Test shared lots | `0` lots | 0 lot overlap | **`PASS`** |
| **Wafer Overlap** | Train/Test shared wafers | `0` wafers | 0 wafer overlap | **`PASS`** |
| **Die Overlap** | Train/Test shared dies | `0` dies | 0 die overlap | **`PASS`** |
| **Component / Trajectory Overlap** | Component/Trajectory IDs | `NOT_PRESENT` / `NOT_PRESENT` | Explicitly audited | **`PASS`** |
| **Temporal Feature Leakage** | Future telemetry suffixes in inputs | `0` future columns | 0 future features ($t > 24\text{h}$) | **`PASS`** |
| **Threshold Provenance** | Operating threshold $\theta^*$ | `0.2` (tuning permitted: `False`) | Locked $\theta^*=0.20$, zero test tuning | **`PASS`** |
| **Warm Inference P95 Latency** | Measured P95 Latency (Python) | `31.89` ms (Avg: `24.78` ms, Count: `500`) | P95 < 50.0 ms | **`PASS`** |

---

## 4. Reproducibility & Governance

- **Reproducibility Command:** `npm run benchmark:ps26170` or `python src/evaluation/ps26170_final_benchmark.py`
- **Historical Exploration Status:** `HISTORICAL_ARCHIVED (Evaluation Sweep 0.4500 strictly deprecated)`
- **Evaluation Determinism:** `Bit-level deterministic across 7500 test records`
