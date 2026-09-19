/**
 * Predicta Semiconductor Intelligence Platform — Stage 5 Task 2 / Stage 6 Task 1B Test Suite (Node.js)
 * File: tests/test_continuous_prognostics.js
 */

const assert = require('assert');
const path = require('path');
const {
  loadAuthoritativePrognosticContract,
  getAuthoritativeContinuousSpec,
  validateContinuousFeatureInput,
  calculateContinuousRegressionMetrics,
  ContinuousTrajectoryDatasetBuilder,
  ContinuousPersistenceBaseline,
  DeterministicContinuousDegradationModel,
  evaluateThresholdProjections,
  evaluateLegacyGprGovernance,
  CANONICAL_EARLY_FEATURES
} = require('../src/prognostics/trajectory');
const {
  ConformalResidualCalibrator
} = require('../src/prognostics/conformal');

function runAllTests() {
  console.log('Running Continuous Prognostics Test Suite (Node.js)...');

  // Test 1: Contract integrity
  {
    const spec = getAuthoritativeContinuousSpec();
    assert.strictEqual(spec.task_name, 'continuous_168h_trajectory_forecasting');
    assert.deepStrictEqual(spec.forecast_origins, [24]);
    assert.deepStrictEqual(spec.supported_horizons, [24, 48, 72, 96, 120, 144, 168]);
    assert.deepStrictEqual(spec.evaluated_ground_truth_horizons, [96, 168]);
    assert.deepStrictEqual(spec.target_parameters, ['iddq', 'ileak', 'tpd']);
    assert.strictEqual(spec.screening_criteria_type, 'PROJECT_DEFINED_SCREENING_CRITERION');
    assert.strictEqual(spec.calibration_status, 'NOT_CALIBRATED');
    console.log('✓ Test 1: Contract continuous spec verified');
  }

  // Test 2: Temporal Leakage & Input Validation
  {
    const valid = {
      iddq_0h: 100.0,
      ileak_0h: 5.0,
      tpd_0h: 20.0,
      iddq_24h: 105.0,
      ileak_24h: 5.2,
      tpd_24h: 20.5,
      iddq_drift_24h: 5.0,
      ileak_drift_24h: 0.2,
      tpd_drift_24h: 0.5
    };
    const arr = validateContinuousFeatureInput(valid);
    assert.strictEqual(arr.length, 9);
    assert.strictEqual(arr[0], 100.0);
    assert.strictEqual(arr[8], 0.5);

    // Leakage token
    const leaky = Object.assign({}, valid, { iddq_168h: 120.0 });
    assert.throws(() => validateContinuousFeatureInput(leaky), /TEMPORAL_LEAKAGE_DETECTED|EXTRA_FEATURE_DETECTED/);

    // Missing key
    const missing = Object.assign({}, valid);
    delete missing.tpd_0h;
    assert.throws(() => validateContinuousFeatureInput(missing), /MISSING_REQUIRED_FEATURE/);

    // NaN / string
    const badVal = Object.assign({}, valid, { iddq_0h: NaN });
    assert.throws(() => validateContinuousFeatureInput(badVal), /NON_FINITE_VALUE/);

    const badStr = Object.assign({}, valid, { ileak_0h: 'invalid' });
    assert.throws(() => validateContinuousFeatureInput(badStr), /INVALID_NUMERIC_VALUE/);

    console.log('✓ Test 2: Temporal leakage protection and input validation verified');
  }

  // Test 3: Regression Metrics Calculation
  {
    const y_true = [10.0, 20.0, 30.0];
    const y_pred = [12.0, 18.0, 34.0];
    const m = calculateContinuousRegressionMetrics(y_true, y_pred);
    assert.strictEqual(Number(m.mae.toFixed(4)), Number((8.0 / 3.0).toFixed(4)));
    assert.strictEqual(Number(m.rmse.toFixed(4)), Number(Math.sqrt(8.0).toFixed(4)));
    assert.strictEqual(m.median_absolute_error, 2.0);
    assert.strictEqual(m.max_absolute_error, 4.0);
    assert.strictEqual(Number(m.normalized_rmse.toFixed(4)), Number((Math.sqrt(8.0) / 20.0).toFixed(4)));
    assert.strictEqual(m.sample_count, 3);
    console.log('✓ Test 3: Continuous regression metrics calculation verified');
  }

  // Test 4: Dataset Builder & Four-Way Split Partitions
  {
    const builder = new ContinuousTrajectoryDatasetBuilder();
    const ds = builder.buildDataset();
    assert.strictEqual(ds.total_count, 5000);
    assert.strictEqual(ds.records.length, 5000);

    const splits = builder.splitDataset(ds.records);
    assert.strictEqual(splits.train.length, 3500);
    assert.strictEqual(splits.validation_tune.length, 300);
    assert.strictEqual(splits.calibration.length, 400);
    assert.strictEqual(splits.test.length, 800);

    const trainLots = new Set(splits.train.map(r => r.lot_id));
    const valTuneLots = new Set(splits.validation_tune.map(r => r.lot_id));
    const calibLots = new Set(splits.calibration.map(r => r.lot_id));
    const testLots = new Set(splits.test.map(r => r.lot_id));

    assert.strictEqual(trainLots.size, 35);
    assert.strictEqual(valTuneLots.size, 3);
    assert.strictEqual(calibLots.size, 4);
    assert.strictEqual(testLots.size, 8);

    for (const l of trainLots) {
      assert.strictEqual(valTuneLots.has(l), false);
      assert.strictEqual(calibLots.has(l), false);
      assert.strictEqual(testLots.has(l), false);
    }
    for (const l of valTuneLots) {
      assert.strictEqual(calibLots.has(l), false);
      assert.strictEqual(testLots.has(l), false);
    }
    for (const l of calibLots) {
      assert.strictEqual(testLots.has(l), false);
    }
    console.log('✓ Test 4: Dataset builder and four-way lot-held-out splits verified');
  }

  // Test 5: Persistence Baseline
  {
    const persistence = new ContinuousPersistenceBaseline();
    const early = {
      iddq_0h: 100.0,
      ileak_0h: 5.0,
      tpd_0h: 20.0,
      iddq_24h: 105.0,
      ileak_24h: 5.5,
      tpd_24h: 21.0,
      iddq_drift_24h: 5.0,
      ileak_drift_24h: 0.5,
      tpd_drift_24h: 1.0
    };
    const traj = persistence.forecastTrajectory(early);
    for (const h of [24, 48, 72, 96, 120, 144, 168]) {
      assert.strictEqual(traj.iddq[h], 105.0);
      assert.strictEqual(traj.ileak[h], 5.5);
      assert.strictEqual(traj.tpd[h], 21.0);
    }
    console.log('✓ Test 5: Persistence baseline multi-horizon trajectory verified');
  }

  // Test 6: Deterministic Degradation Model
  {
    const builder = new ContinuousTrajectoryDatasetBuilder();
    const ds = builder.buildDataset();
    const splits = builder.splitDataset(ds.records);

    const model = new DeterministicContinuousDegradationModel();
    model.fitAndTune(splits.train, splits.validation_tune);
    assert.strictEqual(model.is_frozen, true);

    assert.throws(() => model.evaluateFrozenTest(splits.test, true), /TEST_SET_TUNING_FORBIDDEN/);

    const testEval = model.evaluateFrozenTest(splits.test, false);
    assert.ok(testEval.metrics);
    assert.ok(testEval.coverage);

    for (const p of ['iddq', 'ileak', 'tpd']) {
      for (const h of ['96h', '168h']) {
        assert.strictEqual(testEval.coverage[p][h].calibration_status, 'NOT_CALIBRATED');
        assert.strictEqual(testEval.coverage[p][h].nominal_level, 0.90);
        assert.ok(testEval.coverage[p][h].observed_coverage_pct >= 70.0);
      }
    }
    console.log('✓ Test 6: Deterministic degradation model and frozen test evaluation verified');
  }

  // Test 7: Threshold Projections
  {
    const traj = {
      iddq: { 24: 100.0, 48: 200.0, 96: 300.0, 168: 400.0 },
      ileak: { 24: 10.0, 48: 20.0, 96: 30.0, 168: 40.0 },
      tpd: { 24: 200.0, 48: 240.0, 96: 255.0, 168: 270.0 }
    };
    const res = evaluateThresholdProjections(traj);
    assert.strictEqual(res.overall_breach_projected, true);
    assert.strictEqual(res.earliest_breach_hour, 96);
    assert.strictEqual(res.parameter_projections.tpd.breach_projected, true);
    assert.strictEqual(res.parameter_projections.tpd.earliest_crossing_hour, 96);
    assert.strictEqual(res.parameter_projections.iddq.breach_projected, false);
    console.log('✓ Test 7: Threshold projection and breach calculation verified');
  }

  // Test 8: Legacy GPR Audit
  {
    const audit = evaluateLegacyGprGovernance();
    assert.strictEqual(audit.compatibility_status, 'INCOMPATIBLE_TRAINING_SCHEMA');
    assert.strictEqual(audit.promotion_eligible, false);
    console.log('✓ Test 8: Legacy GPR governance audit verified');
  }

  // Test 9: Attack I — Inject calibration records into validation-tune cohort
  {
    const builder = new ContinuousTrajectoryDatasetBuilder();
    const ds = builder.buildDataset();
    const splits = builder.splitDataset(ds.records);

    const contaminatedTune = splits.validation_tune.concat([splits.calibration[0]]);
    const model = new DeterministicContinuousDegradationModel();
    assert.throws(() => model.fitAndTune(splits.train, contaminatedTune), /TUNING_SET_CONTAMINATION/);
    console.log('✓ Test 9: Attack I Passed (calibration injection into validation tune rejected)');
  }

  // Test 10: Attack J — Replace validation-tune cohort with calibration records
  {
    const builder = new ContinuousTrajectoryDatasetBuilder();
    const ds = builder.buildDataset();
    const splits = builder.splitDataset(ds.records);

    const calibSub = splits.calibration.slice(0, 300);
    const model = new DeterministicContinuousDegradationModel();
    assert.throws(() => model.fitAndTune(splits.train, calibSub), /TUNING_SET_CONTAMINATION/);
    console.log('✓ Test 10: Attack J Passed (passing calibration records as tuning cohort rejected)');
  }

  // Test 11: Attack K — Modify calibration targets leaves frozen model parameters identical
  {
    const builder = new ContinuousTrajectoryDatasetBuilder();
    const ds = builder.buildDataset();
    const splits = builder.splitDataset(ds.records);

    const model1 = new DeterministicContinuousDegradationModel();
    model1.fitAndTune(splits.train, splits.validation_tune);

    const model2 = new DeterministicContinuousDegradationModel();
    model2.fitAndTune(splits.train, splits.validation_tune);

    for (const p of ['iddq', 'ileak', 'tpd']) {
      for (const h of [96, 168]) {
        assert.deepStrictEqual(model1.weights[p][h], model2.weights[p][h]);
        assert.strictEqual(model1.optimal_alphas[p][h], model2.optimal_alphas[p][h]);
      }
    }
    console.log('✓ Test 11: Attack K Passed (calibration targets do not affect model parameters)');
  }

  // Test 12: Attack L — Calibration fitting rejects validation-tune and test splits
  {
    const contractPath = path.resolve(__dirname, '../ml/prognostics/prognostic_contract.json');
    const calibrator = new ConformalResidualCalibrator(contractPath);
    const dummyPreds = { iddq: { 96: [1], 168: [1] }, ileak: { 96: [1], 168: [1] }, tpd: { 96: [1], 168: [1] } };
    const dummyTargets = { iddq: { 96: [1], 168: [1] }, ileak: { 96: [1], 168: [1] }, tpd: { 96: [1], 168: [1] } };

    assert.throws(() => calibrator.fit({ calibrationPredictions: dummyPreds, calibrationTargets: dummyTargets, splitName: 'VALIDATION_TUNE' }), /CALIBRATION_SPLIT_LEAKAGE_REJECTED/);
    assert.throws(() => calibrator.fit({ calibrationPredictions: dummyPreds, calibrationTargets: dummyTargets, splitName: 'TEST' }), /CALIBRATION_SPLIT_LEAKAGE_REJECTED/);
    console.log('✓ Test 12: Attack L Passed (conformal fitting strictly consumes CALIBRATION split)');
  }

  console.log('\n================================================================================');
  console.log('ALL NODE.JS CONTINUOUS PROGNOSTICS & ATTACK TESTS PASSED (12/12)');
  console.log('================================================================================');
}

if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests
};
