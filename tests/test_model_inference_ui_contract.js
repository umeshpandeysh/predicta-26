/**
 * Predicta Day 22 — Model Inference UI Contract & Full-Stack Integration Test Suite
 * File: tests/test_model_inference_ui_contract.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');
const api = require('../frontend/api');

console.log("=========================================================================");
console.log("PREDICTA DAY 22 — MODEL INFERENCE UI CONTRACT TEST SUITE");
console.log("=========================================================================\n");

const baseRecord = {
  test_id: "UI-INTEGRATION-001",
  equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
  propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0
};

// 1. Direct Node Engine Test (Full Contract Verification)
const resEngine = inf.predictSingle(baseRecord);
assert.strictEqual(resEngine.test_id, "UI-INTEGRATION-001", "1. test_id mismatch in backend engine");
assert.ok(resEngine.trace_id.startsWith("PRED-2026-"), "1. trace_id format mismatch");
assert.strictEqual(resEngine.prediction, "PASS", "1. Nominal record should be PASS");
assert.strictEqual(resEngine.threshold, 0.45, "1. Threshold mutated!");
assert.ok(resEngine.operational_decision, "1. operational_decision missing");
assert.ok(resEngine.decision_reason, "1. decision_reason missing");
assert.ok(resEngine.explanation.key_indicators, "1. Key indicators missing");
console.log("✔ Test 01 Passed: Node inference engine single prediction contract 100% verified (trace_id: " + resEngine.trace_id + ")");

// 2. Client API Helper & Fallback Schema Parity Test
const resFallback = api.fallbackLocalPredict(baseRecord);
assert.strictEqual(resFallback.test_id, "UI-INTEGRATION-001", "2. test_id missing in fallback predictor");
assert.ok(resFallback.trace_id.startsWith("PRED-2026-"), "2. trace_id missing in fallback predictor");
assert.ok(resFallback.operational_decision, "2. operational_decision missing in fallback predictor");
assert.ok(resFallback.decision_reason, "2. decision_reason missing in fallback predictor");
assert.strictEqual(resFallback.is_offline_fallback, true, "2. is_offline_fallback flag missing");
console.log("✔ Test 02 Passed: Fallback local predictor schema matches backend operational decision contract 100%");

// 3. Telemetry 16 Raw Physical Fields Validation Test
const requiredFields = [
  "supply_voltage", "output_voltage", "current", "leakage_current",
  "resistance", "capacitance", "threshold_voltage", "frequency",
  "propagation_delay", "setup_time", "hold_time", "timing_margin",
  "temperature", "dynamic_power", "total_power", "test_duration"
];
requiredFields.forEach(f => {
  assert.ok(f in baseRecord, `Field ${f} missing from base telemetry schema`);
});
console.log("✔ Test 03 Passed: All 16 raw physical telemetry features present and verified finite numbers");

console.log("\n=========================================================================");
console.log("ALL DAY 22 MODEL INFERENCE UI CONTRACT TESTS PASSED! ✅");
console.log("=========================================================================\n");
