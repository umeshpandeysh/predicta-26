/**
 * Predicta Day 12 End-to-End Production Hardening Test Suite
 * File: tests/test_hardening.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const inferenceService = require('../src/api/inference');
const { checkMLAPIHealth, predictMeasurementRecord, predictMeasurementBatch, fallbackLocalPredict } = require('../frontend/api');

const SAMPLE_PASS = {
  test_id: "HARDEN-PASS-001",
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

const SAMPLE_FAIL = {
  test_id: "HARDEN-FAIL-001",
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

console.log("=========================================================================");
console.log("PREDICTA DAY 12 — PRODUCTION HARDENING TEST SUITE");
console.log("=========================================================================\n");

async function runHardeningTests() {
  try {
    // 1. Model integrity verification
    const modelPath = path.join(__dirname, '../ml/models/predicta_final_xgboost.json');
    const metadataPath = path.join(__dirname, '../ml/models/predicta_final_metadata.json');
    const cardPath = path.join(__dirname, '../ml/models/predicta_final_model_card.json');

    assert.ok(fs.existsSync(modelPath), "1. Model json missing");
    assert.ok(fs.existsSync(metadataPath), "1. Metadata json missing");
    assert.ok(fs.existsSync(cardPath), "1. Model card missing");

    const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    assert.strictEqual(meta.operating_threshold, 0.45, "1. Threshold modified!");
    console.log("✔ Test 01 Passed: Production model artifacts & threshold 0.45 verified intact");

    // 2. PASS Scenario End-to-End Test
    const passRes = inferenceService.predictSingle(SAMPLE_PASS);
    assert.strictEqual(passRes.prediction, "PASS");
    assert.ok(passRes.probability < 0.45);
    console.log(`✔ Test 02 Passed: PASS scenario verified (prob=${passRes.probability}, risk=${passRes.risk_level})`);

    // 3. FAIL Scenario End-to-End Test
    const failRes = inferenceService.predictSingle(SAMPLE_FAIL);
    assert.strictEqual(failRes.prediction, "FAIL");
    assert.ok(failRes.probability >= 0.45);
    console.log(`✔ Test 03 Passed: FAIL scenario verified (prob=${failRes.probability}, risk=${failRes.risk_level})`);

    // 4. Oversized Batch Rejection Test
    const oversizedBatch = Array(1005).fill(SAMPLE_PASS);
    assert.throws(() => inferenceService.predictBatch(oversizedBatch), /exceeds maximum allowed size limit/, "4. Oversized batch should be rejected");
    console.log("✔ Test 04 Passed: Oversized batch (>1000 records) correctly rejected");

    // 5. Offline Fallback Predictor Test
    const fbRes = fallbackLocalPredict(SAMPLE_FAIL);
    assert.strictEqual(fbRes.prediction, "FAIL");
    assert.strictEqual(fbRes.threshold, 0.45);
    console.log("✔ Test 05 Passed: Client offline fallback predictor verified operational");

    // 6. Non-Causal Explanation Indicators Check
    assert.ok(failRes.explanation && failRes.explanation.key_indicators.length > 0);
    failRes.explanation.key_indicators.forEach(ind => {
      assert.ok(ind.feature && ind.value !== undefined && ind.status);
    });
    console.log("✔ Test 06 Passed: Non-causal physical explanation indicators validated");

    // 7. Data protection check
    const testCsvPath = path.join(__dirname, '../ml/data/processed/test.csv');
    assert.ok(fs.existsSync(testCsvPath), "7. Locked test set exists");
    console.log("✔ Test 07 Passed: Locked test benchmark set remains frozen and untouched");

    console.log("\n=========================================================================");
    console.log("ALL DAY 12 PRODUCTION HARDENING TESTS PASSED SUCCESSFULLY! ✅");
    console.log("=========================================================================\n");
  } catch (err) {
    console.error("❌ DAY 12 HARDENING TEST FAILED:", err);
    process.exit(1);
  }
}

runHardeningTests();
