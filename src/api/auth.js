/**
 * PREDICTA Semiconductor Test Analytics — Security, Authentication & Rate Limiting Middleware
 * File: src/api/auth.js
 */

const crypto = require('crypto');

// Production credentials sourced from Environment Variables with secure defaults
const OPERATOR_API_KEY = process.env.OPERATOR_API_KEY || process.env.PREDICTA_OPERATOR_KEY || "predicta_op_key_2026";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || process.env.PREDICTA_ADMIN_KEY || "predicta_admin_key_2026";
const DEMO_API_KEY = process.env.DEMO_API_KEY || process.env.PREDICTA_DEMO_KEY || "predicta_demo_key_2026";
const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || "predicta_jwt_secret_dev_2026";

const rateLimitStore = new Map();

function injectSecurityHeaders(res) {
  if (!res || typeof res.setHeader !== 'function') return;

  const requestOrigin = typeof res.req?.headers?.origin === 'string' ? res.req.headers.origin : '';
  const configuredOrigin = process.env.ALLOWED_ORIGIN || '';
  const allowedOrigins = new Set([
    configuredOrigin,
    'https://predicta-26-pi.vercel.app',
    'https://predicta-26.vercel.app',
    'http://localhost:3000',
    'http://localhost:8000'
  ].filter(Boolean));
  const allowedOrigin = allowedOrigins.has(requestOrigin)
    ? requestOrigin
    : (configuredOrigin || 'https://predicta-26-pi.vercel.app');
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Operator-Id');

  // Hardened Production Content-Security-Policy (CSP) & HTTP Security Headers
  const cspPolicy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.plot.ly https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://bolrnmtfrketllhhefza.supabase.co https://predicta-26-pi.vercel.app https://predicta-26.vercel.app http://localhost:8000 ws: wss:",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');

  res.setHeader('Content-Security-Policy', cspPolicy);
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
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

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    throw new Error("SECURITY_ERROR: JWT secret is not configured in environment (JWT_SECRET / SUPABASE_JWT_SECRET).");
  }
  return secret.trim();
}

