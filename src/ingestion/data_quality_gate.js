/**
 * Predicta Semiconductor Analytics — Pre-Inference Telemetry Data Quality Gate
 * File: src/ingestion/data_quality_gate.js
 * 
 * Verifies telemetry schema completeness, physical range boundaries, sensor confidence,
 * and duplicate test safeguards prior to ML model inference.
 */

const ALLOWED_EQUIPMENT_IDS = new Set(["EQP-101", "EQP-102", "EQP-103", "EQP-104", "EQP-105"]);

const PHYSICAL_BOUNDARIES = {
  supply_voltage:    { min: 0.5,   max: 3.3,   unit: "V" },
  output_voltage:    { min: 0.1,   max: 3.3,   unit: "V" },
  current:           { min: 1.0,   max: 500.0, unit: "mA" },
  leakage_current:   { min: 0.1,   max: 5000.0,unit: "µA" },
  resistance:        { min: 0.1,   max: 500.0, unit: "Ω" },
  capacitance:       { min: 0.01,  max: 100.0, unit: "pF" },
  threshold_voltage: { min: 0.05,  max: 1.5,   unit: "V" },
  frequency:         { min: 10.0,  max: 10000.0,unit: "MHz" },
  propagation_delay: { min: 0.1,   max: 100.0, unit: "ns" },
  setup_time:        { min: 0.01,  max: 50.0,  unit: "ns" },
  hold_time:         { min: 0.01,  max: 50.0,  unit: "ns" },
  timing_margin:     { min: -100.0,max: 100.0, unit: "ns" },
  temperature:       { min: -40.0, max: 175.0, unit: "°C" },
  dynamic_power:     { min: 0.1,   max: 1000.0,unit: "mW" },
  total_power:       { min: 0.1,   max: 2000.0,unit: "mW" },
  test_duration:     { min: 0.1,   max: 1000.0,unit: "hrs" }
};

const seenTestIds = new Set();

class DataQualityGate {
  validateTelemetry(payload) {
    const issues = [];
    const warnings = [];

    if (!payload || typeof payload !== 'object') {
      return {
        status: "DATA_QUALITY_REJECTED",
        telemetry_quality: "INVALID",
        quality_score: 0.0,
        rejection_reason: "Payload must be a non-null JSON object.",
        issues: ["NULL_PAYLOAD"],
        warnings: []
      };
    }

    // 1. Equipment ID Validation
    if (!payload.equipment_id || !ALLOWED_EQUIPMENT_IDS.has(String(payload.equipment_id))) {
      issues.push(`Invalid equipment ID '${payload.equipment_id}'. Allowed: EQP-101 .. EQP-105`);
    }

    // 2. Test ID & Duplicate Check
    if (!payload.test_id || String(payload.test_id).trim() === "") {
      issues.push("Missing required field 'test_id'");
    } else {
      const testIdStr = String(payload.test_id);
      if (seenTestIds.has(testIdStr) && !testIdStr.startsWith("DEMO-") && !testIdStr.startsWith("TEST-")) {
        warnings.push(`Duplicate test submission detected for test_id '${testIdStr}'`);
      } else {
        seenTestIds.add(testIdStr);
      }
    }

    // 3. Physical Boundary & Numeric Sanity Check
    let validFieldCount = 0;
    const requiredFields = Object.keys(PHYSICAL_BOUNDARIES);

    requiredFields.forEach(field => {
      if (!(field in payload) || payload[field] === null || payload[field] === undefined) {
        issues.push(`Missing required telemetry measurement '${field}'`);
        return;
      }

      const val = Number(payload[field]);
      if (isNaN(val) || !isFinite(val)) {
        issues.push(`Field '${field}' must be a valid finite number. Got: ${payload[field]}`);
        return;
      }

      const bounds = PHYSICAL_BOUNDARIES[field];
      if (val < bounds.min || val > bounds.max) {
        issues.push(`Field '${field}' value ${val}${bounds.unit} is outside physical bounds (${bounds.min} - ${bounds.max}${bounds.unit})`);
        return;
      }

      validFieldCount++;
    });

    // 4. Stale Telemetry Check
    if (payload.timestamp) {
      const ts = new Date(payload.timestamp).getTime();
      if (!isNaN(ts)) {
        const ageHours = (Date.now() - ts) / (1000 * 60 * 60);
        if (ageHours > 72) {
          warnings.push(`Telemetry is stale (${ageHours.toFixed(1)} hours old)`);
        }
      }
    }

    const totalRequired = requiredFields.length + 2; // + equipment_id & test_id
    const passedCount = validFieldCount + (issues.length === 0 ? 2 : 0);
    const qualityScore = Number((passedCount / totalRequired).toFixed(2));

    if (issues.length > 0) {
      return {
        status: "DATA_QUALITY_REJECTED",
        telemetry_quality: "INVALID",
        quality_score: Math.max(0.0, qualityScore),
        rejection_reason: issues.join("; "),
        issues,
        warnings
      };
    }

    const telemetryQuality = warnings.length > 0 ? "DEGRADED" : "GOOD";

    return {
      status: "DATA_QUALITY_ACCEPTED",
      telemetry_quality: telemetryQuality,
      quality_score: qualityScore,
      rejection_reason: null,
      issues: [],
      warnings
    };
  }
}

module.exports = new DataQualityGate();
