/**
 * Predicta Day 32 — Browser UI Inference Contract Test Suite
 * File: tests/test_day32_browser_inference.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ateSim = require('../src/simulation/ate_simulator');

console.log("=========================================================================");
console.log("PREDICTA DAY 32 — BROWSER INFERENCE TEST SUITE");
console.log("=========================================================================\n");

const htmlPath = path.join(__dirname, '../frontend/index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

assert.ok(htmlContent.includes('id="inp-leakage-current"'), "[1] Leakage current input field present");
assert.ok(htmlContent.includes('id="inp-temperature"'), "[2] Temperature input field present");
assert.ok(htmlContent.includes('id="inp-propagation-delay"'), "[3] Propagation delay input field present");

const scenario = ateSim.getDemoScenario("NORMAL");
assert.ok(scenario.leakage_current, "[4] Simulator normal scenario leakage_current field present");

console.log("✔ Test 01 Passed: Browser UI input DOM field contracts verified");
console.log("✔ Test 02 Passed: ATE simulator demo scenarios contract verified");

console.log("\n=========================================================================");
console.log("ALL DAY 32 BROWSER INFERENCE TESTS PASSED! ✅");
console.log("=========================================================================\n");
