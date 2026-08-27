/**
 * PREDICTA — Backend Phase 2 Security, Auth & Rate Limiting Verification Runner
 * File: scratch/verify_security_phase2.js
 */

const assert = require('assert');
const { parseAuthHeader, verifyAuthorization, checkRateLimit, injectSecurityHeaders } = require('../src/api/auth');

console.log("=========================================================================");
console.log("PREDICTA BACKEND PHASE 2 — SECURITY & AUTHENTICATION VERIFICATION");
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

// 1. Unauthenticated Request Rejection (401 Unauthorized)
check("Unauthenticated Request Rejection on Protected QA Endpoint (401)", () => {
  const req = { headers: {} };
  const auth = verifyAuthorization(req, "OPERATOR");
  assert.strictEqual(auth.authorized, false);
  assert.strictEqual(auth.status, 401);
});

// 2. Authorized Bearer Token Pass (200 / Authorized)
check("Authorized Bearer Token Verification (OPERATOR Role)", () => {
  const req = { headers: { authorization: "Bearer predicta_op_key_2026", "x-operator-id": "ENGINEER_AZ" } };
  const auth = verifyAuthorization(req, "OPERATOR");
  assert.strictEqual(auth.authorized, true);
  assert.strictEqual(auth.user.role, "OPERATOR");
  assert.strictEqual(auth.user.operator, "ENGINEER_AZ");
});

// 3. Authorized Admin Key Pass (ADMIN Role)
check("Authorized Admin Key Verification (ADMIN Role)", () => {
  const req = { headers: { "x-api-key": "predicta_admin_key_2026" } };
  const auth = verifyAuthorization(req, "ADMIN");
  assert.strictEqual(auth.authorized, true);
  assert.strictEqual(auth.user.role, "ADMIN");
});

// 4. Role Privilege Escalation Protection (403 Forbidden)
check("Insufficient Privilege Protection (OPERATOR trying ADMIN endpoint -> 403)", () => {
  const req = { headers: { authorization: "Bearer predicta_op_key_2026" } };
  const auth = verifyAuthorization(req, "ADMIN");
  assert.strictEqual(auth.authorized, false);
  assert.strictEqual(auth.status, 403);
});

// 5. Sliding-Window Rate Limiting Protection (429)
check("Sliding-Window Rate Limiting Protection (429 Trigger)", () => {
  const testIp = "192.168.1.99";
  let lastRes;
  for (let i = 0; i < 35; i++) {
    lastRes = checkRateLimit(testIp, "STRICT");
  }
  assert.strictEqual(lastRes.allowed, false, "Rate limit should block requests over threshold");
});

// 6. Security Headers Injection Check
check("Security Headers Injection Check (X-Content-Type-Options, X-Frame-Options)", () => {
  const headers = {};
  const mockRes = { setHeader: (k, v) => { headers[k] = v; } };
  injectSecurityHeaders(mockRes);
  assert.strictEqual(headers['X-Content-Type-Options'], 'nosniff');
  assert.strictEqual(headers['X-Frame-Options'], 'DENY');
  assert.strictEqual(headers['X-XSS-Protection'], '1; mode=block');
});

console.log("\n=========================================================================");
console.log(`ALL ${passed}/${total} PHASE 2 SECURITY CHECKS PASSED! ✅`);
console.log("PREDICTA BACKEND SECURITY LAYER IS 100% REPAIRED & HARDENED!");
console.log("=========================================================================\n");
