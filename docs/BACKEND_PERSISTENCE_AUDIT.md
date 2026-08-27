# PREDICTA — Backend Phase 1 Database & Persistence Forensic Audit Report

**Date**: August 27, 2026  
**Project**: PREDICTA Semiconductor Test Analytics (SIH 2026 · Problem Statement 170)  
**Status**: PERSISTENCE AUDIT COMPLETE (READ-ONLY AUDIT)  

---

## 1. Schema Inventory (`supabase/schema.sql`)

| Table Name | Purpose | Primary Key | Foreign Keys | RLS Enabled | Indexes Created |
|---|---|---|---|---|---|
| `public.prediction_runs` | Stores single prediction runs | `id` (UUID) | None | **YES** (`Public Read`, `Anon Insert`) | `idx_prediction_runs_secondary_test`, `idx_prediction_runs_op_decision`, `idx_prediction_runs_created_at`, `idx_prediction_runs_equipment_id`, `idx_prediction_runs_prediction` |
| `public.prediction_indicators` | Legacy 2-feature indicators | `id` (UUID) | `prediction_id` ➔ `prediction_runs(id)` | **YES** (`Public Read`, `Anon Insert`) | `idx_prediction_indicators_pred_id` |
| `public.batch_runs` | Summaries of batch runs | `id` (UUID) | None | **YES** (`Public Read`, `Anon Insert`) | None |
| `public.dashboard_events` | Audit log events table | `id` (UUID) | None | **YES** (`Public Read`, `Anon Insert`) | None |

---

## 2. Application ↔ Database Mapping

| File Path | Function / Method | Target Table | DB Operation | Triggering Endpoint | Data Written / Read | Error Handling Behavior |
|---|---|---|---|---|---|---|
| `src/api/inference.js` | `persistSingleToSupabase(r)` | `prediction_runs` | `INSERT` + `.select('id').single()` | `POST /api/predict` | Scalar fields: `test_id`, `equipment_id`, `prediction`, `probability`, `threshold`, `risk_level`, `operational_decision`, `decision_class`, `requires_secondary_test`, `decision_reason`, `model_version` | `try/catch` + `.catch()`. Logs warning console message; returns HTTP 200 to client. |
| `src/api/inference.js` | `persistSingleToSupabase(r)` | `prediction_indicators` | `INSERT` | `POST /api/predict` | Rows mapped from `explanation.key_indicators`: `prediction_id`, `feature`, `value`, `unit`, `status`, `description` | Non-blocking `catch`. |
| `src/api/inference.js` | `persistBatchToSupabase(b)` | `batch_runs` | `INSERT` | `POST /api/predict/batch` | `total_count`, `pass_count`, `fail_count`, `fail_rate`, `average_probability`, `model_version` | Non-blocking `catch`. |
| `src/api/inference.js` | `requestSecondaryTest()` | **NONE** (In-Memory Only) | Memory Mutation | `POST /api/prediction/secondary-test/request` | Mutates `record.lifecycle_state`, `record.requires_secondary_test`, appends `record.event_history` in `predictionStore` | **NEVER WRITTEN TO SUPABASE** |
| `src/api/inference.js` | `completeSecondaryTest()` | **NONE** (In-Memory Only) | Memory Mutation | `POST /api/prediction/secondary-test/complete` | Mutates `record.secondary_test_result`, `record.lifecycle_state`, appends `record.event_history` in `predictionStore` | **NEVER WRITTEN TO SUPABASE** |
| `src/api/inference.js` | `confirmDisposition()` | **NONE** (In-Memory Only) | Memory Mutation | `POST /api/prediction/disposition` | Mutates `record.operator_disposition`, `record.lifecycle_state`, appends `record.event_history` in `predictionStore` | **NEVER WRITTEN TO SUPABASE** |

---

## 3. Single & Batch Prediction Persistence Flow

### Single Prediction Flow (`POST /api/predict`)
1. HTTP request received at `src/api/server.js`.
2. `predictSingle(record)` called in `src/api/inference.js`.
3. Validation gate checks fields, executes 5 locked ML phases (PAT, COPOD, GPR Forecast + Calibrated CIs, Safety Slope, Risk Engine, Explainability).
4. `storedRecord` (containing full `ml_details`, `trace_id`, `lifecycle_state`) unshifted onto `this.predictionStore` array in RAM (capped at 500 items).
5. **Floating Un-Awaited Promise**: `this.persistSingleToSupabase(storedRecord).catch(...)` is called asynchronously without `await`.
6. HTTP 200 response returned immediately to client.

