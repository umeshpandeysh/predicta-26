/**
 * Predicta Day 15 — Operational Decision Engine & Human-in-the-Loop Workflow Test Suite
 * File: tests/test_decision_engine.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 15 — OPERATIONAL DECISION ENGINE TEST SUITE");
console.log("=========================================================================\n");

// 1. Test Low Risk Zone (P < 0.35)
const lowRiskDec = inf.makeOperationalDecision(0.25, "EQP-101");
assert.strictEqual(lowRiskDec.operational_decision, "PASS", "1. Low risk decision failed");
assert.strictEqual(lowRiskDec.decision_class, "LOW_RISK", "1. Low risk class failed");
assert.strictEqual(lowRiskDec.requires_secondary_test, false, "1. Low risk secondary test failed");
console.log("✔ Test 01 Passed: Low Risk zone (P=0.25) -> PASS / LOW_RISK");

// 2. Test Review Zone (0.35 <= P < 0.65)
const reviewDec = inf.makeOperationalDecision(0.48, "EQP-103");
assert.strictEqual(reviewDec.operational_decision, "SECONDARY_TEST", "2. Review zone decision failed");
assert.strictEqual(reviewDec.decision_class, "REVIEW", "2. Review zone class failed");
assert.strictEqual(reviewDec.requires_secondary_test, true, "2. Review zone secondary test failed");
console.log("✔ Test 02 Passed: Review Zone (P=0.48) -> SECONDARY_TEST / REVIEW (requires_secondary_test = true)");

// 3. Test Critical Failure Zone (P >= 0.65)
const criticalDec = inf.makeOperationalDecision(0.85, "EQP-104");
assert.strictEqual(criticalDec.operational_decision, "FAIL", "3. Critical failure decision failed");
assert.strictEqual(criticalDec.decision_class, "CRITICAL_FAILURE", "3. Critical failure class failed");
assert.strictEqual(criticalDec.requires_secondary_test, false, "3. Critical failure secondary test failed");
console.log("✔ Test 03 Passed: Critical Failure Zone (P=0.85) -> FAIL / CRITICAL_FAILURE");

// 4. ML Threshold 0.45 Preservation
assert.strictEqual(inf.operatingThreshold, 0.45, "4. ML operating threshold mutated!");
console.log("✔ Test 04 Passed: ML threshold strictly preserved at 0.45");

// 5. Predict Single Output Backward Compatibility
const sampleRecord = {
  test_id: "DAY15-TEST-001",
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
const resSingle = inf.predictSingle(sampleRecord);
assert.strictEqual(resSingle.prediction, "FAIL", "5. prediction field missing/invalid");
assert.strictEqual(resSingle.threshold, 0.45, "5. threshold field missing/invalid");
assert.strictEqual(typeof resSingle.operational_decision, "string", "5. operational_decision field missing");
assert.strictEqual(typeof resSingle.requires_secondary_test, "boolean", "5. requires_secondary_test field missing");
console.log("✔ Test 05 Passed: predictSingle output contains operational decision metadata while maintaining backward compatibility");

// 6. Predict Batch Output Support
const resBatch = inf.predictBatch([sampleRecord]);
assert.strictEqual(typeof resBatch.review_count, "number", "6. review_count missing");
assert.strictEqual(typeof resBatch.decision_distribution, "object", "6. decision_distribution missing");
console.log("✔ Test 06 Passed: predictBatch output contains decision distribution and secondary test counts");

console.log("\n=========================================================================");
console.log("ALL DAY 15 DECISION ENGINE TESTS PASSED SUCCESSFULLY! ✅");
console.log("=========================================================================\n");
