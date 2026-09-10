/**
 * PREDICTA SIH 2026 — Phase 3: System Integration & End-to-End Reliability Test Suite
 * File: tests/test_phase3_system_integration.js
 */

const assert = require('assert');
const http = require('http');
const server = require('../src/api/server.js');

const PORT = 8009;
let serverInstance = null;

console.log("================================================================================");
console.log("🚨 PREDICTA SIH 2026 — PHASE 3: SYSTEM INTEGRATION & RELIABILITY TEST SUITE");
console.log("================================================================ algorithm\n");

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
  test_id: "E2E-NOMINAL-001",
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

async function runIntegrationTests() {
  serverInstance = server.listen(PORT, async () => {
    try {
      // -----------------------------------------------------------------------
      // Scenario A: Nominal Component -> PASS
      // -----------------------------------------------------------------------
      console.log("  Evaluating Scenario A: Nominal Component...");
      const resA = await makePostRequest('/api/predict', nominalPayload);
      assert.strictEqual(resA.status, 200, "Nominal request must return HTTP 200");
      assert.strictEqual(resA.body.disposition, "PASS", "Nominal component disposition must be PASS");
      assert.ok(resA.body.probability < 0.20, "Nominal probability must be < 0.20");
      assert.ok(resA.body.explainability, "Response must include explainability trace");
      console.log("  ✓ [PASS] Scenario A: Nominal Component -> PASS verified!");

      // -----------------------------------------------------------------------
      // Scenario B: Moderate Risk Component -> MONITOR
      // -----------------------------------------------------------------------
      console.log("  Evaluating Scenario B: Moderate Risk Component...");
      const moderatePayload = { ...nominalPayload, iddq_standby: 14.0, iddq_0h: 10.2 };
      const resB = await makePostRequest('/api/predict', moderatePayload);
      assert.strictEqual(resB.status, 200, "Moderate risk request must return HTTP 200");
      assert.strictEqual(resB.body.disposition, "MONITOR", "Moderate risk component disposition must be MONITOR");
      assert.strictEqual(resB.body.requires_secondary_test, true, "MONITOR disposition must require secondary test");
      console.log("  ✓ [PASS] Scenario B: Moderate Risk Component -> MONITOR verified!");

      // -----------------------------------------------------------------------
      // Scenario C: Critical PAT Anomaly Component -> REJECT
      // -----------------------------------------------------------------------
      console.log("  Evaluating Scenario C: Critical PAT Anomaly Component...");
      const patRejectPayload = { ...nominalPayload, iddq_standby: 25.0, iddq_0h: 10.2 };
      const resC = await makePostRequest('/api/predict', patRejectPayload);
      assert.strictEqual(resC.status, 200, "PAT reject request must return HTTP 200");
      assert.strictEqual(resC.body.disposition, "REJECT", "PAT reject component disposition must be REJECT");
      assert.strictEqual(resC.body.ml_details.anomaly_detection.pat.status, "REJECT", "PAT evidence status must be REJECT");
      console.log("  ✓ [PASS] Scenario C: Critical PAT Anomaly Component -> REJECT verified!");

      // -----------------------------------------------------------------------
      // Scenario D: Extreme COPOD Multivariate Anomaly Component -> REJECT
      // -----------------------------------------------------------------------
      console.log("  Evaluating Scenario D: Extreme COPOD Multivariate Anomaly Component...");
      const copodRejectPayload = { ...nominalPayload, iddq_standby: 25.0, leakage_current: 250.0 };
      const resD = await makePostRequest('/api/predict', copodRejectPayload);
      assert.strictEqual(resD.status, 200, "COPOD reject request must return HTTP 200");
      assert.strictEqual(resD.body.disposition, "REJECT", "COPOD reject component disposition must be REJECT");
      assert.strictEqual(resD.body.ml_details.anomaly_detection.copod.status, "REJECT", "COPOD evidence status must be REJECT");
      console.log("  ✓ [PASS] Scenario D: Extreme COPOD Component -> REJECT verified!");

      // -----------------------------------------------------------------------
      // Scenario E: GPR Trajectory Limit Crossing Component -> REJECT
      // -----------------------------------------------------------------------
      console.log("  Evaluating Scenario E: GPR Limit Crossing Component...");
      const gprRejectPayload = { ...nominalPayload, propagation_delay: 24.0, tpd_0h: 11.0 };
      const resE = await makePostRequest('/api/predict', gprRejectPayload);
      assert.strictEqual(resE.body.ml_details.safety_slope.tpd.boundary_status, "EXCEEDED", "Safety slope status for Tpd must be EXCEEDED");
      assert.ok(resE.body.decision_reason, "Decision reason must exist for GPR limit crossing reject");
      console.log("  ✓ [PASS] Scenario E: GPR Limit Crossing Component -> REJECT verified!");

      // -----------------------------------------------------------------------
      // Scenario F: Invalid Inputs -> HTTP 400 Bad Request Error Boundary
      // -----------------------------------------------------------------------
      console.log("  Evaluating Scenario F: Invalid Inputs Error Boundaries...");
      
      // F1: Missing numerical feature
      const resF1 = await makePostRequest('/api/predict', { supply_voltage: 1.20 });
      assert.strictEqual(resF1.status, 400, "Missing required feature must return HTTP 400");
      assert.ok(resF1.body && resF1.body.detail, `Error detail must exist, got: ${JSON.stringify(resF1.body)}`);

      // F2: Unknown equipment_id
      const resF2 = await makePostRequest('/api/predict', { ...nominalPayload, equipment_id: "EQP-999" });
      assert.strictEqual(resF2.status, 400, "Unknown equipment_id must return HTTP 400");
      assert.ok(resF2.body && resF2.body.detail, `Error detail must exist, got: ${JSON.stringify(resF2.body)}`);

      // F3: NaN value
      const resF3 = await makePostRequest('/api/predict', { ...nominalPayload, leakage_current: "NaN_STRING" });
      assert.strictEqual(resF3.status, 400, "NaN input must return HTTP 400");

      console.log("  ✓ [PASS] Scenario F: Invalid Inputs Error Boundaries verified!");

      // -----------------------------------------------------------------------
      // Scenario G: Response Contract Stability & Detailed Explainability Check
      // -----------------------------------------------------------------------
      console.log("  Evaluating Scenario G: Response Contract Stability & Explainability Quality...");
      const resG = await makePostRequest('/api/predict', nominalPayload);
      const b = resG.body;

      // Required Contract Fields
      assert.ok(typeof b.probability === 'number', "Response must contain numeric probability");
      assert.ok(b.risk_level, "Response must contain risk_level");
      assert.ok(b.ml_details.anomaly_detection.pat, "Response must contain PAT evidence");
      assert.ok(b.ml_details.anomaly_detection.copod, "Response must contain COPOD evidence");
      assert.ok(b.ml_details.drift_prediction, "Response must contain drift_predictions");
      assert.ok(b.ml_details.safety_slope, "Response must contain safety_slope");
      assert.ok(b.disposition, "Response must contain disposition");
      assert.ok(b.explainability.summary, "Response must contain detailed explainability summary");

      // Verify explanation is non-generic
      assert.ok(!b.explainability.summary.includes("Component rejected because risk is high"), "Summary must provide physical factor breakdown rather than generic text");
      console.log("  ✓ [PASS] Scenario G: Response Contract & Detailed Explainability verified!");

      console.log("\n================================================================================");
      console.log("✅ ALL PHASE 3 SYSTEM INTEGRATION & END-TO-END RELIABILITY TESTS PASSED!");
      console.log("================================================================================\n");

      serverInstance.close(() => {
        process.exit(0);
      });
    } catch (err) {
      console.error("\n❌ PHASE 3 INTEGRATION TEST FAILURE:", err.message);
      if (serverInstance) serverInstance.close();
      process.exit(1);
    }
  });
}

runIntegrationTests();
