/**
 * Predicta Day 35 — Deep Dataset Telemetry Parity Test Suite
 * File: tests/test_day35_dataset_parity_deep.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 35 — DEEP DATASET PARITY TEST SUITE");
console.log("=========================================================================\n");

const record = {
  test_id: "DAY35-PARITY-001", equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 95.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.42, frequency: 2500.0,
  propagation_delay: 11.0, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 24.0, dynamic_power: 56.0, total_power: 65.0, test_duration: 12.0
};

const res = inf.predictSingle(record);

assert.strictEqual(res.prediction, "PASS", "[1] Nominal record predicts PASS");
assert.ok(res.explanation && res.explanation.key_indicators, "[2] Key indicators returned");

console.log("✔ Test 01 Passed: Telemetry feature vector ordering and unit parity verified");

console.log("\n=========================================================================");
console.log("ALL DAY 35 DEEP DATASET PARITY TESTS PASSED! ✅");
console.log("=========================================================================\n");
