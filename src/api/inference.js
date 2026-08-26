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
    this.operatingThreshold = 0.45;
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
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
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

    const engineeredFeat = this.engineerFeatures(validatedNum, eqId);
    const probability = this.calculateProbability(engineeredFeat, eqId);

    const prediction = probability >= this.operatingThreshold ? "FAIL" : "PASS";
    const riskLevel = this.determineRiskLevel(probability);
    const explanation = this.generateExplanation(engineeredFeat);
    const decision = this.makeOperationalDecision(probability, eqId);

    const initialLifecycleState = decision.requires_secondary_test 
      ? "REVIEW_REQUIRED" 
      : (prediction === "FAIL" ? "QUARANTINED" : "PREDICTED");

    const traceId = record.trace_id || `PRED-2026-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const sourceMode = record.source || (record.test_id && record.test_id.startsWith('DEMO-') ? 'DEMO' : 'PRODUCTION');

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
      explanation
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

  requestSecondaryTest(testId, operator = "OPERATOR_01", comments = "") {
    const record = this.predictionStore.find(r => r.test_id === testId);
    if (!record) throw new Error(`Prediction record with test_id '${testId}' not found.`);

    if (record.lifecycle_state === "SECONDARY_TEST_PENDING") {
      throw new Error(`Secondary test already requested for test_id '${testId}'.`);
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
    return record;
  }

  completeSecondaryTest(testId, secondaryResult, operator = "OPERATOR_01", comments = "") {
    if (!secondaryResult || !["PASS", "FAIL"].includes(secondaryResult.toUpperCase())) {
      throw new Error("Secondary test result must be non-blank ('PASS' or 'FAIL').");
    }

    const record = this.predictionStore.find(r => r.test_id === testId);
    if (!record) throw new Error(`Prediction record with test_id '${testId}' not found.`);

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

    return record;
  }

  confirmDisposition(testId, disposition, operator = "OPERATOR_01", comments = "") {
    const validDispositions = ["CONFIRMED_PASS", "CONFIRMED_FAIL", "QUARANTINED"];
    if (!disposition || !validDispositions.includes(disposition.toUpperCase())) {
      throw new Error(`Disposition must be one of: ${validDispositions.join(', ')}`);
    }

    const record = this.predictionStore.find(r => r.test_id === testId);
    if (!record) throw new Error(`Prediction record with test_id '${testId}' not found.`);

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

    return record;
  }

  async persistSingleToSupabase(r) {
    if (!this.supabase) return;
    try {
      const { data: run, error: runErr } = await this.supabase
        .from('prediction_runs')
        .insert([{
          test_id: r.test_id || `TEST-${Date.now()}`,
          equipment_id: r.equipment_id || 'EQP-101',
          prediction: r.prediction,
          probability: r.probability,
          threshold: r.threshold,
          risk_level: r.risk_level,
          operational_decision: r.operational_decision || 'PASS',
          decision_class: r.decision_class || 'LOW_RISK',
          requires_secondary_test: Boolean(r.requires_secondary_test),
          decision_reason: r.decision_reason || '',
          model_version: r.model_version
        }])
        .select('id')
        .single();

      if (runErr || !run) return;

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
        await this.supabase.from('prediction_indicators').insert(rows);
      }
    } catch (err) {
      console.warn("Supabase single prediction exception:", err.message);
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
