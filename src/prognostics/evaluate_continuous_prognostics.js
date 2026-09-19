/**
 * Predicta Semiconductor Intelligence Platform — Authoritative Stage 5 Continuous Prognostics Evaluation Runner (Node.js)
 * File: src/prognostics/evaluate_continuous_prognostics.js
 */

const fs = require('fs');
const path = require('path');
const { buildAuthoritativeHorizonMatrix } = require('./conformal');
const {
  loadAuthoritativePrognosticContract,
  getAuthoritativeContinuousSpec,
  computeSha256,
  calculateContinuousRegressionMetrics,
  ContinuousTrajectoryDatasetBuilder,
  ContinuousPersistenceBaseline,
  DeterministicContinuousDegradationModel,
  evaluateThresholdProjections,
  evaluateLegacyGprGovernance
} = require('./trajectory');

function evaluateModelOnCohort(model, records, horizons = [96, 168]) {
  const results = {};
  for (const param of ['iddq', 'ileak', 'tpd']) {
    results[param] = {};
    for (const h of horizons) {
      const yTrue = [];
      const yPred = [];
      for (const r of records) {
        const gt = r.ground_truth_trajectories && r.ground_truth_trajectories[param] ? r.ground_truth_trajectories[param][h] : undefined;
        if (gt !== undefined) {
          const fc = model.forecastTrajectory(r.early_features_dict);
          const predVal = fc.forecast_trajectories[param][h];
          yTrue.push(gt);
          yPred.push(predVal);
        }
      }
      results[param][`${h}h`] = calculateContinuousRegressionMetrics(yTrue, yPred);
    }
  }
  return results;
}

