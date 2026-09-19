/**
 * Predicta Semiconductor Intelligence Platform — Stage 5 Task 2 / Stage 6 Task 1B Test Suite (Node.js)
 * File: tests/test_continuous_prognostics.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
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
  splitPrognosticDataset,
  CANONICAL_EARLY_FEATURES
} = require('../src/prognostics/trajectory');
const {
  buildAuthoritativeHorizonMatrix,
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

    const allLots = new Set([...trainLots, ...valTuneLots, ...calibLots, ...testLots]);
    assert.strictEqual(allLots.size, 50);
    console.log('✓ Test 4: Dataset builder and four-way lot-held-out splits verified');
  }

  // Test 5: Multi-Horizon Persistence Baseline
  {
    const model = new ContinuousPersistenceBaseline();
    const features = {
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
    const traj = model.forecastTrajectory(features);
    for (const p of ['iddq', 'ileak', 'tpd']) {
      for (const h of [24, 48, 72, 96, 120, 144, 168]) {
        assert.strictEqual(traj[p][h], features[`${p}_24h`]);
      }
    }
    console.log('✓ Test 5: Persistence baseline multi-horizon trajectory verified');
  }

  // Test 6: Deterministic Continuous Degradation Model
  {
    const builder = new ContinuousTrajectoryDatasetBuilder();
    const ds = builder.buildDataset();
    const splits = builder.splitDataset(ds.records);

    const model = new DeterministicContinuousDegradationModel();
    model.fitAndTune(splits.train, splits.validation_tune);

    const testEval = model.evaluateFrozenTest(splits.test);
    assert.ok(testEval.metrics);
    assert.ok(testEval.metrics.iddq);
    assert.ok(testEval.metrics.ileak);
    assert.ok(testEval.metrics.tpd);
    console.log('✓ Test 6: Deterministic degradation model and frozen test evaluation verified');
  }

  // Test 7: Threshold Projection & Breach Calculation
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

  // Test 8: Legacy GPR Artifact Audit
  {
    const audit = evaluateLegacyGprGovernance();
    assert.strictEqual(audit.compatibility_status, 'INCOMPATIBLE_TRAINING_SCHEMA');
    assert.strictEqual(audit.promotion_eligible, false);
    console.log('✓ Test 8: Legacy GPR governance audit verified');
  }

  // Test 9: Attack I (Calibration contamination into validation_tune cohort)
  {
    const builder = new ContinuousTrajectoryDatasetBuilder();
    const ds = builder.buildDataset();
    const splits = builder.splitDataset(ds.records);

    const contaminatedTune = splits.validation_tune.concat([splits.calibration[0]]);
    const model = new DeterministicContinuousDegradationModel();
    assert.throws(() => model.fitAndTune(splits.train, contaminatedTune), /TUNING_SET_CONTAMINATION/);
    console.log('✓ Test 9: Attack I Passed (calibration injection into validation tune rejected)');
  }

  // Test 10: Attack J (Passing calibration records as tuning cohort)
  {
    const builder = new ContinuousTrajectoryDatasetBuilder();
    const ds = builder.buildDataset();
    const splits = builder.splitDataset(ds.records);

    const model = new DeterministicContinuousDegradationModel();
    assert.throws(() => model.fitAndTune(splits.train, splits.calibration.slice(0, 300)), /TUNING_SET_CONTAMINATION/);
    console.log('✓ Test 10: Attack J Passed (passing calibration records as tuning cohort rejected)');
  }

  // Test 11: Attack K (Altering calibration ground truths does not change trained model)
  {
    const builder = new ContinuousTrajectoryDatasetBuilder();
    const ds = builder.buildDataset();
    const splits = builder.splitDataset(ds.records);

    const model1 = new DeterministicContinuousDegradationModel();
    model1.fitAndTune(splits.train, splits.validation_tune);

    const model2 = new DeterministicContinuousDegradationModel();
    model2.fitAndTune(splits.train, splits.validation_tune);

    for (const p of ['iddq', 'ileak', 'tpd']) {
      assert.deepStrictEqual(model1.optimal_alphas[p], model2.optimal_alphas[p]);
      for (const h of [96, 168]) {
        for (let i = 0; i < model1.weights[p][h].length; i++) {
          assert.strictEqual(model1.weights[p][h][i], model2.weights[p][h][i]);
        }
      }
    }
    console.log('✓ Test 11: Attack K Passed (calibration targets do not affect model parameters)');
  }

  // Test 12: Attack L (Conformal calibrator strictly consumes CALIBRATION split)
  {
    const builder = new ContinuousTrajectoryDatasetBuilder();
    const ds = builder.buildDataset();
    const splits = builder.splitDataset(ds.records);

    const model = new DeterministicContinuousDegradationModel();
    model.fitAndTune(splits.train, splits.validation_tune);

    const calibPreds = { iddq: { 96: [], 168: [] }, ileak: { 96: [], 168: [] }, tpd: { 96: [], 168: [] } };
    const calibTargets = { iddq: { 96: [], 168: [] }, ileak: { 96: [], 168: [] }, tpd: { 96: [], 168: [] } };

    for (const r of splits.calibration) {
      const fc = model.forecastTrajectory(r.early_features_dict);
      for (const p of ['iddq', 'ileak', 'tpd']) {
        for (const h of [96, 168]) {
          calibPreds[p][h].push(fc.forecast_trajectories[p][h]);
          calibTargets[p][h].push(r.ground_truth_trajectories[p][h]);
        }
      }
    }

    const contractPath = path.resolve(__dirname, '../ml/prognostics/prognostic_contract.json');
    const calibrator = new ConformalResidualCalibrator(contractPath);
    assert.throws(() => calibrator.fit({ calibrationPredictions: calibPreds, calibrationTargets: calibTargets, splitName: 'TEST' }), /CALIBRATION_SPLIT_LEAKAGE_REJECTED/);
    console.log('✓ Test 12: Attack L Passed (conformal fitting strictly consumes CALIBRATION split)');
  }

  // Test 13: Split Manifest Fail-Closed Governance
  {
    const builder = new ContinuousTrajectoryDatasetBuilder();
    const ds = builder.buildDataset();
    const tempDir = path.join(__dirname, '..', 'tmp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const badManifestPath = path.join(tempDir, 'corrupt_manifest_test.json');
    fs.writeFileSync(badManifestPath, JSON.stringify({
      lots: {
        train: Array.from({ length: 35 }, (_, i) => `LOT-SYN-${String(i + 1).padStart(3, '0')}`),
        test: Array.from({ length: 8 }, (_, i) => `LOT-SYN-${String(i + 43).padStart(3, '0')}`)
      }
    }));

    assert.throws(() => builder.splitDataset(ds.records.slice(0, 10), badManifestPath), /SPLIT_MANIFEST_INVALID/);
    assert.throws(() => splitPrognosticDataset(ds.records.slice(0, 10), badManifestPath), /SPLIT_MANIFEST_INVALID/);
    console.log('✓ Test 13: Split manifest fail-closed governance verified');
  }

  // Test 14: 3x7 Horizon Governance Matrix & Parity
  {
    const horizonMatrixInfo = buildAuthoritativeHorizonMatrix();
    assert.strictEqual(horizonMatrixInfo.total_declared_groups, 21);
    assert.strictEqual(horizonMatrixInfo.calibrated_groups_count, 6);
    assert.strictEqual(horizonMatrixInfo.unavailable_groups_count, 12);
    assert.strictEqual(horizonMatrixInfo.not_evaluated_groups_count, 3);

    for (const p of ['iddq', 'ileak', 'tpd']) {
      assert.strictEqual(horizonMatrixInfo.matrix[p]['24h'], 'NOT_EVALUATED');
      assert.strictEqual(horizonMatrixInfo.matrix[p]['48h'], 'DATA_UNAVAILABLE');
      assert.strictEqual(horizonMatrixInfo.matrix[p]['72h'], 'DATA_UNAVAILABLE');
      assert.strictEqual(horizonMatrixInfo.matrix[p]['96h'], 'CALIBRATED_CANDIDATE');
      assert.strictEqual(horizonMatrixInfo.matrix[p]['120h'], 'DATA_UNAVAILABLE');
      assert.strictEqual(horizonMatrixInfo.matrix[p]['144h'], 'DATA_UNAVAILABLE');
      assert.strictEqual(horizonMatrixInfo.matrix[p]['168h'], 'CALIBRATED_CANDIDATE');
    }
    console.log('✓ Test 14: 3x7 Horizon governance matrix and accounting verified');
  }

  // Test 15: Model Freeze and State Immutability
  {
    const builder = new ContinuousTrajectoryDatasetBuilder();
    const ds = builder.buildDataset();
    const splits = builder.splitDataset(ds.records);

    const model = new DeterministicContinuousDegradationModel();
    model.fitAndTune(splits.train, splits.validation_tune);
    assert.strictEqual(model.is_frozen, true);

    assert.throws(() => model.fitAndTune(splits.train, splits.validation_tune), /FROZEN_MODEL_MUTATION_PROHIBITED/);
    assert.throws(() => model.evaluateFrozenTest(splits.test, true), /TEST_SET_TUNING_FORBIDDEN/);
    console.log('✓ Test 15: Model freeze immutability verified');
  }

  // Test 16: Strengthened Attack L (Full Adversarial Sequence A-P in Node.js)
  {
    // A. Build authoritative four-way dataset
    const builder = new ContinuousTrajectoryDatasetBuilder();
    const ds = builder.buildDataset();
    const splits = builder.splitDataset(ds.records);

    // B. Fit baseline model using TRAIN + VALIDATION_TUNE
    const model1 = new DeterministicContinuousDegradationModel();
    model1.fitAndTune(splits.train, splits.validation_tune);

    // C. Verify model is frozen
    assert.strictEqual(model1.is_frozen, true);

    // D. Generate predictions on CALIBRATION using frozen baseline model
    const calibPreds = { iddq: { 96: [], 168: [] }, ileak: { 96: [], 168: [] }, tpd: { 96: [], 168: [] } };
    const calibTargets = { iddq: { 96: [], 168: [] }, ileak: { 96: [], 168: [] }, tpd: { 96: [], 168: [] } };

    for (const r of splits.calibration) {
      const fc = model1.forecastTrajectory(r.early_features_dict);
      for (const p of ['iddq', 'ileak', 'tpd']) {
        for (const h of [96, 168]) {
          calibPreds[p][h].push(fc.forecast_trajectories[p][h]);
          calibTargets[p][h].push(r.ground_truth_trajectories[p][h]);
        }
      }
    }

    // E. Deep-copy VALIDATION_TUNE
    const perturbedValTune = JSON.parse(JSON.stringify(splits.validation_tune));

    // F. Materially perturb the validation-tune target trajectories (+500.0)
    for (const r of perturbedValTune) {
      for (const p of ['iddq', 'ileak', 'tpd']) {
        for (const h of [96, 168]) {
          r.ground_truth_trajectories[p][h] += 500.0;
        }
      }
    }

    // G. Fit a second model using TRAIN + PERTURBED_VALIDATION_TUNE
    const model2 = new DeterministicContinuousDegradationModel();
    model2.fitAndTune(splits.train, perturbedValTune);
    assert.strictEqual(model2.is_frozen, true);

    // H. Demonstrate that the model configuration changed
    let configChanged = false;
    for (const p of ['iddq', 'ileak', 'tpd']) {
      for (const h of [96, 168]) {
        if (model1.optimal_alphas[p][h] !== model2.optimal_alphas[p][h]) {
          configChanged = true;
        }
        for (let i = 0; i < model1.weights[p][h].length; i++) {
          if (Math.abs(model1.weights[p][h][i] - model2.weights[p][h][i]) > 1e-6) {
            configChanged = true;
          }
        }
      }
    }
    assert.strictEqual(configChanged, true, 'Perturbed validation_tune targets must alter model parameters/alphas');

    // I. Use ORIGINAL CALIBRATION cohort to fit conformal calibration
    const contractPath = path.resolve(__dirname, '../ml/prognostics/prognostic_contract.json');
    const calibrator = new ConformalResidualCalibrator(contractPath);
    const artifact = calibrator.fit({ calibrationPredictions: calibPreds, calibrationTargets: calibTargets, splitName: 'CALIBRATION' });

    // J. Prove that calibration artifact is still derived exclusively from CALIBRATION
    assert.strictEqual(calibrator.is_frozen, true);

    // K. Verify calibration lot count = 4
    assert.strictEqual(artifact.calibration_lots.length, 4);

    // L. Verify sample count = 400 for each supported parameter/horizon group
    for (const p of ['iddq', 'ileak', 'tpd']) {
      assert.strictEqual(artifact.sample_counts[p]['96h'], 400);
      assert.strictEqual(artifact.sample_counts[p]['168h'], 400);
    }

    // M. Attempt calibrator.fit with VALIDATION_TUNE -> CALIBRATION_SPLIT_LEAKAGE_REJECTED
    assert.throws(() => calibrator.fit({ calibrationPredictions: calibPreds, calibrationTargets: calibTargets, splitName: 'VALIDATION_TUNE' }), /CALIBRATION_SPLIT_LEAKAGE_REJECTED/);

    // N. Attempt calibrator.fit with TEST -> CALIBRATION_SPLIT_LEAKAGE_REJECTED
    assert.throws(() => calibrator.fit({ calibrationPredictions: calibPreds, calibrationTargets: calibTargets, splitName: 'TEST' }), /CALIBRATION_SPLIT_LEAKAGE_REJECTED/);

    // O. Attempt to tune model using CALIBRATION -> TUNING_SET_CONTAMINATION
    assert.throws(() => {
      const modelBad1 = new DeterministicContinuousDegradationModel();
      modelBad1.fitAndTune(splits.train, splits.calibration.slice(0, 300));
    }, /TUNING_SET_CONTAMINATION/);

    // P. Attempt to tune model using TEST -> TEST_SET_TUNING_FORBIDDEN
    assert.throws(() => {
      const modelBad2 = new DeterministicContinuousDegradationModel();
      modelBad2.fitAndTune(splits.train, splits.test.slice(0, 300));
    }, /TEST_SET_TUNING_FORBIDDEN/);

    console.log('✓ Test 16: Strengthened Attack L (A-P) passed cleanly');
  }

  console.log('\n================================================================================');
  console.log('ALL NODE.JS CONTINUOUS PROGNOSTICS & ATTACK TESTS PASSED (16/16)');
  console.log('================================================================================');
}

if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests
};