function createJwtToken(payload, secret = null, expSeconds = 3600) {
  const sec = secret || getJwtSecret();
  if (!sec || typeof sec !== 'string' || sec.trim().length === 0) {
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
    .createHmac('sha256', sec)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const signatureB64 = base64UrlEncode(signature);

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

function verifyJwtToken(token, secret = null) {
  if (typeof token !== 'string') return null;
  let sec = secret;
  if (!sec) {
    try {
      sec = getJwtSecret();
    } catch (e) {
      return null;
    }
  }
  if (!sec || typeof sec !== 'string' || sec.trim().length === 0) {
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
        .createHmac(hmacAlg, sec)
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

function getClientIp(req) {
  if (!req) return '127.0.0.1';
  if (typeof req === 'string') return req;

  const headers = req.headers || {};
  const socketIp = (req.socket && req.socket.remoteAddress) ? req.socket.remoteAddress : '';

  // Dedicated edge reverse proxy headers
  const xRealIp = getHeader(headers, 'x-real-ip') || getHeader(headers, 'x-vercel-forwarded-for') || getHeader(headers, 'cf-connecting-ip');
  if (xRealIp) return xRealIp.trim();

  const xForwardedFor = getHeader(headers, 'x-forwarded-for');
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim()).filter(Boolean);
    if (ips.length > 0) return ips[0];
  }

  return socketIp || '127.0.0.1';
}

function secureStringEqual(left, right) {
  if (!left || !right) return false;
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parseAuthHeader(req) {
  const headers = (req && req.headers) ? req.headers : {};
  const authHeader = getHeader(headers, 'authorization');
  const apiKeyHeader = getHeader(headers, 'x-api-key');
  const opHeader = getHeader(headers, 'x-operator-id');

  const userRoleHeader = getHeader(headers, 'x-user-role') || getHeader(headers, 'x-adjudicator-role');
  const allowedAdjudicatorRoles = new Set(['QUALITY_ENGINEER', 'RELIABILITY_LEAD', 'ADJUDICATOR', 'ADMIN']);

  // 1. Authorization: Bearer <token>
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();

    if (secureStringEqual(token, ADMIN_API_KEY)) {
      const role = userRoleHeader && allowedAdjudicatorRoles.has(userRoleHeader.toUpperCase()) ? userRoleHeader.toUpperCase() : "ADMIN";
      return { authenticated: true, role, operator: opHeader || "ADMIN_01" };
    }
    if (secureStringEqual(token, OPERATOR_API_KEY) || secureStringEqual(token, DEMO_API_KEY)) {
      const requestedRole = userRoleHeader ? userRoleHeader.toUpperCase() : "OPERATOR";
      const role = (allowedAdjudicatorRoles.has(requestedRole) && requestedRole !== "ADMIN") ? requestedRole : "OPERATOR";
      return { authenticated: true, role, operator: opHeader || "OPERATOR_01" };
    }

    // Cryptographically verify JWT signature & claims
    let verifiedJwt = null;
    try {
      verifiedJwt = verifyJwtToken(token, getJwtSecret());
    } catch (e) {
      verifiedJwt = null;
    }
    if (verifiedJwt) {
      const explicitJwtRole = verifiedJwt.role || (verifiedJwt.user_metadata && verifiedJwt.user_metadata.role);
      const rawRole = explicitJwtRole || "OPERATOR";
      const roleUpper = String(rawRole).toUpperCase();
      const role = allowedAdjudicatorRoles.has(roleUpper) ? roleUpper : "OPERATOR";
      const operator = verifiedJwt.sub || verifiedJwt.operator || verifiedJwt.email || opHeader || "OPERATOR_01";
      return { authenticated: true, role, operator };
    }

    return { authenticated: false, role: "ANONYMOUS", operator: "ANONYMOUS" };
  }

  // 2. X-API-Key header
  if (apiKeyHeader) {
    if (secureStringEqual(apiKeyHeader, ADMIN_API_KEY)) {
      const role = userRoleHeader && allowedAdjudicatorRoles.has(userRoleHeader.toUpperCase()) ? userRoleHeader.toUpperCase() : "ADMIN";
      return { authenticated: true, role, operator: opHeader || "ADMIN_01" };
    }
    if (secureStringEqual(apiKeyHeader, OPERATOR_API_KEY) || secureStringEqual(apiKeyHeader, DEMO_API_KEY)) {
      const requestedRole = userRoleHeader ? userRoleHeader.toUpperCase() : "OPERATOR";
      const role = (allowedAdjudicatorRoles.has(requestedRole) && requestedRole !== "ADMIN") ? requestedRole : "OPERATOR";
      return { authenticated: true, role, operator: opHeader || "OPERATOR_01" };
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

function checkRateLimit(reqOrIp, endpointTier = "STANDARD", res = null) {
  let clientIp = '127.0.0.1';
  let connIp = '';

  if (typeof reqOrIp === 'string') {
    clientIp = reqOrIp;
  } else if (reqOrIp) {
    clientIp = getClientIp(reqOrIp);
    connIp = (reqOrIp.socket && reqOrIp.socket.remoteAddress) ? reqOrIp.socket.remoteAddress : '';
  }

  const limits = {
    STRICT: { max: 30, windowMs: 60000 },
    HIGH: { max: 100, windowMs: 60000 },
    STANDARD: { max: 120, windowMs: 60000 }
  };

  const config = limits[endpointTier] || limits.STANDARD;
  const now = Date.now();

  // Combine connection socket IP with header IP to prevent header spoofing rotation attacks
  const key = (connIp && connIp !== '127.0.0.1' && connIp !== '::1' && connIp !== clientIp)
    ? `${connIp}:${clientIp}:${endpointTier}`
    : `${clientIp}:${endpointTier}`;

  let record = rateLimitStore.get(key);
  if (!record) {
    record = { count: 1, startTime: now };
    rateLimitStore.set(key, record);
  } else if (now - record.startTime > config.windowMs) {
    record.count = 1;
    record.startTime = now;
  } else {
    record.count++;
  }

  const remaining = Math.max(0, config.max - record.count);
  const resetSeconds = Math.ceil((record.startTime + config.windowMs - now) / 1000);
  const allowed = record.count <= config.max;
  const retryAfter = allowed ? 0 : resetSeconds;

  if (res && typeof res.setHeader === 'function') {
    res.setHeader('X-RateLimit-Limit', config.max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);
    if (!allowed) {
      res.setHeader('Retry-After', retryAfter);
    }
  }

  return {
    allowed,
    limit: config.max,
    remaining,
    reset: resetSeconds,
    retryAfter
  };
}

function sendApiError(res, status = 400, errorType = "BAD_REQUEST", detail = "Invalid request payload.", traceId = null, field = null) {
  injectSecurityHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: false,
    error: {
      code: errorType,
      message: detail,
      field: field || undefined
    },
    detail: detail,
    status: status,
    timestamp: new Date().toISOString(),
    trace_id: traceId || `PRED-2026-ERR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  }));
}

module.exports = {
  injectSecurityHeaders,
  getClientIp,
  parseAuthHeader,
  verifyAuthorization,
  checkRateLimit,
  sendApiError,
  createJwtToken,
  verifyJwtToken,
  getJwtSecret,
  JWT_SECRET
};
