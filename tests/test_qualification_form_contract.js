/**
 * PREDICTA SIH 2026 — QUALIFICATION FORM CONTRACT & IDDQ ISOLATION REGRESSION TEST
 * File: tests/test_qualification_form_contract.js
 */

const assert = require('assert');
const inferenceService = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA SIH 2026 — QUALIFICATION FORM CONTRACT REGRESSION TEST SUITE");
console.log("=========================================================================\n");

const formPayload = {
  test_id: "FORM-TEST-001",
  equipment_id: "EQP-101",
  iddq_standby: 10.2,
  leakage_current: 110.0,
  propagation_delay: 11.0,
  burn_in_duration: 24.0,
  current: 40.0,
  supply_voltage: 1.20,
  temperature: 24.0,
  frequency: 2500,
  dynamic_power: 56.0,
  total_power: 65.0,
  output_voltage: 1.18,
  resistance: 12.0,
  capacitance: 4.0,
  threshold_voltage: 0.42,
  setup_time: 1.2,
  hold_time: 0.8,
  timing_margin: 2.2,
  test_duration: 12.0
};

// Test 1: Verify getNormalizedParams derives IDDQ from iddq_standby (10.2), NOT current (40.0)
console.log("Running Test 01: Verify IDDQ normalization derives strictly from iddq_standby...");
const normParams = inferenceService.getNormalizedParams(formPayload);
console.log("  Raw inputs: iddq_standby = 10.2 µA, leakage_current = 110.0 µA, propagation_delay = 11.0 ns, current = 40.0 mA");
console.log("  Normalized params:", normParams);

assert(Math.abs(normParams.iddq - 2040.0) < 1e-3, "FAIL: Normalized IDDQ must equal 10.2 * 200 = 2040.0!");
assert(Math.abs(normParams.ileak - 297.0) < 1e-3, "FAIL: Normalized Ileak must equal 110.0 * 2.7 = 297.0!");
assert(Math.abs(normParams.tpd - 192.5) < 1e-3, "FAIL: Normalized Tpd must equal 11.0 * 17.5 = 192.5!");
console.log("✔ Test 01 Passed: IDDQ normalized value is 2040.0 (NOT 40 * 200 = 8000!)\n");

// Test 2: Verify changing current from 40.0 to 500.0 DOES NOT alter IDDQ anomaly calculation
console.log("Running Test 02: Verify changing supply current (mA) does NOT alter IDDQ anomaly calculation...");
const payloadWithHighCurrent = { ...formPayload, current: 500.0 };

const resDefault = inferenceService.predictSingle(formPayload);
const resHighCurrent = inferenceService.predictSingle(payloadWithHighCurrent);

assert.strictEqual(resDefault.anomaly_status, "NORMAL", "FAIL: Nominal form payload must evaluate to NORMAL anomaly_status!");
assert.strictEqual(resHighCurrent.anomaly_status, "NORMAL", "FAIL: Changing supply current must NOT alter anomaly_status!");
assert.strictEqual(resDefault.ml_details.anomaly_detection.pat.score, resHighCurrent.ml_details.anomaly_detection.pat.score, "FAIL: PAT score altered by supply current!");
assert.strictEqual(resDefault.ml_details.anomaly_detection.copod.score, resHighCurrent.ml_details.anomaly_detection.copod.score, "FAIL: COPOD score altered by supply current!");

console.log("✔ Test 02 Passed: Supply current changes do NOT alter IDDQ anomaly scores or status!\n");

// Test 3: Verify nominal form payload produces PASS qualification decision
console.log("Running Test 03: Verify nominal form payload produces PASS qualification decision...");
assert.strictEqual(resDefault.disposition, "PASS", "FAIL: Nominal form payload evaluated to " + resDefault.disposition + " instead of PASS!");
assert.strictEqual(resDefault.recommended_action, "PROCEED_STANDARD_SCREENING");
assert.strictEqual(resDefault.anomaly_status, "NORMAL");
assert.strictEqual(resDefault.drift_status, "WITHIN");

console.log("✔ Test 03 Passed: Nominal qualification form payload yields PASS with nominal evidence!\n");

// Test 4: Missing canonical parameters raises VALIDATION_ERROR
console.log("Running Test 04: Verify missing canonical parameters raises VALIDATION_ERROR...");
assert.throws(() => {
  inferenceService.getNormalizedParams({ supply_voltage: 1.2, current: 40.0 });
}, /VALIDATION_ERROR/);
console.log("✔ Test 04 Passed: Missing canonical reliability parameters throws VALIDATION_ERROR!\n");

console.log("=========================================================================");
console.log("ALL QUALIFICATION FORM CONTRACT REGRESSION TESTS PASSED SUCCESSFULLY! ✅");
console.log("=========================================================================\n");
