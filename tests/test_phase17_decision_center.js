/**
 * PREDICTA-26 Phase 17.1 — Governed Decision Center Test Suite (Node.js)
 * File: tests/test_phase17_decision_center.js
 *
 * Verifies Node.js cross-runtime parity for Phase 17.1:
 * - 4 UI Actions exist (PASS, MONITOR, RETEST, REJECT)
 * - Explicit bidirectional mapping to backend governance
 * - ESCALATE -> MONITOR with explicit escalation indicator (loss protection)
 * - Immutability of ML decisions and probabilities
 * - Fail-closed missing evidence formatting (INSUFFICIENT EVIDENCE)
 * - Protected threshold theta* = 0.20
 * - Protected model SHA and dataset SHA verification
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const taxonomy = require('../src/governance/taxonomy_mapping');
const disposition = require('../src/governance/disposition');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PROD_MODEL_PATH = path.join(PROJECT_ROOT, 'ml/models/production/predicta_xgboost_model.json');
const PROD_DATASET_PATH = path.join(PROJECT_ROOT, 'ml/data/synthetic/predicta_dataset_v3_50000.csv');

const EXPECTED_MODEL_SHA = '91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98';
const EXPECTED_DATASET_SHA = '48e718643b6fe99bc410421f5b48715c294f1c4c2edabf10870935afdb820a06';

function computeSha256(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

console.log('--- RUNNING PHASE 17.1 NODE.JS GOVERNED DECISION CENTER SUITE ---');

// Test 1: Four UI disposition actions exist
console.log('Test 1: Four UI disposition actions exist...');
assert.strictEqual(taxonomy.UI_ACTION_TAXONOMY.length, 4);
assert.deepStrictEqual(taxonomy.UI_ACTION_TAXONOMY, ['PASS', 'MONITOR', 'RETEST', 'REJECT']);
console.log('  ✓ Test 1 Passed: Exactly 4 UI actions exist (PASS, MONITOR, RETEST, REJECT)');

// Test 2: Bidirectional mapping with escalation indicator preservation
console.log('Test 2: Bidirectional mapping & ESCALATE indicator preservation...');
assert.strictEqual(taxonomy.mapUiToBackendDisposition('PASS'), 'ACCEPT');
assert.strictEqual(taxonomy.mapUiToBackendDisposition('MONITOR'), 'HOLD');
assert.strictEqual(taxonomy.mapUiToBackendDisposition('RETEST'), 'RETEST');
assert.strictEqual(taxonomy.mapUiToBackendDisposition('REJECT'), 'REJECT');

const escalateRes = taxonomy.mapBackendToUiDisposition('ESCALATE');
assert.strictEqual(escalateRes.ui_action, 'MONITOR');
assert.strictEqual(escalateRes.escalation_flag, true);
assert.strictEqual(escalateRes.escalation_indicator, 'ESCALATED_TO_QUALITY_ENGINEERING');

const holdRes = taxonomy.mapBackendToUiDisposition('HOLD');
assert.strictEqual(holdRes.ui_action, 'MONITOR');
assert.strictEqual(holdRes.escalation_flag, false);
console.log('  ✓ Test 2 Passed: Bidirectional mapping verified with loss-protected ESCALATE indicator');

// Test 3: Controlled reason code validation
console.log('Test 3: Controlled reason code validation...');
assert.throws(() => {
  taxonomy.validateGovernedAction('PASS', '');
}, /REASON_CODE_REQUIRED/);

assert.throws(() => {
  taxonomy.validateGovernedAction('PASS', 'INVALID_REASON');
}, /INVALID_REASON_CODE/);

const validAction = taxonomy.validateGovernedAction('RETEST', 'RETEST_REQUIRED', 'Test note');
assert.strictEqual(validAction.is_valid, true);
assert.strictEqual(validAction.backend_disposition, 'RETEST');
console.log('  ✓ Test 3 Passed: Controlled reasons strictly enforced');

// Test 4: Fail-closed evidence formatting
console.log('Test 4: Fail-closed missing evidence formatting...');
const emptyLayers = taxonomy.formatEvidenceExplainerLayers({});
assert.strictEqual(emptyLayers.lot_deviation.status, 'INSUFFICIENT EVIDENCE');
assert.strictEqual(emptyLayers.trajectory_drift.status, 'INSUFFICIENT EVIDENCE');
assert.strictEqual(emptyLayers.prognostic_forecast_168h.status, 'INSUFFICIENT EVIDENCE');
assert.strictEqual(emptyLayers.uncertainty_envelope.status, 'INSUFFICIENT EVIDENCE');
assert.strictEqual(emptyLayers.physics_consistency.status, 'INSUFFICIENT EVIDENCE');
assert.strictEqual(emptyLayers.risk_contribution.status, 'INSUFFICIENT EVIDENCE');
assert.strictEqual(emptyLayers.prognostic_forecast_168h.lead_time_basis, '168H_EVALUATION_HORIZON_NOT_FAILURE_TIME');
console.log('  ✓ Test 4 Passed: Missing evidence evaluated to INSUFFICIENT EVIDENCE fail-closed');

// Test 5: Operational recommendation synthesis respects 0.20 threshold
console.log('Test 5: Operational recommendation synthesis...');
assert.strictEqual(taxonomy.deriveOperationalRecommendation('PASS', 0.05), 'PASS');
assert.strictEqual(taxonomy.deriveOperationalRecommendation('PASS', 0.12), 'MONITOR');
assert.strictEqual(taxonomy.deriveOperationalRecommendation('PASS', 0.20), 'REJECT');
assert.strictEqual(taxonomy.deriveOperationalRecommendation('FAIL', 0.05), 'REJECT');
console.log('  ✓ Test 5 Passed: Operational recommendations respect locked 0.20 threshold');

// Test 6: Immutability under HumanDispositionManagerJS
(async () => {
  console.log('Test 6: ML prediction immutability under disposition...');
  const mgr = new disposition.HumanDispositionManagerJS();
  const testTraceId = 'TRACE-JS-P17-001';
  disposition.registerAuthoritativePrediction({
    trace_id: testTraceId,
    component_id: 'COMP-JS-1701',
    lot_id: 'LOT-JS-17A',
    prediction: 'FAIL',
    probability: 0.775
  });

  const dispRecord = await mgr.recordDispositionAsync({
    trace_id: testTraceId,
    disposition: 'ACCEPT',
    reason_code: 'FALSE_POSITIVE_SUSPECTED',
    comment: 'Physical bench test passed.',
    require_durable_persistence: false
  });

  assert.strictEqual(dispRecord.original_ml_decision, 'FAIL');
  assert.strictEqual(dispRecord.original_ml_probability, 0.775);
  assert.strictEqual(dispRecord.disposition, 'ACCEPT');

  const authPred = mgr.lookupAuthoritativePrediction(testTraceId);
  assert.strictEqual(authPred.prediction, 'FAIL');
  assert.strictEqual(authPred.probability, 0.775);
  console.log('  ✓ Test 6 Passed: ML prediction and probability remain strictly immutable');

  // Test 7: Protected artifact SHA-256 integrity
  console.log('Test 7: Protected artifact cryptographic verification...');
  const actualModelSha = computeSha256(PROD_MODEL_PATH);
  assert.strictEqual(actualModelSha, EXPECTED_MODEL_SHA, `Model SHA mismatch: ${actualModelSha}`);

  const actualDatasetSha = computeSha256(PROD_DATASET_PATH);
  assert.strictEqual(actualDatasetSha, EXPECTED_DATASET_SHA, `Dataset SHA mismatch: ${actualDatasetSha}`);
  console.log('  ✓ Test 7 Passed: Protected Model & Dataset hashes 100% verified');

  console.log('================================================================================');
  console.log('🏆 ALL PHASE 17.1 NODE.JS DECISION CENTER & TAXONOMY TESTS PASSED! ✅');
  console.log('================================================================================');
})().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

