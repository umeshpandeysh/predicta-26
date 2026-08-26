/**
 * Predicta Day 25 — UI Data Integrity & Secrets Audit Test Suite
 * File: tests/test_ui_data_integrity.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log("=========================================================================");
console.log("PREDICTA DAY 25 — UI DATA INTEGRITY & SECRETS TEST SUITE");
console.log("=========================================================================\n");

const frontendDir = path.join(__dirname, '../frontend');
const frontendFiles = fs.readdirSync(frontendDir).filter(f => f.endsWith('.js') || f.endsWith('.html'));

const forbiddenStrings = ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "service_role", "SECRET_KEY"];

frontendFiles.forEach(file => {
  const content = fs.readFileSync(path.join(frontendDir, file), 'utf-8');
  forbiddenStrings.forEach(str => {
    assert.strictEqual(content.includes(str), false, `SECURITY VIOLATION: Secret string '${str}' found in frontend file ${file}`);
  });
});

console.log("✔ Test 01 Passed: Frontend JS & HTML bundles contain ZERO service role or secret credentials");

console.log("\n=========================================================================");
console.log("ALL DAY 25 UI DATA INTEGRITY TESTS PASSED! ✅");
console.log("=========================================================================\n");
