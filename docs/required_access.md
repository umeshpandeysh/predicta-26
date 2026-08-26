# Predicta SIH 2026 — Required Access & Pre-Flight Action Audit

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Categorized Access & Configuration Matrix

### Category A: USER MUST DO MANUALLY (Prerequisites for Cloud Database Persistence)

1. **Create / Provision Supabase Project**:
   - **Service**: Supabase (`https://supabase.com`)
   - **Action**: Create a new free-tier Supabase project (e.g., named `predicta-production`).
   - **Scope**: Backend Database.

2. **Execute Database Migration SQL**:
   - **Service**: Supabase SQL Editor.
   - **Action**: Copy the complete contents of [`supabase/schema.sql`](file:///C:/Users/UMESH%20PANDEY/Downloads/ceenew/supabase/schema.sql) and execute it in the Supabase SQL Editor to create `prediction_runs`, `prediction_indicators`, `batch_runs`, and `dashboard_events` tables with Row Level Security.
   - **Scope**: Database Schema.

3. **Configure Production Environment Variables in Vercel**:
   - **Service**: Vercel Dashboard (`https://vercel.com/umeshsh/ceenew/settings/environment-variables`).
   - **Variables to Add**:
     - `SUPABASE_URL` = `https://<your-project-ref>.supabase.co` (Backend Only)
     - `SUPABASE_SERVICE_ROLE_KEY` = `<your-supabase-service-role-key>` (**Backend Only - NEVER expose to frontend or commit to GitHub!**)
     - `VITE_SUPABASE_URL` = `https://<your-project-ref>.supabase.co` (Frontend Safe)
     - `VITE_SUPABASE_ANON_KEY` = `<your-supabase-anon-key>` (Frontend Safe)
   - **Scope**: Vercel Production Environment Variables.

---

### Category B: ANTIGRAVITY CAN DO (Automated After Credentials Input)

1. Connect backend inference service to persist predictions into `prediction_runs` and `prediction_indicators` tables in real-time.
2. Connect batch inference service to persist batch run metrics into `batch_runs` table.
3. Connect frontend dashboard components to stream real-time summary analytics from Supabase.
4. Execute automated end-to-end regression test suite verifying live Supabase persistence.

---

### Category C: NEEDS USER APPROVAL

1. Redeploying Vercel production build after environment variables are configured.

---

### Category D: ALREADY CONNECTED & VERIFIED

1. **GitHub Repository**: Connected & tracked (`https://github.com/umeshpandeysh/predicta-26.git` on `main`).
2. **GitHub Actions CI**: Connected & passing (`.github/workflows/ci.yml`).
3. **Vercel Git Integration**: Connected & automatically deploying (`https://ceenew.vercel.app`).
4. **Live Production API**: Connected & responding (`https://ceenew.vercel.app/api/health`, `/api/predict`, `/api/predict/batch`).
5. **Frozen ML Inference Engine**: Connected & loading (`ml/models/predicta_final_xgboost.json` at threshold `0.45`).
6. **Local ML Backup**: Connected & verified (`C:\Users\UMESH PANDEY\Downloads\predicta-ml-backup`).
