/**
 * Predicta Phase 2 — No Duplicate Admin Qualification Implementations Test
 * File: tests/test_no_duplicate_admin_impl.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("[TEST] Checking script.js for duplicate Admin Qualification implementations...");

const scriptPath = path.join(__dirname, '../script.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

function countOccurrences(str, regex) {
  const matches = str.match(regex);
  return matches ? matches.length : 0;
}

const initMatches = countOccurrences(scriptContent, /\bfunction\s+initAdminInputPortal\b/g);
const updateMatches = countOccurrences(scriptContent, /\bfunction\s+updateQualificationResultUI\b/g);
const resetMatches = countOccurrences(scriptContent, /\bfunction\s+resetAdminQualificationWorkflow\b/g);
const getNumericMatches = countOccurrences(scriptContent, /\bfunction\s+getNumericInput\b/g);

console.log(`- function initAdminInputPortal: ${initMatches}`);
console.log(`- function updateQualificationResultUI: ${updateMatches}`);
console.log(`- function resetAdminQualificationWorkflow: ${resetMatches}`);
console.log(`- function getNumericInput: ${getNumericMatches}`);

assert.strictEqual(initMatches, 1, `Found ${initMatches} definitions of function initAdminInputPortal in script.js (expected 1).`);
assert.strictEqual(updateMatches, 1, `Found ${updateMatches} definitions of function updateQualificationResultUI in script.js (expected 1).`);
assert.strictEqual(resetMatches, 1, `Found ${resetMatches} definitions of function resetAdminQualificationWorkflow in script.js (expected 1).`);
assert.strictEqual(getNumericMatches, 1, `Found ${getNumericMatches} definitions of function getNumericInput in script.js (expected 1).`);

console.log("[PASS] No Duplicate Admin Qualification Implementations Found!");
