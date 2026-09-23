/**
 * PREDICTA — Operational Disposition Cross-Runtime Parity Test Suite
 * File: tests/test_disposition_cross_runtime_parity.js
 */

const assert = require('assert');
const { PredictaInference } = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA — OPERATIONAL DISPOSITION CROSS-RUNTIME PARITY TEST SUITE");
console.log("=========================================================================\n");

const service = new PredictaInference();

// Required Probability Test Matrix
const PROBABILITY_TEST_CASES = [
  { prob: 0.10, expectedDisposition: "PASS" },
  { prob: 0.15, expectedDisposition: "PASS" },
  { prob: 0.20, expectedDisposition: "MONITOR" },
  { prob: 0.49, expectedDisposition: "MONITOR" },
  { prob: 0.50, expectedDisposition: "MONITOR" },
  { prob: 0.64, expectedDisposition: "MONITOR" },
  { prob: 0.65, expectedDisposition: "REJECT" },
  { prob: 0.70, expectedDisposition: "REJECT" },
  { prob: 0.74, expectedDisposition: "REJECT" },
  { prob: 0.75, expectedDisposition: "REJECT" },
  { prob: 0.90, expectedDisposition: "REJECT" }
];

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

// 1. Probability Threshold Boundary Tests
PROBABILITY_TEST_CASES.forEach(({ prob, expectedDisposition }) => {
  runTest(`Probability boundary P = ${prob} -> ${expectedDisposition}`, () => {
    const anomalyEvidence = { pat: { status: "PASS" }, copod: { status: "PASS" }, overall_status: "PASS" };
    const driftPredictions = {};
    const safetySlope = { iddq: { boundary_status: "WITHIN" }, ileak: { boundary_status: "WITHIN" }, tpd: { boundary_status: "WITHIN" } };
    const riskEngine = {};

    const res = service.synthesizeOperationalDisposition(prob, anomalyEvidence, driftPredictions, safetySlope, riskEngine);
    assert.strictEqual(res.disposition, expectedDisposition, `P=${prob} expected ${expectedDisposition}, got ${res.disposition}`);
  });
});

// 2. Safety Slope Override Tests
runTest('Safety slope EXCEEDED overrides P = 0.15 to REJECT', () => {
  const anomalyEvidence = { pat: { status: "PASS" }, copod: { status: "PASS" }, overall_status: "PASS" };
  const driftPredictions = {};
  const safetySlope = { iddq: { boundary_status: "EXCEEDED" }, ileak: { boundary_status: "WITHIN" }, tpd: { boundary_status: "WITHIN" } };
  const riskEngine = {};

  const res = service.synthesizeOperationalDisposition(0.15, anomalyEvidence, driftPredictions, safetySlope, riskEngine);
  assert.strictEqual(res.disposition, "REJECT", `Safety EXCEEDED must override low P=0.15 to REJECT`);
  assert.strictEqual(res.decision_override_reason, "GPR_IDDQ_LIMIT_EXCEEDED");
});

runTest('Safety slope WARNING overrides P = 0.15 to MONITOR', () => {
  const anomalyEvidence = { pat: { status: "PASS" }, copod: { status: "PASS" }, overall_status: "PASS" };
  const driftPredictions = {};
  const safetySlope = { iddq: { boundary_status: "WITHIN" }, ileak: { boundary_status: "WARNING" }, tpd: { boundary_status: "WITHIN" } };
  const riskEngine = {};

  const res = service.synthesizeOperationalDisposition(0.15, anomalyEvidence, driftPredictions, safetySlope, riskEngine);
  assert.strictEqual(res.disposition, "MONITOR", `Safety WARNING must override low P=0.15 to MONITOR`);
});

runTest('Anomaly REJECT overrides P = 0.15 to REJECT', () => {
  const anomalyEvidence = { pat: { status: "REJECT" }, copod: { status: "PASS" }, overall_status: "ANOMALOUS" };
  const driftPredictions = {};
  const safetySlope = { iddq: { boundary_status: "WITHIN" } };
  const riskEngine = {};

  const res = service.synthesizeOperationalDisposition(0.15, anomalyEvidence, driftPredictions, safetySlope, riskEngine);
  assert.strictEqual(res.disposition, "REJECT", `Anomaly REJECT must override low P=0.15 to REJECT`);
  assert.strictEqual(res.decision_override_reason, "PAT_CRITICAL_ANOMALY");
});

console.log("\n=========================================================================");
console.log("ALL DISPOSITION PARITY BOUNDARY TESTS PASSED! ✅");
console.log("=========================================================================\n");
