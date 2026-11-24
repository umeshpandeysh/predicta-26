# PREDICTA-26 — PS26170_FINAL_BENCHMARK Report

**Problem Statement:** PS-26170 / SIH-170 — AI-Driven Anomaly Detection in Component Burn-In & Screening
**Authoritative Model SHA-256:** `91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98`
**Operating Threshold:** `θ* = 0.20`
**Locked source partition:** `ml/data/processed/test.csv` (7500 rows, SHA-256: `413ec0b7a5175dca99742c96e106718552a213a273e4ec5a314125f1f2b936b2`)
**Generated:** `2026-11-24T18:08:14Z`

---

Evaluated 1920 measurements at 0–24h out of 7500 source rows. Target: Same-checkpoint FAIL, is_latent=1, or defect_type other than NORMAL.
Positive full-pipeline decision: REJECT or MONITOR with classifier probability >= operating threshold. The snapshot labels do not establish a time to failure.
Unavailable: No Isolation Forest trees in production artifact.

## 1. Comparative Screening Benchmark (Early Checkpoints)

| Approach ID | Approach Name | Category | Recall | FNR | FPR | Precision | F1-Score | ROC-AUC | PR-AUC | Lead Time (Mean) | Latency (Avg) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **BASELINE_A** | Baseline A — Static Datasheet Limits | `BENCHMARK` | **0.0426** | 0.9574 | 0.0000 | 1.0000 | 0.0817 | 0.5213 | 0.6968 | N/A | 0.03 ms |
| **BASELINE_B** | Baseline B — Lot-Relative Statistical Screening | `BENCHMARK` | **0.4858** | 0.5142 | 0.2179 | 0.5634 | 0.5217 | 0.7078 | 0.6163 | N/A | 0.06 ms |
| **BASELINE_C** | Baseline C — Mahalanobis Distance Challenger | `CHALLENGER` | **0.1861** | 0.8139 | 0.0181 | 0.8562 | 0.3057 | 0.7602 | 0.6678 | N/A | 0.05 ms |
| **BASELINE_E** | Baseline E — PREDICTA Anomaly Stack | `PRODUCTION_SUBSYSTEM` | **0.8977** | 0.1023 | 0.6094 | 0.4603 | 0.6086 | 0.7470 | 0.6601 | N/A | 0.06 ms |
| **BASELINE_F** | Baseline F — PREDICTA Full Pipeline | `PRODUCTION` | **0.8722** | 0.1278 | 0.2648 | 0.6560 | 0.7488 | 0.9449 | 0.9399 | N/A | 4.41 ms |

---

### All operational dispositions

| Disposition | Positive label | Negative label |
|---|---:|---:|
| PASS | 29 | 359 |
| MONITOR | 70 | 538 |
| REJECT | 605 | 319 |

## 2. Four Canonical PS-26170 Operational Cases

| Case | Scenario | Expected Behavior | Observed Decision | Actual Risk Probability | Key Differentiator |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Case A** | Nominal Healthy Die | `PASS` | **`PASS`** | P = 0.0035 | Healthy silicon verified without false alarm scrap. |
| **Case B** | Static-Limit Escape | `REJECT` (Lot Anomaly) | **`REJECT`** | P = 0.0840 | Catches subtle drift ($I_{\text{leak}} = 145\mu\text{A} < 250\mu\text{A}$ limit) via lot PAT outlier ($Z=6.08$). |
| **Case C** | 24h Normal $\to$ 168h Failure | `REJECT` (Early Warning) | **`REJECT`** | P = 0.0117 | 168h GPR prognostic forecast detects end-of-test limit breach at $t=24\text{h}$. |
| **Case D** | Benign Process Drift | `MONITOR` (Scrap Prevented) | **`MONITOR`** | P = 0.0031 | Prevents wasteful scrap by routing benign variation to non-destructive secondary ATE inspection. |

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
| **Warm Inference P95 Latency** | Measured P95 Latency (Python) | `4.81` ms (Avg: `3.99` ms, Count: `500`) | P95 < 100.0 ms | **`PASS`** |

---

## 4. Reproducibility & Governance

- **Reproducibility Command:** `npm run benchmark:ps26170` or `python src/evaluation/ps26170_final_benchmark.py`
- **Historical Exploration Status:** `HISTORICAL_ARCHIVED (Evaluation Sweep 0.4500 strictly deprecated)`
- **Evaluation Determinism:** `Bit-level deterministic across 1920 test records`
