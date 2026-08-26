/**
 * Predicta Day 24 — Data Quality Gate Safeguard Test Suite
 * File: tests/test_data_quality_gate.js
 */

const assert = require('assert');
const gate = require('../src/ingestion/data_quality_gate');

console.log("=========================================================================");
console.log("PREDICTA DAY 24 — DATA QUALITY GATE TEST SUITE");
console.log("=========================================================================\n");

// 1. Valid Telemetry
const validPayload = {
  test_id: "GATE-001",
  equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
  propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0
};
const resValid = gate.validateTelemetry(validPayload);
assert.strictEqual(resValid.status, "DATA_QUALITY_ACCEPTED");
assert.strictEqual(resValid.telemetry_quality, "GOOD");
console.log("✔ Test 01 Passed: Data Quality Gate accepted valid physical telemetry payload");

// 2. Missing Required Field
const invalidMissing = { ...validPayload };
delete invalidMissing.leakage_current;
const resMissing = gate.validateTelemetry(invalidMissing);
assert.strictEqual(resMissing.status, "DATA_QUALITY_REJECTED");
assert.strictEqual(resMissing.telemetry_quality, "INVALID");
console.log("✔ Test 02 Passed: Data Quality Gate rejected payload missing required telemetry field 'leakage_current'");

// 3. Out of Bounds Parameter
const invalidBounds = { ...validPayload, temperature: 300.0 }; // > 175°C max
const resBounds = gate.validateTelemetry(invalidBounds);
assert.strictEqual(resBounds.status, "DATA_QUALITY_REJECTED");
console.log("✔ Test 03 Passed: Data Quality Gate rejected physically impossible measurement (temperature=300°C)");

console.log("\n=========================================================================");
console.log("ALL DAY 24 DATA QUALITY GATE TESTS PASSED! ✅");
console.log("=========================================================================\n");
