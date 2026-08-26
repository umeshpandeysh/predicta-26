/**
 * Predicta Day 13 — Dedicated Live Dashboard & Analytics Integration Test Suite
 * File: tests/test_dashboard_live.js
 */

const assert = require('assert');
const http = require('http');
const vercelHandler = require('../api/index');

const SAMPLE_DEV_RECORD = {
  test_id: "DAY13-LIVE-001",
  equipment_id: "EQP-103",
  supply_voltage: 1.20,
  output_voltage: 1.18,
  current: 45.2,
  leakage_current: 195.4,
  resistance: 12.5,
  capacitance: 4.2,
  threshold_voltage: 0.42,
  frequency: 2400.0,
  propagation_delay: 14.5,
  setup_time: 1.2,
  hold_time: 0.8,
  timing_margin: 2.1,
  temperature: 35.0,
  dynamic_power: 65.0,
  total_power: 72.0,
  test_duration: 12.0
};

console.log("=========================================================================");
console.log("PREDICTA DAY 13 — LIVE DASHBOARD & ANALYTICS INTEGRATION TEST SUITE");
console.log("=========================================================================\n");

function mockRequestResponse(method, url, payload = null) {
  return new Promise((resolve, reject) => {
    const req = new http.IncomingMessage();
    req.method = method;
    req.url = url;

    const res = new http.ServerResponse(req);
    let body = '';

    res.write = (chunk) => { body += chunk.toString(); };
    res.end = (chunk) => {
      if (chunk) body += chunk.toString();
      let parsed = null;
      try {
        parsed = JSON.parse(body);
      } catch (e) {
        parsed = body;
      }
      resolve({ statusCode: res.statusCode, headers: res.getHeaders(), body: parsed });
    };

    vercelHandler(req, res);

    if (payload) {
      req.emit('data', Buffer.from(JSON.stringify(payload)));
    }
    req.emit('end');
  });
}

async function runDay13DashboardTests() {
  try {
    // 1. GET /api/health
    const healthRes = await mockRequestResponse('GET', '/api/health');
    assert.strictEqual(healthRes.statusCode, 200, "1. /api/health failed");
    assert.strictEqual(healthRes.body.threshold, 0.45, "1. threshold not 0.45");
    console.log("✔ Test 01 Passed: GET /api/health verified at threshold 0.45");

    // 2. POST /api/predict (Single Prediction)
    const predictRes = await mockRequestResponse('POST', '/api/predict', SAMPLE_DEV_RECORD);
    assert.strictEqual(predictRes.statusCode, 200, "2. /api/predict failed");
    assert.strictEqual(predictRes.body.prediction, "FAIL", "2. prediction not FAIL");
    assert.strictEqual(predictRes.body.risk_level, "CRITICAL", "2. risk_level not CRITICAL");
    console.log(`✔ Test 02 Passed: POST /api/predict single prediction verified (${predictRes.body.prediction}, prob=${predictRes.body.probability})`);

    // 3. POST /api/predict/batch (Batch Prediction)
    const batchRes = await mockRequestResponse('POST', '/api/predict/batch', [SAMPLE_DEV_RECORD]);
    assert.strictEqual(batchRes.statusCode, 200, "3. /api/predict/batch failed");
    assert.strictEqual(batchRes.body.total, 1, "3. total failed");
    console.log("✔ Test 03 Passed: POST /api/predict/batch processed batch request");

    // 4. GET /api/dashboard/summary
    const summaryRes = await mockRequestResponse('GET', '/api/dashboard/summary');
    assert.strictEqual(summaryRes.statusCode, 200, "4. /api/dashboard/summary failed");
    assert.ok(summaryRes.body.total_runs >= 1, "4. total_runs count invalid");
    assert.strictEqual(summaryRes.body.operating_threshold, 0.45, "4. operating_threshold invalid");
    console.log(`✔ Test 04 Passed: GET /api/dashboard/summary returned live totals (runs=${summaryRes.body.total_runs}, fails=${summaryRes.body.fail_count})`);

    // 5. GET /api/dashboard/recent
    const recentRes = await mockRequestResponse('GET', '/api/dashboard/recent');
    assert.strictEqual(recentRes.statusCode, 200, "5. /api/dashboard/recent failed");
    assert.ok(Array.isArray(recentRes.body), "5. recent is not an array");
    assert.ok(recentRes.body.length >= 1, "5. recent array empty");
    assert.strictEqual(recentRes.body[0].test_id, "DAY13-LIVE-001", "5. latest test_id mismatch");
    console.log("✔ Test 05 Passed: GET /api/dashboard/recent returned latest test record (DAY13-LIVE-001)");

    // 6. GET /api/dashboard/equipment
    const equipRes = await mockRequestResponse('GET', '/api/dashboard/equipment');
    assert.strictEqual(equipRes.statusCode, 200, "6. /api/dashboard/equipment failed");
    assert.ok(equipRes.body["EQP-103"].total >= 1, "6. EQP-103 equipment total invalid");
    console.log("✔ Test 06 Passed: GET /api/dashboard/equipment returned equipment breakdown");

    // 7. GET /api/dashboard/risk
    const riskRes = await mockRequestResponse('GET', '/api/dashboard/risk');
    assert.strictEqual(riskRes.statusCode, 200, "7. /api/dashboard/risk failed");
    assert.ok(riskRes.body.CRITICAL >= 1, "7. CRITICAL risk count invalid");
    console.log("✔ Test 07 Passed: GET /api/dashboard/risk returned risk distribution breakdown");

    // 8. Secret Isolation Verification
    const allResponseBodies = JSON.stringify([healthRes.body, predictRes.body, batchRes.body, summaryRes.body, recentRes.body]);
    assert.strictEqual(allResponseBodies.includes("service_role"), false, "8. Secret leaked in API response!");
    assert.strictEqual(allResponseBodies.includes("SUPABASE_SERVICE_ROLE_KEY"), false, "8. Secret key name leaked!");
    console.log("✔ Test 08 Passed: Security isolation verified — zero secret key leak in API responses");

    // 9. Model Threshold Preservation
    assert.strictEqual(predictRes.body.threshold, 0.45, "9. Threshold mutated!");
    console.log("✔ Test 09 Passed: Model operating threshold strictly preserved at 0.45");

    console.log("\n=========================================================================");
    console.log("ALL DAY 13 DEDICATED DASHBOARD INTEGRATION TESTS PASSED! ✅");
    console.log("=========================================================================\n");
  } catch (err) {
    console.error("❌ DAY 13 DASHBOARD INTEGRATION TEST FAILED:", err);
    process.exit(1);
  }
}

runDay13DashboardTests();
