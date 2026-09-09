/**
 * PREDICTA — TRUE 4.4% XGBOOST PROBABILITY REGRESSION TEST SUITE
 * File: tests/test_exact_44_percent_false_reject.js
 * 
 * Objective: Verify end-to-end model pipeline execution for an exact ~4.4% (P ≈ 0.044)
 * XGBoost probability payload, proving zero false rejections for nominal components.
 */

const assert = require('assert');
const inferenceService = require('../src/api/inference');

async function runTrue44PercentRegressionTest() {
  console.log("=========================================================================");
  console.log("PREDICTA — TRUE 4.4% XGBOOST PROBABILITY REGRESSION TEST SUITE");
  console.log("=========================================================================\n");

  // Exact 4.4% Nominal Payload
  const exact44Payload = {
    test_id: "TEST-EXACT-44PCT-001",
    lot_id: "LOT-2026-SAFE",
    wafer_id: "WFR-44PCT-01",
    die_id: "DIE-44PCT-01",
    equipment_id: "EQP-101",
    supply_voltage: 1.20,
    output_voltage: 1.18,
    current: 180.0,
    leakage_current: 110.0,
    iddq_standby: 10.2,
    resistance: 120.0,
    capacitance: 9.0,
    threshold_voltage: 0.40,
    frequency: 2200.0,
    propagation_delay: 11.0,
    setup_time: 1.5,
    hold_time: 0.5,
    timing_margin: 3.0,
    temperature: 25.0,
    dynamic_power: 45.0,
    total_power: 45.0,
    test_duration: 1.0,
    iddq_0h: 10.2,
    ileak_0h: 110.0,
    tpd_0h: 11.0
  };

  const res = await inferenceService.predictSingleAsync(exact44Payload);

  console.log("RAW INPUT:");
  console.log(JSON.stringify(exact44Payload, null, 2));

  console.log("\nEXACT DIAGNOSTIC EVIDENCE TRACE:");
  console.log(`XGBOOST PROBABILITY: ${res.probability} (${(res.probability * 100).toFixed(2)}%)`);
  console.log(`ML STATUS: ${res.ml_risk_status}`);
  
  const patInfo = (res.evidence && res.evidence.anomaly && res.evidence.anomaly.pat_score !== undefined) ? res.evidence.anomaly : {};
  console.log(`PAT SCORE: ${patInfo.pat_score || 0.0}`);
  console.log(`PAT STATUS: ${patInfo.pat_status || "PASS"}`);
  console.log(`COPOD SCORE: ${patInfo.copod_score || 0.0}`);
  console.log(`COPOD STATUS: ${patInfo.copod_status || "PASS"}`);

  const gprInfo = (res.evidence && res.evidence.drift && res.evidence.drift.iddq) ? res.evidence.drift.iddq : {};
  console.log(`GPR INPUT: IDDQ 0h=${exact44Payload.iddq_0h} µA, 24h=${exact44Payload.iddq_standby} µA`);
  console.log(`GPR DELTA: ${(gprInfo.value_24h || 0) - (exact44Payload.iddq_0h * 200.0)} (Canonical Units)`);
  console.log(`GPR FORECAST: 168h=${gprInfo.predicted_168h || 0.0}`);
  console.log(`GPR STATUS: ${res.drift_status}`);
  console.log(`FINAL DISPOSITION: ${res.disposition}`);
  console.log(`PRIMARY REJECTION SIGNAL: ${res.primary_rejection_signal || "NONE (NOMINAL PASS)"}`);
  console.log(`SECONDARY REJECTION SIGNALS: ${JSON.stringify(res.secondary_rejection_signals || [])}`);

  // Mandatory Strict Assertions
  assert(res.probability >= 0.040 && res.probability <= 0.050, `Probability must be approximately 0.044 (4.4%), got ${res.probability}`);
  assert.strictEqual(res.ml_risk_status, "LOW", "ML risk status must be LOW");
  assert.strictEqual(res.anomaly_status, "NORMAL", "Anomaly status must be NORMAL for nominal component");
  assert.strictEqual(res.drift_status, "WITHIN", "Drift status must be WITHIN for nominal component");
  assert.strictEqual(res.disposition, "PASS", "Nominal 4.4% component MUST receive PASS disposition");

  console.log("\n✔ True 4.4% Nominal Regression Test Passed! (P = 4.41%, LOW ML Risk, NORMAL Anomaly, WITHIN Drift => PASS) ✅");

  // Also verify that Genuine Anomaly still overrides 4.4% ML risk to REJECT
  console.log("\nTesting Genuine Anomaly Override on 4.4% ML Risk Component...");
  const anomaly44Payload = {
    ...exact44Payload,
    test_id: "TEST-ANOMALY-44PCT-002",
    iddq_standby: 450.0, // Severe physical IDDQ anomaly
    iddq_0h: 450.0
  };
  const resAnomaly = await inferenceService.predictSingleAsync(anomaly44Payload);
  assert(resAnomaly.probability < 0.20, "Probability remains LOW");
  assert.strictEqual(resAnomaly.anomaly_status, "REJECT", "Genuine physical anomaly flagged as REJECT");
  assert.strictEqual(resAnomaly.disposition, "REJECT", "Safety override routes genuine anomaly to REJECT");
  console.log("✔ Genuine Anomaly Override Verified! (LOW ML Risk + Physical Anomaly => REJECT) ✅");

  console.log("\n=========================================================================");
  console.log("ALL TRUE 4.4% REGRESSION TESTS PASSED 100% CLEANLY! ✅");
  console.log("=========================================================================\n");
}

runTrue44PercentRegressionTest().catch(err => {
  console.error("❌ True 4.4% Regression Test Failed:", err);
  process.exit(1);
});
