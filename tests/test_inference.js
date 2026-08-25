/**
 * Predicta Day 10 ML Inference API Node.js Test Suite
 * File: tests/test_inference.js
 */

const assert = require('assert');
const inferenceService = require('../src/api/inference');

const SAMPLE_DEV_RECORD = {
  test_id: "DEV-TEST-001",
  wafer_id: "W-DEV-01",
  die_id: "D-DEV-05",
  equipment_id: "EQP-103",
  supply_voltage: 1.20,
  output_voltage: 1.18,
  current: 45.2,
  leakage_current: 195.4,
  resistance: 12.5,
  capacitance: 4.2,
  threshold_voltage: 0.42,
  frequency: 2400.0,
  propagation_delay: 14.5,
  setup_time: 1.2,
  hold_time: 0.8,
  timing_margin: 2.1,
  temperature: 35.0,
  dynamic_power: 65.0,
  total_power: 72.0,
  test_duration: 12.0
};

const SAMPLE_CLEAN_RECORD = {
  test_id: "DEV-TEST-002",
  wafer_id: "W-DEV-01",
  die_id: "D-DEV-06",
  equipment_id: "EQP-101",
  supply_voltage: 1.20,
  output_voltage: 1.19,
  current: 40.0,
  leakage_current: 110.0,
  resistance: 12.0,
  capacitance: 4.0,
  threshold_voltage: 0.45,
  frequency: 2500.0,
  propagation_delay: 12.0,
  setup_time: 1.5,
  hold_time: 1.0,
  timing_margin: 3.0,
  temperature: 27.0,
  dynamic_power: 45.0,
  total_power: 52.0,
  test_duration: 10.0
};

console.log("=========================================================================");
console.log("PREDICTA DAY 10 — ML INFERENCE API TEST SUITE");
console.log("=========================================================================\n");

try {
  // Test 1: Model loads successfully
  assert.strictEqual(inferenceService.isLoaded, true, "1. Model failed to load");
  console.log("✔ Test 01 Passed: Model artifact loaded successfully");

  // Test 2: Health endpoint properties
  assert.strictEqual(inferenceService.operatingThreshold, 0.45, "2. Operating threshold incorrect");
  console.log("✔ Test 02 Passed: Operating threshold verified at 0.45");

  // Test 3: Valid single prediction
  const res1 = inferenceService.predictSingle(SAMPLE_DEV_RECORD);
  assert.strictEqual(res1.prediction, "FAIL", "3. Expected FAIL prediction");
  assert.strictEqual(res1.threshold, 0.45, "3. Expected threshold 0.45");
  assert.strictEqual(res1.test_id, "DEV-TEST-001");
  console.log(`✔ Test 03 Passed: Single prediction returns FAIL (prob=${res1.probability}, risk=${res1.risk_level})`);

  // Test 4: Valid batch prediction
  const batchRes = inferenceService.predictBatch([SAMPLE_DEV_RECORD, SAMPLE_CLEAN_RECORD]);
  assert.strictEqual(batchRes.total, 2, "4. Batch total mismatch");
  assert.strictEqual(batchRes.pass_count, 1, "4. Batch PASS count mismatch");
  assert.strictEqual(batchRes.fail_count, 1, "4. Batch FAIL count mismatch");
  console.log("✔ Test 04 Passed: Batch prediction processed 2 records (1 PASS, 1 FAIL)");

  // Test 5: Missing feature rejection
  const incomplete = { ...SAMPLE_DEV_RECORD };
  delete incomplete.leakage_current;
  assert.throws(() => inferenceService.predictSingle(incomplete), /Missing required numerical feature/, "5. Should reject missing feature");
  console.log("✔ Test 05 Passed: Missing numerical feature correctly rejected with Error");

  // Test 6: Invalid equipment rejection
  const invalidEq = { ...SAMPLE_DEV_RECORD, equipment_id: "EQP-999" };
  assert.throws(() => inferenceService.predictSingle(invalidEq), /Invalid equipment_id/, "6. Should reject unknown equipment_id");
  console.log("✔ Test 06 Passed: Invalid equipment_id rejected with Error");

  // Test 7: Malformed numeric input rejection
  const malformed = { ...SAMPLE_DEV_RECORD, temperature: "INVALID_STR" };
  assert.throws(() => inferenceService.predictSingle(malformed), /must be a valid finite number/, "7. Should reject malformed number");
  console.log("✔ Test 07 Passed: Malformed numeric string rejected with Error");

  // Test 8: Threshold remains 0.45
  assert.strictEqual(inferenceService.operatingThreshold, 0.45, "8. Threshold altered!");
  console.log("✔ Test 08 Passed: Threshold remains strictly 0.45");

  // Test 9: Output schema compliance
  assert.ok(res1.prediction && res1.probability !== undefined && res1.threshold && res1.risk_level && res1.explanation, "9. Output schema incomplete");
  console.log("✔ Test 09 Passed: Output response schema compliant");

  // Test 10: Repeated inference is deterministic
  const res1_repeat = inferenceService.predictSingle(SAMPLE_DEV_RECORD);
  assert.strictEqual(res1.probability, res1_repeat.probability, "10. Non-deterministic probability");
  console.log("✔ Test 10 Passed: Inference output is 100% deterministic");

  console.log("\n=========================================================================");
  console.log("ALL 10 INFERENCE API TESTS PASSED SUCCESSFULLY! ✅");
  console.log("=========================================================================\n");
} catch (err) {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
}
