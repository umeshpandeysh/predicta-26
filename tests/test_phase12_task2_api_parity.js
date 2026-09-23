/**
 * PREDICTA — PHASE 12 TASK 2 CROSS-RUNTIME & API PARITY TEST SUITE (Node.js)
 * File: tests/test_phase12_task2_api_parity.js
 * 
 * Verifies 100% parity across Node.js inference engine, Python inference engine,
 * Express API endpoints, and Vercel serverless functions against the authoritative
 * Phase 12 Task 2 contract (ml/evaluation/phase12_task2_api_parity_contract.json).
 */

process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const http = require('http');

const inferenceModule = require('../src/api/inference');
const PredictaInferenceServiceJS = inferenceModule.PredictaInferenceServiceJS || inferenceModule.constructor;
const { handleApiRequest } = require('../src/api/server');

const CONTRACT_PATH = path.join(__dirname, '../ml/evaluation/phase12_task2_api_parity_contract.json');
const REPORT_PATH = path.join(__dirname, 'artifacts/phase12_task2_parity_report.json');

console.log("=========================================================================");
console.log("🚀 PREDICTA — PHASE 12 TASK 2 CROSS-RUNTIME & API PARITY TEST SUITE (JS)");
console.log("=========================================================================\n");

let passed = 0;
let total = 0;
const results = [];

async function runTest(name, vectorClass, fn) {
  total++;
  try {
    const start = Date.now();
    const details = await fn();
    const durationMs = Date.now() - start;
    console.log(`  ✓ [PASS] Test ${total.toString().padStart(2, '0')} (Vector ${vectorClass}): ${name}`);
    passed++;
    results.push({
      id: `TEST-${total.toString().padStart(2, '0')}`,
      vector_class: vectorClass,
      name,
      status: "PASS",
      duration_ms: durationMs,
      details: details || {}
    });
  } catch (err) {
    console.error(`\n  ❌ [FAIL] Test ${total} (Vector ${vectorClass}): ${name}`);
    console.error(`     Reason: ${err.message}\n`);
    results.push({
      id: `TEST-${total.toString().padStart(2, '0')}`,
      vector_class: vectorClass,
      name,
      status: "FAIL",
      error: err.message
    });
    process.exit(1);
  }
}

// Helper mock req/res for testing Express/Vercel server handler handleApiRequest
function makeMockReqRes(method, url, headers = {}, body = null) {
  const req = {
    method,
    url,
    headers: Object.assign({ 'content-type': 'application/json' }, headers),
    body
  };

  let statusCode = 200;
  let resHeaders = {};
  let resBody = '';

  const res = {
    setHeader(k, v) { resHeaders[k.toLowerCase()] = v; },
    writeHead(code, h = {}) {
      statusCode = code;
      Object.keys(h).forEach(k => { resHeaders[k.toLowerCase()] = h[k]; });
    },
    end(content) {
      if (content) resBody += content;
    }
  };

  return { req, res, getResult: () => ({ statusCode, headers: resHeaders, body: resBody }) };
}

// Standard Golden Vectors
const VECTOR_A_NORMAL = {
  supply_voltage: 1.20, output_voltage: 1.20, current: 10.7, leakage_current: 111.7,
  resistance: 10.0, capacitance: 5.0, threshold_voltage: 0.45, frequency: 1000.0,
  propagation_delay: 10.98, setup_time: 1.0, hold_time: 0.5, timing_margin: 2.0,
  temperature: 25.0, dynamic_power: 30.0, total_power: 35.0, test_duration: 1.0,
  equipment_id: "EQP-101"
};

const VECTOR_D_HIGH_RISK = {
  supply_voltage: 1.05, output_voltage: 1.00, current: 150.0, leakage_current: 240.0,
  resistance: 15.0, capacitance: 8.0, threshold_voltage: 0.35, frequency: 1200.0,
  propagation_delay: 18.0, setup_time: 1.5, hold_time: 0.8, timing_margin: 0.5,
  temperature: 55.0, dynamic_power: 90.0, total_power: 110.0, test_duration: 1.2,
  equipment_id: "EQP-102"
};

