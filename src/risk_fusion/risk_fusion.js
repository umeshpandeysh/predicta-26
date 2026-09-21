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

function loadRiskFusionContract() {
  if (!fs.existsSync(contractPath)) {
    throw new Error(`CONFIGURATION_ERROR: Risk fusion contract not found at ${contractPath}`);
  }
  const rawContent = fs.readFileSync(contractPath, 'utf-8');
  const contractData = JSON.parse(rawContent);
  const normalized = rawContent.replace(/\r\n/g, '\n');
  const sha256 = crypto.createHash('sha256').update(normalized, 'utf-8').digest('hex');

  return { contractData, sha256 };
}

class GovernedRiskFusionEngineJS {
  constructor(customContractPath = null) {
    const targetPath = customContractPath ? path.resolve(customContractPath) : contractPath;
    if (!fs.existsSync(targetPath)) {
      throw new Error(`CONFIGURATION_ERROR: Contract file missing at ${targetPath}`);
    }
    const rawContent = fs.readFileSync(targetPath, 'utf-8');
    this.contractData = JSON.parse(rawContent);
    const normalized = rawContent.replace(/\r\n/g, '\n');
    this.contractSha256 = crypto.createHash('sha256').update(normalized, 'utf-8').digest('hex');

    this.operatingThreshold = Number(this.contractData.operating_threshold || 0.20);
    this.highRiskThreshold = Number(this.contractData.high_risk_probability_threshold || 0.65);

    this.specLimits = {
      iddq: { max_limit: 5000.0, max_slope_per_hour: 15.0 },
      ileak: { max_limit: 500.0, max_slope_per_hour: 2.0 },
      tpd: { max_limit: 250.0, max_slope_per_hour: 1.0 }
    };
  }

