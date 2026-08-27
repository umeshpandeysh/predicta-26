/**
 * Phase 4 Risk Engine Scenario Verification Test Suite
 * File: scratch/verify_phase4_scenarios.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PHASE 4 — MULTI-CRITERIA RISK ENGINE SCENARIO TEST SUITE");
console.log("=========================================================================\n");

const baseRecord = {
  test_id: "S-001",
  equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
  propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0,
  iddq: 2100.0, ileak: 290.0, tpd: 190.0,
  iddq_0h: 2080.0, ileak_0h: 288.0, tpd_0h: 188.0
};

// Scenario 1: Nominal Healthy Component -> SAFE
const res1 = inf.predictSingle(baseRecord);
console.log("Res1 Anomaly:", JSON.stringify(res1.ml_details.anomaly_detection, null, 2));
console.log("Res1 Drift:", JSON.stringify(res1.ml_details.drift_prediction, null, 2));
console.log("Res1 Safety Slope:", JSON.stringify(res1.ml_details.safety_slope, null, 2));
console.log("Res1 Risk Engine:", JSON.stringify(res1.ml_details.risk_engine, null, 2));
assert.strictEqual(res1.ml_details.risk_engine.risk_class, "SAFE", "S1: Nominal component should be SAFE");
assert.strictEqual(res1.ml_details.risk_engine.decision.action, "PROCEED_STANDARD_SCREENING", "S1: Action mismatch");
console.log("✔ Scenario 1 Passed: Nominal healthy component -> SAFE (Score: " + res1.ml_details.risk_engine.risk_score + ")");

// Scenario 2: Moderate Anomaly -> MONITOR
const modRecord = {
  ...baseRecord,
  iddq: 2350.0, ileak: 325.0, tpd: 202.0
};
const res2 = inf.predictSingle(modRecord);
assert.ok(["MONITOR", "AT RISK"].includes(res2.ml_details.risk_engine.risk_class), "S2: Moderate anomaly should be MONITOR or AT RISK");
console.log("✔ Scenario 2 Passed: Moderate anomaly component -> " + res2.ml_details.risk_engine.risk_class + " (Score: " + res2.ml_details.risk_engine.risk_score + ")");

// Scenario 3: Severe Anomaly -> AT RISK
const sevRecord = {
  ...baseRecord,
  iddq: 4500.0, ileak: 480.0, tpd: 240.0
};
const res3 = inf.predictSingle(sevRecord);
assert.strictEqual(res3.ml_details.risk_engine.risk_class, "AT RISK", "S3: Severe anomaly component should be AT RISK");
assert.strictEqual(res3.ml_details.risk_engine.decision.action, "QUARANTINE_REJECT_RECOMMENDATION", "S3: Action mismatch");
console.log("✔ Scenario 3 Passed: Severe anomaly component -> AT RISK (Score: " + res3.ml_details.risk_engine.risk_score + ")");

// Scenario 4: Safety Criterion EXCEEDED Override Test
const excRecord = {
  ...baseRecord,
  tpd: 255.0, tpd_0h: 180.0
};
const res4 = inf.predictSingle(excRecord);
assert.strictEqual(res4.ml_details.risk_engine.risk_class, "AT RISK", "S4: Exceeded trajectory must override to AT RISK");
console.log("✔ Scenario 4 Passed: Safety criterion EXCEEDED override -> AT RISK (Score: " + res4.ml_details.risk_engine.risk_score + ")");

// Scenario 5: Deterministic Cross-Invocation Parity Test
const res5 = inf.predictSingle(baseRecord);
assert.strictEqual(res1.ml_details.risk_engine.risk_score, res5.ml_details.risk_engine.risk_score, "S5: Deterministic risk score mismatch");
console.log("✔ Scenario 5 Passed: Deterministic cross-invocation risk score parity verified");

console.log("\n=========================================================================");
console.log("ALL PHASE 4 RISK ENGINE SCENARIO TESTS PASSED! ✅");
console.log("=========================================================================\n");
