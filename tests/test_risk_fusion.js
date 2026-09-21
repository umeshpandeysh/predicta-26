/**
 * Predicta Semiconductor Test Analytics — Governed Risk Fusion Node.js Test Suite (Remediated)
 * File: tests/test_risk_fusion.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { GovernedRiskFusionEngineJS, loadRiskFusionContract, verifyProductionModelSha } = require('../src/risk_fusion/risk_fusion');

function getNominalInputs() {
  const anomalyEvidence = {
    pat: { status: "PASS", parameter_z_scores: { iddq: 0.2, ileak: 0.1, tpd: 0.1 } },
    copod: { score: 2.1, status: "PASS" },
    overall_status: "NORMAL",
    anomaly_status: "NORMAL"
  };
  const driftPredictions = {
    iddq: { has_history: true, value_24h: 10.5, predicted_168h: 11.0, uncertainty_std: 0.5, upper_95: 12.0 },
    ileak: { has_history: true, value_24h: 110.0, predicted_168h: 112.0, uncertainty_std: 2.0, upper_95: 116.0 },
    tpd: { has_history: true, value_24h: 10.0, predicted_168h: 10.2, uncertainty_std: 0.2, upper_95: 10.6 }
  };
  const safetySlope = {
    iddq: { predicted_slope: 0.003, upper_bound_slope: 0.01, boundary_status: "WITHIN" },
    ileak: { predicted_slope: 0.014, upper_bound_slope: 0.04, boundary_status: "WITHIN" },
    tpd: { predicted_slope: 0.001, upper_bound_slope: 0.004, boundary_status: "WITHIN" }
  };
  return { anomalyEvidence, driftPredictions, safetySlope };
}

function runTests() {
  console.log("=== Running Governed Risk Fusion JS Remediation Test Suite ===");

  // Test 1: Contract Integrity
  const { contractData, sha256 } = loadRiskFusionContract();
  assert.strictEqual(contractData.contract_version, "1.0.0");
  assert.strictEqual(contractData.operating_threshold, 0.20);
  assert.strictEqual(sha256.length, 64);
  console.log("[PASS] Test 1: Contract Integrity");

  // Test 2: Production Model SHA Integrity
  const computedModelSha = verifyProductionModelSha();
  assert.strictEqual(computedModelSha, "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98");
  console.log("[PASS] Test 2: Production Model SHA Integrity");

  const engine = new GovernedRiskFusionEngineJS();

  // Test Attack A: Client fake risk score
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    for (const val of [5, 0, 100, 42.5]) {
      assert.throws(() => engine.evaluate(0.05, anomalyEvidence, driftPredictions, safetySlope, val), /VALIDATION_ERROR/);
    }
    console.log("[PASS] Test Attack A: Client fake risk score fails closed");
  }

  // Test Attack B: Client fake disposition
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    for (const disp of ["PASS", "MONITOR", "REJECT", "APPROVED"]) {
      assert.throws(() => engine.evaluate(0.05, anomalyEvidence, driftPredictions, safetySlope, null, disp), /VALIDATION_ERROR/);
    }
    console.log("[PASS] Test Attack B: Client fake disposition fails closed");
  }

  // Test Attack C: NaN Probability
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    assert.throws(() => engine.evaluate(NaN, anomalyEvidence, driftPredictions, safetySlope), /VALIDATION_ERROR/);
    console.log("[PASS] Test Attack C: NaN Probability fails closed");
  }

  // Test Attack D: Out of bounds probability
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    assert.throws(() => engine.evaluate(1.5, anomalyEvidence, driftPredictions, safetySlope), /VALIDATION_ERROR/);
    assert.throws(() => engine.evaluate(-0.1, anomalyEvidence, driftPredictions, safetySlope), /VALIDATION_ERROR/);
    console.log("[PASS] Test Attack D: Out of bounds probability fails closed");
  }

  // Test Attack F: Anomaly REJECT with low ML probability
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    anomalyEvidence.pat = { status: "REJECT", parameter_z_scores: { iddq: 5.0, ileak: 0.1, tpd: 0.1 } };
    const res = engine.evaluate(0.05, anomalyEvidence, driftPredictions, safetySlope);
    assert.strictEqual(res.disposition, "REJECT");
    assert.strictEqual(res.override_reason, "PAT_CRITICAL_ANOMALY");
    assert(res.risk_score >= 70.0);
    console.log("[PASS] Test Attack F: Anomaly REJECT with low ML probability");
  }

  // Test Attack G: Safety EXCEEDED with low ML probability
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    safetySlope.iddq.boundary_status = "EXCEEDED";
    const res = engine.evaluate(0.05, anomalyEvidence, driftPredictions, safetySlope);
    assert.strictEqual(res.disposition, "REJECT");
    assert.strictEqual(res.override_reason, "GPR_IDDQ_LIMIT_EXCEEDED");
    assert(res.risk_score >= 75.0);
    console.log("[PASS] Test Attack G: Safety EXCEEDED with low ML probability");
  }

  // Test Attack H: High ML probability with nominal evidence
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    const res = engine.evaluate(0.72, anomalyEvidence, driftPredictions, safetySlope);
    assert.strictEqual(res.disposition, "REJECT");
    assert.strictEqual(res.override_reason, "ML_HIGH_RISK");
    console.log("[PASS] Test Attack H: High ML probability with nominal evidence");
  }

  // Test Attack I: Elevated ML probability
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    const res = engine.evaluate(0.35, anomalyEvidence, driftPredictions, safetySlope);
    assert.strictEqual(res.disposition, "MONITOR");
    assert.strictEqual(res.override_reason, "ML_ELEVATED_RISK");
    console.log("[PASS] Test Attack I: Elevated ML probability");
  }

  // Test Attack L: Nominal PASS
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    const res = engine.evaluate(0.05, anomalyEvidence, driftPredictions, safetySlope);
    assert.strictEqual(res.disposition, "PASS");
    assert.strictEqual(res.override_reason, "NONE");
    assert.strictEqual(res.risk_class, "SAFE");
    assert.strictEqual(res.provenance.operating_threshold, 0.20);
    console.log("[PASS] Test Attack L: Nominal PASS");
  }

  // Test Attack Q: Missing PAT evidence
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    delete anomalyEvidence.pat;
    assert.throws(() => engine.evaluate(0.05, anomalyEvidence, driftPredictions, safetySlope), /VALIDATION_ERROR/);
    console.log("[PASS] Test Attack Q: Missing PAT evidence fails closed");
  }

  // Test Attack U: Unknown status enumeration
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    anomalyEvidence.pat.status = "UNKNOWN_STATUS";
    assert.throws(() => engine.evaluate(0.05, anomalyEvidence, driftPredictions, safetySlope), /VALIDATION_ERROR/);
    console.log("[PASS] Test Attack U: Unknown status enumeration fails closed");
  }

  console.log("=== All Governed Risk Fusion JS Tests Passed Successfully ===");
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
