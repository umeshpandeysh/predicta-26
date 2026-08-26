/**
 * Predicta Day 19 — Production Failure Injection & Recovery Test Suite
 * File: tests/test_failure_recovery.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 19 — FAILURE INJECTION & RECOVERY TEST SUITE");
console.log("=========================================================================\n");

const baseRecord = {
  test_id: "FAIL-INJECT-001",
  equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
  propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0
};

// 1. Supabase Offline Graceful Fallback Test
const mockSupabaseOfflineService = new inf.constructor(null);
const resOffline = mockSupabaseOfflineService.predictSingle(baseRecord);
assert.ok(resOffline.prediction, "1. Offline ML inference failed");
assert.strictEqual(resOffline.threshold, 0.45, "1. Threshold mutated in offline mode");
console.log("✔ Test 01 Passed: Supabase database offline state handled gracefully with in-memory fallback store");

// 2. Malformed Telemetry Field Rejection
assert.throws(() => {
  mockSupabaseOfflineService.validateInputRecord({ ...baseRecord, supply_voltage: "INVALID_NUM" });
}, /must be a valid finite number/, "Malformed numeric string failed to reject");
console.log("✔ Test 02 Passed: Malformed numeric telemetry string rejected with clean validation error");

// 3. Duplicate Secondary Test Request Safeguard
const reviewRecord = {
  test_id: "FAIL-DUP-002",
  equipment_id: "EQP-101",
  supply_voltage: 1.18, output_voltage: 1.16, current: 42.5, leakage_current: 125.0,
  resistance: 12.4, capacitance: 4.1, threshold_voltage: 0.44, frequency: 2420.0,
  propagation_delay: 12.0, setup_time: 1.2, hold_time: 0.8, timing_margin: 1.9,
  temperature: 28.0, dynamic_power: 54.0, total_power: 62.0, test_duration: 12.0
};
mockSupabaseOfflineService.predictSingle(reviewRecord);
mockSupabaseOfflineService.requestSecondaryTest("FAIL-DUP-002", "OP_1");

assert.throws(() => {
  mockSupabaseOfflineService.requestSecondaryTest("FAIL-DUP-002", "OP_1");
}, /already requested/, "Duplicate secondary test request failed to reject");
console.log("✔ Test 03 Passed: Duplicate secondary test request rejected safely with safeguard exception");

console.log("\n=========================================================================");
console.log("ALL DAY 19 FAILURE RECOVERY TESTS PASSED SUCCESSFULLY! ✅");
console.log("=========================================================================\n");
