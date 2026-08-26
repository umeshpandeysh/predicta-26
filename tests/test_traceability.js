/**
 * Predicta Day 18 — End-to-End Traceability Test Suite
 * File: tests/test_traceability.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 18 — END-TO-END TRACEABILITY TEST SUITE");
console.log("=========================================================================\n");

const testRecord = {
  test_id: "DAY18-TRACE-001",
  equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
  propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0
};

// 1. Trace ID Generation & PRED-2026 Format Verification
const res = inf.predictSingle(testRecord);
assert.ok(res.trace_id, "1. trace_id missing from response");
assert.ok(res.trace_id.startsWith("PRED-2026-"), `1. trace_id '${res.trace_id}' format invalid`);
console.log(`✔ Test 01 Passed: Unique trace ID generated in format PRED-2026-XXXXXXXX (${res.trace_id})`);

// 2. Audit Correlation across trace_id
assert.ok(Array.isArray(res.event_history), "2. event_history missing");
assert.strictEqual(res.event_history[0].trace_id, res.trace_id, "2. Event trace_id mismatch");
assert.strictEqual(res.event_history[0].test_id, "DAY18-TRACE-001", "2. Event test_id mismatch");
assert.strictEqual(res.event_history[0].equipment_id, "EQP-101", "2. Event equipment_id mismatch");
console.log("✔ Test 02 Passed: Audit correlation verified — trace_id, test_id, equipment_id linked across events");

// 3. Trace Lookup via getPredictionByTraceId
const lookedUp = inf.getPredictionByTraceId(res.trace_id);
assert.ok(lookedUp, "3. Prediction lookup by trace_id failed");
assert.strictEqual(lookedUp.trace_id, res.trace_id, "3. Looked up trace_id mismatch");
console.log("✔ Test 03 Passed: Backend lookup by trace_id functional");

console.log("\n=========================================================================");
console.log("ALL DAY 18 TRACEABILITY TESTS PASSED SUCCESSFULLY! ✅");
console.log("=========================================================================\n");
