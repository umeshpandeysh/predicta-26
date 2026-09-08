/**
 * PREDICTA — Multi-Model Qualification Decision Contract Test Suite
 * File: tests/test_multi_model_decision_contract.js
 *
 * Verifies decision synthesis for Cases A through G:
 *  Case A: LOW ML risk + Anomaly NORMAL + Drift WITHIN -> PASS
 *  Case B: LOW ML risk + Anomaly MONITOR + Drift WITHIN -> MONITOR
 *  Case C: LOW ML risk + Anomaly NORMAL + Drift WARNING -> MONITOR
 *  Case D: LOW ML risk + Anomaly CRITICAL + Drift WITHIN -> REJECT
 *  Case E: LOW ML risk + Anomaly NORMAL + Drift EXCEEDED -> REJECT
 *  Case F: HIGH ML risk + Anomaly NORMAL + Drift WITHIN -> REJECT
 *  Case G: LOW ML risk + Anomaly CRITICAL + Drift EXCEEDED -> REJECT (MULTIPLE_CRITICAL_SIGNALS)
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA — MULTI-MODEL DECISION CONTRACT TEST SUITE");
console.log("=========================================================================\n");

let passed = 0;
let total = 0;

function check(cond, msg) {
  total++;
  if (cond) {
    console.log(`✔ Test ${total.toString().padStart(2, '0')} Passed: ${msg}`);
    passed++;
  } else {
    console.error(`✖ Test ${total.toString().padStart(2, '0')} FAILED: ${msg}`);
    process.exit(1);
  }
}

// Case A: LOW ML (P=0.044) + NORMAL Anomaly + WITHIN LIMITS Drift -> PASS
const caseA = inf.synthesizeOperationalDisposition(
  0.044,
  { pat: { status: "NORMAL" }, copod: { status: "NORMAL" }, overall_status: "NORMAL" },
  {},
  { iddq_standby: { boundary_status: "WITHIN_LIMITS" } },
  null
);
check(caseA.disposition === "PASS", "Case A: Low risk, normal anomaly, within limits drift yields PASS");

// Case B: LOW ML (P=0.044) + MONITOR Anomaly + WITHIN LIMITS Drift -> MONITOR
const caseB = inf.synthesizeOperationalDisposition(
  0.044,
  { pat: { status: "MONITOR" }, copod: { status: "NORMAL" }, overall_status: "MONITOR" },
  {},
  { iddq_standby: { boundary_status: "WITHIN_LIMITS" } },
  null
);
check(caseB.disposition === "MONITOR", "Case B: Anomaly MONITOR yields MONITOR disposition");

// Case C: LOW ML (P=0.044) + NORMAL Anomaly + WARNING Drift -> MONITOR
const caseC = inf.synthesizeOperationalDisposition(
  0.044,
  { pat: { status: "NORMAL" }, copod: { status: "NORMAL" }, overall_status: "NORMAL" },
  {},
  { iddq_standby: { boundary_status: "WARNING" } },
  null
);
check(caseC.disposition === "MONITOR", "Case C: Drift WARNING yields MONITOR disposition");

// Case D: LOW ML (P=0.044) + CRITICAL Anomaly (PAT REJECT) + WITHIN LIMITS Drift -> REJECT
const caseD = inf.synthesizeOperationalDisposition(
  0.044,
  { pat: { status: "REJECT" }, copod: { status: "NORMAL" }, overall_status: "ANOMALOUS" },
  {},
  { iddq_standby: { boundary_status: "WITHIN_LIMITS" } },
  null
);
check(caseD.disposition === "REJECT", "Case D: Critical PAT anomaly yields REJECT disposition");
check(caseD.decision_override_reason === "PAT_CRITICAL_ANOMALY", "Case D: Override reason is PAT_CRITICAL_ANOMALY");
check(typeof caseD.primary_rejection_signal === "string" && caseD.primary_rejection_signal.length > 0, "Case D: Has primary rejection signal");

// Case E: LOW ML (P=0.044) + NORMAL Anomaly + EXCEEDED Drift -> REJECT
const caseE = inf.synthesizeOperationalDisposition(
  0.044,
  { pat: { status: "NORMAL" }, copod: { status: "NORMAL" }, overall_status: "NORMAL" },
  {},
  { iddq_standby: { boundary_status: "EXCEEDED" } },
  null
);
check(caseE.disposition === "REJECT", "Case E: Drift EXCEEDED yields REJECT disposition");
check(caseE.decision_override_reason === "GPR_IDDQ_LIMIT_EXCEEDED", "Case E: Override reason is GPR_IDDQ_LIMIT_EXCEEDED");

// Case F: HIGH ML (P=0.75) + NORMAL Anomaly + WITHIN LIMITS Drift -> REJECT
const caseF = inf.synthesizeOperationalDisposition(
  0.75,
  { pat: { status: "NORMAL" }, copod: { status: "NORMAL" }, overall_status: "NORMAL" },
  {},
  { iddq_standby: { boundary_status: "WITHIN_LIMITS" } },
  null
);
check(caseF.disposition === "REJECT", "Case F: High ML risk (P=0.75) yields REJECT disposition");
check(caseF.decision_override_reason === "ML_HIGH_RISK", "Case F: Override reason is ML_HIGH_RISK");

// Case G: LOW ML (P=0.044) + CRITICAL Anomaly + EXCEEDED Drift -> REJECT with MULTIPLE_CRITICAL_SIGNALS
const caseG = inf.synthesizeOperationalDisposition(
  0.044,
  { pat: { status: "REJECT" }, copod: { status: "NORMAL" }, overall_status: "ANOMALOUS" },
  {},
  { iddq_standby: { boundary_status: "EXCEEDED" } },
  null
);
check(caseG.disposition === "REJECT", "Case G: Critical Anomaly + Exceeded Drift yields REJECT disposition");
check(caseG.decision_override_reason === "MULTIPLE_CRITICAL_SIGNALS", "Case G: Multiple critical signals detected");
check(Array.isArray(caseG.secondary_rejection_signals) && caseG.secondary_rejection_signals.length > 0, "Case G: Has secondary rejection signals");

console.log("\n=========================================================================");
console.log(`ALL ${passed}/${total} MULTI-MODEL DECISION CONTRACT TESTS PASSED! ✅`);
console.log("=========================================================================\n");
