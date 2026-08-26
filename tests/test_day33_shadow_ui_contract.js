/**
 * Predicta Day 33 — Shadow Model UI Contract Test Suite
 * File: tests/test_day33_shadow_ui_contract.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 33 — SHADOW MODEL UI CONTRACT TEST SUITE");
console.log("=========================================================================\n");

const payload = {
  test_id: "DAY33-SHADOW-001", equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 100.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.42, frequency: 2500.0,
  propagation_delay: 11.0, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 24.0, dynamic_power: 56.0, total_power: 65.0, test_duration: 12.0
};

const res = inf.predictSingle(payload);

assert.ok(res.shadow_model, "[1] shadow_model field present");
assert.strictEqual(res.shadow_model.model_version, "v2.0_research", "[2] shadow model version must be v2.0_research");
assert.strictEqual(res.shadow_model.disclaimer, "RESEARCH SHADOW — NOT USED FOR DECISION", "[3] shadow disclaimer must be explicit");

console.log("✔ Test 01 Passed: Shadow model response schema contract verified for UI presentation");

console.log("\n=========================================================================");
console.log("ALL DAY 33 SHADOW UI CONTRACT TESTS PASSED! ✅");
console.log("=========================================================================\n");
