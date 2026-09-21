-- Predicta Semiconductor Test Analytics — Supabase Production Schema & Security Policies (Phase 2 Remediated)
-- File: supabase/schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table 1: Single Prediction Runs & Complete ML Evidence Store
CREATE TABLE IF NOT EXISTS public.prediction_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    test_id TEXT NOT NULL,
    trace_id TEXT,
    equipment_id TEXT NOT NULL,
    lot_id TEXT,
    component_id TEXT,
    prediction TEXT NOT NULL CHECK (prediction IN ('PASS', 'FAIL')),
    probability DOUBLE PRECISION NOT NULL,
    threshold DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    operational_decision TEXT NOT NULL DEFAULT 'PASS' CHECK (operational_decision IN ('PASS', 'SECONDARY_TEST', 'FAIL')),
    decision_class TEXT NOT NULL DEFAULT 'LOW_RISK',
    requires_secondary_test BOOLEAN NOT NULL DEFAULT false,
    decision_reason TEXT,
    model_version TEXT NOT NULL DEFAULT '2.0_production',
    lifecycle_state TEXT NOT NULL DEFAULT 'PREDICTED',
    secondary_test_result TEXT,
    operator_disposition TEXT,
    ml_details JSONB DEFAULT '{}'::jsonb,
    event_history JSONB DEFAULT '[]'::jsonb
);

-- Non-Destructive Schema Alignments (Safe for Existing Databases)
ALTER TABLE public.prediction_runs ADD COLUMN IF NOT EXISTS trace_id TEXT;
ALTER TABLE public.prediction_runs ADD COLUMN IF NOT EXISTS lot_id TEXT;
ALTER TABLE public.prediction_runs ADD COLUMN IF NOT EXISTS component_id TEXT;
ALTER TABLE public.prediction_runs ADD COLUMN IF NOT EXISTS lifecycle_state TEXT NOT NULL DEFAULT 'PREDICTED';
ALTER TABLE public.prediction_runs ADD COLUMN IF NOT EXISTS secondary_test_result TEXT;
ALTER TABLE public.prediction_runs ADD COLUMN IF NOT EXISTS operator_disposition TEXT;
ALTER TABLE public.prediction_runs ADD COLUMN IF NOT EXISTS ml_details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.prediction_runs ADD COLUMN IF NOT EXISTS event_history JSONB DEFAULT '[]'::jsonb;

-- Database Integrity: PostgreSQL UNIQUE Constraint on trace_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_prediction_runs_trace_id ON public.prediction_runs(trace_id) WHERE trace_id IS NOT NULL;

-- Indexes for Single Prediction Runs
CREATE INDEX IF NOT EXISTS idx_prediction_runs_trace_id ON public.prediction_runs(trace_id);
CREATE INDEX IF NOT EXISTS idx_prediction_runs_test_id ON public.prediction_runs(test_id);
CREATE INDEX IF NOT EXISTS idx_prediction_runs_lifecycle_state ON public.prediction_runs(lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_prediction_runs_secondary_test ON public.prediction_runs(requires_secondary_test);
CREATE INDEX IF NOT EXISTS idx_prediction_runs_op_decision ON public.prediction_runs(operational_decision);
CREATE INDEX IF NOT EXISTS idx_prediction_runs_created_at ON public.prediction_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_runs_equipment_id ON public.prediction_runs(equipment_id);
CREATE INDEX IF NOT EXISTS idx_prediction_runs_prediction ON public.prediction_runs(prediction);

-- Table 2: Prediction Key Indicators & Explanations
CREATE TABLE IF NOT EXISTS public.prediction_indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id UUID NOT NULL REFERENCES public.prediction_runs(id) ON DELETE CASCADE,
    feature TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    unit TEXT,
    status TEXT NOT NULL,
    description TEXT
);

CREATE INDEX IF NOT EXISTS idx_prediction_indicators_pred_id ON public.prediction_indicators(prediction_id);

-- Table 3: Batch Run Summaries
CREATE TABLE IF NOT EXISTS public.batch_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    total_count INTEGER NOT NULL,
    pass_count INTEGER NOT NULL,
    fail_count INTEGER NOT NULL,
    fail_rate DOUBLE PRECISION NOT NULL,
    average_probability DOUBLE PRECISION NOT NULL,
    model_version TEXT NOT NULL DEFAULT '2.0_production'
);

