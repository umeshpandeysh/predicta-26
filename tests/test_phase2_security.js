/**
 * PREDICTA-26 — Phase 2 Master Security & Authorization Test Suite
 * File: tests/test_phase2_security.js
 */

const http = require('http');
const assert = require('assert');
const crypto = require('crypto');
const server = require('../src/api/server');
const { createJwtToken, verifyJwtToken, parseAuthHeader, verifyAuthorization } = require('../src/api/auth');

const TEST_PORT = 8092;
const JWT_SECRET = process.env.JWT_SECRET || "predicta_jwt_secret_dev_2026";
const OPERATOR_KEY = process.env.OPERATOR_API_KEY || "predicta_op_key_2026";
const ADMIN_KEY = process.env.ADMIN_API_KEY || "predicta_admin_key_2026";

function makeRequest(options, postData = null) {
  return new Promise((resolve) => {
    const reqOptions = {
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: options.path || '/api/health',
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch (e) {
          parsed = body;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed,
          rawBody: body
        });
      });
    });

    req.on('error', (err) => {
      resolve({ statusCode: 500, error: err.message });
    });

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

const NOMINAL_PAYLOAD = {
  equipment_id: "EQP-101",
  lot_id: "LOT-001",
  supply_voltage: 1.20,
  output_voltage: 1.18,
  current: 46.5,
  leakage_current: 111.7,
  resistance: 1.2,
  capacitance: 15.0,
  threshold_voltage: 0.45,
  frequency: 2400.0,
  propagation_delay: 10.98,
  setup_time: 1.15,
  hold_time: 0.85,
  timing_margin: 2.1,
  temperature: 25.0,
  dynamic_power: 55.8,
  total_power: 55.9,
  test_duration: 120.0
};

