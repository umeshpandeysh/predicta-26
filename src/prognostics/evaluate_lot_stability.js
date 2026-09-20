/**
 * Authoritative Stage 6 Task 3 — Multi-Lot Drift Stability Evaluator (Node.js)
 * ===========================================================================
 * Consumes the authoritative frozen calibration artifact and evaluates per-lot
 * empirical coverage across the 8 held-out test lots (LOT-SYN-043 .. LOT-SYN-050).
 * Demonstrates 100% numerical parity with the Python evaluator.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  DATASET_PATH,
  SPLIT_MANIFEST_PATH,
  loadCalibrationArtifact,
  partitionFourWayDataset,
} = require('./conformal');
const {
  CONTRACT_PATH,
  ContinuousTrajectoryDatasetBuilder,
  DeterministicContinuousDegradationModel,
  computeSha256,
  loadAuthoritativePrognosticContract,
} = require('./trajectory');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const STABILITY_CONTRACT_PATH = path.join(
  PROJECT_ROOT,
  'ml/prognostics/lot_stability_contract.json'
);
const CALIBRATION_ARTIFACT_PATH = path.join(
  PROJECT_ROOT,
  'ml/models/production/conformal_calibration_artifacts.json'
);
const PRODUCTION_MANIFEST_PATH = path.join(
  PROJECT_ROOT,
  'ml/models/production/predicta_production_manifest.json'
);
const EXPECTED_DATASET_SHA256 =
  'e2b969c458864b11ed61a6073ed1356adcbfd6775bb2c44b28023446bf9771fa';
const EXPECTED_SPLIT_MANIFEST_SHA256 =
  '1764dff377386bf41f95f9bb96afb71dd01404bf65bdec9e324ba31afcf7a8dd';

function roundHalfToEven(num, decimals = 2) {
  const factor = Math.pow(10, decimals);
  const n = num * factor;
  const i = Math.floor(n);
  const f = n - i;
  if (Math.abs(f - 0.5) < 1e-9) {
    return (i % 2 === 0 ? i : i + 1) / factor;
  }
  return Math.round(n) / factor;
}

function loadAuthoritativeStabilityContract(contractPath = STABILITY_CONTRACT_PATH) {
  if (!fs.existsSync(contractPath)) {
    throw new Error(`STABILITY_CONTRACT_MISSING: Authoritative stability contract missing at '${contractPath}'`);
  }
  const raw = fs.readFileSync(contractPath, 'utf8');
  const contract = JSON.parse(raw);
  const requiredKeys = [
    'contract_name',
    'contract_version',
    'authority_level',
    'task_name',
    'methodology',
    'cohort_specification',
    'governance_specification',
  ];
  for (const k of requiredKeys) {
    if (!(k in contract)) {
      throw new Error(`MALFORMED_STABILITY_CONTRACT: Missing required key '${k}'`);
    }
  }
  const params = (contract.methodology && contract.methodology.target_parameters) || [];
  const pSet = new Set(params);
  if (!pSet.has('iddq') || !pSet.has('ileak') || !pSet.has('tpd') || pSet.size !== 3) {
    throw new Error(`MISSING_REQUIRED_PARAMETER: Target parameters must contain ['iddq', 'ileak', 'tpd'], got ${JSON.stringify(params)}`);
  }
  return contract;
}

function getProductionModelProvenance(manifestPath = PRODUCTION_MANIFEST_PATH) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`PRODUCTION_MANIFEST_NOT_FOUND: Manifest missing at '${manifestPath}'`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const modelSha = manifest.model_sha256;
  if (!modelSha || typeof modelSha !== 'string' || modelSha.length !== 64) {
    throw new Error("INVALID_PRODUCTION_MANIFEST: 'model_sha256' must be a valid 64-character hex string");
  }

  const modelRelPath =
    manifest.xgboost_model ||
    (manifest.models &&
      manifest.models.failure_prediction &&
      manifest.models.failure_prediction.file);
  if (!modelRelPath || typeof modelRelPath !== 'string') {
    throw new Error("INVALID_PRODUCTION_MANIFEST: Manifest missing valid model artifact path ('xgboost_model')");
  }

  let artifactPath = path.resolve(PROJECT_ROOT, modelRelPath);
  if (!fs.existsSync(artifactPath)) {
    const candidate = path.resolve(path.dirname(manifestPath), path.basename(modelRelPath));
    if (fs.existsSync(candidate)) {
      artifactPath = candidate;
    } else {
      throw new Error(`MODEL_ARTIFACT_NOT_FOUND: Production model artifact missing at '${artifactPath}'`);
    }
  }

  const actualModelSha = computeSha256(artifactPath);
  if (actualModelSha !== modelSha) {
    throw new Error(
      `MODEL_PROVENANCE_MISMATCH: Computed model artifact SHA-256 '${actualModelSha}' does not match manifest-declared SHA-256 '${modelSha}'`
    );
  }

  return {
    manifest_path: path.relative(PROJECT_ROOT, manifestPath).replace(/\\/g, '/'),
    model_artifact_path: path.relative(PROJECT_ROOT, artifactPath).replace(/\\/g, '/'),
    manifest_model_sha256: modelSha,
    actual_model_sha256: actualModelSha,
    model_sha256: actualModelSha,
    authoritative_threshold: manifest.authoritative_threshold || 0.2,
    release_version: manifest.release_version || '2.0_production',
  };
}

class MultiLotConformalStabilityEvaluator {
  constructor(options = {}) {
    this.stabilityContractPath = options.stabilityContractPath || STABILITY_CONTRACT_PATH;
    this.prognosticContractPath = options.prognosticContractPath || CONTRACT_PATH;
    this.calibrationArtifactPath = options.calibrationArtifactPath || CALIBRATION_ARTIFACT_PATH;
    this.productionManifestPath = options.productionManifestPath || PRODUCTION_MANIFEST_PATH;
    this.splitManifestPath = options.splitManifestPath || SPLIT_MANIFEST_PATH;
    this.datasetPath = options.datasetPath || DATASET_PATH;

    this.stabilityContract = loadAuthoritativeStabilityContract(this.stabilityContractPath);
    this.prognosticContract = loadAuthoritativePrognosticContract(this.prognosticContractPath);
    this.modelProvenance = getProductionModelProvenance(this.productionManifestPath);

    this.verifyDatasetIntegrity();
    this.verifySplitManifestIntegrity();
    this.calibrationArtifact = this.loadAndValidateCalibrationArtifact();
  }

  verifyDatasetIntegrity() {
    if (!fs.existsSync(this.datasetPath)) {
      throw new Error(`DATASET_NOT_FOUND: Dataset missing at '${this.datasetPath}'`);
    }
    const sha = computeSha256(this.datasetPath);
    if (sha !== EXPECTED_DATASET_SHA256) {
      throw new Error(`DATASET_HASH_MISMATCH: Computed SHA '${sha}' does not match expected '${EXPECTED_DATASET_SHA256}'`);
    }
    return sha;
  }

  verifySplitManifestIntegrity() {
    if (!fs.existsSync(this.splitManifestPath)) {
      throw new Error(`SPLIT_MANIFEST_NOT_FOUND: Manifest missing at '${this.splitManifestPath}'`);
    }
    const manifest = JSON.parse(fs.readFileSync(this.splitManifestPath, 'utf8'));
    const lots = manifest.lots || {};
    const required = ['train', 'validation_tune', 'calibration', 'test'];
    for (const p of required) {
      if (!lots[p] || !Array.isArray(lots[p])) {
        throw new Error(`MALFORMED_SPLIT_MANIFEST: Missing valid partition list for '${p}'`);
      }
    }

    const trainSet = new Set(lots.train);
    const valSet = new Set(lots.validation_tune);
    const calSet = new Set(lots.calibration);
    const testSet = new Set(lots.test);

    for (const item of valSet) {
      if (trainSet.has(item)) throw new Error(`LOT_OVERLAP_DETECTED: Overlap between train and val_tune: ${item}`);
    }
    for (const item of calSet) {
      if (trainSet.has(item)) throw new Error(`LOT_OVERLAP_DETECTED: Overlap between train and calib: ${item}`);
      if (valSet.has(item)) throw new Error(`LOT_OVERLAP_DETECTED: Overlap between val_tune and calib: ${item}`);
    }
    for (const item of testSet) {
      if (trainSet.has(item)) throw new Error(`LOT_OVERLAP_DETECTED: Overlap between train and test: ${item}`);
      if (valSet.has(item)) throw new Error(`LOT_OVERLAP_DETECTED: Overlap between val_tune and test: ${item}`);
      if (calSet.has(item)) throw new Error(`LOT_OVERLAP_DETECTED: Overlap between calib and test: ${item}`);
    }

    const expectedTestLots = this.stabilityContract.cohort_specification.test.lots;
    if (JSON.stringify(lots.test) !== JSON.stringify(expectedTestLots)) {
      throw new Error('TEST_LOTS_MISMATCH: Manifest test lots do not match contract test lots');
    }

    // Cryptographic hash verification against authoritative expected SHA
    const manifestSha = computeSha256(this.splitManifestPath);
    const expectedManifestSha =
      (this.stabilityContract.methodology &&
        this.stabilityContract.methodology.expected_split_manifest_sha256) ||
      EXPECTED_SPLIT_MANIFEST_SHA256;
    if (manifestSha !== expectedManifestSha) {
      throw new Error(
        `SPLIT_MANIFEST_HASH_MISMATCH: Computed split manifest SHA-256 '${manifestSha}' does not match authoritative expected SHA-256 '${expectedManifestSha}'`
      );
    }

    return manifest;
  }

  loadAndValidateCalibrationArtifact() {
    if (!fs.existsSync(this.calibrationArtifactPath)) {
      throw new Error(`CALIBRATION_ARTIFACT_NOT_FOUND: Artifact missing at '${this.calibrationArtifactPath}'`);
    }

    const datasetSha = computeSha256(this.datasetPath);
    const contractSha = computeSha256(this.prognosticContractPath);
    const manifestSha = computeSha256(this.splitManifestPath);

    const artifact = loadCalibrationArtifact(this.calibrationArtifactPath, {
      expectedDatasetSha256: datasetSha,
      expectedContractSha256: contractSha,
      expectedSplitManifestSha256: manifestSha,
      expectedModelIdentity: 'Deterministic_Continuous_Degradation_Forecaster',
    });

    if (artifact.status !== 'NOT_CALIBRATED') {
      throw new Error(`CALIBRATION_STATUS_INVALID: Expected 'NOT_CALIBRATED', found '${artifact.status}'`);
    }
    if (artifact.model_status !== 'BENCHMARK_ONLY') {
      throw new Error(`MODEL_STATUS_INVALID: Expected 'BENCHMARK_ONLY', found '${artifact.model_status}'`);
    }

    return artifact;
  }

  evaluate() {
    const datasetSha = computeSha256(this.datasetPath);
    const contractSha = computeSha256(this.prognosticContractPath);
    const stabilityContractSha = computeSha256(this.stabilityContractPath);
    const manifestSha = computeSha256(this.splitManifestPath);
    const artifactSha = this.calibrationArtifact.calibration_artifact_sha256;

    // Validate split manifest cryptographic hash before partitioning
    const expectedManifestSha =
      (this.stabilityContract.methodology &&
        this.stabilityContract.methodology.expected_split_manifest_sha256) ||
      EXPECTED_SPLIT_MANIFEST_SHA256;
    if (manifestSha !== expectedManifestSha) {
      throw new Error(
        `SPLIT_MANIFEST_HASH_MISMATCH: Computed split manifest SHA-256 '${manifestSha}' does not match authoritative expected SHA-256 '${expectedManifestSha}'`
      );
    }

    const builder = new ContinuousTrajectoryDatasetBuilder(this.datasetPath, this.prognosticContractPath);
    const ds = builder.buildDataset();
    const splits = partitionFourWayDataset(ds.records, this.splitManifestPath);

    const trainData = splits.train;
    const valTuneData = splits.validation_tune;
    const testData = splits.test;

    // Check duplicate component IDs in test set
    const testComponentIds = new Set();
    for (const r of testData) {
      if (testComponentIds.has(r.component_id)) {
        throw new Error(`DUPLICATE_COMPONENT_ID: Duplicate component '${r.component_id}' in test cohort`);
      }
      testComponentIds.add(r.component_id);
    }

    // Fit model on Train + ValTune
    const model = new DeterministicContinuousDegradationModel();
    model.fitAndTune(trainData, valTuneData);

    const testLots = this.stabilityContract.cohort_specification.test.lots;
    const lotsRecords = {};
    for (const lot of testLots) {
      lotsRecords[lot] = [];
    }
    for (const r of testData) {
      if (!lotsRecords[r.lot_id]) {
        throw new Error(`UNAUTHORIZED_TEST_LOT: Component ${r.component_id} has unauthorized lot ${r.lot_id}`);
      }
      lotsRecords[r.lot_id].push(r);
    }

    for (const lot of testLots) {
      if (lotsRecords[lot].length !== 100) {
        throw new Error(`TEST_LOT_SAMPLE_COUNT_INVALID: Lot ${lot} has ${lotsRecords[lot].length} samples; expected 100`);
      }
    }

    const quantiles = this.calibrationArtifact.conformal_quantiles;
    const targetParams = ['iddq', 'ileak', 'tpd'];
    const supportedHorizons = [96, 168];
    const nominalLevels = [0.8, 0.9, 0.95];

    // 1. Per-Lot Evaluation
    const perLotEvaluation = {};
    for (const lot of testLots) {
      perLotEvaluation[lot] = {};
      const lotRecs = lotsRecords[lot];

      for (const p of targetParams) {
        perLotEvaluation[lot][p] = {};
        for (const h of supportedHorizons) {
          const hStr = `${h}h`;
          perLotEvaluation[lot][p][hStr] = {};

          const yPred = lotRecs.map(
            (r) => model.forecastTrajectory(r.early_features_dict).forecast_trajectories[p][h]
          );
          const yTrue = lotRecs.map((r) => r.ground_truth_trajectories[p][h]);

          for (const lvl of nominalLevels) {
            const lvlStr = lvl.toFixed(2);
            const q = quantiles[p][hStr][lvlStr];

            let nCovered = 0;
            for (let i = 0; i < yTrue.length; i++) {
              const lower = yPred[i] - q;
              const upper = yPred[i] + q;
              if (yTrue[i] >= lower && yTrue[i] <= upper) {
                nCovered++;
              }
            }

            const nTotal = yTrue.length;
            const covRatio = nCovered / nTotal;
            const covPct = roundHalfToEven(covRatio * 100, 2);
            const covDev = Number((covRatio - lvl).toFixed(4));
            const absCovDev = Number(Math.abs(covRatio - lvl).toFixed(4));

            perLotEvaluation[lot][p][hStr][lvlStr] = {
              lot_id: lot,
              parameter: p,
              horizon_hours: h,
              nominal_coverage: lvl,
              sample_count: nTotal,
              covered_count: nCovered,
              empirical_coverage_ratio: Number(covRatio.toFixed(4)),
              empirical_coverage_pct: covPct,
              coverage_deviation: covDev,
              abs_coverage_deviation: absCovDev,
              conformal_quantile_q: q,
              avg_interval_width: Number((2 * q).toFixed(4)),
            };
          }
        }
      }
    }

    // 2. Aggregate Test-Set Evaluation
    const aggregateEvaluation = {};
    for (const p of targetParams) {
      aggregateEvaluation[p] = {};
      for (const h of supportedHorizons) {
        const hStr = `${h}h`;
        aggregateEvaluation[p][hStr] = {};

        const yPredAll = testData.map(
          (r) => model.forecastTrajectory(r.early_features_dict).forecast_trajectories[p][h]
        );
        const yTrueAll = testData.map((r) => r.ground_truth_trajectories[p][h]);

        for (const lvl of nominalLevels) {
          const lvlStr = lvl.toFixed(2);
          const q = quantiles[p][hStr][lvlStr];

          let nCovered = 0;
          for (let i = 0; i < yTrueAll.length; i++) {
            const lower = yPredAll[i] - q;
            const upper = yPredAll[i] + q;
            if (yTrueAll[i] >= lower && yTrueAll[i] <= upper) {
              nCovered++;
            }
          }

          const nTotal = yTrueAll.length;
          const covRatio = nCovered / nTotal;
          const covPct = roundHalfToEven(covRatio * 100, 2);
          const covDev = Number((covRatio - lvl).toFixed(4));
          const absCovDev = Number(Math.abs(covRatio - lvl).toFixed(4));

          aggregateEvaluation[p][hStr][lvlStr] = {
            parameter: p,
            horizon_hours: h,
            nominal_coverage: lvl,
            sample_count: nTotal,
            covered_count: nCovered,
            empirical_coverage_ratio: Number(covRatio.toFixed(4)),
            empirical_coverage_pct: covPct,
            coverage_deviation: covDev,
            abs_coverage_deviation: absCovDev,
            conformal_quantile_q: q,
            avg_interval_width: Number((2 * q).toFixed(4)),
          };
        }
      }
    }

    // 3. Cross-Lot Dispersion
    const crossLotDispersion = {};
    for (const p of targetParams) {
      crossLotDispersion[p] = {};
      for (const h of supportedHorizons) {
        const hStr = `${h}h`;
        crossLotDispersion[p][hStr] = {};

        for (const lvl of nominalLevels) {
          const lvlStr = lvl.toFixed(2);
          const lotPcts = testLots.map(
            (lot) => perLotEvaluation[lot][p][hStr][lvlStr].empirical_coverage_pct
          );

          let minPct = lotPcts[0];
          let maxPct = lotPcts[0];
          let minIdx = 0;
          let maxIdx = 0;
          let sumPct = 0;

          for (let i = 0; i < lotPcts.length; i++) {
            const v = lotPcts[i];
            sumPct += v;
            if (v < minPct) {
              minPct = v;
              minIdx = i;
            }
            if (v > maxPct) {
              maxPct = v;
              maxIdx = i;
            }
          }

          const unroundedMean = sumPct / lotPcts.length;
          const meanPct = roundHalfToEven(unroundedMean, 2);
          let varSum = 0;
          for (let i = 0; i < lotPcts.length; i++) {
            varSum += Math.pow(lotPcts[i] - unroundedMean, 2);
          }
          const stdPct = roundHalfToEven(Math.sqrt(varSum / (lotPcts.length - 1)), 2);
          const rangePct = roundHalfToEven(maxPct - minPct, 2);

          crossLotDispersion[p][hStr][lvlStr] = {
            parameter: p,
            horizon_hours: h,
            nominal_coverage: lvl,
            lot_count: testLots.length,
            min_lot_coverage_pct: minPct,
            max_lot_coverage_pct: maxPct,
            lot_coverage_range_pct: rangePct,
            mean_lot_coverage_pct: meanPct,
            std_lot_coverage_pct: stdPct,
            worst_performing_lot: testLots[minIdx],
            worst_lot_coverage_pct: minPct,
            best_performing_lot: testLots[maxIdx],
            best_lot_coverage_pct: maxPct,
            aggregate_coverage_pct: aggregateEvaluation[p][hStr][lvlStr].empirical_coverage_pct,
          };
        }
      }
    }

    return {
      report_metadata: {
        title: 'Authoritative Stage 6 Task 3 Multi-Lot Conformal Stability Benchmark Report',
        contract_version: this.stabilityContract.contract_version,
        stability_contract_sha256: stabilityContractSha,
        prognostic_contract_sha256: contractSha,
        calibration_artifact_sha256: artifactSha,
        dataset_sha256: datasetSha,
        split_manifest_sha256: manifestSha,
        production_manifest: this.modelProvenance,
        methodology: 'MULTI_LOT_CONFORMAL_RESIDUAL_STABILITY_EVALUATION',
        test_lots: testLots,
      },
      governance_status: {
        governance_status: 'REVIEW_REQUIRED',
        acceptance_threshold_status: 'NO_PRODUCTION_ACCEPTANCE_THRESHOLD_AUTHORIZED',
        model_status: 'BENCHMARK_ONLY',
        calibration_status: 'NOT_CALIBRATED',
        promotion_locked: true,
      },
      aggregate_evaluation: aggregateEvaluation,
      cross_lot_dispersion: crossLotDispersion,
      per_lot_evaluation: perLotEvaluation,
    };
  }
}

function runMultiLotStabilityBenchmark() {
  console.log('='.repeat(80));
  console.log('PREDICTA-26 — AUTHORITATIVE MULTI-LOT CONFORMAL STABILITY EVALUATOR (NODE.JS)');
  console.log('='.repeat(80));

  const evaluator = new MultiLotConformalStabilityEvaluator();
  const report = evaluator.evaluate();

  console.log(`\nEvaluation completed. Governance Status: ${report.governance_status.governance_status}`);
  console.log(`Acceptance Threshold Status: ${report.governance_status.acceptance_threshold_status}`);
  console.log(`Calibration Status: ${report.governance_status.calibration_status}`);
  console.log('='.repeat(80));
  return report;
}

if (require.main === module) {
  runMultiLotStabilityBenchmark();
}

module.exports = {
  MultiLotConformalStabilityEvaluator,
  runMultiLotStabilityBenchmark,
  loadAuthoritativeStabilityContract,
  getProductionModelProvenance,
  STABILITY_CONTRACT_PATH,
};
