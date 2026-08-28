# PREDICTA — Supabase Cloud Production Deployment Verification (Step 2 & 3)

**Date**: August 27, 2026  
**Project**: PREDICTA Semiconductor Test Analytics (Production 2026 · Semiconductor Telemetry Requirements)  
**Deployment Status**: `SUPABASE_DEPLOYMENT = BLOCKED_CREDENTIALS`  

---

## 1. Production Schema Forensic Inspection

The production database schema is fully specified in [`supabase/schema.sql`](file:///C:/Users/UMESH%20PANDEY/Downloads/ceenew/supabase/schema.sql).

- **`public.prediction_runs` Table**:
  - `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
  - `trace_id` TEXT UNIQUE NOT NULL
  - `lot_id` TEXT, `component_id` TEXT, `equipment_id` TEXT
  - `prediction` TEXT, `probability` DOUBLE PRECISION, `threshold` DOUBLE PRECISION
  - `risk_level` TEXT, `operational_decision` TEXT, `decision_class` TEXT
  - `requires_secondary_test` BOOLEAN, `decision_reason` TEXT
  - `model_version` TEXT, `lifecycle_state` TEXT
  - `secondary_test_result` TEXT, `operator_disposition` TEXT
  - `ml_details` JSONB, `event_history` JSONB
  - `created_at` TIMESTAMPTZ DEFAULT `now()`

- **`public.prediction_events` Audit Table**:
  - `id` UUID PRIMARY KEY DEFAULT `gen_random_uuid()`
  - `prediction_id` UUID REFERENCES `public.prediction_runs(id)` ON DELETE CASCADE
  - `trace_id` TEXT NOT NULL
  - `event_type` TEXT NOT NULL
  - `previous_state` TEXT, `new_state` TEXT
  - `operator` TEXT, `details` TEXT, `metadata` JSONB
  - `created_at` TIMESTAMPTZ DEFAULT `now()`

---

## 2. Live Cloud Deployment Status

- **Status Flag**: `SUPABASE_DEPLOYMENT = BLOCKED_CREDENTIALS`
- **Reason**: `SUPABASE_URL` and `SUPABASE_ANON_KEY` are not set in the local execution environment.
- **Local Fallback Mode**: Active mode is `HYBRID_MEMORY_FALLBACK (LOCAL DEMO)`. Ensures zero application crash or startup failure.
