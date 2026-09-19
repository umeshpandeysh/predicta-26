/**
 * Authoritative Stage 6 Conformal Residual Calibration Module (Node.js)
 * =====================================================================
 * Establishes a statistically governed, leakage-safe framework for producing
 * finite-sample split-conformal prediction intervals around continuous 168h prognostic
 * trajectory forecasts.
 *
 * Scientific & Governance Rules:
 * 1. Validation-Only Calibration: Calibration fitting is strictly restricted to the
 *    authoritative VALIDATION cohort (LOT-SYN-036..042, 700 components).
 * 2. Zero Test Leakage: The held-out TEST cohort (LOT-SYN-043..050, 800 components)
 *    must remain untouched until calibration parameters are frozen.
 * 3. Grouped Granularity: Conformal nonconformity quantiles are estimated per
 *    (parameter x horizon x nominal_level) group.
 * 4. Finite-Sample Quantile Rule: Exactly k = ceil((n + 1) * coverage) on sorted
 *    absolute validation residuals |y - y_hat|.
 * 5. Status Integrity: Calibration status remains NOT_CALIBRATED and model status
 *    remains BENCHMARK_ONLY until formal release certification.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  loadAuthoritativePrognosticContract,
  computeSha256
} = require('./trajectory');

const CONTRACT_PATH = path.resolve(__dirname, '../../ml/prognostics/prognostic_contract.json');
const DATASET_PATH = path.resolve(__dirname, '../../data/synthetic/semiconductor_synthetic_full.csv');

/**
 * Extracts and validates the authoritative uncertainty_calibration_specification
 * from the prognostic contract.
 * @param {string} [contractPath]
 * @returns {object}
 */
function getAuthoritativeCalibrationSpec(contractPath) {
  const contract = loadAuthoritativePrognosticContract(contractPath);
  if (!contract.uncertainty_calibration_specification) {
    throw new Error("AUTHORITATIVE_PROGNOSTIC_CONTRACT_INVALID: Missing 'uncertainty_calibration_specification' in contract");
  }
  const spec = contract.uncertainty_calibration_specification;
  const requiredKeys = [
    "method",
    "calibration_split",
    "evaluation_split",
    "forecast_origins",
    "supported_horizons",
    "target_parameters",
    "candidate_nominal_levels",
    "minimum_calibration_samples",
    "aggregation_method",
    "residual_definition",
    "interval_construction_method",
    "finite_sample_quantile_rule",
    "finite_value_policy",
    "status",
    "model_status"
  ];
  for (const k of requiredKeys) {
    if (!(k in spec)) {
      throw new Error(`AUTHORITATIVE_PROGNOSTIC_CONTRACT_INVALID: Missing required key '${k}' in calibration spec`);
    }
  }
  return spec;
}

/**
 * Computes the deterministic finite-sample conformal quantile from non-negative residuals.
 * @param {number[]} residuals
 * @param {number} nominalCoverage
 * @param {string} [rule]
 * @returns {number}
 */
function computeFiniteSampleConformalQuantile(residuals, nominalCoverage, rule = "CEIL_N_PLUS_ONE_TIMES_COVERAGE_DIVIDED_BY_N") {
  if (typeof nominalCoverage !== 'number' || nominalCoverage <= 0 || nominalCoverage >= 1) {
    throw new Error(`INVALID_COVERAGE_LEVEL: nominalCoverage must be strictly between 0 and 1, got ${nominalCoverage}`);
  }
  if (!Array.isArray(residuals) || residuals.length === 0) {
    throw new Error("INSUFFICIENT_CALIBRATION_DATA: Residual array is empty");
  }

  for (let i = 0; i < residuals.length; i++) {
    const r = residuals[i];
    if (typeof r !== 'number' || !Number.isFinite(r)) {
      throw new Error("NON_FINITE_RESIDUAL_REJECTED: Calibration residuals must all be finite numbers");
    }
    if (r < 0) {
      throw new Error("NEGATIVE_RESIDUAL_REJECTED: Absolute residuals |y - y_hat| must be non-negative");
    }
  }

  const sorted = [...residuals].sort((a, b) => a - b);
  const n = sorted.length;

  if (rule === "CEIL_N_PLUS_ONE_TIMES_COVERAGE_DIVIDED_BY_N") {
    const k = Math.ceil((n + 1) * nominalCoverage);
    const kClipped = Math.min(n, Math.max(1, k));
    const index = kClipped - 1;
    return sorted[index];
  } else {
    throw new Error(`UNSUPPORTED_QUANTILE_RULE: Unknown rule '${rule}'`);
  }
}

/**
 * Split-Conformal Residual Calibrator for 168h Continuous Trajectories.
 */
