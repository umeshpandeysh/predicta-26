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

// 2. Test Requesting Secondary Test
const targetTestId = resR.test_id;
const requestedRecord = inf.requestSecondaryTest(targetTestId, "OPERATOR_JANE", "Initiated ATE re-test");
assert.strictEqual(requestedRecord.lifecycle_state, "SECONDARY_TEST_PENDING", "2. Request secondary test state failed");
assert.strictEqual(requestedRecord.event_history.length, 2, "2. Audit event history length mismatch");
assert.strictEqual(requestedRecord.event_history[1].event_type, "SECONDARY_TEST_REQUESTED", "2. Event type mismatch");
console.log("✔ Test 02 Passed: Secondary test requested -> status SECONDARY_TEST_PENDING with audit trail");

// 3. Test Blank Secondary Result Safeguard Rejection
assert.throws(() => {
  inf.completeSecondaryTest(targetTestId, "", "OPERATOR_JANE");
}, /non-blank/, "Blank secondary result failed to reject");
console.log("✔ Test 03 Passed: Operator safeguard verified — blank secondary test result rejected");

// 4. Test Completing Secondary Test -> Confirmed Pass
const completedRecord = inf.completeSecondaryTest(targetTestId, "PASS", "OPERATOR_JANE", "Re-test passed on secondary bench.");
assert.strictEqual(completedRecord.secondary_test_result, "PASS", "4. Secondary test result mismatch");
assert.strictEqual(completedRecord.lifecycle_state, "CONFIRMED_PASS", "4. Final disposition mismatch");
assert.strictEqual(completedRecord.operator_disposition, "CONFIRMED_PASS", "4. Operator disposition mismatch");
console.log("✔ Test 04 Passed: Secondary test completed PASS -> status CONFIRMED_PASS with complete audit log");

// 5. Test ML Model Prediction Immutability Safeguard
assert.strictEqual(completedRecord.prediction, resR.prediction, "5. Original ML prediction mutated!");
assert.strictEqual(completedRecord.probability, resR.probability, "5. Original ML probability mutated!");
assert.strictEqual(inf.operatingThreshold, 0.45, "5. Operating threshold mutated!");
console.log("✔ Test 05 Passed: Model immutability safeguard verified — original prediction & probability 100% untouched");

console.log("\n=========================================================================");
console.log("ALL DAY 17 OPERATOR WORKFLOW TESTS PASSED SUCCESSFULLY! ✅");
console.log("=========================================================================\n");
