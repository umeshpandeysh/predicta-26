/**
 * Predicta Day 24 — ATE Failure Injection & Recovery Test Suite
 * File: tests/test_ate_failure_recovery.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 24 — ATE FAILURE RECOVERY TEST SUITE");
console.log("=========================================================================\n");

// 1. Rejected Out-of-Range Telemetry
const badRecord = {
  test_id: "FAIL-REC-001",
  equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: -999.0, // Negative invalid leakage
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
  propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0
};

assert.throws(() => {
  inf.predictSingle(badRecord);
}, /DATA_QUALITY_REJECTED/, "Expected DATA_QUALITY_REJECTED exception for invalid negative leakage current");

console.log("✔ Test 01 Passed: DATA_QUALITY_REJECTED exception thrown for invalid negative leakage current");

console.log("\n=========================================================================");
console.log("ALL DAY 24 ATE FAILURE RECOVERY TESTS PASSED! ✅");
console.log("=========================================================================\n");
