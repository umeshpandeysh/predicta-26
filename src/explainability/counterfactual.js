const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PredictaInferenceServiceJS } = require('../api/inference');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const CF_CONTRACT_PATH = path.join(PROJECT_ROOT, 'ml/explainability/counterfactual_contract.json');
const PROD_MANIFEST_PATH = path.join(PROJECT_ROOT, 'ml/models/production/predicta_production_manifest.json');
const MODEL_JSON_PATH = path.join(PROJECT_ROOT, 'ml/models/production/predicta_xgboost_model.json');
const METADATA_JSON_PATH = path.join(PROJECT_ROOT, 'ml/models/production/predicta_xgboost_metadata.json');

const RAW_NUMERICAL_FEATURES = [
  "supply_voltage", "output_voltage", "current", "leakage_current",
  "resistance", "capacitance", "threshold_voltage", "frequency",
  "propagation_delay", "setup_time", "hold_time", "timing_margin",
  "temperature", "dynamic_power", "total_power", "test_duration"
];

function computeFileSha256(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`ARTIFACT_MISSING: File not found at ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

class GovernedCounterfactualExplainerJS {
  constructor(
    contractPath = CF_CONTRACT_PATH,
    modelPath = MODEL_JSON_PATH,
    metadataPath = METADATA_JSON_PATH,
    manifestPath = PROD_MANIFEST_PATH
  ) {
    this.contractPath = contractPath;
    this.modelPath = modelPath;
    this.metadataPath = metadataPath;
    this.manifestPath = manifestPath;

    this.loadAndValidateArtifacts();
  }

  loadAndValidateArtifacts() {
    if (!fs.existsSync(this.contractPath)) {
      throw new Error(`CONTRACT_MISSING: Counterfactual contract missing at ${this.contractPath}`);
    }
    this.contract = JSON.parse(fs.readFileSync(this.contractPath, 'utf-8'));

    if (!fs.existsSync(this.metadataPath)) {
      throw new Error(`ARTIFACT_MISSING: Metadata missing at ${this.metadataPath}`);
    }
    this.metadata = JSON.parse(fs.readFileSync(this.metadataPath, 'utf-8'));

    if (!fs.existsSync(this.manifestPath)) {
      throw new Error(`ARTIFACT_MISSING: Manifest missing at ${this.manifestPath}`);
    }
    this.manifest = JSON.parse(fs.readFileSync(this.manifestPath, 'utf-8'));

    this.expectedModelSha = this.contract.model_identity.model_sha256;
    const actualModelSha = computeFileSha256(this.modelPath);
    if (actualModelSha !== this.expectedModelSha) {
      throw new Error(`MODEL_HASH_MISMATCH: Computed ${actualModelSha} does not match expected ${this.expectedModelSha}`);
    }

    this.inferenceService = new PredictaInferenceServiceJS();
    this.operatingThreshold = Number(this.contract.model_identity.operating_threshold);
    this.calibA = Number(this.contract.model_identity.calibration.coefficients.a);
    this.calibB = Number(this.contract.model_identity.calibration.coefficients.b);

    this.featureBounds = this.contract.feature_bounds;
    this.refStds = this.contract.optimization_specification.reference_standard_deviations;
    this.maxFeatureChangeStd = Number(this.contract.optimization_specification.maximum_change_per_feature_std);
    this.maxTotalDistance = Number(this.contract.optimization_specification.maximum_total_distance);
  }

  evaluateProbability(featVector) {
    if (!Array.isArray(featVector) || featVector.length !== 28) {
      throw new Error(`INVALID_FEATURE_VECTOR_LENGTH: Expected 28 features, got ${featVector?.length}`);
    }
    for (let i = 0; i < featVector.length; i++) {
      const val = featVector[i];
      if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
        throw new Error(`NON_FINITE_FEATURE_VALUE: Feature index ${i} has invalid value ${val}`);
      }
    }

    const rawP = this.inferenceService.evaluateXGBoostTrees(featVector);
    const pClip = Math.max(1e-7, Math.min(1.0 - 1e-7, rawP));
    const logit = Math.log(pClip / (1.0 - pClip));
    const clampedZ = Math.max(-50.0, Math.min(50.0, this.calibA * logit + this.calibB));
    const calibP = 1.0 / (1.0 + Math.exp(clampedZ));

    return [Number(rawP.toFixed(6)), Number(calibP.toFixed(6))];
  }

  buildFeatureVectorFromRaw(rawInputs, equipmentId) {
    const engineered = this.inferenceService.engineerFeatures(rawInputs, equipmentId);
    const vector = new Array(28);
    const names = this.metadata.feature_names || this.metadata.feature_contract.feature_names;
    for (let i = 0; i < 28; i++) {
      const fn = names[i];
      vector[i] = Number(engineered[fn] || 0.0);
    }
    return vector;
  }

  generateCounterfactual(inputRecord, targetCondition = 'TARGET_PASS', traceId = null) {
    const initialSha = computeFileSha256(this.modelPath);
    if (initialSha !== this.expectedModelSha) {
      throw new Error("MODEL_HASH_TAMPERED: Model artifact was altered prior to explanation.");
    }

    if (!this.contract.supported_target_conditions.includes(targetCondition)) {
      throw new Error(`UNSUPPORTED_TARGET_CONDITION: '${targetCondition}' is not supported by contract.`);
    }

    if (!inputRecord || typeof inputRecord !== 'object') {
      throw new Error("INVALID_INPUT: inputRecord must be an object.");
    }

    // Strict canonical input validation: reject unknown features or unexpected fields
    const identifiers = (this.contract && this.contract.immutable_features && this.contract.immutable_features.identifiers) || [];
    const allowedFields = new Set([
      ...RAW_NUMERICAL_FEATURES,
      "equipment_id",
      ...identifiers,
      "record",
      "target_condition",
      "trace_id"
    ]);
    for (const key of Object.keys(inputRecord)) {
      if (!allowedFields.has(key)) {
        throw new Error(`UNKNOWN_FEATURE: Unknown feature or field '${key}' is not permitted in canonical counterfactual schema.`);
      }
    }

    const eqId = String(inputRecord.equipment_id || '').trim().toUpperCase();
    if (!eqId) {
      throw new Error("MISSING_EQUIPMENT_ID: equipment_id is required.");
    }

    const rawOriginal = {};
    for (const fName of RAW_NUMERICAL_FEATURES) {
      if (!(fName in inputRecord) || inputRecord[fName] === null || inputRecord[fName] === undefined) {
        throw new Error(`MISSING_REQUIRED_FEATURE: Missing feature '${fName}'`);
      }
      const val = Number(inputRecord[fName]);
      if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
        throw new Error(`NON_FINITE_INPUT: Feature '${fName}' has non-finite value '${inputRecord[fName]}'`);
      }

      const bounds = this.featureBounds[fName];
      if (bounds) {
        if (bounds.strict_positive && val <= 0) {
          throw new Error(`PHYSICAL_BOUND_VIOLATION: Feature '${fName}' must be > 0. Got ${val}`);
        }
        if (val < 0 && ["current", "leakage_current", "dynamic_power", "total_power"].includes(fName)) {
          throw new Error(`PHYSICAL_BOUND_VIOLATION: Feature '${fName}' cannot be negative. Got ${val}`);
        }
      }
      rawOriginal[fName] = val;
    }

    const origVector = this.buildFeatureVectorFromRaw(rawOriginal, eqId);
    const [rawProbOrig, calibProbOrig] = this.evaluateProbability(origVector);
    const origDecision = calibProbOrig >= this.operatingThreshold ? "FAIL" : "PASS";

    const satisfiesTarget = (p) => {
      if (targetCondition === "TARGET_PASS") return p < this.operatingThreshold;
      if (targetCondition === "TARGET_REJECT") return p >= this.operatingThreshold;
      if (targetCondition === "TARGET_MONITOR") return p >= this.operatingThreshold && p < 0.50;
      return false;
    };

    if (satisfiesTarget(calibProbOrig)) {
      const finalSha = computeFileSha256(this.modelPath);
      if (finalSha !== initialSha) throw new Error("MODEL_INTEGRITY_COMPROMISED");

      const origRounded = {};
      for (const k of RAW_NUMERICAL_FEATURES) origRounded[k] = Number(rawOriginal[k].toFixed(4));

      return {
        explanation_id: `CF-${crypto.createHash('sha256').update(JSON.stringify(origRounded)).digest('hex').substring(0, 12).toUpperCase()}`,
        trace_id: traceId || inputRecord.trace_id || "TRACE-BENCHMARK",
        model_id: this.contract.model_identity.model_name,
        model_hash: this.expectedModelSha,
        model_status: this.contract.model_status,
        explanation_status: this.contract.explanation_status,
        original_input: origRounded,
        original_prediction: {
          calibrated_probability: calibProbOrig,
          raw_probability: rawProbOrig,
          decision: origDecision,
          operating_threshold: this.operatingThreshold
        },
        target_condition: targetCondition,
        counterfactual_input: origRounded,
        counterfactual_prediction: {
          calibrated_probability: calibProbOrig,
          raw_probability: rawProbOrig,
          decision: origDecision
        },
        changed_features: {},
        distance: 0.0,
        constraint_penalty: 0.0,
        total_cost: 0.0,
        target_reached: true,
        target_margin: 0.0,
        immutable_features_verified: true,
        physical_constraints_verified: true,
        schema_verified: true,
        algorithm: this.contract.optimization_specification.method,
        algorithm_version: "1.0.0",
        provenance: {
          contract_sha256: computeFileSha256(this.contractPath),
          model_sha256: this.expectedModelSha
        },
        generated_at: "2026-09-20T00:00:00Z"
      };
    }

    const candidateParams = [
      "leakage_current",
      "propagation_delay",
      "temperature",
      "resistance",
      "current",
      "supply_voltage",
      "timing_margin",
      "total_power"
    ];

    let currentRaw = { ...rawOriginal };
    let bestCandidate = { ...rawOriginal };
    let bestProb = calibProbOrig;
    let bestCost = Infinity;
    let targetReached = false;

    const isReducingRisk = (targetCondition === "TARGET_PASS") || (targetCondition === "TARGET_MONITOR" && calibProbOrig >= 0.50);
    const maxIter = this.contract.optimization_specification.max_iterations;
    const stepFactor = this.contract.optimization_specification.step_size;

    for (let iteration = 0; iteration < maxIter; iteration++) {
      let improved = false;
      for (const param of candidateParams) {
        const std = this.refStds[param];
        const bounds = this.featureBounds[param];
        let dirMult = isReducingRisk ? -1.0 : 1.0;
        if (bounds.directionality === "DECREASING_RISK") {
          dirMult = isReducingRisk ? 1.0 : -1.0;
        }

        const trialSteps = [
          stepFactor * std * dirMult,
          2.0 * stepFactor * std * dirMult,
          0.5 * stepFactor * std * dirMult
        ];

        for (const step of trialSteps) {
          let trialVal = currentRaw[param] + step;
          const maxAllowed = rawOriginal[param] + this.maxFeatureChangeStd * std;
          const minAllowed = rawOriginal[param] - this.maxFeatureChangeStd * std;

          trialVal = Math.max(bounds.min, Math.min(bounds.max, trialVal));
          trialVal = Math.max(minAllowed, Math.min(maxAllowed, trialVal));

          if (bounds.strict_positive && trialVal <= 0) {
            trialVal = Math.max(1e-3, trialVal);
          }

          const trialRaw = { ...currentRaw, [param]: trialVal };
          let totalDist = 0.0;
          for (const p of RAW_NUMERICAL_FEATURES) {
            totalDist += Math.abs(trialRaw[p] - rawOriginal[p]) / this.refStds[p];
          }

          if (totalDist > this.maxTotalDistance) continue;

          const trialVec = this.buildFeatureVectorFromRaw(trialRaw, eqId);
          const [, trialCalibP] = this.evaluateProbability(trialVec);

          let targetViolation = 0.0;
          if (targetCondition === "TARGET_PASS") {
            targetViolation = Math.max(0.0, trialCalibP - (this.operatingThreshold - 0.01));
          } else if (targetCondition === "TARGET_REJECT") {
            targetViolation = Math.max(0.0, this.operatingThreshold - trialCalibP);
          } else if (targetCondition === "TARGET_MONITOR") {
            if (trialCalibP < this.operatingThreshold) {
              targetViolation = this.operatingThreshold - trialCalibP;
            } else if (trialCalibP >= 0.50) {
              targetViolation = trialCalibP - 0.49;
            }
          }

          const cost = totalDist + 50.0 * targetViolation;

          if (satisfiesTarget(trialCalibP)) {
            if (!targetReached || cost < bestCost) {
              bestCost = cost;
              bestCandidate = { ...trialRaw };
              bestProb = trialCalibP;
              targetReached = true;
              improved = true;
              currentRaw = { ...trialRaw };
              break;
            }
          } else if (!targetReached && cost < bestCost) {
            bestCost = cost;
            bestCandidate = { ...trialRaw };
            bestProb = trialCalibP;
            improved = true;
            currentRaw = { ...trialRaw };
          }
        }

        if (targetReached && iteration > 10) break;
      }
      if (!improved) break;
    }

    const finalSha = computeFileSha256(this.modelPath);
    if (finalSha !== initialSha) {
      throw new Error("MODEL_HASH_MUTATION_DETECTED: Model artifact was altered during explanation search.");
    }

    const changedFeatures = {};
    for (const p of RAW_NUMERICAL_FEATURES) {
      const diff = bestCandidate[p] - rawOriginal[p];
      if (Math.abs(diff) > 1e-4) {
        changedFeatures[p] = {
          original_value: Number(rawOriginal[p].toFixed(4)),
          counterfactual_value: Number(bestCandidate[p].toFixed(4)),
          delta: Number(diff.toFixed(4)),
          delta_std: Number((diff / this.refStds[p]).toFixed(4)),
          unit: this.featureBounds[p].unit
        };
      }
    }

    let finalDistance = 0.0;
    for (const p of RAW_NUMERICAL_FEATURES) {
      finalDistance += Math.abs(bestCandidate[p] - rawOriginal[p]) / this.refStds[p];
    }

    const finalVec = this.buildFeatureVectorFromRaw(bestCandidate, eqId);
    const [finalRawP, finalCalibP] = this.evaluateProbability(finalVec);
    const cfDecision = finalCalibP >= this.operatingThreshold ? "FAIL" : "PASS";

    let targetMargin = 0.0;
    if (targetCondition === "TARGET_PASS") {
      targetMargin = Number((this.operatingThreshold - finalCalibP).toFixed(4));
    } else if (targetCondition === "TARGET_REJECT") {
      targetMargin = Number((finalCalibP - this.operatingThreshold).toFixed(4));
    } else {
      targetMargin = Number((0.50 - finalCalibP).toFixed(4));
    }

    const origRounded = {};
    const cfRounded = {};
    for (const k of RAW_NUMERICAL_FEATURES) {
      origRounded[k] = Number(rawOriginal[k].toFixed(4));
      cfRounded[k] = Number(bestCandidate[k].toFixed(4));
    }

    return {
      explanation_id: `CF-${crypto.createHash('sha256').update(JSON.stringify(cfRounded)).digest('hex').substring(0, 12).toUpperCase()}`,
      trace_id: traceId || inputRecord.trace_id || "TRACE-BENCHMARK",
      model_id: this.contract.model_identity.model_name,
      model_hash: this.expectedModelSha,
      model_status: this.contract.model_status,
      explanation_status: this.contract.explanation_status,
      original_input: origRounded,
      original_prediction: {
        calibrated_probability: calibProbOrig,
        raw_probability: rawProbOrig,
        decision: origDecision,
        operating_threshold: this.operatingThreshold
      },
      target_condition: targetCondition,
      counterfactual_input: cfRounded,
      counterfactual_prediction: {
        calibrated_probability: finalCalibP,
        raw_probability: finalRawP,
        decision: cfDecision
      },
      changed_features: changedFeatures,
      distance: Number(finalDistance.toFixed(4)),
      constraint_penalty: 0.0,
      total_cost: Number(bestCost.toFixed(4)),
      target_reached: targetReached,
      target_margin: targetMargin,
      immutable_features_verified: true,
      physical_constraints_verified: true,
      schema_verified: true,
      algorithm: this.contract.optimization_specification.method,
      algorithm_version: "1.0.0",
      provenance: {
        contract_sha256: computeFileSha256(this.contractPath),
        model_sha256: this.expectedModelSha
      },
      generated_at: "2026-09-20T00:00:00Z"
    };
  }
}

module.exports = {
  GovernedCounterfactualExplainerJS,
  computeFileSha256,
  CF_CONTRACT_PATH
};
