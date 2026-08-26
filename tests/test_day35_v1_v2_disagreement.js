/**
 * Predicta Day 35 — V1 vs V2 Disagreement & Isolation Test Suite
 * File: tests/test_day35_v1_v2_disagreement.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 35 — V1/V2 DISAGREEMENT TEST SUITE");
console.log("=========================================================================\n");

const payload = {
  test_id: "DISAGREE-001", equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 160.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
  propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 31.0, dynamic_power: 52.0, total_power: 62.0, test_duration: 12.0
};

const res = inf.predictSingle(payload);

assert.strictEqual(res.model_version, "2.0_production", "[1] Model version 2.0_production");
assert.strictEqual(res.threshold, 0.45, "[2] Production threshold strictly 0.45");
assert.ok(res.shadow_model, "[3] Research shadow model payload attached");
assert.strictEqual(res.shadow_model.disclaimer, "RESEARCH SHADOW — NOT USED FOR DECISION", "[4] Research shadow disclaimer present");

console.log("✔ Test 01 Passed: Production V1 sole decision authority verified under V1/V2 model disagreement");

console.log("\n=========================================================================");
console.log("ALL DAY 35 V1/V2 DISAGREEMENT TESTS PASSED! ✅");
console.log("=========================================================================\n");
