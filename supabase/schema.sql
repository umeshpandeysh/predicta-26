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
    threshold DOUBLE PRECISION NOT NULL DEFAULT 0.45,
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