  validateMlProbability(mlProbability) {
    if (mlProbability === null || mlProbability === undefined) {
      throw new Error("VALIDATION_ERROR: ml_probability cannot be null/undefined");
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

  evaluate(
    mlProbability,
    anomalyEvidence,
    driftPredictions,
    safetySlope,
    clientSuppliedRiskScore = null,
    clientSuppliedDisposition = null
  ) {
    const pMl = this.validateMlProbability(mlProbability);

    if (!anomalyEvidence || typeof anomalyEvidence !== 'object' ||
        !driftPredictions || typeof driftPredictions !== 'object' ||
        !safetySlope || typeof safetySlope !== 'object') {
      throw new Error("VALIDATION_ERROR: anomalyEvidence, driftPredictions, and safetySlope must be objects");
    }

    const pat = anomalyEvidence.pat || {};
    const copod = anomalyEvidence.copod || {};
    const patScores = pat.parameter_z_scores || {};
    const copodScoreRaw = copod.score !== undefined ? copod.score : 0.0;

    if (copodScoreRaw === null || isNaN(Number(copodScoreRaw)) || !Number.isFinite(Number(copodScoreRaw))) {
      throw new Error("VALIDATION_ERROR: Non-finite COPOD score");
    }
    const copodScore = Number(copodScoreRaw);

    const patStatus = pat.status || "PASS";
    const copodStatus = copod.status || "PASS";
    const fusionStatus = anomalyEvidence.anomaly_status || anomalyEvidence.overall_status || "NORMAL";

    const paramRisk = {};
    const dominantFactors = [];
    const params = ["iddq", "ileak", "tpd"];

    params.forEach(p => {
      // 1. PAT Anomaly Z-Score Risk
      const rawZ = patScores[p] !== undefined && patScores[p] !== null ? patScores[p] : 0.0;
      if (isNaN(Number(rawZ)) || !Number.isFinite(Number(rawZ))) {
        throw new Error(`VALIDATION_ERROR: Non-finite PAT score for ${p}`);
      }
      const zScore = Math.abs(Number(rawZ));
      const aScore = zScore > 1.0 ? Math.min(100.0, Math.max(0.0, (zScore - 1.0) * 15.0)) : 0.0;

      // 2. GPR Drift & Safety Slope Risk
      const dItem = driftPredictions[p] || {};
      const sItem = safetySlope[p] || {};

      const upper95Raw = dItem.upper_95;
      const upperSlopeRaw = sItem.upper_bound_slope;

      const upper95 = (upper95Raw !== undefined && upper95Raw !== null && Number.isFinite(Number(upper95Raw))) ? Number(upper95Raw) : 0.0;
      const upperSlope = (upperSlopeRaw !== undefined && upperSlopeRaw !== null && Number.isFinite(Number(upperSlopeRaw))) ? Number(upperSlopeRaw) : 0.0;

      const cfg = this.specLimits[p] || { max_limit: 250.0, max_slope_per_hour: 1.0 };
      const rUpper = cfg.max_limit > 0 ? upper95 / cfg.max_limit : 0.0;
      const rSlope = cfg.max_slope_per_hour > 0 ? upperSlope / cfg.max_slope_per_hour : 0.0;
      const rMax = Math.max(rUpper, rSlope);
      const dScore = rMax > 0.70 ? Math.min(100.0, Math.max(0.0, (rMax - 0.70) * 250.0)) : 0.0;

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
    const pRisks = params.map(p => paramRisk[p].parameter_risk);
    const maxPRisk = Math.max(...pRisks);
    const avgPRisk = pRisks.reduce((a, b) => a + b, 0) / pRisks.length;
    let baseRisk = maxPRisk * 0.70 + avgPRisk * 0.30;

    // Degradation Drift Score
    const dRisks = params.map(p => paramRisk[p].drift_risk);
    const maxDRisk = Math.max(...dRisks);
    const avgDRisk = dRisks.reduce((a, b) => a + b, 0) / dRisks.length;
    const degradationDriftScore = Number((maxDRisk * 0.70 + avgDRisk * 0.30).toFixed(2));

    // COPOD Tail Risk Boost
    if (copodScore > 6.5) {
      baseRisk += Math.min(20.0, (copodScore - 6.5) * 5.0);
      dominantFactors.push(`COPOD_TAIL_SCORE=${copodScore.toFixed(2)}`);
    }

    let riskScore = Math.min(100.0, Math.max(0.0, baseRisk));

    // Check Safety Precedence Overrides & Floors
    const anyExceeded = Object.values(safetySlope).some(s => s && s.boundary_status === "EXCEEDED");
    const anyWarning = Object.values(safetySlope).some(s => s && s.boundary_status === "WARNING");

    if (anyExceeded) {
      riskScore = Math.max(riskScore, 75.0);
      dominantFactors.push("SAFETY_CRITERION_EXCEEDED_OVERRIDE");
    } else if (patStatus === "REJECT" || copodStatus === "REJECT" || fusionStatus === "REJECT") {
      riskScore = Math.max(riskScore, 70.0);
      dominantFactors.push("ANOMALY_REJECT_OVERRIDE");
    } else if (anyWarning) {
      riskScore = Math.max(riskScore, 40.0);
      dominantFactors.push("SAFETY_CRITERION_WARNING_OVERRIDE");
    } else if (fusionStatus === "MONITOR") {
      riskScore = Math.max(riskScore, 35.0);
      dominantFactors.push("ANOMALY_MONITOR_OVERRIDE");
    }

    riskScore = Number(riskScore.toFixed(2));

    // Risk Classification
    let riskClass = "SAFE";
    if (riskScore >= 67.0) {
      riskClass = "AT RISK";
    } else if (riskScore >= 34.0) {
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

    return {
      risk_score: riskScore,
      degradation_drift_score: degradationDriftScore,
      risk_class: riskClass,
      dominant_factors: uniqueFactors,
      disposition: disposition,
      override_reason: overrideReason,
      parameter_risk: paramRisk,
      contract_version: this.contractData.contract_version || "1.0.0",
      contract_sha256: this.contractSha256
    };
  }
}

module.exports = {
  loadRiskFusionContract,
  GovernedRiskFusionEngineJS
};
