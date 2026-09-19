/**
 * Predicta Semiconductor Intelligence Platform — Authoritative Stage 5 Prognostic Parity & Regression Suite (Node.js)
 * File: tests/test_prognostic_trajectory.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const {
  TrajectoryState,
  CANONICAL_EARLY_FEATURES,
  CANONICAL_FUTURE_FIELDS,
  FORBIDDEN_LEAKAGE_TOKENS,
  loadAuthoritativePrognosticContract,
  getAuthoritativeSpecLimits,
  validateEarlyFeatureInput,
  evaluateAcceptanceAtHour,
  evaluateTrajectoryState,
  extractPrognosticRecord,
  splitPrognosticDataset,
  calculatePrognosticMetrics
} = require('../src/prognostics/trajectory');

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'prognostic_trajectory_parity.json');
const CONTRACT_PATH = path.join(__dirname, '..', 'ml', 'prognostics', 'prognostic_contract.json');

console.log('=========================================================================');
console.log('PREDICTA SIH 2026 — AUTHORITATIVE PROGNOSTIC TRAJECTORY PARITY SUITE');
console.log('=========================================================================\n');

function runTests() {
  let passedCount = 0;
  const totalTests = 12;

  // Test 1: Prognostic Contract Schema & Immutability
  console.log('TEST 01: Verifying Authoritative Prognostic Contract...');
  assert(fs.existsSync(CONTRACT_PATH), 'Prognostic contract file missing');
  const contract = loadAuthoritativePrognosticContract(CONTRACT_PATH);
  assert.strictEqual(contract.contract_version, '1.0.0');
  assert.strictEqual(contract.authority_level, 'AUTHORITATIVE_PROGNOSTIC_CONTRACT');
  assert.strictEqual(contract.production_and_model_governance.prognostic_model_status, 'BENCHMARK_ONLY');
  assert.strictEqual(contract.production_and_model_governance.production_promotion_permitted, false);

  const limits = getAuthoritativeSpecLimits(CONTRACT_PATH);
  assert.strictEqual(limits.iddq, 5000.0);
  assert.strictEqual(limits.ileak, 500.0);
  assert.strictEqual(limits.tpd, 250.0);
  console.log('  ✓ [PASS] Test 01: Prognostic Contract schema and promotion lock verified!');
  passedCount++;

  // Test 2: Fixture Loading
  console.log('TEST 02: Loading Cross-Runtime Parity Fixture...');
  assert(fs.existsSync(FIXTURE_PATH), 'Parity fixture missing');
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
  console.log('  ✓ [PASS] Test 02: Parity fixture parsed successfully!');
  passedCount++;

  // Test 3: Nominal Healthy Trajectory (Case A)
  console.log('TEST 03: Evaluating Case A (Nominal Healthy Component)...');
  const ca = fixture.cases.case_a_nominal_healthy;
  const resA = evaluateTrajectoryState(ca.row_24h, ca.row_168h);
  assert.strictEqual(resA.state_24h, ca.expected.state_24h);
  assert.strictEqual(resA.state_168h, ca.expected.state_168h);
  assert.strictEqual(resA.latent_168h_failure, ca.expected.latent_168h_failure);
  assert.strictEqual(resA.trajectory_state, ca.expected.trajectory_state);
  console.log('  ✓ [PASS] Test 03: Case A state matches fixture 100%!');
  passedCount++;

  // Test 4: True Latent Failure (Case B)
  console.log('TEST 04: Evaluating Case B (True Latent 168h Failure)...');
  const cb = fixture.cases.case_b_true_latent_failure;
  const resB = evaluateTrajectoryState(cb.row_24h, cb.row_168h);
  assert.strictEqual(resB.state_24h, cb.expected.state_24h);
  assert.strictEqual(resB.state_168h, cb.expected.state_168h);
  assert.strictEqual(resB.latent_168h_failure, cb.expected.latent_168h_failure);
  assert.strictEqual(resB.trajectory_state, cb.expected.trajectory_state);
  console.log('  ✓ [PASS] Test 04: Case B true latent defect detected cleanly!');
  passedCount++;

  // Test 5: Early Failure & Anomaly Recovery (Cases C & D)
  console.log('TEST 05: Evaluating Cases C & D (Early Failure & Recovery)...');
  const cc = fixture.cases.case_c_early_failure;
  const resC = evaluateTrajectoryState(cc.row_24h, cc.row_168h);
  assert.strictEqual(resC.trajectory_state, cc.expected.trajectory_state);
  assert.strictEqual(resC.latent_168h_failure, false);

  const cd = fixture.cases.case_d_early_fail_recovery;
  const resD = evaluateTrajectoryState(cd.row_24h, cd.row_168h);
  assert.strictEqual(resD.trajectory_state, cd.expected.trajectory_state);
  assert.strictEqual(resD.latent_168h_failure, false);
  console.log('  ✓ [PASS] Test 05: Non-latent early failures and recoveries handled correctly!');
  passedCount++;

  // Test 6: Insufficient History (Cases E & F)
  console.log('TEST 06: Evaluating Cases E & F (Insufficient History)...');
  const ce = fixture.cases.case_e_missing_24h;
  const resE = evaluateTrajectoryState(ce.row_24h, ce.row_168h);
  assert.strictEqual(resE.trajectory_state, TrajectoryState.INSUFFICIENT_HISTORY);
  assert.strictEqual(resE.latent_168h_failure, null);

  const cf = fixture.cases.case_f_missing_168h;
  const resF = evaluateTrajectoryState(cf.row_24h, cf.row_168h);
  assert.strictEqual(resF.trajectory_state, TrajectoryState.INSUFFICIENT_HISTORY);
  assert.strictEqual(resF.latent_168h_failure, null);
  console.log('  ✓ [PASS] Test 06: Incomplete history yields INSUFFICIENT_HISTORY!');
  passedCount++;

  // Test 7: Early Feature Extraction Parity (Case G)
  console.log('TEST 07: Evaluating Case G (Early Feature Extraction)...');
  const cg = fixture.cases.case_g_early_feature_extraction;
  const recG = extractPrognosticRecord(cg.row_0h, cg.row_24h, cg.row_168h, 'COMP-0007');
  const expEf = cg.expected_early_features;
  for (const [k, v] of Object.entries(expEf)) {
    const diff = Math.abs(recG.early_features[k] - v);
    assert(diff <= 1e-6, `Feature ${k} diff ${diff} exceeds 1e-6`);
  }
  console.log('  ✓ [PASS] Test 07: Early feature extraction parity <= 1e-6 verified!');
  passedCount++;

  // Test 8: Metrics Calculation Parity (Case H)
  console.log('TEST 08: Evaluating Case H (Standardized Metrics Calculation)...');
  const ch = fixture.cases.case_h_metrics_calculation;
  const mCalc = calculatePrognosticMetrics(ch.y_true, ch.y_pred_prob, ch.threshold);
  const expM = ch.expected_metrics;

  assert.deepStrictEqual(mCalc.support, expM.support);
  assert.deepStrictEqual(mCalc.confusion_matrix, expM.confusion_matrix);
  assert(Math.abs(mCalc.latent_recall - expM.latent_recall) <= 1e-6);
  assert(Math.abs(mCalc.latent_false_negative_rate - expM.latent_false_negative_rate) <= 1e-6);
  assert(Math.abs(mCalc.latent_precision - expM.latent_precision) <= 1e-6);
  assert(Math.abs(mCalc.latent_f1_score - expM.latent_f1_score) <= 1e-6);
  assert(Math.abs(mCalc.latent_f2_score - expM.latent_f2_score) <= 1e-6);
  assert(Math.abs(mCalc.specificity - expM.specificity) <= 1e-6);
  console.log('  ✓ [PASS] Test 08: Metrics calculation parity <= 1e-6 confirmed!');
  passedCount++;

  // Test 9: Strict Temporal Leakage Rejection
  console.log('TEST 09: Testing Strict Temporal Leakage Defense...');
  const validFeatures = {
    iddq_0h: 2000.0, ileak_0h: 250.0, tpd_0h: 190.0,
    iddq_24h: 2100.0, ileak_24h: 260.0, tpd_24h: 195.0,
    iddq_drift_24h: 100.0, ileak_drift_24h: 10.0, tpd_drift_24h: 5.0
  };

  const validArr = validateEarlyFeatureInput(validFeatures);
  assert.strictEqual(validArr.length, 9);

  let caughtLeakage = false;
  try {
    validateEarlyFeatureInput({ ...validFeatures, tpd_168h: 250.0 });
  } catch (e) {
    caughtLeakage = e.message.includes('TEMPORAL_LEAKAGE_DETECTED') || e.message.includes('EXTRA_FEATURE_DETECTED');
  }
  assert(caughtLeakage, 'Validator failed to reject 168h feature injection');
  console.log('  ✓ [PASS] Test 09: Temporal leakage injection rejected cleanly!');
  passedCount++;

  // Test 10: Schema Order Mismatch Rejection
  console.log('TEST 10: Testing Schema Order Mismatch Defense...');
  const reordered = {
    tpd_drift_24h: 5.0,
    iddq_0h: 2000.0, ileak_0h: 250.0, tpd_0h: 190.0,
    iddq_24h: 2100.0, ileak_24h: 260.0, tpd_24h: 195.0,
    iddq_drift_24h: 100.0, ileak_drift_24h: 10.0
  };

  let caughtOrder = false;
  try {
    validateEarlyFeatureInput(reordered);
  } catch (e) {
    caughtOrder = e.message.includes('SCHEMA_ORDER_MISMATCH');
  }
  assert(caughtOrder, 'Validator failed to reject reordered keys');
  console.log('  ✓ [PASS] Test 10: Reordered feature keys rejected cleanly!');
  passedCount++;

  // Test 11: Non-Numeric / NaN / Inf Rejection
  console.log('TEST 11: Testing Non-Numeric / NaN / Inf Defense...');
  let caughtNan = false;
  try {
    validateEarlyFeatureInput({ ...validFeatures, tpd_0h: NaN });
  } catch (e) {
    caughtNan = e.message.includes('NON_FINITE_VALUE');
  }
  assert(caughtNan, 'Validator failed to reject NaN');

  let caughtStr = false;
  try {
    validateEarlyFeatureInput({ ...validFeatures, iddq_0h: 'INVALID' });
  } catch (e) {
    caughtStr = e.message.includes('INVALID_NUMERIC_VALUE');
  }
  assert(caughtStr, 'Validator failed to reject string');
  console.log('  ✓ [PASS] Test 11: Non-numeric and non-finite inputs rejected cleanly!');
  passedCount++;

  // Test 12: Zero-Positive Metrics Safety
  console.log('TEST 12: Testing Zero-Positive Metrics Safety...');
  const mZeros = calculatePrognosticMetrics([0, 0, 0, 0], [0.1, 0.2, 0.3, 0.4], 0.5);
  assert.strictEqual(mZeros.latent_recall, 0.0);
  assert.strictEqual(mZeros.latent_false_negative_rate, 0.0);
  assert.strictEqual(mZeros.latent_precision, 0.0);
  assert(!isNaN(mZeros.latent_f1_score));
  assert(!isNaN(mZeros.latent_f2_score));
  console.log('  ✓ [PASS] Test 12: Zero-positive metrics computed safely without NaN!');
  passedCount++;

  // Test 13: Strict Split Completeness & Lot Governance
  console.log('TEST 13: Testing Strict Split Completeness & Lot Governance...');
  const SPLIT_MANIFEST_PATH = path.join(__dirname, '..', 'ml', 'data', 'split_manifest.json');
  assert(fs.existsSync(SPLIT_MANIFEST_PATH), 'Split manifest missing');

  const mockRecords = [
    { metadata: { component_id: 'COMP-01', lot_id: 'LOT-SYN-001' }, early_features: {}, future_ground_truth: {} },
    { metadata: { component_id: 'COMP-02', lot_id: 'LOT-SYN-036' }, early_features: {}, future_ground_truth: {} },
    { metadata: { component_id: 'COMP-03', lot_id: 'LOT-SYN-043' }, early_features: {}, future_ground_truth: {} }
  ];
  const splitRes = splitPrognosticDataset(mockRecords, SPLIT_MANIFEST_PATH);
  assert.strictEqual(splitRes.train.length, 1);
  assert.strictEqual(splitRes.validation_tune.length, 1);
  assert.strictEqual(splitRes.test.length, 1);
  assert.strictEqual(splitRes.calibration.length, 0);

  // Unknown lot rejection
  let caughtUnknownLot = false;
  try {
    splitPrognosticDataset([{ metadata: { component_id: 'COMP-BAD', lot_id: 'LOT-UNKNOWN-999' } }], SPLIT_MANIFEST_PATH);
  } catch (e) {
    caughtUnknownLot = e.message.includes('UNKNOWN_LOT_DETECTED');
  }
  assert(caughtUnknownLot, 'splitPrognosticDataset failed to reject unknown lot');

  // Duplicate component rejection
  let caughtDupComp = false;
  try {
    splitPrognosticDataset([mockRecords[0], mockRecords[0]], SPLIT_MANIFEST_PATH);
  } catch (e) {
    caughtDupComp = e.message.includes('DUPLICATE_COMPONENT_DETECTED');
  }
  assert(caughtDupComp, 'splitPrognosticDataset failed to reject duplicate component');
  console.log('  ✓ [PASS] Test 13: Split completeness and unknown/duplicate lot rejection verified!');
  passedCount++;

  // Test 14: Persistence Baseline Constant Zero Semantics
  console.log('TEST 14: Testing Persistence Baseline Constant-Zero Semantics...');
  const yTrueTest = [1, 1, 0, 0, 0];
  const yPredProbZeros = [0.0, 0.0, 0.0, 0.0, 0.0];
  const persMetrics = calculatePrognosticMetrics(yTrueTest, yPredProbZeros, 0.50);
  assert.strictEqual(persMetrics.latent_recall, 0.0);
  assert.strictEqual(persMetrics.latent_false_negative_rate, 1.0);
  assert.strictEqual(persMetrics.latent_precision, 0.0);
  assert.strictEqual(persMetrics.latent_f1_score, 0.0);
  assert.strictEqual(persMetrics.latent_f2_score, 0.0);
  assert.strictEqual(persMetrics.specificity, 1.0);
  assert.deepStrictEqual(persMetrics.confusion_matrix, { tn: 3, fp: 0, fn: 2, tp: 0 });
  console.log('  ✓ [PASS] Test 14: Persistence baseline constant-zero metrics verified!');
  passedCount++;

  console.log('\n=========================================================================');
  console.log(`🏆 ALL ${passedCount}/14 PROGNOSTIC PARITY TESTS PASSED 100%! ✅`);
  console.log('=========================================================================\n');
}

runTests();
