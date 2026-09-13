# Predicta-26
### Industrial Semiconductor Reliability, Failure Prediction & Unknown-Anomaly Intelligence System

[![CI Pipeline](https://github.com/umeshpandeysh/predicta-26/actions/workflows/ci.yml/badge.svg)](https://github.com/umeshpandeysh/predicta-26/actions/workflows/ci.yml)
![Release v2.0.0](https://img.shields.io/badge/Release-v2.0.0--Certified-blue?style=flat-square)
![Model](https://img.shields.io/badge/Model-Native%20XGBoost%20(350%20Trees)-indigo?style=flat-square)
![Operating Threshold](https://img.shields.io/badge/Operating%20Threshold-%CE%B8*%20%3D%200.20-emerald?style=flat-square)
![Parity](https://img.shields.io/badge/Runtime%20Parity-Python%20%E2%86%94%20Node.js%20(100%25)-green?style=flat-square)
![Tests](https://img.shields.io/badge/Tests-87%2F87%20Passing%20(100%25)-brightgreen?style=flat-square)
![License Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-lightgrey?style=flat-square)

---

## Problem

In advanced semiconductor manufacturing, silicon dies undergo Automated Test Equipment (ATE) probing and Environmental Stress Screening (ESS). Traditional quality control relies on static datasheet limit checks (binning) that evaluate parameters independently. Consequently, latent parametric defects—such as gate oxide tunneling, subthreshold leakage spikes, and channel timing degradation—escape early screening gates and fail catastrophically after deployment in mission-critical automotive, aerospace, medical, and defense systems. Furthermore, global static thresholds fail to account for lot-to-lot process variations, thermal chuck biases across test machines, and gradual equipment contact resistance drift.

## Proposed Solution

Predicta-26 transforms semiconductor test analytics from rigid scalar thresholding into an end-to-end multi-criteria reliability intelligence system. The platform ingests 16 raw parametric ATE electrical channels and maps them into 28 physics-grounded features capturing degradation kinetics. An ensemble combining a 350-tree Native XGBoost classifier, an 8-class defect classifier, unsupervised Part Average Testing (PAT) with Copula-based Outlier Detection (COPOD), and Gaussian Process Regression (GPR) temporal forecasting synthesizes multidimensional risk into deterministic fab dispositions: **PASS**, **MONITOR**, or **REJECT / QUARANTINE**.

## Why Predicta?

1. **Zero Data Leakage:** Built upon rigorous hierarchical group-aware splitting (`GroupShuffleSplit` on `lot_id` and `wafer_id`), guaranteeing that training, validation, and locked test partitions share zero lots or wafers ($\text{Train Lots} \cap \text{Val Lots} \cap \text{Test Lots} = \emptyset$).
2. **Asymmetric Cost Optimization:** Calibrated at an authoritative operating threshold of $\theta^* = 0.20$, prioritizing zero field escapes ($C_{\text{FN}} = 10 \times C_{\text{FP}}$) and reducing the False Negative Rate to **0.48%**.
3. **Open-Set Zero-Day Screening:** Unsupervised PAT and COPOD tail models screen previously unseen defect patterns without requiring labeled failure data.
4. **Degradation Horizon Forecasting:** GPR temporal modeling forecasts parametric drift up to 168 hours in advance, providing an empirical lead time of **6.23 wafers** prior to equipment-induced yield crashes.
5. **Cross-Runtime Bit Parity:** Deterministic parity between Python backend training/inference and Node.js runtime inference ($\Delta \le 0.000036$).

---

## Architecture

```text
ATE Telemetry (16 Electrical & Thermal Channels)
   │
   ▼
Feature Engineering & Quality Gate (28 Continuous Physics Features)
   │
   ├──▶ Native XGBoost Failure Risk Model (350 Trees, θ* = 0.20) ────▶ Calibrated Failure Risk P(Fail)
   │
   ├──▶ Multiclass Defect Classifier (8 Known Physical Mechanisms) ───▶ Defect Taxonomy Classification
   │
   ├──▶ Open-Set Anomaly Detection (Robust MAD PAT + COPOD Copula) ───▶ Unknown Defect Flag (Normal / Reject)
   │
   └──▶ Gaussian Process Regression (GPR RBF Kernel Horizon) ─────────▶ 168h Drift Forecast (Within / Exceeded)
   │
   ▼
Deterministic Operational Decision Precedence Matrix
   │
   ├── 🟢 PASS: Nominal component (P < 0.20, Anomaly = Normal, Drift = Within)
   ├── 🟡 MONITOR: Borderline component (0.20 ≤ P < 0.65 or moderate drift) -> Secondary Diagnostic Screening
   └── 🔴 REJECT / QUARANTINE: Defective / Anomalous component (P ≥ 0.65, Open-Set Anomaly, or Drift Exceeded)
```

---

## Key Innovation

Predicta-26 unifies three complementary analytical paradigms into a single deterministic decision engine:
- **Supervised Discriminative Learning:** 350-tree Native XGBoost accurately captures multi-variable non-linear interactions across high-dimensional parameter spaces.
- **Unsupervised Open-Set Protection:** While supervised models only recognize known failure signatures, the PAT/COPOD anomaly engine flags abnormal multidimensional joint distributions, preventing novel defects from passing through.
- **Physics-Informed Temporal Extrapolation:** Unlike linear drift baselines that fail under saturating semiconductor degradation, Gaussian Process Regression incorporates BTI/HCI kinetics ($R^2 = 0.4040$, MAE $0.0110\,\text{V}$), delivering well-calibrated uncertainty intervals.

---

## Data

> [!IMPORTANT]
> **Synthetic Telemetry Disclosure:**
> The primary development and evaluation dataset is **physics-grounded synthetic semiconductor telemetry** designed to reproduce realistic semiconductor process variations, thermal chuck biases, edge-die leakage gradients, and physical failure envelope boundaries.

The dataset comprises **50,000 total records** partitioned across 20 simulated manufacturing lots:
- **Lot-Level Variation:** Modeled normal shifts in threshold voltage ($\Delta V_{\text{th}}$), gate oxide thickness ($T_{\text{ox}}$), sheet resistance ($R$), and load capacitance ($C$).
- **Wafer Radial Gradients:** Modeled wafer edge roll-off where dies near the wafer perimeter ($r_{\text{norm}} \to 1.0$) exhibit elevated subthreshold leakage and thermal dissipation stress.
- **Equipment Signatures:** 5 distinct ATE test tools (`EQP-101` through `EQP-105`) with systematic contact resistances and thermal offsets.
- **Emergent Failures:** Labels are generated dynamically from physical limit violations (timing slack, thermal runaway, power rail droop, dielectric breakdown) with zero hardcoded target shortcuts.

---

## Validation

All production benchmark metrics are evaluated on the **untouched locked test partition** (Lots 18–20, 7,500 samples) and can be independently reproduced via `python scripts/evaluate_production.py`.

### Final Production Model — Current Benchmark

| Metric | Certified Benchmark Value | Verification Origin |
| :--- | :--- | :--- |
| **Model Type** | Native XGBoost GBDT | `ml/models/production/predicta_xgboost_model.json` |
| **Tree Count** | **350 decision trees** | Verified by JSON learner inspection |
| **Feature Dimensionality** | **28 features** (16 raw + 7 engineered + 5 equipment) | Locked schema contract |
| **Operating Threshold ($\theta^*$)** | **0.20** | Cost-sensitive validation ($C_{\text{FN}} = 10 \times C_{\text{FP}}$) |
| **ROC-AUC Score** | **0.9997** | Evaluated on locked test partition |
| **PR-AUC Score** | **0.9995** | Evaluated on locked test partition |
| **Recall (at $\theta^* = 0.20$)** | **99.52%** (2,673 / 2,686 failures detected) | Evaluated on locked test partition |
| **False Negative Rate (FNR)** | **0.48%** (field escapes minimized) | Evaluated on locked test partition |
| **Precision (at $\theta^* = 0.20$)** | **98.06%** (wafer overkill minimized) | Evaluated on locked test partition |
| **F1 Score** | **0.9878** | Harmonic mean of precision and recall |
| **Brier Score (Calibrated)** | **0.0058** | Platt sigmoid scaling ($A = -1.0412, B = 1.0037$) |
| **Expected Calibration Error (ECE)** | **0.0023** | 10-bin equal-width calibration assessment |
| **Multiclass Defect Accuracy** | **94.67%** | 8 known failure mechanisms |
| **Unseen Equipment Recall (`EQP-105`)** | **99.46%** (ROC-AUC 0.9998) | Zero-shot holdout machine evaluation |
| **GPR Temporal Drift MAE** | **0.0110 V** (vs linear baseline 0.1675 V) | 96.67% coverage of 95% credible intervals |
| **Model SHA-256 Checksum** | `91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98` | Cryptographic byte-level lock |

---

## Security

Predicta-26 incorporates defense-in-depth API and data governance controls:
- **Timing-Safe Authentication:** Timing-safe credential comparison (`crypto.timingSafeEqual`) preventing timing side-channel attacks.
- **Strict Input Validation:** Pre-inference data quality gates reject out-of-bounds physical inputs, NaNs, infinities, and malformed types.
- **Payload & Rate Limiting:** 1 MB body size ceiling and windowed IP rate limiting (HTTP 429) thwart denial-of-service attempts.
- **Fail-Closed Architecture:** Zero local client-side prediction fallbacks. Missing or corrupted model artifacts immediately trigger `CONFIGURATION_ERROR`.
- **Secret Isolation:** Zero backend service keys exposed to frontend bundles.

---

## Testing

The platform enforces comprehensive automated verification across Python, Node.js, and browser runtimes:

```bash
# 1. Run complete Python test suite (60 tests, 0 warnings)
pytest -v

# 2. Run complete Node.js test suite (27 suites, 0 failures)
npm test

# 3. Execute standalone production benchmark evaluator
python scripts/evaluate_production.py

# 4. Verify cross-platform code formatting and linting
ruff check src tests scripts
```

**Latest Verified Test Summary:**
- **Python Tests:** 60 passed, 0 failed, 0 warnings (100% pass rate in 8.61s)
- **Node.js Tests:** 27 test suites passed, 0 failed (100% pass rate across all 27 files)
- **Runtime Parity:** 12/12 adversarial vectors verified with numerical deviation $\le 3.6 \times 10^{-5}$
- **Linting:** Clean (0 errors across `src`, `tests`, `scripts`)

---

## Deployment

- **Backend REST API:** Fast, production-grade FastAPI server (`src/api/main.py`) or Express server (`src/api/server.js`) deployable via Docker or Node runtime.
- **Serverless Edge Gateway:** Modular Vercel serverless entrypoint (`api/index.js`).
- **Database & Event Store:** Supabase PostgreSQL with Row Level Security (RLS), thread-safe local JSON persistence fallback (`ml/data/telemetry_store.json`), and comprehensive audit logs.
- **Frontend Dashboard:** Lightweight, dependency-free interactive HTML5/CSS3/JavaScript operator workstation.

---

## Limitations

1. **Synthetic Training Foundation:** While parameters adhere to semiconductor physics ($E_{\text{a}} = 0.55\,\text{eV}$, Arrhenius kinetics, Elmore delay), the primary training data is synthetically simulated. Real fab ATE measurements exhibit non-Gaussian noise, probe pin oxidation artifacts, and test fixture contact wear.
2. **Equipment Re-Calibration:** Encodings for novel ATE machines assume neutral baseline features ($0.0$). Deploying to new equipment tools requires calibration with nominal baseline runs.
3. **Continuous Probability Interpretation:** Predictions represent **calibrated empirical risk scores** under the test distribution rather than absolute physical defect certainties. Human-in-the-loop engineering review is mandatory for all `MONITOR` dispositions.

---

## Future Real-World Validation

The architecture is explicitly designed so that the preprocessing, feature extraction, calibration, and decision pipeline can be retrained on proprietary fab/ATE telemetry without altering system interfaces:
1. **STDF (Standard Test Data Format) Ingestion:** Direct integration with automated fab STDF / ATDF binary data streams.
2. **Transfer Learning:** Fine-tuning the pre-trained 350-tree XGBoost backbone on proprietary customer wafer probe datasets.
3. **Active Learning Loop:** Operator qualification overrides recorded in `telemetry_store.json` feed an automated active-learning retraining queue.

---

## Demo

Execute the deterministic 4-case qualification workflow in the workstation dashboard (`http://localhost:8000`):

1. **Case 1 — Healthy Silicon Die:**
   - Input: Nominal voltage (1.20 V), leakage current (145 µA), operating temperature (28 °C).
   - *Outcome:* Risk $P < 0.20$, Anomaly = NORMAL, Drift = WITHIN $\to$ **PASS**.
2. **Case 2 — Borderline Die (Elevated Risk):**
   - Input: Elevated leakage current (380 µA), timing margin (1.1 ns), nominal voltage.
   - *Outcome:* Risk $0.20 \le P < 0.65$, Anomaly = NORMAL $\to$ **MONITOR (Secondary Test Required)**.
3. **Case 3 — Unknown Open-Set Anomaly:**
   - Input: Voltage and frequency within datasheet limits, but abnormal multidimensional impedance correlation.
   - *Outcome:* XGBoost $P < 0.20$, but PAT/COPOD $Z > 6.0$ $\to$ **REJECT / QUARANTINE**.
4. **Case 4 — Degrading Equipment / Silicon Die:**
   - Input: High operating temperature (85 °C), severe threshold voltage shift, accelerated aging.
   - *Outcome:* GPR 168h forecast exceeds upper tolerance limit $\to$ **REJECT (Preventative Maintenance)**.

