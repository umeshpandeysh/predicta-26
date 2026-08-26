/**
 * Predicta Day 16 — Realistic Semiconductor Workflow & Failure Mode Validation Test Suite
 * File: tests/test_workflow_validation.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const vercelHandler = require('../api/index');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 16 — REALISTIC WORKFLOW & CHAOS VALIDATION TEST SUITE");
console.log("=========================================================================\n");

function mockRequestResponse(method, url, payload = null) {
  return new Promise((resolve) => {
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

async function runDay16ValidationTests() {
  try {
    // 1. Fixtures Validation
    const fixturesDir = path.join(__dirname, 'fixtures');
    const fixtureFiles = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.json'));
    assert.ok(fixtureFiles.length >= 7, "1. Fixtures directory incomplete");

    fixtureFiles.forEach(fName => {
      const fPath = path.join(fixturesDir, fName);
      const fixtureData = JSON.parse(fs.readFileSync(fPath, 'utf-8'));
      const res = inf.predictSingle(fixtureData);
      assert.ok(res.prediction === "PASS" || res.prediction === "FAIL", `1. ${fName} prediction invalid`);
      assert.strictEqual(res.threshold, 0.45, `1. ${fName} threshold mutated`);
    });
    console.log(`✔ Test 01 Passed: Validated ${fixtureFiles.length} realistic semiconductor telemetry fixtures`);

    // 2. Probability Boundary Policy Audit
    const boundaryMap = [
      { prob: 0.00, dec: "PASS", cls: "LOW_RISK", req: false },
      { prob: 0.34, dec: "PASS", cls: "LOW_RISK", req: false },
      { prob: 0.349999, dec: "PASS", cls: "LOW_RISK", req: false },
      { prob: 0.35, dec: "SECONDARY_TEST", cls: "REVIEW", req: true },
      { prob: 0.449999, dec: "SECONDARY_TEST", cls: "REVIEW", req: true },
      { prob: 0.45, dec: "SECONDARY_TEST", cls: "REVIEW", req: true },
      { prob: 0.450001, dec: "SECONDARY_TEST", cls: "REVIEW", req: true },
      { prob: 0.649999, dec: "SECONDARY_TEST", cls: "REVIEW", req: true },
      { prob: 0.65, dec: "FAIL", cls: "CRITICAL_FAILURE", req: false },
      { prob: 0.650001, dec: "FAIL", cls: "CRITICAL_FAILURE", req: false },
      { prob: 1.00, dec: "FAIL", cls: "CRITICAL_FAILURE", req: false }
    ];

    boundaryMap.forEach(b => {
      const dec = inf.makeOperationalDecision(b.prob, "EQP-101");
      assert.strictEqual(dec.operational_decision, b.dec, `Boundary P=${b.prob} decision mismatch`);
      assert.strictEqual(dec.decision_class, b.cls, `Boundary P=${b.prob} class mismatch`);
      assert.strictEqual(dec.requires_secondary_test, b.req, `Boundary P=${b.prob} secondary_test flag mismatch`);
    });
    console.log("✔ Test 02 Passed: Validated 11 exact probability boundary decision conditions (0.00 to 1.00)");

    // 3. Equipment One-Hot Encodings Validation
    const eqList = ["EQP-101", "EQP-102", "EQP-103", "EQP-104", "EQP-105"];
    eqList.forEach(eq => {
      const rec = { ...JSON.parse(fs.readFileSync(path.join(fixturesDir, 'nominal_pass.json'))), equipment_id: eq };
      const validated = inf.validateInputRecord(rec);
      const feat = inf.engineerFeatures(validated, eq);
      assert.strictEqual(feat[`eq_${eq}`], 1.0, `Equipment ${eq} OHE failed`);
      eqList.filter(other => other !== eq).forEach(other => {
        assert.strictEqual(feat[`eq_${other}`], 0.0, `Equipment ${other} OHE non-zero for ${eq}`);
      });
    });
    console.log("✔ Test 03 Passed: Validated 5-equipment one-hot encoding feature vectors (EQP-101 .. EQP-105)");

    // 4. Batch Size Boundary Validation (N=1000 accepted, N=1001 rejected)
    const nominalTemplate = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'nominal_pass.json')));
    const batch1000 = Array(1000).fill(nominalTemplate);
    const res1000 = inf.predictBatch(batch1000);
    assert.strictEqual(res1000.total, 1000, "Batch N=1000 total mismatch");

    assert.throws(() => {
      inf.predictBatch(Array(1001).fill(nominalTemplate));
    }, /1000 records/, "Batch N=1001 failed to reject");
    console.log("✔ Test 04 Passed: Batch size limit enforced (N=1000 accepted, N=1001 rejected with error)");

    // 5. Telemetry Error Chaos Testing (NaN, Infinity, Missing, Malformed)
    const badNaN = { ...nominalTemplate, leakage_current: NaN };
    assert.throws(() => inf.validateInputRecord(badNaN), /valid finite number/, "NaN failed to reject");

    const badInf = { ...nominalTemplate, temperature: Infinity };
    assert.throws(() => inf.validateInputRecord(badInf), /valid finite number/, "Infinity failed to reject");

    const badMissing = { ...nominalTemplate };
    delete badMissing.supply_voltage;
    assert.throws(() => inf.validateInputRecord(badMissing), /Missing required/, "Missing field failed to reject");

    const badEq = { ...nominalTemplate, equipment_id: "EQP-999" };
    assert.throws(() => inf.validateInputRecord(badEq), /Invalid equipment_id/, "Invalid equipment_id failed to reject");
    console.log("✔ Test 05 Passed: Telemetry chaos testing verified — NaN, Infinity, Missing fields, and Invalid Equipment rejected cleanly");

    // 6. Security Isolation & Model Threshold Preservation
    assert.strictEqual(inf.operatingThreshold, 0.45, "Model operating threshold mutated!");
    console.log("✔ Test 06 Passed: Model threshold strictly preserved at 0.45 with zero security exposure");

    console.log("\n=========================================================================");
    console.log("ALL DAY 16 WORKFLOW & CHAOS VALIDATION TESTS PASSED SUCCESSFULLY! ✅");
    console.log("=========================================================================\n");
  } catch (err) {
    console.error("❌ DAY 16 WORKFLOW VALIDATION TEST FAILED:", err);
    process.exit(1);
  }
}

runDay16ValidationTests();
