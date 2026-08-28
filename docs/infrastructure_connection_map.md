# Predicta Production 2026 — Infrastructure Connection Map

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Production Infrastructure Connection Map

```text
GitHub Repository (umeshpandeysh/predicta-26)
   │
   ├──────────────► GitHub Actions CI (.github/workflows/ci.yml) [PASSING]
   │
   └──────────────► Vercel Git Integration Webhook [CONNECTED & DEPLOYED]
                      │
                      ▼
             Vercel Production Platform (https://ceenew.vercel.app)
                      │
                      ├── Static Frontend Workstation UI (https://ceenew.vercel.app)
                      │      │
                      │      ▼
                      └── Node.js Serverless API (https://ceenew.vercel.app/api/*)
                             │
                             ├────────► Frozen XGBoost Model (predicta_final_xgboost.json)
                             │            • Version: 2.0_production
                             │            • Operating Threshold: 0.45
                             │
                             └────────► Supabase PostgreSQL Database (PENDING PROVISIONING)
                                          • prediction_runs
                                          • prediction_indicators
                                          • batch_runs
                                          • dashboard_events
```

---

## 2. Infrastructure URL Directory

| Infrastructure Component | URL / Location | Status |
| :--- | :--- | :--- |
| **GitHub Repository** | `https://github.com/umeshpandeysh/predicta-26.git` | **CONNECTED / ACTIVE** |
| **Production Frontend UI** | `https://ceenew.vercel.app` | **ONLINE / LIVE** |
| **Production API Health** | `https://ceenew.vercel.app/api/health` | **ONLINE (HTTP 200)** |
| **Production Single Predict** | `https://ceenew.vercel.app/api/predict` | **ONLINE (HTTP 200)** |
| **Production Batch Predict** | `https://ceenew.vercel.app/api/predict/batch` | **ONLINE (HTTP 200)** |
| **Dashboard Summary Endpoint**| `https://ceenew.vercel.app/api/dashboard/summary` | **ONLINE (HTTP 200)** |
| **Supabase Cloud Project** | *Awaiting User Project Provisioning* | **PENDING USER SETUP** |
