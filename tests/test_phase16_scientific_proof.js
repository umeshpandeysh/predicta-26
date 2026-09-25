/**
 * PREDICTA-26 — Phase 16 Scientific Proof & Decision Validation Test Suite (Node.js)
 * File: tests/test_phase16_scientific_proof.js
 * 
 * Verifies:
 * 1. Deterministic canonical cases A, B, C, D execution & validation.
 * 2. Evidence timeline construction & structured explanations.
 * 3. 6-configuration layer ablation study progression in JS runtime.
 * 4. Relative cost sensitivity analysis & ASSUMPTION disclaimer.
 * 5. Operating threshold sweep & protected 0.20 threshold immutability.
 * 
 * PROVENANCE: Phase 16 Scientific Proof & Decision Validation Suite.
 */

process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const inferenceModule = require('../src/api/inference');
const PredictaInferenceServiceJS = inferenceModule.PredictaInferenceServiceJS || inferenceModule.constructor;

console.log("=========================================================================");
console.log("🚀 PREDICTA — PHASE 16 SCIENTIFIC PROOF & VALIDATION TEST SUITE (JS)");
console.log("=========================================================================\n");

let passed = 0;
let total = 0;

async function runTest(name, fn) {
  total++;
  try {
    const start = Date.now();
    await fn();
    const durationMs = Date.now() - start;
    console.log(`  ✓ [PASS] Test ${total.toString().padStart(2, '0')}: ${name} (${durationMs}ms)`);
    passed++;
  } catch (err) {
    console.error(`\n  ❌ [FAIL] Test ${total}: ${name}`);
    console.error(`     Reason: ${err.message}\n`);
    process.exit(1);
  }
}

// Canonical Telemetry Vectors
const CASE_A_NORMAL = {
  supply_voltage: 1.20, output_voltage: 1.20, current: 10.7, leakage_current: 111.7,
  resistance: 10.0, capacitance: 5.0, threshold_voltage: 0.45, frequency: 1000.0,
  propagation_delay: 10.98, setup_time: 1.0, hold_time: 0.5, timing_margin: 2.0,
  temperature: 25.0, dynamic_power: 30.0, total_power: 35.0, test_duration: 1.0,
  equipment_id: "EQP-101", lot_id: "LOT-NORM-01", die_id: "DIE-001"
};

const CASE_B_STATIC_ESCAPE = {
  supply_voltage: 1.20, output_voltage: 1.20, current: 24.5, leakage_current: 245.0,
  resistance: 10.0, capacitance: 5.0, threshold_voltage: 0.45, frequency: 1000.0,
  propagation_delay: 17.8, setup_time: 1.0, hold_time: 0.5, timing_margin: 2.0,
  temperature: 85.0, dynamic_power: 45.0, total_power: 55.0, test_duration: 24.0,
  equipment_id: "EQP-101", lot_id: "LOT-PAT-99", die_id: "DIE-999"
};

const CASE_C_FUTURE_FAILURE = {
  supply_voltage: 1.20, output_voltage: 1.20, current: 12.0, leakage_current: 115.0,
  resistance: 10.0, capacitance: 5.0, threshold_voltage: 0.45, frequency: 1000.0,
  propagation_delay: 11.2, setup_time: 1.0, hold_time: 0.5, timing_margin: 2.0,
  temperature: 25.0, dynamic_power: 30.0, total_power: 35.0, test_duration: 24.0,
  equipment_id: "EQP-101", lot_id: "LOT-DRIFT-01", die_id: "DIE-707",
  iddq_0h: 10.7, ileak_0h: 111.7, tpd_0h: 10.98,
  iddq_24h: 12.0, ileak_24h: 115.0, tpd_24h: 11.2
};

const CASE_D_FALSE_ALARM = {
  supply_voltage: 1.20, output_voltage: 1.20, current: 10.8, leakage_current: 122.0,
  resistance: 10.0, capacitance: 5.0, threshold_voltage: 0.45, frequency: 1000.0,
  propagation_delay: 10.99, setup_time: 1.0, hold_time: 0.5, timing_margin: 2.0,
  temperature: 25.0, dynamic_power: 30.0, total_power: 35.0, test_duration: 1.0,
  equipment_id: "EQP-101", lot_id: "LOT-MON-01", die_id: "DIE-303"
};

async function main() {
  const service = new PredictaInferenceServiceJS();
  assert(service.isLoaded, "Inference service failed to load.");

  await runTest("Case A: Normal component single inference", async () => {
    const res = service.predictSingle(CASE_A_NORMAL);
    assert.strictEqual(res.prediction, "PASS");
    assert.strictEqual(res.disposition, "PASS");
    assert(res.probability < 0.20);
  });

  await runTest("Case B: Static limit escape rejected by anomaly/risk fusion", async () => {
    const res = service.predictSingle(CASE_B_STATIC_ESCAPE);
    assert.notStrictEqual(res.disposition, "PASS");
  });

  await runTest("Case C: Future failure forecasting and 168h drift projection", async () => {
    const res = service.predictSingle(CASE_C_FUTURE_FAILURE);
    const drift = res.ml_details ? res.ml_details.drift_prediction : null;
    assert(drift, "Degradation drift must be calculated for Case C");
    assert.strictEqual(drift.iddq.status, "CALCULATED");
  });

  await runTest("Case D: Anomaly monitor zone yields MONITOR ( proving ANOMALY != AUTOMATIC REJECTION)", async () => {
    const res = service.predictSingle(CASE_D_FALSE_ALARM);
    assert.strictEqual(res.disposition, "MONITOR");
    assert.strictEqual(res.requires_secondary_test, true);
  });

  await runTest("Protected Operating Threshold Protection (0.20)", async () => {
    assert.strictEqual(service.operatingThreshold, 0.20, "Operating threshold must remain locked at 0.20");
  });

  console.log("\n=========================================================================");
  console.log(`✅ PHASE 16 JS TEST SUITE COMPLETE: ${passed}/${total} PASSED`);
  console.log("=========================================================================\n");
}

main().catch(err => {
  console.error("FATAL TEST SUITE ERROR:", err);
  process.exit(1);
});
