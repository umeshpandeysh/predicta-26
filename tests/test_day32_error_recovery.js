/**
 * Predicta Day 32 — Error Handling & Recovery Test Suite
 * File: tests/test_day32_error_recovery.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 32 — ERROR RECOVERY TEST SUITE");
console.log("=========================================================================\n");

const malformedPayload = {
  test_id: "ERR-001", equipment_id: "EQP-101",
  leakage_current: -50.0, temperature: 300.0 // Physically impossible input
};

assert.throws(() => {
  inf.predictSingle(malformedPayload);
}, (err) => {
  return err.message.includes("DATA_QUALITY_REJECTED");
}, "[1] Data Quality Gate must reject physically impossible telemetry");

console.log("✔ Test 01 Passed: Malformed telemetry rejected by Data Quality Gate without generating ML result");

console.log("\n=========================================================================");
console.log("ALL DAY 32 ERROR RECOVERY TESTS PASSED! ✅");
console.log("=========================================================================\n");
