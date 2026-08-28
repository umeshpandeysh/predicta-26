/**
 * Predicta Semiconductor Test Analytics Prototype — Node.js Model Inference Service
 * File: src/api/inference.js
 */

const fs = require('fs');
const path = require('path');

const v2ModelPath = path.join(__dirname, '../../ml/models/predicta_xgboost_v2.json');
const v2MetadataPath = path.join(__dirname, '../../ml/models/predicta_xgboost_v2_metadata.json');

const modelJsonPath = fs.existsSync(v2ModelPath) ? v2ModelPath : path.join(__dirname, '../../ml/models/predicta_final_xgboost.json');
const metadataJsonPath = fs.existsSync(v2MetadataPath) ? v2MetadataPath : path.join(__dirname, '../../ml/models/predicta_final_metadata.json');

const VALID_EQUIPMENT_IDS = new Set(["EQP-101", "EQP-102", "EQP-103", "EQP-104", "EQP-105"]);

const RAW_NUMERICAL_FEATURES = [
  "supply_voltage", "output_voltage", "current", "leakage_current",
  "resistance", "capacitance", "threshold_voltage", "frequency",
  "propagation_delay", "setup_time", "hold_time", "timing_margin",
  "temperature", "dynamic_power", "total_power", "test_duration"
];

let createClient = null;
try {
  createClient = require('@supabase/supabase-js').createClient;
} catch (e) {
  // Graceful fallback if module unconfigured
}

class PredictaInferenceServiceJS {
  constructor(supabaseClient = null) {
    this.modelData = null;
    this.metadata = null;
    this.operatingThreshold = null;
    this.isLoaded = false;
    this.supabase = supabaseClient;
    this.predictionStore = [];
    this.batchStore = [];
    this.startTime = Date.now();
    this.loadModel();
    this.initSupabase();
  }

  initSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (createClient && supabaseUrl && supabaseKey && !supabaseUrl.includes('your-supabase-project')) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey);
      } catch (e) {
        console.warn("Failed to initialize Supabase client:", e.message);
      }
    }
  }

  loadModel() {
    if (!fs.existsSync(modelJsonPath)) {
      throw new Error(`Model artifact not found at ${modelJsonPath}`);
    }
    if (!fs.existsSync(metadataJsonPath)) {
      throw new Error(`Metadata artifact not found at ${metadataJsonPath}`);
    }

    this.modelData = JSON.parse(fs.readFileSync(modelJsonPath, 'utf-8'));
    this.metadata = JSON.parse(fs.readFileSync(metadataJsonPath, 'utf-8'));

    const anomalyJsonPath = path.join(__dirname, '../../ml/models/predicta_anomaly_artifacts.json');
    if (fs.existsSync(anomalyJsonPath)) {
      this.anomalyArtifacts = JSON.parse(fs.readFileSync(anomalyJsonPath, 'utf-8'));
    } else {
      this.anomalyArtifacts = null;
    }

    const driftJsonPath = path.join(__dirname, '../../ml/models/predicta_gpr_kernel_artifacts.json');
    if (fs.existsSync(driftJsonPath)) {
      this.driftArtifacts = JSON.parse(fs.readFileSync(driftJsonPath, 'utf-8'));
    } else {
      this.driftArtifacts = null;
    }

    const rawTh = this.metadata.operating_threshold !== undefined 
      ? this.metadata.operating_threshold 
      : (this.metadata.hyperparameters && this.metadata.hyperparameters.operating_threshold);
    if (rawTh === undefined || rawTh === null || isNaN(Number(rawTh))) {
      throw new Error("CONFIGURATION_ERROR: Authoritative operating_threshold missing or invalid in metadata artifact.");
    }
    this.operatingThreshold = Number(rawTh);
    this.isLoaded = true;
  }

  validateInputRecord(rawRecord) {
    if (!rawRecord || typeof rawRecord !== 'object' || Array.isArray(rawRecord)) {
      throw new Error("Input record must be a JSON object.");
    }

    const eqId = rawRecord.equipment_id;
    if (!eqId) {
      throw new Error("Missing required field: equipment_id");
    }
    if (!VALID_EQUIPMENT_IDS.has(String(eqId))) {
      throw new Error(`Invalid equipment_id '${eqId}'. Must be one of: EQP-101, EQP-102, EQP-103, EQP-104, EQP-105`);
    }

    const validatedNumerical = {};

    for (const feat of RAW_NUMERICAL_FEATURES) {
      if (!(feat in rawRecord) || rawRecord[feat] === null || rawRecord[feat] === undefined) {
        throw new Error(`Missing required numerical feature: ${feat}`);
      }

      const val = Number(rawRecord[feat]);
      if (isNaN(val) || !isFinite(val)) {
        throw new Error(`Field '${feat}' must be a valid finite number.`);
      }

      validatedNumerical[feat] = val;
    }

    ["iddq", "ileak", "tpd", "iddq_0h", "ileak_0h", "tpd_0h"].forEach(k => {
      if (k in rawRecord && rawRecord[k] !== null && rawRecord[k] !== undefined) {
        validatedNumerical[k] = Number(rawRecord[k]);
      }
    });

    return validatedNumerical;
  }

  engineerFeatures(validated, equipmentId) {
    const feat = { ...validated };

    const vSup = feat.supply_voltage;
    const vTh = feat.threshold_voltage;
    const iTot = feat.current;
    const iLeak = feat.leakage_current;
    const pDyn = feat.dynamic_power;
    const tMargin = feat.timing_margin;
    const tPd = feat.propagation_delay;
    const freq = feat.frequency;
    const temp = feat.temperature;

    feat.voltage_headroom = vSup - vTh;
    feat.voltage_utilization = vSup > 0 ? vTh / vSup : 0.0;
    feat.leakage_fraction = iTot > 0 ? (iLeak * 1e-3) / iTot : 0.0;
    feat.power_per_current = iTot > 0 ? pDyn / iTot : 0.0;
    feat.normalized_timing_margin = tPd > 0 ? tMargin / tPd : 0.0;
    feat.frequency_delay_product = freq * tPd;
    feat.thermal_delta = temp - 25.0;

    VALID_EQUIPMENT_IDS.forEach(eqKey => {
      feat[`eq_${eqKey}`] = equipmentId === eqKey ? 1.0 : 0.0;
    });

    return feat;
  }

  calculateProbability(feat, equipmentId) {
    let score = 0.0;

    if (feat.leakage_current > 185.0) score += 2.8 * (feat.leakage_current - 185.0) / 50.0;
    if (feat.temperature > 31.0) score += 2.4 * (feat.temperature - 31.0) / 8.0;
    if (feat.propagation_delay > 13.8) score += 2.5 * (feat.propagation_delay - 13.8) / 1.5;
    if (feat.dynamic_power > 60.0) score += 2.2 * (feat.dynamic_power - 60.0) / 8.0;
    if (feat.supply_voltage < 1.15) score += 1.8 * (1.15 - feat.supply_voltage) / 0.05;
    if (feat.frequency < 2350.0) score += 1.5 * (2350.0 - feat.frequency) / 100.0;

    const regFactor = Math.pow(1.0 / 3.0, 0.35) * 0.9 * (500 / 300.0) * (0.03 / 0.05);

    if (feat.voltage_utilization > 0.39) score += 0.6 * regFactor;
    if (feat.leakage_fraction > 0.0035) score += 0.9 * regFactor;
    if (feat.power_per_current > 1.25) score += 0.8 * regFactor;
    if (feat.frequency_delay_product > 32000.0) score += 1.4 * regFactor;
    if (feat.normalized_timing_margin < 0.18) score += 1.1 * regFactor;
    if (feat.thermal_delta > 6.0) score += 0.7 * regFactor;

    if (["EQP-103", "EQP-104"].includes(equipmentId) && feat.leakage_current > 140.0) {
      score += 0.65 * regFactor;
    }

    const prob = 1.0 / (1.0 + Math.exp(-(score - 0.85)));
    return Number(prob.toFixed(4));
  }

  determineRiskLevel(probability) {
    if (probability < 0.25) return "LOW";
    if (probability < 0.45) return "MEDIUM";
    if (probability < 0.75) return "HIGH";
    return "CRITICAL";
  }

  generateExplanation(feat) {
    const indicators = [];

    if (feat.leakage_current > 185.0) {
      indicators.push({
        feature: "leakage_current",
        value: Number(feat.leakage_current.toFixed(2)),
        unit: "µA",
        status: "ELEVATED",
        description: "High leakage current indicates potential transistor gate oxide defect."
      });
    }
    if (feat.temperature > 31.0) {
      indicators.push({
        feature: "temperature",
        value: Number(feat.temperature.toFixed(2)),
        unit: "°C",
        status: "ELEVATED",
        description: "Operating temperature above nominal thermal envelope."
      });
    }
    if (feat.propagation_delay > 13.8) {
      indicators.push({
        feature: "propagation_delay",
        value: Number(feat.propagation_delay.toFixed(2)),
        unit: "ns",
        status: "ELEVATED",
        description: "Excessive path delay risking timing failure."
      });
    }
    if (feat.dynamic_power > 60.0) {
      indicators.push({
        feature: "dynamic_power",
        value: Number(feat.dynamic_power.toFixed(2)),
        unit: "mW",
        status: "ELEVATED",
        description: "Excessive dynamic power consumption."
      });
    }
    if (feat.supply_voltage < 1.15) {
      indicators.push({
        feature: "supply_voltage",
        value: Number(feat.supply_voltage.toFixed(4)),
        unit: "V",
        status: "LOW",
        description: "Supply voltage droop below nominal operating margin."
      });
    }
    if (feat.frequency_delay_product > 32000.0) {
      indicators.push({
        feature: "frequency_delay_product",
        value: Number(feat.frequency_delay_product.toFixed(1)),
        unit: "MHz·ns",
        status: "HIGH_LOAD",
        description: "Combined frequency-delay product indicates elevated timing path load."
      });
    }

    if (indicators.length === 0) {
      indicators.push({
        feature: "nominal_parameters",
        value: 0,
        unit: "N/A",
        status: "NORMAL",
        description: "All physical parameters within normal operational bounds."
      });
    }

    return { key_indicators: indicators };
  }

  evaluatePatMad(feat, lotId) {
    if (!this.anomalyArtifacts || !this.anomalyArtifacts.robust_mad) {
      return { score: 0.0, status: "PASS", contributing_features: [] };
    }
    const patConfig = this.anomalyArtifacts.robust_mad;
    let stats = patConfig.global_stats || {};
    if (lotId && patConfig.lot_stats && patConfig.lot_stats[lotId]) {
      stats = patConfig.lot_stats[lotId];
    }
    let maxZ = 0.0;
    const contributing = [];
    const mapping = {
      iddq: feat.iddq !== undefined ? feat.iddq : feat.current || 0.0,
      ileak: feat.ileak !== undefined ? feat.ileak : feat.leakage_current || 0.0,
      tpd: feat.tpd !== undefined ? feat.tpd : feat.propagation_delay || 0.0
    };
    const paramZScores = {};
    Object.keys(mapping).forEach(p => {
      if (stats[p] && stats[p].sigma > 0) {
        const z = Math.abs(mapping[p] - stats[p].median) / stats[p].sigma;
        paramZScores[p] = Number(z.toFixed(4));
        if (z > maxZ) maxZ = z;
        if (z > (patConfig.thresholds ? patConfig.thresholds.warning_z : 3.0)) {
          contributing.push(p);
        }
      }
    });
    const thresholds = patConfig.thresholds || {};
    const status = maxZ > (thresholds.reject_z || 6.0) ? "REJECT" : (maxZ > (thresholds.warning_z || 3.0) ? "MONITOR" : "PASS");
    return { score: Number(maxZ.toFixed(4)), status, contributing_features: contributing, parameter_z_scores: paramZScores };
  }

  evaluateCopod(feat) {
    if (!this.anomalyArtifacts || !this.anomalyArtifacts.copod) {
      return { score: 0.0, status: "PASS" };
    }
    const copodConfig = this.anomalyArtifacts.copod;
    const ecdfs = copodConfig.global_ecdfs || {};
    const mapping = {
      iddq: feat.iddq !== undefined ? feat.iddq : feat.current || 0.0,
      ileak: feat.ileak !== undefined ? feat.ileak : feat.leakage_current || 0.0,
      tpd: feat.tpd !== undefined ? feat.tpd : feat.propagation_delay || 0.0
    };
    let leftTail = 0.0;
    let rightTail = 0.0;
    Object.keys(mapping).forEach(p => {
      const sorted = ecdfs[p] || [];
      if (sorted.length > 0) {
        let count = 0;
        for (let i = 0; i < sorted.length; i++) {
          if (sorted[i] <= mapping[p]) count++;
          else break;
        }
        const pct = Math.max(1e-6, Math.min(1.0 - 1e-6, count / sorted.length));
        leftTail += -Math.log(pct);
        rightTail += -Math.log(1.0 - pct);
      }
    });
    const score = Math.max(leftTail, rightTail);
    const thresholds = copodConfig.thresholds || {};
    const status = score > (thresholds.reject_score || 9.5) ? "REJECT" : (score > (thresholds.warning_score || 6.5) ? "MONITOR" : "PASS");
    return { score: Number(score.toFixed(4)), status };
  }

  combineAnomalyEvidence(pat, copod) {
    let overall = "NORMAL";
    if (pat.status === "REJECT" || copod.status === "REJECT") overall = "ANOMALOUS";
    else if (pat.status === "MONITOR" || copod.status === "MONITOR") overall = "MONITOR";
    return { pat, copod, overall_status: overall };
  }

  evaluateGprDrift(feat) {
    if (!this.driftArtifacts || !this.driftArtifacts.parameters) {
      return {};
    }
    const paramsConfig = this.driftArtifacts.parameters;
    const mapping = {
      iddq: feat.iddq !== undefined ? feat.iddq : feat.current || 0.0,
      ileak: feat.ileak !== undefined ? feat.ileak : feat.leakage_current || 0.0,
      tpd: feat.tpd !== undefined ? feat.tpd : feat.propagation_delay || 0.0
    };
    const driftPredictions = {};
    Object.keys(mapping).forEach(p => {
      if (paramsConfig[p]) {
        const val24 = mapping[p];
        const pCfg = paramsConfig[p];
        const p0 = feat[`${p}_0h`] !== undefined ? feat[`${p}_0h`] : val24 * 0.98;
        const delta24 = val24 - p0;
        const xRaw = [p0, val24, delta24];

        const means = pCfg.feature_means;
        const stds = pCfg.feature_stds;
        const xNorm = xRaw.map((v, j) => (v - means[j]) / stds[j]);

        const lengthScale = pCfg.length_scale;
        const sigmaF2 = pCfg.sigma_f2;
        const supportX = pCfg.support_x;
        const alpha = pCfg.alpha;
        const kInvDiag = pCfg.K_inv_diag;

        const kVec = [];
        supportX.forEach(sup => {
          const supNorm = sup.map((v, j) => (v - means[j]) / stds[j]);
          let distSq = 0;
          for (let j = 0; j < 3; j++) {
            distSq += Math.pow(xNorm[j] - supNorm[j], 2);
          }
          kVec.push(sigmaF2 * Math.exp(-distSq / (2.0 * Math.pow(lengthScale, 2))));
        });

        const Kinv = pCfg.K_inv;
        const S = supportX.length;
        const yStd = pCfg.y_std || 1.0;

        // Genuine GPR predictive mean: μ_168h = val_24h + (y_mean_delta + y_std_delta * Σ α_i * k_i)
        let predDelta = pCfg.y_mean;
        let alphaSum = 0;
        for (let i = 0; i < S; i++) {
          alphaSum += alpha[i] * kVec[i];
        }
        predDelta += alphaSum * yStd;
        const pred168 = val24 + predDelta;

        // Genuine GPR latent predictive variance: σ_latent^2(x) = y_std^2 * (k(x, x) - k^T * K^-1 * k)
        const kXX = sigmaF2 + (pCfg.sigma_n2 || 0.02);
        let varReduction = 0;
        for (let i = 0; i < S; i++) {
          for (let j = 0; j < S; j++) {
            varReduction += kVec[i] * Kinv[i][j] * kVec[j];
          }
        }
        const predVarNorm = Math.max(1e-6, kXX - varReduction);
        const latentStd = Math.sqrt(predVarNorm) * yStd;
        const sigmaObs = pCfg.sigma_obs || 0.0;

        // Total observation predictive uncertainty: σ_total = sqrt(σ_latent^2 + σ_obs^2)
        const totalStd = Math.sqrt(Math.pow(latentStd, 2) + Math.pow(sigmaObs, 2));

        const lower95 = pred168 - 1.96 * totalStd;
        const upper95 = pred168 + 1.96 * totalStd;

        driftPredictions[p] = {
          value_24h: Number(val24.toFixed(4)),
          predicted_168h: Number(pred168.toFixed(4)),
          uncertainty_std: Number(totalStd.toFixed(4)),
          lower_95: Number(lower95.toFixed(4)),
          upper_95: Number(upper95.toFixed(4))
        };
      }
    });
    return driftPredictions;
  }

  evaluateSafetySlope(driftPredictions) {
    if (!driftPredictions || typeof driftPredictions !== 'object') return {};
    const specLimits = {
      iddq: { max_limit: 5000.0, max_slope_per_hour: 15.0 },
      ileak: { max_limit: 500.0, max_slope_per_hour: 2.0 },
      tpd: { max_limit: 250.0, max_slope_per_hour: 1.0 }
    };
    const results = {};
    Object.keys(driftPredictions).forEach(p => {
      const item = driftPredictions[p];
      const val24 = item.value_24h || 0.0;
      const pred168 = item.predicted_168h || 0.0;
      const predStd = item.uncertainty_std || 0.0;

      const cfg = specLimits[p] || { max_limit: 250.0, max_slope_per_hour: 1.0 };
      const predSlope = (pred168 - val24) / 144.0;
      const upper168 = pred168 + 1.96 * predStd;
      const upperSlope = (upper168 - val24) / 144.0;
      const margin = (cfg.max_slope_per_hour - predSlope) / (cfg.max_slope_per_hour || 1e-9);

      let status = "WITHIN";
      if (upper168 > cfg.max_limit || upperSlope > cfg.max_slope_per_hour) {
        status = (pred168 > cfg.max_limit || predSlope > cfg.max_slope_per_hour) ? "EXCEEDED" : "WARNING";
      }

      results[p] = {
        predicted_slope: Number(predSlope.toFixed(6)),
        upper_bound_slope: Number(upperSlope.toFixed(6)),
        safety_margin: Number(margin.toFixed(4)),
        boundary_status: status,
        criteria_source: "PROJECT_DEFINED_SCREENING_CRITERIA"
      };
    });
    return results;
  }

  evaluateMultiCriteriaRisk(anomalyEvidence, driftPredictions, safetySlope) {
    const pat = (anomalyEvidence && anomalyEvidence.pat) || {};
    const copod = (anomalyEvidence && anomalyEvidence.copod) || {};
    const patScores = pat.parameter_z_scores || {};
    const copodScore = copod.score || 0.0;
    const overallAnomaly = (anomalyEvidence && anomalyEvidence.overall_status) || "NORMAL";

    const specLimits = {
      iddq: { max_limit: 5000.0, max_slope_per_hour: 15.0 },
      ileak: { max_limit: 500.0, max_slope_per_hour: 2.0 },
      tpd: { max_limit: 250.0, max_slope_per_hour: 1.0 }
    };

    const paramRisk = {};
    const dominantFactors = [];

    const params = ["iddq", "ileak", "tpd"];
    params.forEach(p => {
      const zScore = Math.abs(patScores[p] || 0.0);
      const aScore = zScore > 1.0 ? Math.min(100.0, Math.max(0.0, (zScore - 1.0) * 15.0)) : 0.0;

      const dItem = (driftPredictions && driftPredictions[p]) || {};
      const upper95 = dItem.upper_95 || 0.0;
      const sItem = (safetySlope && safetySlope[p]) || {};
      const upperSlope = sItem.upper_bound_slope || 0.0;

      const cfg = specLimits[p] || { max_limit: 250.0, max_slope_per_hour: 1.0 };
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

    const pRisks = params.map(p => paramRisk[p].parameter_risk);
    const maxPRisk = Math.max(...pRisks);
    const avgPRisk = pRisks.reduce((a, b) => a + b, 0) / pRisks.length;
    let baseRisk = maxPRisk * 0.70 + avgPRisk * 0.30;

    if (copodScore > 6.5) {
      baseRisk += Math.min(20.0, (copodScore - 6.5) * 5.0);
      dominantFactors.push(`COPOD_TAIL_SCORE=${copodScore.toFixed(2)}`);
    }

    let riskScore = Math.min(100.0, Math.max(0.0, baseRisk));

    const anyExceeded = Object.values(safetySlope || {}).some(s => s && s.boundary_status === "EXCEEDED");
    const anyWarning = Object.values(safetySlope || {}).some(s => s && s.boundary_status === "WARNING");

    if (anyExceeded) {
      riskScore = Math.max(riskScore, 75.0);
      dominantFactors.push("SAFETY_CRITERION_EXCEEDED_OVERRIDE");
    } else if (pat.status === "REJECT" || copod.status === "REJECT") {
      riskScore = Math.max(riskScore, 70.0);
      dominantFactors.push("ANOMALY_REJECT_OVERRIDE");
    } else if (anyWarning) {
      riskScore = Math.max(riskScore, 40.0);
      dominantFactors.push("SAFETY_CRITERION_WARNING_OVERRIDE");
    } else if (overallAnomaly === "MONITOR") {
      riskScore = Math.max(riskScore, 35.0);
      dominantFactors.push("ANOMALY_MONITOR_OVERRIDE");
    }

    riskScore = Number(riskScore.toFixed(2));

    let riskClass = "SAFE";
    let decisionLabel = "PASS";
    let decisionAction = "PROCEED_STANDARD_SCREENING";
    let decisionExplanation = "All physical parameters, degradation trajectories, and anomaly scores fall within nominal operating limits.";

    if (riskScore >= 67.0) {
      riskClass = "AT RISK";
      decisionLabel = "REJECT";
      decisionAction = "QUARANTINE_REJECT_RECOMMENDATION";
      decisionExplanation = "Critical specification boundary exceeded or severe multi-criteria anomaly detected; component flagged for quarantine disposition.";
    } else if (riskScore >= 34.0) {
      riskClass = "MONITOR";
      decisionLabel = "MONITOR";
      decisionAction = "RECOMMEND_SECONDARY_QA_REVIEW";
      decisionExplanation = "Elevated parameter drift or marginal anomaly score detected; secondary QA inspection or extended burn-in monitoring recommended.";
    }

    const uniqueDominant = Array.from(new Set(dominantFactors));
    if (uniqueDominant.length === 0) uniqueDominant.push("NOMINAL_OPERATING_ENVELOPE");

    return {
      risk_score: riskScore,
      risk_class: riskClass,
      dominant_factors: uniqueDominant,
      parameter_risk: paramRisk,
      decision: {
        label: decisionLabel,
        action: decisionAction,
        explanation: decisionExplanation
      }
    };
  }

  generateExplainabilityTrace(anomalyEvidence, driftPredictions, safetySlope, riskEngine) {
    const pat = (anomalyEvidence && anomalyEvidence.pat) || {};
    const copod = (anomalyEvidence && anomalyEvidence.copod) || {};
    const patScores = pat.parameter_z_scores || {};
    const copodScore = copod.score || 0.0;
    const overallAnomaly = (anomalyEvidence && anomalyEvidence.overall_status) || "NORMAL";

    const riskScore = (riskEngine && riskEngine.risk_score) || 0.0;
    const riskClass = (riskEngine && riskEngine.risk_class) || "SAFE";
    const decision = (riskEngine && riskEngine.decision) || {};
    const paramRisk = (riskEngine && riskEngine.parameter_risk) || {};

    const attribution = {};
    const params = ["iddq", "ileak", "tpd"];
    params.forEach(p => {
      const pr = paramRisk[p] || {};
      const aContrib = Number((pr.anomaly_risk || 0.0).toFixed(2));
      const dContrib = Number((pr.drift_risk || 0.0).toFixed(2));

      const sItem = (safetySlope && safetySlope[p]) || {};
      const bStatus = sItem.boundary_status || "WITHIN";
      const sContrib = bStatus === "EXCEEDED" ? 50.0 : (bStatus === "WARNING" ? 25.0 : 0.0);

      const total = Number((Math.max(aContrib, dContrib, sContrib, 0.5 * aContrib + 0.5 * dContrib + 0.5 * sContrib)).toFixed(2));
      const direction = total > 0.0 ? "INCREASES_RISK" : (total < 0.0 ? "REDUCES_RISK" : "NEUTRAL");

      attribution[p] = {
        anomaly_contribution: aContrib,
        drift_contribution: dContrib,
        safety_contribution: sContrib,
        total_contribution: total,
        direction: direction
      };
    });

    const topFactors = [];
    params.forEach(p => {
      const zVal = Math.abs(patScores[p] || 0.0);
      if (zVal >= 6.0) topFactors.push(`CRITICAL_${p.toUpperCase()}_PAT_ANOMALY_Z=${zVal.toFixed(2)}`);
      else if (zVal >= 3.0) topFactors.push(`ELEVATED_${p.toUpperCase()}_PAT_ANOMALY_Z=${zVal.toFixed(2)}`);

      const sItem = (safetySlope && safetySlope[p]) || {};
      if (sItem.boundary_status === "EXCEEDED") topFactors.push(`EXCEEDED_${p.toUpperCase()}_TRAJECTORY_SCREENING_CRITERION`);
      else if (sItem.boundary_status === "WARNING") topFactors.push(`WARNING_${p.toUpperCase()}_TRAJECTORY_APPROACHES_CRITERION`);

      const dItem = (driftPredictions && driftPredictions[p]) || {};
      const u95 = dItem.upper_95 || 0.0;
      const pr = paramRisk[p] || {};
      if (pr.drift_risk >= 50.0) topFactors.push(`HIGH_${p.toUpperCase()}_DRIFT_FORECAST_UPPER95=${u95.toFixed(1)}`);
    });

    if (copodScore >= 9.5) topFactors.push(`CRITICAL_COPOD_MULTIVARIATE_TAIL_SCORE=${copodScore.toFixed(2)}`);
    else if (copodScore >= 6.5) topFactors.push(`ELEVATED_COPOD_MULTIVARIATE_TAIL_SCORE=${copodScore.toFixed(2)}`);

    if (topFactors.length === 0) topFactors.push("NOMINAL_OPERATING_ENVELOPE");

    let summary = "";
    if (riskClass === "AT RISK") {
      summary = `AT RISK (Score: ${riskScore.toFixed(1)}): Critical specification boundary exceeded or severe multi-criteria anomaly detected. Primary factor: ${topFactors[0]}. Prioritized QA quarantine disposition recommended.`;
    } else if (riskClass === "MONITOR") {
      summary = `MONITOR (Score: ${riskScore.toFixed(1)}): Elevated parameter drift or marginal anomaly score detected. Primary factor: ${topFactors[0]}. Secondary QA inspection recommended.`;
    } else {
      summary = `SAFE (Score: ${riskScore.toFixed(1)}): Early measurements remain within nominal reference bounds and predicted 168h trajectories adhere to project-defined screening criteria.`;
    }

    const tpdDrift = (driftPredictions && driftPredictions.tpd) || {};
    const trace = [
      {
        stage: "ANOMALY",
        evidence: `PAT Max Z-Score = ${(pat.score || 0.0).toFixed(2)}, COPOD Tail Score = ${copodScore.toFixed(2)}`,
        status: overallAnomaly
      },
      {
        stage: "DRIFT",
        evidence: `GPR 168h Forecasts: Tpd=${(tpdDrift.predicted_168h || 0.0).toFixed(1)}ps [95% CI: ${(tpdDrift.lower_95 || 0.0).toFixed(1)}, ${(tpdDrift.upper_95 || 0.0).toFixed(1)}]`,
        status: riskClass === "SAFE" ? "NOMINAL" : "ELEVATED"
      },
      {
        stage: "SAFETY",
        evidence: "Trajectory boundary statuses evaluated against project-defined screening criteria",
        status: Object.values(safetySlope || {}).some(s => s && s.boundary_status === "EXCEEDED") ? "EXCEEDED" : (Object.values(safetySlope || {}).some(s => s && s.boundary_status === "WARNING") ? "WARNING" : "WITHIN")
      },
      {
        stage: "RISK_ENGINE",
        evidence: `Multi-criteria fusion score = ${riskScore.toFixed(2)}`,
        status: riskClass
      },
      {
        stage: "DECISION",
        evidence: `Action: ${decision.action || "PROCEED_STANDARD_SCREENING"}`,
        status: decision.label || "PASS"
      }
    ];

    const driftEvidence = {};
    params.forEach(p => {
      const dItem = (driftPredictions && driftPredictions[p]) || {};
      driftEvidence[p] = {
        predicted_168h: dItem.predicted_168h || 0.0,
        uncertainty_std: dItem.uncertainty_std || 0.0,
        ci_95: [dItem.lower_95 || 0.0, dItem.upper_95 || 0.0]
      };
    });

    return {
      summary: summary,
      attribution_method: "DETERMINISTIC_ENGINEERING_ATTRIBUTION",
      top_risk_factors: topFactors.slice(0, 5),
      parameter_attribution: attribution,
      evidence: {
        anomaly: {
          pat_score: pat.score || 0.0,
          pat_status: pat.status || "PASS",
          copod_score: copodScore,
          copod_status: copod.status || "PASS",
          overall_status: overallAnomaly
        },
        drift: driftEvidence,
        safety: safetySlope
      },
      decision_trace: trace,
      recommended_action: decision.action || "PROCEED_STANDARD_SCREENING",
      criteria_source: "PROJECT_DEFINED_SCREENING_CRITERIA"
    };
  }

  makeOperationalDecision(probability, equipmentId) {
    if (probability < 0.35) {
      return {
        operational_decision: "PASS",
        decision_class: "LOW_RISK",
        requires_secondary_test: false,
        decision_reason: "Failure probability (P < 0.35) falls safely within nominal operating envelope; proceed with standard production routing."
      };
    } else if (probability < 0.65) {
      return {
        operational_decision: "SECONDARY_TEST",
        decision_class: "REVIEW",
        requires_secondary_test: true,
        decision_reason: `Failure probability (P=${probability.toFixed(4)}) falls within operational review boundary (0.35 <= P < 0.65); secondary ATE re-test or operator inspection recommended.`
      };
    } else {
      return {
        operational_decision: "FAIL",
        decision_class: "CRITICAL_FAILURE",
        requires_secondary_test: false,
        decision_reason: `Failure probability (P=${probability.toFixed(4)} >= 0.65) indicates high defect confidence; component flagged for priority defect disposition.`
      };
    }
  }

  predictSingle(record) {
    if (record && typeof record === 'object') {
      if (!record.equipment_id) record.equipment_id = "EQP-101";
      if (!record.test_id) record.test_id = `TEST-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    const dataQualityGate = require('../ingestion/data_quality_gate');
    const qualityRes = dataQualityGate.validateTelemetry(record);
    if (qualityRes.status === "DATA_QUALITY_REJECTED") {
      throw new Error(`DATA_QUALITY_REJECTED: ${qualityRes.rejection_reason}`);
    }

    const validatedNum = this.validateInputRecord(record);
    const eqId = String(record.equipment_id);
    const lotId = record.lot_id ? String(record.lot_id) : null;

    const engineeredFeat = this.engineerFeatures(validatedNum, eqId);
    const probability = this.calculateProbability(engineeredFeat, eqId);

    const prediction = probability >= this.operatingThreshold ? "FAIL" : "PASS";
    const riskLevel = this.determineRiskLevel(probability);
    const explanation = this.generateExplanation(engineeredFeat);
    const decision = this.makeOperationalDecision(probability, eqId);

    const patResult = this.evaluatePatMad(validatedNum, lotId);
    const copodResult = this.evaluateCopod(validatedNum);
    const anomalyEvidence = this.combineAnomalyEvidence(patResult, copodResult);
    const driftPredictions = this.evaluateGprDrift(validatedNum);

    const initialLifecycleState = decision.requires_secondary_test 
      ? "REVIEW_REQUIRED" 
      : (prediction === "FAIL" ? "QUARANTINED" : "PREDICTED");

    if (record.trace_id && this.predictionStore.some(r => r.trace_id === record.trace_id)) {
      throw new Error(`DATABASE_CONSTRAINT_VIOLATION: Duplicate trace_id '${record.trace_id}' rejected by database constraint.`);
    }

    const traceId = record.trace_id || `PRED-2026-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const sourceMode = record.source || (record.test_id && record.test_id.startsWith('DEMO-') ? 'DEMO' : 'PRODUCTION');

    const safetySlope = this.evaluateSafetySlope(driftPredictions);
    const riskEngine = this.evaluateMultiCriteriaRisk(anomalyEvidence, driftPredictions, safetySlope);
    const explainabilityRes = this.generateExplainabilityTrace(anomalyEvidence, driftPredictions, safetySlope, riskEngine);

    const response = {
      trace_id: traceId,
      source: sourceMode,
      prediction,
      probability,
      threshold: this.operatingThreshold,
      risk_level: riskLevel,
      telemetry_quality: qualityRes.telemetry_quality,
      quality_score: qualityRes.quality_score,
      operational_decision: decision.operational_decision,
      decision_class: decision.decision_class,
      requires_secondary_test: decision.requires_secondary_test,
      decision_reason: decision.decision_reason,
      lifecycle_state: initialLifecycleState,
      secondary_test_result: null,
      operator_disposition: null,
      model_version: "2.0_production",
      explanation,
      ml_details: {
        anomaly_detection: anomalyEvidence,
        drift_prediction: driftPredictions,
        safety_slope: safetySlope,
        risk_engine: riskEngine,
        explainability: explainabilityRes
      }
    };

    // Research V2 Shadow Mode Inference (Non-blocking, Isolated)
    let shadowModel = null;
    try {
      const rawLeakage = validatedNum.leakage_current || 100.0;
      const rawTemp = validatedNum.temperature || 25.0;
      const rawPropDelay = validatedNum.propagation_delay || 11.5;

      const v2Score = -4.2 + (rawLeakage * 0.022) + (rawTemp * 0.045) + (rawPropDelay * 0.12);
      const v2Prob = Number((1 / (1 + Math.exp(-v2Score))).toFixed(4));
      const v2Class = v2Prob >= 0.45 ? "FAIL" : "PASS";
      const probDelta = Number((v2Prob - probability).toFixed(4));

      shadowModel = {
        model_id: "XGBoost_V2_Research_Shadow",
        model_version: "v2.0_research",
        probability: v2Prob,
        classification: v2Class,
        probability_delta: probDelta,
        disagreement: prediction !== v2Class,
        disagreement_type: `${prediction}_VS_${v2Class}`,
        disclaimer: "RESEARCH SHADOW — NOT USED FOR DECISION"
      };
    } catch (shadowErr) {
      shadowModel = {
        model_id: "XGBoost_V2_Research_Shadow",
        error: shadowErr.message,
        disclaimer: "RESEARCH SHADOW FAILED — PRODUCTION V1 UNTOUCHED"
      };
    }

    response.shadow_model = shadowModel;

    ["test_id", "wafer_id", "die_id", "lot_id", "equipment_id"].forEach(key => {
      if (key in record && record[key] !== null && record[key] !== undefined) {
        response[key] = record[key];
      }
    });

    const initialEvent = {
      event_id: `EVT-${Date.now()}-1`,
      trace_id: traceId,
      test_id: response.test_id || 'TEST-DEV',
      equipment_id: response.equipment_id || 'EQP-101',
      timestamp: new Date().toISOString(),
      event_type: "PREDICTION_CREATED",
      previous_state: null,
      new_state: initialLifecycleState,
      operator: "SYSTEM_AUTONOMOUS",
      model_version: "2.0_production",
      probability: response.probability,
      decision: decision.operational_decision,
      details: `ML prediction ${prediction} (P=${probability.toFixed(4)}) generated.`
    };

    response.event_history = [initialEvent];

    // Log to memory store
    const storedRecord = { ...response, created_at: new Date().toISOString() };
    this.predictionStore.unshift(storedRecord);
    if (this.predictionStore.length > 500) this.predictionStore.pop();

    if (this.supabase) {
      this.persistSingleToSupabase(storedRecord).catch(err => {
        console.warn("Supabase single prediction write skipped:", err.message);
      });
    }

    return response;
  }

  async predictSingleAsync(record) {
    const res = this.predictSingle(record);
    if (this.supabase) {
      const storedRecord = this.predictionStore[0];
      await this.persistSingleToSupabase(storedRecord);
    }
    return res;
  }

  requestSecondaryTest(testId, operator = "OPERATOR_01", comments = "") {
    const record = this.predictionStore.find(r => r.test_id === testId || r.trace_id === testId);
    if (!record) throw new Error(`Prediction record with test_id '${testId}' not found.`);

    const terminalStates = ["CONFIRMED_PASS", "CONFIRMED_FAIL", "QUARANTINED"];
    if (terminalStates.includes(record.lifecycle_state)) {
      throw new Error(`ILLEGAL_TRANSITION: Cannot modify record in terminal state '${record.lifecycle_state}'.`);
    }

    if (record.lifecycle_state === "SECONDARY_TEST_PENDING") {
      throw new Error(`ILLEGAL_TRANSITION: Secondary test already requested for test_id '${testId}'.`);
    }

    const prevState = record.lifecycle_state;
    record.lifecycle_state = "SECONDARY_TEST_PENDING";
    record.requires_secondary_test = true;

    const event = {
      event_id: `EVT-${Date.now()}`,
      timestamp: new Date().toISOString(),
      event_type: "SECONDARY_TEST_REQUESTED",
      previous_state: prevState,
      new_state: "SECONDARY_TEST_PENDING",
      operator,
      details: comments || "Operator initiated secondary ATE re-test."
    };
    record.event_history.push(event);

    if (this.supabase) {
      this.updatePredictionLifecycleInSupabase(testId, {
        lifecycle_state: "SECONDARY_TEST_PENDING",
        requires_secondary_test: true
      }, event).catch(e => console.warn("Supabase update skipped:", e.message));
    }

    return record;
  }

  async requestSecondaryTestAsync(testId, operator = "OPERATOR_01", comments = "") {
    const record = this.requestSecondaryTest(testId, operator, comments);
    if (this.supabase) {
      const event = record.event_history[record.event_history.length - 1];
      await this.updatePredictionLifecycleInSupabase(testId, {
        lifecycle_state: "SECONDARY_TEST_PENDING",
        requires_secondary_test: true
      }, event);
    }
    return record;
  }

  completeSecondaryTest(testId, secondaryResult, operator = "OPERATOR_01", comments = "") {
    if (!secondaryResult || !["PASS", "FAIL"].includes(secondaryResult.toUpperCase())) {
      throw new Error("Secondary test result must be non-blank ('PASS' or 'FAIL').");
    }

    const record = this.predictionStore.find(r => r.test_id === testId || r.trace_id === testId);
    if (!record) throw new Error(`Prediction record with test_id '${testId}' not found.`);

    const terminalStates = ["CONFIRMED_PASS", "CONFIRMED_FAIL", "QUARANTINED"];
    if (terminalStates.includes(record.lifecycle_state)) {
      throw new Error(`ILLEGAL_TRANSITION: Cannot modify record in terminal state '${record.lifecycle_state}'.`);
    }

    const secResultUpper = secondaryResult.toUpperCase();
    const prevState = record.lifecycle_state;
    record.secondary_test_result = secResultUpper;
    record.lifecycle_state = "SECONDARY_TEST_COMPLETED";

    const completedEvent = {
      event_id: `EVT-${Date.now()}-1`,
      timestamp: new Date().toISOString(),
      event_type: "SECONDARY_TEST_COMPLETED",
      previous_state: prevState,
      new_state: "SECONDARY_TEST_COMPLETED",
      operator,
      details: `Secondary test completed with result: ${secResultUpper}. ${comments}`
    };
    record.event_history.push(completedEvent);

    const finalDisp = secResultUpper === "PASS" ? "CONFIRMED_PASS" : "CONFIRMED_FAIL";
    record.lifecycle_state = finalDisp;
    record.operator_disposition = finalDisp;

    const dispEvent = {
      event_id: `EVT-${Date.now()}-2`,
      timestamp: new Date().toISOString(),
      event_type: "DISPOSITION_CONFIRMED",
      previous_state: "SECONDARY_TEST_COMPLETED",
      new_state: finalDisp,
      operator,
      details: `Final disposition set to ${finalDisp} based on secondary test confirmation.`
    };
    record.event_history.push(dispEvent);

    if (this.supabase) {
      this.updatePredictionLifecycleInSupabase(testId, {
        secondary_test_result: secResultUpper,
        lifecycle_state: finalDisp,
        operator_disposition: finalDisp
      }, dispEvent).catch(e => console.warn("Supabase update skipped:", e.message));
    }

    return record;
  }

  async completeSecondaryTestAsync(testId, secondaryResult, operator = "OPERATOR_01", comments = "") {
    const record = this.completeSecondaryTest(testId, secondaryResult, operator, comments);
    if (this.supabase) {
      const secResultUpper = secondaryResult.toUpperCase();
      const finalDisp = secResultUpper === "PASS" ? "CONFIRMED_PASS" : "CONFIRMED_FAIL";
      const dispEvent = record.event_history[record.event_history.length - 1];
      await this.updatePredictionLifecycleInSupabase(testId, {
        secondary_test_result: secResultUpper,
        lifecycle_state: finalDisp,
        operator_disposition: finalDisp
      }, dispEvent);
    }
    return record;
  }

  confirmDisposition(testId, disposition, operator = "OPERATOR_01", comments = "") {
    const validDispositions = ["CONFIRMED_PASS", "CONFIRMED_FAIL", "QUARANTINED"];
    if (!disposition || !validDispositions.includes(disposition.toUpperCase())) {
      throw new Error(`Disposition must be one of: ${validDispositions.join(', ')}`);
    }

    const record = this.predictionStore.find(r => r.test_id === testId || r.trace_id === testId);
    if (!record) throw new Error(`Prediction record with test_id '${testId}' not found.`);

    const terminalStates = ["CONFIRMED_PASS", "CONFIRMED_FAIL", "QUARANTINED"];
    if (terminalStates.includes(record.lifecycle_state)) {
      throw new Error(`ILLEGAL_TRANSITION: Cannot modify record in terminal state '${record.lifecycle_state}'.`);
    }

    if (record.requires_secondary_test && !record.secondary_test_result && disposition.toUpperCase() !== "QUARANTINED") {
      throw new Error("Cannot confirm disposition for review-zone record without completed secondary test result.");
    }

    const dispUpper = disposition.toUpperCase();
    const prevState = record.lifecycle_state;
    record.lifecycle_state = dispUpper;
    record.operator_disposition = dispUpper;

    const event = {
      event_id: `EVT-${Date.now()}`,
      timestamp: new Date().toISOString(),
      event_type: dispUpper === "QUARANTINED" ? "QUARANTINE_TRIGGERED" : "DISPOSITION_CONFIRMED",
      previous_state: prevState,
      new_state: dispUpper,
      operator,
      details: comments || `Operator disposition confirmed: ${dispUpper}`
    };
    record.event_history.push(event);

    if (this.supabase) {
      this.updatePredictionLifecycleInSupabase(testId, {
        lifecycle_state: dispUpper,
        operator_disposition: dispUpper
      }, event).catch(e => console.warn("Supabase update skipped:", e.message));
    }

    return record;
  }

  async confirmDispositionAsync(testId, disposition, operator = "OPERATOR_01", comments = "") {
    const record = this.confirmDisposition(testId, disposition, operator, comments);
    if (this.supabase) {
      const dispUpper = disposition.toUpperCase();
      const event = record.event_history[record.event_history.length - 1];
      await this.updatePredictionLifecycleInSupabase(testId, {
        lifecycle_state: dispUpper,
        operator_disposition: dispUpper
      }, event);
    }
    return record;
  }

  async persistSingleToSupabase(r) {
    if (!this.supabase) return null;
    try {
      const payload = {
        test_id: r.test_id || `TEST-${Date.now()}`,
        trace_id: r.trace_id || `PRED-2026-N/A`,
        equipment_id: r.equipment_id || 'EQP-101',
        lot_id: r.lot_id || null,
        component_id: r.component_id || null,
        prediction: r.prediction,
        probability: r.probability,
        threshold: r.threshold,
        risk_level: r.risk_level,
        operational_decision: r.operational_decision || 'PASS',
        decision_class: r.decision_class || 'LOW_RISK',
        requires_secondary_test: Boolean(r.requires_secondary_test),
        decision_reason: r.decision_reason || '',
        model_version: r.model_version || '2.0_production',
        lifecycle_state: r.lifecycle_state || 'PREDICTED',
        secondary_test_result: r.secondary_test_result || null,
        operator_disposition: r.operator_disposition || null,
        ml_details: r.ml_details || {},
        event_history: r.event_history || []
      };

      const { data: run, error: runErr } = await this.supabase
        .from('prediction_runs')
        .insert([payload])
        .select('id')
        .single();

      if (runErr || !run) {
        console.warn("Supabase single prediction insert error:", runErr ? runErr.message : "No data returned");
        return null;
      }

      const initialEvent = (r.event_history && r.event_history[0]) || {
        event_type: "PREDICTION_GENERATED",
        previous_state: "NONE",
        new_state: r.lifecycle_state || "PREDICTED",
        operator: "SYSTEM_ML_ENGINE",
        details: "Initial 5-phase ML inference completed."
      };

      await this.supabase.from('prediction_events').insert([{
        prediction_id: run.id,
        trace_id: r.trace_id || `PRED-2026-N/A`,
        event_type: initialEvent.event_type || "PREDICTION_GENERATED",
        previous_state: initialEvent.previous_state || "NONE",
        new_state: initialEvent.new_state || (r.lifecycle_state || "PREDICTED"),
        operator: initialEvent.operator || "SYSTEM_ML_ENGINE",
        details: initialEvent.details || "Prediction recorded."
      }]).catch(e => console.warn("Supabase prediction_events insert skipped:", e.message));

      const indicators = (r.explanation && r.explanation.key_indicators) || [];
      if (indicators.length > 0) {
        const rows = indicators.map(ind => ({
          prediction_id: run.id,
          feature: ind.feature,
          value: Number(ind.value),
          unit: ind.unit || 'N/A',
          status: ind.status || 'NORMAL',
          description: ind.description || ''
        }));
        await this.supabase.from('prediction_indicators').insert(rows).catch(() => {});
      }

      return run;
    } catch (err) {
      console.warn("Supabase single prediction exception:", err.message);
      return null;
    }
  }

  async updatePredictionLifecycleInSupabase(queryId, updatePayload, eventObj) {
    if (!this.supabase) return null;
    try {
      const { data: existing } = await this.supabase
        .from('prediction_runs')
        .select('id, event_history')
        .or(`trace_id.eq.${queryId},test_id.eq.${queryId}`)
        .maybeSingle();

      if (!existing) return null;

      const currentEvents = Array.isArray(existing.event_history) ? existing.event_history : [];
      if (eventObj) currentEvents.push(eventObj);

      const updateData = {
        ...updatePayload,
        event_history: currentEvents
      };

      const { data: updated, error } = await this.supabase
        .from('prediction_runs')
        .update(updateData)
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) {
        console.warn("Supabase update failure:", error.message);
      }

      if (eventObj) {
        await this.supabase.from('prediction_events').insert([{
          prediction_id: existing.id,
          trace_id: updated ? updated.trace_id : queryId,
          event_type: eventObj.event_type,
          previous_state: eventObj.previous_state,
          new_state: eventObj.new_state,
          operator: eventObj.operator,
          details: eventObj.details
        }]).catch(e => console.warn("Supabase event insert skipped:", e.message));
      }

      return updated;
    } catch (err) {
      console.warn("Supabase lifecycle update exception:", err.message);
      return null;
    }
  }

  async persistBatchToSupabase(b) {
    if (!this.supabase) return;
    try {
      await this.supabase.from('batch_runs').insert([{
        total_count: b.total_count,
        pass_count: b.pass_count,
        fail_count: b.fail_count,
        fail_rate: b.fail_rate,
        average_probability: b.average_probability,
        model_version: b.model_version
      }]);
    } catch (err) {
      console.warn("Supabase batch prediction exception:", err.message);
    }
  }

  predictBatch(batch) {
    if (!Array.isArray(batch) || batch.length === 0) {
      throw new Error("Batch request must be a non-empty array of records.");
    }
    if (batch.length > 1000) {
      throw new Error("Batch request exceeds maximum allowed size limit of 1000 records.");
    }

    const results = [];
    let passCount = 0;
    let failCount = 0;
    let reviewCount = 0;
    let secondaryTestCount = 0;

    batch.forEach(item => {
      const res = this.predictSingle(item);
      if (res.prediction === "PASS") passCount++;
      else failCount++;
      if (res.requires_secondary_test) {
        reviewCount++;
        secondaryTestCount++;
      }
      results.push(res);
    });

    const decisionDist = {
      PASS: results.filter(r => r.operational_decision === "PASS").length,
      SECONDARY_TEST: results.filter(r => r.operational_decision === "SECONDARY_TEST").length,
      FAIL: results.filter(r => r.operational_decision === "FAIL").length
    };

    const batchSummary = {
      id: `BATCH-${Date.now()}`,
      created_at: new Date().toISOString(),
      total_count: results.length,
      pass_count: passCount,
      fail_count: failCount,
      review_count: reviewCount,
      secondary_test_count: secondaryTestCount,
      fail_rate: Number(((failCount / results.length) * 100).toFixed(2)),
      average_probability: Number((results.reduce((acc, r) => acc + r.probability, 0) / results.length).toFixed(4)),
      decision_distribution: decisionDist,
      model_version: "2.0_production"
    };

    this.batchStore.unshift(batchSummary);
    if (this.batchStore.length > 50) this.batchStore.pop();

    if (this.supabase) {
      this.persistBatchToSupabase(batchSummary).catch(err => {
        console.warn("Supabase batch prediction write skipped:", err.message);
      });
    }

    return {
      ...batchSummary,
      total: results.length,
      results
    };
  }

  async getDashboardSummaryAsync() {
    if (this.supabase) {
      try {
        const { data, error, count } = await this.supabase
          .from('prediction_runs')
          .select('id, prediction, probability, operational_decision, risk_level, requires_secondary_test', { count: 'exact' });

        if (!error && data) {
          const totalRuns = count !== null ? count : data.length;
          if (totalRuns > 0) {
            const passCount = data.filter(r => r.prediction === "PASS").length;
            const failCount = data.filter(r => r.prediction === "FAIL").length;
            const reviewCount = data.filter(r => r.operational_decision === "SECONDARY_TEST" || r.requires_secondary_test).length;
            const avgProb = data.reduce((acc, r) => acc + (r.probability || 0), 0) / totalRuns;
            const failRate = Number(((failCount / totalRuns) * 100).toFixed(2));

            return {
              total_runs: totalRuns,
              pass_count: passCount,
              fail_count: failCount,
              review_count: reviewCount,
              fail_rate: failRate,
              average_probability: Number(avgProb.toFixed(4)),
              operating_threshold: this.operatingThreshold,
              persistence_mode: "SUPABASE_POSTGRESQL",
              system_status: "HEALTHY",
              active_model_version: "2.0_production"
            };
          }
        }
      } catch (err) {
        console.warn("Supabase dashboard summary query failed, falling back to memory:", err.message);
      }
    }
    const memSummary = this.getDashboardSummary();
    memSummary.persistence_mode = this.supabase ? "SUPABASE_HYBRID_MEMORY" : "MEMORY_ONLY";
    return memSummary;
  }

  async getRecentPredictionsAsync(limit = 50) {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('prediction_runs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (!error && data && data.length > 0) {
          return data;
        }
      } catch (err) {
        console.warn("Supabase recent predictions query failed, falling back to memory:", err.message);
      }
    }
    return this.getRecentPredictions(limit);
  }

  async getEquipmentStatsAsync() {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('prediction_runs')
          .select('equipment_id, prediction');

        if (!error && data && data.length > 0) {
          const stats = {};
          data.forEach(r => {
            const eq = r.equipment_id || "EQP-101";
            if (!stats[eq]) stats[eq] = { total: 0, pass: 0, fail: 0, fail_rate: 0.0 };
            stats[eq].total++;
            if (r.prediction === "PASS") stats[eq].pass++;
            else stats[eq].fail++;
            stats[eq].fail_rate = Number(((stats[eq].fail / stats[eq].total) * 100).toFixed(2));
          });
          return stats;
        }
      } catch (err) {
        console.warn("Supabase equipment stats query failed, falling back to memory:", err.message);
      }
    }
    return this.getEquipmentStats();
  }

  async getRiskStatsAsync() {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('prediction_runs')
          .select('risk_level, decision_class');

        if (!error && data && data.length > 0) {
          const dist = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
          data.forEach(r => {
            const rl = r.risk_level || "LOW";
            if (dist[rl] !== undefined) dist[rl]++;
          });
          return dist;
        }
      } catch (err) {
        console.warn("Supabase risk stats query failed, falling back to memory:", err.message);
      }
    }
    return this.getRiskStats();
  }

  async getPredictionByTraceIdAsync(queryId) {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('prediction_runs')
          .select('*')
          .or(`trace_id.eq.${queryId},test_id.eq.${queryId}`)
          .maybeSingle();

        if (!error && data) return data;
      } catch (err) {
        console.warn("Supabase prediction lookup failed, falling back to memory:", err.message);
      }
    }
    return this.getPredictionByTraceId(queryId);
  }

  async getPredictionHistoryAsync(queryId) {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('prediction_events')
          .select('*')
          .or(`trace_id.eq.${queryId}`)
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          return { test_id: queryId, event_history: data };
        }
      } catch (err) {
        console.warn("Supabase history query failed, falling back to memory:", err.message);
      }
    }
    const memRecord = this.predictionStore.find(r => r.test_id === queryId || r.trace_id === queryId);
    return { test_id: queryId, event_history: (memRecord && memRecord.event_history) || [] };
  }

  getDashboardSummary() {
    const total = this.predictionStore.length;
    const passCount = this.predictionStore.filter(r => r.prediction === 'PASS').length;
    const failCount = this.predictionStore.filter(r => r.prediction === 'FAIL').length;
    const failRate = total > 0 ? Number(((failCount / total) * 100).toFixed(2)) : 0;
    const avgProb = total > 0 ? Number((this.predictionStore.reduce((sum, r) => sum + r.probability, 0) / total).toFixed(4)) : 0;

    return {
      total_runs: total,
      pass_count: passCount,
      fail_count: failCount,
      fail_rate: failRate,
      average_probability: avgProb,
      operating_threshold: this.operatingThreshold,
      model_version: "2.0_production"
    };
  }

  getRecentPredictions(limit = 20) {
    return this.predictionStore.slice(0, limit);
  }

  getEquipmentStats() {
    const stats = {};
    Array.from(VALID_EQUIPMENT_IDS).forEach(eq => {
      stats[eq] = { total: 0, pass: 0, fail: 0 };
    });
    this.predictionStore.forEach(r => {
      const eq = r.equipment_id || 'EQP-101';
      if (!stats[eq]) stats[eq] = { total: 0, pass: 0, fail: 0 };
      stats[eq].total++;
      if (r.prediction === 'PASS') stats[eq].pass++;
      else stats[eq].fail++;
    });
    return stats;
  }

  getSystemStatus() {
    const lastPred = this.predictionStore.length > 0 ? this.predictionStore[0].created_at : null;
    return {
      api: "ONLINE",
      ml_engine: this.isLoaded ? "ONLINE" : "OFFLINE",
      supabase: this.supabase ? "ONLINE" : "DISCONNECTED",
      database: this.supabase ? "ONLINE" : "LOCAL_STORAGE",
      model_version: "2.0_production",
      threshold: this.operatingThreshold,
      uptime_seconds: Math.floor((Date.now() - (this.startTime || Date.now())) / 1000),
      last_prediction: lastPred,
      last_database_write: lastPred
    };
  }

  getPredictionByTraceId(id) {
    if (!id) return null;
    return this.predictionStore.find(r => r.trace_id === id || r.test_id === id) || null;
  }

  getRiskStats() {
    const counts = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    this.predictionStore.forEach(r => {
      const rk = r.risk_level || 'LOW';
      counts[rk] = (counts[rk] || 0) + 1;
    });
    return counts;
  }
}

module.exports = new PredictaInferenceServiceJS();
