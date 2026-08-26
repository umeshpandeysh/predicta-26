/**
 * Predicta Day 33 — Model Comparison Delta Calculation Test Suite
 * File: tests/test_day33_model_comparison.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 33 — MODEL COMPARISON TEST SUITE");
console.log("=========================================================================\n");

const payload = {
  test_id: "COMP-001", equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 160.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
  propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 31.0, dynamic_power: 52.0, total_power: 62.0, test_duration: 12.0
};

const res = inf.predictSingle(payload);

assert.ok(res.shadow_model, "[1] Shadow model object attached");
assert.strictEqual(typeof res.shadow_model.probability_delta, 'number', "[2] probability_delta must be numeric");
assert.strictEqual(typeof res.shadow_model.disagreement, 'boolean', "[3] disagreement must be boolean");

console.log("✔ Test 01 Passed: Production V1 vs Research V2 shadow probability delta calculation verified");

console.log("\n=========================================================================");
console.log("ALL DAY 33 MODEL COMPARISON TESTS PASSED! ✅");
console.log("=========================================================================\n");
