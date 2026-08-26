/**
 * Predicta Day 33 — Browser User Journey Test Suite
 * File: tests/test_day33_browser_journey.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');
const ateSim = require('../src/simulation/ate_simulator');

console.log("=========================================================================");
console.log("PREDICTA DAY 33 — BROWSER USER JOURNEY TEST SUITE");
console.log("=========================================================================\n");

const scenarioKeys = ["NORMAL", "HIGH_LEAKAGE", "THERMAL_ANOMALY", "TIMING_FAILURE", "EQUIPMENT_DRIFT", "COMBINED_DEFECT", "REVIEW_CASE"];

scenarioKeys.forEach(key => {
  const scenario = ateSim.getDemoScenario(key);
  assert.ok(scenario, `[1] Scenario ${key} data must exist`);
  const res = inf.predictSingle(scenario);
  assert.ok(res.prediction, `[2] Scenario ${key} prediction must be generated`);
  assert.strictEqual(res.threshold, 0.45, `[3] Scenario ${key} threshold must remain 0.45`);
  assert.ok(res.shadow_model, `[4] Scenario ${key} shadow_model object must be attached`);
});

console.log("✔ Test 01 Passed: Validated all 7 user journey demo scenarios through end-to-end inference engine");

console.log("\n=========================================================================");
console.log("ALL DAY 33 BROWSER JOURNEY TESTS PASSED! ✅");
console.log("=========================================================================\n");
