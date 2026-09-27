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
process.env.JWT_SECRET = process.env.JWT_SECRET || "predicta_jwt_secret_dev_2026";
const JWT_SECRET = process.env.JWT_SECRET;
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

    // --- SEC-05A: Rate Limiting Response Headers ---
    console.log("▶ SEC-05A: Rate Limiting Response Headers");
    const { resetRateLimitStore } = require('../src/api/auth');
    resetRateLimitStore();
    const resSec05A = await makeRequest({ path: '/api/health', method: 'GET' });
    assert.strictEqual(resSec05A.statusCode, 200);
    assert(resSec05A.headers['x-ratelimit-limit'] !== undefined, "Rate limit headers must be present");
    assert(resSec05A.headers['x-ratelimit-remaining'] !== undefined, "X-RateLimit-Remaining must be present");
    assert(resSec05A.headers['x-ratelimit-reset'] !== undefined, "X-RateLimit-Reset must be present");
    console.log(`  ✔ SEC-05A Passed: Rate limit headers verified (Limit: ${resSec05A.headers['x-ratelimit-limit']}, Remaining: ${resSec05A.headers['x-ratelimit-remaining']}) ✅`);

    // --- SEC-05B: Forwarded-IP Rotation Spoofing Attack Prevention ---
    console.log("▶ SEC-05B: Forwarded-IP Rotation Spoofing Attack Prevention");
    resetRateLimitStore();
    delete process.env.TRUST_PROXY;
    delete process.env.VERCEL;

    let throttledCount = 0;
    // Endpoint /api/secondary-test has STRICT limit = 30 req/min
    for (let i = 1; i <= 35; i++) {
      const spoofedIp = `198.51.100.${i}`;
      const resSpoof = await makeRequest({
        path: '/api/secondary-test',
        method: 'GET',
        headers: {
          'x-forwarded-for': spoofedIp,
          'x-real-ip': spoofedIp,
          'cf-connecting-ip': spoofedIp
        }
      });
      if (resSpoof.statusCode === 429) {
        throttledCount++;
      }
    }
    assert(throttledCount >= 5, `Attacker rotating X-Forwarded-For must be throttled with HTTP 429 at STRICT limit (observed ${throttledCount} throttled requests)`);
    console.log(`  ✔ SEC-05B Passed: Header rotation spoofing neutralized (throttled at limit 30) ✅`);

    // --- SEC-05C: Legitimate Trusted-Proxy Client Isolation ---
    console.log("▶ SEC-05C: Legitimate Trusted-Proxy Client Isolation");
    resetRateLimitStore();
    process.env.TRUST_PROXY = 'true';

    // In trusted proxy mode, 5 requests from Client A and 5 requests from Client B are distinct buckets
    let clientARequests = 0;
    let clientBRequests = 0;
    for (let i = 0; i < 5; i++) {
      const resA = await makeRequest({
        path: '/api/health',
        method: 'GET',
        headers: { 'x-forwarded-for': '203.0.113.10' }
      });
      if (resA.statusCode === 200) clientARequests++;

      const resB = await makeRequest({
        path: '/api/health',
        method: 'GET',
        headers: { 'x-forwarded-for': '203.0.113.20' }
      });
      if (resB.statusCode === 200) clientBRequests++;
    }
    assert.strictEqual(clientARequests, 5, "Trusted Proxy: Client A requests must succeed");
    assert.strictEqual(clientBRequests, 5, "Trusted Proxy: Client B requests must succeed");
    delete process.env.TRUST_PROXY;
    resetRateLimitStore();
    console.log("  ✔ SEC-05C Passed: Trusted-proxy client isolation operates correctly ✅");

    // --- SEC-06: Security Headers (CSP, HSTS, X-Frame-Options) ---
    console.log("▶ SEC-06: Production HTTP Security Headers");
    const resSec06 = await makeRequest({ path: '/api/health', method: 'GET' });
    assert.strictEqual(resSec06.headers['x-frame-options'], 'DENY', "X-Frame-Options must be DENY");
    assert.strictEqual(resSec06.headers['x-content-type-options'], 'nosniff', "X-Content-Type-Options must be nosniff");
    assert(resSec06.headers['content-security-policy']?.includes("frame-ancestors 'none'"), "CSP must disallow framing");
    console.log("  ✔ SEC-06 Passed: Hardened security headers verified ✅");

    // --- SEC-07: Strong Client-ML-Spoofing Equivalence Test ---
    console.log("▶ SEC-07: Strong Client-ML-Spoofing Equivalence Verification");
    const cleanPayload = { ...NOMINAL_PAYLOAD };
    const forgedPayload = {
      ...NOMINAL_PAYLOAD,
      probability: 0.999999,
      prediction: "FAIL",
      ml_prediction: "FAIL",
      disposition: "REJECT",
      risk_level: "CRITICAL",
      anomaly_score: 999999,
      model_hash: "ATTACKER_MODEL_SPOOF",
      model_id: "FAKE_XGBOOST_MODEL",
      prognostic_output: { spoofed: true },
      ml_decision_snapshot: { spoofed: true }
    };

    const cleanRes = await makeRequest({
      path: '/api/predict',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${opToken}`
      }
    }, cleanPayload);

    const forgedRes = await makeRequest({
      path: '/api/predict',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${opToken}`
      }
    }, forgedPayload);

    assert.strictEqual(cleanRes.statusCode, 200, "Clean inference must succeed with HTTP 200");
    assert.strictEqual(forgedRes.statusCode, 200, "Forged inference must succeed with HTTP 200");

    // Authoritative decision equivalence assertions
    assert.strictEqual(cleanRes.body.prediction, forgedRes.body.prediction, "ML prediction must be mathematically identical");
    assert.strictEqual(cleanRes.body.disposition, forgedRes.body.disposition, "Operational disposition must be identical");
    assert.strictEqual(cleanRes.body.risk_level, forgedRes.body.risk_level, "Risk level must be identical");
    assert.strictEqual(cleanRes.body.source, forgedRes.body.source, "Run source must be identical");
    assert(Math.abs(cleanRes.body.probability - forgedRes.body.probability) < 1e-9, "Failure probability must match exactly");

    // Deterministic ML sub-engine assertions
    const cleanDetails = cleanRes.body.ml_details || {};
    const forgedDetails = forgedRes.body.ml_details || {};
    assert.strictEqual(cleanDetails.anomaly_detection?.overall_status, forgedDetails.anomaly_detection?.overall_status, "Anomaly detection status must match");
    assert.strictEqual(cleanDetails.risk_engine?.risk_class, forgedDetails.risk_engine?.risk_class, "Risk class must match");
    assert.strictEqual(cleanDetails.explainability?.summary, forgedDetails.explainability?.summary, "Explainability summary must match");

    console.log(`  ✔ SEC-07 Passed: Full mathematical & semantic ML decision equivalence verified (P=${cleanRes.body.probability} / Disp=${cleanRes.body.disposition}) ✅`);

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