-- Table 4: Dashboard & Secondary QA Audit Events
CREATE TABLE IF NOT EXISTS public.prediction_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    prediction_id UUID REFERENCES public.prediction_runs(id) ON DELETE CASCADE,
    trace_id TEXT,
    event_type TEXT NOT NULL,
    previous_state TEXT,
    new_state TEXT,
    operator TEXT,
    details TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_prediction_events_trace_id ON public.prediction_events(trace_id);
CREATE INDEX IF NOT EXISTS idx_prediction_events_pred_id ON public.prediction_events(prediction_id);

-- Table 5: Legacy Dashboard Audit Events
CREATE TABLE IF NOT EXISTS public.dashboard_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    event_type TEXT NOT NULL,
    test_id TEXT,
    equipment_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable Row Level Security (RLS) on all tables (Defense-in-Depth)
ALTER TABLE public.prediction_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_events ENABLE ROW LEVEL SECURITY;

-- Clean up legacy unrestricted public policies if present
DROP POLICY IF EXISTS "Public Read prediction_runs" ON public.prediction_runs;
DROP POLICY IF EXISTS "Anon Insert prediction_runs" ON public.prediction_runs;
DROP POLICY IF EXISTS "Anon Update prediction_runs" ON public.prediction_runs;

DROP POLICY IF EXISTS "Public Read prediction_indicators" ON public.prediction_indicators;
DROP POLICY IF EXISTS "Anon Insert prediction_indicators" ON public.prediction_indicators;

DROP POLICY IF EXISTS "Public Read batch_runs" ON public.batch_runs;
DROP POLICY IF EXISTS "Anon Insert batch_runs" ON public.batch_runs;

DROP POLICY IF EXISTS "Public Read prediction_events" ON public.prediction_events;
DROP POLICY IF EXISTS "Anon Insert prediction_events" ON public.prediction_events;

DROP POLICY IF EXISTS "Public Read dashboard_events" ON public.dashboard_events;
DROP POLICY IF EXISTS "Anon Insert dashboard_events" ON public.dashboard_events;

-- Secure RLS Policies: Restrict public/anonymous direct access while supporting authenticated / service_role queries
-- 1. Read Policy for Authenticated Users & Server-side Queries
CREATE POLICY "Authenticated Read prediction_runs" ON public.prediction_runs 
    FOR SELECT TO authenticated USING (true);

-- 2. Restrict Direct Public Write/Update: Only Authenticated/Service Role can insert/update
CREATE POLICY "Authenticated Insert prediction_runs" ON public.prediction_runs 
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated Update prediction_runs" ON public.prediction_runs 
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Indicators Policies
CREATE POLICY "Authenticated Read prediction_indicators" ON public.prediction_indicators 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated Insert prediction_indicators" ON public.prediction_indicators 
    FOR INSERT TO authenticated WITH CHECK (true);

-- Batch Runs Policies
CREATE POLICY "Authenticated Read batch_runs" ON public.batch_runs 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated Insert batch_runs" ON public.batch_runs 
    FOR INSERT TO authenticated WITH CHECK (true);

-- Prediction Events Policies
CREATE POLICY "Authenticated Read prediction_events" ON public.prediction_events 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated Insert prediction_events" ON public.prediction_events 
    FOR INSERT TO authenticated WITH CHECK (true);

-- Dashboard Events Policies
CREATE POLICY "Authenticated Read dashboard_events" ON public.dashboard_events 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated Insert dashboard_events" ON public.dashboard_events 
    FOR INSERT TO authenticated WITH CHECK (true);