function runContinuousPrognosticBenchmark() {
  console.log('================================================================================');
  console.log('PREDICTA-26 — AUTHORITATIVE CONTINUOUS 168H PROGNOSTIC BENCHMARK (NODE.JS)');
  console.log('================================================================================');

  const contractPath = path.resolve(__dirname, '../../ml/prognostics/prognostic_contract.json');
  const contract = loadAuthoritativePrognosticContract(contractPath);
  const spec = getAuthoritativeContinuousSpec(contractPath);
  const contractSha = computeSha256(contractPath);

  const datasetPath = path.resolve(__dirname, '../../data/synthetic/semiconductor_synthetic_full.csv');
  const datasetSha = computeSha256(datasetPath);

  const manifestPath = path.resolve(__dirname, '../../ml/data/split_manifest.json');
  const manifestSha = computeSha256(manifestPath);

  console.log(`Contract SHA-256: ${contractSha}`);
  console.log(`Dataset SHA-256:  ${datasetSha}`);
  console.log(`Manifest SHA-256: ${manifestSha}`);

  const builder = new ContinuousTrajectoryDatasetBuilder(datasetPath, contractPath);
  const ds = builder.buildDataset();
  const splits = builder.splitDataset(ds.records, manifestPath);

  const trainRecs = splits.train;
  const valTuneRecs = splits.validation_tune;
  const calibRecs = splits.calibration;
  const testRecs = splits.test;

  console.log(`Dataset Partitioning: Train=${trainRecs.length}, ValidationTune=${valTuneRecs.length}, Calibration=${calibRecs.length}, Test=${testRecs.length}`);

  console.log('\nEvaluating Continuous Persistence Baseline...');
  const persistence = new ContinuousPersistenceBaseline();
  const persistenceValMetrics = persistence.evaluate(valTuneRecs, [96, 168]);
  const persistenceTestMetrics = persistence.evaluate(testRecs, [96, 168]);

  console.log('Fitting & Tuning Deterministic Continuous Degradation Model on ValidationTune (LOT-SYN-036..038)...');
  const model = new DeterministicContinuousDegradationModel();
  model.fitAndTune(trainRecs, valTuneRecs, manifestPath);

  console.log('Evaluating Frozen Degradation Model on Held-Out Test Cohort (LOT-SYN-043..050)...');
  const testEval = model.evaluateFrozenTest(testRecs, false);
  const degradationTestMetrics = testEval.metrics;
  const degradationTestCoverage = testEval.coverage;

  const degradationValMetrics = evaluateModelOnCohort(model, valTuneRecs, [96, 168]);
  const degradationCalibMetrics = evaluateModelOnCohort(model, calibRecs, [96, 168]);

  console.log('Evaluating Projected Threshold Breaches on Held-Out Test Cohort...');
  const testBreachCounts = { iddq: 0, ileak: 0, tpd: 0, overall: 0 };
  const testSampleProjections = [];

  for (const r of testRecs) {
    const fc = model.forecastTrajectory(r.early_features_dict);
    const proj = evaluateThresholdProjections(fc.forecast_trajectories, null, contractPath);
    if (proj.overall_breach_projected) {
      testBreachCounts.overall++;
    }
    for (const p of ['iddq', 'ileak', 'tpd']) {
      if (proj.parameter_projections[p].breach_projected) {
        testBreachCounts[p]++;
      }
    }

    if (testSampleProjections.length < 5) {
      testSampleProjections.push({
        component_id: r.component_id,
        lot_id: r.lot_id,
        overall_breach: proj.overall_breach_projected,
        earliest_breach_hour: proj.earliest_breach_hour,
        parameter_projections: {
          iddq: {
            breach: proj.parameter_projections.iddq.breach_projected,
            earliest_hour: proj.parameter_projections.iddq.earliest_crossing_hour,
            forecast_168h: proj.parameter_projections.iddq.forecast_at_168h
          },
          ileak: {
            breach: proj.parameter_projections.ileak.breach_projected,
            earliest_hour: proj.parameter_projections.ileak.earliest_crossing_hour,
            forecast_168h: proj.parameter_projections.ileak.forecast_at_168h
          },
          tpd: {
            breach: proj.parameter_projections.tpd.breach_projected,
            earliest_hour: proj.parameter_projections.tpd.earliest_crossing_hour,
            forecast_168h: proj.parameter_projections.tpd.forecast_at_168h
          }
        }
      });
    }
  }

  console.log('Auditing Legacy GPR Artifact Governance...');
  const gprAudit = evaluateLegacyGprGovernance();

  const horizonMatrixInfo = buildAuthoritativeHorizonMatrix(
    spec.supported_horizons,
    spec.evaluated_ground_truth_horizons,
    spec.target_parameters
  );

  const report = {
    report_metadata: {
      title: 'Authoritative Stage 5 Continuous Prognostics Benchmark Report',
      generated_at_utc: new Date().toISOString(),
      contract_version: contract.contract_version,
      contract_sha256: contractSha,
      dataset_sha256: datasetSha,
      manifest_sha256: manifestSha,
      dataset_path: 'data/synthetic/semiconductor_synthetic_full.csv',
      execution_status: 'SUCCESS',
      synthetic_disclaimer: 'All telemetry is synthetic data generated for benchmark and simulation. Not flight-qualified or real-world certified.'
    },
    continuous_specification: {
      task_name: spec.task_name,
      forecast_origin_hours: spec.forecast_origins,
      supported_horizons: spec.supported_horizons,
      evaluated_ground_truth_horizons: spec.evaluated_ground_truth_horizons,
      target_parameters: spec.target_parameters,
      target_units: spec.target_units,
      allowed_early_observation_features: spec.allowed_early_observation_features,
      forbidden_future_fields: spec.forbidden_future_fields,
      screening_criteria_type: spec.screening_criteria_type,
      parametric_screening_limits: spec.parametric_screening_limits,
      model_status: spec.model_status,
      calibration_status: spec.calibration_status
    },
    horizon_governance_matrix: {
      matrix: horizonMatrixInfo.matrix,
      accounting: {
        total_contract_declared_groups: horizonMatrixInfo.total_declared_groups,
        currently_data_supported_groups: horizonMatrixInfo.calibrated_groups_count,
        currently_evaluated_calibration_candidate_groups: horizonMatrixInfo.calibrated_groups_count,
        not_evaluated_groups: horizonMatrixInfo.not_evaluated_groups_count,
        data_unavailable_groups: horizonMatrixInfo.unavailable_groups_count
      }
    },
    split_cohorts: {
      train: {
        lots: Array.from({ length: 35 }, (_, i) => `LOT-SYN-${String(i + 1).padStart(3, '0')}`),
        lot_count: 35,
        sample_count: trainRecs.length,
        role: 'POINT_MODEL_FITTING'
      },
      validation_tune: {
        lots: Array.from({ length: 3 }, (_, i) => `LOT-SYN-${String(i + 36).padStart(3, '0')}`),
        lot_count: 3,
        sample_count: valTuneRecs.length,
        role: 'HYPERPARAMETER_SELECTION_ONLY'
      },
      calibration: {
        lots: Array.from({ length: 4 }, (_, i) => `LOT-SYN-${String(i + 39).padStart(3, '0')}`),
        lot_count: 4,
        sample_count: calibRecs.length,
        role: 'CONFORMAL_CALIBRATION_ONLY_FORBIDDEN_FROM_TUNING'
      },
      test: {
        lots: Array.from({ length: 8 }, (_, i) => `LOT-SYN-${String(i + 43).padStart(3, '0')}`),
        lot_count: 8,
        sample_count: testRecs.length,
        role: 'FROZEN_HELD_OUT_EVALUATION_ONLY'
      },
      historical_validation_aggregate: {
        lots: Array.from({ length: 7 }, (_, i) => `LOT-SYN-${String(i + 36).padStart(3, '0')}`),
        lot_count: 7,
        sample_count: valTuneRecs.length + calibRecs.length,
        status: 'NON-AUTHORITATIVE AGGREGATE / HISTORICAL COMPATIBILITY VIEW'
      }
    },
    models_evaluated: [
      {
        model_name: persistence.name,
        algorithm: persistence.algorithm,
        status: persistence.status,
        calibration_status: 'NOT_APPLICABLE'
      },
      {
        model_name: model.name,
        algorithm: model.algorithm,
        status: model.status,
        calibration_status: model.calibration_status,
        hyperparameters_frozen: true,
        optimal_hyperparameters_tuned_on_validation_tune: model.optimal_alphas,
        calibration_cohort_used_for_fitting: false
      }
    ],
    benchmark_metrics: {
      validation_tune_cohort: {
        persistence_baseline: persistenceValMetrics,
        deterministic_degradation_model: degradationValMetrics
      },
      calibration_cohort_diagnostics: {
        deterministic_degradation_model: degradationCalibMetrics
      },
      held_out_test_cohort: {
        persistence_baseline: persistenceTestMetrics,
        deterministic_degradation_model: degradationTestMetrics,
        empirical_uncertainty_coverage_diagnostics: degradationTestCoverage
      }
    },
    threshold_screening_projections: {
      screening_criteria_source: 'PROJECT_DEFINED_SCREENING_CRITERION',
      test_sample_count: testRecs.length,
      projected_breach_counts: testBreachCounts,
      projected_breach_percentages: {
        iddq: Number(((testBreachCounts.iddq / testRecs.length) * 100).toFixed(2)),
        ileak: Number(((testBreachCounts.ileak / testRecs.length) * 100).toFixed(2)),
        tpd: Number(((testBreachCounts.tpd / testRecs.length) * 100).toFixed(2)),
        overall: Number(((testBreachCounts.overall / testRecs.length) * 100).toFixed(2))
      },
      sample_component_projections: testSampleProjections
    },
    legacy_gpr_audit: gprAudit
  };

  const outDir = path.resolve(__dirname, '../../experiments/prognostics');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const jsonPath = path.join(outDir, 'continuous_prognostic_benchmark_report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nSaved benchmark JSON report to: ${jsonPath}`);

  console.log('\n================================================================================');
  console.log('CONTINUOUS PROGNOSTIC BENCHMARK (NODE.JS) COMPLETED SUCCESSFULLY');
  console.log('================================================================================');

  return report;
}

if (require.main === module) {
  runContinuousPrognosticBenchmark();
}

module.exports = {
  runContinuousPrognosticBenchmark
};
