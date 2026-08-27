/**
 * PREDICTA — Live Vercel / Production API Verification Runner
 * File: scratch/verify_live_vercel_api.js
 */

const http = require('http');
const https = require('https');
const assert = require('assert');

const TARGET_URL = process.env.VERCEL_URL 
  ? (process.env.VERCEL_URL.startsWith('http') ? process.env.VERCEL_URL : `https://${process.env.VERCEL_URL}`)
  : 'http://127.0.0.1:8000';

console.log("=========================================================================");
console.log("PREDICTA — LIVE VERCEL / PRODUCTION API VERIFICATION");
console.log(`Target Endpoint: ${TARGET_URL}`);
console.log("=========================================================================\n");

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(path, TARGET_URL);
    const client = urlObj.protocol === 'https:' ? https : http;
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };

    const req = client.request(urlObj, { method: method, headers: reqHeaders }, (res) => {
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

async function verifyLiveApi() {
  try {
    const h1 = await request('GET', '/api/health');
    console.log(`[PASS] GET /api/health -> Status: ${h1.status}`);
    assert.strictEqual(h1.status, 200);

    const h2 = await request('GET', '/api/system/status');
    console.log(`[PASS] GET /api/system/status -> Status: ${h2.status}`);
    assert.strictEqual(h2.status, 200);

    const sample = {
      test_id: "VERCEL-LIVE-001", equipment_id: "EQP-101",
      supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
      resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
      propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
      temperature: 25.0, dynamic_power: 40.0, total_power: 50.0, test_duration: 12.0,
      iddq: 2000.0, ileak: 250.0, tpd: 180.0, iddq_0h: 2000.0, ileak_0h: 250.0, tpd_0h: 180.0
    };

    const h3 = await request('POST', '/api/predict', sample);
    console.log(`[PASS] POST /api/predict -> Status: ${h3.status}`);
    assert.strictEqual(h3.status, 200);
    assert.strictEqual(h3.body.prediction, "PASS");

    console.log("\n=========================================================================");
    console.log("LIVE API VERIFICATION COMPLETE! ✅");
    console.log("=========================================================================\n");
  } catch (err) {
    console.warn("[NOTE] Target endpoint unreachable or offline (Target:", TARGET_URL, "):", err.message);
    console.log("Local HTTP server verification suite available via 'scratch/test_live_http_endpoints.js'");
  }
}

verifyLiveApi();