-- Table 6: Operator Dispositions & Human Feedback Governance (Phase 11 Task 1)
CREATE TABLE IF NOT EXISTS public.operator_dispositions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    disposition_id TEXT NOT NULL UNIQUE,
    trace_id TEXT NOT NULL,
    component_id TEXT NOT NULL,
    lot_id TEXT NOT NULL,
    operator_id TEXT NOT NULL,
    operator_role TEXT NOT NULL DEFAULT 'OPERATOR',
    disposition TEXT NOT NULL CHECK (disposition IN ('ACCEPT', 'REJECT', 'HOLD', 'RETEST', 'ESCALATE')),
    reason_code TEXT NOT NULL CHECK (reason_code IN ('FALSE_POSITIVE_SUSPECTED', 'FALSE_NEGATIVE_SUSPECTED', 'INSUFFICIENT_DATA', 'RETEST_REQUIRED', 'EQUIPMENT_ISSUE', 'PROCESS_EXCEPTION', 'MANUAL_ENGINEERING_REVIEW', 'OTHER')),
    comment TEXT,
    model_id_at_decision TEXT NOT NULL DEFAULT 'predicta_xgboost_model',
    model_hash_at_decision TEXT NOT NULL,
    original_ml_decision TEXT NOT NULL,
    original_ml_probability DOUBLE PRECISION NOT NULL,
    anomaly_score_at_decision JSONB,
    prognostic_output_at_decision JSONB,
    decision_at_decision TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'HUMAN_OPERATOR_GATE',
    feedback_status TEXT NOT NULL DEFAULT 'RECORDED_ONLY' CHECK (feedback_status IN ('RECORDED_ONLY', 'PENDING_OUTCOME', 'CONFIRMED', 'CONTRADICTED', 'UNRESOLVED')),
    governance_classification TEXT CHECK (governance_classification IN ('ELIGIBLE_FOR_OFFLINE_REVIEW', 'REJECTED_GOVERNANCE')),
    outcome_status TEXT NOT NULL DEFAULT 'RECORDED_ONLY',
    is_conflict BOOLEAN NOT NULL DEFAULT false,
    governance_guarantees JSONB DEFAULT '{}'::jsonb
);

-- Non-Destructive Schema Alignments
ALTER TABLE public.operator_dispositions ADD COLUMN IF NOT EXISTS outcome_status TEXT NOT NULL DEFAULT 'RECORDED_ONLY';
ALTER TABLE public.operator_dispositions ADD COLUMN IF NOT EXISTS governance_classification TEXT CHECK (governance_classification IN ('ELIGIBLE_FOR_OFFLINE_REVIEW', 'REJECTED_GOVERNANCE'));
ALTER TABLE public.operator_dispositions ADD COLUMN IF NOT EXISTS is_conflict BOOLEAN NOT NULL DEFAULT false;

-- Indexes for Operator Dispositions
CREATE INDEX IF NOT EXISTS idx_operator_dispositions_trace_id ON public.operator_dispositions(trace_id);
CREATE INDEX IF NOT EXISTS idx_operator_dispositions_component_id ON public.operator_dispositions(component_id);
CREATE INDEX IF NOT EXISTS idx_operator_dispositions_lot_id ON public.operator_dispositions(lot_id);
CREATE INDEX IF NOT EXISTS idx_operator_dispositions_feedback_status ON public.operator_dispositions(feedback_status);
CREATE INDEX IF NOT EXISTS idx_operator_dispositions_operator_id ON public.operator_dispositions(operator_id);
CREATE INDEX IF NOT EXISTS idx_operator_dispositions_created_at ON public.operator_dispositions(created_at DESC);

-- Enable Row Level Security (RLS) on operator_dispositions
ALTER TABLE public.operator_dispositions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated Read operator_dispositions" ON public.operator_dispositions;
CREATE POLICY "Authenticated Read operator_dispositions" ON public.operator_dispositions 
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated Insert operator_dispositions" ON public.operator_dispositions;
CREATE POLICY "Authenticated Insert operator_dispositions" ON public.operator_dispositions 
    FOR INSERT TO authenticated WITH CHECK (true);

-- Table 7: Append-Only Disposition Lifecycle Transition Events (Phase 11 Task 1 Remediation)
CREATE TABLE IF NOT EXISTS public.disposition_lifecycle_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE,
    disposition_id TEXT NOT NULL,
    trace_id TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT NOT NULL CHECK (new_status IN ('RECORDED_ONLY', 'PENDING_OUTCOME', 'CONFIRMED', 'CONTRADICTED', 'UNRESOLVED')),
    changed_by TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for Disposition Lifecycle Events
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_disposition_id ON public.disposition_lifecycle_events(disposition_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_trace_id ON public.disposition_lifecycle_events(trace_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_timestamp ON public.disposition_lifecycle_events(timestamp DESC);

-- Enable Row Level Security (RLS) on disposition_lifecycle_events
ALTER TABLE public.disposition_lifecycle_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated Read disposition_lifecycle_events" ON public.disposition_lifecycle_events;
CREATE POLICY "Authenticated Read disposition_lifecycle_events" ON public.disposition_lifecycle_events 
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated Insert disposition_lifecycle_events" ON public.disposition_lifecycle_events;
CREATE POLICY "Authenticated Insert disposition_lifecycle_events" ON public.disposition_lifecycle_events 
    FOR INSERT TO authenticated WITH CHECK (true);


