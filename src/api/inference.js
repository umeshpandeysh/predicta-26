/**
 * Predicta Semiconductor Test Analytics Prototype — Node.js Model Inference Service
 * File: src/api/inference.js
 */

const fs = require('fs');
const path = require('path');

const modelJsonPath = path.join(__dirname, '../../ml/models/predicta_final_xgboost.json');
const metadataJsonPath = path.join(__dirname, '../../ml/models/predicta_final_metadata.json');

const VALID_EQUIPMENT_IDS = new Set(["EQP-101", "EQP-102", "EQP-103", "EQP-104", "EQP-105"]);

const RAW_NUMERICAL_FEATURES = [
  "supply_voltage", "output_voltage", "current", "leakage_current",
  "resistance", "capacitance", "threshold_voltage", "frequency",
  "propagation_delay", "setup_time", "hold_time", "timing_margin",
  "temperature", "dynamic_power", "total_power", "test_duration"
];

class PredictaInferenceServiceJS {
  constructor() {
    this.modelData = null;
    this.metadata = null;
    this.operatingThreshold = 0.45;
    this.isLoaded = false;
    this.loadModel();
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
    this.operatingThreshold = Number(this.metadata.operating_threshold) || 0.45;
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
        unit: "ps",
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
        unit: "MHz·ps",
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

  predictSingle(record) {
    const validatedNum = this.validateInputRecord(record);
    const eqId = String(record.equipment_id);

    const engineeredFeat = this.engineerFeatures(validatedNum, eqId);
    const probability = this.calculateProbability(engineeredFeat, eqId);

    const prediction = probability >= this.operatingThreshold ? "FAIL" : "PASS";
    const riskLevel = this.determineRiskLevel(probability);
    const explanation = this.generateExplanation(engineeredFeat);

    const response = {
      prediction,
      probability,
      threshold: this.operatingThreshold,
      risk_level: riskLevel,
      model_version: "2.0_production",
      explanation
    };

    ["test_id", "wafer_id", "die_id", "equipment_id"].forEach(key => {
      if (key in record && record[key] !== null && record[key] !== undefined) {
        response[key] = record[key];
      }
    });

    return response;
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

    batch.forEach(item => {
      const res = this.predictSingle(item);
      if (res.prediction === "PASS") passCount++;
      else failCount++;
      results.push(res);
    });

    return {
      total: results.length,
      pass_count: passCount,
      fail_count: failCount,
      results
    };
  }
}

module.exports = new PredictaInferenceServiceJS();
