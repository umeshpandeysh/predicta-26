/**
 * Predicta Day 10 ML Inference Frontend Integration Client
 * File: frontend/api.js
 */

const PREDICTA_API_BASE_URL = (typeof window !== "undefined" && window.PREDICTA_API_BASE_URL)
  ? window.PREDICTA_API_BASE_URL
  : (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1")
    ? `${window.location.origin}/api`
    : "http://localhost:8000/api";

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
    console.warn("Predicta ML API Offline.", err);
    return null;
  }
}

/**
 * Authenticates user credentials via POST /api/login.
 */
async function authenticateUser(userId, password) {
  try {
    const res = await fetch(`${PREDICTA_API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, password })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ message: "Invalid User ID or Password" }));
      return { success: false, authenticated: false, message: errData.message || "Invalid User ID or Password" };
    }

    return await res.json();
  } catch (err) {
    console.warn("API POST /api/login failed.", err);
    return {
      success: false,
      authenticated: false,
      message: "Authentication service unavailable. No local authentication fallback is permitted."
    };
  }
}

/**
 * Sends a single measurement record to POST /api/predict.
 */
async function predictMeasurementRecord(record) {
  try {
    const res = await fetch(`${PREDICTA_API_BASE_URL}/predict`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate"
      },
      cache: "no-store",
      body: JSON.stringify(record)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ detail: "Unknown error" }));
      throw new Error(errData.detail || `Prediction failed with status ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error("API POST /api/predict failed:", err);
    throw new Error(`Inference API unavailable (${err.message}). No qualification decision was generated.`);
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
    console.error("API POST /api/predict/batch failed:", err);
    throw new Error(`Inference API unavailable (${err.message}). No batch qualification decisions were generated.`);
  }
}

/**
 * Fetches real dashboard summary statistics from GET /api/dashboard/summary.
 */
async function fetchDashboardSummary() {
  try {
    const res = await fetch(`${PREDICTA_API_BASE_URL}/dashboard/summary`);
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Could not fetch dashboard summary from API:", err);
    return null;
  }
}

/**
 * Fetches recent prediction history records from GET /api/dashboard/recent.
 */
async function fetchRecentPredictions() {
  try {
    const res = await fetch(`${PREDICTA_API_BASE_URL}/dashboard/recent`);
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Could not fetch recent predictions from API:", err);
    return [];
  }
}

/**
 * Fetches equipment-level breakdown statistics from GET /api/dashboard/equipment.
 */
async function fetchEquipmentStats() {
  try {
    const res = await fetch(`${PREDICTA_API_BASE_URL}/dashboard/equipment`);
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Could not fetch equipment stats from API:", err);
    return null;
  }
}

/**
 * Fetches risk distribution breakdown statistics from GET /api/dashboard/risk.
 */
async function fetchRiskStats() {
  try {
    const res = await fetch(`${PREDICTA_API_BASE_URL}/dashboard/risk`);
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Could not fetch risk stats from API:", err);
    return null;
  }
}

/**
 * Fetches detailed prediction and evidence record for a given trace or test ID.
 */
async function fetchPredictionDetail(traceOrTestId) {
  try {
    const res = await fetch(`${PREDICTA_API_BASE_URL}/prediction/detail?id=${encodeURIComponent(traceOrTestId)}`, {
      headers: {
        "Authorization": "Bearer predicta_op_key_2026",
        "X-API-Key": "predicta_op_key_2026"
      }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("Could not fetch prediction detail:", err);
    return null;
  }
}

/**
 * Fetches governed disposition records for a given trace ID.
 */
async function fetchGovernedDispositions(traceId) {
  try {
    const res = await fetch(`${PREDICTA_API_BASE_URL}/dispositions/${encodeURIComponent(traceId)}`, {
      headers: {
        "Authorization": "Bearer predicta_op_key_2026",
        "X-API-Key": "predicta_op_key_2026"
      }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("Could not fetch governed disposition:", err);
    return null;
  }
}

/**
 * Submits a governed human operator disposition to POST /api/dispositions.
 * Strictly adheres to backend governance: client does not send component_id, lot_id, or ML snapshots.
 */
async function submitGovernedDisposition({ trace_id, disposition, reason_code, comment, operator_id }) {
  const payload = {
    trace_id,
    disposition,
    reason_code,
    comment: comment || "",
    operator_id: operator_id || "OPERATOR_01"
  };

  const res = await fetch(`${PREDICTA_API_BASE_URL}/dispositions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer predicta_op_key_2026",
      "X-API-Key": "predicta_op_key_2026",
      "X-Operator-Id": operator_id || "OPERATOR_01"
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({ detail: "Unknown response error" }));
  if (!res.ok) {
    throw new Error(data.detail || `Disposition submission failed (Status: ${res.status})`);
  }
  return data;
}

/**
 * Fetches canonical Phase 16 demonstration cases from GET /api/decision-center/cases.
 */
async function fetchCanonicalCases() {
  try {
    const res = await fetch(`${PREDICTA_API_BASE_URL}/decision-center/cases`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("Could not fetch canonical cases from API:", err);
    return null;
  }
}

/**
 * Fetches detailed canonical case record by ID from GET /api/decision-center/cases/:case_id.
 */
async function fetchCanonicalCaseById(caseId) {
  try {
    const res = await fetch(`${PREDICTA_API_BASE_URL}/decision-center/cases/${encodeURIComponent(caseId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`Could not fetch canonical case '${caseId}':`, err);
    return null;
  }
}

/**
 * Fetches Digital Reliability Twin representation for a given component, trace, or case ID.
 */
async function fetchReliabilityTwin(identifier) {
  try {
    const res = await fetch(`${PREDICTA_API_BASE_URL}/reliability-twin/${encodeURIComponent(identifier)}`, {
      headers: {
        "Authorization": "Bearer predicta_op_key_2026",
        "X-API-Key": "predicta_op_key_2026"
      }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`Could not fetch reliability twin for '${identifier}':`, err);
    return null;
  }
}

// LOCAL_DECISION_ENGINE_DISABLED: Client-side local decision fallback is permanently eliminated.
// All semiconductor qualification decisions are rendered exclusively by backend XGBoost inference.
// If backend inference is unreachable, the system fails closed with an explicit error state.

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    checkMLAPIHealth,
    authenticateUser,
    predictMeasurementRecord,
    predictMeasurementBatch,
    fetchDashboardSummary,
    fetchRecentPredictions,
    fetchEquipmentStats,
    fetchRiskStats,
    fetchPredictionDetail,
    fetchGovernedDispositions,
    submitGovernedDisposition,
    fetchCanonicalCases,
    fetchCanonicalCaseById,
    fetchReliabilityTwin
  };
}

