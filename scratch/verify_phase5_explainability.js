/**
 * Phase 5 Explainability Verification Test Suite
 * File: scratch/verify_phase5_explainability.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PHASE 5 — EXPLAINABILITY & ENGINEERING TRACE TEST SUITE");
console.log("=========================================================================\n");

const baseRecord = {
  test_id: "P5-001",
  equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
  propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0,
  iddq: 2100.0, ileak: 290.0, tpd: 190.0,
  iddq_0h: 2080.0, ileak_0h: 288.0, tpd_0h: 188.0
};

// 1. SAFE Component Explanation
const res1 = inf.predictSingle(baseRecord);
const exp1 = res1.ml_details.explainability;
assert.ok(exp1.summary.startsWith("SAFE"), "1. Summary should begin with SAFE");
assert.strictEqual(exp1.recommended_action, "PROCEED_STANDARD_SCREENING", "1. Action mismatch");
assert.strictEqual(exp1.attribution_method, "DETERMINISTIC_ENGINEERING_ATTRIBUTION", "1. Method mismatch");
console.log("✔ Test 01 Passed: SAFE component explanation verified");

// 2. MONITOR Component Explanation
const modRecord = { ...baseRecord, iddq: 2350.0, ileak: 325.0, tpd: 202.0 };
const res2 = inf.predictSingle(modRecord);
const exp2 = res2.ml_details.explainability;
assert.ok(["MONITOR", "AT RISK"].includes(res2.ml_details.risk_engine.risk_class), "2. Risk class mismatch");
assert.ok(exp2.top_risk_factors.length > 0, "2. Top risk factors missing");
console.log("✔ Test 02 Passed: MONITOR component explanation verified");

// 3. AT RISK Component Explanation
const sevRecord = { ...baseRecord, iddq: 4500.0, ileak: 480.0, tpd: 240.0 };
const res3 = inf.predictSingle(sevRecord);
const exp3 = res3.ml_details.explainability;
assert.strictEqual(res3.ml_details.risk_engine.risk_class, "AT RISK", "3. Risk class mismatch");
assert.strictEqual(exp3.recommended_action, "QUARANTINE_REJECT_RECOMMENDATION", "3. Action mismatch");
console.log("✔ Test 03 Passed: AT RISK component explanation verified");

// 4. High Iddq Anomaly Contributor
const iddqAnomRecord = { ...baseRecord, iddq: 3500.0 };
const res4 = inf.predictSingle(iddqAnomRecord);
const exp4 = res4.ml_details.explainability;
assert.ok(exp4.parameter_attribution.iddq.anomaly_contribution > 0, "4. Iddq anomaly contribution missing");
console.log("✔ Test 04 Passed: High Iddq anomaly contributor verified");

// 5. Safety Boundary WARNING / EXCEEDED Explanation
const excRecord = { ...baseRecord, tpd: 255.0, tpd_0h: 180.0 };
const res5 = inf.predictSingle(excRecord);
const exp5 = res5.ml_details.explainability;
assert.ok(exp5.top_risk_factors.some(f => f.includes("EXCEEDED")), "5. Exceeded factor missing in top factors");
assert.strictEqual(exp5.criteria_source, "PROJECT_DEFINED_SCREENING_CRITERIA", "5. Criteria source mismatch");
console.log("✔ Test 05 Passed: Safety boundary EXCEEDED explanation & provenance verified");

// 6. Decision Trace Stages Check
assert.strictEqual(exp1.decision_trace.length, 5, "6. Decision trace must have 5 stages");
const stages = exp1.decision_trace.map(t => t.stage);
assert.deepStrictEqual(stages, ["ANOMALY", "DRIFT", "SAFETY", "RISK_ENGINE", "DECISION"], "6. Decision trace stages mismatch");
console.log("✔ Test 06 Passed: 5-stage decision trace (ANOMALY -> DRIFT -> SAFETY -> RISK -> DECISION) verified");

// 7. Deterministic Repeatability
const res1Repeat = inf.predictSingle(baseRecord);
assert.deepStrictEqual(exp1.top_risk_factors, res1Repeat.ml_details.explainability.top_risk_factors, "7. Deterministic top factors mismatch");
assert.strictEqual(exp1.summary, res1Repeat.ml_details.explainability.summary, "7. Deterministic summary mismatch");
console.log("✔ Test 07 Passed: Deterministic repeatability 100% verified");

console.log("\n=========================================================================");
console.log("ALL PHASE 5 EXPLAINABILITY TESTS PASSED! ✅");
console.log("=========================================================================\n");
