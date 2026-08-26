/**
 * Predicta Day 32 — End-to-End Inference & Decision Engine Contract Test
 * File: tests/test_day32_e2e_contract.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 32 — E2E INFERENCE CONTRACT TEST SUITE");
console.log("=========================================================================\n");

const payload = {
  test_id: "DAY32-CONTRACT-001", equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 42.0, leakage_current: 110.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.42, frequency: 2500.0,
  propagation_delay: 11.2, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 25.0, dynamic_power: 58.0, total_power: 68.0, test_duration: 12.0
};

const res = inf.predictSingle(payload);

assert.ok(res.trace_id.startsWith("PRED-2026-"), "[1] Trace ID format must be PRED-2026-XXXXXXXX");
assert.strictEqual(res.threshold, 0.45, "[2] Threshold must strictly remain 0.45");
assert.ok(res.operational_decision, "[3] Operational decision must be returned");
assert.ok(res.shadow_model, "[4] Shadow model object must be attached");

console.log("✔ Test 01 Passed: Single inference E2E response contract verified");
console.log("✔ Test 02 Passed: Threshold strictly 0.45 & Operational decision verified");

console.log("\n=========================================================================");
console.log("ALL DAY 32 E2E CONTRACT TESTS PASSED! ✅");
console.log("=========================================================================\n");
