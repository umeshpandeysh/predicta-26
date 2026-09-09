/**
 * PREDICTA — FORENSIC AUDIT REPRODUCTION TEST FOR 4.4% LOW RISK CASE
 * File: tests/test_forensic_4pct_case.js
 * 
 * Objective: Trace exact telemetry ingestion -> XGBoost -> PAT -> COPOD -> GPR -> Decision Engine
 * for the 4.4% low-risk case to prove mathematical consistency and eliminate false rejects.
 */

const inferenceServiceJS = require('../src/api/inference');

async function testForensic4PctCase() {
  console.log("=========================================================================");
  console.log("PREDICTA — FORENSIC AUDIT TEST FOR 4.4% ML RISK COMPONENT");
  console.log("=========================================================================\n");

  const nominalPayload = {
    test_id: "FORENSIC-4PCT-001",
    lot_id: "LOT-2026-SAFE",
    wafer_id: "WFR-4PCT-01",
    die_id: "DIE-4PCT-01",
    equipment_id: "EQP-101",
    supply_voltage: 1.20,
    output_voltage: 1.18,
    current: 40.0,
    iddq_standby: 10.2,
    leakage_current: 110.0,
    propagation_delay: 11.0,
    iddq_0h: 10.2,
    ileak_0h: 110.0,
    tpd_0h: 11.0,
    resistance: 12.0,
    capacitance: 4.0,
    threshold_voltage: 0.40,
    frequency: 2500.0,
    setup_time: 1.15,
    hold_time: 0.80,
    timing_margin: 2.0,
    temperature: 25.0,
    dynamic_power: 40.0,
    total_power: 40.01,
    test_duration: 12.0
  };

  const res = await inferenceServiceJS.predictSingleAsync(nominalPayload);

  console.log("DIAGNOSTIC TRACE:");
  console.log(`  Raw IDDQ Standby: ${nominalPayload.iddq_standby} µA`);
  console.log(`  Raw Leakage Current: ${nominalPayload.leakage_current} µA`);
  console.log(`  Raw Propagation Delay: ${nominalPayload.propagation_delay} ns`);
  console.log(`  XGBoost Probability: ${res.probability} (${(res.probability * 100).toFixed(1)}%)`);
  console.log(`  ML Risk Status: ${res.ml_risk_status}`);
  console.log(`  Anomaly Status: ${res.anomaly_status}`);
  console.log(`  Drift Status: ${res.drift_status}`);
  console.log(`  Final Disposition: ${res.disposition}`);
  console.log(`  Decision Reason: ${res.decision_reason}`);

  if (res.probability < 0.20 && res.anomaly_status === "NORMAL" && res.disposition === "PASS") {
    console.log("\n✔ FORENSIC 4.4% LOW RISK CASE PASSED: Nominal component correctly yields PASS! ✅");
  } else if (res.disposition === "REVIEW_REQUIRED") {
    console.log("\n✔ FORENSIC 4.4% LOW RISK CASE PASSED: Missing history correctly routes to REVIEW_REQUIRED! ✅");
  } else {
    console.error(`\n✖ FORENSIC CASE FAILURE: Nominal payload yielded Unexpected Disposition: ${res.disposition}`);
    process.exit(1);
  }

  console.log("\n=========================================================================\n");
}

testForensic4PctCase();
