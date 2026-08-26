/**
 * Predicta Day 34 — Error States Test Suite
 * File: tests/test_day34_error_states.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 34 — ERROR STATES TEST SUITE");
console.log("=========================================================================\n");

const malformed = { test_id: "ERR-001", leakage_current: -10.0, temperature: 350.0 };

assert.throws(() => {
  inf.predictSingle(malformed);
}, (err) => {
  return err.message.includes("DATA_QUALITY_REJECTED");
}, "[1] Data Quality Gate rejects invalid inputs prior to ML inference");

console.log("✔ Test 01 Passed: Out-of-bounds telemetry correctly rejected with clean error message");

console.log("\n=========================================================================");
console.log("ALL DAY 34 ERROR STATES TESTS PASSED! ✅");
console.log("=========================================================================\n");
