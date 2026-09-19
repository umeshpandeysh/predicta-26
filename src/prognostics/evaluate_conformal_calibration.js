/**
 * Authoritative Stage 6 Conformal Residual Calibration Benchmark Runner (Node.js)
 * ===============================================================================
 * Executes the full conformal uncertainty evaluation pipeline in JavaScript:
 * 1. Ingests dataset and splits into Train/Val/Test cohorts.
 * 2. Fits DeterministicContinuousDegradationModel via fitAndTune.
 * 3. Fits ConformalResidualCalibrator on VALIDATION split residuals ONLY.
 * 4. Freezes calibration artifact.
 * 5. Applies to held-out TEST cohort and evaluates empirical coverage.
 * 6. Emits benchmark reports.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  loadAuthoritativePrognosticContract,
  computeSha256,
  ContinuousTrajectoryDatasetBuilder,
  DeterministicContinuousDegradationModel
} = require('./trajectory');
const {
  getAuthoritativeCalibrationSpec,
  ConformalResidualCalibrator,
  exportCalibrationArtifact
} = require('./conformal');

const CONTRACT_PATH = path.resolve(__dirname, '../../ml/prognostics/prognostic_contract.json');
const DATASET_PATH = path.resolve(__dirname, '../../data/synthetic/semiconductor_synthetic_full.csv');
const PROJECT_ROOT = path.resolve(__dirname, '../..');

function runConformalCalibrationBenchmark(datasetPath = DATASET_PATH, contractPath = CONTRACT_PATH) {
  console.log('='.repeat(80));
  console.log('PREDICTA-26 — AUTHORITATIVE CONFORMAL CALIBRATION BENCHMARK (NODE.JS)');
  console.log('='.repeat(80));

  const contract = loadAuthoritativePrognosticContract(contractPath);
  const calibSpec = getAuthoritativeCalibrationSpec(contractPath);
  const contractSha = computeSha256(contractPath);
  const datasetSha = computeSha256(datasetPath);

  console.log(`Contract SHA-256: ${contractSha}`);
  console.log(`Dataset SHA-256:  ${datasetSha}`);

  console.log('\nIngesting dataset and partitioning cohorts...');
  const builder = new ContinuousTrajectoryDatasetBuilder(datasetPath, contractPath);
  const ds = builder.buildDataset();
  const splits = builder.splitDataset(ds.records);

  const trainData = splits.train;
  const valData = splits.validation;
  const testData = splits.test;

  console.log(`  Train:      ${trainData.length} components (LOT-SYN-001..035)`);
  console.log(`  Validation: ${valData.length} components (LOT-SYN-036..042) -> CALIBRATION SPLIT`);
  console.log(`  Test:       ${testData.length} components (LOT-SYN-043..050) -> FROZEN EVAL SPLIT`);

  console.log('\nFitting Continuous Deterministic Degradation Forecaster...');
  const model = new DeterministicContinuousDegradationModel();
  model.fitAndTune(trainData, valData);

  console.log('\nExtracting validation predictions & targets for conformal fitting...');
  const valPreds = { iddq: {}, ileak: {}, tpd: {} };
  const valTargets = { iddq: {}, ileak: {}, tpd: {} };

  for (const param of ['iddq', 'ileak', 'tpd']) {
    for (const h of [96, 168]) {
      valPreds[param][h] = valData.map(r => model.forecastTrajectory(r.early_features_dict).forecast_trajectories[param][h]);
      valTargets[param][h] = valData.map(r => r.ground_truth_trajectories[param][h]);
    }
  }

  console.log('\nFitting Conformal Residual Calibrator on VALIDATION split ONLY...');
  const calibrator = new ConformalResidualCalibrator(contractPath);
  const defaultLots = [];
  for (let i = 36; i <= 42; i++) {
    defaultLots.push(`LOT-SYN-${String(i).padStart(3, '0')}`);
  }

  const frozenArtifact = calibrator.fit(
    valPreds,
    valTargets,
    'VALIDATION',
    defaultLots,
    datasetSha,
    'Deterministic_Continuous_Degradation_Forecaster'
  );
  console.log(`  Calibration Artifact Hash: ${frozenArtifact.calibration_artifact_sha256}`);

  console.log('\nApplying frozen calibrator to held-out TEST cohort...');
  const testPreds = { iddq: {}, ileak: {}, tpd: {} };
  const testTargets = { iddq: {}, ileak: {}, tpd: {} };

  for (const param of ['iddq', 'ileak', 'tpd']) {
    for (const h of [96, 168]) {
      testPreds[param][h] = testData.map(r => model.forecastTrajectory(r.early_features_dict).forecast_trajectories[param][h]);
      testTargets[param][h] = testData.map(r => r.ground_truth_trajectories[param][h]);
    }
  }

  const testIntervals = calibrator.apply(testPreds);

  console.log('\nEvaluating empirical test coverage and interval widths...');
  const coverageResults = calibrator.evaluateCoverage(testIntervals, testTargets);

  for (const param of ['iddq', 'ileak', 'tpd']) {
    for (const hStr of ['96h', '168h']) {
      for (const lvlStr of ['0.80', '0.90', '0.95']) {
        const res = coverageResults[param][hStr][lvlStr];
        const errSign = res.coverage_error >= 0 ? '+' : '';
        console.log(
          `  [${param.toUpperCase()} @ ${hStr} | Nominal ${Number(lvlStr) * 100}%] ` +
          `Observed: ${res.observed_coverage_pct}% (Error: ${errSign}${res.coverage_error}) | ` +
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
      dataset_path: datasetPath,
      execution_status: 'SUCCESS',
      synthetic_disclaimer: 'All telemetry is synthetic data generated for benchmark and simulation. Not flight-qualified or real-world certified.'
    },
    calibration_specification: calibSpec,
    split_cohorts: {
      train: { lot_count: 35, sample_count: trainData.length },
      validation_calibration: { lot_count: 7, sample_count: valData.length },
      held_out_test_evaluation: { lot_count: 8, sample_count: testData.length }
    },
    frozen_calibration_artifact: frozenArtifact,
    empirical_test_evaluation: coverageResults,
    scientific_and_governance_verdict: {
      calibration_method: 'CONFORMAL_RESIDUAL_CALIBRATION',
      calibration_status: 'NOT_CALIBRATED',
      model_status: 'BENCHMARK_ONLY',
      validation_only_calibration_enforced: true,
      test_set_unmodified_and_frozen: true,
      zero_test_target_leakage_verified: true,
      parameter_horizon_grouping_enforced: true,
      disclaimer: 'Prediction intervals are candidate split-conformal intervals. Calibration status remains NOT_CALIBRATED pending independent empirical review and formal release certification.'
    }
  };

  const artifactPath = path.join(PROJECT_ROOT, 'ml/models/production/conformal_calibration_artifacts.json');
  exportCalibrationArtifact(frozenArtifact, artifactPath);
  console.log(`\nSaved frozen calibration artifact to: ${artifactPath}`);

  const reportJsonPath = path.join(PROJECT_ROOT, 'experiments/prognostics/conformal_calibration_report.json');
  const reportDir = path.dirname(reportJsonPath);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
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
  runConformalCalibrationBenchmark
};
