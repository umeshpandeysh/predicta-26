/**
 * PREDICTA-26 Phase 17.3 — Governance Stress & Adversarial Validation Suite (Node.js)
 * File: tests/test_phase17_adversarial_governance.js
 *
 * Attacks the Phase 17.1 + Phase 17.2 implementation across all attack classes
 * via direct Node.js runtime and live HTTP backend endpoint stress testing.
 */

const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const server = require('../src/api/server');
const taxonomy = require('../src/governance/taxonomy_mapping');
const disposition = require('../src/governance/disposition');

const PORT = 8899;
let serverInstance = null;

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PROD_MODEL_PATH = path.join(PROJECT_ROOT, 'ml/models/production/predicta_xgboost_model.json');
const PROD_DATASET_PATH = path.join(PROJECT_ROOT, 'ml/data/synthetic/predicta_dataset_v3_50000.csv');
const CANONICAL_DATA_PATH = path.join(PROJECT_ROOT, 'src/governance/canonical_demo_data.json');

const EXPECTED_MODEL_SHA = '91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98';
const EXPECTED_DATASET_SHA = '48e718643b6fe99bc410421f5b48715c294f1c4c2edabf10870935afdb820a06';

const { createJwtToken } = require('../src/api/auth');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'predicta_secret_key_fixed_for_test_at_least_32_bytes_long!!';
const validToken = createJwtToken({ sub: "OPERATOR_01", role: "OPERATOR" }, process.env.JWT_SECRET);
const authHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${validToken}`
};

function computeSha256(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function makeHttpRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request({ port: PORT, host: '127.0.0.1', ...options }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (e) { json = { raw: body }; }
        resolve({ statusCode: res.statusCode, headers: res.headers, body: json });
      });
    });
    req.on('error', err => reject(err));
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runAdversarialGovernanceSuite() {
  console.log('========================================================================');
  console.log('PREDICTA-26 PHASE 17.3 — ADVERSARIAL GOVERNANCE VALIDATION SUITE');
  console.log('========================================================================\n');

  // Start HTTP server on test port
  serverInstance = server.listen(PORT);

  try {
    // -------------------------------------------------------------------------
    // 0. AUTHENTICATION & AUTHORIZATION ENFORCEMENT
    // -------------------------------------------------------------------------
    console.log('TEST 0: Direct HTTP request without authorization token returns 401...');
    const resNoAuth = await makeHttpRequest({
      method: 'POST',
      path: '/api/dispositions',
      headers: { 'Content-Type': 'application/json' }
    }, { trace_id: 'TRACE-TEST', disposition: 'ACCEPT', reason_code: 'OTHER' });
    assert.strictEqual(resNoAuth.statusCode, 401);
    console.log('  ✓ Attack 0 Passed: Unauthenticated request rejected with 401 Unauthorized');

    // -------------------------------------------------------------------------
    // 1. ATTACK CLASS A & F: DIRECT HTTP POST ML OUTPUT MUTATION & FRONTEND BYPASS
    // -------------------------------------------------------------------------
    console.log('TEST 1: Direct HTTP attack with client-supplied ML fields (Frontend Bypass)...');
    const attackMlPayload = {
      trace_id: 'TRACE-ADV-HTTP-001',
      disposition: 'ACCEPT',
      reason_code: 'FALSE_POSITIVE_SUSPECTED',
      ml_decision: 'PASS',
      probability: 0.001,
      anomaly_score: 0.05
    };
    const resA = await makeHttpRequest({
      method: 'POST',
      path: '/api/dispositions',
      headers: authHeaders
    }, attackMlPayload);

    assert.strictEqual(resA.statusCode, 400);
    assert(resA.body.detail.includes('CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED'));
    console.log('  ✓ Attack 1 Passed: Client-supplied ML output rejected at HTTP boundary (400)');

    // -------------------------------------------------------------------------
    // 2. ATTACK CLASS F: DIRECT HTTP POST CLIENT-CONTROLLED IDENTITY
    // -------------------------------------------------------------------------
    console.log('TEST 2: Direct HTTP attack with client-supplied component identity...');
    const attackIdPayload = {
      trace_id: 'TRACE-ADV-HTTP-002',
      disposition: 'ACCEPT',
      reason_code: 'FALSE_POSITIVE_SUSPECTED',
      component_id: 'COMP-SPOOFED-999'
    };
    const resId = await makeHttpRequest({
      method: 'POST',
      path: '/api/dispositions',
      headers: authHeaders
    }, attackIdPayload);

    assert.strictEqual(resId.statusCode, 400);
    assert(resId.body.detail.includes('CLIENT_CONTROLLED_IDENTITY_PROHIBITED'));
    console.log('  ✓ Attack 2 Passed: Client-controlled component identity rejected (400)');

    // -------------------------------------------------------------------------
    // 3. ATTACK CLASS D: DIRECT HTTP POST INVALID DISPOSITION
    // -------------------------------------------------------------------------
    console.log('TEST 3: Direct HTTP attack with invalid disposition enum...');
    const attackDispPayload = {
      trace_id: 'TRACE-ADV-HTTP-003',
      disposition: 'ARBITRARY_OVERRIDE',
      reason_code: 'FALSE_POSITIVE_SUSPECTED'
    };
    const resDisp = await makeHttpRequest({
      method: 'POST',
      path: '/api/dispositions',
      headers: authHeaders
    }, attackDispPayload);

    assert.strictEqual(resDisp.statusCode, 400);
    assert(resDisp.body.detail.includes('INVALID_DISPOSITION'));
    console.log('  ✓ Attack 3 Passed: Invalid disposition rejected fail-closed (400)');

    // -------------------------------------------------------------------------
    // 4. ATTACK CLASS E: DIRECT HTTP POST MISSING REASON CODE
    // -------------------------------------------------------------------------
    console.log('TEST 4: Direct HTTP attack with missing reason code...');
    const attackReasonPayload = {
      trace_id: 'TRACE-ADV-HTTP-004',
      disposition: 'ACCEPT',
      reason_code: ''
    };
    const resReason = await makeHttpRequest({
      method: 'POST',
      path: '/api/dispositions',
      headers: authHeaders
    }, attackReasonPayload);

    assert.strictEqual(resReason.statusCode, 400);
    assert(resReason.body.detail.includes('INVALID_REASON_CODE'));
    console.log('  ✓ Attack 4 Passed: Missing/empty reason code rejected (400)');

    // -------------------------------------------------------------------------
    // 5. ATTACK CLASS F: DIRECT HTTP POST NON-EXISTENT TRACE ID
    // -------------------------------------------------------------------------
    console.log('TEST 5: Direct HTTP attack with unregistered trace ID...');
    const attackUnregisteredPayload = {
      trace_id: 'TRACE-DOES-NOT-EXIST-999',
      disposition: 'ACCEPT',
      reason_code: 'FALSE_POSITIVE_SUSPECTED'
    };
    const resUnreg = await makeHttpRequest({
      method: 'POST',
      path: '/api/dispositions',
      headers: authHeaders
    }, attackUnregisteredPayload);

    assert.strictEqual(resUnreg.statusCode, 404);
    assert(resUnreg.body.detail.includes('AUTHORITATIVE_ML_RECORD_NOT_FOUND'));
    console.log('  ✓ Attack 5 Passed: Unregistered trace disposition rejected (404)');

    // -------------------------------------------------------------------------
    // 6. ATTACK CLASS J: DIRECT HTTP GET MALFORMED/TRAVERSAL CASE ID
    // -------------------------------------------------------------------------
    console.log('TEST 6: Direct HTTP attack with malformed/traversal case ID...');
    const resCase404 = await makeHttpRequest({
      method: 'GET',
      path: '/api/decision-center/cases/MALICIOUS_CASE_NAME'
    });
    assert.strictEqual(resCase404.statusCode, 404);
    assert(resCase404.body.detail.includes('Canonical case'));
    console.log('  ✓ Attack 6 Passed: Non-canonical case ID safely returns 404');

    // -------------------------------------------------------------------------
    // 7. ATTACK CLASS D & E: NODE TAXONOMY STRICT MATCHING (NO CASE COERCION)
    // -------------------------------------------------------------------------
    console.log('TEST 7: Taxonomy mapping rejects case variants and arbitrary strings...');
    const invalidUiActions = ['pass', 'monitor', 'APPROVE', 'FAIL', 'HOLD', 'ESCALATE', '', null];
    for (const action of invalidUiActions) {
      assert.throws(() => {
        taxonomy.mapUiToBackendDisposition(action);
      }, /INVALID_UI_ACTION/);
    }

    const invalidReasons = ['', '   ', null, 'INVALID_REASON', 123];
    for (const r of invalidReasons) {
      assert.throws(() => {
        taxonomy.validateGovernedAction('PASS', r);
      });
    }
    console.log('  ✓ Attack 7 Passed: UI actions & reasons strictly checked without silent coercion');

    // -------------------------------------------------------------------------
    // 8. ATTACK CLASS E: COMMENT OVERSIZED BOUNDARY
    // -------------------------------------------------------------------------
    console.log('TEST 8: Comment boundary enforcement (max 1000 characters)...');
    const validComment = 'B'.repeat(1000);
    const validRes = taxonomy.validateGovernedAction('PASS', 'MANUAL_ENGINEERING_REVIEW', validComment);
    assert.strictEqual(validRes.is_valid, true);
    assert.strictEqual(validRes.comment.length, 1000);

    const oversizedComment = 'B'.repeat(1001);
    assert.throws(() => {
      taxonomy.validateGovernedAction('PASS', 'MANUAL_ENGINEERING_REVIEW', oversizedComment);
    }, /COMMENT_TOO_LONG/);
    console.log('  ✓ Attack 8 Passed: 1000 char boundary preserved, 1001 chars rejected');

    // -------------------------------------------------------------------------
    // 9. ATTACK CLASS G: FAIL-CLOSED MISSING EVIDENCE
    // -------------------------------------------------------------------------
    console.log('TEST 9: Missing evidence formatting fails closed...');
    const emptyLayers = taxonomy.formatEvidenceExplainerLayers({});
    for (const [k, layer] of Object.entries(emptyLayers)) {
      assert.strictEqual(layer.status, 'INSUFFICIENT EVIDENCE', `Layer ${k} did not fail closed!`);
    }
    assert.strictEqual(emptyLayers.prognostic_forecast_168h.lead_time_basis, '168H_EVALUATION_HORIZON_NOT_FAILURE_TIME');
    console.log('  ✓ Attack 9 Passed: All missing evidence categories format to INSUFFICIENT EVIDENCE');

    // -------------------------------------------------------------------------
    // 10. ATTACK CLASS H: ESCALATE SEMANTIC PRESERVATION
    // -------------------------------------------------------------------------
    console.log('TEST 10: ESCALATE carries explicit escalation indicator...');
    const escRes = taxonomy.mapBackendToUiDisposition('ESCALATE');
    const holdRes = taxonomy.mapBackendToUiDisposition('HOLD');

    assert.strictEqual(escRes.ui_action, 'MONITOR');
    assert.strictEqual(holdRes.ui_action, 'MONITOR');
    assert.strictEqual(escRes.escalation_flag, true);
    assert.strictEqual(holdRes.escalation_flag, false);
    assert.strictEqual(escRes.escalation_indicator, 'ESCALATED_TO_QUALITY_ENGINEERING');
    console.log('  ✓ Attack 10 Passed: ESCALATE preserves explicit escalation indicator');

    // -------------------------------------------------------------------------
    // 11. ATTACK CLASS B, C, L, M: PROTECTED ARTIFACTS AND THRESHOLD INTEGRITY
    // -------------------------------------------------------------------------
    console.log('TEST 11: Protected artifacts cryptographic hashes & threshold...');
    assert.strictEqual(taxonomy.OPERATING_THRESHOLD, 0.20);

    const actualModelSha = computeSha256(PROD_MODEL_PATH);
    assert.strictEqual(actualModelSha, EXPECTED_MODEL_SHA);

    const actualDatasetSha = computeSha256(PROD_DATASET_PATH);
    assert.strictEqual(actualDatasetSha, EXPECTED_DATASET_SHA);

    const canonData = JSON.parse(fs.readFileSync(CANONICAL_DATA_PATH, 'utf8'));
    assert.strictEqual(canonData.lead_time_basis, '168H_EVALUATION_HORIZON_NOT_FAILURE_TIME');
    assert.strictEqual(canonData.provenance, 'PHASE_16_CANONICAL_PROVENANCE');

    const canonText = fs.readFileSync(CANONICAL_DATA_PATH, 'utf8');
    assert.strictEqual(canonText.match(/shap/gi), null);
    console.log('  ✓ Attack 11 Passed: Model SHA, Dataset SHA, Threshold, and Provenance intact');

    console.log('\n========================================================================');
    console.log('🏆 ALL PHASE 17.3 ADVERSARIAL GOVERNANCE TESTS PASSED CLEANLY! ✅');
    console.log('========================================================================\n');
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
  }
}

runAdversarialGovernanceSuite().catch(err => {
  console.error('Adversarial validation failure:', err);
  if (serverInstance) serverInstance.close();
  process.exit(1);
});