### Batch Prediction Flow (`POST /api/predict/batch`)
1. Batch array processed sequentially via `predictSingle(item)`.
2. Batch summary unshifted onto `this.batchStore` in RAM (capped at 50 items).
3. **Floating Un-Awaited Promise**: `this.persistBatchToSupabase(batchSummary).catch(...)` called asynchronously without `await`.

---

## 4. Secondary QA Workflow Persistence Audit

```
PREDICTED / REVIEW_REQUIRED
           │  (POST /api/prediction/secondary-test/request)
           ▼
SECONDARY_TEST_PENDING   ◄─── STORED IN RAM ONLY (predictionStore)
           │  (POST /api/prediction/secondary-test/complete)
           ▼
SECONDARY_TEST_COMPLETED ◄─── STORED IN RAM ONLY (predictionStore)
           │  (POST /api/prediction/disposition)
           ▼
CONFIRMED_PASS / CONFIRMED_FAIL / QUARANTINED ◄─── STORED IN RAM ONLY
```

- **Forensic Finding**: Secondary QA workflow transitions (**Request Secondary Test**, **Complete Secondary Test**, **Confirm Disposition**) mutate in-memory array `predictionStore` ONLY. **They are NEVER written to Supabase.** On server restart or Vercel serverless cold start, all QA workflow state transitions are permanently lost.

---

## 5. Dashboard Data Query Audit

- `GET /api/dashboard/summary` ➔ Computes stats from `this.predictionStore` array in RAM.
- `GET /api/dashboard/recent` ➔ Slices `this.predictionStore` array in RAM.
- `GET /api/dashboard/equipment` ➔ Aggregates `this.predictionStore` array in RAM.
- `GET /api/dashboard/risk` ➔ Aggregates `this.predictionStore` array in RAM.
- `GET /api/prediction/history` ➔ Searches `this.predictionStore` array in RAM.
- **Forensic Finding**: Dashboard endpoints **DO NOT QUERY SUPABASE AT ALL**. They rely 100% on the global in-memory array `predictionStore`.

---

## 6. In-Memory Store (`predictionStore`) Analysis

- **Instantiation**: Array initialized in `PredictaInferenceServiceJS` constructor (`this.predictionStore = []`).
- **Cap Limit**: 500 records max (`this.predictionStore.length > 500`).
- **Serverless Risk on Vercel**: **CRITICAL**. On Vercel, serverless functions cold-start frequently and spin up isolated runtime instances. Global variable `predictionStore` starts empty in new instances and is not shared across instances. This causes dashboard analytics to reset to zero or flicker unpredictably.

---

## 7. Supabase Failure Behavior

If Supabase is offline, credentials missing, or database write fails:
- `predictSingle()` catches exception internally (`console.warn("Supabase single prediction exception:", err.message)`).
- Returns HTTP 200 `success` payload to user.
- Record persists in RAM `predictionStore`.
- **Result**: Client UI remains operational, but cloud database fails silently without retry or alert.

---

## 8. Data Consistency & Divergence Audit

- **Memory vs Database Divergence**:
  - `predictionStore` contains: `trace_id`, 5-Phase `ml_details` (PAT, COPOD, GPR Forecast, 95% CIs, Safety Slope, Risk Score, Risk Class, Explainability Trace), `lifecycle_state`, `secondary_test_result`, `operator_disposition`, `event_history`.
  - Supabase `prediction_runs` contains: basic scalar fields (`test_id`, `equipment_id`, `prediction`, `probability`, `threshold`, `risk_level`, `operational_decision`, `decision_class`, `requires_secondary_test`, `decision_reason`, `model_version`).
- **Idempotency**: None. `prediction_runs` uses auto-generated UUID primary key (`gen_random_uuid()`). Retried requests create duplicate rows in Supabase.

---

## 9. API Contract ↔ Database Schema Field Mapping

