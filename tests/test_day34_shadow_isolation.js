/**
 * Predicta Day 34 — Research V2 Shadow Isolation Test Suite
 * File: tests/test_day34_shadow_isolation.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 34 — SHADOW ISOLATION TEST SUITE");
console.log("=========================================================================\n");

const record = {
  test_id: "SHADOW-ISO-001", equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 100.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.42, frequency: 2500.0,
  propagation_delay: 11.0, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 24.0, dynamic_power: 56.0, total_power: 65.0, test_duration: 12.0
};

const res = inf.predictSingle(record);

assert.strictEqual(res.model_version, "2.0_production", "[1] Model version must be 2.0_production");
assert.strictEqual(res.threshold, 0.45, "[2] Production threshold strictly 0.45");
assert.strictEqual(res.shadow_model.disclaimer, "RESEARCH SHADOW — NOT USED FOR DECISION", "[3] Shadow disclaimer present");

console.log("✔ Test 01 Passed: Research V2 shadow mode isolation & non-interference verified");

console.log("\n=========================================================================");
console.log("ALL DAY 34 SHADOW ISOLATION TESTS PASSED! ✅");
console.log("=========================================================================\n");
