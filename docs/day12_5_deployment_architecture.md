# Predicta Day 12.5 — Complete Deployment Architecture & Supabase Backend Integration Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. End-to-End System Architecture

```text
GitHub Repository (umeshpandeysh/predicta-26)
   │
   ├── Complete ML Pipeline (ml/models, ml/training, ml/analysis)
   ├── Frontend Workstation Dashboard (HTML5 / Vanilla CSS / JS)
   ├── REST Inference API Server (src/api/server.js / src/api/main.py)
   ├── Supabase Database Schema (supabase/schema.sql)
   └── Test Suites & Documentation
          │
          ├──────────────► Vercel (Static Dashboard Hosting)
          │                  │
          │                  ▼
          │             Predicta Dashboard UI
          │
          └──────────────► ML Backend API (FastAPI / Express Microservice)
                             │
                             ▼
                      Frozen XGBoost Model (predicta_final_xgboost.json)
                             │
                             ▼
                         Supabase (PostgreSQL Persistence)
                             │
                             ├── prediction_runs
                             ├── prediction_indicators
                             ├── batch_runs
                             └── dashboard_events
```

---

## 2. Local ML Backup Details

- **Original ML Path**: `C:\Users\UMESH PANDEY\Downloads\ceenew\ml`
- **Backup Path**: `C:\Users\UMESH PANDEY\Downloads\predicta-ml-backup`
- **Total Backup Items**: 107 files & subdirectories
- **Artifact Verifications**:
  - `models/predicta_final_xgboost.json`: **`VERIFIED [True]`**
  - `models/predicta_final_metadata.json`: **`VERIFIED [True]`**
  - `models/predicta_final_model_card.json`: **`VERIFIED [True]`**
  - `analysis/final_test_metrics.json`: **`VERIFIED [True]`**

---

## 3. GitHub ML Repository Verification

- **Repository**: `https://github.com/umeshpandeysh/predicta-26.git`
- **Tracked Production Artifacts**:
  - `ml/models/predicta_final_xgboost.json`
  - `ml/models/predicta_final_metadata.json`
  - `ml/models/predicta_final_model_card.json`
  - `ml/analysis/final_test_metrics.json`
  - `ml/training/15_build_final_model.py`
  - `ml/analysis/16_final_test_evaluation.py`

---

## 4. Vercel & Environment Configuration

- **`vercel.json`**: Configured static public output directory and clean API rewrites.
- **`.env.example`**:
  ```env
  VITE_API_BASE_URL=http://localhost:8000/api
  VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
  VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
  SUPABASE_URL=https://your-supabase-project.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here
  ```

---

## 5. Supabase Database Schema

Stored in [`supabase/schema.sql`](file:///C:/Users/UMESH%20PANDEY/Downloads/ceenew/supabase/schema.sql):
- **`prediction_runs`**: Stores single component inference runs (`id`, `created_at`, `test_id`, `equipment_id`, `prediction`, `probability`, `threshold`, `risk_level`, `model_version`).
- **`prediction_indicators`**: Stores feature explanation key indicators (`prediction_id`, `feature`, `value`, `unit`, `status`, `description`).
- **`batch_runs`**: Stores batch run summaries (`total_count`, `pass_count`, `fail_count`, `fail_rate`, `average_probability`).
- **`dashboard_events`**: Audit log for system events (`event_type`, `test_id`, `equipment_id`, `metadata`).
- **Row-Level Security (RLS)**: Public read policies and authorized key insert policies configured.

---

## 6. End-to-End Test Execution

- **Backend Inference Test Suite**: 10/10 Passed (`tests/test_inference.js`)
- **Frontend Integration Test Suite**: 7/7 Passed (`tests/test_frontend_integration.js`)
- **Production Hardening Test Suite**: 7/7 Passed (`tests/test_hardening.js`)
- **Supabase & Deployment Test Suite**: 7/7 Passed (`tests/test_supabase.js`)
- **Total Test Coverage**: **31/31 Test Cases Passed (100% Pass Rate)**.

---

## 7. Model Integrity & Test-Set Protection Confirmation

- **Frozen Production Model**: `ml/models/predicta_final_xgboost.json` (100% UNTOUCHED)
- **Operating Threshold**: `0.45` (STRICTLY PRESERVED)
- **Locked Test Set Benchmark**: `ml/data/processed/test.csv` (ABSOLUTELY NOT ACCESSED)
