/**
 * PREDICTA — API ECONNRESET & OVERSIZED PAYLOAD RELIABILITY TEST SUITE
 * File: tests/test_api_econnreset_fix.js
 * 
 * Objective: Verify that oversized requests (>1MB) yield HTTP 413 Payload Too Large
 * WITHOUT destroying socket connection (req.destroy()), and subsequent requests
 * (malformed JSON -> 400, valid payload -> 200) execute cleanly with zero ECONNRESET errors.
 */

const http = require('http');
const server = require('../src/api/server');

const PORT = 8899;
let serverInstance = null;

function makeRequest(options, postData) {
  return new Promise((resolve) => {
    const headers = { ...options.headers };
    if (postData && !headers['Content-Length']) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }
    const req = http.request({ port: PORT, host: '127.0.0.1', ...options, headers }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (e) { json = { raw: body }; }
        resolve({ statusCode: res.statusCode, headers: res.headers, body: json, error: null });
      });
    });

    req.on('error', (err) => resolve({ statusCode: null, headers: null, body: null, error: err.message }));
    if (postData) req.write(postData);
    req.end();
  });
}

async function runApiEconnresetFixTests() {
  console.log("=========================================================================");
  console.log("PREDICTA — API ECONNRESET & OVERSIZED PAYLOAD RELIABILITY TEST SUITE");
  console.log("=========================================================================\n");

  serverInstance = server.listen(PORT);
  await new Promise(r => setTimeout(r, 200));

  const validPayload = JSON.stringify({
    equipment_id: 'EQP-101', supply_voltage: 1.2, output_voltage: 1.18, current: 40.0,
    iddq_standby: 10.2, leakage_current: 110.0, resistance: 12.0, capacitance: 4.0,
    threshold_voltage: 0.40, frequency: 2500.0, propagation_delay: 11.0, setup_time: 1.15,
    hold_time: 0.80, timing_margin: 2.0, temperature: 25.0, dynamic_power: 40.0,
    total_power: 40.01, test_duration: 12.0
  });

  const hugePayload = JSON.stringify({ equipment_id: 'EQP-101', padding: "A".repeat(1.2 * 1024 * 1024) });

  try {
    // Step 1: Valid Request -> HTTP 200
    console.log("Step 1: Sending Valid Request...");
    const res1 = await makeRequest({ path: '/api/predict', method: 'POST' }, validPayload);
    if (res1.error || res1.statusCode !== 200) {
      console.error(`✖ Step 1 Failed! Expected HTTP 200, got: status=${res1.statusCode}, error=${res1.error}`);
      process.exit(1);
    }
    console.log("✔ Step 1 Passed: Valid Request returned HTTP 200 OK ✅");

    // Step 2: Oversized Request (> 1MB) -> HTTP 413
    console.log("\nStep 2: Sending Oversized Request (>1MB)...");
    const res2 = await makeRequest({ path: '/api/predict', method: 'POST' }, hugePayload);
    if (res2.error || res2.statusCode !== 413) {
      console.error(`✖ Step 2 Failed! Expected HTTP 413, got: status=${res2.statusCode}, error=${res2.error}`);
      process.exit(1);
    }
    console.log("✔ Step 2 Passed: Oversized Request returned HTTP 413 Payload Too Large (no socket destruction!) ✅");

    // Step 3: Immediately After Oversized Request: Send Malformed JSON -> HTTP 400 (MUST NOT ECONNRESET!)
    console.log("\nStep 3: Immediately Sending Malformed JSON Request after Oversized Payload...");
    const res3 = await makeRequest({ path: '/api/predict', method: 'POST' }, "{malformed_json_body:");
    if (res3.error) {
      console.error(`✖ Step 3 Failed! Socket error encountered: ${res3.error} (ECONNRESET/socket hang up detected!)`);
      process.exit(1);
    }
    if (res3.statusCode !== 400) {
      console.error(`✖ Step 3 Failed! Expected HTTP 400, got: status=${res3.statusCode}`);
      process.exit(1);
    }
    console.log("✔ Step 3 Passed: Malformed JSON returned HTTP 400 Bad Request (Zero ECONNRESET / socket hangup!) ✅");

    // Step 4: Immediately After Malformed JSON: Send Valid Request -> HTTP 200
    console.log("\nStep 4: Immediately Sending Valid Request after Malformed JSON...");
    const res4 = await makeRequest({ path: '/api/predict', method: 'POST' }, validPayload);
    if (res4.error || res4.statusCode !== 200) {
      console.error(`✖ Step 4 Failed! Expected HTTP 200, got: status=${res4.statusCode}, error=${res4.error}`);
      process.exit(1);
    }
    console.log("✔ Step 4 Passed: Subsequent Valid Request returned HTTP 200 OK ✅");

    // Step 5: Edge Case — Explicit Oversized Content-Length Header
    console.log("\nStep 5: Testing Explicit Oversized Content-Length Header...");
    const res5 = await makeRequest({ path: '/api/predict', method: 'POST', headers: { 'Content-Length': Buffer.byteLength(hugePayload) } }, hugePayload);
    if (res5.error || res5.statusCode !== 413) {
      console.error(`✖ Step 5 Failed! Expected HTTP 413, got: status=${res5.statusCode}, error=${res5.error}`);
      process.exit(1);
    }
    console.log("✔ Step 5 Passed: Explicit Content-Length header returned HTTP 413 without crashing ✅");

    // Step 6: Edge Case — Multiple Consecutive Oversized Requests
    console.log("\nStep 6: Testing Multiple Consecutive Oversized Requests...");
    for (let i = 0; i < 3; i++) {
      const resSeq = await makeRequest({ path: '/api/predict', method: 'POST' }, hugePayload);
      if (resSeq.error || resSeq.statusCode !== 413) {
        console.error(`✖ Step 6 Iteration ${i + 1} Failed! Got status=${resSeq.statusCode}, error=${resSeq.error}`);
        process.exit(1);
      }
    }
    console.log("✔ Step 6 Passed: Consecutive oversized requests handled cleanly without degrading server ✅");

  } finally {
    serverInstance.close();
  }

  console.log("\n=========================================================================");
  console.log("ALL API ECONNRESET & RELIABILITY REGRESSION TESTS PASSED! ✅");
  console.log("=========================================================================\n");
}

runApiEconnresetFixTests();
