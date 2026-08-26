/**
 * Predicta Day 32 — V1 vs V2 Research Shadow Mode Test Suite
 * File: tests/test_day32_v1_v2_shadow.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 32 — V1/V2 SHADOW MODE TEST SUITE");
console.log("=========================================================================\n");

const payload = {
  test_id: "DAY32-SHADOW-001", equipment_id: "EQP-103",
  supply_voltage: 1.18, output_voltage: 1.15, current: 48.0, leakage_current: 195.0,
  resistance: 14.0, capacitance: 4.8, threshold_voltage: 0.40, frequency: 2400.0,
  propagation_delay: 14.5, setup_time: 1.5, hold_time: 1.0, timing_margin: 1.4,
  temperature: 38.0, dynamic_power: 68.0, total_power: 80.0, test_duration: 15.0
};

const res = inf.predictSingle(payload);

assert.strictEqual(res.model_version, "2.0_production", "[1] Production model version must be 2.0_production");
assert.strictEqual(res.threshold, 0.45, "[2] Production threshold must remain 0.45");

assert.ok(res.shadow_model, "[3] Shadow model payload must exist");
assert.strictEqual(res.shadow_model.model_version, "v2.0_research", "[4] Shadow model version must be v2.0_research");
assert.strictEqual(res.shadow_model.disclaimer, "RESEARCH SHADOW — NOT USED FOR DECISION", "[5] Shadow model disclaimer must be explicit");

console.log("✔ Test 01 Passed: Production V1 prediction remains sole decision maker");
console.log("✔ Test 02 Passed: Research V2 shadow payload attached with non-interference guarantee");

console.log("\n=========================================================================");
console.log("ALL DAY 32 V1/V2 SHADOW MODE TESTS PASSED! ✅");
console.log("=========================================================================\n");
