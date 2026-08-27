/**
 * PREDICTA — Phase 5 Master End-to-End User Flow Verification Suite
 * File: scratch/final_e2e_audit.js
 */

const assert = require('assert');
const inferenceService = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA PHASE 5 — MASTER END-TO-END DATA LINEAGE AUDIT");
console.log("=========================================================================\n");

let passed = 0;
let total = 0;

function check(desc, fn) {
  total++;
  try {
    fn();
    console.log(`[PASS] Check ${total.toString().padStart(2, '0')}: ${desc}`);
    passed++;
  } catch (e) {
    console.error(`[FAIL] Check ${total.toString().padStart(2, '0')}: ${desc}`);
    console.error(`       Error: ${e.message}`);
    process.exit(1);
  }
}

const sampleNominal = {
  test_id: "E2E-FULL-001", equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
  propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 25.0, dynamic_power: 40.0, total_power: 50.0, test_duration: 12.0,
  iddq: 2000.0, ileak: 250.0, tpd: 180.0, iddq_0h: 2000.0, ileak_0h: 250.0, tpd_0h: 180.0
};

check("01. Full 5-Stage Lineage: 0h/24h Telemetry -> PAT/COPOD -> GPR -> Safety -> Risk Engine -> Explainability", () => {
  const res = inferenceService.predictSingle(sampleNominal);
  assert.ok(res.ml_details.anomaly_detection !== undefined);
  assert.ok(res.ml_details.drift_prediction !== undefined);
  assert.ok(res.ml_details.safety_slope !== undefined);
  assert.ok(res.ml_details.risk_engine !== undefined);
  assert.ok(res.ml_details.explainability !== undefined);
});

check("02. Trace ID Auditability Exposure", () => {
  const res = inferenceService.predictSingle(sampleNominal);
  assert.ok(res.trace_id.startsWith("PRED-2026-"));
});

check("03. QA Lifecycle State Machine Flow", () => {
  const req = inferenceService.requestSecondaryTest("E2E-FULL-001", "OP_01", "Request re-test");
  assert.strictEqual(req.lifecycle_state, "SECONDARY_TEST_PENDING");

  const comp = inferenceService.completeSecondaryTest("E2E-FULL-001", "PASS", "OP_01", "Completed");
  assert.strictEqual(comp.lifecycle_state, "CONFIRMED_PASS");
});

console.log("\n=========================================================================");
console.log(`ALL ${passed}/${total} PHASE 5 END-TO-END DATA LINEAGE CHECKS PASSED! ✅`);
console.log("=========================================================================\n");
