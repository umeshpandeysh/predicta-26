/**
 * Predicta Day 12.5 Supabase Integration & Dashboard Analytics Test Suite
 * File: tests/test_supabase.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const inferenceService = require('../src/api/inference');

const SAMPLE_DEV_RECORD = {
  test_id: "SUPA-TEST-001",
  equipment_id: "EQP-103",
  supply_voltage: 1.20,
  output_voltage: 1.18,
  current: 45.2,
  leakage_current: 195.4,
  resistance: 12.5,
  capacitance: 4.2,
  threshold_voltage: 0.42,
  frequency: 2400.0,
  propagation_delay: 14.5,
  setup_time: 1.2,
  hold_time: 0.8,
  timing_margin: 2.1,
  temperature: 35.0,
  dynamic_power: 65.0,
  total_power: 72.0,
  test_duration: 12.0
};

console.log("=========================================================================");
console.log("PREDICTA DAY 12.5 — SUPABASE & DEPLOYMENT INTEGRATION TEST SUITE");
console.log("=========================================================================\n");

try {
  // 1. Supabase schema file exists
  const schemaPath = path.join(__dirname, '../supabase/schema.sql');
  assert.ok(fs.existsSync(schemaPath), "1. supabase/schema.sql missing");
  console.log("✔ Test 01 Passed: Supabase schema file verified intact (supabase/schema.sql)");

  // 2. .env.example template exists
  const envPath = path.join(__dirname, '../.env.example');
  assert.ok(fs.existsSync(envPath), "2. .env.example missing");
  console.log("✔ Test 02 Passed: Environment configuration template verified (.env.example)");

  // 3. Perform prediction and verify store persistence
  const res = inferenceService.predictSingle(SAMPLE_DEV_RECORD);
  assert.strictEqual(res.prediction, "FAIL");

  const summary = inferenceService.getDashboardSummary();
  assert.ok(summary.total_runs >= 1, "3. Total runs count failed to increment");
  assert.strictEqual(summary.fail_count, 1, "3. Fail count failed to log");
  assert.strictEqual(summary.operating_threshold, 0.45);
  console.log(`✔ Test 03 Passed: Single prediction persisted to dashboard summary (total=${summary.total_runs}, fails=${summary.fail_count})`);

  // 4. Equipment distribution analytics check
  const eqStats = inferenceService.getEquipmentStats();
  assert.ok(eqStats["EQP-103"] && eqStats["EQP-103"].total >= 1, "4. Equipment stats failed to update");
  console.log("✔ Test 04 Passed: Equipment distribution analytics updated correctly");

  // 5. Risk distribution analytics check
  const riskStats = inferenceService.getRiskStats();
  assert.ok(riskStats["CRITICAL"] >= 1, "5. Risk level stats failed to update");
  console.log("✔ Test 05 Passed: Risk level distribution analytics updated correctly");

  // 6. Recent predictions endpoint check
  const recent = inferenceService.getRecentPredictions(5);
  assert.ok(Array.isArray(recent) && recent.length > 0, "6. Recent predictions array empty");
  assert.strictEqual(recent[0].test_id, "SUPA-TEST-001");
  console.log("✔ Test 06 Passed: Recent prediction history endpoint operational");

  // 7. Verifying model unchanged
  assert.strictEqual(inferenceService.operatingThreshold, 0.45, "7. Threshold modified!");
  console.log("✔ Test 07 Passed: Operating threshold remains strictly 0.45");

  console.log("\n=========================================================================");
  console.log("ALL DAY 12.5 SUPABASE & DEPLOYMENT TESTS PASSED SUCCESSFULLY! ✅");
  console.log("=========================================================================\n");
} catch (err) {
  console.error("❌ DAY 12.5 TEST FAILED:", err);
  process.exit(1);
}
