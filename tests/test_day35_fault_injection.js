/**
 * Predicta Day 35 — Fault Injection & Resilience Test Suite
 * File: tests/test_day35_fault_injection.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 35 — FAULT INJECTION TEST SUITE");
console.log("=========================================================================\n");

const malformedRecord = {
  test_id: "FAULT-001", equipment_id: "EQP-101",
  leakage_current: -500.0, temperature: 999.0 // Impossible values
};

assert.throws(() => {
  inf.predictSingle(malformedRecord);
}, (err) => {
  return err.message.includes("DATA_QUALITY_REJECTED");
}, "[1] Data Quality Gate must reject physically impossible inputs");

console.log("✔ Test 01 Passed: Pre-inference Data Quality Gate fault injection recovery verified");

console.log("\n=========================================================================");
console.log("ALL DAY 35 FAULT INJECTION TESTS PASSED! ✅");
console.log("=========================================================================\n");
