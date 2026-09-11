/**
 * PREDICTA Phase 17 — Mandatory Four End-to-End Cases Test Suite
 * File: tests/test_four_e2e_cases.js
 */

const assert = require('assert');
const inferenceService = require('../src/api/server').handleApiRequest ? require('../src/api/inference') : null;

console.log("=========================================================================");
console.log("PREDICTA SIH 2026 — MANDATORY FOUR END-TO-END CASES TEST SUITE");
console.log("=========================================================================\n");

async function runFourCasesTest() {
  // CASE 1: SAFE
  const safeRecord = {
    test_id: "TEST-E2E-CASE1-SAFE",
    lot_id: "LOT-2026-SAFE",
    equipment_id: "EQP-101",
    iddq_standby: 10.2,
    leakage_current: 110.0,
    propagation_delay: 11.0,
    iddq_0h: 10.2,
    ileak_0h: 110.0,
    tpd_0h: 11.0,
    temperature: 25.0,
    supply_voltage: 1.20,
    frequency: 2500.0,
    dynamic_power: 54.0,
    threshold_voltage: 0.45,
    output_voltage: 1.18,
    current: 45.2,
    resistance: 12.5,
    capacitance: 4.2,
    setup_time: 0.85,
    hold_time: 0.42,
    timing_margin: 2.6,
    total_power: 54.4,
    test_duration: 150.0
  };

  const res1 = await inferenceService.predictSingleAsync(safeRecord);
  console.log("Case 1 (SAFE) Result:", {
    probability: res1.probability,
    ml_risk_status: res1.ml_risk_status,
    anomaly_status: res1.anomaly_status,
    drift_status: res1.drift_status,
    disposition: res1.disposition,
    action: res1.recommended_action
  });

  assert.strictEqual(res1.ml_risk_status, "LOW", "Case 1 ML risk status must be LOW");
  assert.strictEqual(res1.anomaly_status, "NORMAL", "Case 1 anomaly status must be NORMAL");
  assert.strictEqual(res1.drift_status, "WITHIN", "Case 1 drift status must be WITHIN");
  assert.strictEqual(res1.disposition, "PASS", "Case 1 disposition MUST equal PASS");
  assert.strictEqual(res1.recommended_action, "PROCEED_STANDARD_SCREENING", "Case 1 action must be PROCEED_STANDARD_SCREENING");
  console.log("✔ Case 1 (SAFE) Passed! LOW + NORMAL + WITHIN = PASS ✅\n");

  // CASE 2: REVIEW (ELEVATED ML RISK)
  const reviewRecord = {
    ...safeRecord,
    test_id: "TEST-E2E-CASE2-REVIEW",
    threshold_voltage: 0.486 // Elevated threshold voltage producing XGBoost probability in [0.20, 0.65)
  };

  const res2 = await inferenceService.predictSingleAsync(reviewRecord);
  console.log("Case 2 (REVIEW) Result:", {
    probability: res2.probability,
    ml_risk_status: res2.ml_risk_status,
    anomaly_status: res2.anomaly_status,
    drift_status: res2.drift_status,
    disposition: res2.disposition,
    action: res2.recommended_action
  });

  assert.strictEqual(res2.ml_risk_status, "ELEVATED", "Case 2 ML risk status must be ELEVATED");
  assert.strictEqual(res2.disposition, "MONITOR", "Case 2 disposition must equal MONITOR");
  assert.strictEqual(res2.recommended_action, "RECOMMEND_SECONDARY_QA_REVIEW", "Case 2 action must be RECOMMEND_SECONDARY_QA_REVIEW");
  console.log("✔ Case 2 (REVIEW) Passed! ELEVATED + NORMAL + WITHIN = MONITOR ✅\n");

  // CASE 3: CRITICAL ANOMALY
  const anomalyRecord = {
    ...safeRecord,
    test_id: "TEST-E2E-CASE3-ANOMALY",
    iddq_standby: 15.0, // Physical IDDQ anomaly (Z = 6.09 > 6.0) triggering PAT REJECT
    iddq_0h: 15.0 // Baseline matches 24h so GPR drift is WITHIN while PAT anomaly is REJECT
  };

  const res3 = await inferenceService.predictSingleAsync(anomalyRecord);
  console.log("Case 3 (CRITICAL ANOMALY) Result:", {
    probability: res3.probability,
    ml_risk_status: res3.ml_risk_status,
    anomaly_status: res3.anomaly_status,
    drift_status: res3.drift_status,
    disposition: res3.disposition,
    action: res3.recommended_action
  });

  assert.strictEqual(res3.anomaly_status, "REJECT", "Case 3 anomaly status must be REJECT");
  assert.strictEqual(res3.drift_status, "WITHIN", "Case 3 drift status must be WITHIN");
  assert.strictEqual(res3.disposition, "REJECT", "Case 3 disposition must equal REJECT");
  assert.strictEqual(res3.recommended_action, "QUARANTINE_REJECT_RECOMMENDATION", "Case 3 action must be QUARANTINE_REJECT_RECOMMENDATION");
  console.log("✔ Case 3 (CRITICAL ANOMALY) Passed! LOW + REJECT + WITHIN = REJECT ✅\n");

  // CASE 4: DRIFT FAILURE
  const driftRecord = {
    ...safeRecord,
    test_id: "TEST-E2E-CASE4-DRIFT",
    propagation_delay: 85.0, // Severe Tpd drift forecast exceeding screening limits
    tpd_0h: 11.0
  };

  const res4 = await inferenceService.predictSingleAsync(driftRecord);
  console.log("Case 4 (DRIFT FAILURE) Result:", {
    probability: res4.probability,
    ml_risk_status: res4.ml_risk_status,
    anomaly_status: res4.anomaly_status,
    drift_status: res4.drift_status,
    disposition: res4.disposition,
    action: res4.recommended_action
  });

  assert.strictEqual(res4.drift_status, "EXCEEDED", "Case 4 drift status must be EXCEEDED");
  assert.strictEqual(res4.disposition, "REJECT", "Case 4 disposition must equal REJECT");
  assert.strictEqual(res4.recommended_action, "QUARANTINE_REJECT_RECOMMENDATION", "Case 4 action must be QUARANTINE_REJECT_RECOMMENDATION");
  console.log("✔ Case 4 (DRIFT FAILURE) Passed! LOW + NORMAL + EXCEEDED = REJECT ✅\n");

  console.log("=========================================================================");
  console.log("ALL FOUR MANDATORY END-TO-END TEST CASES PASSED 100% CLEANLY! ✅");
  console.log("=========================================================================");
}

runFourCasesTest().catch(err => {
  console.error("❌ E2E Four Cases Test Failed:", err);
  process.exit(1);
});
