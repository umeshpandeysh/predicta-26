/**
 * Predicta Day 25 — Full Production Acceptance & Health Audit Test Suite
 * File: tests/test_production_acceptance.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 25 — FULL PRODUCTION ACCEPTANCE TEST SUITE");
console.log("=========================================================================\n");

// 1. Health Endpoint Audit
const status = inf.getSystemStatus();
assert.strictEqual(status.api, "ONLINE", "API status should be ONLINE");
assert.strictEqual(status.ml_engine, "ONLINE", "ML Engine status should be ONLINE");
assert.strictEqual(status.model_version, "2.0_production", "Model version mismatch");
assert.strictEqual(status.threshold, 0.45, "Operating threshold mutated!");
console.log("✔ Test 01 Passed: GET /api/system/status health contract 100% verified (threshold = 0.45)");

// 2. Single Telemetry Prediction Acceptance
const record = {
  test_id: "DAY25-ACC-001",
  equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
  propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0
};
const res = inf.predictSingle(record);
assert.strictEqual(res.test_id, "DAY25-ACC-001");
assert.ok(res.trace_id.startsWith("PRED-2026-"));
assert.strictEqual(res.prediction, "PASS");
assert.strictEqual(res.threshold, 0.45);
assert.strictEqual(res.operational_decision, "PASS");
console.log("✔ Test 02 Passed: POST /api/predict single prediction contract 100% accepted (trace_id: " + res.trace_id + ")");

// 3. Batch Telemetry Prediction Acceptance
const batchRes = inf.predictBatch([record, { ...record, test_id: "DAY25-ACC-002", leakage_current: 210.0 }]);
assert.strictEqual(batchRes.total, 2);
assert.strictEqual(batchRes.pass_count, 1);
assert.strictEqual(batchRes.fail_count, 1);
console.log("✔ Test 03 Passed: POST /api/predict/batch processed batch predictions accurately");

console.log("\n=========================================================================");
console.log("ALL DAY 25 PRODUCTION ACCEPTANCE TESTS PASSED! ✅");
console.log("=========================================================================\n");
