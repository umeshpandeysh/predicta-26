/**
 * Predicta Semiconductor Test Analytics — Governed Risk Fusion Engine (JavaScript / Node.js)
 * File: src/risk_fusion/risk_fusion.js
 * 
 * Formalized multi-criteria risk fusion engine operating under authoritative contract:
 * ml/risk_fusion/risk_fusion_contract.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoRoot = path.resolve(__dirname, '../..');
const contractPath = path.resolve(repoRoot, 'ml/risk_fusion/risk_fusion_contract.json');
const defaultModelPath = path.resolve(repoRoot, 'ml/models/production/predicta_xgboost_model.json');

const FROZEN_CONTRACT_SHA256 = "3173e5c2389de81d932562a4726bffcb976126e7bff2b11b8d18339ecf9a18ee";
const EXPECTED_MODEL_SHA256 = "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98";

const VALID_PAT_STATUSES = new Set(["PASS", "MONITOR", "REJECT"]);
const VALID_COPOD_STATUSES = new Set(["PASS", "MONITOR", "REJECT"]);
const VALID_ANOMALY_STATUSES = new Set(["PASS", "NORMAL", "MONITOR", "ANOMALOUS", "REJECT"]);
const VALID_SAFETY_STATUSES = new Set(["WITHIN", "WARNING", "EXCEEDED", "INSUFFICIENT_HISTORY"]);

function loadRiskFusionContract(customContractPath = null) {
  const targetPath = customContractPath ? path.resolve(customContractPath) : contractPath;
  if (!fs.existsSync(targetPath)) {
    throw new Error(`CONFIGURATION_ERROR: Risk fusion contract not found at ${targetPath}`);
  }
  const rawContent = fs.readFileSync(targetPath, 'utf-8');
  let contractData;
  try {
    contractData = JSON.parse(rawContent);
  } catch (err) {
    throw new Error(`CONFIGURATION_ERROR: Malformed contract JSON: ${err.message}`);
  }

  const normalized = rawContent.replace(/\r\n/g, '\n');
  const sha256 = crypto.createHash('sha256').update(normalized, 'utf-8').digest('hex');

  // Governance checks
  if (contractData.contract_name !== "predicta_governed_risk_fusion_contract") {
    throw new Error("CONFIGURATION_ERROR: Invalid contract name identity");
  }
  if (contractData.contract_version !== "1.0.0") {
    throw new Error("CONFIGURATION_ERROR: Invalid contract version identity");
  }
  if (Number(contractData.operating_threshold) !== 0.20) {
    throw new Error("CONFIGURATION_ERROR: Mutated operating threshold in contract");
  }
  if (contractData.target_model_sha256 !== EXPECTED_MODEL_SHA256) {
    throw new Error("CONFIGURATION_ERROR: Target model SHA-256 mismatch in contract");
  }

  if (sha256 !== FROZEN_CONTRACT_SHA256) {
    throw new Error(`CONFIGURATION_ERROR: Contract SHA-256 mismatch! Got ${sha256}, expected ${FROZEN_CONTRACT_SHA256}`);
  }

  return { contractData, sha256 };
}

function verifyProductionModelSha(customModelPath = null, expectedSha = EXPECTED_MODEL_SHA256) {
  const targetPath = customModelPath ? path.resolve(customModelPath) : defaultModelPath;
  if (!fs.existsSync(targetPath)) {
    throw new Error(`CONFIGURATION_ERROR: Production model artifact not found at ${targetPath}`);
  }
  const rawContent = fs.readFileSync(targetPath, 'utf-8');
  const normalized = rawContent.replace(/\r\n/g, '\n');
  const sha256 = crypto.createHash('sha256').update(normalized, 'utf-8').digest('hex');

  if (sha256 !== expectedSha) {
    throw new Error(`CONFIGURATION_ERROR: Production model SHA-256 mismatch! Computed: ${sha256}, Expected: ${expectedSha}`);
  }
  return sha256;
}

class GovernedRiskFusionEngineJS {
  constructor(customContractPath = null, customModelPath = null) {
    const { contractData, sha256 } = loadRiskFusionContract(customContractPath);
    this.contractData = contractData;
    this.contractSha256 = sha256;
    this.modelSha256 = verifyProductionModelSha(customModelPath, this.contractData.target_model_sha256 || EXPECTED_MODEL_SHA256);

    this.operatingThreshold = Number(this.contractData.operating_threshold || 0.20);
    this.highRiskThreshold = Number(this.contractData.high_risk_probability_threshold || 0.65);

    // Load authoritative contract constants
    this.physicsLimits = this.contractData.physics_limits || {};
    this.patParams = this.contractData.pat_parameters || { z_threshold: 1.0, scale_multiplier: 15.0 };
    this.gprParams = this.contractData.gpr_parameters || { ratio_threshold: 0.70, scale_multiplier: 250.0 };
    this.weights = this.contractData.aggregation_weights || { base_max_weight: 0.70, base_mean_weight: 0.30 };
    this.copodParams = this.contractData.copod_parameters || { boost_threshold: 6.5, boost_multiplier: 5.0, max_boost: 20.0 };
    this.riskClassesCfg = this.contractData.risk_class_thresholds || { safe_max: 34.0, monitor_max: 67.0 };
    this.overrideFloors = this.contractData.override_floors || { safety_exceeded: 75.0, anomaly_reject: 70.0, safety_warning: 40.0, anomaly_monitor: 35.0 };
  }

  validateMlProbability(mlProbability) {
    if (mlProbability === null || mlProbability === undefined || typeof mlProbability === 'boolean') {
      throw new Error("VALIDATION_ERROR: ml_probability cannot be null, undefined, or boolean");
    }
    const p = Number(mlProbability);
    if (isNaN(p) || !Number.isFinite(p)) {
      throw new Error(`VALIDATION_ERROR: ml_probability must be a finite numeric value, got: ${mlProbability}`);
    }
    if (p < 0.0 || p > 1.0) {
      throw new Error(`VALIDATION_ERROR: ml_probability must be in range [0.0, 1.0], got: ${p}`);
    }
    return p;
  }

  validateEvidence(anomalyEvidence, driftPredictions, safetySlope) {
    if (!anomalyEvidence || typeof anomalyEvidence !== 'object' || Array.isArray(anomalyEvidence)) {
      throw new Error("VALIDATION_ERROR: anomalyEvidence must be an object");
    }
    if (!driftPredictions || typeof driftPredictions !== 'object' || Array.isArray(driftPredictions)) {
      throw new Error("VALIDATION_ERROR: driftPredictions must be an object");
    }
    if (!safetySlope || typeof safetySlope !== 'object' || Array.isArray(safetySlope)) {
      throw new Error("VALIDATION_ERROR: safetySlope must be an object");
    }

    // 1. Validate PAT Evidence
    const pat = anomalyEvidence.pat;
    if (!pat || typeof pat !== 'object' || Array.isArray(pat)) {
      throw new Error("VALIDATION_ERROR: Missing required 'pat' evidence object");
    }
    if (!VALID_PAT_STATUSES.has(pat.status)) {
      throw new Error(`VALIDATION_ERROR: Invalid PAT status '${pat.status}'. Must be one of: PASS, MONITOR, REJECT`);
    }

    const patScores = pat.parameter_z_scores;
    if (!patScores || typeof patScores !== 'object' || Array.isArray(patScores)) {
      throw new Error("VALIDATION_ERROR: Missing required 'parameter_z_scores' in PAT evidence");
    }
    ["iddq", "ileak", "tpd"].forEach(p => {
      if (!(p in patScores)) {
        throw new Error(`VALIDATION_ERROR: Missing required PAT z-score for parameter '${p}'`);
      }
      const zVal = patScores[p];
      if (zVal === null || zVal === undefined || typeof zVal === 'boolean') {
        throw new Error(`VALIDATION_ERROR: PAT z-score for '${p}' cannot be null/boolean`);
      }
      const fz = Number(zVal);
      if (isNaN(fz) || !Number.isFinite(fz)) {
        throw new Error(`VALIDATION_ERROR: Non-finite PAT z-score for '${p}'`);
      }
    });

    // 2. Validate COPOD Evidence
    const copod = anomalyEvidence.copod;
    if (!copod || typeof copod !== 'object' || Array.isArray(copod)) {
      throw new Error("VALIDATION_ERROR: Missing required 'copod' evidence object");
    }
    if (!VALID_COPOD_STATUSES.has(copod.status)) {
      throw new Error(`VALIDATION_ERROR: Invalid COPOD status '${copod.status}'. Must be one of: PASS, MONITOR, REJECT`);
    }

    if (copod.score === null || copod.score === undefined || typeof copod.score === 'boolean') {
      throw new Error("VALIDATION_ERROR: COPOD score cannot be null/boolean");
    }
    const fc = Number(copod.score);
    if (isNaN(fc) || !Number.isFinite(fc)) {
      throw new Error("VALIDATION_ERROR: Non-finite COPOD score");
    }

    // 3. Validate Anomaly / Fusion Status Enumerations
    const fusionStatus = anomalyEvidence.anomaly_status || anomalyEvidence.overall_status;
    if (fusionStatus && !VALID_ANOMALY_STATUSES.has(fusionStatus)) {
      throw new Error(`VALIDATION_ERROR: Invalid anomaly status '${fusionStatus}'. Must be one of: PASS, NORMAL, MONITOR, ANOMALOUS, REJECT`);
    }

    // 4. Validate GPR Drift Evidence
    ["iddq", "ileak", "tpd"].forEach(p => {
      if (!(p in driftPredictions)) {
        throw new Error(`VALIDATION_ERROR: Missing GPR drift prediction for parameter '${p}'`);
      }
      const dItem = driftPredictions[p];
      if (!dItem || typeof dItem !== 'object' || Array.isArray(dItem)) {
        throw new Error(`VALIDATION_ERROR: GPR drift prediction for '${p}' must be an object`);
      }
      const hasHistory = dItem.has_history !== false;
      if (hasHistory && dItem.status !== "INSUFFICIENT_HISTORY") {
        if (dItem.upper_95 !== undefined && dItem.upper_95 !== null) {
          const fu = Number(dItem.upper_95);
          if (isNaN(fu) || !Number.isFinite(fu)) {
            throw new Error(`VALIDATION_ERROR: Non-finite GPR upper_95 for '${p}'`);
          }
        }
      }
    });

    // 5. Validate Safety Slope Evidence
    ["iddq", "ileak", "tpd"].forEach(p => {
      if (!(p in safetySlope)) {
        throw new Error(`VALIDATION_ERROR: Missing safety slope evidence for parameter '${p}'`);
      }
      const sItem = safetySlope[p];
      if (!sItem || typeof sItem !== 'object' || Array.isArray(sItem)) {
        throw new Error(`VALIDATION_ERROR: Safety slope evidence for '${p}' must be an object`);
      }
      if (!VALID_SAFETY_STATUSES.has(sItem.boundary_status)) {
        throw new Error(`VALIDATION_ERROR: Invalid safety boundary_status '${sItem.boundary_status}' for '${p}'. Must be one of: WITHIN, WARNING, EXCEEDED, INSUFFICIENT_HISTORY`);
      }
      if (sItem.upper_bound_slope !== undefined && sItem.upper_bound_slope !== null) {
        const fs = Number(sItem.upper_bound_slope);
        if (isNaN(fs) || !Number.isFinite(fs)) {
          throw new Error(`VALIDATION_ERROR: Non-finite safety upper_bound_slope for '${p}'`);
        }
      }
    });
  }

  evaluate(
    mlProbability,
    anomalyEvidence,
    driftPredictions,
    safetySlope,
    clientSuppliedRiskScore = null,
    clientSuppliedDisposition = null
  ) {
    // DEFECT A: Client-supplied risk score or disposition must fail closed!
    if (clientSuppliedRiskScore !== null && clientSuppliedRiskScore !== undefined) {
      throw new Error("VALIDATION_ERROR: Client-supplied risk score authority injection rejected");
    }
    if (clientSuppliedDisposition !== null && clientSuppliedDisposition !== undefined) {
      throw new Error("VALIDATION_ERROR: Client-supplied disposition authority injection rejected");
    }

    const pMl = this.validateMlProbability(mlProbability);
    this.validateEvidence(anomalyEvidence, driftPredictions, safetySlope);

    const pat = anomalyEvidence.pat;
    const copod = anomalyEvidence.copod;
    const patScores = pat.parameter_z_scores;
    const copodScore = Number(copod.score);

    const patStatus = pat.status;
    const copodStatus = copod.status;
    const fusionStatus = anomalyEvidence.anomaly_status || anomalyEvidence.overall_status || "NORMAL";

    const paramRisk = {};
    const dominantFactors = [];
    const params = ["iddq", "ileak", "tpd"];

    const zThresh = Number(this.patParams.z_threshold || 1.0);
    const zMult = Number(this.patParams.scale_multiplier || 15.0);
    const ratioThresh = Number(this.gprParams.ratio_threshold || 0.70);
    const ratioMult = Number(this.gprParams.scale_multiplier || 250.0);

    params.forEach(p => {
      // 1. PAT Anomaly Z-Score Risk
      const rawZ = patScores[p];
      const zScore = Math.abs(Number(rawZ));
      const aScore = zScore > zThresh ? Math.min(100.0, Math.max(0.0, (zScore - zThresh) * zMult)) : 0.0;

      // 2. GPR Drift & Safety Slope Risk
      const dItem = driftPredictions[p] || {};
      const sItem = safetySlope[p] || {};

      const upper95Raw = dItem.upper_95;
      const upperSlopeRaw = sItem.upper_bound_slope;

      const upper95 = (upper95Raw !== undefined && upper95Raw !== null && Number.isFinite(Number(upper95Raw))) ? Number(upper95Raw) : 0.0;
      const upperSlope = (upperSlopeRaw !== undefined && upperSlopeRaw !== null && Number.isFinite(Number(upperSlopeRaw))) ? Number(upperSlopeRaw) : 0.0;

      const cfg = this.physicsLimits[p] || { max_limit: 250.0, max_slope_per_hour: 1.0 };
      const rUpper = cfg.max_limit > 0 ? upper95 / cfg.max_limit : 0.0;
      const rSlope = cfg.max_slope_per_hour > 0 ? upperSlope / cfg.max_slope_per_hour : 0.0;
      const rMax = Math.max(rUpper, rSlope);
      const dScore = rMax > ratioThresh ? Math.min(100.0, Math.max(0.0, (rMax - ratioThresh) * ratioMult)) : 0.0;

      const pRisk = Math.max(aScore, dScore, 0.5 * aScore + 0.5 * dScore);
      paramRisk[p] = {
        anomaly_risk: Number(aScore.toFixed(2)),
        drift_risk: Number(dScore.toFixed(2)),
        parameter_risk: Number(pRisk.toFixed(2)),
        boundary_status: sItem.boundary_status || "WITHIN"
      };

      if (aScore >= 50.0) dominantFactors.push(`PAT_ANOMALY_${p.toUpperCase()}_Z=${zScore.toFixed(2)}`);
      if (dScore >= 50.0) dominantFactors.push(`HIGH_DRIFT_${p.toUpperCase()}_TRAJECTORY`);
    });

    // Aggregate Base Component Risk
    const wMax = Number(this.weights.base_max_weight || 0.70);
    const wMean = Number(this.weights.base_mean_weight || 0.30);

    const pRisks = params.map(p => paramRisk[p].parameter_risk);
    const maxPRisk = Math.max(...pRisks);
    const avgPRisk = pRisks.reduce((a, b) => a + b, 0) / pRisks.length;
    let baseRisk = maxPRisk * wMax + avgPRisk * wMean;

    // Degradation Drift Score
    const dRisks = params.map(p => paramRisk[p].drift_risk);
    const maxDRisk = Math.max(...dRisks);
    const avgDRisk = dRisks.reduce((a, b) => a + b, 0) / dRisks.length;
    const degradationDriftScore = Number((maxDRisk * wMax + avgDRisk * wMean).toFixed(2));

    // COPOD Tail Risk Boost
    const copodBThresh = Number(this.copodParams.boost_threshold || 6.5);
    const copodBMult = Number(this.copodParams.boost_multiplier || 5.0);
    const copodBMax = Number(this.copodParams.max_boost || 20.0);

    if (copodScore > copodBThresh) {
      baseRisk += Math.min(copodBMax, (copodScore - copodBThresh) * copodBMult);
      dominantFactors.push(`COPOD_TAIL_SCORE=${copodScore.toFixed(2)}`);
    }

    let riskScore = Math.min(100.0, Math.max(0.0, baseRisk));

    // Check Safety Precedence Overrides & Floors
    const anyExceeded = Object.values(safetySlope).some(s => s && s.boundary_status === "EXCEEDED");
    const anyWarning = Object.values(safetySlope).some(s => s && s.boundary_status === "WARNING");

    const floorExceeded = Number(this.overrideFloors.safety_exceeded || 75.0);
    const floorRej = Number(this.overrideFloors.anomaly_reject || 70.0);
    const floorWarn = Number(this.overrideFloors.safety_warning || 40.0);
    const floorMon = Number(this.overrideFloors.anomaly_monitor || 35.0);

    if (anyExceeded) {
      riskScore = Math.max(riskScore, floorExceeded);
      dominantFactors.push("SAFETY_CRITERION_EXCEEDED_OVERRIDE");
    } else if (patStatus === "REJECT" || copodStatus === "REJECT" || fusionStatus === "REJECT") {
      riskScore = Math.max(riskScore, floorRej);
      dominantFactors.push("ANOMALY_REJECT_OVERRIDE");
    } else if (anyWarning) {
      riskScore = Math.max(riskScore, floorWarn);
      dominantFactors.push("SAFETY_CRITERION_WARNING_OVERRIDE");
    } else if (fusionStatus === "MONITOR") {
      riskScore = Math.max(riskScore, floorMon);
      dominantFactors.push("ANOMALY_MONITOR_OVERRIDE");
    }

    riskScore = Number(riskScore.toFixed(2));

    // Risk Classification
    const safeMax = Number(this.riskClassesCfg.safe_max || 34.0);
    const monitorMax = Number(this.riskClassesCfg.monitor_max || 67.0);

    let riskClass = "SAFE";
    if (riskScore >= monitorMax) {
      riskClass = "AT RISK";
    } else if (riskScore >= safeMax) {
      riskClass = "MONITOR";
    }

    // Disposition Synthesis & Override Reason Determination
    let disposition = "PASS";
    let overrideReason = "NONE";

    if (pMl >= this.highRiskThreshold || patStatus === "REJECT" || copodStatus === "REJECT" || fusionStatus === "REJECT" || anyExceeded) {
      disposition = "REJECT";
      if (pMl >= this.highRiskThreshold) {
        overrideReason = "ML_HIGH_RISK";
      } else if (patStatus === "REJECT") {
        overrideReason = "PAT_CRITICAL_ANOMALY";
      } else if (copodStatus === "REJECT") {
        overrideReason = "COPOD_CRITICAL_ANOMALY";
      } else if (safetySlope.iddq && safetySlope.iddq.boundary_status === "EXCEEDED") {
        overrideReason = "GPR_IDDQ_LIMIT_EXCEEDED";
      } else if (safetySlope.ileak && safetySlope.ileak.boundary_status === "EXCEEDED") {
        overrideReason = "GPR_ILEAK_LIMIT_EXCEEDED";
      } else if (safetySlope.tpd && safetySlope.tpd.boundary_status === "EXCEEDED") {
        overrideReason = "GPR_TPD_LIMIT_EXCEEDED";
      } else {
        overrideReason = "PAT_CRITICAL_ANOMALY";
      }
    } else if (pMl >= this.operatingThreshold || fusionStatus === "MONITOR" || anyWarning) {
      disposition = "MONITOR";
      if (pMl >= this.operatingThreshold) {
        overrideReason = "ML_ELEVATED_RISK";
      } else {
        overrideReason = "ANOMALY_OR_DRIFT_WARNING";
      }
    }

    if (dominantFactors.length === 0) {
      dominantFactors.push("NOMINAL_OPERATING_ENVELOPE");
    }

    const uniqueFactors = Array.from(new Set(dominantFactors)).sort();

    // DEFECT E: Machine-Readable Provenance Object
    const provenance = {
      contract_name: this.contractData.contract_name || "predicta_governed_risk_fusion_contract",
      contract_version: this.contractData.contract_version || "1.0.0",
      contract_sha256: this.contractSha256,
      model_identity: "predicta_xgboost_model",
      model_sha256: this.modelSha256,
      operating_threshold: this.operatingThreshold,
      anomaly_detector_identity: "ANOMALY_FUSION_ENGINE",
      prognostic_engine_identity: "GPR_DEGRADATION_FORECASTER",
      physics_safety_identity: "SAFETY_SLOPE_CALCULATOR",
      calculation_version: "1.0.0",
      evaluation_status: "EVALUATION_ONLY",
      governance_disclaimer: "NOT A FAILURE PROBABILITY. NOT AN EXPECTED MONETARY LOSS. NOT A CONFORMAL GUARANTEE."
    };

    return {
      risk_score: riskScore,
      degradation_drift_score: degradationDriftScore,
      risk_class: riskClass,
      dominant_factors: uniqueFactors,
      disposition: disposition,
      override_reason: overrideReason,
      parameter_risk: paramRisk,
      provenance: provenance,
      contract_version: this.contractData.contract_version || "1.0.0",
      contract_sha256: this.contractSha256
    };
  }
}

module.exports = {
  loadRiskFusionContract,
  verifyProductionModelSha,
  GovernedRiskFusionEngineJS
};
