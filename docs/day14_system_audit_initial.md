# Predicta SIH 2026 — Day 14 Initial System Architecture & Repository Audit

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Production Architecture Directory

| Component Layer | Primary File(s) | Function / Description |
| :--- | :--- | :--- |
| **Vercel Serverless Entrypoint** | `api/index.js` | Exports standard Vercel `(req, res)` handler delegating to `src/api/server.js`. |
| **Node API Router** | `src/api/server.js` | Handles HTTP routing for `/api/health`, `/api/predict`, `/api/predict/batch`, and `/api/dashboard/*`. |
| **Production ML Engine (Node)** | `src/api/inference.js` | Loads `predicta_final_xgboost.json`, executes 28-feature engineering, evaluates threshold `0.45`, streams Supabase records. |
| **Python Local API (Dev)** | `src/api/main.py` / `src/api/inference_service.py` | FastAPI server implementation for local python development and testing. |
| **Production Frontend UI** | `index.html`, `frontend/api.js`, `frontend/script.js` | Industrial semiconductor workstation dashboard UI. |
| **Database Schema** | `supabase/schema.sql` | PostgreSQL schema defining `prediction_runs`, `prediction_indicators`, `batch_runs`, `dashboard_events`. |
| **Production Model Artifact** | `ml/models/predicta_final_xgboost.json` | Frozen production XGBoost model artifact (28 features, threshold 0.45). |

---

## 2. Legacy / Submodule Directory

- `CyberShield-AI-SOC/`, `Space_con_Hack_xyz-main/`, `sementic-search-main/`, `archive_clientforge/`: Unrelated legacy submodules ignored by `.vercelignore` and `.gitignore`.

---

## 3. Initial System Integrity Status

1. **Production Pipeline**: `api/index.js` $\to$ `src/api/server.js` $\to$ `src/api/inference.js` $\to$ `ml/models/predicta_final_xgboost.json`.
2. **Authoritative Operating Threshold**: `0.45` strictly enforced across Node, Python, and frontend clients.
3. **Database Integration**: Dynamic fallback to in-memory store when Supabase environment variables are missing; automated insertion into PostgreSQL when variables are set.
