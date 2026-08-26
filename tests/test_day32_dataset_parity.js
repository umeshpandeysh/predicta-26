/**
 * Predicta Day 32 — Dataset-to-Production Payload Parity Test Suite
 * File: tests/test_day32_dataset_parity.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 32 — DATASET PARITY TEST SUITE");
console.log("=========================================================================\n");

const nominalRecord = {
  test_id: "PARITY-NORM-001", equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 105.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.42, frequency: 2500.0,
  propagation_delay: 11.2, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 25.0, dynamic_power: 56.0, total_power: 65.0, test_duration: 12.0
};

const resNominal = inf.predictSingle(nominalRecord);
assert.strictEqual(resNominal.prediction, "PASS", "[1] Nominal telemetry record must predict PASS");

const failRecord = { ...nominalRecord, test_id: "PARITY-FAIL-001", leakage_current: 240.0, temperature: 45.0 };
const resFail = inf.predictSingle(failRecord);
assert.strictEqual(resFail.prediction, "FAIL", "[2] High leakage & high temp record must predict FAIL");

console.log("✔ Test 01 Passed: Nominal telemetry payload parity verified");
console.log("✔ Test 02 Passed: Failure defect telemetry payload parity verified");

console.log("\n=========================================================================");
console.log("ALL DAY 32 DATASET PARITY TESTS PASSED! ✅");
console.log("=========================================================================\n");