| API Field / Object | `predictionStore` (RAM) | Supabase `prediction_runs` Column | Status in Supabase |
|---|---|---|---|
| `test_id` | Stored | `test_id` (TEXT) | Persisted |
| `trace_id` | Stored | **MISSING** | **NOT PERSISTED** |
| `equipment_id` | Stored | `equipment_id` (TEXT) | Persisted |
| `prediction` | Stored | `prediction` (TEXT) | Persisted |
| `probability` | Stored | `probability` (DOUBLE) | Persisted |
| `threshold` | Stored | `threshold` (DOUBLE) | Persisted |
| `risk_level` | Stored | `risk_level` (TEXT) | Persisted |
| `operational_decision` | Stored | `operational_decision` (TEXT) | Persisted |
| `decision_class` | Stored | `decision_class` (TEXT) | Persisted |
| `requires_secondary_test` | Stored | `requires_secondary_test` (BOOLEAN) | Persisted |
| `decision_reason` | Stored | `decision_reason` (TEXT) | Persisted |
| `model_version` | Stored | `model_version` (TEXT) | Persisted |
| `lifecycle_state` | Stored | **MISSING** | **NOT PERSISTED** |
| `secondary_test_result` | Stored | **MISSING** | **NOT PERSISTED** |
| `operator_disposition` | Stored | **MISSING** | **NOT PERSISTED** |
| `ml_details` | Stored | **MISSING** | **NOT PERSISTED** |
| `event_history` | Stored | **MISSING** | **NOT PERSISTED** |

---

## 10. Serverless Compatibility Breakdown (Vercel)

| Aspect | Evaluation | Risk Rating | Reason |
|---|---|---|---|
| **Global Memory (`predictionStore`)** | Non-Persistent | **CRITICAL** | Wiped on cold starts; un-shared across lambdas. |
| **Floating Async Writes** | Non-Awaited | **CRITICAL** | Vercel freezes lambda before background Supabase write finishes. |
| **Dashboard Queries** | RAM-Only | **CRITICAL** | Dashboard statistics reset on cold restart. |
| **QA Workflow State** | RAM-Only | **CRITICAL** | Secondary test actions lost on server restart. |
| **Artifact Loading** | In-Process | **SAFE** | Static read-only load at cold start ($< 15\text{ms}$). |

---

## 11. Persistence Score Matrix

- Schema Quality: **6 / 10** (Lacks `trace_id`, `ml_details` JSONB, workflow state columns)
- Database Integration: **4 / 10** (Async non-blocking floating writes; dashboard ignores DB)
- Data Durability: **3 / 10** (QA workflow state stored in RAM only)
- Consistency: **2 / 10** (RAM array holds full 5-phase evidence; DB holds legacy scalar fields)
- Error Handling: **7 / 10** (Graceful fallback prevents API crash)
- Serverless Compatibility: **2 / 10** (Floating promises killed by Vercel; RAM wiped on cold start)
- Auditability: **5 / 10** (Trace ID in RAM, but `dashboard_events` table in SQL never written to)
- Security: **6 / 10** (RLS policies enabled; service role key used when present)
- Workflow Persistence: **2 / 10** (Secondary test state machine lives in RAM only)
- Production Readiness: **4 / 10** (Requires database schema alignment & DB query migration)

$$\mathbf{PERSISTENCE\ SCORE: 41 / 100}$$

---

## 12. Critical Findings Summary

1. **CRITICAL — Vercel Floating Promises**: `persistSingleToSupabase` is called without `await`. Vercel serverless function contexts terminate before background HTTP requests to Supabase finish, causing random silent data loss.
2. **CRITICAL — RAM-Only QA Workflow**: `requestSecondaryTest`, `completeSecondaryTest`, and `confirmDisposition` mutate `predictionStore` in RAM only and never write to Supabase.
3. **CRITICAL — RAM-Only Dashboard Analytics**: Dashboard endpoints (`/api/dashboard/*`) aggregate from RAM array `predictionStore` instead of querying Supabase. Server cold starts reset dashboard numbers.
4. **HIGH — Missing Schema Columns**: `public.prediction_runs` lacks `trace_id`, `ml_details` (JSONB), `lifecycle_state`, `secondary_test_result`, and `operator_disposition` columns.

---

## 13. System Architecture Diagram (Current Actual State)

```
Client Dashboard (frontend/index.html)
        │
        ▼
Vercel Serverless Function (api/index.js -> src/api/server.js)
        │
        ▼
Node.js In-Process ML Engine (src/api/inference.js)
        │
        ├──► 1. Generates 5-Phase Evidence & Trace ID in RAM
        ├──► 2. Unshifts Full Record to predictionStore (RAM Array max 500)
        │
        ├──► 3. Floating Async Call: persistSingleToSupabase() ──► Aborted on Vercel lambda freeze!
        │                                                              │
        │                                                              ▼
        │                                                  Supabase prediction_runs
        │                                                (Stores 11 scalar fields only)
        │
        └──► 4. Dashboard Queries & Secondary QA Actions ────► Reads/Mutates RAM ONLY!
                                                               (Lost on Cold Start)
```
