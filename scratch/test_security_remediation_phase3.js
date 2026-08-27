/**
 * PREDICTA — Security Remediation Phase 3 Verification Suite
 * File: scratch/test_security_remediation_phase3.js
 */

const assert = require('assert');
const { injectSecurityHeaders, getClientIp, checkRateLimit } = require('../src/api/auth');

console.log("=========================================================================");
console.log("PREDICTA — SECURITY REMEDIATION PHASE 3 VERIFICATION SUITE");
console.log("=========================================================================\n");

let passed = 0;
let total = 0;

function check(desc, fn) {
  total++;
  try {
    fn();
    console.log(`[PASS] Check ${total.toString().padStart(2, '0')}: ${desc}`);
    passed++;
  } catch (e) {
    console.error(`[FAIL] Check ${total.toString().padStart(2, '0')}: ${desc}`);
    console.error(`       Error: ${e.message}`);
    process.exit(1);
  }
}

// Mock Response Object for Header Inspection
function createMockResponse() {
  const headers = {};
  return {
    setHeader: (name, val) => { headers[name.toLowerCase()] = val; },
    getHeader: (name) => headers[name.toLowerCase()],
    headers
  };
}

// 1. Content-Security-Policy (CSP) Header Verification
check("01. Content-Security-Policy (CSP) Header Presence & Strictness", () => {
  const res = createMockResponse();
  injectSecurityHeaders(res);

  const csp = res.getHeader('content-security-policy');
  assert.ok(csp, "CSP header must be present");
  assert.ok(csp.includes("default-src 'self'"), "CSP default-src must be 'self'");
  assert.ok(csp.includes("script-src 'self'"), "CSP script-src must allow 'self'");
  assert.ok(csp.includes("https://cdn.plot.ly"), "CSP script-src must permit Plotly CDN");
  assert.ok(csp.includes("frame-ancestors 'none'"), "CSP frame-ancestors must be 'none'");
  assert.ok(csp.includes("object-src 'none'"), "CSP object-src must be 'none'");
});

// 2. HTTP Security Hardening Headers Verification
check("02. HTTP Security Hardening Headers (HSTS, Frame, Nosniff, Referrer, Permissions)", () => {
  const res = createMockResponse();
  injectSecurityHeaders(res);

  assert.ok(res.getHeader('strict-transport-security').includes('max-age=31536000'));
  assert.strictEqual(res.getHeader('x-content-type-options'), 'nosniff');
  assert.strictEqual(res.getHeader('x-frame-options'), 'DENY');
  assert.strictEqual(res.getHeader('x-xss-protection'), '1; mode=block');
  assert.strictEqual(res.getHeader('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.ok(res.getHeader('permissions-policy').includes('camera=()'));
});

// 3. Proxy-Aware Client IP Extraction (X-Forwarded-For, X-Real-IP)
check("03. Proxy-Aware Client IP Extraction (X-Forwarded-For / X-Real-IP)", () => {
  const reqForwarded = { headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178' } };
  assert.strictEqual(getClientIp(reqForwarded), '203.0.113.195');

  const reqRealIp = { headers: { 'x-real-ip': '198.51.100.42' } };
  assert.strictEqual(getClientIp(reqRealIp), '198.51.100.42');

  const reqCfIp = { headers: { 'cf-connecting-ip': '192.0.2.1' } };
  assert.strictEqual(getClientIp(reqCfIp), '192.0.2.1');

  const reqSocket = { socket: { remoteAddress: '10.0.0.5' } };
  assert.strictEqual(getClientIp(reqSocket), '10.0.0.5');
});

// 4. Rate Limit Header Injection & Tier Limits
check("04. IETF Rate Limit Response Header Injection (Limit, Remaining, Reset)", () => {
  const testIp = `203.0.113.${Math.floor(Math.random() * 200) + 10}`;
  const res = createMockResponse();
  const result = checkRateLimit(testIp, "STRICT", res);

  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.limit, 30);
  assert.strictEqual(res.getHeader('x-ratelimit-limit'), 30);
  assert.strictEqual(res.getHeader('x-ratelimit-remaining'), 29);
  assert.ok(typeof res.getHeader('x-ratelimit-reset') === 'number');
});

// 5. Rate Limit Exhaustion & 429 Retry-After Header
check("05. Rate Limit Exhaustion & Retry-After Header Enforcement", () => {
  const testIp = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;
  const res = createMockResponse();

  for (let i = 0; i < 30; i++) {
    checkRateLimit(testIp, "STRICT", res);
  }

  // 31st request must trigger rate limit breach
  const breachResult = checkRateLimit(testIp, "STRICT", res);
  assert.strictEqual(breachResult.allowed, false);
  assert.ok(breachResult.retryAfter > 0);
  assert.strictEqual(res.getHeader('x-ratelimit-remaining'), 0);
  assert.ok(res.getHeader('retry-after') > 0);
});

// 6. Legitimate Request Traffic Allowed Without False Blocking
check("6. Legitimate Standard Request Allowed Without False Blocking", () => {
  const testIp = `192.0.2.${Math.floor(Math.random() * 200) + 10}`;
  const res = createMockResponse();
  const result = checkRateLimit(testIp, "STANDARD", res);

  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.limit, 120);
});

console.log("\n=========================================================================");
console.log(`ALL ${passed}/${total} SECURITY REMEDIATION PHASE 3 TESTS PASSED 100%! ✅`);
console.log("=========================================================================\n");
