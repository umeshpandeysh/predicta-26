/**
 * Predicta Day 17 — Industrial Operator Workflow & Audit Trail Test Suite
 * File: tests/test_operator_workflow.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 17 — INDUSTRIAL OPERATOR WORKFLOW TEST SUITE");
console.log("=========================================================================\n");

const fs = require('fs');
const path = require('path');

const fixturesDir = path.join(__dirname, 'fixtures');
const recPass = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'nominal_pass.json'), 'utf-8'));
const recReview = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'review_boundary.json'), 'utf-8'));
const recFail = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'high_leakage.json'), 'utf-8'));

// 1. Test Initial Lifecycle States
const resP = inf.predictSingle(recPass);
const resR = inf.predictSingle(recReview);
const resF = inf.predictSingle(recFail);

assert.strictEqual(resP.lifecycle_state, "PREDICTED", "1. Nominal pass lifecycle state failed");
assert.strictEqual(resR.lifecycle_state, "REVIEW_REQUIRED", "1. Review zone lifecycle state failed");
assert.strictEqual(resF.lifecycle_state, "QUARANTINED", "1. Critical fail lifecycle state failed");
console.log("✔ Test 01 Passed: Initial lifecycle states set correctly (PREDICTED, REVIEW_REQUIRED, QUARANTINED)");

// 2. Test Legacy Secondary Test Request Rejection
const targetTestId = resR.test_id;
assert.throws(() => {
  inf.requestSecondaryTest(targetTestId, "OPERATOR_JANE", "Initiated ATE re-test");
}, /LEGACY_SECONDARY_TEST_PATH_DISABLED/, "Legacy secondary test request must be disabled fail-closed");
console.log("✔ Test 02 Passed: Legacy secondary test request disabled fail-closed under Phase 11 governance");

// 3. Test Legacy Complete Secondary Test Rejection
assert.throws(() => {
  inf.completeSecondaryTest(targetTestId, "PASS", "OPERATOR_JANE");
}, /LEGACY_SECONDARY_TEST_PATH_DISABLED/, "Legacy complete secondary test must be disabled fail-closed");
console.log("✔ Test 03 Passed: Legacy complete secondary test disabled fail-closed under Phase 11 governance");

// 4. Test ML Model Prediction Immutability Safeguard
const fetchedRecord = inf.getPredictionByTraceId(resR.trace_id);
assert.strictEqual(fetchedRecord.prediction, resR.prediction, "4. Original ML prediction mutated!");
assert.strictEqual(fetchedRecord.probability, resR.probability, "4. Original ML probability mutated!");
assert.strictEqual(inf.operatingThreshold, 0.20, "4. Operating threshold mutated!");
console.log("✔ Test 04 Passed: Model immutability safeguard verified — original prediction & probability 100% untouched");

console.log("\n=========================================================================");
console.log("ALL DAY 17 OPERATOR WORKFLOW TESTS PASSED SUCCESSFULLY! ✅");
console.log("=========================================================================\n");
