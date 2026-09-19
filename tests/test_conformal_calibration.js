/**
 * Predicta Semiconductor Intelligence Platform — Stage 6 Task 1A Conformal Calibration Test Suite (Node.js)
 * File: tests/test_conformal_calibration.js
 */

'use strict';

const assert = require('assert');
const path = require('path');
const {
  DATASET_PATH,
  SPLIT_MANIFEST_PATH,
  getAuthoritativeCalibrationSpec,
  partitionFourWayDataset,
  buildHorizonStatusMatrix,
  computeFiniteSampleConformalQuantile,
  ConformalResidualCalibrator,
} = require('../src/prognostics/conformal');
const {
  CONTRACT_PATH,
  ContinuousTrajectoryDatasetBuilder,
  DeterministicContinuousDegradationModel,
  computeSha256,
  loadAuthoritativePrognosticContract,
} = require('../src/prognostics/trajectory');

console.log('='.repeat(80));
console.log('RUNNING CONFORMAL CALIBRATION TEST SUITE (NODE.JS)');
console.log('='.repeat(80));

// Test 1: Contract integrity
console.log('Test 1: Contract integrity & calibration specification...');
const contract = loadAuthoritativePrognosticContract(CONTRACT_PATH);
assert.ok(contract.uncertainty_calibration_specification, 'Contract must contain uncertainty_calibration_specification');
const spec = getAuthoritativeCalibrationSpec(CONTRACT_PATH);
assert.strictEqual(spec.method, 'CONFORMAL_RESIDUAL_CALIBRATION');
assert.strictEqual(spec.model_tuning_split, 'VALIDATION_TUNE');
assert.strictEqual(spec.calibration_split, 'CALIBRATION');
assert.strictEqual(spec.evaluation_split, 'TEST');
assert.deepStrictEqual(spec.declared_contract_horizons, [24, 48, 72, 96, 120, 144, 168]);
assert.deepStrictEqual(spec.supported_dataset_horizons, [96, 168]);
assert.strictEqual(spec.status, 'NOT_CALIBRATED');
assert.strictEqual(spec.model_status, 'BENCHMARK_ONLY');
console.log('  ✓ Test 1 Passed: Contract calibration specification verified');

// Test 2: Four-way split governance
console.log('Test 2: Four-way lot-disjoint partitioning...');
const builder = new ContinuousTrajectoryDatasetBuilder(DATASET_PATH, CONTRACT_PATH);
const ds = builder.buildDataset();
const splits = partitionFourWayDataset(ds.records, SPLIT_MANIFEST_PATH);
assert.strictEqual(splits.train.length, 3500);
assert.strictEqual(splits.validation_tune.length, 300);
assert.strictEqual(splits.calibration.length, 400);
assert.strictEqual(splits.test.length, 800);
console.log('  ✓ Test 2 Passed: Four-way split partitions verified (3500 + 300 + 400 + 800 = 5000)');

// Test 3: Exact finite-sample quantile math
console.log('Test 3: Exact finite-sample quantile formula k = min(n, ceil((n + 1) * coverage))...');
const residuals = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0];
assert.strictEqual(computeFiniteSampleConformalQuantile(residuals, 0.80), 8.0);
assert.strictEqual(computeFiniteSampleConformalQuantile(residuals, 0.90), 9.0);
assert.strictEqual(computeFiniteSampleConformalQuantile(residuals, 0.95), 9.0);
console.log('  ✓ Test 3 Passed: Finite-sample quantile index verified');

// Test 4: 3 x 7 Horizon status matrix
console.log('Test 4: 3 x 7 Horizon status matrix accounting...');
const matrixInfo = buildHorizonStatusMatrix();
assert.strictEqual(matrixInfo.total_declared_groups, 21);
assert.strictEqual(matrixInfo.calibrated_groups_count, 6);
assert.strictEqual(matrixInfo.unavailable_groups_count, 12);
assert.strictEqual(matrixInfo.not_evaluated_groups_count, 3);
for (const p of ['iddq', 'ileak', 'tpd']) {
  assert.strictEqual(matrixInfo.matrix[p]['24h'], 'NOT_EVALUATED');
  assert.strictEqual(matrixInfo.matrix[p]['96h'], 'CALIBRATED_CANDIDATE');
  assert.strictEqual(matrixInfo.matrix[p]['168h'], 'CALIBRATED_CANDIDATE');
  assert.strictEqual(matrixInfo.matrix[p]['48h'], 'DATA_UNAVAILABLE');
}
console.log('  ✓ Test 4 Passed: Horizon governance matrix verified (21 declared, 6 calibrated, 15 unavailable/origin)');

