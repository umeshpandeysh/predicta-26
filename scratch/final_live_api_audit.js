/**
 * PREDICTA — Phase 2 Final Live HTTP API Audit Script (15 Endpoints)
 * File: scratch/final_live_api_audit.js
 */

const http = require('http');
const assert = require('assert');
const server = require('../src/api/server');

const PORT = 8099;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: path,
      method: method,
      headers: reqHeaders
    }, (res) => {
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

async function runLiveApiAudit() {
  console.log("=========================================================================");
  console.log("PREDICTA PHASE 2 — FINAL LIVE HTTP API AUDIT (15 ENDPOINTS)");
  console.log("=========================================================================\n");

  const sampleRecord = {
    test_id: "FINAL-HTTP-001", equipment_id: "EQP-101",
    supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
    resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
    propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
    temperature: 25.0, dynamic_power: 40.0, total_power: 50.0, test_duration: 12.0,
    iddq: 2000.0, ileak: 250.0, tpd: 180.0, iddq_0h: 2000.0, ileak_0h: 250.0, tpd_0h: 180.0
  };

  const authHeaders = { authorization: "Bearer predicta_op_key_2026", "x-operator-id": "OPERATOR_FINAL" };

  server.listen(PORT, async () => {
    try {
      // 1. GET /api/health
      const h1 = await request('GET', '/api/health');
      assert.strictEqual(h1.status, 200);
      assert.strictEqual(h1.body.status, "ok");
      console.log("[PASS] 01. GET /api/health -> 200 OK");

      // 2. GET /api/system/status
      const h2 = await request('GET', '/api/system/status');
      assert.strictEqual(h2.status, 200);
      assert.strictEqual(h2.body.api, "ONLINE");
      console.log("[PASS] 02. GET /api/system/status -> 200 OK");

      // 3. POST /api/predict
      const h3 = await request('POST', '/api/predict', sampleRecord);
      assert.strictEqual(h3.status, 200);
      assert.strictEqual(h3.body.prediction, "PASS");
      console.log("[PASS] 03. POST /api/predict -> 200 OK");

      // 4. POST /api/predict/batch
      const h4 = await request('POST', '/api/predict/batch', [sampleRecord]);
      assert.strictEqual(h4.status, 200);
      assert.strictEqual(h4.body.total, 1);
      console.log("[PASS] 04. POST /api/predict/batch -> 200 OK");

      // 5. GET /api/dashboard/summary
      const h5 = await request('GET', '/api/dashboard/summary');
      assert.strictEqual(h5.status, 200);
      assert.ok(h5.body.total_runs >= 1);
      console.log("[PASS] 05. GET /api/dashboard/summary -> 200 OK");

      // 6. GET /api/dashboard/recent
      const h6 = await request('GET', '/api/dashboard/recent');
      assert.strictEqual(h6.status, 200);
      assert.ok(Array.isArray(h6.body));
      console.log("[PASS] 06. GET /api/dashboard/recent -> 200 OK");

      // 7. GET /api/dashboard/equipment
      const h7 = await request('GET', '/api/dashboard/equipment');
      assert.strictEqual(h7.status, 200);
      assert.ok(h7.body["EQP-101"] !== undefined);
      console.log("[PASS] 07. GET /api/dashboard/equipment -> 200 OK");

      // 8. GET /api/dashboard/risk
      const h8 = await request('GET', '/api/dashboard/risk');
      assert.strictEqual(h8.status, 200);
      assert.ok(h8.body.LOW !== undefined);
      console.log("[PASS] 08. GET /api/dashboard/risk -> 200 OK");

      // 9. GET /api/ate/status
      const h9 = await request('GET', '/api/ate/status');
      assert.strictEqual(h9.status, 200);
      assert.strictEqual(h9.body.connection_mode, "SIMULATED_ATE");
      console.log("[PASS] 09. GET /api/ate/status -> 200 OK");

      // 10. POST /api/ate/simulate
      const h10 = await request('POST', '/api/ate/simulate', { scenario: "NORMAL" });
      assert.strictEqual(h10.status, 200);
      assert.ok(h10.body.ate_simulation_metadata !== undefined);
      console.log("[PASS] 10. POST /api/ate/simulate -> 200 OK");

      // 11. GET /api/prediction/detail
      const h11 = await request('GET', `/api/prediction/detail?id=${sampleRecord.test_id}`);
      assert.strictEqual(h11.status, 200);
      assert.strictEqual(h11.body.test_id, sampleRecord.test_id);
      console.log("[PASS] 11. GET /api/prediction/detail -> 200 OK");

      // 12. POST /api/prediction/secondary-test/request
      const h12 = await request('POST', '/api/prediction/secondary-test/request', { test_id: sampleRecord.test_id, comments: "Audit test" }, authHeaders);
      assert.strictEqual(h12.status, 201);
      assert.strictEqual(h12.body.lifecycle_state, "SECONDARY_TEST_PENDING");
      console.log("[PASS] 12. POST /api/prediction/secondary-test/request -> 201 Created");

      // 13. POST /api/prediction/secondary-test/complete
      const h13 = await request('POST', '/api/prediction/secondary-test/complete', { test_id: sampleRecord.test_id, secondary_result: "PASS", comments: "Passed" }, authHeaders);
      assert.strictEqual(h13.status, 200);
      assert.strictEqual(h13.body.lifecycle_state, "CONFIRMED_PASS");
      console.log("[PASS] 13. POST /api/prediction/secondary-test/complete -> 200 OK");

      // 14. POST /api/prediction/disposition
      const sampleDisp = { ...sampleRecord, test_id: "FINAL-HTTP-DISP" };
      await request('POST', '/api/predict', sampleDisp);
      const h14 = await request('POST', '/api/prediction/disposition', { test_id: sampleDisp.test_id, disposition: "QUARANTINED", comments: "Quarantined" }, authHeaders);
      assert.strictEqual(h14.status, 200);
      assert.strictEqual(h14.body.operator_disposition, "QUARANTINED");
      console.log("[PASS] 14. POST /api/prediction/disposition -> 200 OK");

      // 15. GET /api/prediction/history
      const h15 = await request('GET', `/api/prediction/history?test_id=${sampleRecord.test_id}`);
      assert.strictEqual(h15.status, 200);
      assert.ok(Array.isArray(h15.body.event_history));
      console.log("[PASS] 15. GET /api/prediction/history -> 200 OK");

      console.log("\n=========================================================================");
      console.log("ALL 15 LIVE HTTP ROUTE VERIFICATIONS PASSED 100%! ✅");
      console.log("=========================================================================\n");
      process.exit(0);
    } catch (err) {
      console.error("[FAIL] Live HTTP API audit failed:", err.message);
      process.exit(1);
    }
  });
}

runLiveApiAudit();
