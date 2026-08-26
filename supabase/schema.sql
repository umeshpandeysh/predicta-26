-- Predicta Semiconductor Test Analytics — Supabase Production Schema
-- File: supabase/schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table 1: Single Prediction Runs
CREATE TABLE IF NOT EXISTS public.prediction_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    test_id TEXT NOT NULL,
    equipment_id TEXT NOT NULL,
    prediction TEXT NOT NULL CHECK (prediction IN ('PASS', 'FAIL')),
    probability DOUBLE PRECISION NOT NULL,
    threshold DOUBLE PRECISION NOT NULL DEFAULT 0.45,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    operational_decision TEXT NOT NULL DEFAULT 'PASS' CHECK (operational_decision IN ('PASS', 'SECONDARY_TEST', 'FAIL')),
    decision_class TEXT NOT NULL DEFAULT 'LOW_RISK',
    requires_secondary_test BOOLEAN NOT NULL DEFAULT false,
    decision_reason TEXT,
    model_version TEXT NOT NULL DEFAULT '2.0_production'
);

CREATE INDEX IF NOT EXISTS idx_prediction_runs_secondary_test ON public.prediction_runs(requires_secondary_test);
CREATE INDEX IF NOT EXISTS idx_prediction_runs_op_decision ON public.prediction_runs(operational_decision);

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

-- Table 4: Dashboard Audit Events
CREATE TABLE IF NOT EXISTS public.dashboard_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    event_type TEXT NOT NULL,
    test_id TEXT,
    equipment_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_prediction_runs_created_at ON public.prediction_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_runs_equipment_id ON public.prediction_runs(equipment_id);
CREATE INDEX IF NOT EXISTS idx_prediction_runs_prediction ON public.prediction_runs(prediction);
CREATE INDEX IF NOT EXISTS idx_prediction_indicators_pred_id ON public.prediction_indicators(prediction_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.prediction_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prediction_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_events ENABLE ROW LEVEL SECURITY;

-- Practical RLS Policies (Public Read & Authenticated/Anon Insert for Prototype)
CREATE POLICY "Public Read prediction_runs" ON public.prediction_runs FOR SELECT USING (true);
CREATE POLICY "Anon Insert prediction_runs" ON public.prediction_runs FOR INSERT WITH CHECK (true);

CREATE POLICY "Public Read prediction_indicators" ON public.prediction_indicators FOR SELECT USING (true);
CREATE POLICY "Anon Insert prediction_indicators" ON public.prediction_indicators FOR INSERT WITH CHECK (true);

CREATE POLICY "Public Read batch_runs" ON public.batch_runs FOR SELECT USING (true);
CREATE POLICY "Anon Insert batch_runs" ON public.batch_runs FOR INSERT WITH CHECK (true);

CREATE POLICY "Public Read dashboard_events" ON public.dashboard_events FOR SELECT USING (true);
CREATE POLICY "Anon Insert dashboard_events" ON public.dashboard_events FOR INSERT WITH CHECK (true);
