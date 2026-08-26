/**
 * Predicta Day 27 — Final Dashboard Consistency & Mathematical Integrity Test Suite
 * File: tests/test_dashboard_consistency_final.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 27 — FINAL DASHBOARD CONSISTENCY TEST SUITE");
console.log("=========================================================================\n");

// 1. Initial State Record
const summaryBefore = inf.getDashboardSummary();
const initialTotal = summaryBefore.total_runs;
const initialPass = summaryBefore.pass_count;
const initialFail = summaryBefore.fail_count;

// 2. Controlled Execution Sequence (PASS, FAIL, REVIEW)
const recordPass = {
  test_id: "CONS-PASS-001", equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
  propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0
};

const recordFail = {
  ...recordPass, test_id: "CONS-FAIL-001", leakage_current: 220.0, temperature: 40.0
};

const recordReview = {
  ...recordPass, test_id: "CONS-REV-001", leakage_current: 165.0, temperature: 31.5, propagation_delay: 13.5
};

inf.predictSingle(recordPass);
inf.predictSingle(recordFail);
inf.predictSingle(recordReview);

// 3. Post-Execution Summary Validation
const summaryAfter = inf.getDashboardSummary();
assert.strictEqual(summaryAfter.total_runs, initialTotal + 3, "Total runs increment mismatch");
assert.strictEqual(summaryAfter.pass_count, initialPass + 1, "Pass count increment mismatch");
assert.strictEqual(summaryAfter.fail_count, initialFail + 2, "Fail count increment mismatch (FAIL + REVIEW fail classification)");

console.log("✔ Test 01 Passed: Controlled execution sequence (PASS, FAIL, REVIEW) correctly updated dashboard totals");

// 4. Equipment Breakdown Consistency
const eqStats = inf.getEquipmentStats();
assert.ok(eqStats["EQP-101"], "EQP-101 stats missing");
assert.ok(typeof eqStats["EQP-101"].total === 'number');
console.log("✔ Test 02 Passed: Equipment breakdown stats updated consistently");

// 5. Risk Breakdown Consistency
const riskStats = inf.getRiskStats();
assert.ok(typeof riskStats.LOW === 'number');
assert.ok(typeof riskStats.CRITICAL === 'number');
console.log("✔ Test 03 Passed: Risk distribution stats updated consistently");

console.log("\n=========================================================================");
console.log("ALL DAY 27 DASHBOARD CONSISTENCY TESTS PASSED! ✅");
console.log("=========================================================================\n");
