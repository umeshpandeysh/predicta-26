# PREDICTA — GitHub Release Baseline Audit (Phase 0)

**Date**: August 27, 2026  
**Project**: PREDICTA Semiconductor Test Analytics (Production 2026 · Semiconductor Telemetry Requirements)  
**Git Branch**: `main`  
**Latest Baseline Commit**: `5ba39807ec45a93a4857bd3f736881bb2039bb0f`  
**Remote Target**: `https://github.com/umeshpandeysh/predicta-26.git`  

---

## 1. Directory Structure Inventory

- `api/`: Vercel serverless HTTP entrypoint (`api/index.js`).
- `src/`: Core Node.js backend server (`src/api/server.js`), inference engine (`src/api/inference.js`), auth security module (`src/api/auth.js`), structured logger (`src/api/logger.js`), and Python decision engines.
- `frontend/`: Interactive Workstation Dashboard (`index.html`, `script.js`, `api.js`, styling assets).
- `ml/`: Model training scripts and verified JSON artifacts (`ml/models/predicta_anomaly_artifacts.json`, `ml/models/predicta_gpr_kernel_artifacts.json`).
- `supabase/`: Database schema definitions (`supabase/schema.sql`).
- `tests/`: Automated unit and integration test suites.
- `scratch/`: Master forensic verification runners and attack suites.
- `docs/`: Comprehensive technical architecture documentation, technical reviewer defense guides, and release certification reports.