async function runSecuritySuite() {
  console.log("=========================================================================");
  console.log("PREDICTA-26 — PHASE 2 MASTER SECURITY & AUTHORIZATION SUITE");
  console.log("=========================================================================\n");

  await new Promise((resolve) => server.listen(TEST_PORT, '127.0.0.1', resolve));

  try {
    const opToken = createJwtToken({ sub: "op_01", role: "OPERATOR" }, JWT_SECRET, 3600);
    const leadToken = createJwtToken({ sub: "lead_01", role: "QUALITY_ENGINEER" }, JWT_SECRET, 3600);
    const adminToken = createJwtToken({ sub: "admin_01", role: "ADMIN" }, JWT_SECRET, 3600);
    const viewerToken = createJwtToken({ sub: "viewer_01", role: "VIEWER" }, JWT_SECRET, 3600);
    const expiredToken = createJwtToken({ sub: "exp_01", role: "OPERATOR" }, JWT_SECRET, -10);

    // --- AUTH-01: Missing Authorization Header ---
    console.log("▶ AUTH-01: Missing Authorization Header on Protected Route");
    const resAuth01 = await makeRequest({
      path: '/api/predict',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, NOMINAL_PAYLOAD);
    assert.strictEqual(resAuth01.statusCode, 401, "Missing auth header must return 401");
    console.log("  ✔ AUTH-01 Passed: Rejection with HTTP 401 ✅");

    // --- AUTH-02: Malformed JWT Token ---
    console.log("▶ AUTH-02: Malformed JWT Token");
    const resAuth02 = await makeRequest({
      path: '/api/predict',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer not_a_valid_jwt.structure'
      }
    }, NOMINAL_PAYLOAD);
    assert.strictEqual(resAuth02.statusCode, 401, "Malformed JWT must return 401");
    console.log("  ✔ AUTH-02 Passed: Malformed token rejected with HTTP 401 ✅");

    // --- AUTH-03: Expired JWT Token ---
    console.log("▶ AUTH-03: Expired JWT Token");
    const resAuth03 = await makeRequest({
      path: '/api/predict',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${expiredToken}`
      }
    }, NOMINAL_PAYLOAD);
    assert.strictEqual(resAuth03.statusCode, 401, "Expired JWT must return 401");
    console.log("  ✔ AUTH-03 Passed: Expired token rejected with HTTP 401 ✅");

    // --- AUTH-04: Role Escalation via Request Headers ---
    console.log("▶ AUTH-04: Header-Based Role Escalation Prevention");
    const resAuth04 = await makeRequest({
      path: '/api/dispositions/trace-001/adjudicate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${opToken}`,
        'x-user-role': 'ADMIN',
        'x-adjudicator-role': 'ADMIN'
      }
    }, { proposed_outcome: "OVERRULE_PASS", rationale: "Test attack" });
    assert.strictEqual(resAuth04.statusCode, 403, "Operator with forged role header must be rejected from adjudication with 403");
    console.log("  ✔ AUTH-04 Passed: Forged role header ignored; HTTP 403 returned ✅");

    // --- AUTH-05: VIEWER Role Mutation Prohibition ---
    console.log("▶ AUTH-05: VIEWER Role Mutation Prohibition");
    const resAuth05 = await makeRequest({
      path: '/api/predict',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${viewerToken}`
      }
    }, NOMINAL_PAYLOAD);
    // parseAuthHeader evaluates VIEWER role; verifyAuthorization requires OPERATOR (level 2)
    assert.strictEqual(resAuth05.statusCode, 403, "VIEWER token must receive 403 on screening endpoint");
    console.log("  ✔ AUTH-05 Passed: Read-only VIEWER rejected from mutation with HTTP 403 ✅");

    // --- AUTH-06: Tampered JWT Signature ---
    console.log("▶ AUTH-06: Tampered JWT Signature");
    const tamperedToken = opToken.slice(0, -6) + "XXXXXX";
    const resAuth06 = await makeRequest({
      path: '/api/predict',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tamperedToken}`
      }
    }, NOMINAL_PAYLOAD);
    assert.strictEqual(resAuth06.statusCode, 401, "Tampered signature must return 401");
    console.log("  ✔ AUTH-06 Passed: Tampered signature rejected with HTTP 401 ✅");

    // --- SEC-01: Malformed JSON Body ---
    console.log("▶ SEC-01: Malformed JSON Syntax");
    const resSec01 = await makeRequest({
      path: '/api/predict',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${opToken}`
      }
    }, "{malformed_json_body: true");
    assert.strictEqual(resSec01.statusCode, 400, "Malformed JSON syntax must return 400");
    console.log("  ✔ SEC-01 Passed: Malformed JSON safely caught with HTTP 400 ✅");

    // --- SEC-02: Invalid Numeric Physical Values ---
    console.log("▶ SEC-02: Negative Physical Quantities");
    const negPayload = { ...NOMINAL_PAYLOAD, supply_voltage: -1.2 };
    const resSec02 = await makeRequest({
      path: '/api/predict',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${opToken}`
      }
    }, negPayload);
    assert.strictEqual(resSec02.statusCode, 400, "Negative supply voltage must return 400");
    console.log("  ✔ SEC-02 Passed: Unphysical value rejected with HTTP 400 ✅");

    // --- SEC-03: NaN / Infinity Injection ---
    console.log("▶ SEC-03: NaN / Non-Finite Value Injection");
    const nanPayload = { ...NOMINAL_PAYLOAD, current: "NaN" };
    const resSec03 = await makeRequest({
      path: '/api/predict',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${opToken}`
      }
    }, nanPayload);
    assert.strictEqual(resSec03.statusCode, 400, "NaN current must return 400");
    console.log("  ✔ SEC-03 Passed: Non-finite values safely rejected with HTTP 400 ✅");

    // --- SEC-04: Oversized Request Body (> 1MB) ---
    console.log("▶ SEC-04: Oversized Request Payload (> 1MB)");
    const hugeBody = JSON.stringify({
      ...NOMINAL_PAYLOAD,
      padding: "X".repeat(1.2 * 1024 * 1024)
    });
    const resSec04 = await makeRequest({
      path: '/api/predict',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${opToken}`
      }
    }, hugeBody);
    assert.strictEqual(resSec04.statusCode, 413, "Payload > 1MB must return 413");
    console.log("  ✔ SEC-04 Passed: Oversized payload rejected with HTTP 413 ✅");

    // --- SEC-05: Rate Limiting Enforcement ---
    console.log("▶ SEC-05: Rate Limiting Response Headers");
    const resSec05 = await makeRequest({ path: '/api/health', method: 'GET' });
    assert.strictEqual(resSec05.statusCode, 200);
    assert(resSec05.headers['x-ratelimit-limit'] !== undefined, "Rate limit headers must be present");
    console.log(`  ✔ SEC-05 Passed: Rate limit headers verified (Limit: ${resSec05.headers['x-ratelimit-limit']}) ✅`);

    // --- SEC-06: Security Headers (CSP, HSTS, X-Frame-Options) ---
    console.log("▶ SEC-06: Production HTTP Security Headers");
    assert.strictEqual(resSec05.headers['x-frame-options'], 'DENY', "X-Frame-Options must be DENY");
    assert.strictEqual(resSec05.headers['x-content-type-options'], 'nosniff', "X-Content-Type-Options must be nosniff");
    assert(resSec05.headers['content-security-policy']?.includes("frame-ancestors 'none'"), "CSP must disallow framing");
    console.log("  ✔ SEC-06 Passed: Hardened security headers verified ✅");

    // --- SEC-07: ML Integrity & Decision Override Rejection ---
    console.log("▶ SEC-07: Client-Side Decision Override Rejection");
    const forgedPayload = {
      ...NOMINAL_PAYLOAD,
      disposition: "PASS",
      probability: 0.0,
      risk_level: "LOW"
    };
    const resSec07 = await makeRequest({
      path: '/api/predict',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${opToken}`
      }
    }, forgedPayload);
    assert.strictEqual(resSec07.statusCode, 200);
    // Server computes authoritative probability; client fields are ignored
    assert(resSec07.body.probability > 0, "Server must compute authoritative probability");
    assert.strictEqual(resSec07.body.ml_prediction, "PASS");
    console.log("  ✔ SEC-07 Passed: Server computes authoritative prediction; client values ignored ✅");

    console.log("\n=========================================================================");
    console.log("🏆 ALL PHASE 2 SECURITY & AUTHORIZATION TESTS PASSED CLEANLY! ✅");
    console.log("=========================================================================");
  } finally {
    server.close();
  }
}

if (require.main === module) {
  runSecuritySuite().catch(err => {
    console.error("FATAL SUITE FAILURE:", err);
    process.exit(1);
  });
}

module.exports = { runSecuritySuite };
