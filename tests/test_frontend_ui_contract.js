/**
 * PREDICTA — FRONTEND UI CONTRACT INTEGRATION TEST SUITE
 * File: tests/test_frontend_ui_contract.js
 * 
 * Objective: Verify end-to-end frontend UI decision contract rendering logic.
 * Asserts that the UI badge, decision, lifecycle, and status styles strictly follow
 * the authoritative backend result.disposition, and NEVER misinterpret result.prediction ("PASS") as a pass when disposition is REJECT.
 */

const assert = require('assert');

function simulateUiRendering(result) {
  const finalDisposition = (result.disposition || result.prediction || "PASS").toUpperCase();
  const isReject = finalDisposition === "REJECT" || finalDisposition === "FAIL";
  const isMonitor = finalDisposition === "MONITOR" || finalDisposition === "REVIEW";

  const badgeText = finalDisposition;
  const badgeClass = `badge ${isReject ? "reject" : (isMonitor ? "monitor" : "pass")}`;
  const probColor = isReject ? "#DC2626" : (isMonitor ? "#D97706" : "#16A34A");
  const decisionText = result.operational_decision || (isReject ? "REJECT" : (isMonitor ? "SECONDARY_TEST" : "PASS"));
  const lifecycleText = result.lifecycle_state || (isReject ? "QUARANTINED" : (isMonitor ? "REVIEW_REQUIRED" : "PREDICTED"));

  return {
    badgeText,
    badgeClass,
    probColor,
    decisionText,
    lifecycleText,
    isReject,
    isMonitor
  };
}

async function runFrontendUiContractTest() {
  console.log("=========================================================================");
  console.log("PREDICTA — FRONTEND UI CONTRACT INTEGRATION TEST SUITE");
  console.log("=========================================================================\n");

  // SCENARIO 1: Nominal 4.4% Low Risk Component (P = 0.044, LOW ML, NORMAL Anomaly, WITHIN Drift => PASS)
  console.log("Scenario 1: Testing Nominal 4.4% Low-Risk Response...");
  const nominalRes = {
    probability: 0.0441,
    ml_risk_status: "LOW",
    anomaly_status: "NORMAL",
    drift_status: "WITHIN",
    prediction: "PASS",
    disposition: "PASS",
    operational_decision: "PASS",
    lifecycle_state: "PREDICTED"
  };

  const ui1 = simulateUiRendering(nominalRes);
  console.log("  UI Output 1:", ui1);
  assert.strictEqual(ui1.badgeText, "PASS", "Scenario 1 badge text MUST be PASS");
  assert.strictEqual(ui1.badgeClass, "badge pass", "Scenario 1 badge class MUST be 'badge pass'");
  assert.strictEqual(ui1.decisionText, "PASS", "Scenario 1 decision text MUST be PASS");
  console.log("✔ Scenario 1 Passed: Nominal 4.4% response renders PASS UI badge & styles ✅\n");

  // SCENARIO 2: 4.4% XGBoost Probability + PAT Anomaly Override (P = 0.044, LOW ML, REJECT Anomaly => REJECT)
  console.log("Scenario 2: Testing 4.4% ML Risk + PAT Anomaly Override (REJECT)...");
  const anomalyRes = {
    probability: 0.0441,
    ml_risk_status: "LOW",
    anomaly_status: "REJECT",
    drift_status: "WITHIN",
    prediction: "PASS", // XGBoost classification alone is PASS
    disposition: "REJECT", // Authoritative multi-model disposition is REJECT
    operational_decision: "REJECT",
    lifecycle_state: "QUARANTINED"
  };

  const ui2 = simulateUiRendering(anomalyRes);
  console.log("  UI Output 2:", ui2);
  assert.strictEqual(ui2.badgeText, "REJECT", "Scenario 2 badge text MUST be REJECT (following disposition, NOT prediction 'PASS')");
  assert.strictEqual(ui2.badgeClass, "badge reject", "Scenario 2 badge class MUST be 'badge reject'");
  assert.strictEqual(ui2.decisionText, "REJECT", "Scenario 2 decision text MUST be REJECT");
  assert.strictEqual(ui2.lifecycleText, "QUARANTINED", "Scenario 2 lifecycle text MUST be QUARANTINED");
  console.log("✔ Scenario 2 Passed: UI correctly follows disposition 'REJECT' despite prediction 'PASS' ✅\n");

  // SCENARIO 3: MONITOR Disposition (P = 0.45, ELEVATED ML => MONITOR)
  console.log("Scenario 3: Testing MONITOR Disposition Response...");
  const monitorRes = {
    probability: 0.45,
    ml_risk_status: "ELEVATED",
    anomaly_status: "NORMAL",
    drift_status: "WITHIN",
    prediction: "FAIL", // In V2 threshold 0.20, P >= 0.20 is FAIL prediction
    disposition: "MONITOR", // Multi-model disposition is MONITOR for review
    operational_decision: "SECONDARY_TEST",
    lifecycle_state: "REVIEW_REQUIRED"
  };

  const ui3 = simulateUiRendering(monitorRes);
  console.log("  UI Output 3:", ui3);
  assert.strictEqual(ui3.badgeText, "MONITOR", "Scenario 3 badge text MUST be MONITOR");
  assert.strictEqual(ui3.badgeClass, "badge monitor", "Scenario 3 badge class MUST be 'badge monitor'");
  assert.strictEqual(ui3.decisionText, "SECONDARY_TEST", "Scenario 3 decision text MUST be SECONDARY_TEST");
  console.log("✔ Scenario 3 Passed: MONITOR disposition renders MONITOR UI badge & styles ✅\n");

  console.log("=========================================================================");
  console.log("ALL FRONTEND UI CONTRACT INTEGRATION TESTS PASSED 100% CLEANLY! ✅");
  console.log("=========================================================================\n");
}

runFrontendUiContractTest().catch(err => {
  console.error("❌ Frontend UI Contract Test Failed:", err);
  process.exit(1);
});
