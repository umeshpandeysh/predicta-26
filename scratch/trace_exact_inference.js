/**
 * PREDICTA — Diagnostic Trace Script for Screenshot Component & Nominal Component
 * File: scratch/trace_exact_inference.js
 */

const inf = require('../src/api/inference');

function printDetailedTrace(label, payload) {
  console.log(`\n=========================================================================`);
  console.log(`DIAGNOSTIC TRACE FOR: ${label}`);
  console.log(`=========================================================================\n`);

  try {
    const validated = inf.validateInputRecord(payload);
    const eqId = validated.equipment_id;
    const lotId = validated.lot_id;
    const engineered = inf.engineerFeatures(validated, eqId);
    const prob = inf.calculateProbability(engineered, eqId);

    console.log("--- INPUT RAW VALUES ---");
    console.log(`  iddq_standby:       ${payload.iddq_standby}`);
    console.log(`  leakage_current:    ${payload.leakage_current}`);
    console.log(`  propagation_delay:  ${payload.propagation_delay}`);
    console.log(`  current (supply):   ${payload.current}`);

    const norm = inf.getNormalizedParams(engineered);
    console.log("\n--- NORMALIZED VALUES ---");
    console.log(`  normalized iddq:   ${norm.iddq}`);
    console.log(`  normalized ileak:  ${norm.ileak}`);
    console.log(`  normalized tpd:    ${norm.tpd}`);

    const patRes = inf.evaluatePatMad(engineered, lotId);
    console.log("\n--- PAT ANOMALY DETAILS ---");
    console.log(`  stats source:      ${patRes.stats_source || "GLOBAL"}`);
    if (patRes.parameter_z_scores) {
      Object.keys(patRes.parameter_z_scores).forEach(p => {
        console.log(`  ${p.toUpperCase()} Z-Score: ${patRes.parameter_z_scores[p]}`);
      });
    }
    console.log(`  max Z-Score:       ${patRes.score}`);
    console.log(`  PAT status:        ${patRes.status}`);

    const copodRes = inf.evaluateCopod(engineered);
    console.log("\n--- COPOD ANOMALY DETAILS ---");
    console.log(`  score:             ${copodRes.score}`);
    console.log(`  warning threshold: 6.0`);
    console.log(`  reject threshold:  9.5`);
    console.log(`  COPOD status:      ${copodRes.status}`);

    const driftRes = inf.evaluateGprDrift(engineered);
    console.log("\n--- GPR 168H FORECAST DETAILS ---");
    Object.keys(driftRes).forEach(p => {
      const d = driftRes[p];
      console.log(`  ${p.toUpperCase()}: 24h=${d.value_24h}, predicted_168h=${d.predicted_168h}, std=${d.uncertainty_std}, upper_95=${d.upper_95}`);
    });

    const safetyRes = inf.evaluateSafetySlope(driftRes);
    console.log("\n--- SAFETY SLOPE DETAILS ---");
    Object.keys(safetyRes).forEach(p => {
      const s = safetyRes[p];
      console.log(`  ${p.toUpperCase()}: predicted_slope=${s.predicted_slope}, upper_bound_slope=${s.upper_bound_slope}, margin=${s.safety_margin}, boundary_status=${s.boundary_status}`);
    });

    const fullRes = inf.predictSingle(payload);
    console.log("\n--- FINAL SYNTHESIS & DISPOSITION ---");
    console.log(`  probability:              ${fullRes.probability} (${(fullRes.probability * 100).toFixed(1)}%)`);
    console.log(`  ml_risk_status:           ${fullRes.ml_risk_status}`);
    console.log(`  anomaly_status:           ${fullRes.anomaly_status}`);
    console.log(`  drift_status:             ${fullRes.drift_status}`);
    console.log(`  disposition (FINAL):      ${fullRes.disposition}`);
    console.log(`  decision_override_reason: ${fullRes.decision_override_reason || "NONE"}`);
    console.log(`  primary_rejection_signal: ${fullRes.primary_rejection_signal || "NONE"}`);

  } catch (err) {
    console.error(`Trace Error:`, err.message);
  }
}

// Full baseline payload
const basePayload = {
  test_id: "TRACE-001",
  equipment_id: "EQP-101",
  supply_voltage: 1.20,
  output_voltage: 1.20,
  current: 40.0,
  leakage_current: 110.0,
  propagation_delay: 11.0,
  resistance: 10.0,
  capacitance: 5.0,
  threshold_voltage: 0.45,
  frequency: 2500.0,
  setup_time: 1.5,
  hold_time: 1.0,
  timing_margin: 2.5,
  temperature: 25.0,
  dynamic_power: 50.0,
  total_power: 50.0,
  test_duration: 10.0
};

// 1. Nominal payload with correct iddq_standby = 10.2 µA
const nominalPayload = {
  ...basePayload,
  iddq_standby: 10.2
};

printDetailedTrace("CANONICAL NOMINAL COMPONENT PAYLOAD (iddq_standby = 10.2 µA)", nominalPayload);
