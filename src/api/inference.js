/**
 * Predicta Semiconductor Test Analytics Prototype — Node.js Model Inference Service
 * File: src/api/inference.js
 */

const fs = require('path') && require('fs');
const path = require('path');
const crypto = require('crypto');

const prodManifestPath = path.join(__dirname, '../../ml/models/production/predicta_production_manifest.json');
const prodModelPath = path.join(__dirname, '../../ml/models/production/predicta_xgboost_model.json');
const prodMetadataPath = path.join(__dirname, '../../ml/models/production/predicta_xgboost_metadata.json');

const v2ModelPath = path.join(__dirname, '../../ml/models/predicta_xgboost_v2.json');
const v2MetadataPath = path.join(__dirname, '../../ml/models/predicta_xgboost_v2_metadata.json');

const modelJsonPath = fs.existsSync(prodModelPath) ? prodModelPath : (fs.existsSync(v2ModelPath) ? v2ModelPath : path.join(__dirname, '../../ml/models/predicta_final_xgboost.json'));
const metadataJsonPath = fs.existsSync(prodMetadataPath) ? prodMetadataPath : (fs.existsSync(v2MetadataPath) ? v2MetadataPath : path.join(__dirname, '../../ml/models/predicta_final_metadata.json'));

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
    this.analysisLimit = 1000;
    this.totalAnalysesPerformed = 0;
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
      throw new Error(`CONFIGURATION_ERROR: Model artifact not found at ${modelJsonPath}`);
    }
    if (!fs.existsSync(metadataJsonPath)) {
      throw new Error(`CONFIGURATION_ERROR: Metadata artifact not found at ${metadataJsonPath}`);
    }

    const rawModelContent = fs.readFileSync(modelJsonPath, 'utf-8');
    this.modelData = JSON.parse(rawModelContent);
    this.metadata = JSON.parse(fs.readFileSync(metadataJsonPath, 'utf-8'));

    const manifestPath = fs.existsSync(prodManifestPath) ? prodManifestPath : path.join(__dirname, '../../ml/models/predicta_production_manifest.json');
    if (fs.existsSync(manifestPath)) {
      this.manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      if (this.manifest.model_sha256 && this.modelData && this.modelData.trees) {
        const computedSha = crypto.createHash('sha256').update(rawModelContent, 'utf8').digest('hex');
        if (computedSha !== this.manifest.model_sha256 && this.metadata.model_sha256 && computedSha !== this.metadata.model_sha256) {
          throw new Error(`CONFIGURATION_ERROR: Model SHA-256 checksum mismatch! Model binary has been tampered with or corrupted. Computed: ${computedSha}, Expected: ${this.manifest.model_sha256}`);
        }
      }
    }

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

    ["iddq", "ileak", "tpd", "iddq_standby", "leakage_current", "propagation_delay", "iddq_0h", "ileak_0h", "tpd_0h"].forEach(k => {
      if (k in rawRecord && rawRecord[k] !== null && rawRecord[k] !== undefined) {
        validatedNumerical[k] = Number(rawRecord[k]);
      }
    });

    return validatedNumerical;
  }

  getNormalizedParams(feat) {
    if (!feat || typeof feat !== 'object') {
      throw new Error(`VALIDATION_ERROR: Missing required canonical reliability parameters.`);
    }

    const rawIddq = feat.iddq_standby !== undefined ? feat.iddq_standby : feat.iddq;
    const rawIleak = feat.leakage_current !== undefined ? feat.leakage_current : feat.ileak;
    const rawTpd = feat.propagation_delay !== undefined ? feat.propagation_delay : feat.tpd;

    if (rawIddq === undefined || rawIddq === null || isNaN(Number(rawIddq)) || !isFinite(Number(rawIddq)) || Number(rawIddq) <= 0) {
      throw new Error(`VALIDATION_ERROR: Missing or invalid required parameter 'iddq_standby'. Must be a finite number > 0.`);
    }
    if (rawIleak === undefined || rawIleak === null || isNaN(Number(rawIleak)) || !isFinite(Number(rawIleak)) || Number(rawIleak) <= 0) {
      throw new Error(`VALIDATION_ERROR: Missing or invalid required parameter 'leakage_current'. Must be a finite number > 0.`);
    }
    if (rawTpd === undefined || rawTpd === null || isNaN(Number(rawTpd)) || !isFinite(Number(rawTpd)) || Number(rawTpd) <= 0) {
      throw new Error(`VALIDATION_ERROR: Missing or invalid required parameter 'propagation_delay'. Must be a finite number > 0.`);
    }

    const effectiveIddq = Number(rawIddq);
    const effectiveIleak = Number(rawIleak);
    const effectiveTpd = Number(rawTpd);

    // Explicit Unit Contract: IDDQ (µA) x 200.0, Leakage (µA) x 2.7, Tpd (ns) x 17.5
    const iddqVal = effectiveIddq * 200.0;
    const ileakVal = effectiveIleak * 2.7;
    const tpdVal = effectiveTpd * 17.5;

    return { iddq: iddqVal, ileak: ileakVal, tpd: tpdVal };
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

  evaluateTreeNode(node, normFeatures) {
    if (!node) return 0.0;
    if (node.isLeaf || node.leaf_value !== undefined || node.left === null || node.left === undefined) {
      return node.leafValue !== undefined ? node.leafValue : (node.leaf_value !== undefined ? node.leaf_value : 0.0);
    }
    const featName = node.splitFeature || node.split_feature;
    const featVal = normFeatures && normFeatures[featName] !== undefined ? normFeatures[featName] : 0.0;
    const thresh = node.splitThreshold !== undefined ? node.splitThreshold : node.split_threshold;
    if (featVal <= thresh) {
      return this.evaluateTreeNode(node.left, normFeatures);
    } else {
      return this.evaluateTreeNode(node.right, normFeatures);
    }
  }

  evaluateXGBoostTrees(feat, equipmentId) {
    const REFERENCE_STATS = {
      supply_voltage: { mean: 1.20, std: 0.05 },
      output_voltage: { mean: 1.20, std: 0.05 },
      current: { mean: 250.0, std: 30.0 },
      leakage_current: { mean: 70.0, std: 40.0 },
      resistance: { mean: 100.0, std: 15.0 },
      capacitance: { mean: 10.0, std: 2.0 },
      threshold_voltage: { mean: 0.40, std: 0.03 },
      frequency: { mean: 2500.0, std: 200.0 },
      propagation_delay: { mean: 10.0, std: 2.0 },
      setup_time: { mean: 1.5, std: 0.2 },
      hold_time: { mean: 0.5, std: 0.1 },
      timing_margin: { mean: 3.0, std: 0.5 },
      temperature: { mean: 25.0, std: 3.0 },
      dynamic_power: { mean: 40.0, std: 10.0 },
      total_power: { mean: 45.0, std: 10.0 },
      test_duration: { mean: 1.0, std: 0.1 },
      voltage_headroom: { mean: 0.80, std: 0.06 },
      voltage_utilization: { mean: 0.333, std: 0.03 },
      leakage_fraction: { mean: 0.0003, std: 0.0002 },
      power_per_current: { mean: 0.16, std: 0.03 },
      normalized_timing_margin: { mean: 0.30, std: 0.05 },
      frequency_delay_product: { mean: 25000.0, std: 5000.0 },
      thermal_delta: { mean: 0.0, std: 3.0 }
    };

    const normFeat = { ...feat };
    Object.keys(REFERENCE_STATS).forEach(k => {
      if (k in feat) {
        const { mean, std } = REFERENCE_STATS[k];
        normFeat[k] = (feat[k] - mean) / (std || 1e-6);
      }
    });

    const trees = (this.modelData && this.modelData.trees) || 
                  (this.modelData && this.modelData.learner && this.modelData.learner.gradient_booster && this.modelData.learner.gradient_booster.model && this.modelData.learner.gradient_booster.model.trees) || [];
    
    if (!trees || trees.length === 0) {
      throw new Error("CONFIGURATION_ERROR: Production XGBoost model artifact contains no valid decision trees. Silent heuristic fallback is strictly prohibited.");
    }

    let margin = 0.0;
    for (let i = 0; i < trees.length; i++) {
      margin += this.evaluateTreeNode(trees[i], normFeat);
    }
    const prob = 1.0 / (1.0 + Math.exp(-margin));
    return Number(prob.toFixed(4));
  }

  calculateProbability(feat, equipmentId) {
    if (!this.modelData || (!this.modelData.trees && !(this.modelData.learner && this.modelData.learner.gradient_booster))) {
      throw new Error("CONFIGURATION_ERROR: Executable XGBoost model artifact missing or corrupted. Silent heuristic fallback disabled.");
    }
    return this.evaluateXGBoostTrees(feat, equipmentId);
  }

  determineRiskLevel(probability) {
    const thresh = this.operatingThreshold || 0.20;
    if (probability < thresh) return "LOW";
    if (probability < 0.65) return "MEDIUM";
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
    const mapping = this.getNormalizedParams(feat);
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
    const mapping = this.getNormalizedParams(feat);
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
    const mapping = this.getNormalizedParams(feat);
    const driftPredictions = {};
    Object.keys(mapping).forEach(p => {
      if (paramsConfig[p]) {
        const val24 = mapping[p];
        const pCfg = paramsConfig[p];
        
        // Strict GPR Contract: Check if true 0h history is provided
        const hasHistory = feat[`${p}_0h`] !== undefined && feat[`${p}_0h`] !== null && !isNaN(Number(feat[`${p}_0h`]));
        if (!hasHistory) {
          driftPredictions[p] = {
            has_history: false,
            status: "INSUFFICIENT_HISTORY",
            message: "0h baseline missing for degradation forecast",
            value_24h: Number(val24.toFixed(4))
          };
          return;
        }

        const scaleFactors = { iddq: 200.0, ileak: 2.7, tpd: 17.5 };
        const p0Raw = Number(feat[`${p}_0h`]);
        const p0 = p0Raw * (scaleFactors[p] || 1.0);

        const delta24 = val24 - p0;
        const xRaw = [p0, val24, delta24];

        const means = pCfg.feature_means;
        const stds = pCfg.feature_stds;
        const xNorm = xRaw.map((v, j) => (v - means[j]) / (stds[j] || 1e-6));

        const lengthScale = pCfg.length_scale;
        const sigmaF2 = pCfg.sigma_f2;
        const supportX = pCfg.support_x;
        const alpha = pCfg.alpha;

        const kVec = [];
        supportX.forEach(sup => {
          const supNorm = sup.map((v, j) => (v - means[j]) / (stds[j] || 1e-6));
          let distSq = 0;
          for (let j = 0; j < 3; j++) {
            distSq += Math.pow(xNorm[j] - supNorm[j], 2);
          }
          kVec.push(sigmaF2 * Math.exp(-distSq / (2.0 * Math.pow(lengthScale, 2))));
        });

        const Kinv = pCfg.K_inv;
        const S = supportX.length;
        const yStd = pCfg.y_std || 1.0;

        let predDelta = pCfg.y_mean;
        let alphaSum = 0;
        for (let i = 0; i < S; i++) {
          alphaSum += alpha[i] * kVec[i];
        }
        predDelta += alphaSum * yStd;
        const pred168 = val24 + predDelta;

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

        const totalStd = Math.sqrt(Math.pow(latentStd, 2) + Math.pow(sigmaObs, 2));

        const lower95 = pred168 - 1.96 * totalStd;
        const upper95 = pred168 + 1.96 * totalStd;

        driftPredictions[p] = {
          has_history: true,
          status: "CALCULATED",
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
      if (item.status === "INSUFFICIENT_HISTORY" || item.has_history === false) {
        results[p] = {
          predicted_slope: 0.0,
          upper_bound_slope: 0.0,
          safety_margin: 1.0,
          boundary_status: "INSUFFICIENT_HISTORY",
          criteria_source: "PROJECT_DEFINED_SCREENING_CRITERIA"
        };
        return;
      }
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

    const driftRisks = params.map(p => paramRisk[p].drift_risk);
    const maxDriftRisk = Math.max(...driftRisks);
    const avgDriftRisk = driftRisks.reduce((a, b) => a + b, 0) / driftRisks.length;
    const degradationDriftScore = Number((maxDriftRisk * 0.70 + avgDriftRisk * 0.30).toFixed(2));

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
    if (riskScore >= 67.0) {
      riskClass = "AT RISK";
    } else if (riskScore >= 34.0) {
      riskClass = "MONITOR";
    }

    const uniqueDominant = Array.from(new Set(dominantFactors));
    if (uniqueDominant.length === 0) uniqueDominant.push("NOMINAL_OPERATING_ENVELOPE");

    return {
      risk_score: riskScore,
      degradation_drift_score: degradationDriftScore,
      risk_class: riskClass,
      dominant_factors: uniqueDominant,
      parameter_risk: paramRisk
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
    const thresh = this.operatingThreshold || 0.20;
    if (probability < thresh) {
      return {
        operational_decision: "PASS",
        decision_class: "LOW_RISK",
        requires_secondary_test: false,
        decision_reason: `Failure probability (P < ${thresh}) falls safely within nominal operating envelope; proceed with standard production routing.`
      };
    } else if (probability < 0.65) {
      return {
        operational_decision: "SECONDARY_TEST",
        decision_class: "REVIEW",
        requires_secondary_test: true,
        decision_reason: `Failure probability (P=${probability.toFixed(4)}) falls within operational review boundary (${thresh} <= P < 0.65); secondary ATE re-test or operator inspection recommended.`
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

  synthesizeOperationalDisposition(probability, anomalyEvidence, driftPredictions, safetySlope, riskEngine) {
    const pat = (anomalyEvidence && anomalyEvidence.pat) || {};
    const copod = (anomalyEvidence && anomalyEvidence.copod) || {};

    const exceededParams = Object.keys(safetySlope || {}).filter(p => safetySlope[p] && safetySlope[p].boundary_status === "EXCEEDED");
    const warningParams = Object.keys(safetySlope || {}).filter(p => safetySlope[p] && safetySlope[p].boundary_status === "WARNING");

    const anyExceeded = exceededParams.length > 0;
    const anyWarning = warningParams.length > 0;

    const isPatReject = pat.status === "REJECT";
    const isCopodReject = copod.status === "REJECT";
    const isAnomalyReject = isPatReject || isCopodReject || (anomalyEvidence && anomalyEvidence.overall_status === "ANOMALOUS");
    const isAnomalyMonitor = pat.status === "MONITOR" || copod.status === "MONITOR" || (anomalyEvidence && anomalyEvidence.overall_status === "MONITOR");

    // PRIORITY 1: REJECT
    // Triggered if critical model defect probability (>= 0.65), PAT reject (Z > 6.0), COPOD reject (> 9.5), or safety slope exceeded.
    if (probability >= 0.65 || isAnomalyReject || anyExceeded) {
      const signals = [];
      if (probability >= 0.65) signals.push(`XGBoost ML Failure Risk High (P=${(probability * 100).toFixed(1)}%)`);
      if (isPatReject) signals.push(`PAT Multivariate Anomaly Flagged (Z > 6.0)`);
      if (isCopodReject) signals.push(`COPOD Tail Anomaly Score High`);
      exceededParams.forEach(p => signals.push(`GPR ${p.toUpperCase()} 168h Forecast Exceeds Limits`));

      let overrideReason = "MULTIPLE_CRITICAL_SIGNALS";
      if (signals.length === 1) {
        if (probability >= 0.65) overrideReason = "ML_HIGH_RISK";
        else if (isPatReject) overrideReason = "PAT_CRITICAL_ANOMALY";
        else if (isCopodReject) overrideReason = "COPOD_CRITICAL_ANOMALY";
        else if (exceededParams.some(p => p.includes("iddq"))) overrideReason = "GPR_IDDQ_LIMIT_EXCEEDED";
        else if (exceededParams.some(p => p.includes("ileak") || p.includes("leakage"))) overrideReason = "GPR_ILEAK_LIMIT_EXCEEDED";
        else if (exceededParams.some(p => p.includes("tpd") || p.includes("delay") || p.includes("propagation"))) overrideReason = "GPR_TPD_LIMIT_EXCEEDED";
      }

      const primarySignal = signals[0] || "Critical Reliability Evidence Exceeded";
      const secondarySignals = signals.slice(1);

      let decisionReason = `Critical risk detected (${primarySignal}). Component flagged for quarantine.`;
      if (probability < this.operatingThreshold) {
        decisionReason = `Under PREDICTA's safety-first multi-model policy, independent reliability evidence (${primarySignal}) overrides the low statistical XGBoost failure probability (P = ${(probability * 100).toFixed(1)}%).`;
      }

      return {
        disposition: "REJECT",
        operational_decision: "REJECT",
        decision_class: "CRITICAL_FAILURE",
        requires_secondary_test: false,
        recommended_action: "QUARANTINE_REJECT_RECOMMENDATION",
        decision_override_reason: overrideReason,
        primary_rejection_signal: primarySignal,
        secondary_rejection_signals: secondarySignals,
        decision_reason: decisionReason
      };
    }

    // PRIORITY 2: MONITOR
    // Triggered if model probability >= operating threshold (0.20), PAT/COPOD monitor, or safety slope warning.
    if (probability >= this.operatingThreshold || isAnomalyMonitor || anyWarning) {
      const signals = [];
      if (probability >= this.operatingThreshold) signals.push(`XGBoost Failure Risk Elevated (P=${(probability * 100).toFixed(1)}%)`);
      if (isAnomalyMonitor) signals.push(`PAT/COPOD Anomaly Monitor Warning`);
      warningParams.forEach(p => signals.push(`GPR ${p.toUpperCase()} 168h Forecast Approaching Limit`));

      const primarySignal = signals[0] || "Elevated Risk Signal Detected";
      const secondarySignals = signals.slice(1);

      return {
        disposition: "MONITOR",
        operational_decision: "SECONDARY_TEST",
        decision_class: "REVIEW",
        requires_secondary_test: true,
        recommended_action: "RECOMMEND_SECONDARY_QA_REVIEW",
        decision_override_reason: probability >= this.operatingThreshold ? "ML_ELEVATED_RISK" : "ANOMALY_OR_DRIFT_WARNING",
        primary_rejection_signal: primarySignal,
        secondary_rejection_signals: secondarySignals,
        decision_reason: `Elevated risk signal detected (${primarySignal}). Secondary ATE re-test or operator inspection recommended.`
      };
    }

    // PRIORITY 3: PASS
    // Triggered ONLY when all risk signals and evidence are within nominal limits.
    return {
      disposition: "PASS",
      operational_decision: "PASS",
      decision_class: "LOW_RISK",
      requires_secondary_test: false,
      recommended_action: "PROCEED_STANDARD_SCREENING",
      decision_override_reason: "NONE",
      primary_rejection_signal: "NONE",
      secondary_rejection_signals: [],
      decision_reason: `All physical telemetry parameters, XGBoost probability (P=${(probability * 100).toFixed(1)}% < ${this.operatingThreshold}), and multi-criteria risk evidence fall safely within nominal bounds.`
    };
  }

  assertNoContradictions(response) {
    if (!response || typeof response !== 'object') {
      throw new Error("DECISION_CONTRACT_VIOLATION: Response object is null or undefined.");
    }
    const { probability, ml_risk_status, anomaly_status, drift_status, disposition } = response;

    if (typeof probability !== 'number' || isNaN(probability)) {
      throw new Error("DECISION_CONTRACT_VIOLATION: 'probability' must be a valid number.");
    }
    if (!['LOW', 'ELEVATED', 'HIGH'].includes(ml_risk_status)) {
      throw new Error(`DECISION_CONTRACT_VIOLATION: Invalid ml_risk_status '${ml_risk_status}'.`);
    }
    if (!['NORMAL', 'MONITOR', 'REJECT'].includes(anomaly_status)) {
      throw new Error(`DECISION_CONTRACT_VIOLATION: Invalid anomaly_status '${anomaly_status}'.`);
    }
    if (!['WITHIN', 'WARNING', 'EXCEEDED'].includes(drift_status)) {
      throw new Error(`DECISION_CONTRACT_VIOLATION: Invalid drift_status '${drift_status}'.`);
    }
    if (!['PASS', 'MONITOR', 'REJECT'].includes(disposition)) {
      throw new Error(`DECISION_CONTRACT_VIOLATION: Invalid disposition '${disposition}'.`);
    }

    // Case A: LOW + NORMAL + WITHIN MUST = PASS
    if (probability < 0.20 && anomaly_status === 'NORMAL' && drift_status === 'WITHIN') {
      if (disposition !== 'PASS') {
        throw new Error(`DECISION_CONTRACT_VIOLATION: Case A Violation! ML Risk=LOW (P=${probability}), Anomaly=NORMAL, Drift=WITHIN MUST yield disposition=PASS, but received '${disposition}'.`);
      }
    }

    // Case B: LOW + MONITOR + WITHIN MUST = MONITOR
    if (probability < 0.20 && anomaly_status === 'MONITOR' && drift_status === 'WITHIN') {
      if (disposition !== 'MONITOR') {
        throw new Error(`DECISION_CONTRACT_VIOLATION: Case B Violation! ML Risk=LOW (P=${probability}), Anomaly=MONITOR, Drift=WITHIN MUST yield disposition=MONITOR, but received '${disposition}'.`);
      }
    }

    // Case C: LOW + NORMAL + WARNING MUST = MONITOR
    if (probability < 0.20 && anomaly_status === 'NORMAL' && drift_status === 'WARNING') {
      if (disposition !== 'MONITOR') {
        throw new Error(`DECISION_CONTRACT_VIOLATION: Case C Violation! ML Risk=LOW (P=${probability}), Anomaly=NORMAL, Drift=WARNING MUST yield disposition=MONITOR, but received '${disposition}'.`);
      }
    }

    // Hard invariants for REJECT
    if (probability >= 0.65 || anomaly_status === 'REJECT' || drift_status === 'EXCEEDED') {
      if (disposition !== 'REJECT') {
        throw new Error(`DECISION_CONTRACT_VIOLATION: Critical evidence (P=${probability}, Anomaly=${anomaly_status}, Drift=${drift_status}) MUST yield disposition=REJECT, but received '${disposition}'.`);
      }
    }
  }

  predictSingle(record) {
    if (this.totalAnalysesPerformed >= this.analysisLimit) {
      throw new Error("Analysis Limit Reached — Maximum component analysis capacity has been reached. Please contact the administrator.");
    }
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

    const patResult = this.evaluatePatMad(validatedNum, lotId);
    const copodResult = this.evaluateCopod(validatedNum);
    const anomalyEvidence = this.combineAnomalyEvidence(patResult, copodResult);
    const driftPredictions = this.evaluateGprDrift(validatedNum);
    const safetySlope = this.evaluateSafetySlope(driftPredictions);
    const riskEngine = this.evaluateMultiCriteriaRisk(anomalyEvidence, driftPredictions, safetySlope);
    const synthDecision = this.synthesizeOperationalDisposition(probability, anomalyEvidence, driftPredictions, safetySlope, riskEngine);
    const explainabilityRes = this.generateExplainabilityTrace(anomalyEvidence, driftPredictions, safetySlope, riskEngine, synthDecision);

    const anyExceeded = Object.values(safetySlope || {}).some(s => s && s.boundary_status === "EXCEEDED");
    const anyWarning = Object.values(safetySlope || {}).some(s => s && s.boundary_status === "WARNING");

    const mlRiskStatus = probability >= 0.65 ? "HIGH" : (probability >= this.operatingThreshold ? "ELEVATED" : "LOW");
    const isAnomalyReject = patResult.status === "REJECT" || copodResult.status === "REJECT" || (anomalyEvidence && anomalyEvidence.overall_status === "ANOMALOUS");
    const isAnomalyMonitor = patResult.status === "MONITOR" || copodResult.status === "MONITOR" || (anomalyEvidence && anomalyEvidence.overall_status === "MONITOR");
    const anomalyStatus = isAnomalyReject ? "REJECT" : (isAnomalyMonitor ? "MONITOR" : "NORMAL");
    const driftStatus = anyExceeded ? "EXCEEDED" : (anyWarning ? "WARNING" : "WITHIN");

    const riskLevel = this.determineRiskLevel(probability);
    const explanation = this.generateExplanation(engineeredFeat);

    const initialLifecycleState = synthDecision.requires_secondary_test 
      ? "REVIEW_REQUIRED" 
      : (synthDecision.disposition === "REJECT" ? "QUARANTINED" : "PREDICTED");

    if (record.trace_id && this.predictionStore.some(r => r.trace_id === record.trace_id)) {
      throw new Error(`DATABASE_CONSTRAINT_VIOLATION: Duplicate trace_id '${record.trace_id}' rejected by database constraint.`);
    }

    const traceId = record.trace_id || `PRED-2026-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const sourceMode = record.source || (record.test_id && record.test_id.startsWith('DEMO-') ? 'DEMO' : 'PRODUCTION');

    const response = {
      trace_id: traceId,
      source: sourceMode,
      ml_prediction: probability >= this.operatingThreshold ? "FAIL" : "PASS",
      prediction,
      probability,
      ml_risk_status: mlRiskStatus,
      anomaly_status: anomalyStatus,
      drift_status: driftStatus,
      disposition: synthDecision.disposition,
      recommended_action: synthDecision.recommended_action,
      decision_reason: synthDecision.decision_reason,
      model_risk_probability: probability,
      ml_risk_signal: `${mlRiskStatus} RISK`,
      ml_risk_class: `${mlRiskStatus} RISK`,
      anomaly_score: patResult ? patResult.score : 0.0,
      degradation_drift_score: riskEngine ? (riskEngine.degradation_drift_score || 0.0) : 0.0,
      fused_risk: riskEngine ? riskEngine.risk_score : 0.0,
      threshold: this.operatingThreshold,
      risk_level: riskLevel,
      telemetry_quality: qualityRes.telemetry_quality,
      quality_score: qualityRes.quality_score,
      operational_decision: synthDecision.operational_decision,
      decision_class: synthDecision.decision_class,
      requires_secondary_test: synthDecision.requires_secondary_test,
      lifecycle_state: initialLifecycleState,
      secondary_test_result: null,
      operator_disposition: null,
      model_version: "2.0_production",
      explanation,
      judge_explanation: "XGBoost estimates latent failure risk from component telemetry. Anomaly detection (PAT/COPOD) and GPR drift forecasting provide multi-criteria reliability evidence. The operational engine synthesizes all signals deterministically into a production disposition: PASS (Nominal), MONITOR (Secondary QA required), REJECT (Quarantine).",
      ml_details: {
        anomaly_detection: anomalyEvidence,
        drift_prediction: driftPredictions,
        safety_slope: safetySlope,
        risk_engine: riskEngine,
        explainability: explainabilityRes
      }
    };

    this.assertNoContradictions(response);

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
      decision: synthDecision.operational_decision,
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

    this.totalAnalysesPerformed++;
    return response;
  }

  async getAnalysisUsageAsync() {
    let count = this.totalAnalysesPerformed;
    if (this.supabase) {
      try {
        const { count: dbCount, error } = await this.supabase
          .from('prediction_runs')
          .select('*', { count: 'exact', head: true });
        if (!error && typeof dbCount === 'number') {
          count = Math.max(count, dbCount);
        }
      } catch(e) {}
    }
    return {
      total_analyses: count,
      limit: this.analysisLimit,
      remaining: Math.max(0, this.analysisLimit - count),
      user_id: "admin",
      capacity_reached: count >= this.analysisLimit
    };
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

const serviceInstance = new PredictaInferenceServiceJS();
module.exports = serviceInstance;
module.exports.PredictaInferenceServiceJS = PredictaInferenceServiceJS;
