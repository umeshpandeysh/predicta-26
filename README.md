# PREDICTA
### Industrial Semiconductor Manufacturing Intelligence Platform

![PREDICTA Telemetry Visual](docs/assets/predicta_telemetry_radar.svg)

[![CI Pipeline](https://github.com/umeshpandeysh/predicta-26/actions/workflows/ci.yml/badge.svg)](https://github.com/umeshpandeysh/predicta-26/actions/workflows/ci.yml)
![Release v2.0.0](https://img.shields.io/badge/Release-v2.0.0--Production2026-blue?style=flat-square)
![Model Baseline](https://img.shields.io/badge/Model-XGBoost%20v2.0-indigo?style=flat-square)
![Threshold](https://img.shields.io/badge/Operating%20Threshold-%CE%B8*%20%3D%200.20-emerald?style=flat-square)
![Runtime](https://img.shields.io/badge/Runtime-Node.js%20%7C%20Python-green?style=flat-square)
![License Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-lightgrey?style=flat-square)

---

## 🚀 Product Overview

**PREDICTA** is an industrial-grade semiconductor manufacturing intelligence platform designed for predictive quality control, parametric defect screening, physics-informed anomaly diagnosis, and equipment degradation forecasting.

Unlike traditional automated test equipment (ATE) pass/fail binning that relies strictly on static datasheet limits, PREDICTA integrates non-linear semiconductor device physics with supervised gradient boosting, unsupervised copula tail anomaly detection, and Gaussian Process Regression (GPR) degradation forecasting.

> **Industrial Impact:** PREDICTA identifies subtle parametric anomalies and forecasts long-term stress degradation from early burn-in telemetry, enabling early screening decisions and providing an average predictive lead time of **6.23 wafers** prior to catastrophic component failure.

---

## 🏭 Semiconductor Fab Problem & Objectives

High-reliability microelectronics (aerospace, automotive, defense, and medical devices) require near-zero failure rates. However, conventional Environmental Stress Screening (ESS) faces three critical industrial challenges:

1. **Latent Defect Escape:** Sub-surface silicon flaws often pass static datasheet voltage and current gates at early test points ($0\,\mathrm{h}$ and $24\,\mathrm{h}$), only to suffer non-linear degradation under thermal stress ($168\,\mathrm{h}$).
2. **High Testing & Oven Costs:** Subjecting 100% of manufactured dies to full $168\,\mathrm{h}$ thermal stress testing consumes massive energy, wastes oven capacity, and introduces severe production bottlenecks.
3. **Wafer Lot-to-Lot Drift:** Process variations across different wafer lots mask subtle parametric shifts when evaluated against global static thresholds.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Input ["ATE Telemetry Ingestion"]
        ATE["Automated Test Equipment<br/>(16 Raw Physical Telemetry Parameters)"]
    end

    subgraph Security ["Security & Governance Layer"]
        AUTH["Auth Guard & JWT Validator<br/>(Timing-Safe Security Middleware)"]
        CAP["Payload Size & Rate Limiter<br/>(1MB Cap / 429 Throttle)"]
    end

    subgraph Core ["In-Process ML & Physics Pipeline"]
        FE["Physics Feature Extractor<br/>(7 Engineered Parameters)"]
        SGT["Supervised XGBoost Classifier<br/>(150 Trees, θ* = 0.20)"]
        OPEN["Unsupervised Open-Set Router<br/>(PAT/MAD Z-Score + COPOD Copula)"]
        GPR["Degradation Forecaster<br/>(GPR Kernel, Lead: 6.23 Wafers)"]
    end

    subgraph Decision ["Hybrid Disposition Engine"]
        RISK["Multi-Criteria Risk Fusion<br/>(LOW / REVIEW / CRITICAL)"]
        DISP["Automated Disposition Routing<br/>(PASS / SECONDARY_TEST / FAIL)"]
    end

    subgraph Store ["Persistence & Analytics"]
        DB[("Supabase PostgreSQL / Hybrid Memory<br/>(Audit Trails & Trace IDs)")]
        DASH["Workstation Dashboard<br/>(Interactive Analytics UI)"]
    end

    ATE --> AUTH --> CAP --> FE
    FE --> SGT & OPEN & GPR
    SGT & OPEN & GPR --> RISK --> DISP
    DISP --> DB & DASH
```

---

## 🧠 Physics-Informed ML Pipeline

PREDICTA processes 16 raw ATE telemetry parameters and generates 7 domain-engineered physical parameters derived from semiconductor device physics:

### Raw ATE Telemetry Inputs (16 Parameters)

`supply_voltage`, `output_voltage`, `current`, `leakage_current`, `resistance`, `capacitance`, `threshold_voltage`, `frequency`, `propagation_delay`, `setup_time`, `hold_time`, `timing_margin`, `temperature`, `dynamic_power`, `total_power`, `test_duration`.

### Physics-Informed Feature Engineering

**Voltage Headroom**

$$
V_{\mathrm{headroom}} = V_{\mathrm{supply}} - V_{\mathrm{threshold}}
$$

**Voltage Utilization**

$$
V_{\mathrm{utilization}} = \frac{V_{\mathrm{threshold}}}{V_{\mathrm{supply}}}
$$

**Leakage Fraction**

$$
F_{\mathrm{leak}} = \frac{I_{\mathrm{leak}} \times 10^{-3}}{I_{\mathrm{total}}}
$$

**Power per Current**

$$
P_{\mathrm{current}} = \frac{P_{\mathrm{dynamic}}}{I_{\mathrm{total}}}
$$

**Normalized Timing Margin**

$$
T_{\mathrm{normalized}} = \frac{T_{\mathrm{margin}}}{T_{\mathrm{propagation}}}
$$

**Frequency–Delay Product**

$$
F_{\mathrm{delay}} = f \cdot T_{\mathrm{propagation}}
$$

**Thermal Delta**

$$
\Delta T_{\mathrm{thermal}} = T_{\mathrm{measured}} - 25^\circ\mathrm{C}
$$

---

## 🛡️ Open-Set Anomaly Detection & Zero-Day Screening

To detect previously unobserved failure mechanisms (zero-day defects) without requiring labeled training data, PREDICTA incorporates a dual-layer unsupervised anomaly screening pipeline:

1. **Lot-Relative Part Average Testing (PAT / Robust MAD):** Standardizes parameter distributions relative to each wafer lot using Median Absolute Deviation (MAD), immunizing screening against lot-to-lot process shifts:

$$
Z_{\mathrm{MAD}} = \frac{x - \mathrm{median}(X)}{1.4826 \cdot \mathrm{MAD}(X)}
$$

2. **COPOD Copula Tail Anomaly Scoring:** Evaluates multivariate tail probabilities using empirical copulas to isolate subtle parameter correlations indicating early oxide breakdown, electromigration, or latch-up risks.

---

## 📈 Predictive Equipment Health & Degradation Forecasting

PREDICTA implements Gaussian Process Regression (GPR) kernel modeling calibrated with BTI (Bias Temperature Instability) degradation kinetics:

$$
\Delta V_{\mathrm{th}}(t) = A \cdot t^n \cdot \exp\left(-\frac{E_{\mathrm{a}}}{k_{\mathrm{B}} T}\right)
$$

* **Early Warning Lead Time:** Provides an average predictive warning of **6.23 wafers ahead of failure**, allowing fab engineers to recalibrate ATE chambers, clean probe cards, or initiate maintenance before batch yields decline.

---

## 📊 Verified Performance Benchmarks

All benchmark metrics are certified on the locked test set (`ml/data/processed/test.csv`, 10,000 dies / 20 wafers) under single-source-of-truth operating threshold $\theta^* = 0.20$:

| Metric | Certified Benchmark Value | Target Requirement | Evaluation Status |
|---|---|---|---|
| **Fail Recall ($\theta^* = 0.20$)** | **97.31%** (1,266 / 1,301 caught) | $\ge 97.00\%$ | **VERIFIED ✅** |
| **Nominal False Positive Rate (FPR)** | **7.70%** (670 / 8,699 normal) | $< 8.00\%$ | **VERIFIED ✅** |
| **ROC-AUC** | **0.9901** | $\ge 0.9900$ | **VERIFIED ✅** |
| **PR-AUC** | **0.9705** | $\ge 0.9700$ | **VERIFIED ✅** |
| **Zero-Day Anomaly Recall** | **94.33%** | $\ge 90.00\%$ | **VERIFIED ✅** |
| **Predictive Early Warning Lead** | **6.23 Wafers** | $\ge 5.00\text{ Wafers}$ | **VERIFIED ✅** |
| **Core Model Inference Latency** | **0.034 ms / request** | $< 1.00\text{ ms}$ | **VERIFIED ✅** |
| **Node ↔ Python Runtime Parity** | **$\le 10^{-6}$ Probability Delta** | Exact Match | **VERIFIED ✅** |
| **Adversarial Security Suite** | **15 / 15 Scenarios Passed** | 100% Pass | **VERIFIED ✅** |
| **Model Checksum (SHA-256)** | `2e7df9f1e2ad3cad...` | Certified Lock | **UNTOUCHED ✅** |

---

## 🔒 Reliability, Security & Fail-Fast Governance

* **Single Source of Truth Metadata:** `ml/models/predicta_xgboost_v2_metadata.json` (`operating_threshold = 0.20`) serves as the sole authoritative threshold source for all execution environments.
* **Fail-Fast Configuration Guard:** If metadata is missing or corrupted, inference services fail fast with an explicit `CONFIGURATION_ERROR` instead of substituting arbitrary fallback thresholds.
* **Adversarial Protection:** Enforces 1 MB body size caps on API streams, timing-safe JWT verification (`crypto.timingSafeEqual`), IP rate limiting, and strict input type sanitization.
* **Supabase Offline Resilience:** In the event of network disconnection or database timeouts, the API seamlessly operates in hybrid in-memory storage mode (`persistence_mode: "SUPABASE_HYBRID_MEMORY"`).

---

## 📁 Repository Structure

```text
.
├── api/                   # Vercel serverless gateway entrypoint (index.js)
├── src/
│   └── api/              # Core inference service, auth guard, REST API server
├── frontend/              # Interactive Workstation Dashboard (HTML/CSS/JS)
├── ml/
│   ├── models/           # Certified XGBoost v2 model & authoritative metadata
│   ├── data/             # Processed train/val/test CSV splits (disjoint wafers)
│   └── experiments/      # Research challenger records (EXP-15A through EXP-15F)
├── docs/                  # Technical reports, system model cards, audit documentation
│   └── assets/           # Production graphics & telemetry visual assets
├── tests/                 # Master test suites (contract, parity, security, inference)
├── package.json           # Project manifests and test script entrypoints
└── README.md              # Public platform documentation
```

---

## 🧪 Reproducibility & Regression Verification

Run the master test suites to verify threshold contracts, inference determinism, cross-runtime parity, and security controls:

```bash
# Clone the repository
git clone https://github.com/umeshpandeysh/predicta-26.git
cd predicta-26

# Install Node.js dependencies
npm install

# Run automated master test suite
npm test
```

### Individual Test Suites
```bash
# 1. Threshold Contract Verification (0.19 -> PASS, 0.20 -> FAIL, 0.21 -> FAIL)
node tests/test_threshold_contract.js

# 2. Production Inference Contract Suite
node tests/test_inference.js

# 3. Node.js ↔ Python Cross-Runtime Parity Suite (12 Deterministic Vectors)
node tests/test_js_python_parity.js

# 4. Adversarial Security & Reliability Test Suite (15 Red-Team Scenarios)
node tests/test_adversarial_security.js

# 5. Live Production Deployment Verification Suite
node ml/training/run_exp11_deployment_verification.js
```

---

## ⚡ Quickstart — Local Deployment

```bash
# Start local production API server
node src/api/server.js
```
The REST API server will run at `http://localhost:8000`.

---

## ⚙️ Environment Configuration (.env.example)

Copy `.env.example` to `.env` for local runtime configuration:

```env
PORT=8000
NODE_ENV=production
SUPABASE_URL=https://your-supabase-url.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key-here

#details not to be exposed
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here
```

---

## 🔬 Scientific Limitations & Real-Fab Validation Plan

1. **Synthetic Telemetry Baseline:** All 50,000 dataset records originate from physics-informed synthetic generation (`generator.py`). While parameters are calibrated against physical device models ($E_{\mathrm{a}} = 0.55\,\mathrm{eV}$, Elmore delay), noise is modeled via zero-mean Gaussians. Real commercial fab ATE measurements may introduce asymmetric power-law noise and sensor quantization steps.
2. **Physical Silicon Validation:** Pilot validation on actual physical silicon wafers in a commercial semiconductor fabrication plant remains planned future work.

---

## 🛣️ Development Roadmap

- [x] Certified XGBoost v2 Model Baseline ($\theta^* = 0.20$, SHA-256 Lock)
- [x] Dual-Layer Unsupervised Open-Set Anomaly Router (PAT/MAD + COPOD)
- [x] Gaussian Process Regression Degradation Lead Time Forecasting
- [x] Fail-Fast Single-Source-of-Truth Threshold Hardening
- [x] Node.js ↔ Python Cross-Runtime Parity Suite ($\le 10^{-6}$ Tolerance)
- [x] Adversarial API Security & Payload Size Cap Enforcement
- [ ] Commercial Semiconductor Fab ATE Hardware Pilot Integration
- [ ] Multi-Fab Federated Learning for Yield Protection Across Fabs

---

## 📄 License

Distributed under the **Apache 2.0 License**. See `LICENSE` for details.
