/**
 * Authoritative Stage 6 Conformal Residual Calibration Module (Node.js)
 * ====================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  loadAuthoritativePrognosticContract,
  CONTRACT_PATH,
  computeSha256,
} = require('./trajectory');

const DATASET_PATH = path.resolve(__dirname, '../../data/synthetic/semiconductor_synthetic_full.csv');
const SPLIT_MANIFEST_PATH = path.resolve(__dirname, '../../ml/data/split_manifest.json');

function canonicalJsonStringify(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJsonStringify(obj[k])).join(',') + '}';
}

function getAuthoritativeCalibrationSpec(contractPath = null) {
  const contract = loadAuthoritativePrognosticContract(contractPath);
  if (!contract.uncertainty_calibration_specification) {
    throw new Error("AUTHORITATIVE_PROGNOSTIC_CONTRACT_INVALID: Missing 'uncertainty_calibration_specification'");
  }
  const spec = contract.uncertainty_calibration_specification;
  const requiredKeys = [
    'method',
    'model_tuning_split',
    'calibration_split',
    'evaluation_split',
    'forecast_origins',
    'declared_contract_horizons',
    'supported_dataset_horizons',
    'target_parameters',
    'candidate_nominal_levels',
    'minimum_calibration_samples',
    'aggregation_method',
    'residual_definition',
    'interval_construction_method',
    'finite_sample_quantile_rule',
    'finite_value_policy',
    'status',
    'model_status',
  ];
  for (const k of requiredKeys) {
    if (spec[k] === undefined) {
      throw new Error(`AUTHORITATIVE_PROGNOSTIC_CONTRACT_INVALID: Missing required key '${k}' in calibration spec`);
    }
  }
  return spec;
}

function partitionFourWayDataset(records, splitManifestPath = null) {
  const manifestPath = splitManifestPath || SPLIT_MANIFEST_PATH;
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`SPLIT_MANIFEST_MISSING: Authoritative split manifest required at '${manifestPath}'`);
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    throw new Error(`MALFORMED_SPLIT_MANIFEST: Could not parse JSON from '${manifestPath}': ${e.message}`);
  }

  if (!manifest || typeof manifest !== 'object' || !manifest.lots || typeof manifest.lots !== 'object') {
    throw new Error(`MALFORMED_SPLIT_MANIFEST: Manifest must contain a 'lots' object at '${manifestPath}'`);
  }

  const lotsDict = manifest.lots;
  const requiredPartitions = ['train', 'validation_tune', 'calibration', 'test'];
  for (const part of requiredPartitions) {
    if (!lotsDict[part]) {
      throw new Error(`MISSING_SPLIT_PARTITION: Split manifest missing required partition '${part}'`);
    }
    if (!Array.isArray(lotsDict[part])) {
      throw new Error(`MALFORMED_SPLIT_MANIFEST: Partition '${part}' in manifest must be an array of lot IDs`);
    }
  }

  const trainLots = new Set(lotsDict.train);
  const valTuneLots = new Set(lotsDict.validation_tune);
  const calibLots = new Set(lotsDict.calibration);
  const testLots = new Set(lotsDict.test);

  // Disjointness check
  for (const lot of trainLots) {
    if (valTuneLots.has(lot) || calibLots.has(lot) || testLots.has(lot)) {
      throw new Error(`LOT_OVERLAP_DETECTED: Train lot ${lot} overlaps with other splits`);
    }
  }
  for (const lot of valTuneLots) {
    if (calibLots.has(lot) || testLots.has(lot)) {
      throw new Error(`LOT_OVERLAP_DETECTED: ValTune lot ${lot} overlaps with other splits`);
    }
  }
  for (const lot of calibLots) {
    if (testLots.has(lot)) {
      throw new Error(`LOT_OVERLAP_DETECTED: Calib lot ${lot} overlaps with test split`);
    }
  }

  // Verify expected lot counts
  if (trainLots.size !== 35 || valTuneLots.size !== 3 || calibLots.size !== 4 || testLots.size !== 8) {
    throw new Error(
      `INCOMPLETE_SPLIT_ASSIGNMENT: Expected 35 train, 3 val_tune, 4 calib, 8 test lots; got ${trainLots.size}, ${valTuneLots.size}, ${calibLots.size}, ${testLots.size}`
    );
  }

  const trainRecs = [];
  const valTuneRecs = [];
  const calibRecs = [];
  const testRecs = [];

  const seenComponents = new Set();

  for (const r of records) {
    const cid = r.component_id;
    if (seenComponents.has(cid)) {
      throw new Error(`DUPLICATE_COMPONENT_ID: Component ${cid} appears multiple times`);
    }
    seenComponents.add(cid);

    const lot = r.lot_id;
    if (trainLots.has(lot)) {
      trainRecs.push(r);
    } else if (valTuneLots.has(lot)) {
      valTuneRecs.push(r);
    } else if (calibLots.has(lot)) {
      calibRecs.push(r);
    } else if (testLots.has(lot)) {
      testRecs.push(r);
    } else {
      throw new Error(`UNKNOWN_LOT_ID: Component ${cid} belongs to unauthorized lot ${lot}`);
    }
  }

  const totalAssigned = trainRecs.length + valTuneRecs.length + calibRecs.length + testRecs.length;
  if (totalAssigned !== records.length) {
    throw new Error(`SPLIT_INCOMPLETE: Total assigned (${totalAssigned}) != total records (${records.length})`);
  }

  if (records.length === 5000) {
    if (
      trainRecs.length !== 3500 ||
      valTuneRecs.length !== 300 ||
      calibRecs.length !== 400 ||
      testRecs.length !== 800
    ) {
      throw new Error(
        `SPLIT_INCOMPLETE: Full dataset partition counts mismatch expected (3500/300/400/800), got ${trainRecs.length}/${valTuneRecs.length}/${calibRecs.length}/${testRecs.length}`
      );
    }
  }

  return {
    train: trainRecs,
    validation_tune: valTuneRecs,
    calibration: calibRecs,
    test: testRecs,
  };
}

function buildHorizonStatusMatrix(
  declaredHorizons = null,
  supportedDatasetHorizons = null,
  targetParameters = null
) {
  const horizons = declaredHorizons || [24, 48, 72, 96, 120, 144, 168];
  const supported = new Set(supportedDatasetHorizons || [96, 168]);
  const params = targetParameters || ['iddq', 'ileak', 'tpd'];

  const matrix = {};
  let calibratedCount = 0;
  let unavailableCount = 0;
  let notEvaluatedCount = 0;

  for (const p of params) {
    matrix[p] = {};
    for (const h of horizons) {
      const hStr = `${h}h`;
      if (h === 24) {
        matrix[p][hStr] = 'NOT_EVALUATED';
        notEvaluatedCount++;
      } else if (supported.has(h)) {
        matrix[p][hStr] = 'CALIBRATED_CANDIDATE';
        calibratedCount++;
      } else {
        matrix[p][hStr] = 'DATA_UNAVAILABLE';
        unavailableCount++;
      }
    }
  }

  return {
    matrix,
    total_declared_groups: params.length * horizons.length,
    calibrated_groups_count: calibratedCount,
    unavailable_groups_count: unavailableCount,
    not_evaluated_groups_count: notEvaluatedCount,
  };
}

function computeFiniteSampleConformalQuantile(
  residuals,
  nominalCoverage,
  rule = 'CEIL_N_PLUS_ONE_TIMES_COVERAGE_DIVIDED_BY_N'
) {
  if (typeof nominalCoverage !== 'number' || nominalCoverage <= 0.0 || nominalCoverage >= 1.0) {
    throw new Error(`INVALID_COVERAGE_LEVEL: nominalCoverage must be strictly between 0 and 1, got ${nominalCoverage}`);
  }

  if (!Array.isArray(residuals) || residuals.length === 0) {
    throw new Error('INSUFFICIENT_CALIBRATION_DATA: Residual array is empty');
  }

  for (let i = 0; i < residuals.length; i++) {
    const v = residuals[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error('NON_FINITE_RESIDUAL_REJECTED: Calibration residuals must all be finite numbers');
    }
    if (v < 0.0) {
      throw new Error('NEGATIVE_RESIDUAL_REJECTED: Absolute residuals must be non-negative');
    }
  }

  const sorted = residuals.slice().sort((a, b) => a - b);
  const n = sorted.length;

  if (rule === 'CEIL_N_PLUS_ONE_TIMES_COVERAGE_DIVIDED_BY_N') {
    const k = Math.ceil((n + 1) * nominalCoverage);
    const kClipped = Math.min(n, Math.max(1, k));
    const index = kClipped - 1;
    return sorted[index];
  } else {
    throw new Error(`UNSUPPORTED_QUANTILE_RULE: Unknown rule '${rule}'`);
  }
}

class ConformalResidualCalibrator {
  constructor(contractPath = null) {
    this.contractPath = contractPath || CONTRACT_PATH;
    this.contract = loadAuthoritativePrognosticContract(this.contractPath);
    this.spec = getAuthoritativeCalibrationSpec(this.contractPath);
    this.isFrozen = false;
    this.is_frozen = false;
    this.frozenArtifact = null;
    this.frozen_artifact = null;
  }

  fit(options) {
    const {
      calibrationPredictions,
      calibrationTargets,
      splitName = 'CALIBRATION',
      calibrationLots = null,
      validationTuneLots = null,
      trainLots = null,
      testLots = null,
      datasetSha256 = null,
      splitManifestSha256 = null,
      modelIdentity = 'Deterministic_Continuous_Degradation_Forecaster',
      frozenModelConfig = null,
    } = options;

    if (splitName !== 'CALIBRATION') {
      throw new Error(
        `CALIBRATION_SPLIT_LEAKAGE_REJECTED: Conformal calibrator fitting is strictly restricted to 'CALIBRATION' cohort, but received splitName='${splitName}'`
      );
    }

    let calibLotsList, tuneLotsList, trainLotsList, testLotsList;
    if (!(calibrationLots && validationTuneLots && trainLots && testLots)) {
      if (!fs.existsSync(SPLIT_MANIFEST_PATH)) {
        throw new Error(`SPLIT_MANIFEST_MISSING: Authoritative split manifest required at '${SPLIT_MANIFEST_PATH}'`);
      }
      const manifestData = JSON.parse(fs.readFileSync(SPLIT_MANIFEST_PATH, 'utf8'));
      const lotsMeta = manifestData.lots || {};
      calibLotsList = calibrationLots || lotsMeta.calibration || [];
      tuneLotsList = validationTuneLots || lotsMeta.validation_tune || [];
      trainLotsList = trainLots || lotsMeta.train || [];
      testLotsList = testLots || lotsMeta.test || [];
    } else {
      calibLotsList = calibrationLots;
      tuneLotsList = validationTuneLots;
      trainLotsList = trainLots;
      testLotsList = testLots;
    }

    const sCalib = new Set(calibLotsList);
    for (const l of tuneLotsList) {
      if (sCalib.has(l)) throw new Error('CALIBRATION_LOT_OVERLAP: Calibration lots overlap validation_tune lots!');
    }
    for (const l of trainLotsList) {
      if (sCalib.has(l)) throw new Error('CALIBRATION_LOT_OVERLAP: Calibration lots overlap train lots!');
    }
    for (const l of testLotsList) {
      if (sCalib.has(l)) throw new Error('CALIBRATION_LOT_OVERLAP: Calibration lots overlap test lots!');
    }

    const targetParams = this.spec.target_parameters;
    const candidateLevels = this.spec.candidate_nominal_levels.map(Number);
    const minSamples = Number(this.spec.minimum_calibration_samples);
    const rule = String(this.spec.finite_sample_quantile_rule);
    const declaredHorizons = (this.spec.declared_contract_horizons || [24, 48, 72, 96, 120, 144, 168]).map(Number);
    const supportedHorizons = (this.spec.supported_dataset_horizons || [96, 168]).map(Number);

    const quantilesTable = {};
    const sampleCounts = {};

    for (const param of targetParams) {
      if (!calibrationPredictions[param]) {
        throw new Error(`MISSING_PARAMETER_PREDICTIONS: Missing predictions for parameter '${param}'`);
      }
      if (!calibrationTargets[param]) {
        throw new Error(`MISSING_PARAMETER_TARGETS: Missing ground truth targets for parameter '${param}'`);
      }

      quantilesTable[param] = {};
      sampleCounts[param] = {};

      for (const hInt of supportedHorizons) {
        const hStr = `${hInt}h`;
        const yTrue = calibrationTargets[param][hInt] || calibrationTargets[param][String(hInt)];
        const yPred = calibrationPredictions[param][hInt] || calibrationPredictions[param][String(hInt)];

        if (!yTrue || !yPred) {
          continue;
        }

        if (yPred.length !== yTrue.length) {
          throw new Error(
            `SAMPLE_COUNT_MISMATCH: Length of predictions (${yPred.length}) != targets (${yTrue.length}) for ${param}@${hStr}`
          );
        }

        if (yTrue.length < minSamples) {
          throw new Error(
            `INSUFFICIENT_CALIBRATION_DATA: Sample count ${yTrue.length} < minimum ${minSamples} for ${param}@${hStr}`
          );
        }

        const absResiduals = new Array(yTrue.length);
        for (let i = 0; i < yTrue.length; i++) {
          const yp = Number(yPred[i]);
          const yt = Number(yTrue[i]);
          if (!Number.isFinite(yp) || !Number.isFinite(yt)) {
            throw new Error(`NON_FINITE_INPUT_REJECTED: Non-finite values detected in ${param}@${hStr}`);
          }
          absResiduals[i] = Math.abs(yt - yp);
        }

        sampleCounts[param][hStr] = absResiduals.length;
        quantilesTable[param][hStr] = {};

        for (const lvl of candidateLevels) {
          const lvlStr = lvl.toFixed(2);
          const qVal = computeFiniteSampleConformalQuantile(absResiduals, lvl, rule);
          quantilesTable[param][hStr][lvlStr] = qVal;
        }
      }
    }

    const horizonMatrixInfo = buildHorizonStatusMatrix(
      declaredHorizons,
      supportedHorizons,
      targetParams
    );

    let actualDatasetSha;
    if (datasetSha256 !== null) {
      actualDatasetSha = datasetSha256;
    } else {
      if (!fs.existsSync(DATASET_PATH)) {
        throw new Error(`DATASET_FILE_NOT_FOUND: Dataset required at '${DATASET_PATH}'`);
      }
      actualDatasetSha = computeSha256(DATASET_PATH);
    }

    let actualManifestSha;
    if (splitManifestSha256 !== null) {
      actualManifestSha = splitManifestSha256;
    } else {
      if (!fs.existsSync(SPLIT_MANIFEST_PATH)) {
        throw new Error(`SPLIT_MANIFEST_MISSING: Split manifest required at '${SPLIT_MANIFEST_PATH}'`);
      }
      actualManifestSha = computeSha256(SPLIT_MANIFEST_PATH);
    }

    if (!fs.existsSync(this.contractPath)) {
      throw new Error(`CONTRACT_FILE_NOT_FOUND: Contract required at '${this.contractPath}'`);
    }
    const contractSha = computeSha256(this.contractPath);

    const artifact = {
      artifact_schema_version: '1.1.0',
      method: this.spec.method,
      model_identity: modelIdentity,
      frozen_model_configuration: frozenModelConfig || {
        architecture: 'Deterministic_Power_Law_Degradation_Forecaster',
        tuning_split: 'VALIDATION_TUNE',
        hyperparameters_frozen: true,
      },
      train_lots: trainLotsList,
      validation_tune_lots: tuneLotsList,
      calibration_lots: calibLotsList,
      test_lots: testLotsList,
      dataset_sha256: actualDatasetSha,
      prognostic_contract_sha256: contractSha,
      split_manifest_sha256: actualManifestSha,
      target_parameters: targetParams,
      declared_contract_horizons: declaredHorizons,
      supported_dataset_horizons: supportedHorizons,
      declared_groups_count: horizonMatrixInfo.total_declared_groups,
      calibrated_groups_count: horizonMatrixInfo.calibrated_groups_count,
      unavailable_groups_count: horizonMatrixInfo.unavailable_groups_count,
      horizon_status_matrix: horizonMatrixInfo.matrix,
      candidate_nominal_levels: candidateLevels,
      finite_sample_quantile_rule: rule,
      sample_counts: sampleCounts,
      conformal_quantiles: quantilesTable,
      status: this.spec.status,
      model_status: this.spec.model_status,
      disclaimer: this.spec.disclaimer,
    };

    const canonicalContent = canonicalJsonStringify({
      calibration_lots: calibLotsList,
      dataset_sha256: actualDatasetSha,
      method: this.spec.method,
      model_identity: modelIdentity,
      quantiles: quantilesTable,
      rule: rule,
      sample_counts: sampleCounts,
      validation_tune_lots: tuneLotsList,
    });

    artifact.calibration_artifact_sha256 = crypto
      .createHash('sha256')
      .update(canonicalContent)
      .digest('hex');

    this.frozenArtifact = artifact;
    this.frozen_artifact = artifact;
    this.isFrozen = true;
    this.is_frozen = true;
    return artifact;
  }

  apply(predictions) {
    if (!this.isFrozen || !this.frozenArtifact) {
      throw new Error('CALIBRATOR_NOT_FROZEN: Calibrator must be fitted before applying intervals');
    }

    const quantilesTable = this.frozenArtifact.conformal_quantiles;
    const intervals = {};

    for (const [param, hDict] of Object.entries(predictions)) {
      if (!quantilesTable[param]) {
        throw new Error(`UNSUPPORTED_PARAMETER: Parameter '${param}' not found in calibration artifact`);
      }

      intervals[param] = {};
      for (const [hInt, yPredArr] of Object.entries(hDict)) {
        const hStr = `${parseInt(hInt, 10)}h`;
        if (!quantilesTable[param][hStr]) {
          continue;
        }

        for (let i = 0; i < yPredArr.length; i++) {
          if (!Number.isFinite(yPredArr[i])) {
            throw new Error(`NON_FINITE_PREDICTIONS: Non-finite predictions detected for ${param}@${hStr}`);
          }
        }

        intervals[param][hStr] = {};
        for (const [lvlStr, qVal] of Object.entries(quantilesTable[param][hStr])) {
          const q = Number(qVal);
          const lower = new Array(yPredArr.length);
          const upper = new Array(yPredArr.length);
          const width = new Array(yPredArr.length);

          for (let i = 0; i < yPredArr.length; i++) {
            const yp = yPredArr[i];
            lower[i] = yp - q;
            upper[i] = yp + q;
            width[i] = 2.0 * q;
          }

          intervals[param][hStr][lvlStr] = {
            lower,
            upper,
            width,
            quantile: q,
          };
        }
      }
    }

    return intervals;
  }

  evaluateCoverage(intervals, testTargets) {
    const results = {};

    for (const [param, hDict] of Object.entries(intervals)) {
      if (!testTargets[param]) continue;

      results[param] = {};
      for (const [hStr, lvlDict] of Object.entries(hDict)) {
        const hInt = parseInt(hStr.replace('h', ''), 10);
        const yTrue = testTargets[param][hInt] || testTargets[param][String(hInt)];
        if (!yTrue) continue;

        results[param][hStr] = {};

        for (const [lvlStr, intervalData] of Object.entries(lvlDict)) {
          const nominalLvl = parseFloat(lvlStr);
          const { lower, upper, width } = intervalData;

          let nCovered = 0;
          const nTest = yTrue.length;

          for (let i = 0; i < nTest; i++) {
            const yt = yTrue[i];
            if (yt >= lower[i] && yt <= upper[i]) {
              nCovered++;
            }
          }

          const observedCoveragePct = nTest > 0 ? (nCovered / nTest) * 100.0 : 0.0;
          const observedCoverageRatio = nTest > 0 ? nCovered / nTest : 0.0;
          const coverageError = observedCoverageRatio - nominalLvl;

          let sumWidth = 0;
          let minW = Infinity;
          let maxW = -Infinity;
          for (let i = 0; i < width.length; i++) {
            sumWidth += width[i];
            if (width[i] < minW) minW = width[i];
            if (width[i] > maxW) maxW = width[i];
          }
          const avgWidth = width.length > 0 ? sumWidth / width.length : 0.0;

          results[param][hStr][lvlStr] = {
            nominal_coverage: nominalLvl,
            observed_coverage_pct: Math.round(observedCoveragePct * 100) / 100,
            observed_coverage_ratio: Math.round(observedCoverageRatio * 10000) / 10000,
            coverage_error: Math.round(coverageError * 10000) / 10000,
            test_sample_count: nTest,
            covered_sample_count: nCovered,
            conformal_quantile_q: intervalData.quantile,
            avg_interval_width: Math.round(avgWidth * 10000) / 10000,
            median_interval_width: Math.round(avgWidth * 10000) / 10000,
            min_interval_width: Math.round(minW * 10000) / 10000,
            max_interval_width: Math.round(maxW * 10000) / 10000,
            calibration_status: 'NOT_CALIBRATED',
          };
        }
      }
    }

    return results;
  }
  loadArtifact(artifactOrPath, options = {}) {
    const {
      expectedDatasetSha256 = null,
      expectedContractSha256 = null,
      expectedSplitManifestSha256 = null,
      expectedModelIdentity = null,
    } = options;

    let artifact;
    if (typeof artifactOrPath === 'string') {
      artifact = loadCalibrationArtifact(artifactOrPath, options);
    } else {
      validateCalibrationArtifact(artifactOrPath, options);
      artifact = artifactOrPath;
    }

    this.frozenArtifact = artifact;
    this.frozen_artifact = artifact;
    this.isFrozen = true;
    this.is_frozen = true;
    return artifact;
  }
}

function validateCalibrationArtifact(artifact, options = {}) {
  const {
    expectedDatasetSha256 = null,
    expectedContractSha256 = null,
    expectedSplitManifestSha256 = null,
    expectedModelIdentity = null,
  } = options;

  const requiredKeys = [
    'artifact_schema_version',
    'method',
    'model_identity',
    'train_lots',
    'validation_tune_lots',
    'calibration_lots',
    'test_lots',
    'dataset_sha256',
    'conformal_quantiles',
    'sample_counts',
    'calibration_artifact_sha256',
    'status',
    'model_status',
  ];
  for (const k of requiredKeys) {
    if (artifact[k] === undefined) {
      throw new Error(`MALFORMED_CALIBRATION_ARTIFACT: Missing required key '${k}'`);
    }
  }

  const canonicalContent = canonicalJsonStringify({
    calibration_lots: artifact.calibration_lots,
    dataset_sha256: artifact.dataset_sha256,
    method: artifact.method,
    model_identity: artifact.model_identity,
    quantiles: artifact.conformal_quantiles,
    rule: artifact.finite_sample_quantile_rule || 'CEIL_N_PLUS_ONE_TIMES_COVERAGE_DIVIDED_BY_N',
    sample_counts: artifact.sample_counts,
    validation_tune_lots: artifact.validation_tune_lots,
  });

  const expectedHash = crypto.createHash('sha256').update(canonicalContent).digest('hex');
  if (artifact.calibration_artifact_sha256 !== expectedHash) {
    throw new Error(
      `CALIBRATION_ARTIFACT_TAMPERING_DETECTED: Computed hash '${expectedHash}' does not match declared artifact hash '${artifact.calibration_artifact_sha256}'`
    );
  }

  if (expectedDatasetSha256 !== null && artifact.dataset_sha256 !== expectedDatasetSha256) {
    throw new Error(
      `DATASET_PROVENANCE_MISMATCH: Calibration artifact was generated for dataset '${artifact.dataset_sha256}', but consumed with '${expectedDatasetSha256}'`
    );
  }

  if (expectedContractSha256 !== null && artifact.prognostic_contract_sha256 !== expectedContractSha256) {
    throw new Error(
      `CONTRACT_PROVENANCE_MISMATCH: Artifact contract SHA '${artifact.prognostic_contract_sha256}' does not match expected '${expectedContractSha256}'`
    );
  }

  if (expectedSplitManifestSha256 !== null && artifact.split_manifest_sha256 !== expectedSplitManifestSha256) {
    throw new Error(
      `SPLIT_MANIFEST_PROVENANCE_MISMATCH: Artifact manifest SHA '${artifact.split_manifest_sha256}' does not match expected '${expectedSplitManifestSha256}'`
    );
  }

  if (expectedModelIdentity !== null && artifact.model_identity !== expectedModelIdentity) {
    throw new Error(
      `MODEL_PROVENANCE_MISMATCH: Artifact model '${artifact.model_identity}' does not match expected model '${expectedModelIdentity}'`
    );
  }

  if (artifact.status !== 'NOT_CALIBRATED' || artifact.model_status !== 'BENCHMARK_ONLY') {
    throw new Error(
      `INVALID_ARTIFACT_STATUS: Artifact must maintain status='NOT_CALIBRATED' and model_status='BENCHMARK_ONLY', got status='${artifact.status}', model_status='${artifact.model_status}'`
    );
  }

  return {
    valid: true,
    artifact_sha256: artifact.calibration_artifact_sha256,
    dataset_sha256: artifact.dataset_sha256,
    model_identity: artifact.model_identity,
  };
}

function loadCalibrationArtifact(filepath, options = {}) {
  if (!fs.existsSync(filepath)) {
    throw new Error(`CALIBRATION_ARTIFACT_NOT_FOUND: Artifact not found at ${filepath}`);
  }
  const artifact = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  validateCalibrationArtifact(artifact, options);
  return artifact;
}

function exportCalibrationArtifact(artifact, filepath) {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filepath, JSON.stringify(artifact, null, 2), 'utf8');
}

module.exports = {
  DATASET_PATH,
  SPLIT_MANIFEST_PATH,
  canonicalJsonStringify,
  getAuthoritativeCalibrationSpec,
  partitionFourWayDataset,
  buildHorizonStatusMatrix,
  buildAuthoritativeHorizonMatrix: buildHorizonStatusMatrix,
  computeFiniteSampleConformalQuantile,
  ConformalResidualCalibrator,
  validateCalibrationArtifact,
  loadCalibrationArtifact,
  exportCalibrationArtifact,
};
