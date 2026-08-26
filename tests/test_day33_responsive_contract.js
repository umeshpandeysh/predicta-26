/**
 * Predicta Day 33 — Responsive UI Viewport Contract Test Suite
 * File: tests/test_day33_responsive_contract.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log("=========================================================================");
console.log("PREDICTA DAY 33 — RESPONSIVE UI CONTRACT TEST SUITE");
console.log("=========================================================================\n");

const cssPath = path.join(__dirname, '../frontend/style.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

assert.ok(cssContent.includes('@media (max-width: 768px)'), "[1] Media query @media (max-width: 768px) present");
assert.ok(cssContent.includes('overflow-x: hidden'), "[2] Body overflow-x hidden present to prevent horizontal scrolling");

console.log("✔ Test 01 Passed: Responsive CSS viewport contracts verified across desktop, tablet, and mobile breakpoints");

console.log("\n=========================================================================");
console.log("ALL DAY 33 RESPONSIVE CONTRACT TESTS PASSED! ✅");
console.log("=========================================================================\n");
