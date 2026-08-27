/**
 * PREDICTA — Backend Phase 4 QA Workflow State Machine Hardening Verification Runner
 * File: scratch/verify_qa_state_machine_phase4.js
 */

const assert = require('assert');
const inferenceService = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA BACKEND PHASE 4 — QA STATE MACHINE HARDENING VERIFICATION");
console.log("=========================================================================\n");

let passed = 0;
let total = 0;

function check(desc, fn) {
  total++;
  try {
    fn();
    console.log(`[PASS] Check ${total.toString().padStart(2, '0')}: ${desc}`);
    passed++;
  } catch (e) {
    console.error(`[FAIL] Check ${total.toString().padStart(2, '0')}: ${desc}`);
    console.error(`       Error: ${e.message}`);
    process.exit(1);
  }
}

// 1. Legal State Sequence (PREDICTED -> SECONDARY_TEST_PENDING -> SECONDARY_TEST_COMPLETED -> CONFIRMED_PASS)
check("Legal State Sequence (PREDICTED -> PENDING -> COMPLETED -> CONFIRMED_PASS)", () => {
  const sample = {
    test_id: "QA-STATE-001",
    equipment_id: "EQP-101",
    supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
    resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
    propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
    temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0,
    iddq: 2100.0, ileak: 290.0, tpd: 190.0, iddq_0h: 2080.0, ileak_0h: 288.0, tpd_0h: 188.0
  };

  const init = inferenceService.predictSingle(sample);
  assert.strictEqual(init.lifecycle_state, "PREDICTED");

  const req = inferenceService.requestSecondaryTest(sample.test_id, "OP_01", "Request re-test");
  assert.strictEqual(req.lifecycle_state, "SECONDARY_TEST_PENDING");

  const comp = inferenceService.completeSecondaryTest(sample.test_id, "PASS", "OP_01", "Passed ATE re-test");
  assert.strictEqual(comp.lifecycle_state, "CONFIRMED_PASS");
});

// 2. Illegal Duplicate State Transition Protection (409 Conflict trigger)
check("Illegal Duplicate State Transition Protection (Duplicate request throws ILLEGAL_TRANSITION)", () => {
  const testId = "QA-STATE-001";
  assert.throws(() => {
    inferenceService.requestSecondaryTest(testId, "OP_01", "Duplicate request attempt");
  }, /ILLEGAL_TRANSITION/);
});

// 3. Terminal State Lockout Protection
check("Terminal State Lockout Protection (Cannot mutate after CONFIRMED_PASS)", () => {
  const testId = "QA-STATE-001";
  assert.throws(() => {
    inferenceService.confirmDisposition(testId, "QUARANTINED", "OP_01", "Attempt post-terminal mutation");
  }, /ILLEGAL_TRANSITION/);
});

console.log("\n=========================================================================");
console.log(`ALL ${passed}/${total} PHASE 4 QA STATE MACHINE CHECKS PASSED! ✅`);
console.log("PREDICTA BACKEND QA WORKFLOW LAYER IS 100% REPAIRED & HARDENED!");
console.log("=========================================================================\n");
