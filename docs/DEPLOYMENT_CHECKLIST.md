# PREDICTA — Deployment & Verification Checklist (Production 2026)

This checklist documents the deployment, artifact bundling, and verification steps required for PREDICTA's production deployment and PREDICTA Industrial ML Platform demonstration.

---

## 1. Source Control & Repository Hygiene
- [x] **GitHub Tracking**: All required source files (`src/`, `api/`, `frontend/`, `ml/models/`, `docs/`, `tests/`) are committed and tracked.
- [x] **Environment Secrets**: Secrets and credentials are NOT committed. `.env` is ignored by `.gitignore`. Template provided in `.env.example`.
- [x] **Portable Paths**: Zero absolute Windows paths (`C:\Users\`) in production code. All paths resolve relative to project root (`path.join(__dirname, '../../ml/models/...')`).

---

## 2. ML Artifact Bundling & Model Storage
- [x] **`ml/models/predicta_anomaly_artifacts.json`**: Bundles PAT Robust MAD medians/sigmas and COPOD empirical copula quantiles.
- [x] **`ml/models/predicta_gpr_kernel_artifacts.json`**: Bundles pre-computed RBF kernel weights $\alpha$, inverse kernel matrix $K^{-1}$, feature standardization parameters, and calibrated observation noise $\sigma_{\text{obs}}$.
- [x] **Zero Runtime Training**: Artifacts are loaded once at serverless cold start. Zero dataset scanning or model fitting during requests.

---

## 3. Serverless Architecture (Vercel)
- [x] **Serverless Handler**: `api/index.js` wraps `src/api/server.js` and `src/api/inference.js`.
- [x] **In-Process Inference**: Node.js inference engine executes in-process inside Vercel serverless functions with zero external microservice dependency.
- [x] **`vercel.json` Route Config**: All `/api/*` requests rewrite to `/api/index.js` handler with `maxDuration: 10`.

---

## 4. API Contract & Resilience
- [x] **Error Handling**: Missing required fields, NaN, Infinity, or out-of-bounds telemetry values return controlled `DATA_QUALITY_REJECTED` JSON responses without crashing or exposing stack traces.
- [x] **Payload Preserved**: Responses return standard keys (`prediction`, `probability`, `threshold`, `risk_level`, `explanation`, `trace_id`) plus full evidence (`ml_details.anomaly_detection`, `ml_details.drift_prediction`, `ml_details.safety_slope`, `ml_details.risk_engine`, `ml_details.explainability`).

---

## 5. Performance Benchmarks
- [x] **Cold Start Latency**: $< 15\text{ms}$ (artifact JSON parsing at startup).
- [x] **Warm Request Latency**: **$< 1.5\text{ms}$ per prediction** ($1,000$ consecutive requests completed in $850\text{ms}$).
- [x] **Memory Footprint**: $< 12\text{MB}$ RSS.

---

## 6. Verification Commands
```bash
# Run full release readiness verification
npm test

# Run production readiness check
node scratch/verify_production_readiness.js

# Run full ML pipeline integration audit
node scratch/verify_full_ml_pipeline.js
```
