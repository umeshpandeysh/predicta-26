/**
 * Predicta Day 11 Frontend ↔ ML API Integration Test Suite
 * File: tests/test_frontend_integration.js
 */

const assert = require('assert');
const { checkMLAPIHealth, predictMeasurementRecord, predictMeasurementBatch, fallbackLocalPredict } = require('../frontend/api');

const SAMPLE_FAIL_RECORD = {
  test_id: "FE-TEST-001",
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

const SAMPLE_PASS_RECORD = {
  test_id: "FE-TEST-002",
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
  temperature: 26.0,
  dynamic_power: 42.0,
  total_power: 52.0,
  test_duration: 10.0
};

console.log("=========================================================================");
console.log("PREDICTA DAY 11 — FRONTEND ↔ ML API INTEGRATION TEST SUITE");
console.log("=========================================================================\n");

async function runFrontendTests() {
  try {
    // 1. Health indicator test
    const health = await checkMLAPIHealth();
    assert.ok(health.model, "1. Health object missing model property");
    assert.strictEqual(health.threshold, 0.45, "1. Health threshold altered");
    console.log("✔ Test 01 Passed: Frontend API client health check functional");

    // 2. Single prediction FAIL test
    const resFail = await predictMeasurementRecord(SAMPLE_FAIL_RECORD);
    assert.strictEqual(resFail.prediction, "FAIL", "2. Expected FAIL prediction");
    assert.strictEqual(resFail.threshold, 0.45, "2. Expected threshold 0.45");
    assert.ok(resFail.probability >= 0.45, "2. Probability threshold check");
    console.log(`✔ Test 02 Passed: Single FAIL prediction renders correctly (prob=${resFail.probability}, risk=${resFail.risk_level})`);

    // 3. Single prediction PASS test
    const resPass = await predictMeasurementRecord(SAMPLE_PASS_RECORD);
    assert.strictEqual(resPass.prediction, "PASS", "3. Expected PASS prediction");
    assert.ok(resPass.probability < 0.45, "3. Probability threshold check for PASS");
    console.log(`✔ Test 03 Passed: Single PASS prediction renders correctly (prob=${resPass.probability}, risk=${resPass.risk_level})`);

    // 4. Explanation indicators test
    assert.ok(resFail.explanation && Array.isArray(resFail.explanation.key_indicators), "4. Explanation indicators missing");
    assert.ok(resFail.explanation.key_indicators.length > 0, "4. Key indicators list empty");
    console.log("✔ Test 04 Passed: Explanation panel key indicators populated correctly");

    // 5. Batch prediction test
    const batchRes = await predictMeasurementBatch([SAMPLE_FAIL_RECORD, SAMPLE_PASS_RECORD]);
    assert.strictEqual(batchRes.total, 2, "5. Batch total mismatch");
    assert.strictEqual(batchRes.pass_count, 1, "5. Batch PASS count mismatch");
    assert.strictEqual(batchRes.fail_count, 1, "5. Batch FAIL count mismatch");
    console.log("✔ Test 05 Passed: Batch prediction processed 2 dev devices (1 PASS, 1 FAIL)");

    // 6. Offline fallback test
    const fallbackRes = fallbackLocalPredict(SAMPLE_FAIL_RECORD);
    assert.strictEqual(fallbackRes.prediction, "FAIL");
    assert.strictEqual(fallbackRes.threshold, 0.45);
    console.log("✔ Test 06 Passed: Offline client fallback predictor operational");

    // 7. Threshold strictly preserved
    assert.strictEqual(resFail.threshold, 0.45);
    assert.strictEqual(resPass.threshold, 0.45);
    console.log("✔ Test 07 Passed: Operating threshold remains strictly 0.45 across all components");

    console.log("\n=========================================================================");
    console.log("ALL DAY 11 FRONTEND INTEGRATION TESTS PASSED SUCCESSFULLY! ✅");
    console.log("=========================================================================\n");
  } catch (err) {
    console.error("❌ DAY 11 FRONTEND TEST FAILED:", err);
    process.exit(1);
  }
}

runFrontendTests();
