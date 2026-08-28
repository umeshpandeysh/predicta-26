/**
 * Predicta Day 29 — Browser Contract Automated Test Suite
 * File: tests/test_browser_contract.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const inf = require('../src/api/inference');
const ateSim = require('../src/simulation/ate_simulator');

console.log("=========================================================================");
console.log("PREDICTA DAY 29 — BROWSER CONTRACT TEST SUITE");
console.log("=========================================================================\n");

// 1. Verify Frontend Asset Structure & Script References
const htmlPath = path.join(__dirname, '../frontend/index.html');
assert.ok(fs.existsSync(htmlPath), "[1] frontend/index.html must exist");

const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
assert.ok(htmlContent.includes('style.css'), "[2] index.html must reference style.css");
assert.ok(htmlContent.includes('api.js') || htmlContent.includes('script.js'), "[3] index.html must reference client script");
console.log("✔ Test 01 Passed: Frontend HTML5 structure & stylesheet/script assets verified");

// 2. Verify Key Form Input Field IDs in HTML
const requiredInputIds = [
  "inp-supply-voltage", "inp-output-voltage", "inp-current", "inp-leakage-current",
  "inp-resistance", "inp-capacitance", "inp-threshold-voltage", "inp-frequency",
  "inp-propagation-delay", "inp-setup-time", "inp-hold-time", "inp-timing-margin",
  "inp-temperature", "inp-dynamic-power", "inp-total-power", "inp-test-duration"
];
requiredInputIds.forEach(id => {
  assert.ok(htmlContent.includes(`id="${id}"`), `[4] Missing input field ID: ${id}`);
});
console.log("✔ Test 02 Passed: All 16 raw physical telemetry form input IDs present in HTML");

// 3. Verify System Status Contract (Threshold = 0.45, ML Engine ONLINE)
const status = inf.getSystemStatus();
assert.strictEqual(status.api, "ONLINE", "[5] API status must be ONLINE");
assert.strictEqual(status.ml_engine, "ONLINE", "[6] ML Engine status must be ONLINE");
assert.strictEqual(status.threshold, 0.45, "[7] Operating threshold must strictly be 0.45");
console.log("✔ Test 03 Passed: Backend system status contract 100% matches UI requirements");

// 4. Verify 7 Demo Presets Execution via Simulator Service
const scenarios = ["NORMAL", "HIGH_LEAKAGE", "THERMAL_ANOMALY", "TIMING_FAILURE", "EQUIPMENT_DRIFT", "COMBINED_DEFECT", "REVIEW_CASE"];
scenarios.forEach(key => {
  const scenarioData = ateSim.getDemoScenario(key);
  assert.ok(scenarioData, `Missing scenario data for ${key}`);
  const result = inf.predictSingle(scenarioData);
  assert.ok(result.prediction, `Scenario ${key} prediction missing`);
  assert.ok(result.operational_decision, `Scenario ${key} operational decision missing`);
});
console.log("✔ Test 04 Passed: All 7 product demonstration Mode scenarios executed successfully");

console.log("\n=========================================================================");
console.log("ALL DAY 29 BROWSER CONTRACT TESTS PASSED! ✅");
console.log("=========================================================================\n");