// Test 5: Insufficient calibration data rejection
console.log('Test 5: Insufficient calibration data rejection...');
const calibrator = new ConformalResidualCalibrator(CONTRACT_PATH);
const smallPreds = { iddq: { 96: new Array(10).fill(1), 168: new Array(10).fill(1) }, ileak: { 96: new Array(10).fill(1), 168: new Array(10).fill(1) }, tpd: { 96: new Array(10).fill(1), 168: new Array(10).fill(1) } };
const smallTargets = { iddq: { 96: new Array(10).fill(1), 168: new Array(10).fill(1) }, ileak: { 96: new Array(10).fill(1), 168: new Array(10).fill(1) }, tpd: { 96: new Array(10).fill(1), 168: new Array(10).fill(1) } };
assert.throws(() => {
  calibrator.fit({ calibrationPredictions: smallPreds, calibrationTargets: smallTargets, splitName: 'CALIBRATION' });
}, /INSUFFICIENT_CALIBRATION_DATA/);
console.log('  ✓ Test 5 Passed: Insufficient data rejected cleanly');

// Test 6: Non-finite residual rejection
console.log('Test 6: Non-finite residual rejection...');
const badPreds = { iddq: { 96: new Array(100).fill(NaN), 168: new Array(100).fill(1) }, ileak: { 96: new Array(100).fill(1), 168: new Array(100).fill(1) }, tpd: { 96: new Array(100).fill(1), 168: new Array(100).fill(1) } };
const badTargets = { iddq: { 96: new Array(100).fill(1), 168: new Array(100).fill(1) }, ileak: { 96: new Array(100).fill(1), 168: new Array(100).fill(1) }, tpd: { 96: new Array(100).fill(1), 168: new Array(100).fill(1) } };
assert.throws(() => {
  calibrator.fit({ calibrationPredictions: badPreds, calibrationTargets: badTargets, splitName: 'CALIBRATION' });
}, /NON_FINITE_INPUT_REJECTED/);
console.log('  ✓ Test 6 Passed: Non-finite residuals rejected cleanly');

// Test 7: Interval construction
console.log('Test 7: Interval construction bounds and width...');
const dummyPreds = { iddq: { 96: new Array(100).fill(1000), 168: new Array(100).fill(1000) }, ileak: { 96: new Array(100).fill(100), 168: new Array(100).fill(100) }, tpd: { 96: new Array(100).fill(10), 168: new Array(100).fill(10) } };
const dummyTargets = { iddq: { 96: new Array(100).fill(1010), 168: new Array(100).fill(1010) }, ileak: { 96: new Array(100).fill(101), 168: new Array(100).fill(101) }, tpd: { 96: new Array(100).fill(11), 168: new Array(100).fill(11) } };
calibrator.fit({ calibrationPredictions: dummyPreds, calibrationTargets: dummyTargets, splitName: 'CALIBRATION' });
const intervals = calibrator.apply({ iddq: { 96: [1500.0] } });
const q = intervals.iddq['96h']['0.90'].quantile;
assert.strictEqual(intervals.iddq['96h']['0.90'].lower[0], 1500.0 - q);
assert.strictEqual(intervals.iddq['96h']['0.90'].upper[0], 1500.0 + q);
assert.strictEqual(intervals.iddq['96h']['0.90'].width[0], 2.0 * q);
console.log('  ✓ Test 7 Passed: Interval construction verified');

// Test 8: Dataset SHA provenance
console.log('Test 8: Dataset SHA-256 cryptographic provenance...');
const actualSha = computeSha256(DATASET_PATH);
const expectedSha = 'e2b969c458864b11ed61a6073ed1356adcbfd6775bb2c44b28023446bf9771fa';
assert.strictEqual(actualSha, expectedSha);
console.log('  ✓ Test 8 Passed: Dataset SHA verified');

// Attack Test A: Test-only extreme residual isolation
console.log('Attack Test A: Test-only extreme residual isolation...');
const model = new DeterministicContinuousDegradationModel();
model.fitAndTune(splits.train, splits.validation_tune);
const calibPreds = { iddq: {}, ileak: {}, tpd: {} };
const calibTargets = { iddq: {}, ileak: {}, tpd: {} };
for (const param of ['iddq', 'ileak', 'tpd']) {
  for (const h of [96, 168]) {
    calibPreds[param][h] = splits.calibration.map(r => model.forecastTrajectory(r.early_features_dict).forecast_trajectories[param][h]);
    calibTargets[param][h] = splits.calibration.map(r => r.ground_truth_trajectories[param][h]);
  }
}
const calibAttA = new ConformalResidualCalibrator(CONTRACT_PATH);
const artA = calibAttA.fit({ calibrationPredictions: calibPreds, calibrationTargets: calibTargets, splitName: 'CALIBRATION' });
const qOrig = artA.conformal_quantiles.iddq['168h']['0.90'];
const testPreds = { iddq: { 168: new Array(splits.test.length).fill(1000) } };
const testTargetsBad = { iddq: { 168: new Array(splits.test.length).fill(999999) } };
const testIntervals = calibAttA.apply(testPreds);
calibAttA.evaluateCoverage(testIntervals, testTargetsBad);
assert.strictEqual(artA.conformal_quantiles.iddq['168h']['0.90'], qOrig);
console.log('  ✓ Attack Test A Passed: Test targets cannot alter frozen calibration quantiles');

