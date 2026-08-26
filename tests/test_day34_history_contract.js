/**
 * Predicta Day 34 — History Contract Test Suite
 * File: tests/test_day34_history_contract.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 34 — HISTORY CONTRACT TEST SUITE");
console.log("=========================================================================\n");

const record = {
  test_id: "HIST-001", equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 95.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.42, frequency: 2500.0,
  propagation_delay: 11.0, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 24.0, dynamic_power: 56.0, total_power: 65.0, test_duration: 12.0
};

const res = inf.predictSingle(record);
assert.ok(res.event_history && res.event_history.length > 0, "[1] Initial prediction event logged in history array");

console.log("✔ Test 01 Passed: Event history audit trail contract verified");

console.log("\n=========================================================================");
console.log("ALL DAY 34 HISTORY CONTRACT TESTS PASSED! ✅");
console.log("=========================================================================\n");
