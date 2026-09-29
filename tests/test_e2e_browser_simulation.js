/**
 * End-to-End Browser & Application Verification Script
 * File: tests/test_e2e_browser_simulation.js
 */

const http = require('http');
const assert = require('assert');

async function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:8000' + path, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    }).on('error', reject);
  });
}

async function httpPost(path, payload, token = null) {
  return new Promise((resolve, reject) => {
    const dataStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(dataStr)
    };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const req = http.request({
      hostname: 'localhost',
      port: 8000,
      path: path,
      method: 'POST',
      headers
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });

    req.on('error', reject);
    req.write(dataStr);
    req.end();
  });
}

async function runSimulation() {
  console.log("=========================================================================");
  console.log("PREDICTA-26 — LIVE END-TO-END APPLICATION VERIFICATION");
  console.log("=========================================================================\n");

  let total = 0;
  let passed = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✔ Test ${total} Passed: ${name} ✅`);
      passed++;
    } catch (e) {
      console.error(`✖ Test ${total} FAILED: ${name}`);
      console.error(`  Error: ${e.message}`);
    }
  }

  // 1. Fetch served index.html
  const indexRes = await httpGet('/');
  test("Server serves index.html at root with HTTP 200", () => {
    assert.strictEqual(indexRes.status, 200);
    assert.ok(indexRes.body.includes('PREDICTA-26'));
  });

  // 2. Verify all 6 pages exist in served HTML
  test("All 6 major application pages exist in served HTML", () => {
    assert.ok(indexRes.body.includes('id="page-home"'));
    assert.ok(indexRes.body.includes('id="page-screening"'));
    assert.ok(indexRes.body.includes('id="page-overview"'));
    assert.ok(indexRes.body.includes('id="page-component"'));
    assert.ok(indexRes.body.includes('id="page-judge-journey"'));
    assert.ok(indexRes.body.includes('id="page-advanced"'));
  });

  // 3. Verify all 8 pipeline stage cards exist in served HTML
  test("All 8 explicit pipeline stages exist in served HTML", () => {
    const stageIds = [
      'pipe-input-status', 'pipe-dq-status', 'pipe-mod-a-status', 'pipe-mod-b-status',
      'pipe-risk-status', 'pipe-physics-status', 'pipe-decision-status', 'pipe-trace-status'
    ];
    for (const sid of stageIds) {
      assert.ok(indexRes.body.includes(`id="${sid}"`), `Missing ${sid}`);
    }
  });

  // 4. Verify Purge of Admin Login & SIH Marketing
  test("Served HTML completely purges Admin Login and SIH Hero marketing", () => {
    assert.ok(!indexRes.body.includes('Admin Login'));
    assert.ok(!indexRes.body.includes('form-admin-login'));
    assert.ok(!indexRes.body.includes('Smart India Hackathon 2026'));
    assert.ok(!indexRes.body.includes('Problem Statement 170'));
  });

  // 5. Test Auth Session Negotiation
  const sessionRes = await httpGet('/api/auth/session');
  let token = null;
  test("Session endpoint returns valid signed operator token", () => {
    assert.strictEqual(sessionRes.status, 200);
    const json = JSON.parse(sessionRes.body);
    assert.strictEqual(json.authenticated, true);
    assert.strictEqual(json.role, 'OPERATOR');
    assert.ok(json.token && json.token.length > 20);
    token = json.token;
  });

  // 6. Test Single Qualification Inference with Derived Physical Features
  const testRecord = {
    test_id: 'QUAL-DIE-R20C20-TEST',
    component_id: 'DIE-R20C20',
    lot_id: 'LOT-SYN-043',
    wafer_id: 'WFR-2026-01',
    equipment_id: 'EQP-101',
    leakage_current: 111.7,
    temperature: 25.0,
    propagation_delay: 10.98,
    dynamic_power: 40.0,
    supply_voltage: 1.2,
    frequency: 2500,
    iddq_standby: 10.7,
    output_voltage: 1.18,
    current: 40.0,
    resistance: 12.0,
    capacitance: 4.0,
    threshold_voltage: 0.45,
    setup_time: 1.15,
    hold_time: 0.84,
    timing_margin: 2.09,
    total_power: 40.01,
    test_duration: 24.0
  };

  const predictRes = await httpPost('/api/predict', testRecord, token);
  test("Inference API processes full qualification payload and returns governed decision", () => {
    assert.strictEqual(predictRes.status, 200);
    const json = JSON.parse(predictRes.body);
    assert.strictEqual(json.prediction, 'PASS');
    assert.ok(json.probability < 0.20, `Probability was ${json.probability}`);
    assert.strictEqual(json.disposition, 'PASS');
  });

  // 7. Test Defective Die Inference
  const defectRecord = {
    test_id: 'QUAL-DIE-R05C12-DEFECT',
    component_id: 'DIE-R05C12',
    lot_id: 'LOT-SYN-044',
    wafer_id: 'WFR-2026-01',
    equipment_id: 'EQP-102',
    leakage_current: 420.5,
    temperature: 85.0,
    propagation_delay: 18.45,
    dynamic_power: 78.5,
    supply_voltage: 1.45,
    frequency: 2800,
    iddq_standby: 45.2,
    output_voltage: 1.43,
    current: 48.33,
    resistance: 9.93,
    capacitance: 4.0,
    threshold_voltage: 0.402,
    setup_time: 1.93,
    hold_time: 0.5,
    timing_margin: 1.25,
    total_power: 78.57,
    test_duration: 24.0
  };

  const defectRes = await httpPost('/api/predict', defectRecord, token);
  test("Inference API correctly flags defective die as REJECT / CRITICAL", () => {
    assert.strictEqual(defectRes.status, 200);
    const json = JSON.parse(defectRes.body);
    assert.strictEqual(json.prediction, 'FAIL');
    assert.ok(json.probability >= 0.20, `Probability was ${json.probability}`);
    assert.strictEqual(json.disposition, 'REJECT');
    assert.strictEqual(json.risk_level, 'CRITICAL');
  });

  // 8. Test Components Matrix endpoint
  const compRes = await httpGet('/api/components');
  test("Components API returns canonical lot components inventory", () => {
    assert.strictEqual(compRes.status, 200);
    const json = JSON.parse(compRes.body);
    assert.ok(json.total > 0);
    assert.ok(Array.isArray(json.components));
    const r20 = json.components.find(c => c.component_id === 'DIE-R20C20');
    assert.ok(r20, "Missing DIE-R20C20 in components list");
  });

  // 9. Test Live Monitor Replay endpoint
  const replayRes = await httpGet('/api/live-monitor/replay?component_id=DIE-R20C20&lot_id=LOT-SYN-043');
  test("Live Monitor Replay API returns 168h trajectory observations", () => {
    assert.strictEqual(replayRes.status, 200);
    const json = JSON.parse(replayRes.body);
    assert.strictEqual(json.component_id, 'DIE-R20C20');
    assert.ok(Array.isArray(json.frames));
    assert.ok(json.frames.length >= 4);
  });

  // 10. Test Judge Journey Data endpoint
  const judgeRes = await httpGet('/api/judge-journey');
  test("Judge Journey API returns 8-stage qualification roadmap", () => {
    assert.strictEqual(judgeRes.status, 200);
    const json = JSON.parse(judgeRes.body);
    assert.strictEqual(json.total_stages, 8);
    assert.ok(Array.isArray(json.stages));
  });

  console.log("\n=========================================================================");
  console.log(`RESULTS: ${passed}/${total} LIVE END-TO-END TESTS PASSED!`);
  console.log("=========================================================================\n");

  if (passed !== total) process.exit(1);
}

runSimulation();
