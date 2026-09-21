/**
 * PREDICTA SIH 2026 — MASTER INTEGRATED END-TO-END RELEASE CERTIFICATION SUITE
 * File: tests/test_release_certification.js
 * 
 * Integrated End-to-End Master Release Gate certifying:
 *  1. PRODUCTION ARTIFACT
 *  2. PRODUCTION CONTRACT
 *  3. PHASE 9 EVALUATION ISOLATION
 *  4. PHASE 10 RISK FUSION
 *  5. PHASE 10 COUNTERFACTUAL
 *  6. API INTEGRATION
 *  7. SECURITY
 *  8. PERSISTENCE
 *  9. DETERMINISM & GOVERNANCE EXECUTION
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const { execSync, spawnSync } = require('child_process');
const { Readable } = require('stream');

const EXPECTED_PRODUCTION_MODEL_SHA = "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98";
const EXPECTED_OPERATING_THRESHOLD = 0.20;
const FROZEN_RISK_FUSION_CONTRACT_SHA = "44a8dfe889568c9ad91f1a4b6bd0ad10fdca691758b318f40d71b7b71681d6bf";

console.log("=================================================================================");
console.log("🚀 PREDICTA SIH 2026 — MASTER INTEGRATED END-TO-END RELEASE CERTIFICATION");
console.log("=================================================================================\n");

let passedCount = 0;
let totalCriteria = 0;
let currentSection = "";

function setSection(sectionName) {
  currentSection = sectionName;
  console.log(`--- ${sectionName} ---`);
}

async function certify(criterionNum, title, testFn) {
  totalCriteria++;
  try {
    await testFn();
    console.log(`  ✓ [CERTIFIED] [${currentSection}] Criterion ${criterionNum.toString().padStart(2, '0')}: ${title}`);
    passedCount++;
  } catch (err) {
    console.error(`\n❌ [RELEASE GATE BLOCKED] [${currentSection}] Criterion ${criterionNum}: ${title}`);
    console.error(`   Reason: ${err.message}\n`);
    console.log("=================================================================================");
    console.log("RESULT: BLOCKED — PREDICTA-26 RELEASE CERTIFICATION FAILED");
    console.log("=================================================================================\n");
    process.exit(1);
  }
}

function getPythonExecutable() {
  const candidatePythons = [
    process.env.PYTHON_EXECUTABLE,
    process.env.PYTHON,
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'python311', 'python.exe') : null,
    'python',
    'python3',
    'py'
  ].filter(Boolean);

  for (const cand of candidatePythons) {
    try {
      const probe = spawnSync(cand, ['--version'], { encoding: 'utf-8' });
      if (probe.status === 0) {
        return cand;
      }
    } catch (_) {}
  }
  return 'python';
}

function invokeMockApiRequest(handleApiRequest, method, url, headers = {}, bodyObj = null) {
  return new Promise((resolve) => {
    const req = new Readable();
    req._read = () => {};
    req.method = method;
    req.url = url;
    req.headers = { ...headers };

    if (bodyObj !== null) {
      const payloadStr = typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj);
      req.push(payloadStr);
    }
    req.push(null);

    let statusCode = 200;
    let responseHeaders = {};
    let responseBody = '';

    const res = {
      writeHead: (status, hdrs) => {
        statusCode = status;
        if (hdrs) responseHeaders = { ...responseHeaders, ...hdrs };
      },
      setHeader: (k, v) => {
        responseHeaders[k] = v;
      },
      getHeader: (k) => responseHeaders[k],
      end: (chunk) => {
        if (chunk) responseBody += chunk;
        resolve({ statusCode, headers: responseHeaders, body: responseBody });
      }
    };

    handleApiRequest(req, res).catch((err) => {
      resolve({ statusCode: 500, headers: {}, body: JSON.stringify({ detail: err.message }) });
    });
  });
}

const SAMPLE_NOMINAL_RECORD = {
  test_id: "CERT-NOMINAL-001",
  equipment_id: "EQP-101",
  lot_id: "LOT-SYN-045",
  component_id: "COMP-001",
  wafer_id: "W-01",
  supply_voltage: 1.20,
  output_voltage: 1.18,
  threshold_voltage: 0.45,
  temperature: 28.0,
  leakage_current: 111.73,
  current: 45.28,
  propagation_delay: 11.0,
  frequency: 2489.0,
  dynamic_power: 54.3,
  resistance: 12.5,
  capacitance: 4.2,
  setup_time: 0.85,
  hold_time: 0.42,
  timing_margin: 2.6,
  total_power: 54.4,
  test_duration: 150.0
};

const SAMPLE_DEFECTIVE_RECORD = {
  test_id: "CERT-DEFECT-001",
  equipment_id: "EQP-101",
  lot_id: "LOT-SYN-045",
  component_id: "COMP-999",
  wafer_id: "W-01",
  supply_voltage: 1.10,
  output_voltage: 1.05,
  current: 78.0,
  leakage_current: 450.0,
  resistance: 18.5,
  capacitance: 7.2,
  threshold_voltage: 0.35,
  frequency: 1800.0,
  propagation_delay: 22.0,
  setup_time: 2.2,
  hold_time: 1.4,
  timing_margin: 0.4,
  temperature: 78.0,
  dynamic_power: 95.0,
  total_power: 120.0,
  test_duration: 180.0
};

async function runMasterReleaseCertification() {
  const inferenceService = require('../src/api/inference');
  const { GovernedRiskFusionEngineJS } = require('../src/risk_fusion/risk_fusion');
  const { GovernedCounterfactualExplainerJS } = require('../src/explainability/counterfactual');
  const { HumanDispositionManagerJS } = require('../src/governance/disposition');
  const { handleApiRequest } = require('../src/api/server');

  // =========================================================================
  // 1. PRODUCTION ARTIFACT
  // =========================================================================
  setSection("PRODUCTION ARTIFACT");

  await certify(1, "One Authoritative Production Model Artifact & Manifest", () => {
    const modelPath = path.join(__dirname, '../ml/models/production/predicta_xgboost_model.json');
    const manifestPath = path.join(__dirname, '../ml/models/production/predicta_production_manifest.json');
    const metadataPath = path.join(__dirname, '../ml/models/production/predicta_xgboost_metadata.json');

    assert.ok(fs.existsSync(modelPath), "Production model JSON artifact must exist");
    assert.ok(fs.existsSync(manifestPath), "Production manifest JSON artifact must exist");
    assert.ok(fs.existsSync(metadataPath), "Production metadata JSON artifact must exist");

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

    assert.strictEqual(manifest.release_version, metadata.model_version, "Manifest release version must match metadata model version");
    assert.ok(manifest.authoritative_version, "Production manifest must declare an authoritative version");
    assert.ok(metadata.authoritative_model_version, "Production metadata must declare an authoritative model version");
    assert.strictEqual(manifest.authoritative_threshold, EXPECTED_OPERATING_THRESHOLD, "Manifest authoritative threshold must equal 0.20");
  });

  await certify(2, "Cryptographic SHA-256 Model Integrity Verification", () => {
    const modelPath = path.join(__dirname, '../ml/models/production/predicta_xgboost_model.json');
    const manifestPath = path.join(__dirname, '../ml/models/production/predicta_production_manifest.json');
    const metadataPath = path.join(__dirname, '../ml/models/production/predicta_xgboost_metadata.json');

    const computedSha = crypto.createHash('sha256').update(fs.readFileSync(modelPath)).digest('hex');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

    assert.strictEqual(computedSha, EXPECTED_PRODUCTION_MODEL_SHA, `Computed model SHA must equal ${EXPECTED_PRODUCTION_MODEL_SHA}`);
    assert.strictEqual(manifest.model_sha256, EXPECTED_PRODUCTION_MODEL_SHA, "Manifest model_sha256 must match authoritative SHA");
    assert.strictEqual(metadata.model_sha256, EXPECTED_PRODUCTION_MODEL_SHA, "Metadata model_sha256 must match authoritative SHA");
  });

  await certify(3, "Single Authoritative ML Operating Threshold (0.20)", () => {
    const metadataPath = path.join(__dirname, '../ml/models/production/predicta_xgboost_metadata.json');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

    assert.strictEqual(inferenceService.operatingThreshold, EXPECTED_OPERATING_THRESHOLD, "Inference service threshold must be 0.20");
    assert.strictEqual(metadata.operating_threshold, EXPECTED_OPERATING_THRESHOLD, "Metadata operating threshold must be 0.20");
    const status = inferenceService.getSystemStatus();
    assert.strictEqual(status.threshold, EXPECTED_OPERATING_THRESHOLD, "System status threshold must report 0.20");
  });

  console.log();

  // =========================================================================
  // 2. PRODUCTION CONTRACT
  // =========================================================================
  setSection("PRODUCTION CONTRACT");

  await certify(4, "Locked 28-Feature Schema Specification & Order", () => {
    const metadataPath = path.join(__dirname, '../ml/models/production/predicta_xgboost_metadata.json');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

    const expectedFeatures = [
      "supply_voltage", "output_voltage", "current", "leakage_current",
      "resistance", "capacitance", "threshold_voltage", "frequency",
      "propagation_delay", "setup_time", "hold_time", "timing_margin",
      "temperature", "dynamic_power", "total_power", "test_duration",
      "voltage_headroom", "voltage_utilization", "leakage_fraction",
      "power_per_current", "normalized_timing_margin", "frequency_delay_product",
      "thermal_delta",
      "eq_EQP-101", "eq_EQP-102", "eq_EQP-103", "eq_EQP-104", "eq_EQP-105"
    ];

    const featureNames = (metadata.feature_contract && metadata.feature_contract.feature_names) || metadata.feature_names || [];
    assert.strictEqual(featureNames.length, 28, "Feature schema must contain exactly 28 features");
    for (let i = 0; i < 28; i++) {
      assert.strictEqual(featureNames[i], expectedFeatures[i], `Feature ${i} mismatch`);
    }
  });

  await certify(5, "Required Anomaly Detection & Drift Prediction Artifact Provenance", () => {
    const patPath = path.join(__dirname, '../ml/models/production/predicta_anomaly_artifacts.json');
    const gprPath = path.join(__dirname, '../ml/models/production/predicta_gpr_kernel_artifacts.json');

    assert.ok(fs.existsSync(patPath), "predicta_anomaly_artifacts.json must exist");
    assert.ok(fs.existsSync(gprPath), "predicta_gpr_kernel_artifacts.json must exist");

    const patArtifacts = JSON.parse(fs.readFileSync(patPath, 'utf-8'));
    assert.ok(patArtifacts.robust_mad && patArtifacts.robust_mad.global_stats && patArtifacts.robust_mad.global_stats.iddq, "PAT MAD reference statistics must be present");
    assert.ok(patArtifacts.copod && patArtifacts.copod.global_ecdfs, "COPOD empirical reference distributions must be present");

    const gprArtifacts = JSON.parse(fs.readFileSync(gprPath, 'utf-8'));
    assert.ok(gprArtifacts.parameters, "GPR parameters must be defined");
    for (const param of ["iddq", "ileak", "tpd"]) {
      assert.ok(gprArtifacts.parameters[param], `GPR parameter ${param} must exist`);
      assert.ok(Array.isArray(gprArtifacts.parameters[param].support_x) && gprArtifacts.parameters[param].support_x.length > 0, `GPR support vectors for ${param} must be present`);
    }
  });

  await certify(6, "Production Dependencies & Environment Integrity", () => {
    const pkgPath = path.join(__dirname, '../package.json');
    const lockPath = path.join(__dirname, '../package-lock.json');
    assert.ok(fs.existsSync(pkgPath), "package.json must exist");
    assert.ok(fs.existsSync(lockPath), "package-lock.json must exist");

    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    assert.ok(pkg.scripts["certify:production"], "certify:production script must exist");
    assert.ok(!pkg.scripts["certify:production"].includes("train:authoritative"), "certify:production MUST NOT execute training");
  });

  console.log();

  // =========================================================================
  // 3. PHASE 9 EVALUATION ISOLATION
  // =========================================================================
  setSection("PHASE 9 EVALUATION ISOLATION");

  await certify(7, "Phase 9 Research & Evaluation Isolation Gate (Fail-Closed EVALUATION_ONLY)", () => {
    const p9ContractPath = path.join(__dirname, '../ml/experiments/latent_evaluation/decision_robustness_contract.json');
    assert.ok(fs.existsSync(p9ContractPath), "Phase 9 contract file must exist at ml/experiments/latent_evaluation/decision_robustness_contract.json");
    
    const p9Contract = JSON.parse(fs.readFileSync(p9ContractPath, 'utf-8'));
    assert.strictEqual(p9Contract.status, "EVALUATION_ONLY", "Phase 9 contract status must be EVALUATION_ONLY");
    assert.strictEqual(p9Contract.contract_name, "9.4.0_decision_robustness_analysis", "Phase 9 contract name must match 9.4.0_decision_robustness_analysis");

    // Verify Phase 9 artifacts do NOT alter production threshold or SHA
    assert.strictEqual(inferenceService.operatingThreshold, EXPECTED_OPERATING_THRESHOLD, "Production threshold must remain locked at 0.20");
    const modelPath = path.join(__dirname, '../ml/models/production/predicta_xgboost_model.json');
    const computedSha = crypto.createHash('sha256').update(fs.readFileSync(modelPath)).digest('hex');
    assert.strictEqual(computedSha, EXPECTED_PRODUCTION_MODEL_SHA, "Phase 9 evaluation artifacts must not substitute production model");
  });

  console.log();

  // =========================================================================
  // 4. PHASE 10 RISK FUSION
  // =========================================================================
  setSection("PHASE 10 RISK FUSION");

  await certify(8, "Governed Risk Fusion Contract SHA-256 & Target Model Binding", () => {
    const rfContractPath = path.join(__dirname, '../ml/risk_fusion/risk_fusion_contract.json');
    assert.ok(fs.existsSync(rfContractPath), "Risk fusion contract must exist");

    const contractRaw = fs.readFileSync(rfContractPath);
    const contractSha = crypto.createHash('sha256').update(contractRaw).digest('hex');
    assert.strictEqual(contractSha, FROZEN_RISK_FUSION_CONTRACT_SHA, `Risk fusion contract SHA-256 must match frozen contract SHA (${FROZEN_RISK_FUSION_CONTRACT_SHA})`);

    const rfContract = JSON.parse(contractRaw.toString('utf-8'));
    assert.strictEqual(rfContract.contract_name, "predicta_governed_risk_fusion_contract", "Contract name must match");
    assert.strictEqual(rfContract.contract_version, "1.0.0", "Risk Fusion contract_version must be 1.0.0");
    assert.strictEqual(rfContract.target_model_sha256, EXPECTED_PRODUCTION_MODEL_SHA, "Target model SHA must match authoritative model SHA");
    assert.strictEqual(rfContract.operating_threshold, EXPECTED_OPERATING_THRESHOLD, "Operating threshold must equal 0.20");
  });

  await certify(9, "Governed Risk Fusion Engine Execution & Evidence Governance", () => {
    const engine = new GovernedRiskFusionEngineJS();
    const result = engine.evaluate(
      0.15,
      {
        pat: { status: "PASS", parameter_z_scores: { iddq: 0.5, ileak: 0.2, tpd: 0.1 } },
        copod: { status: "PASS", score: 2.0 },
        overall_status: "NORMAL"
      },
      {
        iddq: { ratio: 0.2, upper_95: 100.0, forecast_horizon: "168h", has_history: true },
        ileak: { ratio: 0.1, upper_95: 50.0, forecast_horizon: "168h", has_history: true },
        tpd: { ratio: 0.1, upper_95: 25.0, forecast_horizon: "168h", has_history: true },
        overall_status: "NORMAL"
      },
      {
        iddq: { boundary_status: "WITHIN", upper_bound_slope: 1.0, has_history: true },
        ileak: { boundary_status: "WITHIN", upper_bound_slope: 0.5, has_history: true },
        tpd: { boundary_status: "WITHIN", upper_bound_slope: 0.2, has_history: true },
        overall_status: "SAFE"
      }
    );

    assert.strictEqual(result.provenance.contract_version, "1.0.0", "Risk Fusion result contract_version must be 1.0.0");
    assert.strictEqual(result.provenance.model_sha256, EXPECTED_PRODUCTION_MODEL_SHA, "Risk Fusion result model SHA must match");
    assert.strictEqual(result.disposition, "PASS", "Nominal evidence must yield PASS");

    // Test parameter-level INSUFFICIENT_HISTORY handling
    const insufResult = engine.evaluate(
      0.05,
      {
        pat: { status: "PASS", parameter_z_scores: { iddq: 0.5, ileak: 0.2, tpd: 0.1 } },
        copod: { status: "PASS", score: 2.0 },
        overall_status: "NORMAL"
      },
      {
        iddq: { ratio: 0.0, upper_95: 0.0, forecast_horizon: "168h", has_history: false },
        ileak: { ratio: 0.1, upper_95: 50.0, forecast_horizon: "168h", has_history: true },
        tpd: { ratio: 0.1, upper_95: 25.0, forecast_horizon: "168h", has_history: true },
        overall_status: "NORMAL"
      },
      {
        iddq: { boundary_status: "INSUFFICIENT_HISTORY", has_history: false },
        ileak: { boundary_status: "WITHIN", upper_bound_slope: 0.5, has_history: true },
        tpd: { boundary_status: "WITHIN", upper_bound_slope: 0.2, has_history: true },
        overall_status: "INSUFFICIENT_HISTORY"
      }
    );
    assert.strictEqual(insufResult.disposition, "MONITOR", "INSUFFICIENT_HISTORY must route disposition to MONITOR");
  });

  console.log();

  // =========================================================================
  // 5. PHASE 10 COUNTERFACTUAL
  // =========================================================================
  setSection("PHASE 10 COUNTERFACTUAL");

  await certify(10, "Governed Counterfactual Contract Version 1.1.0 Integrity", () => {
    const cfContractPath = path.join(__dirname, '../ml/explainability/counterfactual_contract.json');
    assert.ok(fs.existsSync(cfContractPath), "Counterfactual contract must exist");

    const cfContract = JSON.parse(fs.readFileSync(cfContractPath, 'utf-8'));
    assert.strictEqual(cfContract.contract_version, "1.1.0", "Contract version MUST be 1.1.0");
    assert.strictEqual(cfContract.model_identity.model_sha256, EXPECTED_PRODUCTION_MODEL_SHA, "Counterfactual model SHA must match authoritative model SHA");
    assert.strictEqual(cfContract.model_identity.operating_threshold, EXPECTED_OPERATING_THRESHOLD, "Operating threshold must equal 0.20");
    assert.strictEqual(cfContract.optimization_specification.target_penalty_coefficient, 50.0, "Mandatory target_penalty_coefficient must be 50.0");
  });

  await certify(11, "Counterfactual Search Governance & Fail-Closed Boundaries", () => {
    const explainer = new GovernedCounterfactualExplainerJS();
    assert.strictEqual(explainer.contract.contract_version, "1.1.0", "Explainer contract version must be 1.1.0");
    assert.strictEqual(explainer.targetPenaltyCoeff, 50.0, "Explainer target penalty coefficient must be 50.0");

    const res = explainer.generateCounterfactual(SAMPLE_DEFECTIVE_RECORD, "TARGET_PASS");
    assert.strictEqual(typeof res.target_reached, 'boolean', "target_reached must be boolean");
    assert.strictEqual(res.explanation_status, "BENCHMARK_ONLY", "explanation_status must be BENCHMARK_ONLY");
    assert.strictEqual(res.provenance.model_sha256, EXPECTED_PRODUCTION_MODEL_SHA, "Provenance model SHA must match");
    assert.strictEqual(res.provenance.coupled_physics_status, "PROJECT_DEFINED_LIMITS_ONLY", "coupled_physics_status must be PROJECT_DEFINED_LIMITS_ONLY");

    // Fail closed test for missing contract coefficient
    const cData = JSON.parse(fs.readFileSync(explainer.contractPath, 'utf-8'));
    delete cData.optimization_specification.target_penalty_coefficient;
    const tmpPath = path.resolve(__dirname, 'tmp_cert_cf_contract.json');
    fs.writeFileSync(tmpPath, JSON.stringify(cData), 'utf-8');
    try {
      assert.throws(() => new GovernedCounterfactualExplainerJS(tmpPath), /MISSING_CONTRACT_COEFFICIENT/);
    } finally {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  });

  console.log();

  // =========================================================================
  // 6. API INTEGRATION
  // =========================================================================
  setSection("API INTEGRATION");

  await certify(12, "End-to-End API Route Validation (/api/system/status, /api/predict, /api/predict/batch, /api/explanations/counterfactual, /api/dispositions)", async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret_key_12345_cert";
    process.env.ALLOW_IN_MEMORY_DEMO = "true";
    const { createJwtToken } = require('../src/api/auth');
    const validToken = createJwtToken({ sub: "OPERATOR_01", role: "OPERATOR" }, process.env.JWT_SECRET);
    const authHeaders = {
      'content-type': 'application/json',
      'authorization': `Bearer ${validToken}`
    };

    // 1. GET /api/system/status
    const statusRes = await invokeMockApiRequest(handleApiRequest, 'GET', '/api/system/status');
    assert.strictEqual(statusRes.statusCode, 200, "GET /api/system/status must return 200 OK");
    const statusBody = JSON.parse(statusRes.body);
    assert.strictEqual(statusBody.threshold, EXPECTED_OPERATING_THRESHOLD, "API system status threshold must be 0.20");

    // 2. POST /api/predict
    const predRes = await invokeMockApiRequest(handleApiRequest, 'POST', '/api/predict', authHeaders, SAMPLE_NOMINAL_RECORD);
    assert.strictEqual(predRes.statusCode, 200, "POST /api/predict must return 200 OK");
    const predBody = JSON.parse(predRes.body);
    assert.strictEqual(predBody.prediction, "PASS", "Nominal record must predict PASS");
    assert.ok(typeof predBody.probability === 'number', "Response must contain numeric probability");

    // 3. POST /api/predict/batch
    const batchRes = await invokeMockApiRequest(handleApiRequest, 'POST', '/api/predict/batch', authHeaders, [SAMPLE_NOMINAL_RECORD]);
    assert.strictEqual(batchRes.statusCode, 200, "POST /api/predict/batch must return 200 OK");
    const batchBody = JSON.parse(batchRes.body);
    assert.strictEqual(batchBody.total, 1, "Batch response must contain total count");
    assert.ok(typeof batchBody.pass_count === 'number', "Batch response must contain pass_count");
    assert.ok(typeof batchBody.fail_count === 'number', "Batch response must contain fail_count");
    assert.ok(Array.isArray(batchBody.results) || Array.isArray(batchBody.predictions), "Batch response must contain results array");

    // 4. POST /api/explanations/counterfactual
    const cfRes = await invokeMockApiRequest(handleApiRequest, 'POST', '/api/explanations/counterfactual', authHeaders, { record: SAMPLE_DEFECTIVE_RECORD, target_condition: "TARGET_PASS" });
    assert.strictEqual(cfRes.statusCode, 200, "POST /api/explanations/counterfactual must return 200 OK");
    const cfBody = JSON.parse(cfRes.body);
    assert.strictEqual(cfBody.explanation_status, "BENCHMARK_ONLY", "Counterfactual response status must be BENCHMARK_ONLY");

    // 5. POST /api/dispositions
    const traceId = "TRACE-CERT-001";
    const dispMgr = new HumanDispositionManagerJS();
    dispMgr.registerAuthoritativePrediction({ trace_id: traceId, prediction: "FAIL", probability: 0.95, component_id: "COMP-CERT-01", lot_id: "LOT-SYN-045" });
    const dispRes = await invokeMockApiRequest(handleApiRequest, 'POST', '/api/dispositions', authHeaders, { trace_id: traceId, disposition: "HOLD", reason_code: "INSUFFICIENT_DATA" });
    assert.strictEqual(dispRes.statusCode, 201, `POST /api/dispositions must return 201 Created. Body: ${dispRes.body}`);
  });

  await certify(13, "API Pre-Inference Data Quality & Payload Fail-Closed Gates", async () => {
    const { createJwtToken } = require('../src/api/auth');
    const validToken = createJwtToken({ sub: "OPERATOR_01", role: "OPERATOR" }, process.env.JWT_SECRET);
    const authHeaders = {
      'content-type': 'application/json',
      'authorization': `Bearer ${validToken}`
    };

    // Missing feature
    const missingRes = await invokeMockApiRequest(handleApiRequest, 'POST', '/api/predict', authHeaders, { supply_voltage: 1.2 });
    assert.strictEqual(missingRes.statusCode, 400, "Missing feature must trigger HTTP 400");

    // Negative current
    const negRes = await invokeMockApiRequest(handleApiRequest, 'POST', '/api/predict', authHeaders, { ...SAMPLE_NOMINAL_RECORD, current: -10.0 });
    assert.strictEqual(negRes.statusCode, 400, "Negative current must trigger HTTP 400");

    // Malformed JSON
    const malformedRes = await invokeMockApiRequest(handleApiRequest, 'POST', '/api/predict', authHeaders, "{bad_json: true");
    assert.strictEqual(malformedRes.statusCode, 400, "Malformed JSON must trigger HTTP 400");

    // Oversized payload (> 1 MB)
    const largeStr = "a".repeat(1.5 * 1024 * 1024);
    const largeRes = await invokeMockApiRequest(handleApiRequest, 'POST', '/api/predict', { 'content-type': 'application/json', 'authorization': `Bearer ${validToken}`, 'content-length': String(largeStr.length) }, largeStr);
    assert.strictEqual(largeRes.statusCode, 413, "Oversized payload must trigger HTTP 413");
  });

  await certify(14, "Defense Against Client-Controlled ML Output & Identity Tampering", async () => {
    const { createJwtToken } = require('../src/api/auth');
    const validToken = createJwtToken({ sub: "OPERATOR_01", role: "OPERATOR" }, process.env.JWT_SECRET);
    const authHeaders = {
      'content-type': 'application/json',
      'authorization': `Bearer ${validToken}`
    };

    const traceId = "TRACE-TAMPER-001";
    const dispMgr = new HumanDispositionManagerJS();
    dispMgr.registerAuthoritativePrediction({ trace_id: traceId, prediction: "REJECT", probability: 0.90, component_id: "COMP-TAMPER", lot_id: "LOT-SYN-045" });

    // Client-injected probability
    const probRes = await invokeMockApiRequest(handleApiRequest, 'POST', '/api/dispositions', authHeaders, { trace_id: traceId, disposition: "ACCEPT", reason_code: "OTHER", probability: 0.01 });
    assert.strictEqual(probRes.statusCode, 400, "Client probability injection must trigger HTTP 400");
    assert.ok(probRes.body.includes("CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED"), "Must report CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED");

    // Client-injected component_id
    const compRes = await invokeMockApiRequest(handleApiRequest, 'POST', '/api/dispositions', authHeaders, { trace_id: traceId, disposition: "ACCEPT", reason_code: "OTHER", component_id: "COMP-FAKE" });
    assert.strictEqual(compRes.statusCode, 400, "Client component_id injection must trigger HTTP 400");
    assert.ok(compRes.body.includes("CLIENT_CONTROLLED_IDENTITY_PROHIBITED"), "Must report CLIENT_CONTROLLED_IDENTITY_PROHIBITED");
  });

  await certify(15, "Serverless & Local API Production Routing Consistency", () => {
    const vercelPath = path.join(__dirname, '../vercel.json');
    assert.ok(fs.existsSync(vercelPath), "vercel.json must exist");
    const vercelCfg = JSON.parse(fs.readFileSync(vercelPath, 'utf-8'));
    assert.ok(vercelCfg.rewrites && vercelCfg.rewrites.some(r => r.source.includes("/api")), "Vercel rewrites must route /api");
  });

  console.log();

  // =========================================================================
  // 7. SECURITY
  // =========================================================================
  setSection("SECURITY");

  await certify(16, "Security Audit: Zero Exposed Secret Credentials in Client Assets", () => {
    const clientFiles = ["api.js", "script.js", "frontend/api.js", "frontend/script.js", "index.html", "frontend/index.html"];
    const forbiddenKeys = [
      "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "JWT_SECRET", "SUPABASE_JWT_SECRET",
      "ADMIN_LOGIN_PASSWORD", "ADMIN_API_KEY", "OPERATOR_API_KEY", "PREDICTA_ADMIN_KEY", "PREDICTA_OPERATOR_KEY"
    ];

    clientFiles.forEach(f => {
      const fullPath = path.join(__dirname, '..', f);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        forbiddenKeys.forEach(key => {
          assert.ok(!content.includes(key), `${f} must not contain sensitive key reference '${key}'`);
        });
      }
    });
  });

  await certify(17, "Zero Fail-Open Fallback in Client Decision Path & JWT Fail-Closed Governance", () => {
    const apiJs = fs.readFileSync(path.join(__dirname, '../api.js'), 'utf-8');
    assert.ok(apiJs.includes("LOCAL_DECISION_ENGINE_DISABLED"), "api.js must enforce LOCAL_DECISION_ENGINE_DISABLED");
    assert.ok(!apiJs.includes("function fallbackLocalPredict"), "api.js must not contain fallbackLocalPredict");

    const authJs = fs.readFileSync(path.join(__dirname, '../src/api/auth.js'), 'utf-8');
    assert.ok(!authJs.includes("predicta_production_jwt_secret_key"), "auth.js must NOT contain hardcoded static secret 'predicta_production_jwt_secret_key'");

    const { getJwtSecret, parseAuthHeader } = require('../src/api/auth');

    // Test unconfigured JWT Secret fail-closed behavior
    const savedJwtSecret = process.env.JWT_SECRET;
    const savedSupaJwtSecret = process.env.SUPABASE_JWT_SECRET;
    try {
      delete process.env.JWT_SECRET;
      delete process.env.SUPABASE_JWT_SECRET;
      
      assert.throws(() => getJwtSecret(), /SECURITY_ERROR/, "getJwtSecret must throw SECURITY_ERROR when secret env vars are missing");

      const authRes = parseAuthHeader({ headers: { authorization: "Bearer invalid_token" } });
      assert.strictEqual(authRes.authenticated, false, "parseAuthHeader must return authenticated: false when JWT secret is unconfigured");
    } finally {
      if (savedJwtSecret) process.env.JWT_SECRET = savedJwtSecret;
      if (savedSupaJwtSecret) process.env.SUPABASE_JWT_SECRET = savedSupaJwtSecret;
    }
  });

  console.log();

  // =========================================================================
  // 8. PERSISTENCE
  // =========================================================================
  setSection("PERSISTENCE");

  await certify(18, "Database Persistence Transparency Governance", () => {
    const statusOffline = inferenceService.getSystemStatus();
    if (!inferenceService.supabase) {
      assert.strictEqual(statusOffline.database, "LOCAL_STORAGE", "Offline database must report LOCAL_STORAGE");
      assert.strictEqual(statusOffline.supabase, "DISCONNECTED", "Offline Supabase must report DISCONNECTED");
    }

    // Test status with active persistence mode configuration
    const { PredictaInferenceServiceJS } = require('../src/api/inference');
    const stubSupabase = { from: () => {} };
    const connectedService = new PredictaInferenceServiceJS(stubSupabase);
    connectedService.persistenceMode = "SUPABASE_ACTIVE";
    const statusConnected = connectedService.getSystemStatus();
    assert.strictEqual(statusConnected.database, "ONLINE", "Connected database status must report ONLINE");
    assert.strictEqual(statusConnected.supabase, "ONLINE", "Connected Supabase status must report ONLINE");
  });

  await certify(19, "Dashboard & Historical Aggregations Consistency", () => {
    const summary = inferenceService.getDashboardSummary();
    assert.ok(typeof summary.total_runs === "number", "total_runs must be a number");
    assert.ok(typeof summary.pass_count === "number", "pass_count must be a number");
    assert.ok(typeof summary.fail_count === "number", "fail_count must be a number");
    assert.ok(summary.total_runs >= summary.pass_count + summary.fail_count, "total_runs must be greater than or equal to pass_count + fail_count");
    assert.strictEqual(summary.operating_threshold, EXPECTED_OPERATING_THRESHOLD, "Summary threshold must be 0.20");
  });

  console.log();

  // =========================================================================
  // 9. DETERMINISM & GOVERNANCE EXECUTION
  // =========================================================================
  setSection("DETERMINISM & GOVERNANCE EXECUTION");

  await certify(20, "Cross-Runtime Determinism & Node ↔ Python Parity Suite Verification", () => {
    const res1 = inferenceService.predictSingle(SAMPLE_NOMINAL_RECORD);
    const res2 = inferenceService.predictSingle(SAMPLE_NOMINAL_RECORD);

    assert.strictEqual(res1.probability, res2.probability, "Identical inference calls must yield identical probability");
    assert.strictEqual(res1.prediction, res2.prediction, "Identical inference calls must yield identical prediction");
    assert.strictEqual(res1.disposition, res2.disposition, "Identical inference calls must yield identical disposition");

    // Execute complete cross-runtime Node ↔ Python parity test suite
    execSync('node tests/test_js_python_parity.js', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  });

  await certify(21, "Production Decision Path Threshold Boundary Test (0.199 vs 0.200)", () => {
    const dBelow = inferenceService.makeOperationalDecision(0.199, "EQP-101");
    const dAt = inferenceService.makeOperationalDecision(0.200, "EQP-101");
    const dAbove = inferenceService.makeOperationalDecision(0.651, "EQP-101");

    assert.strictEqual(dBelow.operational_decision, "PASS", "0.199 probability must yield operational decision PASS");
    assert.strictEqual(dBelow.requires_secondary_test, false, "0.199 probability must not require secondary test");

    assert.strictEqual(dAt.operational_decision, "SECONDARY_TEST", "0.200 probability must yield operational decision SECONDARY_TEST");
    assert.strictEqual(dAt.requires_secondary_test, true, "0.200 probability must require secondary test");
    assert.strictEqual(dAt.decision_class, "REVIEW", "0.200 probability decision class must be REVIEW");

    assert.strictEqual(dAbove.operational_decision, "FAIL", "0.651 probability must yield operational decision FAIL");
    assert.strictEqual(dAbove.decision_class, "CRITICAL_FAILURE", "0.651 probability decision class must be CRITICAL_FAILURE");
  });

  await certify(22, "Automated Python Governance Test Suite Execution", () => {
    const pythonExec = getPythonExecutable();
    
    console.log(`\n  Executing pytest tests/test_risk_fusion.py via ${pythonExec}...`);
    const rfRes = spawnSync(pythonExec, ['-m', 'pytest', 'tests/test_risk_fusion.py', '-q'], { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
    assert.strictEqual(rfRes.status, 0, "pytest tests/test_risk_fusion.py MUST exit with code 0");

    console.log(`\n  Executing pytest tests/test_counterfactual_and_disposition.py via ${pythonExec}...`);
    const cfRes = spawnSync(pythonExec, ['-m', 'pytest', 'tests/test_counterfactual_and_disposition.py', '-q'], { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
    assert.strictEqual(cfRes.status, 0, "pytest tests/test_counterfactual_and_disposition.py MUST exit with code 0");
  });

  console.log();
  console.log("=================================================================================");
  console.log(`RESULT: PASS — PREDICTA-26 CERTIFIED PRODUCTION READY (${passedCount}/${totalCriteria} CRITERIA PASSED 100%)`);
  console.log("=================================================================================\n");
}

runMasterReleaseCertification().catch((err) => {
  console.error("Master Release Certification Exception:", err);
  process.exit(1);
});
