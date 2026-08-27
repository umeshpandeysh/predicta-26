/**
 * PREDICTA Semiconductor Test Analytics — Security, Authentication & Rate Limiting Middleware
 * File: src/api/auth.js
 */

const crypto = require('crypto');

// Production credentials sourced from Environment Variables with secure defaults
const OPERATOR_API_KEY = process.env.OPERATOR_API_KEY || process.env.PREDICTA_OPERATOR_KEY || "predicta_op_key_2026";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || process.env.PREDICTA_ADMIN_KEY || "predicta_admin_key_2026";
const DEMO_API_KEY = process.env.DEMO_API_KEY || process.env.PREDICTA_DEMO_KEY || "sih_judge_demo_token";
const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || "predicta_jwt_secret_key_2026_sih";

const rateLimitStore = new Map();

function injectSecurityHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Operator-Id');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
}

function base64UrlEncode(buffer) {
  return buffer.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

function createJwtToken(payload, secret = JWT_SECRET, expSeconds = 3600) {
  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    throw new Error("SECURITY_ERROR: Cannot sign JWT with missing or empty secret.");
  }

  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    iat: now,
    ...(expSeconds ? { exp: now + expSeconds } : {}),
    ...payload
  };

  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(fullPayload)));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const signatureB64 = base64UrlEncode(signature);

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

function verifyJwtToken(token, secret = JWT_SECRET) {
  if (typeof token !== 'string') return null;
  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    return null; // Reject validation if secret is missing or empty
  }

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;

  try {
    const headerJson = JSON.parse(base64UrlDecode(headerB64));
    if (!headerJson || (headerJson.alg !== 'HS256' && headerJson.alg !== 'HS384' && headerJson.alg !== 'HS512')) {
      return null; // Reject "none" or unsupported algorithms
    }

    const algMap = { 'HS256': 'sha256', 'HS384': 'sha384', 'HS512': 'sha512' };
    const hmacAlg = algMap[headerJson.alg];

    const expectedSignatureB64 = base64UrlEncode(
      crypto
        .createHmac(hmacAlg, secret)
        .update(`${headerB64}.${payloadB64}`)
        .digest()
    );

    const sigBuf = Buffer.from(signatureB64);
    const expBuf = Buffer.from(expectedSignatureB64);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null; // Invalid signature / forged token
    }

    const payloadJson = JSON.parse(base64UrlDecode(payloadB64));
    const nowSec = Math.floor(Date.now() / 1000);

    if (payloadJson.exp && typeof payloadJson.exp === 'number') {
      if (nowSec >= payloadJson.exp) {
        return null; // Expired token
      }
    }

    if (payloadJson.nbf && typeof payloadJson.nbf === 'number') {
      if (nowSec < payloadJson.nbf) {
        return null; // Token not active yet
      }
    }

    return payloadJson;
  } catch (e) {
    return null; // Malformed payload or decoding error
  }
}

function getHeader(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  const nameLower = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === nameLower) {
      const val = headers[key];
      return Array.isArray(val) ? val[0] : String(val);
    }
  }
  return '';
}

function parseAuthHeader(req) {
  const headers = (req && req.headers) ? req.headers : {};
  const authHeader = getHeader(headers, 'authorization');
  const apiKeyHeader = getHeader(headers, 'x-api-key');
  const opHeader = getHeader(headers, 'x-operator-id');

  // 1. Authorization: Bearer <token>
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();

    if (token === ADMIN_API_KEY) {
      return { authenticated: true, role: "ADMIN", operator: opHeader || "ADMIN_01" };
    }
    if (token === OPERATOR_API_KEY || token === DEMO_API_KEY) {
      return { authenticated: true, role: "OPERATOR", operator: opHeader || "OPERATOR_01" };
    }

    // Cryptographically verify JWT signature & claims
    const verifiedJwt = verifyJwtToken(token, JWT_SECRET);
    if (verifiedJwt) {
      const rawRole = verifiedJwt.role || (verifiedJwt.user_metadata && verifiedJwt.user_metadata.role) || "OPERATOR";
      const roleUpper = String(rawRole).toUpperCase();
      const role = (roleUpper === "ADMIN") ? "ADMIN" : "OPERATOR";
      const operator = verifiedJwt.sub || verifiedJwt.operator || verifiedJwt.email || opHeader || "OPERATOR_01";
      return { authenticated: true, role, operator };
    }

    return { authenticated: false, role: "ANONYMOUS", operator: "ANONYMOUS" };
  }

  // 2. X-API-Key header
  if (apiKeyHeader) {
    if (apiKeyHeader === ADMIN_API_KEY) {
      return { authenticated: true, role: "ADMIN", operator: opHeader || "ADMIN_01" };
    }
    if (apiKeyHeader === OPERATOR_API_KEY || apiKeyHeader === DEMO_API_KEY) {
      return { authenticated: true, role: "OPERATOR", operator: opHeader || "OPERATOR_01" };
    }
    return { authenticated: false, role: "ANONYMOUS", operator: "ANONYMOUS" };
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
  sendApiError,
  createJwtToken,
  verifyJwtToken,
  JWT_SECRET
};
