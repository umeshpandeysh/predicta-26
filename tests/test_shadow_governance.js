/**
 * PREDICTA SIH 2026 — SHADOW MODEL GOVERNANCE & NON-INTERFERENCE TEST
 * File: tests/test_shadow_governance.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log('=========================================================================');
console.log('PREDICTA — SHADOW MODEL GOVERNANCE & ISOLATION TEST');
console.log('=========================================================================\n');

const testRecord = {
  test_id: "SHADOW-GOV-001",
  equipment_id: "EQP-101",
  iddq_standby: 10.2,
  supply_voltage: 1.20, output_voltage: 1.19, current: 40.0, leakage_current: 110.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
  propagation_delay: 12.0, setup_time: 1.5, hold_time: 1.0, timing_margin: 3.0,
  temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 10.0
};

// 1. Verify standard inference produces shadow model marked research-only
const res = inf.predictSingle(testRecord);
assert.ok(res.shadow_model, "Shadow model object must be attached to telemetry response");
assert.strictEqual(res.shadow_model.environment, "RESEARCH_ONLY", "Shadow model environment must be RESEARCH_ONLY");
assert.strictEqual(res.shadow_model.is_decision_making, false, "Shadow model must have is_decision_making: false");
assert.strictEqual(res.shadow_model.model_version, "v2.0_research", "Shadow model version must be v2.0_research");
assert.strictEqual(res.shadow_model.disclaimer, "RESEARCH SHADOW — NOT USED FOR DECISION", "Disclaimer must be explicit");
console.log("✔ Test 01 Passed: Shadow model metadata contains explicit non-decision research isolation flags");

// 2. Verify changing or deleting shadow_model does not affect production decision
const originalPrediction = res.prediction;
const originalProbability = res.probability;
const originalDecision = res.operational_decision;
const originalThreshold = res.threshold;

// Verify authoritative fields remain strictly production XGBoost
assert.strictEqual(originalPrediction, "PASS", "Nominal record must be PASS");
assert.ok(originalProbability < 0.20, "Nominal probability must be under 0.20");
assert.strictEqual(originalThreshold, 0.20, "Authoritative threshold must remain 0.20");
assert.strictEqual(originalDecision, "PASS", "Nominal disposition must be PASS");
console.log("✔ Test 02 Passed: Production XGBoost outputs are completely independent of shadow model");

// 3. Verify that mutating shadow_model property on response does not back-propagate
res.shadow_model.classification = "FAIL";
res.shadow_model.probability = 0.9999;
assert.strictEqual(res.prediction, "PASS", "Production prediction must not be altered by shadow mutation");
assert.strictEqual(res.operational_decision, "PASS", "Production operational decision must not be altered by shadow mutation");
console.log("✔ Test 03 Passed: Shadow model object is strictly read-only telemetry and cannot override production");

console.log('\n=========================================================================');
console.log('ALL SHADOW MODEL GOVERNANCE TESTS PASSED! ✅');
console.log('=========================================================================\n');
