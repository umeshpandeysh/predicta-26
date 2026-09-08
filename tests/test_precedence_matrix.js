/**
 * PREDICTA SIH 2026 — OPERATIONAL DECISION PRECEDENCE MATRIX TEST SUITE
 * File: tests/test_precedence_matrix.js
 */

const assert = require('assert');
const inferenceService = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA SIH 2026 — DECISION PRECEDENCE MATRIX TEST SUITE");
console.log("=========================================================================\n");

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`✔ Test ${total.toString().padStart(2, '0')} Passed: ${name}`);
  } catch (err) {
    console.error(`✖ Test ${total.toString().padStart(2, '0')} FAILED: ${name}`);
    console.error(`  Details: ${err.message}`);
    process.exit(1);
  }
}

// Vector 1: Fully Nominal Telemetry -> PASS
runTest("Scenario 01: Low XGBoost Prob + Low Evidence -> PASS", () => {
  const prob = 0.05;
  const anomaly = { pat: { status: "PASS", score: 1.2 }, copod: { status: "PASS", score: 2.1 }, overall_status: "NORMAL" };
  const drift = {};
  const safety = { ileak: { boundary_status: "WITHIN" }, tpd: { boundary_status: "WITHIN" } };
  const riskEngine = { risk_score: 15.0 };

  const res = inferenceService.synthesizeOperationalDisposition(prob, anomaly, drift, safety, riskEngine);
  assert.strictEqual(res.disposition, "PASS");
  assert.strictEqual(res.operational_decision, "PASS");
  assert.strictEqual(res.requires_secondary_test, false);
});

// Vector 2: Elevated Model Probability (P=0.25 >= 0.20) + Nominal Evidence -> MONITOR
runTest("Scenario 02: Elevated Model Prob (P=0.25 >= 0.20) + Nominal Evidence -> MONITOR", () => {
  const prob = 0.25;
  const anomaly = { pat: { status: "PASS", score: 1.2 }, copod: { status: "PASS", score: 2.1 }, overall_status: "NORMAL" };
  const drift = {};
  const safety = { ileak: { boundary_status: "WITHIN" } };
  const riskEngine = { risk_score: 20.0 };

  const res = inferenceService.synthesizeOperationalDisposition(prob, anomaly, drift, safety, riskEngine);
  assert.strictEqual(res.disposition, "MONITOR");
  assert.strictEqual(res.requires_secondary_test, true);
});

// Vector 3: Low Model Prob (0.10) + Anomaly Monitor (PAT Z=4.2) -> MONITOR
runTest("Scenario 03: Low Model Prob + PAT Anomaly Monitor -> MONITOR", () => {
  const prob = 0.10;
  const anomaly = { pat: { status: "MONITOR", score: 4.2 }, copod: { status: "PASS", score: 2.1 }, overall_status: "MONITOR" };
  const drift = {};
  const safety = { ileak: { boundary_status: "WITHIN" } };
  const riskEngine = { risk_score: 35.0 };

  const res = inferenceService.synthesizeOperationalDisposition(prob, anomaly, drift, safety, riskEngine);
  assert.strictEqual(res.disposition, "MONITOR");
  assert.strictEqual(res.requires_secondary_test, true);
});

// Vector 4: Low Model Prob (0.10) + Safety Slope Warning -> MONITOR
runTest("Scenario 04: Low Model Prob + Safety Slope Warning -> MONITOR", () => {
  const prob = 0.10;
  const anomaly = { pat: { status: "PASS", score: 1.0 }, copod: { status: "PASS", score: 2.0 }, overall_status: "NORMAL" };
  const drift = {};
  const safety = { ileak: { boundary_status: "WARNING" } };
  const riskEngine = { risk_score: 25.0 };

  const res = inferenceService.synthesizeOperationalDisposition(prob, anomaly, drift, safety, riskEngine);
  assert.strictEqual(res.disposition, "MONITOR");
});

// Vector 5: High Model Prob (0.70 >= 0.65) -> REJECT
runTest("Scenario 05: High Model Prob (P=0.70 >= 0.65) -> REJECT", () => {
  const prob = 0.70;
  const anomaly = { pat: { status: "PASS", score: 1.0 }, copod: { status: "PASS", score: 2.0 }, overall_status: "NORMAL" };
  const drift = {};
  const safety = { ileak: { boundary_status: "WITHIN" } };
  const riskEngine = { risk_score: 30.0 };

  const res = inferenceService.synthesizeOperationalDisposition(prob, anomaly, drift, safety, riskEngine);
  assert.strictEqual(res.disposition, "REJECT");
  assert.strictEqual(res.requires_secondary_test, false);
});

// Vector 6: Low Model Prob (0.10) + PAT Reject (Z=7.5 > 6.0) -> REJECT
runTest("Scenario 06: Low Model Prob + Critical PAT Anomaly -> REJECT", () => {
  const prob = 0.10;
  const anomaly = { pat: { status: "REJECT", score: 7.5 }, copod: { status: "PASS", score: 2.0 }, overall_status: "ANOMALOUS" };
  const drift = {};
  const safety = { ileak: { boundary_status: "WITHIN" } };
  const riskEngine = { risk_score: 72.0 };

  const res = inferenceService.synthesizeOperationalDisposition(prob, anomaly, drift, safety, riskEngine);
  assert.strictEqual(res.disposition, "REJECT");
});

// Vector 7: Low Model Prob (0.10) + Safety Slope Exceeded -> REJECT
runTest("Scenario 07: Low Model Prob + Safety Slope Exceeded -> REJECT", () => {
  const prob = 0.10;
  const anomaly = { pat: { status: "PASS", score: 1.0 }, copod: { status: "PASS", score: 2.0 }, overall_status: "NORMAL" };
  const drift = {};
  const safety = { ileak: { boundary_status: "EXCEEDED" } };
  const riskEngine = { risk_score: 75.0 };

  const res = inferenceService.synthesizeOperationalDisposition(prob, anomaly, drift, safety, riskEngine);
  assert.strictEqual(res.disposition, "REJECT");
});

// Vector 8: Conflict Priority (Model P=0.25 [MONITOR] vs Critical Anomaly [REJECT]) -> REJECT
runTest("Scenario 08: Conflict Resolution (P=0.25 vs PAT REJECT) -> REJECT Priority Wins", () => {
  const prob = 0.25;
  const anomaly = { pat: { status: "REJECT", score: 8.0 }, copod: { status: "PASS", score: 2.0 }, overall_status: "ANOMALOUS" };
  const drift = {};
  const safety = { ileak: { boundary_status: "WITHIN" } };
  const riskEngine = { risk_score: 78.0 };

  const res = inferenceService.synthesizeOperationalDisposition(prob, anomaly, drift, safety, riskEngine);
  assert.strictEqual(res.disposition, "REJECT");
});

console.log(`\n=========================================================================`);
console.log(`ALL ${passed}/${total} PRECEDENCE MATRIX CONFLICT TESTS PASSED SUCCESSFULLY! ✅`);
console.log(`=========================================================================\n`);
