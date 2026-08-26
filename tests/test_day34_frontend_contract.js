/**
 * Predicta Day 34 — Frontend Contract Test Suite
 * File: tests/test_day34_frontend_contract.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log("=========================================================================");
console.log("PREDICTA DAY 34 — FRONTEND CONTRACT TEST SUITE");
console.log("=========================================================================\n");

const htmlPath = path.join(__dirname, '../frontend/index.html');
const cssPath = path.join(__dirname, '../frontend/style.css');

const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

assert.ok(htmlContent.includes('Predicta XGBoost v2.0'), "[1] Production model label present in HTML");
assert.ok(htmlContent.includes('id="res-shadow-card"'), "[2] Research shadow card container present");
assert.ok(cssContent.includes('prefers-reduced-motion'), "[3] Reduced motion accessibility query present in CSS");

console.log("✔ Test 01 Passed: Frontend HTML & CSS structure contracts verified");

console.log("\n=========================================================================");
console.log("ALL DAY 34 FRONTEND CONTRACT TESTS PASSED! ✅");
console.log("=========================================================================\n");
