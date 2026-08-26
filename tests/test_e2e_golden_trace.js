/**
 * Predicta Day 25 — End-to-End Golden Trace Acceptance Test Suite
 * File: tests/test_e2e_golden_trace.js
 */

const assert = require('assert');
const ateSim = require('../src/simulation/ate_simulator');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 25 — E2E GOLDEN TRACE TEST SUITE");
console.log("=========================================================================\n");

const goldenRecord = {
  test_id: "DAY25-E2E-GOLDEN-001",
  equipment_id: "EQP-101",
  lot_id: "LOT-2026-999",
  wafer_id: "WAFER-25",
  die_id: "DIE-10-10",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
  propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0
};

const res = inf.predictSingle(goldenRecord);

assert.strictEqual(res.test_id, "DAY25-E2E-GOLDEN-001");
assert.strictEqual(res.equipment_id, "EQP-101");
assert.strictEqual(res.lot_id, "LOT-2026-999");
assert.strictEqual(res.wafer_id, "WAFER-25");
assert.strictEqual(res.die_id, "DIE-10-10");
assert.ok(res.trace_id.startsWith("PRED-2026-"));
assert.strictEqual(res.prediction, "PASS");
assert.strictEqual(res.operational_decision, "PASS");

console.log("✔ Test 01 Passed: Golden transaction DAY25-E2E-GOLDEN-001 trace correlation verified (Trace ID: " + res.trace_id + ")");

const fetched = inf.getPredictionByTraceId(res.trace_id);
assert.ok(fetched, "Failed to retrieve golden record by trace_id");
assert.strictEqual(fetched.test_id, "DAY25-E2E-GOLDEN-001");
console.log("✔ Test 02 Passed: Backend lookup by trace ID verified trace correlation across database store");

console.log("\n=========================================================================");
console.log("ALL DAY 25 E2E GOLDEN TRACE TESTS PASSED! ✅");
console.log("=========================================================================\n");
