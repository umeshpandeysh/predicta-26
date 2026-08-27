/**
 * PREDICTA Semiconductor Test Analytics — Security, Authentication & Rate Limiting Middleware
 * File: src/api/auth.js
 */

const crypto = require('crypto');

const DEMO_API_KEYS = new Set([
  "predicta_op_key_2026",
  "predicta_admin_key_2026",
  "sih_judge_demo_token"
]);

const rateLimitStore = new Map();

function injectSecurityHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Operator-Id, X-Operator-Role');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
}

function parseAuthHeader(req) {
  const authHeader = req.headers['authorization'] || '';
  const apiKeyHeader = req.headers['x-api-key'] || '';
  const roleHeader = req.headers['x-operator-role'] || '';
  const opHeader = req.headers['x-operator-id'] || '';

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token === "predicta_admin_key_2026") {
      return { authenticated: true, role: "ADMIN", operator: opHeader || "ADMIN_01" };
    }
    if (token === "predicta_op_key_2026" || token === "sih_judge_demo_token") {
      return { authenticated: true, role: "OPERATOR", operator: opHeader || "OPERATOR_01" };
    }
    // Attempt basic JWT payload decoding without external dependency
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        const role = payload.role || (payload.user_metadata && payload.user_metadata.role) || "OPERATOR";
        return { authenticated: true, role: role.toUpperCase(), operator: payload.sub || opHeader || "OPERATOR_01" };
      }
    } catch (e) {
      // Invalid JWT format
    }
  }

  if (apiKeyHeader) {
    if (apiKeyHeader === "predicta_admin_key_2026") {
      return { authenticated: true, role: "ADMIN", operator: opHeader || "ADMIN_01" };
    }
    if (DEMO_API_KEYS.has(apiKeyHeader)) {
      return { authenticated: true, role: "OPERATOR", operator: opHeader || "OPERATOR_01" };
    }
  }

  // SIH Demo Header Fallback for evaluation presentation
  if (roleHeader) {
    const rUpper = roleHeader.toUpperCase();
    if (["OPERATOR", "ADMIN"].includes(rUpper)) {
      return { authenticated: true, role: rUpper, operator: opHeader || `${rUpper}_01` };
    }
  }

  return { authenticated: false, role: "ANONYMOUS", operator: "ANONYMOUS" };
}

function verifyAuthorization(req, requiredRole = "OPERATOR") {
  const auth = parseAuthHeader(req);
  if (!auth.authenticated) {
    return { authorized: false, status: 401, error: "UNAUTHORIZED: Missing or invalid authentication token." };
  }

  const roleHierarchy = { ANONYMOUS: 0, OPERATOR: 1, ADMIN: 2 };
  const userLevel = roleHierarchy[auth.role] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 1;

  if (userLevel < requiredLevel) {
    return { authorized: false, status: 403, error: `FORBIDDEN: Role '${auth.role}' does not possess required privilege '${requiredRole}'.` };
  }

  return { authorized: true, user: auth };
}

function checkRateLimit(clientIp, endpointTier = "STANDARD") {
  const limits = {
    STRICT: { max: 30, windowMs: 60000 },
    HIGH: { max: 100, windowMs: 60000 },
    STANDARD: { max: 120, windowMs: 60000 }
  };

  const config = limits[endpointTier] || limits.STANDARD;
  const now = Date.now();
  const key = `${clientIp}:${endpointTier}`;

  let record = rateLimitStore.get(key);
  if (!record) {
    record = { count: 1, startTime: now };
    rateLimitStore.set(key, record);
    return { allowed: true };
  }

  if (now - record.startTime > config.windowMs) {
    record.count = 1;
    record.startTime = now;
    return { allowed: true };
  }

  record.count++;
  if (record.count > config.max) {
    return { allowed: false, retryAfter: Math.ceil((config.windowMs - (now - record.startTime)) / 1000) };
  }

  return { allowed: true };
}

function sendApiError(res, status = 400, errorType = "BAD_REQUEST", detail = "Invalid request payload.", traceId = null) {
  injectSecurityHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    error: errorType,
    detail: detail,
    status: status,
    timestamp: new Date().toISOString(),
    trace_id: traceId || `PRED-2026-ERR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  }));
}

module.exports = {
  injectSecurityHeaders,
  parseAuthHeader,
  verifyAuthorization,
  checkRateLimit,
  sendApiError
};
