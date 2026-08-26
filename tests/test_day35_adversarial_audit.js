/**
 * Predicta Day 35 — Adversarial Product Audit Test Suite
 * File: tests/test_day35_adversarial_audit.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');
const ateSim = require('../src/simulation/ate_simulator');

console.log("=========================================================================");
console.log("PREDICTA DAY 35 — ADVERSARIAL PRODUCT AUDIT TEST SUITE");
console.log("=========================================================================\n");

const scenarioKeys = ["NORMAL", "HIGH_LEAKAGE", "THERMAL_ANOMALY", "TIMING_FAILURE", "EQUIPMENT_DRIFT", "COMBINED_DEFECT", "REVIEW_CASE"];

scenarioKeys.forEach(key => {
  const scenario = ateSim.getDemoScenario(key);
  const res = inf.predictSingle(scenario);
  assert.strictEqual(res.threshold, 0.45, `[1] Scenario ${key} threshold strictly 0.45`);
  assert.ok(res.operational_decision, `[2] Scenario ${key} operational decision generated`);
  assert.ok(res.shadow_model, `[3] Scenario ${key} shadow_model object attached`);
});

console.log("✔ Test 01 Passed: Validated all 7 demo scenarios through production inference engine");

console.log("\n=========================================================================");
console.log("ALL DAY 35 ADVERSARIAL AUDIT TESTS PASSED! ✅");
console.log("=========================================================================\n");
