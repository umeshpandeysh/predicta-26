/**
 * Predicta Day 24 — SIH Demo Mode Test Suite
 * File: tests/test_demo_mode.js
 */

const assert = require('assert');
const ateSim = require('../src/simulation/ate_simulator');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 24 — SIH DEMO MODE TEST SUITE");
console.log("=========================================================================\n");

const scenarios = ["NORMAL", "HIGH_LEAKAGE", "THERMAL_ANOMALY", "TIMING_FAILURE", "EQUIPMENT_DRIFT", "COMBINED_DEFECT", "REVIEW_CASE"];

scenarios.forEach(scKey => {
  const payload = ateSim.getDemoScenario(scKey);
  const res = inf.predictSingle(payload);
  assert.ok(res.prediction, `Missing prediction for scenario ${scKey}`);
  assert.ok(res.probability >= 0.0 && res.probability <= 1.0, `Invalid probability for scenario ${scKey}`);
  assert.ok(res.operational_decision, `Missing operational decision for scenario ${scKey}`);
});

console.log("✔ Test 01 Passed: Validated all 7 SIH Demo Mode scenarios through production XGBoost V1 inference engine");

console.log("\n=========================================================================");
console.log("ALL DAY 24 SIH DEMO MODE TESTS PASSED! ✅");
console.log("=========================================================================\n");
