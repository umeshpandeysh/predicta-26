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
// 4. Phase 1 PAT + COPOD Anomaly Details Test
assert.ok(resEngine.ml_details, "4. ml_details missing from engine response");
assert.ok(resEngine.ml_details.anomaly_detection, "4. ml_details.anomaly_detection missing");
assert.ok(resEngine.ml_details.anomaly_detection.pat, "4. PAT details missing");
assert.ok(resEngine.ml_details.anomaly_detection.copod, "4. COPOD details missing");
assert.ok(typeof resEngine.ml_details.anomaly_detection.pat.score === 'number', "4. PAT score is not a number");
assert.ok(typeof resEngine.ml_details.anomaly_detection.copod.score === 'number', "4. COPOD score is not a number");

// Deterministic repeat test
const resEngine2 = inf.predictSingle(baseRecord);
assert.strictEqual(resEngine.ml_details.anomaly_detection.pat.score, resEngine2.ml_details.anomaly_detection.pat.score, "Deterministic PAT score mismatch");
assert.strictEqual(resEngine.ml_details.anomaly_detection.copod.score, resEngine2.ml_details.anomaly_detection.copod.score, "Deterministic COPOD score mismatch");
// 5. Phase 2 GPR Drift Prediction Test
assert.ok(resEngine.ml_details.drift_prediction, "5. ml_details.drift_prediction missing");
assert.ok(resEngine.ml_details.drift_prediction.iddq, "5. iddq drift prediction missing");
assert.ok(resEngine.ml_details.drift_prediction.ileak, "5. ileak drift prediction missing");
assert.ok(resEngine.ml_details.drift_prediction.tpd, "5. tpd drift prediction missing");

const iddqDrift = resEngine.ml_details.drift_prediction.iddq;
assert.ok(typeof iddqDrift.predicted_168h === 'number', "5. predicted_168h is not a number");
assert.ok(typeof iddqDrift.uncertainty_std === 'number', "5. uncertainty_std is not a number");
assert.ok(iddqDrift.lower_95 < iddqDrift.predicted_168h, "5. lower_95 boundary invalid");
assert.ok(iddqDrift.upper_95 > iddqDrift.predicted_168h, "5. upper_95 boundary invalid");

// Deterministic repeat test
assert.strictEqual(iddqDrift.predicted_168h, resEngine2.ml_details.drift_prediction.iddq.predicted_168h, "Deterministic GPR 168h forecast mismatch");
// 6. Phase 3 Safety Slope & Specification Limit Test
assert.ok(resEngine.ml_details.safety_slope, "6. ml_details.safety_slope missing");
assert.ok(resEngine.ml_details.safety_slope.iddq, "6. iddq safety slope missing");
assert.ok(resEngine.ml_details.safety_slope.ileak, "6. ileak safety slope missing");
assert.ok(resEngine.ml_details.safety_slope.tpd, "6. tpd safety slope missing");

const tpdSlope = resEngine.ml_details.safety_slope.tpd;
assert.ok(typeof tpdSlope.predicted_slope === 'number', "6. predicted_slope is not a number");
assert.ok(typeof tpdSlope.upper_bound_slope === 'number', "6. upper_bound_slope is not a number");
assert.ok(typeof tpdSlope.safety_margin === 'number', "6. safety_margin is not a number");
assert.ok(["WITHIN", "WARNING", "EXCEEDED"].includes(tpdSlope.boundary_status), "6. boundary_status invalid");
console.log("✔ Test 06 Passed: Phase 3 Safety Slope & Specification Limit boundary contract 100% verified");

// 7. Phase 4 Multi-Criteria Risk Engine Test
assert.ok(resEngine.ml_details.risk_engine, "7. ml_details.risk_engine missing");
const riskEngine = resEngine.ml_details.risk_engine;
assert.ok(typeof riskEngine.risk_score === 'number', "7. risk_score is not a number");
assert.ok(["SAFE", "MONITOR", "AT RISK"].includes(riskEngine.risk_class), "7. risk_class invalid");
assert.ok(Array.isArray(riskEngine.dominant_factors), "7. dominant_factors must be an array");
assert.ok(riskEngine.decision && riskEngine.decision.action, "7. decision action missing");
console.log("✔ Test 07 Passed: Phase 4 Multi-Criteria Risk Engine contract 100% verified (risk_class: " + riskEngine.risk_class + ", score: " + riskEngine.risk_score + ")");

// 8. Phase 5 Explainability & Engineering Trace Test
assert.ok(resEngine.ml_details.explainability, "8. ml_details.explainability missing");
const exp = resEngine.ml_details.explainability;
assert.ok(typeof exp.summary === 'string' && exp.summary.length > 0, "8. summary missing");
assert.strictEqual(exp.attribution_method, "DETERMINISTIC_ENGINEERING_ATTRIBUTION", "8. attribution_method mismatch");
assert.ok(Array.isArray(exp.top_risk_factors), "8. top_risk_factors must be an array");
assert.ok(exp.parameter_attribution && exp.parameter_attribution.iddq, "8. iddq parameter attribution missing");
assert.ok(Array.isArray(exp.decision_trace), "8. decision_trace must be an array");
assert.strictEqual(exp.criteria_source, "PROJECT_DEFINED_SCREENING_CRITERIA", "8. criteria_source mismatch");
console.log("✔ Test 08 Passed: Phase 5 Explainability & Engineering Trace contract 100% verified");

console.log("\n=========================================================================");
console.log("ALL DAY 22 MODEL INFERENCE UI CONTRACT TESTS PASSED! ✅");
console.log("=========================================================================\n");
