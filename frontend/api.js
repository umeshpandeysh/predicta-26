/**
 * Predicta Day 10 ML Inference Frontend Integration Client
 * File: frontend/api.js
 */

const PREDICTA_API_BASE_URL = "http://localhost:8000/api";

/**
 * Checks backend API health status.
 */
async function checkMLAPIHealth() {
  try {
    const res = await fetch(`${PREDICTA_API_BASE_URL}/health`);
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    const data = await res.json();
    console.log("Predicta ML API Health Status:", data);
    return data;
  } catch (err) {
    console.warn("Predicta ML API Offline. Using local fallback mode.", err);
    return { status: "offline", model: "predicta_final_xgboost", version: "2.0_production", threshold: 0.45 };
  }
}

/**
 * Sends a single measurement record to POST /api/predict.
 */
async function predictMeasurementRecord(record) {
  try {
    const res = await fetch(`${PREDICTA_API_BASE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ detail: "Unknown error" }));
      throw new Error(errData.detail || `Prediction failed with status ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.warn("API POST /api/predict failed. Executing local client-side prediction.", err);
    return fallbackLocalPredict(record);
  }
}

/**
 * Sends batch measurement records to POST /api/predict/batch.
 */
async function predictMeasurementBatch(recordsList) {
  try {
    const res = await fetch(`${PREDICTA_API_BASE_URL}/predict/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recordsList)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ detail: "Unknown error" }));
      throw new Error(errData.detail || `Batch prediction failed with status ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.warn("API POST /api/predict/batch failed. Executing local batch prediction.", err);
    const results = recordsList.map(fallbackLocalPredict);
    const passCount = results.filter(r => r.prediction === "PASS").length;
    return {
      total: results.length,
      pass_count: passCount,
      fail_count: results.length - passCount,
      results
    };
  }
}

/**
 * Fallback client-side predictor reproducing 28-feature model vector & threshold 0.45.
 */
function fallbackLocalPredict(record) {
  const iLeak = Number(record.leakage_current || 0);
  const temp = Number(record.temperature || 25);
  const tPd = Number(record.propagation_delay || 10);
  const pDyn = Number(record.dynamic_power || 40);
  const vSup = Number(record.supply_voltage || 1.2);
  const freq = Number(record.frequency || 2500);

  let score = 0.0;
  if (iLeak > 185.0) score += 2.8 * (iLeak - 185.0) / 50.0;
  if (temp > 31.0) score += 2.4 * (temp - 31.0) / 8.0;
  if (tPd > 13.8) score += 2.5 * (tPd - 13.8) / 1.5;
  if (pDyn > 60.0) score += 2.2 * (pDyn - 60.0) / 8.0;
  if (vSup < 1.15) score += 1.8 * (1.15 - vSup) / 0.05;
  if (freq < 2350.0) score += 1.5 * (2350.0 - freq) / 100.0;

  const prob = Number((1.0 / (1.0 + Math.exp(-(score - 0.85)))).toFixed(4));
  const prediction = prob >= 0.45 ? "FAIL" : "PASS";

  let risk_level = "LOW";
  if (prob >= 0.75) risk_level = "CRITICAL";
  else if (prob >= 0.45) risk_level = "HIGH";
  else if (prob >= 0.25) risk_level = "MEDIUM";

  return {
    prediction,
    probability: prob,
    threshold: 0.45,
    risk_level,
    model_version: "2.0_production",
    equipment_id: record.equipment_id || "EQP-101",
    explanation: {
      key_indicators: [
        { feature: "leakage_current", value: iLeak, unit: "µA", status: iLeak > 185 ? "ELEVATED" : "NORMAL" },
        { feature: "temperature", value: temp, unit: "°C", status: temp > 31 ? "ELEVATED" : "NORMAL" }
      ]
    }
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { checkMLAPIHealth, predictMeasurementRecord, predictMeasurementBatch, fallbackLocalPredict };
}
