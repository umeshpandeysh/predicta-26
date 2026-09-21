/**
 * Predicta Semiconductor Test Analytics — Governed Risk Fusion Node.js Test Suite (Final Remediation)
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
    iddq: { has_history: true, value_24h: 10.5, predicted_168h: 11.0, uncertainty_std: 0.5, upper_95: 12.0, status: "CALCULATED" },
    ileak: { has_history: true, value_24h: 110.0, predicted_168h: 112.0, uncertainty_std: 2.0, upper_95: 116.0, status: "CALCULATED" },
    tpd: { has_history: true, value_24h: 10.0, predicted_168h: 10.2, uncertainty_std: 0.2, upper_95: 10.6, status: "CALCULATED" }
  };
  const safetySlope = {
    iddq: { predicted_slope: 0.003, upper_bound_slope: 0.01, boundary_status: "WITHIN" },
    ileak: { predicted_slope: 0.014, upper_bound_slope: 0.04, boundary_status: "WITHIN" },
    tpd: { predicted_slope: 0.001, upper_bound_slope: 0.004, boundary_status: "WITHIN" }
  };
  return { anomalyEvidence, driftPredictions, safetySlope };
}

function runTests() {
  console.log("=== Running Governed Risk Fusion JS Full A-Z Remediation Test Suite ===");

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

  // Attack A: Client fake risk score
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    for (const val of [5, 0, 100, 42.5]) {
      assert.throws(() => engine.evaluate(0.05, anomalyEvidence, driftPredictions, safetySlope, val), /VALIDATION_ERROR/);
    }
    console.log("[PASS] Attack A: Client fake risk score fails closed");
  }

  // Attack B: Client fake disposition
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    for (const disp of ["PASS", "MONITOR", "REJECT", "APPROVED"]) {
      assert.throws(() => engine.evaluate(0.05, anomalyEvidence, driftPredictions, safetySlope, null, disp), /VALIDATION_ERROR/);
    }
    console.log("[PASS] Attack B: Client fake disposition fails closed");
  }

  // Attack C: NaN Probability
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    assert.throws(() => engine.evaluate(NaN, anomalyEvidence, driftPredictions, safetySlope), /VALIDATION_ERROR/);
    console.log("[PASS] Attack C: NaN Probability fails closed");
  }

  // Attack D: Out of bounds probability
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    assert.throws(() => engine.evaluate(1.5, anomalyEvidence, driftPredictions, safetySlope), /VALIDATION_ERROR/);
    assert.throws(() => engine.evaluate(-0.1, anomalyEvidence, driftPredictions, safetySlope), /VALIDATION_ERROR/);
    console.log("[PASS] Attack D: Out of bounds probability fails closed");
  }

  // Attack E: Unknown evidence/status type
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    assert.throws(() => engine.evaluate(0.10, "INVALID_ANOMALY", driftPredictions, safetySlope), /VALIDATION_ERROR/);
    const badEv = JSON.parse(JSON.stringify(anomalyEvidence));
    badEv.pat.status = "INVALID_STATUS";
    assert.throws(() => engine.evaluate(0.10, badEv, driftPredictions, safetySlope), /VALIDATION_ERROR/);
    console.log("[PASS] Attack E: Unknown evidence/status type fails closed");
  }

  // Attack F: Anomaly REJECT with low ML probability
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    anomalyEvidence.pat = { status: "REJECT", parameter_z_scores: { iddq: 5.0, ileak: 0.1, tpd: 0.1 } };
    const res = engine.evaluate(0.05, anomalyEvidence, driftPredictions, safetySlope);
    assert.strictEqual(res.disposition, "REJECT");
    assert.strictEqual(res.override_reason, "PAT_CRITICAL_ANOMALY");
    assert(res.risk_score >= 70.0);
    console.log("[PASS] Attack F: Anomaly REJECT with low ML probability");
  }

  // Attack G: Safety EXCEEDED with low ML probability
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    safetySlope.iddq.boundary_status = "EXCEEDED";
    const res = engine.evaluate(0.05, anomalyEvidence, driftPredictions, safetySlope);
    assert.strictEqual(res.disposition, "REJECT");
    assert.strictEqual(res.override_reason, "GPR_IDDQ_LIMIT_EXCEEDED");
    assert(res.risk_score >= 75.0);
    console.log("[PASS] Attack G: Safety EXCEEDED with low ML probability");
  }

  // Attack H: High ML probability with nominal evidence
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    const res = engine.evaluate(0.72, anomalyEvidence, driftPredictions, safetySlope);
    assert.strictEqual(res.disposition, "REJECT");
    assert.strictEqual(res.override_reason, "ML_HIGH_RISK");
    console.log("[PASS] Attack H: High ML probability with nominal evidence");
  }

  // Attack I: Elevated ML probability
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    const res = engine.evaluate(0.35, anomalyEvidence, driftPredictions, safetySlope);
    assert.strictEqual(res.disposition, "MONITOR");
    assert.strictEqual(res.override_reason, "ML_ELEVATED_RISK");
    console.log("[PASS] Attack I: Elevated ML probability");
  }

  // Attack J: Anomaly MONITOR
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    anomalyEvidence.overall_status = "MONITOR";
    anomalyEvidence.anomaly_status = "MONITOR";
    const res = engine.evaluate(0.05, anomalyEvidence, driftPredictions, safetySlope);
    assert.strictEqual(res.disposition, "MONITOR");
    assert.strictEqual(res.override_reason, "ANOMALY_OR_DRIFT_WARNING");
    assert(res.risk_score >= 35.0);
    console.log("[PASS] Attack J: Anomaly MONITOR");
  }

  // Attack K: Safety WARNING
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    safetySlope.ileak.boundary_status = "WARNING";
    const res = engine.evaluate(0.05, anomalyEvidence, driftPredictions, safetySlope);
    assert.strictEqual(res.disposition, "MONITOR");
    assert.strictEqual(res.override_reason, "ANOMALY_OR_DRIFT_WARNING");
    assert(res.risk_score >= 40.0);
    console.log("[PASS] Attack K: Safety WARNING");
  }

  // Attack L: Nominal PASS
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    const res = engine.evaluate(0.05, anomalyEvidence, driftPredictions, safetySlope);
    assert.strictEqual(res.disposition, "PASS");
    assert.strictEqual(res.override_reason, "NONE");
    assert.strictEqual(res.risk_class, "SAFE");
    assert.strictEqual(res.provenance.operating_threshold, 0.20);
    console.log("[PASS] Attack L: Nominal PASS");
  }

  // Attack M: Contract mutation
  {
    const tmpContractPath = path.resolve(__dirname, 'tmp_mutated_contract.json');
    const { contractData } = loadRiskFusionContract();
    const mutated = JSON.parse(JSON.stringify(contractData));
    mutated.operating_threshold = 0.25;
    fs.writeFileSync(tmpContractPath, JSON.stringify(mutated), 'utf-8');
    try {
      assert.throws(() => new GovernedRiskFusionEngineJS(tmpContractPath), /CONFIGURATION_ERROR/);
    } finally {
      if (fs.existsSync(tmpContractPath)) fs.unlinkSync(tmpContractPath);
    }
    console.log("[PASS] Attack M: Contract mutation fails closed");
  }

  // Attack N: Model SHA mutation
  {
    const tmpModelPath = path.resolve(__dirname, 'tmp_mutated_model.json');
    fs.writeFileSync(tmpModelPath, JSON.stringify({ mutated: true }), 'utf-8');
    try {
      assert.throws(() => new GovernedRiskFusionEngineJS(null, tmpModelPath), /CONFIGURATION_ERROR/);
    } finally {
      if (fs.existsSync(tmpModelPath)) fs.unlinkSync(tmpModelPath);
    }
    console.log("[PASS] Attack N: Model SHA mutation fails closed");
  }

  // Attack O: Phase 9 threshold substitution attempt
  {
    const tmpContractPath = path.resolve(__dirname, 'tmp_p9_contract.json');
    const { contractData } = loadRiskFusionContract();
    const mutated = JSON.parse(JSON.stringify(contractData));
    mutated.operating_threshold = 0.90;
    fs.writeFileSync(tmpContractPath, JSON.stringify(mutated), 'utf-8');
    try {
      assert.throws(() => new GovernedRiskFusionEngineJS(tmpContractPath), /CONFIGURATION_ERROR/);
    } finally {
      if (fs.existsSync(tmpContractPath)) fs.unlinkSync(tmpContractPath);
    }
    console.log("[PASS] Attack O: Phase 9 threshold substitution attempt fails closed");
  }

  // Attack P: Risk score supplied as ML probability
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    assert.throws(() => engine.evaluate(85.0, anomalyEvidence, driftPredictions, safetySlope), /VALIDATION_ERROR/);
    console.log("[PASS] Attack P: Risk score supplied as ML probability fails closed");
  }

  // Attack Q: Missing PAT evidence
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    const badEv = JSON.parse(JSON.stringify(anomalyEvidence));
    delete badEv.pat;
    assert.throws(() => engine.evaluate(0.05, badEv, driftPredictions, safetySlope), /VALIDATION_ERROR/);
    console.log("[PASS] Attack Q: Missing PAT evidence fails closed");
  }

  // Attack R: Missing COPOD evidence
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    const badEv = JSON.parse(JSON.stringify(anomalyEvidence));
    delete badEv.copod;
    assert.throws(() => engine.evaluate(0.05, badEv, driftPredictions, safetySlope), /VALIDATION_ERROR/);
    console.log("[PASS] Attack R: Missing COPOD evidence fails closed");
  }

  // Attack S: Missing GPR evidence
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    const badDrift1 = JSON.parse(JSON.stringify(driftPredictions));
    delete badDrift1.iddq;
    assert.throws(() => engine.evaluate(0.05, anomalyEvidence, badDrift1, safetySlope), /VALIDATION_ERROR/);

    const badDrift2 = JSON.parse(JSON.stringify(driftPredictions));
    delete badDrift2.iddq.upper_95;
    assert.throws(() => engine.evaluate(0.05, anomalyEvidence, badDrift2, safetySlope), /VALIDATION_ERROR/);
    console.log("[PASS] Attack S: Missing GPR evidence fails closed");
  }

  // Attack T: Missing safety evidence
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    const badSafety1 = JSON.parse(JSON.stringify(safetySlope));
    delete badSafety1.tpd;
    assert.throws(() => engine.evaluate(0.05, anomalyEvidence, driftPredictions, badSafety1), /VALIDATION_ERROR/);

    const badSafety2 = JSON.parse(JSON.stringify(safetySlope));
    delete badSafety2.tpd.upper_bound_slope;
    assert.throws(() => engine.evaluate(0.05, anomalyEvidence, driftPredictions, badSafety2), /VALIDATION_ERROR/);
    console.log("[PASS] Attack T: Missing safety evidence fails closed");
  }

  // Attack U: Unknown status enumeration
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    const badEv = JSON.parse(JSON.stringify(anomalyEvidence));
    badEv.pat.status = "UNKNOWN_STATUS";
    assert.throws(() => engine.evaluate(0.05, badEv, driftPredictions, safetySlope), /VALIDATION_ERROR/);
    console.log("[PASS] Attack U: Unknown status enumeration fails closed");
  }

  // Attack V: NaN/Inf COPOD
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    const badEv = JSON.parse(JSON.stringify(anomalyEvidence));
    badEv.copod.score = NaN;
    assert.throws(() => engine.evaluate(0.05, badEv, driftPredictions, safetySlope), /VALIDATION_ERROR/);
    console.log("[PASS] Attack V: NaN COPOD score fails closed");
  }

  // Attack W: NaN/Inf PAT
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    const badEv = JSON.parse(JSON.stringify(anomalyEvidence));
    badEv.pat.parameter_z_scores.iddq = NaN;
    assert.throws(() => engine.evaluate(0.05, badEv, driftPredictions, safetySlope), /VALIDATION_ERROR/);
    console.log("[PASS] Attack W: NaN PAT z-score fails closed");
  }

  // Attack X: NaN/Inf GPR
  {
    const { anomalyEvidence, driftPredictions, safetySlope } = getNominalInputs();
    const badDrift = JSON.parse(JSON.stringify(driftPredictions));
    badDrift.ileak.upper_95 = Infinity;
    assert.throws(() => engine.evaluate(0.05, anomalyEvidence, badDrift, safetySlope), /VALIDATION_ERROR/);
    console.log("[PASS] Attack X: NaN/Inf GPR evidence fails closed");
  }

  // Attack Y: Contract constant mutation
  {
    const tmpContractPath = path.resolve(__dirname, 'tmp_const_mut_contract.json');
    const { contractData } = loadRiskFusionContract();
    const mutated = JSON.parse(JSON.stringify(contractData));
    mutated.physics_limits.iddq.max_limit = 9999.0;
    fs.writeFileSync(tmpContractPath, JSON.stringify(mutated), 'utf-8');
    try {
      assert.throws(() => new GovernedRiskFusionEngineJS(tmpContractPath), /CONFIGURATION_ERROR/);
    } finally {
      if (fs.existsSync(tmpContractPath)) fs.unlinkSync(tmpContractPath);
    }
    console.log("[PASS] Attack Y: Contract constant mutation fails closed");
  }

  // Attack Z: Model SHA mutation in contract
  {
    const tmpContractPath = path.resolve(__dirname, 'tmp_sha_mut_contract.json');
    const { contractData } = loadRiskFusionContract();
    const mutated = JSON.parse(JSON.stringify(contractData));
    mutated.target_model_sha256 = "0000000000000000000000000000000000000000000000000000000000000000";
    fs.writeFileSync(tmpContractPath, JSON.stringify(mutated), 'utf-8');
    try {
      assert.throws(() => new GovernedRiskFusionEngineJS(tmpContractPath), /CONFIGURATION_ERROR/);
    } finally {
      if (fs.existsSync(tmpContractPath)) fs.unlinkSync(tmpContractPath);
    }
    console.log("[PASS] Attack Z: Model SHA mutation in contract fails closed");
  }

  console.log("=== All Governed Risk Fusion JS Attacks A-Z Passed Successfully ===");
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
