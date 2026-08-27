# PREDICTA — SIH 2026 Finalist Technical Judge Defense Guide

**Date**: August 27, 2026  
**Project**: PREDICTA Semiconductor Test Analytics (SIH 2026 · Problem Statement 170)  
**Target Audience**: SIH Technical Judges, Semiconductor Domain Experts, & AI Auditors  

---

### Q1: Where exactly is the ML model?
**Answer**: Production inference runs via an in-process 5-phase ML engine in [`src/api/inference.js`](file:///C:/Users/UMESH%20PANDEY/Downloads/ceenew/src/api/inference.js) consuming pre-trained model artifacts stored in JSON files (`ml/artifacts/predicta_anomaly_artifacts.json` and `ml/artifacts/predicta_gpr_calibrated_artifacts.json`).

### Q2: Is this really ML or just hardcoded rules?
**Answer**: It is a hybrid industrial pipeline. Anomaly detection (PAT Robust MAD + COPOD) and 168h drift prediction (Gaussian Process Regression) use trained statistical ML models. Safety Slope, Risk Fusion, and QA Action rules are deterministic engineering layers built on top of the ML predictions to ensure safety-critical transparency.

### Q3: Where did the training data come from?
**Answer**: Synthesized using physics-based aging equations (BTI degradation $\Delta V_{th} \propto t^n$, electromigration, thermal leakage exponential $I_{leak} \propto e^{\frac{-E_a}{k T}}$) grounded in NASA MOSFET aging and STMicroelectronics AWFD benchmark distributions (`ml/data_generator/generate_dataset.py`).

### Q4: How did you prevent data leakage?
**Answer**: Inference inputs are strictly restricted to 0h and 24h telemetry ($P_{0h}, P_{24h}, \Delta P_{24h}$). Ground truth 96h and 168h values are isolated to offline validation scripts (`scratch/verify_full_ml_pipeline.js`) and never passed to the inference endpoint.

### Q5: Why Gaussian Process Regression (GPR) instead of LSTM or Neural Networks?
**Answer**: Tabular ATE burn-in data has few time points ($0\text{h}$ and $24\text{h}$). Deep learning overfits on 2-point time series. GPR provides exact analytical Bayesian inference with explicit kernel physics and principled uncertainty estimates ($\sigma_{total}$).

### Q6: Why not XGBoost for drift prediction?
**Answer**: XGBoost was evaluated (and runs in non-blocking shadow mode `XGBoost_V2_Research_Shadow`). However, XGBoost cannot provide exact Gaussian posterior variance ($\sigma_{latent}^2$) required to calculate lower/upper safety slope confidence bounds.

### Q7: How was uncertainty calibrated?
**Answer**: GPR uncertainty includes latent function variance $\sigma_{latent}^2 = \sigma_f^2 - k_*^T K^{-1} k_*$ plus observation noise variance $\sigma_{obs}^2$, scaled by empirical residual calibration factors derived on validation lots.

### Q8: What does the 95% CI actually mean?
**Answer**: $\hat{y}_{168h} \pm 1.96 \sigma_{total}$ defines the Bayesian 95% credible interval for the parameter value at the 168h mark, accounting for both model uncertainty and measurement noise.

### Q9: Why are your thresholds valid?
**Answer**: Thresholds represent project-defined screening criteria derived from STMicroelectronics benchmark limits ($I_{ddq} \le 5000\text{ nA}$, $I_{leak} \le 500\text{ nA}$, $t_{pd} \le 250\text{ ps}$) and safety slope limits ($15\text{ nA/h}, 2\text{ nA/h}, 1\text{ ps/h}$).

### Q10: Are they real datasheet specifications?
**Answer**: They are explicitly documented in code and UI as `PROJECT_DEFINED_SCREENING_CRITERIA` to reflect prototype screening limits rather than universal vendor datasheets.

### Q11: What happens after 24h?
**Answer**: The calibrated GPR model forecasts parameter degradation to 168h, allowing early screening at 24h without running full 168h burn-in testing.

### Q12: Can you detect latent defects?
**Answer**: Yes. Latent defects with normal 0h/24h values but high predicted drift slope trigger Safety Slope warnings (`WARNING` or `EXCEEDED`), flagging components for secondary testing before field failure occurs.

### Q13: What happens if the ML prediction is wrong?
**Answer**: The Multi-Criteria Risk Engine acts as a failsafe. If GPR underestimates drift but Safety Slope upper bound exceeds limits, the system overrides to `CRITICAL` risk and requires secondary ATE re-testing.

### Q14: Can one bad parameter dominate the score?
**Answer**: Yes, by design. In semiconductor manufacturing, a single parameter violating safety limits ($I_{ddq} > 5000\text{ nA}$) causes chip failure. Safety overrides ensure a single fatal parameter cannot be masked by healthy parameters.

### Q15: Why should the QA engineer trust the recommendation?
**Answer**: Phase 5 provides **Deterministic Engineering Feature Attribution** showing the exact Z-scores, predicted slopes, and safety margins that triggered the decision, avoiding black-box opacity.

### Q16: Can the operator audit the decision?
**Answer**: Yes. Every prediction is assigned a unique `trace_id` (e.g. `PRED-2026-X8F9A2`), recorded in `public.prediction_runs` and `public.prediction_events`, providing a full audit timeline (`/api/prediction/history`).

### Q17: What happens if the server restarts?
**Answer**: State is persisted in Supabase Cloud PostgreSQL. In local/demo mode, state persists in a durable memory cache (`predictionStore`).

### Q18: What happens if Supabase is unavailable?
**Answer**: The system automatically degrades to `HYBRID_MEMORY_FALLBACK (LOCAL DEMO)`, allowing inference and dashboard monitoring to continue uninterrupted.

### Q19: Can someone modify the risk decision from the browser?
**Answer**: No. Protected endpoints (`/request`, `/complete`, `/disposition`) enforce token authentication and Role-Based Access Control (`OPERATOR` / `ADMIN`).

### Q20: Is authentication real?
**Answer**: Yes. `src/api/auth.js` verifies Bearer tokens and API keys, returning `401 Unauthorized` for missing credentials and `403 Forbidden` for role violations.

### Q21: Is rate limiting distributed?
**Answer**: No. The rate limiter is a process-local sliding-window limiter operating per Node.js process instance. It is accurately documented as process-local.

### Q22: Is SHAP actually used?
**Answer**: No. The system uses **Deterministic Engineering Feature Attribution** (`DETERMINISTIC_ENGINEERING_ATTRIBUTION`) tailored to electrical parameter physics.

### Q23: How do Python and Node produce the same answer?
**Answer**: Node.js implements the exact mathematical equations of GPR matrix multiplication ($k_*^T \alpha$), MAD standardization, and RBF kernel formulas evaluated in Python, achieving 100.0% numerical equivalence.

### Q24: What is the latency?
**Answer**: Measured single prediction latency is **$0.37\text{ ms}$** per component; 100-record batch latency is **$20.75\text{ ms}$**.

### Q25: What is the biggest limitation?
**Answer**: Cloud persistence requires configuring `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment variables in Vercel settings. In their absence, the system operates in local demo fallback mode.
