/**
 * PREDICTA — Strict Live Vercel + Supabase Production Verification Suite
 * File: scratch/verify_live_cloud_path.js
 * Target: https://ceenew.vercel.app
 */

const https = require('https');
const assert = require('assert');

const VERCEL_PRODUCTION_URL = 'https://ceenew.vercel.app';

console.log("=========================================================================");
console.log("PREDICTA — STRICT LIVE VERCEL + SUPABASE PRODUCTION VERIFICATION");
console.log(`Target Production URL: ${VERCEL_PRODUCTION_URL}`);
console.log("=========================================================================\n");

function httpReq(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(path, VERCEL_PRODUCTION_URL);
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };

    const req = https.request(urlObj, { method, headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = {};
        try { json = JSON.parse(data || '{}'); } catch(e) { json = { raw: data }; }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

let testTraceId = null;
let testTestId = `LIVE-VERCEL-${Date.now()}`;

async function runLiveVerification() {
  let passed = 0;
  let total = 0;

  function check(desc, fn) {
    total++;
    return fn().then(() => {
      console.log(`[PASS] Check ${total.toString().padStart(2, '0')}: ${desc}`);
      passed++;
    }).catch(err => {
      console.error(`[FAIL] Check ${total.toString().padStart(2, '0')}: ${desc}`);
      console.error(`       Error: ${err.message}`);
      throw err;
    });
  }

  try {
    // 1. GET /api/health
    await check("01. Live Vercel GET /api/health", async () => {
      const res = await httpReq('GET', '/api/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');
      assert.strictEqual(res.body.version, '2.0_production');
      console.log(`       -> Health Status: OK, Mode: ${res.body.persistence_mode}`);
    });

    // 2. GET /api/system/status
    await check("02. Live Vercel GET /api/system/status", async () => {
      const res = await httpReq('GET', '/api/system/status');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.api, 'ONLINE');
      assert.strictEqual(res.body.database, 'ONLINE');
      console.log(`       -> API: ${res.body.api}, Database: ${res.body.database}, Supabase: ${res.body.supabase}`);
    });

    // 3. POST /api/predict (Controlled Test Prediction)
    await check("03. Live Vercel POST /api/predict (Controlled Test Prediction)", async () => {
      const sampleNominal = {
        test_id: testTestId,
        equipment_id: "EQP-101",
        supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
        resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
        propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
        temperature: 25.0, dynamic_power: 40.0, total_power: 50.0, test_duration: 12.0,
        iddq: 2000.0, ileak: 250.0, tpd: 180.0, iddq_0h: 2000.0, ileak_0h: 250.0, tpd_0h: 180.0
      };

      const res = await httpReq('POST', '/api/predict', sampleNominal);
      if (res.status !== 200) {
        console.error("Predict Error Body:", res.body);
      }
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.prediction, "Prediction must exist");
      assert.ok(res.body.trace_id, "Trace ID must exist");
      assert.ok(res.body.ml_details, "ml_details must exist");
      assert.ok(res.body.ml_details.anomaly_detection, "ml_details.anomaly_detection must exist");
      assert.ok(res.body.ml_details.drift_prediction, "ml_details.drift_prediction must exist");
      assert.ok(res.body.ml_details.safety_slope, "ml_details.safety_slope must exist");
      assert.ok(res.body.ml_details.risk_engine, "ml_details.risk_engine must exist");
      assert.ok(res.body.ml_details.explainability, "ml_details.explainability must exist");

      testTraceId = res.body.trace_id;
      console.log(`       -> Test ID: ${testTestId}, Generated Trace ID: ${testTraceId}, Decision: ${res.body.prediction}`);
    });

    // 4. Live Cloud Persistence Retrieval by trace_id or test_id
    await check("04. Live Vercel GET /api/prediction/detail (Durable Cloud Persistence Check)", async () => {
      assert.ok(testTraceId, "trace_id must be populated from previous step");
      const res = await httpReq('GET', `/api/prediction/detail?trace_id=${testTraceId}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.trace_id, testTraceId);
      assert.strictEqual(res.body.test_id, testTestId);
      assert.ok(res.body.ml_details, "ml_details must be persisted and retrieved");
      assert.ok(res.body.event_history, "event_history must be persisted and retrieved");
      console.log(`       -> Successfully retrieved persisted record for trace_id '${testTraceId}'`);
    });

    // 5. GET /api/dashboard/summary
    await check("05. Live Vercel GET /api/dashboard/summary", async () => {
      const res = await httpReq('GET', '/api/dashboard/summary');
      assert.strictEqual(res.status, 200);
      assert.ok(typeof res.body.total_runs === 'number', "total_runs must be number");
      assert.ok(typeof res.body.pass_count === 'number', "pass_count must be number");
      console.log(`       -> Total Runs: ${res.body.total_runs}, Pass: ${res.body.pass_count}`);
    });

    // 6. GET /api/dashboard/recent
    await check("06. Live Vercel GET /api/dashboard/recent", async () => {
      const res = await httpReq('GET', '/api/dashboard/recent');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body), "recent predictions must be an array");
      const found = res.body.find(r => r.trace_id === testTraceId || r.test_id === testTestId);
      assert.ok(found, `Persisted test record '${testTestId}' must appear in recent dashboard list`);
      console.log(`       -> Found persisted test record '${testTestId}' in recent dashboard list`);
    });

    // 7. Live QA Workflow Transition (Secondary Test Request)
    await check("07. Live Vercel POST /api/prediction/secondary-test/request", async () => {
      const res = await httpReq('POST', '/api/prediction/secondary-test/request', {
        test_id: testTestId,
        operator: "OP_VERIFICATION_SUITE",
        comments: "Live cloud verification secondary test request"
      }, { authorization: 'Bearer predicta_op_key_2026' });
      assert.strictEqual(res.status, 201);
      const rec = res.body.record || res.body;
      assert.strictEqual(rec.lifecycle_state, "SECONDARY_TEST_PENDING");
      console.log(`       -> Updated state to SECONDARY_TEST_PENDING`);
    });

    // 8. Live QA Workflow Transition (Secondary Test Complete)
    await check("08. Live Vercel POST /api/prediction/secondary-test/complete", async () => {
      const res = await httpReq('POST', '/api/prediction/secondary-test/complete', {
        test_id: testTestId,
        secondary_result: "PASS",
        operator: "OP_VERIFICATION_SUITE",
        comments: "Live cloud verification secondary test completion"
      }, { authorization: 'Bearer predicta_op_key_2026' });
      assert.strictEqual(res.status, 200);
      const rec = res.body.record || res.body;
      assert.strictEqual(rec.secondary_test_result, "PASS");
      console.log(`       -> Secondary Test Result recorded: PASS`);
    });

    // 9. Live QA Workflow Transition (Terminal State Mutation Protection)
    await check("09. Live Vercel POST /api/prediction/disposition (Terminal Lockout Protection)", async () => {
      const res = await httpReq('POST', '/api/prediction/disposition', {
        test_id: testTestId,
        disposition: "CONFIRMED_PASS",
        operator: "OP_VERIFICATION_SUITE",
        comments: "Live cloud verification operator disposition confirmation"
      }, { authorization: 'Bearer predicta_op_key_2026' });
      assert.strictEqual(res.status, 409);
      console.log(`       -> Terminal State Protection Enforced: 409 Conflict (Record locked in terminal state)`);
    });

    // 10. Durable Persistence Verification of Terminal QA State
    await check("10. Live Vercel GET /api/prediction/detail (Terminal QA State Verification)", async () => {
      const res = await httpReq('GET', `/api/prediction/detail?trace_id=${testTraceId}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.lifecycle_state, "CONFIRMED_PASS");
      assert.strictEqual(res.body.operator_disposition, "CONFIRMED_PASS");
      assert.ok(res.body.event_history.length >= 4, "event_history must contain all QA lifecycle events");
      console.log(`       -> Event history count: ${res.body.event_history.length}. All QA transitions persisted!`);
    });

    console.log("\n=========================================================================");
    console.log(`ALL ${passed}/${total} LIVE CLOUD VERIFICATION CHECKS PASSED 100%! ✅`);
    console.log("VERCEL + SUPABASE LIVE CLOUD INTEGRATION IS FULLY VERIFIED!");
    console.log("=========================================================================\n");
  } catch (e) {
    console.error(`\n[FATAL ERROR] Live verification failed: ${e.message}`);
    process.exit(1);
  }
}

runLiveVerification();