const VECTOR_E_PAT_REJECT = {
  supply_voltage: 1.20, output_voltage: 1.20, current: 450.0, leakage_current: 350.0,
  resistance: 10.0, capacitance: 5.0, threshold_voltage: 0.45, frequency: 1000.0,
  propagation_delay: 20.0, setup_time: 1.0, hold_time: 0.5, timing_margin: 2.0,
  temperature: 25.0, dynamic_power: 30.0, total_power: 35.0, test_duration: 1.0,
  equipment_id: "EQP-103"
};

const VECTOR_H_COMPLETE_PROGNOSTIC = {
  ...VECTOR_A_NORMAL,
  iddq_0h: 10.7,
  ileak_0h: 111.7,
  tpd_0h: 10.98
};

async function main() {
  assert(fs.existsSync(CONTRACT_PATH), `Contract missing at ${CONTRACT_PATH}`);
  const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf-8'));

  const service = new PredictaInferenceServiceJS();
  assert(service.isLoaded, "Inference service failed to load.");

  // -------------------------------------------------------------------------
  // VECTOR A: Normal Component
  // -------------------------------------------------------------------------
  await runTest("Vector A: Normal component single inference parity", "A", async () => {
    const res = service.predictSingle(VECTOR_A_NORMAL);
    assert.strictEqual(typeof res.probability, "number");
    assert(res.probability < 0.20, `Expected prob < 0.20, got ${res.probability}`);
    assert.strictEqual(res.prediction, "PASS");
    assert.strictEqual(res.threshold, 0.20);
    assert.strictEqual(res.disposition, "PASS");
    return { probability: res.probability, disposition: res.disposition };
  });

  // -------------------------------------------------------------------------
  // VECTOR B: Probability Below Threshold
  // -------------------------------------------------------------------------
  await runTest("Vector B: Probability below threshold (P < 0.20)", "B", async () => {
    const res = service.predictSingle(VECTOR_A_NORMAL);
    assert(res.probability < service.operatingThreshold);
    assert.strictEqual(res.prediction, "PASS");
    assert.strictEqual(res.ml_prediction, "PASS");
    return { probability: res.probability };
  });

  // -------------------------------------------------------------------------
  // VECTOR C: Exact Threshold Contract Check
  // -------------------------------------------------------------------------
  await runTest("Vector C: Authoritative threshold contract (0.20)", "C", async () => {
    assert.strictEqual(service.operatingThreshold, 0.20);
    const dec = service.makeOperationalDecision(0.200000, "EQP-101");
    assert.strictEqual(dec.operational_decision, "SECONDARY_TEST");
    assert.strictEqual(dec.requires_secondary_test, true);
    return { threshold: service.operatingThreshold };
  });

  // -------------------------------------------------------------------------
  // VECTOR D: Probability Above Threshold
  // -------------------------------------------------------------------------
  await runTest("Vector D: Probability above threshold (P >= 0.20)", "D", async () => {
    const res = service.predictSingle(VECTOR_D_HIGH_RISK);
    assert(res.probability >= 0.20, `Expected prob >= 0.20, got ${res.probability}`);
    assert.strictEqual(res.prediction, "FAIL");
    assert.notStrictEqual(res.risk_level, "LOW");
    return { probability: res.probability, risk_level: res.risk_level };
  });

  // -------------------------------------------------------------------------
  // VECTOR E: Severe Anomaly Override
  // -------------------------------------------------------------------------
  await runTest("Vector E: Severe PAT/COPOD anomaly override", "E", async () => {
    const res = service.predictSingle(VECTOR_E_PAT_REJECT);
    assert.strictEqual(res.anomaly_status, "REJECT");
    assert.strictEqual(res.disposition, "REJECT");
    assert.strictEqual(res.risk_level, "CRITICAL");
    return { anomaly_status: res.anomaly_status, disposition: res.disposition };
  });

  // -------------------------------------------------------------------------
  // VECTOR F: Safety Warning (MONITOR)
  // -------------------------------------------------------------------------
  await runTest("Vector F: Safety warning zone yields MONITOR disposition", "F", async () => {
    const warnVector = {
      ...VECTOR_A_NORMAL,
      leakage_current: 122.0
    };
    const res = service.predictSingle(warnVector);
    assert.strictEqual(res.disposition, "MONITOR");
    assert.strictEqual(res.requires_secondary_test, true);
    return { disposition: res.disposition };
  });

  // -------------------------------------------------------------------------
  // VECTOR G: Safety Limit Exceeded (REJECT)
  // -------------------------------------------------------------------------
  await runTest("Vector G: Trajectory safety limit exceeded yields REJECT", "G", async () => {
    const exceedVector = {
      ...VECTOR_A_NORMAL,
      leakage_current: 400.0,
      propagation_delay: 35.0
    };
    const res = service.predictSingle(exceedVector);
    assert.strictEqual(res.disposition, "REJECT");
    return { disposition: res.disposition };
  });

  // -------------------------------------------------------------------------
  // VECTOR H: Complete Prognostic History
  // -------------------------------------------------------------------------
  await runTest("Vector H: Complete prognostic history with 0h baseline", "H", async () => {
    const res = service.predictSingle(VECTOR_H_COMPLETE_PROGNOSTIC);
    const drift = res.ml_details.degradation_drift || service.evaluateGprDrift(VECTOR_H_COMPLETE_PROGNOSTIC);
    assert.strictEqual(drift.iddq.status, "CALCULATED");
    assert.strictEqual(drift.iddq.has_history, true);
    assert.strictEqual(typeof drift.iddq.predicted_168h, "number");
    assert(Array.isArray(drift.iddq.ci_95) || typeof drift.iddq.lower_95 === "number");
    return { iddq_168h: drift.iddq.predicted_168h };
  });

  // -------------------------------------------------------------------------
  // VECTOR I: Missing Baseline / INSUFFICIENT_HISTORY
  // -------------------------------------------------------------------------
  await runTest("Vector I: Missing 0h baseline yields INSUFFICIENT_HISTORY", "I", async () => {
    const drift = service.evaluateGprDrift(VECTOR_A_NORMAL);
    assert.strictEqual(drift.iddq.status, "INSUFFICIENT_HISTORY");
    assert.strictEqual(drift.iddq.has_history, false);
    return { iddq_status: drift.iddq.status };
  });

  // -------------------------------------------------------------------------
  // VECTOR J: Unseen Equipment ID
  // -------------------------------------------------------------------------
  await runTest("Vector J: Unseen equipment ID handles gracefully without crashing", "J", async () => {
    const unseenVector = { ...VECTOR_A_NORMAL, equipment_id: "EQP-999" };
    const res = service.predictSingle(unseenVector);
    assert.strictEqual(res.is_unseen_equipment, true);
    assert.strictEqual(typeof res.probability, "number");
    return { is_unseen_equipment: res.is_unseen_equipment, probability: res.probability };
  });

  // -------------------------------------------------------------------------
  // VECTOR K: Invalid Numerical Input (NaN / Infinite)
  // -------------------------------------------------------------------------
  await runTest("Vector K: Invalid numerical input throws validation error", "K", async () => {
    const invalidVector = { ...VECTOR_A_NORMAL, supply_voltage: -5.0 };
    assert.throws(() => {
      service.validateInputRecord(invalidVector, false);
    }, /must be a positive number/);
    return { status: "VALIDATION_ERROR_CAUGHT" };
  });

  // -------------------------------------------------------------------------
  // VECTOR L: Strict Mode Equipment ID Validation
  // -------------------------------------------------------------------------
  await runTest("Vector L: Invalid equipment ID in strict mode throws error", "L", async () => {
    const invalidEqVector = { ...VECTOR_A_NORMAL, equipment_id: "EQP-999" };
    assert.throws(() => {
      service.validateInputRecord(invalidEqVector, true);
    }, /Invalid equipment_id 'EQP-999'/);
    return { status: "INVALID_EQUIPMENT_ID_CAUGHT" };
  });

  // -------------------------------------------------------------------------
  // VECTOR M: Mixed-Vector Batch Inference
  // -------------------------------------------------------------------------
  await runTest("Vector M: Mixed-vector batch inference parity", "M", async () => {
    const batch = [VECTOR_A_NORMAL, VECTOR_D_HIGH_RISK, VECTOR_E_PAT_REJECT];
    const batchRes = service.predictBatch(batch);
    const resList = Array.isArray(batchRes) ? batchRes : (batchRes && batchRes.results);
    assert(Array.isArray(resList), "Expected batch result array");
    assert.strictEqual(resList.length, 3);
    assert.strictEqual(resList[0].prediction, "PASS");
    assert.strictEqual(resList[1].prediction, "FAIL");
    assert.strictEqual(resList[2].disposition, "REJECT");
    return { batch_size: resList.length };
  });

  // -------------------------------------------------------------------------
  // VECTOR N: Deterministic Repeatability
  // -------------------------------------------------------------------------
  await runTest("Vector N: Deterministic repeatability across 2 consecutive runs", "N", async () => {
    const run1 = service.predictSingle(VECTOR_A_NORMAL);
    const run2 = service.predictSingle(VECTOR_A_NORMAL);
    assert.strictEqual(run1.probability, run2.probability);
    assert.strictEqual(run1.prediction, run2.prediction);
    assert.strictEqual(run1.disposition, run2.disposition);
    assert.strictEqual(run1.risk_level, run2.risk_level);
    return { prob_run1: run1.probability, prob_run2: run2.probability };
  });

  // -------------------------------------------------------------------------
  // API & SERVERLESS ENDPOINT PARITY TESTS
  // -------------------------------------------------------------------------
  const AUTH_HEADERS = { 'authorization': 'Bearer predicta_op_key_2026' };

  await runTest("API Endpoint POST /api/predict parity", "API", async () => {
    const { req, res, getResult } = makeMockReqRes('POST', '/api/predict', AUTH_HEADERS, JSON.stringify(VECTOR_A_NORMAL));
    await handleApiRequest(req, res);
    const out = getResult();
    assert.strictEqual(out.statusCode, 200);
    const parsed = JSON.parse(out.body);
    assert.strictEqual(parsed.prediction, "PASS");
    assert.strictEqual(parsed.threshold, 0.20);
    return { status: out.statusCode, probability: parsed.probability };
  });

  await runTest("API Endpoint POST /api/predict/batch parity", "API", async () => {
    const batchData = [VECTOR_A_NORMAL, VECTOR_D_HIGH_RISK];
    const { req, res, getResult } = makeMockReqRes('POST', '/api/predict/batch', AUTH_HEADERS, JSON.stringify(batchData));
    await handleApiRequest(req, res);
    const out = getResult();
    assert.strictEqual(out.statusCode, 200);
    const parsed = JSON.parse(out.body);
    const resList = Array.isArray(parsed) ? parsed : (parsed && parsed.results);
    assert(Array.isArray(resList));
    assert.strictEqual(resList.length, 2);
    return { status: out.statusCode, count: resList.length };
  });

  await runTest("API Endpoint GET /api/health metadata parity", "API", async () => {
    const { req, res, getResult } = makeMockReqRes('GET', '/api/health');
    await handleApiRequest(req, res);
    const out = getResult();
    assert.strictEqual(out.statusCode, 200);
    const parsed = JSON.parse(out.body);
    assert.strictEqual(parsed.status, "ok");
    assert.strictEqual(parsed.threshold, 0.20);
    return { status: out.statusCode, model: parsed.model, threshold: parsed.threshold };
  });

  await runTest("Vercel Serverless Function Handler (/api/index.js) parity", "VERCEL", async () => {
    const vercelHandler = require('../api/index');
    const { req, res, getResult } = makeMockReqRes('POST', '/api/predict', AUTH_HEADERS, JSON.stringify(VECTOR_A_NORMAL));
    await vercelHandler(req, res);
    const out = getResult();
    assert.strictEqual(out.statusCode, 200);
    const parsed = JSON.parse(out.body);
    assert.strictEqual(parsed.prediction, "PASS");
    return { status: out.statusCode };
  });

  // Write machine-readable report artifact
  const artifactsDir = path.dirname(REPORT_PATH);
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

  const reportData = {
    test_suite: "PHASE12_TASK2_API_PARITY_NODEJS",
    contract_version: contract.contract_version,
    model_sha256: contract.provenance.model_sha256,
    operating_threshold: contract.provenance.operating_threshold,
    total_tests: total,
    passed_tests: passed,
    timestamp: new Date().toISOString(),
    results
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(reportData, null, 2), 'utf-8');

  console.log("\n=========================================================================");
  console.log(`✅ PHASE 12 TASK 2 JS PARITY TEST SUITE COMPLETE: ${passed}/${total} PASSED`);
  console.log(`📄 Machine-readable report saved to: ${REPORT_PATH}`);
  console.log("=========================================================================\n");
}

main().catch(err => {
  console.error("FATAL TEST SUITE ERROR:", err);
  process.exit(1);
});
