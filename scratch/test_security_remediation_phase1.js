/**
 * PREDICTA — Security Remediation Phase 1 Verification Suite
 * File: scratch/test_security_remediation_phase1.js
 */

const assert = require('assert');
const { verifyAuthorization, createJwtToken, verifyJwtToken, JWT_SECRET } = require('../src/api/auth');
const logger = require('../src/api/logger');

console.log("=========================================================================");
console.log("PREDICTA — SECURITY REMEDIATION PHASE 1 VERIFICATION SUITE");
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

// 1. Missing credentials -> 401
check("01. Missing Auth Credentials Rejection (401)", () => {
  const auth = verifyAuthorization({ headers: {} }, "OPERATOR");
  assert.strictEqual(auth.authorized, false);
  assert.strictEqual(auth.status, 401);
});

// 2. Invalid token -> 401
check("02. Invalid Bearer Token Rejection (401)", () => {
  const auth = verifyAuthorization({ headers: { authorization: "Bearer invalid_garbage_token_123" } }, "OPERATOR");
  assert.strictEqual(auth.authorized, false);
  assert.strictEqual(auth.status, 401);
});

// 3. Expired JWT token -> 401
check("03. Expired JWT Token Rejection (401)", () => {
  const expiredJwt = createJwtToken({ role: "OPERATOR", sub: "OP_EXPIRED" }, JWT_SECRET, -100);
  const auth = verifyAuthorization({ headers: { authorization: `Bearer ${expiredJwt}` } }, "OPERATOR");
  assert.strictEqual(auth.authorized, false);
  assert.strictEqual(auth.status, 401);
});

// 4. Forged/modified JWT -> 401
check("04. Tampered / Forged JWT Signature Rejection (401)", () => {
  const validJwt = createJwtToken({ role: "OPERATOR", sub: "OP_GENUINE" }, JWT_SECRET, 3600);
  const parts = validJwt.split('.');
  // Modify payload (middle part) to claim ADMIN role without updating signature
  const fakePayload = Buffer.from(JSON.stringify({ role: "ADMIN", sub: "HACKER" })).toString('base64url');
  const forgedJwt = `${parts[0]}.${fakePayload}.${parts[2]}`;

  const auth = verifyAuthorization({ headers: { authorization: `Bearer ${forgedJwt}` } }, "ADMIN");
  assert.strictEqual(auth.authorized, false);
  assert.strictEqual(auth.status, 401);
});

// 5. Unsigned / alg: none JWT -> 401
check("05. Unsigned / 'alg: none' JWT Rejection (401)", () => {
  const headerB64 = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify({ role: "ADMIN", sub: "ATTACKER" })).toString('base64url');
  const unsignedJwt = `${headerB64}.${payloadB64}.`;

  const auth = verifyAuthorization({ headers: { authorization: `Bearer ${unsignedJwt}` } }, "ADMIN");
  assert.strictEqual(auth.authorized, false);
  assert.strictEqual(auth.status, 401);
});

// 6. Fake X-Operator-Role: ADMIN -> 401 / 403
check("06. Client-Controlled X-Operator-Role: ADMIN Rejection (401/403)", () => {
  // Case A: Unauthenticated client sending X-Operator-Role: ADMIN
  const authUnauth = verifyAuthorization({ headers: { "x-operator-role": "ADMIN" } }, "OPERATOR");
  assert.strictEqual(authUnauth.authorized, false);
  assert.strictEqual(authUnauth.status, 401);

  // Case B: Authenticated Operator sending X-Operator-Role: ADMIN attempting ADMIN endpoint
  const operatorJwt = createJwtToken({ role: "OPERATOR", sub: "OP_USER" }, JWT_SECRET, 3600);
  const authOpSpoof = verifyAuthorization({
    headers: {
      authorization: `Bearer ${operatorJwt}`,
      "x-operator-role": "ADMIN"
    }
  }, "ADMIN");
  assert.strictEqual(authOpSpoof.authorized, false);
  assert.strictEqual(authOpSpoof.status, 403);
});

// 7. Valid authenticated operator -> Allowed operator actions
check("07. Valid Authenticated Operator Authorization", () => {
  const operatorJwt = createJwtToken({ role: "OPERATOR", sub: "OP_VALID" }, JWT_SECRET, 3600);
  const auth = verifyAuthorization({ headers: { authorization: `Bearer ${operatorJwt}` } }, "OPERATOR");
  assert.strictEqual(auth.authorized, true);
  assert.strictEqual(auth.user.role, "OPERATOR");
  assert.strictEqual(auth.user.operator, "OP_VALID");
});

// 8. Operator attempting admin action -> 403
check("08. Operator Attempting Admin Endpoint Privilege Escalation (403)", () => {
  const operatorJwt = createJwtToken({ role: "OPERATOR", sub: "OP_VALID" }, JWT_SECRET, 3600);
  const auth = verifyAuthorization({ headers: { authorization: `Bearer ${operatorJwt}` } }, "ADMIN");
  assert.strictEqual(auth.authorized, false);
  assert.strictEqual(auth.status, 403);
});

// 9. Valid admin authentication -> Allowed admin action
check("09. Valid Authenticated Admin Authorization", () => {
  const adminJwt = createJwtToken({ role: "ADMIN", sub: "ADMIN_VALID" }, JWT_SECRET, 3600);
  const auth = verifyAuthorization({ headers: { authorization: `Bearer ${adminJwt}` } }, "ADMIN");
  assert.strictEqual(auth.authorized, true);
  assert.strictEqual(auth.user.role, "ADMIN");
  assert.strictEqual(auth.user.operator, "ADMIN_VALID");
});

// 10. Secrets never appear in API responses or logs
check("10. Secret Masking in Logger & Responses", () => {
  const logDetails = {
    user: "ADMIN_VALID",
    token: "predicta_admin_key_2026",
    secret: "super_secret_val",
    authorization: "Bearer predicta_admin_key_2026",
    non_sensitive: "NORMAL_DATA"
  };

  const sanitized = logger.sanitize(logDetails);
  assert.strictEqual(sanitized.token, '[REDACTED_SECRET]');
  assert.strictEqual(sanitized.secret, '[REDACTED_SECRET]');
  assert.strictEqual(sanitized.authorization, '[REDACTED_SECRET]');
  assert.strictEqual(sanitized.non_sensitive, 'NORMAL_DATA');
});

// 11. Empty/Missing JWT secret rejection check
check("11. Empty / Missing JWT Secret Validation Rejection", () => {
  const validJwt = createJwtToken({ role: "ADMIN", sub: "ADMIN_TEST" }, JWT_SECRET, 3600);
  const resEmpty = verifyJwtToken(validJwt, "");
  const resNull = verifyJwtToken(validJwt, null);
  assert.strictEqual(resEmpty, null);
  assert.strictEqual(resNull, null);
});

// 12. Case-Insensitive Header Support
check("12. Case-Insensitive Authorization Header Parsing", () => {
  const adminJwt = createJwtToken({ role: "ADMIN", sub: "ADMIN_CASE" }, JWT_SECRET, 3600);
  const authUpper = verifyAuthorization({ headers: { "AUTHORIZATION": `Bearer ${adminJwt}` } }, "ADMIN");
  assert.strictEqual(authUpper.authorized, true);
  assert.strictEqual(authUpper.user.role, "ADMIN");
});

console.log("\n=========================================================================");
console.log(`ALL ${passed}/${total} SECURITY REMEDIATION TESTS PASSED 100%! ✅`);
console.log("=========================================================================\n");
