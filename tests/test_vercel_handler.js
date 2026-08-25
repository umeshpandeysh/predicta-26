/**
 * Predicta Vercel Serverless Function Handler Test Suite
 * File: tests/test_vercel_handler.js
 */

const assert = require('assert');
const http = require('http');
const vercelHandler = require('../api/index');

const SAMPLE_RECORD = {
  test_id: "VERCEL-TEST-001",
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
console.log("PREDICTA VERCEL SERVERLESS FUNCTION HANDLER TEST SUITE");
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

async function runVercelHandlerTests() {
  try {
    // 1. GET /api/health
    const healthRes = await mockRequestResponse('GET', '/api/health');
    assert.strictEqual(healthRes.statusCode, 200, "1. /api/health status code failed");
    assert.strictEqual(healthRes.body.status, "ok", "1. status not ok");
    assert.strictEqual(healthRes.body.threshold, 0.45, "1. threshold not 0.45");
    console.log("✔ Test 01 Passed: GET /api/health serverless handler returns status ok and threshold 0.45");

    // 2. POST /api/predict
    const predictRes = await mockRequestResponse('POST', '/api/predict', SAMPLE_RECORD);
    assert.strictEqual(predictRes.statusCode, 200, "2. /api/predict status code failed");
    assert.strictEqual(predictRes.body.prediction, "FAIL", "2. prediction not FAIL");
    assert.strictEqual(predictRes.body.threshold, 0.45, "2. threshold not 0.45");
    console.log(`✔ Test 02 Passed: POST /api/predict serverless handler returns FAIL (prob=${predictRes.body.probability})`);

    // 3. POST /api/predict/batch
    const batchRes = await mockRequestResponse('POST', '/api/predict/batch', [SAMPLE_RECORD]);
    assert.strictEqual(batchRes.statusCode, 200, "3. /api/predict/batch status code failed");
    assert.strictEqual(batchRes.body.total, 1, "3. batch count failed");
    console.log("✔ Test 03 Passed: POST /api/predict/batch serverless handler processed batch");

    // 4. GET /api/dashboard/summary
    const summaryRes = await mockRequestResponse('GET', '/api/dashboard/summary');
    assert.strictEqual(summaryRes.statusCode, 200, "4. /api/dashboard/summary status code failed");
    assert.ok(summaryRes.body.total_runs >= 1, "4. dashboard runs failed");
    console.log("✔ Test 04 Passed: GET /api/dashboard/summary serverless handler operational");

    console.log("\n=========================================================================");
    console.log("ALL VERCEL SERVERLESS HANDLER TESTS PASSED SUCCESSFULLY! ✅");
    console.log("=========================================================================\n");
  } catch (err) {
    console.error("❌ VERCEL HANDLER TEST FAILED:", err);
    process.exit(1);
  }
}

runVercelHandlerTests();
