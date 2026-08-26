/**
 * Predicta Day 33 — Operator Workflow Lifecycle Test Suite
 * File: tests/test_day33_operator_workflow.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 33 — OPERATOR WORKFLOW TEST SUITE");
console.log("=========================================================================\n");

const reviewRecord = {
  test_id: "DAY33-REV-001", equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 160.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
  propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 31.0, dynamic_power: 52.0, total_power: 62.0, test_duration: 12.0
};

const resReview = inf.predictSingle(reviewRecord);
assert.strictEqual(resReview.operational_decision, "SECONDARY_TEST", "[1] Review zone record triggers SECONDARY_TEST");

const secReq = inf.requestSecondaryTest(resReview.test_id, "OP-101", "Operator initiated secondary test");
assert.strictEqual(secReq.lifecycle_state, "SECONDARY_TEST_PENDING", "[2] Status transitions to SECONDARY_TEST_PENDING");

const secComp = inf.completeSecondaryTest(resReview.test_id, "PASS", "OP-101", "Secondary test cleared PASS");
assert.strictEqual(secComp.lifecycle_state, "CONFIRMED_PASS", "[3] Status transitions to CONFIRMED_PASS");
assert.strictEqual(secComp.prediction, resReview.prediction, "[4] Production ML prediction remains strictly read-only immutable");

console.log("✔ Test 01 Passed: Operator secondary test lifecycle workflow state machine verified");

console.log("\n=========================================================================");
console.log("ALL DAY 33 OPERATOR WORKFLOW TESTS PASSED! ✅");
console.log("=========================================================================\n");
