/**
 * Predicta Day 35 — Threshold Boundary & Risk Zone Test Suite
 * File: tests/test_day35_boundary_risk_zones.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');
const ateSim = require('../src/simulation/ate_simulator');

console.log("=========================================================================");
console.log("PREDICTA DAY 35 — BOUNDARY RISK ZONES TEST SUITE");
console.log("=========================================================================\n");

// Nominal PASS (P < 0.35)
const passRecord = ateSim.getDemoScenario("NORMAL");
const resPass = inf.predictSingle(passRecord);
assert.strictEqual(resPass.operational_decision, "PASS", "[1] Nominal telemetry routes to PASS");

// SECONDARY_TEST (0.35 <= P < 0.65)
const reviewRecord = {
  test_id: "ZONE-REV", equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.42, frequency: 2500.0,
  propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 26.0, dynamic_power: 56.0, total_power: 65.0, test_duration: 12.0
};
const resReview = inf.predictSingle(reviewRecord);
assert.strictEqual(resReview.operational_decision, "SECONDARY_TEST", "[2] Borderline telemetry routes to SECONDARY_TEST");

// CRITICAL_FAIL (P >= 0.65)
const failRecord = ateSim.getDemoScenario("HIGH_LEAKAGE");
const resFail = inf.predictSingle(failRecord);
assert.strictEqual(resFail.operational_decision, "FAIL", "[3] High defect telemetry routes to FAIL");

console.log("✔ Test 01 Passed: 3-zone operational decision boundaries (PASS, SECONDARY_TEST, FAIL) verified");

console.log("\n=========================================================================");
console.log("ALL DAY 35 BOUNDARY RISK ZONES TESTS PASSED! ✅");
console.log("=========================================================================\n");
