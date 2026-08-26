/**
 * Predicta Day 33 — Request Race & Sequence Protection Test Suite
 * File: tests/test_day33_request_race.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 33 — REQUEST RACE PROTECTION TEST SUITE");
console.log("=========================================================================\n");

const basePayload = {
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.42, frequency: 2500.0,
  propagation_delay: 11.0, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  dynamic_power: 56.0, total_power: 65.0, test_duration: 12.0
};

const payloadA = { ...basePayload, test_id: "RACE-A", equipment_id: "EQP-101", leakage_current: 95.0, temperature: 24.0 };
const payloadB = { ...basePayload, test_id: "RACE-B", equipment_id: "EQP-103", leakage_current: 240.0, temperature: 45.0 };

const resA = inf.predictSingle(payloadA);
const resB = inf.predictSingle(payloadB);

assert.notStrictEqual(resA.trace_id, resB.trace_id, "[1] Each request must generate a distinct trace ID");
assert.strictEqual(resA.prediction, "PASS", "[2] Request A prediction must be PASS");
assert.strictEqual(resB.prediction, "FAIL", "[3] Request B prediction must be FAIL");

console.log("✔ Test 01 Passed: Independent request sequence isolation verified");

console.log("\n=========================================================================");
console.log("ALL DAY 33 REQUEST RACE TESTS PASSED! ✅");
console.log("=========================================================================\n");