class ConformalResidualCalibrator {
  constructor(contractPath) {
    this.contractPath = contractPath || CONTRACT_PATH;
    this.contract = loadAuthoritativePrognosticContract(this.contractPath);
    this.spec = getAuthoritativeCalibrationSpec(this.contractPath);
    this.isFrozen = false;
    this.frozenArtifact = null;
  }

  /**
   * Fits the conformal calibrator on validation residuals.
   * @param {object} validationPredictions
   * @param {object} validationTargets
   * @param {string} [splitName='VALIDATION']
   * @param {string[]} [validationLots]
   * @param {string} [datasetSha256]
   * @param {string} [modelIdentity]
   * @returns {object}
   */
  fit(
    validationPredictions,
    validationTargets,
    splitName = "VALIDATION",
    validationLots = null,
    datasetSha256 = null,
    modelIdentity = "Deterministic_Continuous_Degradation_Forecaster"
  ) {
    if (splitName !== "VALIDATION") {
      throw new Error(
        `TEST_SPLIT_LEAKAGE_REJECTED: Conformal calibrator fitting is strictly restricted to 'VALIDATION' split, but received splitName='${splitName}'`
      );
    }

    const targetParams = this.spec.target_parameters;
    const candidateLevels = this.spec.candidate_nominal_levels.map(lvl => Number(lvl));
    const minSamples = Number(this.spec.minimum_calibration_samples);
    const rule = String(this.spec.finite_sample_quantile_rule);

    const quantilesTable = {};
    const sampleCounts = {};

    for (const param of targetParams) {
      if (!validationPredictions[param]) {
        throw new Error(`MISSING_PARAMETER_PREDICTIONS: Missing predictions for parameter '${param}'`);
      }
      if (!validationTargets[param]) {
        throw new Error(`MISSING_PARAMETER_TARGETS: Missing ground truth targets for parameter '${param}'`);
      }

      quantilesTable[param] = {};
      sampleCounts[param] = {};

      for (const hKey of Object.keys(validationTargets[param])) {
        const hInt = parseInt(hKey, 10);
        const hStr = `${hInt}h`;
        if (!validationPredictions[param][hInt]) {
          continue;
        }

        const yPred = validationPredictions[param][hInt];
        const yTrue = validationTargets[param][hKey];

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

        for (let i = 0; i < yTrue.length; i++) {
          if (!Number.isFinite(yPred[i]) || !Number.isFinite(yTrue[i])) {
            throw new Error(`NON_FINITE_INPUT_REJECTED: Non-finite values detected in ${param}@${hStr}`);
          }
        }

        const absResiduals = new Array(yTrue.length);
        for (let i = 0; i < yTrue.length; i++) {
          absResiduals[i] = Math.abs(yTrue[i] - yPred[i]);
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

    const actualDatasetSha = datasetSha256 || (
      fs.existsSync(DATASET_PATH) ? computeSha256(DATASET_PATH) : "UNKNOWN_DATASET_SHA"
    );
    const contractSha = fs.existsSync(this.contractPath) ? computeSha256(this.contractPath) : "UNKNOWN";

    const defaultLots = [];
    for (let i = 36; i <= 42; i++) {
      defaultLots.push(`LOT-SYN-${String(i).padStart(3, '0')}`);
    }

    const artifact = {
      artifact_schema_version: "1.0.0",
      method: this.spec.method,
      model_identity: modelIdentity,
      calibration_split: "VALIDATION",
      evaluation_split: "TEST",
      validation_lots: validationLots || defaultLots,
      dataset_sha256: actualDatasetSha,
      prognostic_contract_sha256: contractSha,
      target_parameters: targetParams,
      candidate_nominal_levels: candidateLevels,
      finite_sample_quantile_rule: rule,
      sample_counts: sampleCounts,
      conformal_quantiles: quantilesTable,
      status: this.spec.status,
      model_status: this.spec.model_status,
      disclaimer: this.spec.disclaimer
    };

    const canonicalContent = JSON.stringify({
      dataset_sha256: actualDatasetSha,
      method: this.spec.method,
      quantiles: quantilesTable,
      rule: rule,
      sample_counts: sampleCounts
    });
    artifact.calibration_artifact_sha256 = crypto.createHash('sha256').update(canonicalContent, 'utf8').digest('hex');

    this.frozenArtifact = artifact;
    this.isFrozen = true;
    return artifact;
  }

  /**
   * Applies frozen calibration quantiles to test point predictions.
   * @param {object} predictions
   * @returns {object}
   */
  apply(predictions) {
    if (!this.isFrozen || !this.frozenArtifact) {
      throw new Error("CALIBRATOR_NOT_FROZEN: Calibrator must be fitted before applying intervals");
    }

    const quantilesTable = this.frozenArtifact.conformal_quantiles;
    const intervals = {};

    for (const param of Object.keys(predictions)) {
      if (!quantilesTable[param]) {
        throw new Error(`UNSUPPORTED_PARAMETER: Parameter '${param}' not found in calibration artifact`);
      }

      intervals[param] = {};
      const hDict = predictions[param];

      for (const hKey of Object.keys(hDict)) {
        const hInt = parseInt(hKey, 10);
        const hStr = `${hInt}h`;
        if (!quantilesTable[param][hStr]) {
          continue;
        }

        const yPred = hDict[hKey];
        intervals[param][hStr] = {};

        for (const lvlStr of Object.keys(quantilesTable[param][hStr])) {
          const q = quantilesTable[param][hStr][lvlStr];
          const lower = new Array(yPred.length);
          const upper = new Array(yPred.length);
          const width = new Array(yPred.length);

          for (let i = 0; i < yPred.length; i++) {
            const pVal = yPred[i];
            if (!Number.isFinite(pVal)) {
              throw new Error(`NON_FINITE_PREDICTIONS: Non-finite prediction detected for ${param}@${hStr}`);
            }
            lower[i] = pVal - q;
            upper[i] = pVal + q;
            width[i] = 2.0 * q;
          }

          intervals[param][hStr][lvlStr] = {
            lower,
            upper,
            width,
            quantile: q
          };
        }
      }
    }

    return intervals;
  }

  /**
   * Evaluates empirical coverage on held-out test cohort targets.
   * @param {object} intervals
   * @param {object} testTargets
   * @returns {object}
   */
  evaluateCoverage(intervals, testTargets) {
    const results = {};

    for (const param of Object.keys(intervals)) {
      if (!testTargets[param]) {
        continue;
      }

      results[param] = {};
      for (const hStr of Object.keys(intervals[param])) {
        const hInt = parseInt(hStr.replace("h", ""), 10);
        if (!testTargets[param][hInt] && !testTargets[param][String(hInt)]) {
          continue;
        }

        const yTrue = testTargets[param][hInt] || testTargets[param][String(hInt)];
        results[param][hStr] = {};

        for (const lvlStr of Object.keys(intervals[param][hStr])) {
          const nominalLvl = parseFloat(lvlStr);
          const intervalData = intervals[param][hStr][lvlStr];
          const lower = intervalData.lower;
          const upper = intervalData.upper;
          const widths = intervalData.width;

          let nCovered = 0;
          const nTest = yTrue.length;
          for (let i = 0; i < nTest; i++) {
            if (yTrue[i] >= lower[i] && yTrue[i] <= upper[i]) {
              nCovered++;
            }
          }

          const observedCoveragePct = nTest > 0 ? (nCovered / nTest) * 100.0 : 0.0;
          const observedCoverageRatio = nTest > 0 ? nCovered / nTest : 0.0;
          const coverageError = observedCoverageRatio - nominalLvl;

          let sumWidth = 0;
          for (let i = 0; i < widths.length; i++) {
            sumWidth += widths[i];
          }
          const avgWidth = widths.length > 0 ? sumWidth / widths.length : 0.0;
          const sortedWidths = [...widths].sort((a, b) => a - b);
          const medianWidth = sortedWidths.length > 0 ? sortedWidths[Math.floor(sortedWidths.length / 2)] : 0.0;

          results[param][hStr][lvlStr] = {
            nominal_coverage: nominalLvl,
            observed_coverage_pct: Number(observedCoveragePct.toFixed(2)),
            observed_coverage_ratio: Number(observedCoverageRatio.toFixed(4)),
            coverage_error: Number(coverageError.toFixed(4)),
            test_sample_count: nTest,
            covered_sample_count: nCovered,
            conformal_quantile_q: intervalData.quantile,
            avg_interval_width: Number(avgWidth.toFixed(4)),
            median_interval_width: Number(medianWidth.toFixed(4)),
            min_interval_width: Number(sortedWidths[0].toFixed(4)),
            max_interval_width: Number(sortedWidths[sortedWidths.length - 1].toFixed(4)),
            calibration_status: "NOT_CALIBRATED"
          };
        }
      }
    }

    return results;
  }
}

/**
 * Exports calibration artifact to JSON on disk.
 * @param {object} artifact
 * @param {string} filepath
 */
function exportCalibrationArtifact(artifact, filepath) {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filepath, JSON.stringify(artifact, null, 2), 'utf8');
}

module.exports = {
  getAuthoritativeCalibrationSpec,
  computeFiniteSampleConformalQuantile,
  ConformalResidualCalibrator,
  exportCalibrationArtifact
};
