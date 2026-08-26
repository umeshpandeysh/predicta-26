/**
 * Predicta Day 33 — Result Integrity & Probability Rendering Test Suite
 * File: tests/test_day33_result_integrity.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 33 — RESULT INTEGRITY TEST SUITE");
console.log("=========================================================================\n");

const payload = {
  test_id: "INTEG-001", equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 95.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.42, frequency: 2500.0,
  propagation_delay: 11.0, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 24.0, dynamic_power: 56.0, total_power: 65.0, test_duration: 12.0
};

const res = inf.predictSingle(payload);

assert.ok(res.probability >= 0.0 && res.probability <= 1.0, "[1] Probability must be bounded 0.0 <= P <= 1.0");
assert.strictEqual(res.threshold, 0.45, "[2] Operating threshold strictly 0.45");

console.log("✔ Test 01 Passed: Result probability mathematical integrity verified");

console.log("\n=========================================================================");
console.log("ALL DAY 33 RESULT INTEGRITY TESTS PASSED! ✅");
console.log("=========================================================================\n");
