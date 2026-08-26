/**
 * Predicta Day 19 — Lifecycle State Machine Integrity & Immutability Test Suite
 * File: tests/test_lifecycle_integrity.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 19 — LIFECYCLE INTEGRITY & IMMUTABILITY TEST SUITE");
console.log("=========================================================================\n");

const reviewRecord = {
  test_id: "INTEG-REV-001",
  equipment_id: "EQP-101",
  supply_voltage: 1.18, output_voltage: 1.16, current: 42.5, leakage_current: 125.0,
  resistance: 12.4, capacitance: 4.1, threshold_voltage: 0.44, frequency: 2420.0,
  propagation_delay: 12.0, setup_time: 1.2, hold_time: 0.8, timing_margin: 1.9,
  temperature: 28.0, dynamic_power: 54.0, total_power: 62.0, test_duration: 12.0
};

const res = inf.predictSingle(reviewRecord);

// 1. Invalid Disposition Safeguard (Confirmation without secondary result)
assert.throws(() => {
  inf.confirmDisposition("INTEG-REV-001", "CONFIRMED_PASS", "OP_TEST");
}, /without completed secondary test result/, "Direct confirmation without secondary result failed to reject");
console.log("✔ Test 01 Passed: Direct disposition confirmation rejected without completed secondary test");

// 2. ML Probability & Prediction Immutability Check
const origProb = res.probability;
const origPred = res.prediction;

inf.requestSecondaryTest("INTEG-REV-001", "OP_TEST");
inf.completeSecondaryTest("INTEG-REV-001", "PASS", "OP_TEST");

const updatedRec = inf.getPredictionByTraceId(res.trace_id);
assert.strictEqual(updatedRec.probability, origProb, "Original ML probability mutated!");
assert.strictEqual(updatedRec.prediction, origPred, "Original ML prediction mutated!");
assert.strictEqual(inf.operatingThreshold, 0.45, "Operating threshold mutated!");
console.log("✔ Test 02 Passed: Original ML prediction & probability strictly immutable across all operator state transitions");

console.log("\n=========================================================================");
console.log("ALL DAY 19 LIFECYCLE INTEGRITY TESTS PASSED SUCCESSFULLY! ✅");
console.log("=========================================================================\n");
