/**
 * PREDICTA Semiconductor Test Analytics — Structured Logging & Observability Module
 * File: src/api/logger.js
 */

const SENSITIVE_KEYS = new Set([
  'password', 'token', 'secret', 'service_role', 'authorization',
  'api_key', 'x-api-key', 'key', 'supabase_key'
]);

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED_SECRET]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitize(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

function logInfo(event, details = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level: 'INFO',
    event,
    details: sanitize(details)
  };
  console.log(JSON.stringify(payload));
}

function logError(event, error, details = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    event,
    error: error ? error.message : 'Unknown error',
    details: sanitize(details)
  };
  console.error(JSON.stringify(payload));
}

module.exports = {
  sanitize,
  logInfo,
  logError
};
