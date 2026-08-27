# PREDICTA
### Predictive Semiconductor Test Analytics & Early Screening System

**Smart India Hackathon 2026 · Problem Statement 170**  
**Organization:** ISRO Space Applications Centre (SAC)

[![Python CI Pipeline](https://github.com/umeshpandeysh/predicta-26/actions/workflows/ci.yml/badge.svg)](https://github.com/umeshpandeysh/predicta-26/actions/workflows/ci.yml)
![SIH 2026](https://img.shields.io/badge/SIH%202026-PS%20170-blue?style=flat-square)
![ISRO SAC](https://img.shields.io/badge/Organization-ISRO%20SAC-orange?style=flat-square)
![Node.js & Python](https://img.shields.io/badge/Runtime-Node.js%20%7C%20Python-green?style=flat-square)
![License Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-lightgrey?style=flat-square)

---

## 🚀 What is PREDICTA?

**PREDICTA** is an advanced machine learning and statistical physics framework designed for early defect identification and parametric drift forecasting in high-reliability semiconductor burn-in testing. Built for **Smart India Hackathon 2026 (Problem Statement 170)**.

> **Key Differentiator:** PREDICTA does not merely classify already-failed components. Using early $0\text{h} + 24\text{h}$ telemetry, PREDICTA identifies subtle non-linear anomalies and forecasts full $168\text{h}$ stress trajectories with Bayesian confidence intervals, enabling early screening decisions before catastrophic component failure occurs.

---

## 🎯 Problem Statement

Spacecraft microelectronics require near-zero failure rates. Traditional Environmental Stress Screening (ESS) subjects components to $125^\circ\text{C}$ stress for $168\text{ hours}$.

However, conventional screening relies on **static datasheet limits**:
- **Latent Defects Missed:** Flawed components pass static limit gates at $0\text{h}$ and $24\text{h}$, yet undergo non-linear degradation under thermal stress.
- **High Testing Costs:** Full $168\text{h}$ stress testing is required for all chips, wasting oven capacity, power, and cycle time.
- **Lot-to-Lot Variation:** Wafer manufacturing shifts mask individual parameter anomalies.

---

## 🧠 5-Phase ML Decision Engine

```text
  Burn-In Telemetry (0h & 24h: Iddq, Ileak, tpd)
                         │
                         ▼
        Phase 1: PAT Robust MAD + COPOD Screening
                         │
                         ▼
     Phase 2: Calibrated GPR 168h Forecast & Uncertainty
                         │
                         ▼
          Phase 3: Safety Slope Evaluation
                         │
                         ▼
        Phase 4: Multi-Criteria Risk Engine Fusion
                         │
                         ▼
   Phase 5: Deterministic Engineering Feature Attribution
```

1. **Phase 1 — Dynamic Outlier Screening (PAT MAD + COPOD):** Lot-relative Median Absolute Deviation (MAD) standardization and COPOD copula tail anomaly detection.
2. **Phase 2 — Calibrated 168h Drift Forecasting (Genuine GPR):** Analytical Gaussian Process Regression with $t^{0.25}$ NBTI aging kernels to predict $168\text{h}$ values and 95% Bayesian credible intervals ($\hat{y} \pm 1.96\sigma_{total}$).
3. **Phase 3 — Safety Slope Trajectory Screening:** Projects degradation rate ($\Delta y / \Delta t$) against project-defined screening criteria.
4. **Phase 4 — Multi-Criteria Risk Engine:** Fuses anomaly scores, GPR forecasts, and safety slopes into unified `SAFE`, `MONITOR`, `AT_RISK`, `CRITICAL` risk tiers with `PASS` / `REVIEW_REQUIRED` / `REJECT` disposition recommendations.
5. **Phase 5 — Deterministic Engineering Feature Attribution:** Provides exact, auditable electrical parameter feature contributions without non-deterministic black-box approximations.

---

## 🛡️ Zero Future Data Leakage & Mathematical Parity

- **0.00% Data Leakage:** Production inference functions receive strictly $0\text{h}$, $24\text{h}$, and $\Delta 24\text{h}$ parameters. Ground truth $96\text{h}$ and $168\text{h}$ values are completely isolated from inference code.
- **Python / Node.js Inference Parity:** Exact numerical equivalence between Python reference training scripts (`scripts/train_genuine_gpr.py`) and Node.js production serverless inference engine ([`src/api/inference.js`](file:///C:/Users/UMESH%20PANDEY/Downloads/ceenew/src/api/inference.js)).

---

## 🏗️ System Architecture

```text
Interactive Dashboard (frontend/)
             │
             ▼
REST API Gateway (api/index.js / src/api/server.js)
             │
             ├────────► Security & Auth Guard (src/api/auth.js)
             ├────────► Structured Logger (src/api/logger.js)
             │
             ▼
In-Process ML Engine (src/api/inference.js)
             │
             ▼
Supabase PostgreSQL (supabase/schema.sql)
             ├── public.prediction_runs (trace_id UNIQUE, ml_details JSONB)
             └── public.prediction_events (audit trail)
```

---

## ⚡ Performance Benchmarks

| Metric | Measured Benchmark Result | Target | Status |
|---|---|---|---|
| ML Artifact Load Time | **$3.82\text{ ms}$** | $< 50.0\text{ ms}$ | **PASS** |
| Single Prediction Latency | **$0.36\text{ ms}$** | $< 5.0\text{ ms}$ | **PASS** |
| 100-Record Batch Duration | **$21.60\text{ ms}$** | $< 50.0\text{ ms}$ | **PASS** |
| Dashboard Summary Query | **$0.41\text{ ms}$** | $< 10.0\text{ ms}$ | **PASS** |

---

## 🧪 Master Test Suite & Verification

Execute the master 28-test verification matrix:

```bash
# Run standard test suite
npm test

# Run complete end-to-end regression matrix across all 28 runners
node tests/test_spatial.js; node tests/test_frontend.js; node tests/test_model_inference_ui_contract.js; node tests/test_anomaly.js; node tests/test_drift.js; node tests/test_registries.js; node tests/test_phase4.js; node scratch/verify_phase4_scenarios.js; node scratch/verify_phase5_explainability.js; node scratch/verify_full_ml_pipeline.js; node scratch/verify_sih_readiness.js; node scratch/verify_production_readiness.js; node scratch/verify_persistence_phase1.js; node scratch/verify_security_phase2.js; node scratch/verify_api_contract_phase3.js; node scratch/verify_qa_state_machine_phase4.js; node scratch/verify_database_phase5.js; node scratch/verify_observability_phase6.js; node scratch/benchmark_backend_phase7.js; node scratch/verify_reliability_phase8.js; node scratch/verify_security_final.js; node scratch/verify_complete_backend.js; node scratch/test_live_http_endpoints.js; node scratch/final_live_api_audit.js; node scratch/final_e2e_audit.js; node scratch/final_security_attack_suite.js; node scratch/verify_live_vercel_api.js
```

---

## ▶️ Local Quickstart

```bash
# Clone repository
git clone https://github.com/umeshpandeysh/predicta-26.git
cd predicta-26

# Install Node.js dependencies
npm install

# Start local production API server
node src/api/server.js
```

Server runs at `http://localhost:8000`.

---

## 🔐 Environment Variables (.env.example)

```env
PORT=8000
NODE_ENV=production
SUPABASE_URL=https://your-supabase-url.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key-here

# Server-Side Only (NEVER expose to browser code or commit real keys to GitHub)
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here
```

---

## 📂 Repository Structure

```text
.
├── api/                   # Vercel serverless entrypoint (index.js)
├── src/
│   └── api/              # Express backend, inference engine, auth, logger
├── frontend/              # Interactive Workstation Dashboard (HTML/CSS/JS)
├── ml/
│   └── models/           # Pre-trained anomaly & calibrated GPR JSON artifacts
├── supabase/              # PostgreSQL schema (schema.sql)
├── tests/                 # Unit and contract tests
├── scratch/               # Master E2E verification suites & attack runner
├── docs/                  # Technical documentation & release certification reports
├── vercel.json            # Vercel routing configuration
├── package.json           # Dependencies and test script entrypoints
└── README.md              # Project documentation
```

---

## 📜 SIH 2026 Problem Statement 170 Reference

Developed for the **Smart India Hackathon 2026 (Problem Statement 170)** sponsored by **ISRO Space Applications Centre (SAC)**.
