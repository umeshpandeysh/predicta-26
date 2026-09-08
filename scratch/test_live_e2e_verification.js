/**
 * PREDICTA — Live Production End-to-End Verification
 * File: scratch/test_live_e2e_verification.js
 */

const https = require('https');
const assert = require('assert');

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseBody) });
        } catch(e) {
          resolve({ status: res.statusCode, raw: responseBody });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function verifyLiveProduction() {
  console.log("=========================================================================");
  console.log("LIVE PRODUCTION E2E VERIFICATION — https://ceenew.vercel.app");
  console.log("=========================================================================\n");

  const nominalPayload = {
    test_id: "LIVE-QUAL-TEST-001",
    equipment_id: "EQP-101",
    supply_voltage: 1.20,
    output_voltage: 1.20,
    current: 40.0,
    iddq_standby: 10.2,
    leakage_current: 110.0,
    propagation_delay: 11.0,
    resistance: 10.0,
    capacitance: 5.0,
    threshold_voltage: 0.45,
    frequency: 2500.0,
    setup_time: 1.5,
    hold_time: 1.0,
    timing_margin: 2.5,
    temperature: 25.0,
    dynamic_power: 50.0,
    total_power: 50.0,
    test_duration: 10.0
  };

  const res = await postJson("https://ceenew.vercel.app/api/predict", nominalPayload);
  console.log("Live API Response Status:", res.status);
  console.log("Live API Output:", JSON.stringify(res.data, null, 2));

  assert.strictEqual(res.status, 200, "API return code must be 200");
  assert.strictEqual(res.data.disposition, "PASS", "Nominal component disposition must be PASS");
  assert.strictEqual(res.data.anomaly_status, "NORMAL", "Nominal component anomaly status must be NORMAL");
  assert.strictEqual(res.data.drift_status, "WITHIN", "Nominal component drift status must be WITHIN");
  assert.ok(res.data.probability < 0.20, "Probability must be < 0.20");

  console.log("\n✔ LIVE PRODUCTION VERIFICATION PASSED 100% CLEANLY! ✅\n");
}

verifyLiveProduction().catch(err => {
  console.error("❌ Live verification failed:", err);
  process.exit(1);
});
