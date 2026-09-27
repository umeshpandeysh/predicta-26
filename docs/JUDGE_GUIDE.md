# PREDICTA — SIH 2026 Judge & Reviewer Guide

**Problem Statement:** SIH26170 / PS-170 (ISRO) — AI-Driven Anomaly Detection in Component Burn-In & Screening  
**Live Production Deployment:** [https://predicta-26-pi.vercel.app](https://predicta-26-pi.vercel.app)  
**Authoritative GitHub Repository:** [https://github.com/umeshpandeysh/predicta-26](https://github.com/umeshpandeysh/predicta-26)

---

## ⏱️ Understand PREDICTA in 60 Seconds

```
   Raw Telemetry (0h/24h)
             │
             ▼
   [ Data Quality Gate ] ──────── Rejects corrupted & unphysical data
             │
             ▼
   [ Multi-Model Core ] ──────── Native XGBoost + PAT-MAD + COPOD + GPR 168h + Arrhenius Physics
             │
             ▼
   [ Governed Risk Fusion ] ──── Combines anomaly, drift & defect risk deterministically
             │
             ▼
   [ Operational Disposition ] ── PASS (Ship) / MONITOR (Secondary QA) / REJECT (Quarantine)
             │
             ▼
   [ Traceability & Twin ] ───── Immutable PostgreSQL audit trail + Evidence Card
```

1. **The Problem:** In high-reliability spaceflight electronics, components undergo 168 hours of high-temperature (125°C) burn-in testing. Traditional Automated Test Equipment (ATE) checks static limits ($L_{\text{min}} \le x \le L_{\text{max}}$). Latent defects pass static limits initially but cause catastrophic in-flight mission failures.
2. **Input:** Early electrical telemetry at $0\text{h}$ and $24\text{h}$ ($I_{\text{ddq}}$ standby current, $I_{\text{leak}}$ leakage current, $t_{\text{pd}}$ propagation delay, supply voltage, temperature, equipment ID).
3. **Detection (Module A):** Robust Part Average Testing (PAT-MAD) + COPOD multivariate copula tail analysis + Isolation Forest flag subtle out-of-family outliers that sit within standard datasheet limits.
4. **Prediction (Module B):** Bayesian Gaussian Process Regression (GPR) forecasts the continuous degradation trajectory to the $168\text{h}$ milestone with formal $95\%$ confidence bounds.
5. **Physics Interpretation:** Exact Arrhenius thermal acceleration ($E_a = 0.7\text{ eV}$), Black's electromigration kinetics, and BTI models evaluate whether electrical drift is driven by legitimate physical aging.
6. **Uncertainty:** Epistemic uncertainty is quantified via GPR covariance matrices and evaluated against candidate conformal quantiles (strictly governed as `NOT_CALIBRATED` to preserve scientific honesty).
7. **Decision:** Fail-closed operational disposition engine synthesizes all evidence into:
   - **`PASS`**: Nominal physical envelope; proceed to flight assembly.
   - **`MONITOR`**: Marginal drift / review required; route to secondary ATE inspection.
   - **`REJECT`**: Critical anomaly / forecast boundary breach; quarantine immediately.
8. **Evidence:** Every prediction produces a deterministic **Evidence Card** explaining exact parameter $Z$-scores, forecast intervals, and dominant risk factors.
9. **Traceability:** Every decision is permanently stored in PostgreSQL (Supabase) with cryptographic manifest hashes, providing an unalterable **Reliability Twin** audit trail.

---

## 🔍 If You Have 5 Minutes: Core Engineering Artifacts

Explore the authoritative engineering documentation:

*   📖 [**Canonical Production Path Specification**](architecture/canonical-production-path.md): The authoritative stage-by-stage architecture, source files, and operational consequences.
*   📋 [**Authoritative Model Registry**](models/model-registry.md): Complete catalog of all production, benchmark, validation, and research models with explicit governance tiers.
*   🔬 [**Phase 2 Scientific Validation & Challenger Benchmark**](validation/phase2-scientific-validation.md): Empirical proof on Mahalanobis challenger, conformal calibration closure, and external industrial datasets (ST-AWFD, UCI SECOM, NASA).
*   🛡️ [**Governance Gate Contract**](../ml/prognostics/governance_gate_contract.json): Cryptographic split manifests and fail-closed rules preventing data leakage.
*   🌐 [**Live Cloud API Documentation**](https://predicta-26-pi.vercel.app/api/health): Real-time serverless health endpoint reporting database connectivity and model SHA verification.

---

## 💻 If You Want to Inspect the Implementation

All core subsystems are implemented with full source code, dual Node.js/Python parity, and zero hidden magic:

| Subsystem | Source Location | Description |
| :--- | :--- | :--- |
| **REST API Server** | [`src/api/server.js`](../src/api/server.js) | Production HTTP server with security headers, rate limiting, and JWT authentication. |
| **Edge Inference Engine** | [`src/api/inference.js`](../src/api/inference.js) | Pure JavaScript zero-dependency native XGBoost tree parser, COPOD, PAT-MAD, GPR, and risk synthesis. |
| **Python ML Service** | [`src/api/inference_service.py`](../src/api/inference_service.py) | Authoritative Python service implementing identical feature engineering and inference logic. |
| **Anomaly Detectors** | [`src/anomaly_detection/`](../src/anomaly_detection/) | Robust MAD (`robust_mad.js`), COPOD copula (`copod.js`), and Isolation Forest (`isolation_forest.js`). |
| **Degradation Prognostics** | [`src/prognostics/`](../src/prognostics/) | Gaussian Process Regression forecasting, trajectory analysis, and lot stability evaluators. |
| **Physics Kinetics** | [`src/physics/`](../src/physics/) | Arrhenius thermal acceleration, Electromigration (Black's law), and BTI kinetics. |
| **Risk Fusion & Governance** | [`src/risk_fusion/`](../src/risk_fusion/) & [`src/governance/`](../src/governance/) | Multi-criteria priority synthesis and fail-closed invariant assertion (`assertNoContradictions`). |
| **Reliability Twin** | [`src/reliability_twin/`](../src/reliability_twin/) | Lifecycle state tracking and PostgreSQL relational audit trail. |
| **Verification Suite** | [`tests/test_js_python_parity.js`](../tests/test_js_python_parity.js) | 12 deterministic test vectors verifying exact 0.000000 numerical parity between Node.js and Python. |
