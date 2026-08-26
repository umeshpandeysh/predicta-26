/**
 * Predicta Day 34 — Accessibility & UX Contract Test Suite
 * File: tests/test_day34_accessibility.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log("=========================================================================");
console.log("PREDICTA DAY 34 — ACCESSIBILITY & UX CONTRACT TEST SUITE");
console.log("=========================================================================\n");

const htmlPath = path.join(__dirname, '../frontend/index.html');
const cssPath = path.join(__dirname, '../frontend/style.css');

const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

assert.ok(htmlContent.includes('<label'), "[1] HTML contains semantic form labels");
assert.ok(cssContent.includes('prefers-reduced-motion'), "[2] CSS contains prefers-reduced-motion media query");

console.log("✔ Test 01 Passed: Accessibility labels and reduced motion CSS contracts verified");

console.log("\n=========================================================================");
console.log("ALL DAY 34 ACCESSIBILITY TESTS PASSED! ✅");
console.log("=========================================================================\n");