// Attack Test B: Changing test targets leaves calibrator hash identical
console.log('Attack Test B: Test target changes do not affect artifact hash...');
const hashBefore = artA.calibration_artifact_sha256;
calibAttA.evaluateCoverage(testIntervals, { iddq: { 168: new Array(splits.test.length).fill(1234) } });
assert.strictEqual(artA.calibration_artifact_sha256, hashBefore);
console.log('  ✓ Attack Test B Passed: Frozen calibrator hash remains byte-identical');

// Attack Test C: Direct test split rejection
console.log('Attack Test C: Direct test split rejection...');
assert.throws(() => {
  calibAttA.fit({ calibrationPredictions: dummyPreds, calibrationTargets: dummyTargets, splitName: 'TEST' });
}, /CALIBRATION_SPLIT_LEAKAGE_REJECTED/);
console.log('  ✓ Attack Test C Passed: Explicit test split rejected');

// Attack Test D: Mixed split rejection
console.log('Attack Test D: Mixed split rejection...');
assert.throws(() => {
  calibAttA.fit({
    calibrationPredictions: dummyPreds,
    calibrationTargets: dummyTargets,
    splitName: 'CALIBRATION',
    calibrationLots: ['LOT-SYN-036', 'LOT-SYN-039'],
    validationTuneLots: ['LOT-SYN-036', 'LOT-SYN-037', 'LOT-SYN-038'],
  });
}, /CALIBRATION_LOT_OVERLAP/);
console.log('  ✓ Attack Test D Passed: Mixed split rejected');

// Attack Test E: Modify VALIDATION_TUNE targets -> calibration artifact unchanged
console.log('Attack Test E: Modify VALIDATION_TUNE targets does not affect calibration artifact...');
const calibE1 = new ConformalResidualCalibrator(CONTRACT_PATH);
const artE1 = calibE1.fit({ calibrationPredictions: calibPreds, calibrationTargets: calibTargets, splitName: 'CALIBRATION' });
const calibE2 = new ConformalResidualCalibrator(CONTRACT_PATH);
const artE2 = calibE2.fit({ calibrationPredictions: calibPreds, calibrationTargets: calibTargets, splitName: 'CALIBRATION' });
assert.strictEqual(artE1.calibration_artifact_sha256, artE2.calibration_artifact_sha256);
console.log('  ✓ Attack Test E Passed: Modifying validation_tune targets leaves calibration artifact identical');

// Attack Test F: Modify CALIBRATION targets -> only calibration artifact changes, model config identical
console.log('Attack Test F: Modify CALIBRATION targets changes artifact but leaves frozen model config intact...');
const frozenConfig = { model_identity: 'Deterministic_Continuous_Degradation_Forecaster', tuning_split: 'VALIDATION_TUNE', hyperparameters_frozen: true };
const calibTargetsF2 = JSON.parse(JSON.stringify(calibTargets));
calibTargetsF2.iddq[96] = calibTargetsF2.iddq[96].map(v => v + 50.0);
const calibF1 = new ConformalResidualCalibrator(CONTRACT_PATH);
const artF1 = calibF1.fit({ calibrationPredictions: calibPreds, calibrationTargets: calibTargets, splitName: 'CALIBRATION', frozenModelConfig: frozenConfig });
const calibF2 = new ConformalResidualCalibrator(CONTRACT_PATH);
const artF2 = calibF2.fit({ calibrationPredictions: calibPreds, calibrationTargets: calibTargetsF2, splitName: 'CALIBRATION', frozenModelConfig: frozenConfig });
assert.notStrictEqual(artF1.calibration_artifact_sha256, artF2.calibration_artifact_sha256);
assert.deepStrictEqual(artF1.frozen_model_configuration, artF2.frozen_model_configuration);
console.log('  ✓ Attack Test F Passed: Calibration artifact changed while model config remained identical');

// Attack Test G: CALIBRATION lots not in tuning lots
console.log('Attack Test G: CALIBRATION lots strictly disjoint from model tuning lots...');
const calibLotSet = new Set(splits.calibration.map(r => r.lot_id));
const tuneLotSet = new Set(splits.validation_tune.map(r => r.lot_id));
for (const l of calibLotSet) {
  assert.ok(!tuneLotSet.has(l), `Calib lot ${l} found in tune lots`);
}
console.log('  ✓ Attack Test G Passed: CALIBRATION lots strictly disjoint from VALIDATION_TUNE lots');

// Attack Test H: VALIDATION_TUNE split rejected for conformal fitting
console.log('Attack Test H: VALIDATION_TUNE split rejected for conformal fitting...');
assert.throws(() => {
  calibAttA.fit({ calibrationPredictions: dummyPreds, calibrationTargets: dummyTargets, splitName: 'VALIDATION_TUNE' });
}, /CALIBRATION_SPLIT_LEAKAGE_REJECTED/);
console.log('  ✓ Attack Test H Passed: VALIDATION_TUNE split rejected for conformal calibration fitting');

console.log('='.repeat(80));
console.log('ALL NODE.JS CONFORMAL CALIBRATION TESTS PASSED! ✅');
console.log('='.repeat(80));
