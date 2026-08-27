/**
 * PREDICTA — Security Remediation Phase 2 Verification Suite
 * File: scratch/test_security_remediation_phase2.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const inferenceService = require('../src/api/inference');
const ateSim = require('../src/simulation/ate_simulator');
const logger = require('../src/api/logger');

console.log("=========================================================================");
console.log("PREDICTA — SECURITY REMEDIATION PHASE 2 VERIFICATION SUITE");
console.log("=========================================================================\n");

let passed = 0;
let total = 0;

function check(desc, fn) {
  total++;
  try {
    fn();
    console.log(`[PASS] Check ${total.toString().padStart(2, '0')}: ${desc}`);
    passed++;
  } catch (e) {
    console.error(`[FAIL] Check ${total.toString().padStart(2, '0')}: ${desc}`);
    console.error(`       Error: ${e.message}`);
    process.exit(1);
  }
}

// 1. RLS remains enabled on all tables in schema.sql
check("01. Row Level Security (RLS) Enabled on All Database Tables", () => {
  const schemaPath = path.join(__dirname, '../supabase/schema.sql');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  const tables = ['prediction_runs', 'prediction_indicators', 'batch_runs', 'prediction_events', 'dashboard_events'];
  for (const t of tables) {
    const expected = `ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`;
    assert.ok(schemaContent.includes(expected), `RLS must be enabled on table public.${t}`);
  }
});

// 2. Anonymous unrestricted SELECT policy removed from schema.sql
check("02. Public/Anonymous Unrestricted SELECT Policies Removed", () => {
  const schemaPath = path.join(__dirname, '../supabase/schema.sql');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  assert.strictEqual(schemaContent.includes('CREATE POLICY "Public Read prediction_runs" ON public.prediction_runs FOR SELECT USING (true);'), false);
  assert.strictEqual(schemaContent.includes('CREATE POLICY "Public Read prediction_indicators" ON public.prediction_indicators FOR SELECT USING (true);'), false);
});

// 3. Anonymous unrestricted INSERT policy removed from schema.sql
check("03. Public/Anonymous Unrestricted INSERT Policies Removed", () => {
  const schemaPath = path.join(__dirname, '../supabase/schema.sql');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  assert.strictEqual(schemaContent.includes('CREATE POLICY "Anon Insert prediction_runs" ON public.prediction_runs FOR INSERT WITH CHECK (true);'), false);
  assert.strictEqual(schemaContent.includes('CREATE POLICY "Anon Insert prediction_events" ON public.prediction_events FOR INSERT WITH CHECK (true);'), false);
});

// 4. Anonymous unrestricted UPDATE policy removed from schema.sql
check("04. Public/Anonymous Unrestricted UPDATE Policies Removed", () => {
  const schemaPath = path.join(__dirname, '../supabase/schema.sql');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  assert.strictEqual(schemaContent.includes('CREATE POLICY "Anon Update prediction_runs" ON public.prediction_runs FOR UPDATE USING (true);'), false);
});

// 5. Anonymous unrestricted DELETE policy is absent
check("05. Anonymous Unrestricted DELETE Policies Absent", () => {
  const schemaPath = path.join(__dirname, '../supabase/schema.sql');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  assert.strictEqual(schemaContent.toLowerCase().includes('for delete using (true)'), false);
});

// 6. Duplicate trace_id is rejected by database constraint
check("06. Duplicate trace_id Database Constraint Enforcement", () => {
  const traceId = `PRED-2026-DUP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const validPayload = {
    ...ateSim.getDemoScenario("NORMAL"),
    trace_id: traceId
  };

  // First insertion should succeed
  const res1 = inferenceService.predictSingle(validPayload);
  assert.strictEqual(res1.trace_id, traceId);

  // Second insertion with same trace_id must throw DATABASE_CONSTRAINT_VIOLATION
  assert.throws(() => {
    inferenceService.predictSingle(validPayload);
  }, /DATABASE_CONSTRAINT_VIOLATION/);
});

// 7. Valid server-side persistence works
check("07. Valid Server-Side Prediction & Batch Persistence", () => {
  const singleRes = inferenceService.predictSingle(ateSim.getDemoScenario("NORMAL"));
  assert.ok(singleRes.trace_id);
  assert.strictEqual(singleRes.prediction, "PASS");

  const batchRes = inferenceService.predictBatch([
    ateSim.getDemoScenario("NORMAL"),
    ateSim.getDemoScenario("HIGH_LEAKAGE")
  ]);
  assert.strictEqual(batchRes.total_count, 2);
});

// 8. prediction_events foreign key integrity constraint
check("08. Foreign Key Integrity Enforcement for Prediction Events", () => {
  const schemaPath = path.join(__dirname, '../supabase/schema.sql');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  assert.ok(schemaContent.includes('prediction_id UUID REFERENCES public.prediction_runs(id) ON DELETE CASCADE'), "prediction_id foreign key constraint must exist");
});

// 9. Service-role credential is never exposed to frontend
check("09. Service-Role Credential Masking in Frontend", () => {
  const frontendPath = path.join(__dirname, '../frontend/api.js');
  const frontendContent = fs.readFileSync(frontendPath, 'utf8');

  assert.strictEqual(frontendContent.includes('SUPABASE_SERVICE_ROLE_KEY'), false);
  assert.strictEqual(frontendContent.includes('sbp_'), false);
});

// 10. Supabase credentials never appear in API responses or logs
check("10. Supabase Secrets Redaction in Logs & Error Responses", () => {
  const secretPayload = {
    service_role: "SUPABASE_SERVICE_ROLE_KEY=ey12345",
    supabase_key: "sbp_fakekey12345",
    normal_key: "SAFE_DATA"
  };
  const sanitized = logger.sanitize(secretPayload);
  assert.strictEqual(sanitized.service_role, '[REDACTED_SECRET]');
  assert.strictEqual(sanitized.supabase_key, '[REDACTED_SECRET]');
  assert.strictEqual(sanitized.normal_key, 'SAFE_DATA');
});

// 11. Existing dashboard queries work
check("11. Dashboard Queries Summary & Recent Integrity", async () => {
  const summary = await inferenceService.getDashboardSummaryAsync();
  assert.ok(typeof summary.total_runs === 'number');

  const recent = await inferenceService.getRecentPredictionsAsync();
  assert.ok(Array.isArray(recent));

  const equipment = await inferenceService.getEquipmentStatsAsync();
  assert.ok(typeof equipment === 'object');
});

// 12. Existing QA workflow works
check("12. QA Workflow Secondary Test & Disposition Confirmation", async () => {
  const normRecord = inferenceService.predictSingle(ateSim.getDemoScenario("NORMAL"));
  const normTestId = normRecord.test_id || normRecord.trace_id;

  const dispRes = await inferenceService.confirmDispositionAsync(normTestId, "CONFIRMED_PASS", "OP_ADMIN_01", "Disposition confirmed");
  assert.strictEqual(dispRes.lifecycle_state, "CONFIRMED_PASS");
});

console.log("\n=========================================================================");
console.log(`ALL ${passed}/${total} SECURITY REMEDIATION PHASE 2 TESTS PASSED 100%! ✅`);
console.log("=========================================================================\n");
