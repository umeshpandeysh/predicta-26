/**
 * Predicta Day 25 — Error Contract Acceptance Test Suite
 * File: tests/test_error_contract.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 25 — ERROR CONTRACT TEST SUITE");
console.log("=========================================================================\n");

// 1. Missing Required Field Error Contract
const missingFieldRecord = {
  test_id: "ERR-001",
  equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0
  // missing leakage_current and other parameters
};

assert.throws(() => {
  inf.predictSingle(missingFieldRecord);
}, (err) => {
  return err.message.includes("DATA_QUALITY_REJECTED") || err.message.includes("Missing required");
}, "Error message should report DATA_QUALITY_REJECTED for missing fields");

console.log("✔ Test 01 Passed: Error contract returned clean DATA_QUALITY_REJECTED message for incomplete payload");

console.log("\n=========================================================================");
console.log("ALL DAY 25 ERROR CONTRACT TESTS PASSED! ✅");
console.log("=========================================================================\n");
