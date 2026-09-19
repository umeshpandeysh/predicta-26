/**
 * Authoritative Stage 6 Conformal Residual Calibration Benchmark Runner (Node.js)
 * =============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  DATASET_PATH,
  SPLIT_MANIFEST_PATH,
  getAuthoritativeCalibrationSpec,
  partitionFourWayDataset,
  ConformalResidualCalibrator,
  exportCalibrationArtifact,
} = require('./conformal');
const {
  CONTRACT_PATH,
  ContinuousTrajectoryDatasetBuilder,
  DeterministicContinuousDegradationModel,
  computeSha256,
  loadAuthoritativePrognosticContract,
} = require('./trajectory');

function runConformalCalibrationBenchmark(datasetPath = DATASET_PATH, contractPath = CONTRACT_PATH) {
  console.log('='.repeat(80));
  console.log('PREDICTA-26 — AUTHORITATIVE CONFORMAL CALIBRATION BENCHMARK (NODE.JS)');
  console.log('='.repeat(80));

  const contract = loadAuthoritativePrognosticContract(contractPath);
  const calibSpec = getAuthoritativeCalibrationSpec(contractPath);

  const contractSha = computeSha256(contractPath);
  const datasetSha = computeSha256(datasetPath);
  const manifestSha = computeSha256(SPLIT_MANIFEST_PATH);

  const splitManifest = JSON.parse(fs.readFileSync(SPLIT_MANIFEST_PATH, 'utf8'));
  const manifestLots = splitManifest.lots || {};

  console.log(`Contract SHA-256: ${contractSha}`);
  console.log(`Dataset SHA-256:  ${datasetSha}`);
  console.log(`Manifest SHA-256: ${manifestSha}`);

  console.log('\nIngesting dataset and partitioning into 4 lot-disjoint cohorts...');
  const builder = new ContinuousTrajectoryDatasetBuilder(datasetPath, contractPath);
  const ds = builder.buildDataset();
  const splits = partitionFourWayDataset(ds.records, SPLIT_MANIFEST_PATH);

  const trainData = splits.train;
  const valTuneData = splits.validation_tune;
  const calibData = splits.calibration;
  const testData = splits.test;

  console.log(`  Train:           ${trainData.length} components (LOT-SYN-001..035) -> Model Fitting`);
  console.log(`  Validation Tune: ${valTuneData.length} components (LOT-SYN-036..038) -> Hyperparameter Tuning`);
  console.log(`  Calibration:     ${calibData.length} components (LOT-SYN-039..042) -> CALIBRATION SPLIT ONLY`);
  console.log(`  Test:            ${testData.length} components (LOT-SYN-043..050) -> FROZEN EVAL SPLIT`);

  console.log('\nFitting Continuous Deterministic Forecaster on Train (Tuned on ValTune)...');
  const model = new DeterministicContinuousDegradationModel();
  model.fitAndTune(trainData, valTuneData);

  const frozenConfig = {
    model_identity: 'Deterministic_Continuous_Degradation_Forecaster',
    tuning_split: 'VALIDATION_TUNE',
    training_samples: trainData.length,
    tuning_samples: valTuneData.length,
    hyperparameters_frozen: true,
  };

  console.log('\nExtracting calibration predictions & targets using frozen model...');
  const calibPreds = { iddq: {}, ileak: {}, tpd: {} };
  const calibTargets = { iddq: {}, ileak: {}, tpd: {} };

  for (const param of ['iddq', 'ileak', 'tpd']) {
    for (const h of [96, 168]) {
      const pList = [];
      const tList = [];
      for (const r of calibData) {
        const fc = model.forecastTrajectory(r.early_features_dict).forecast_trajectories[param][h];
        const gt = r.ground_truth_trajectories[param][h];
        pList.push(fc);
        tList.push(gt);
      }
      calibPreds[param][h] = pList;
      calibTargets[param][h] = tList;
    }
  }

  console.log('\nFitting Conformal Residual Calibrator on CALIBRATION split ONLY...');
  const calibrator = new ConformalResidualCalibrator(contractPath);
  const frozenArtifact = calibrator.fit({
    calibrationPredictions: calibPreds,
    calibrationTargets: calibTargets,
    splitName: 'CALIBRATION',
    calibrationLots: manifestLots.calibration,
    validationTuneLots: manifestLots.validation_tune,
    trainLots: manifestLots.train,
    testLots: manifestLots.test,
    datasetSha256: datasetSha,
    splitManifestSha256: manifestSha,
    modelIdentity: 'Deterministic_Continuous_Degradation_Forecaster',
    frozenModelConfig: frozenConfig,
  });

  console.log(`  Calibration Artifact Hash: ${frozenArtifact.calibration_artifact_sha256}`);

  console.log('\nApplying frozen calibrator to held-out TEST cohort...');
  const testPreds = { iddq: {}, ileak: {}, tpd: {} };
  const testTargets = { iddq: {}, ileak: {}, tpd: {} };

  for (const param of ['iddq', 'ileak', 'tpd']) {
    for (const h of [96, 168]) {
      const pList = [];
      const tList = [];
      for (const r of testData) {
        const fc = model.forecastTrajectory(r.early_features_dict).forecast_trajectories[param][h];
        const gt = r.ground_truth_trajectories[param][h];
        pList.push(fc);
        tList.push(gt);
      }
      testPreds[param][h] = pList;
      testTargets[param][h] = tList;
    }
  }

  const testIntervals = calibrator.apply(testPreds);

  console.log('\nEvaluating empirical test coverage and interval widths...');
  const coverageResults = calibrator.evaluateCoverage(testIntervals, testTargets);

  for (const param of ['iddq', 'ileak', 'tpd']) {
    for (const hStr of ['96h', '168h']) {
      for (const lvlStr of ['0.80', '0.90', '0.95']) {
        const res = coverageResults[param][hStr][lvlStr];
        console.log(
          `  [${param.toUpperCase()} @ ${hStr} | Nominal ${parseFloat(lvlStr) * 100}%] ` +
            `Observed: ${res.observed_coverage_pct}% (Error: ${res.coverage_error > 0 ? '+' : ''}${res.coverage_error}) | ` +
            `Avg Width: ${res.avg_interval_width} | q: ${res.conformal_quantile_q.toFixed(4)}`
        );
      }
    }
  }

  const report = {
    report_metadata: {
      title: 'Authoritative Stage 6 Conformal Calibration Benchmark Report',
      generated_at_utc: new Date().toISOString(),
      contract_version: contract.contract_version,
      contract_sha256: contractSha,
      dataset_sha256: datasetSha,
      split_manifest_sha256: manifestSha,
      dataset_path: datasetPath,
      execution_status: 'SUCCESS',
      synthetic_disclaimer:
        'All telemetry is synthetic data generated for benchmark and simulation. Not flight-qualified or real-world certified.',
    },
    calibration_specification: calibSpec,
    split_cohorts: {
      train: {
        lot_count: (manifestLots.train || []).length,
        component_count: trainData.length,
        lots: manifestLots.train || [],
        purpose: 'Point model parameter fitting',
      },
      validation_tune: {
        lot_count: (manifestLots.validation_tune || []).length,
        component_count: valTuneData.length,
        lots: manifestLots.validation_tune || [],
        purpose: 'Model selection & hyperparameter tuning',
      },
      calibration: {
        lot_count: (manifestLots.calibration || []).length,
        component_count: calibData.length,
        lots: manifestLots.calibration || [],
        purpose: 'Conformal residual quantile estimation ONLY',
      },
      test: {
        lot_count: (manifestLots.test || []).length,
        component_count: testData.length,
        lots: manifestLots.test || [],
        purpose: 'Final frozen held-out coverage evaluation',
      },
    },
    horizon_governance_matrix: frozenArtifact.horizon_status_matrix,
    horizon_accounting: {
      declared_contract_groups: frozenArtifact.declared_groups_count,
      calibrated_candidate_groups: frozenArtifact.calibrated_groups_count,
      data_unavailable_groups: frozenArtifact.unavailable_groups_count,
    },
    calibration_artifact: frozenArtifact,
    empirical_test_evaluation: coverageResults,
    governance_status: {
      calibration_status: 'NOT_CALIBRATED',
      model_status: 'BENCHMARK_ONLY',
      promotion_lock_active: true,
    },
  };

  const artifactPath = path.resolve(__dirname, '../../ml/models/production/conformal_calibration_artifacts.json');
  exportCalibrationArtifact(frozenArtifact, artifactPath);
  console.log(`\nSaved frozen calibration artifact to: ${artifactPath}`);

  const reportJsonPath = path.resolve(__dirname, '../../experiments/prognostics/conformal_calibration_report.json');
  const reportDir = path.dirname(reportJsonPath);
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Saved benchmark JSON report to: ${reportJsonPath}`);

  console.log('='.repeat(80));
  console.log('CONFORMAL CALIBRATION BENCHMARK (NODE.JS) COMPLETED SUCCESSFULLY');
  console.log('='.repeat(80));
  return report;
}

if (require.main === module) {
  runConformalCalibrationBenchmark();
}

module.exports = {
  runConformalCalibrationBenchmark,
};
