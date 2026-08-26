/**
 * Predicta Day 34 — Responsive Contract Test Suite
 * File: tests/test_day34_responsive_contract.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log("=========================================================================");
console.log("PREDICTA DAY 34 — RESPONSIVE CONTRACT TEST SUITE");
console.log("=========================================================================\n");

const cssPath = path.join(__dirname, '../frontend/style.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

assert.ok(cssContent.includes('@media (max-width: 768px)'), "[1] Breakpoint @media (max-width: 768px) present");

console.log("✔ Test 01 Passed: Responsive breakpoint contracts verified");

console.log("\n=========================================================================");
console.log("ALL DAY 34 RESPONSIVE CONTRACT TESTS PASSED! ✅");
console.log("=========================================================================\n");
