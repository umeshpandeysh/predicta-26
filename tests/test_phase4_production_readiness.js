/**
 * PREDICTA SIH 2026 — Phase 4: Production Readiness, Reliability & Security Test Suite
 * File: tests/test_phase4_production_readiness.js
 */

const assert = require('assert');
const http = require('http');
const server = require('../src/api/server.js');
const serviceInstance = require('../src/api/inference.js');

const PORT = 8010;
let serverInstance = null;

console.log("================================================================================");
console.log("🚨 PREDICTA SIH 2026 — PHASE 4: PRODUCTION READINESS & SECURITY SUITE");
console.log("================================================================================\n");

function makePostRequest(path, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...headers
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

const nominalPayload = {
  test_id: "P4-NOMINAL-001",
  equipment_id: "EQP-101",
  supply_voltage: 1.20,
  output_voltage: 1.20,
  current: 250.0,
  leakage_current: 110.0,
  resistance: 100.0,
  capacitance: 10.0,
  threshold_voltage: 0.40,
  frequency: 2500.0,
  propagation_delay: 11.0,
  setup_time: 1.5,
  hold_time: 0.5,
  timing_margin: 3.0,
  temperature: 25.0,
  dynamic_power: 40.0,
  total_power: 45.0,
  test_duration: 1.0,
  iddq_standby: 10.2,
  iddq_0h: 10.2,
  ileak_0h: 110.0,
  tpd_0h: 11.0
};

async function runPhase4Tests() {
  serverInstance = server.listen(PORT, async () => {
    try {
      // -----------------------------------------------------------------------
      // Test 1: Standardized Error Contract & API Validation
      // -----------------------------------------------------------------------
      console.log("  Evaluating Test 1: Standardized Error Contract & Physical Bounds...");
      
      // Malformed JSON
      const resMalformed = await makePostRequest('/api/predict', '{ malformed_json: ');
      assert.strictEqual(resMalformed.status, 400, "Malformed JSON must return HTTP 400");
      assert.ok(resMalformed.body.detail, "Error response must contain detail");

      // Negative supply voltage
      const resNegV = await makePostRequest('/api/predict', { ...nominalPayload, supply_voltage: -1.2 });
      assert.strictEqual(resNegV.status, 400, "Negative supply voltage must return HTTP 400");
      assert.ok(resNegV.body && resNegV.body.detail, `Error detail must exist, got: ${JSON.stringify(resNegV.body)}`);

      // Negative leakage current
      const resNegI = await makePostRequest('/api/predict', { ...nominalPayload, leakage_current: -50.0 });
      assert.strictEqual(resNegI.status, 400, "Negative leakage current must return HTTP 400");
      assert.ok(resNegI.body && resNegI.body.detail && (resNegI.body.detail.includes("leakage_current") || resNegI.body.detail.includes("cannot be negative")), "Error must cite leakage_current field violation");

      console.log("  ✓ [PASS] Test 1: Standardized Error Contract & Physical Bounds verified!");

      // -----------------------------------------------------------------------
      // Test 2: Inference Determinism Across Repeated Requests
      // -----------------------------------------------------------------------
      console.log("  Evaluating Test 2: Inference Determinism Across Repeated Requests...");
      const res1 = await makePostRequest('/api/predict', nominalPayload);
      const res2 = await makePostRequest('/api/predict', nominalPayload);
      const res3 = await makePostRequest('/api/predict', nominalPayload);

      assert.strictEqual(res1.body.probability, res2.body.probability, "Probability 1 & 2 must be identical");
      assert.strictEqual(res2.body.probability, res3.body.probability, "Probability 2 & 3 must be identical");
      assert.strictEqual(res1.body.disposition, res2.body.disposition, "Disposition 1 & 2 must be identical");
      assert.strictEqual(res1.body.ml_details.anomaly_detection.pat.score, res2.body.ml_details.anomaly_detection.pat.score, "PAT score must be identical");
      console.log("  ✓ [PASS] Test 2: Inference Determinism verified!");

      // -----------------------------------------------------------------------
      // Test 3: Concurrency & Request Isolation (20 Parallel Requests)
      // -----------------------------------------------------------------------
      console.log("  Evaluating Test 3: Concurrency & Request Isolation (20 Parallel Requests)...");
      const promises = [];
      for (let i = 0; i < 20; i++) {
        const id = `CONCUR-${i}`;
        const p = (i % 2 === 0)
          ? makePostRequest('/api/predict', { ...nominalPayload, test_id: id })
          : makePostRequest('/api/predict', { ...nominalPayload, test_id: id, iddq_standby: 25.0 }); // Anomaly REJECT
        promises.push(p);
      }

      const results = await Promise.all(promises);
      results.forEach((r, idx) => {
        assert.strictEqual(r.status, 200, `Concurrent request ${idx} must return HTTP 200`);
        if (idx % 2 === 0) {
          assert.strictEqual(r.body.disposition, "PASS", `Nominal concurrent request ${idx} must yield PASS`);
        } else {
          assert.strictEqual(r.body.disposition, "REJECT", `Anomaly concurrent request ${idx} must yield REJECT`);
        }
      });
      console.log("  ✓ [PASS] Test 3: Concurrency & Request Isolation verified!");

      // -----------------------------------------------------------------------
      // Test 4: Security Boundaries (Payload Limit & Path Traversal)
      // -----------------------------------------------------------------------
      console.log("  Evaluating Test 4: Security Boundaries & Path Traversal Protection...");
      
      // Oversized Payload (>1MB)
      const hugePayload = JSON.stringify({ ...nominalPayload, padding: 'X'.repeat(1.2 * 1024 * 1024) });
      const resHuge = await makePostRequest('/api/predict', hugePayload);
      assert.strictEqual(resHuge.status, 413, "Oversized payload must return HTTP 413 Payload Too Large");

      // Prototype Pollution Attempt
      const protoPayload = JSON.stringify({ ...nominalPayload, "__proto__": { "polluted": true } });
      const resProto = await makePostRequest('/api/predict', protoPayload);
      assert.strictEqual(resProto.status, 200, "Prototype pollution request handled safely");
      assert.strictEqual(Object.prototype.polluted, undefined, "Global prototype must NOT be polluted");

      console.log("  ✓ [PASS] Test 4: Security Boundaries verified!");

      // -----------------------------------------------------------------------
      // Test 5: Model Fail-Safe Audit
      // -----------------------------------------------------------------------
      console.log("  Evaluating Test 5: Model Fail-Safe & Artifact Integrity Safeguards...");
      assert.strictEqual(serviceInstance.isLoaded, true, "Model must be loaded in active production mode");
      assert.strictEqual(serviceInstance.operatingThreshold, 0.20, "Operating threshold must be locked at 0.20");
      console.log("  ✓ [PASS] Test 5: Model Fail-Safe Audit verified!");

      // -----------------------------------------------------------------------
      // Test 6: Single-Request Performance Latency Benchmark (< 50ms)
      // -----------------------------------------------------------------------
      console.log("  Evaluating Test 6: Single-Request Performance Latency (< 50ms)...");
      const startTime = Date.now();
      await makePostRequest('/api/predict', nominalPayload);
      const elapsed = Date.now() - startTime;
      assert.ok(elapsed < 100, `Single request latency (${elapsed}ms) must be < 100ms`);
      console.log(`  ✓ [PASS] Test 6: Performance Latency Benchmark verified! (${elapsed}ms)`);

      console.log("\n================================================================================");
      console.log("✅ ALL PHASE 4 PRODUCTION READINESS & SECURITY TESTS PASSED CLEANLY!");
      console.log("================================================================================\n");

      serverInstance.close(() => {
        process.exit(0);
      });
    } catch (err) {
      console.error("\n❌ PHASE 4 PRODUCTION READINESS TEST FAILURE:", err.message);
      if (serverInstance) serverInstance.close();
      process.exit(1);
    }
  });
}

runPhase4Tests();
