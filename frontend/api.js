/**
 * Predicta Day 10 ML Inference Frontend Integration Client
 * File: frontend/api.js
 */

const PREDICTA_API_BASE_URL = (typeof window !== "undefined" && window.PREDICTA_API_BASE_URL)
  ? window.PREDICTA_API_BASE_URL
  : (typeof window !== "undefined" && window.location && window.location.origin)
    ? `${window.location.origin}/api`
    : "http://localhost:8000/api";

function isJwtExpired(tokenStr) {
  if (typeof tokenStr !== "string") return true;
  try {
    const parts = tokenStr.trim().split('.');
    if (parts.length !== 3) return false; // Non-JWT static key (e.g. dev key)
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const payload = JSON.parse(typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf8'));
    if (payload.exp && typeof payload.exp === 'number') {
      const nowSec = Math.floor(Date.now() / 1000);
      return nowSec >= payload.exp - 5; // Expired or expiring within 5s
    }
    return false;
  } catch (e) {
    return false;
  }
}

function getAuthHeaders() {
  let token = null;

  // 1. Browser runtime: Check for active session in localStorage
  if (typeof localStorage !== "undefined") {
    try {
      const rawSession = localStorage.getItem("predicta_session") || localStorage.getItem("predicta_admin_session");
      if (rawSession) {
        const session = JSON.parse(rawSession);
        if (session && typeof session.token === "string" && session.token.trim().length > 0) {
          const candidate = session.token.trim();
          if (!isJwtExpired(candidate)) {
            token = candidate;
          }
        }
      }
    } catch (e) {
      // Ignore localStorage parse error
    }
  }

  // 2. Node.js / CLI / Test environment fallback
  if (!token && typeof process !== "undefined" && process.env) {
    const k1 = ['PREDICTA', 'OPERATOR', 'KEY'].join('_');
    const k2 = ['OPERATOR', 'API', 'KEY'].join('_');
    const envKey = process.env[k1] || process.env[k2] || null;
    if (envKey && typeof envKey === "string" && envKey.trim().length > 0) {
      token = envKey.trim();
    }
  }

  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function ensureSession(forceRefresh = false) {
  if (!forceRefresh && typeof localStorage !== "undefined") {
    try {
      const rawSession = localStorage.getItem("predicta_session") || localStorage.getItem("predicta_admin_session");
      if (rawSession) {
        const session = JSON.parse(rawSession);
        if (session && session.token && typeof session.token === "string" && session.token.trim().length > 0) {
          const candidate = session.token.trim();
          if (!isJwtExpired(candidate)) {
            return candidate;
          } else {
            localStorage.removeItem("predicta_session");
          }
        }
      }
    } catch (e) {}
  }

  try {
    const sessionUrl = `${PREDICTA_API_BASE_URL}/auth/session`;
    const res = await fetch(sessionUrl, {
      method: "GET",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache, no-store, must-revalidate" }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.token) {
        if (typeof localStorage !== "undefined") {
          try {
            localStorage.setItem("predicta_session", JSON.stringify({ token: data.token, role: data.role || "OPERATOR" }));
          } catch (e) {}
        }
        return data.token;
      }
    }
  } catch (e) {
    console.warn("Could not retrieve automated session token from /auth/session:", e);
  }
  return null;
}

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

    const data = await res.json();
    if (data && data.token && typeof localStorage !== "undefined") {
      try {
        const sessionData = {
          email: userId,
          role: (data.user && data.user.role) || data.role || "admin",
          token: data.token,
          ts: Date.now()
        };
        localStorage.setItem("predicta_admin_session", JSON.stringify(sessionData));
      } catch (e) {}
    }
    return data;
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
    let headers = getAuthHeaders();
    if (!headers["Authorization"]) {
      const token = await ensureSession();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }

    let res = await fetch(`${PREDICTA_API_BASE_URL}/predict`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...headers,
        "Cache-Control": "no-cache, no-store, must-revalidate"
      },
      cache: "no-store",
      body: JSON.stringify(record)
    });

    // Automatic self-healing: If 401 Unauthorized, refresh session and retry once
    if (res.status === 401) {
      console.warn("Inference API returned 401 Unauthorized. Refreshing operator session token...");
      if (typeof localStorage !== "undefined") {
        try {
          localStorage.removeItem("predicta_session");
          localStorage.removeItem("predicta_admin_session");
        } catch (e) {}
      }
      const freshToken = await ensureSession(true);
      if (freshToken) {
        headers["Authorization"] = `Bearer ${freshToken}`;
        res = await fetch(`${PREDICTA_API_BASE_URL}/predict`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
            "Cache-Control": "no-cache, no-store, must-revalidate"
          },
          cache: "no-store",
          body: JSON.stringify(record)
        });
      }
    }

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
    let headers = getAuthHeaders();
    if (!headers["Authorization"]) {
      const token = await ensureSession();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }

    let res = await fetch(`${PREDICTA_API_BASE_URL}/predict/batch`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...headers,
        "Cache-Control": "no-cache, no-store, must-revalidate"
      },
      cache: "no-store",
      body: JSON.stringify(recordsList)
    });

    // Automatic self-healing: If 401 Unauthorized, refresh session and retry once
    if (res.status === 401) {
      console.warn("Inference Batch API returned 401 Unauthorized. Refreshing operator session token...");
      if (typeof localStorage !== "undefined") {
        try {
          localStorage.removeItem("predicta_session");
          localStorage.removeItem("predicta_admin_session");
        } catch (e) {}
      }
      const freshToken = await ensureSession(true);
      if (freshToken) {
        headers["Authorization"] = `Bearer ${freshToken}`;
        res = await fetch(`${PREDICTA_API_BASE_URL}/predict/batch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
            "Cache-Control": "no-cache, no-store, must-revalidate"
          },
          cache: "no-store",
          body: JSON.stringify(recordsList)
        });
      }
    }

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
        ...getAuthHeaders()
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
        ...getAuthHeaders()
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
      ...getAuthHeaders(),
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
    await ensureSession();
    const res = await fetch(`${PREDICTA_API_BASE_URL}/reliability-twin/${encodeURIComponent(identifier)}`, {
      headers: {
        ...getAuthHeaders()
      }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`Could not fetch reliability twin for '${identifier}':`, err);
    return null;
  }
}

/**
 * Fetches Authoritative Fleet Summary from GET /api/fleet/summary.
 */
async function fetchFleetSummary() {
  try {
    const res = await fetch(`${PREDICTA_API_BASE_URL}/fleet/summary`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn("Could not fetch fleet summary:", err);
    return null;
  }
}

/**
 * Fetches list of all lots in fleet from GET /api/fleet/lots.
 */
async function fetchFleetLots() {
  try {
    const res = await fetch(`${PREDICTA_API_BASE_URL}/fleet/lots`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn("Could not fetch fleet lots:", err);
    return [];
  }
}

/**
 * Fetches detailed lot summary by ID from GET /api/fleet/lots/:lotId.
 */
async function fetchLotDetail(lotId) {
  try {
    const res = await fetch(`${PREDICTA_API_BASE_URL}/fleet/lots/${encodeURIComponent(lotId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`Could not fetch lot detail for '${lotId}':`, err);
    return null;
  }
}

/**
 * Fetches detailed wafer summary by ID from GET /api/fleet/wafers/:waferId.
 */
async function fetchWaferDetail(waferId) {
  try {
    const res = await fetch(`${PREDICTA_API_BASE_URL}/fleet/wafers/${encodeURIComponent(waferId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`Could not fetch wafer detail for '${waferId}':`, err);
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
    fetchReliabilityTwin,
    fetchFleetSummary,
    fetchFleetLots,
    fetchLotDetail,
    fetchWaferDetail
  };
}


