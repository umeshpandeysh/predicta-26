/**
 * PREDICTA — PHASE 11 TASK 1 HUMAN FEEDBACK GOVERNANCE FOUNDATION TEST SUITE (Node.js)
 * File: tests/test_phase11_task1_governance.js
 * 
 * Verifies:
 * 1. Contract version 1.1.0 & lifecycle state transitions (RECORDED_ONLY -> PENDING_OUTCOME -> CONFIRMED / CONTRADICTED / UNRESOLVED)
 * 2. Immutable append-only lifecycle event tracking
 * 3. Backend-authoritative prediction & identity resolution
 * 4. Rejection of client-controlled ML outputs, snapshots, and identity overrides
 * 5. Conflict detection for multiple operator dispositions on the same trace
 * 6. Fail-closed durable persistence behavior
 * 7. Taxonomy separation (rejection of governance-only statuses as lifecycle states)
 * 8. Hard governance invariants (no retraining, no threshold modification, dataset isolation)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const EXPECTED_MODEL_SHA = "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98";
const EXPECTED_THRESHOLD = 0.20;

const PROD_MANIFEST_PATH = path.join(__dirname, '../ml/models/production/predicta_production_manifest.json');
const MODEL_JSON_PATH = path.join(__dirname, '../ml/models/production/predicta_xgboost_model.json');

const {
  HumanDispositionManagerJS,
  registerAuthoritativePrediction,
  DISPOSITION_CONTRACT_PATH
} = require('../src/governance/disposition');
const inferenceService = require('../src/api/inference');

console.log("=========================================================================");
console.log("🚀 PREDICTA — PHASE 11 TASK 1 HUMAN FEEDBACK GOVERNANCE TEST SUITE (JS)");
console.log("=========================================================================\n");

let passed = 0;
let total = 0;

async function runTest(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✓ [PASS] Test ${total.toString().padStart(2, '0')}: ${name}`);
    passed++;
  } catch (err) {
    console.error(`\n  ❌ [FAIL] Test ${total}: ${name}`);
    console.error(`     Reason: ${err.message}\n`);
    process.exit(1);
  }
}

async function runPhase11Task1Tests() {
  const manager = new HumanDispositionManagerJS();

  // Test setup: Register authoritative prediction for testing
  const sampleTraceId = "TRACE-P11-001";
  registerAuthoritativePrediction({
    trace_id: sampleTraceId,
    component_id: "COMP-P11-101",
    lot_id: "LOT-SYN-045",
    prediction: "FAIL",
    probability: 0.85,
    anomaly_status: "NORMAL",
    prognostic_summary: "NOMINAL_168H"
  });

  // -------------------------------------------------------------------------
  // 1. Contract & Lifecycle Tests
  // -------------------------------------------------------------------------
  await runTest("Contract Version 1.1.0 Integrity", () => {
    assert.strictEqual(manager.contract.contract_version, "1.1.0", "Contract version MUST be 1.1.0");
    const statuses = manager.contract.governance_rules.allowed_feedback_statuses;
    for (const s of ["RECORDED_ONLY", "PENDING_OUTCOME", "CONFIRMED", "CONTRADICTED", "UNRESOLVED"]) {
      assert.ok(statuses.includes(s), `Allowed feedback statuses must include '${s}'`);
    }
  });

  await runTest("Valid Disposition & Default Lifecycle State (RECORDED_ONLY)", async () => {
    const res = await manager.recordDispositionAsync({
      trace_id: sampleTraceId,
      disposition: "HOLD",
      reason_code: "FALSE_POSITIVE_SUSPECTED",
      comment: "Suspect thermal noise during test run."
    });

    assert.ok(res.disposition_id.startsWith("DISP-"), "Disposition ID must have DISP- prefix");
    assert.strictEqual(res.trace_id, sampleTraceId);
    assert.strictEqual(res.component_id, "COMP-P11-101");
    assert.strictEqual(res.lot_id, "LOT-SYN-045");
    assert.strictEqual(res.disposition, "HOLD");
    assert.strictEqual(res.reason_code, "FALSE_POSITIVE_SUSPECTED");
    assert.strictEqual(res.original_ml_decision, "FAIL");
    assert.strictEqual(res.original_ml_probability, 0.85);
    assert.strictEqual(res.feedback_status, "RECORDED_ONLY");
    assert.strictEqual(res.conflict, false);
    assert.strictEqual(res.lifecycle_events.length, 1, "Initial lifecycle event recorded");
  });

  await runTest("Append-Only Lifecycle Events (RECORDED_ONLY -> PENDING_OUTCOME -> CONFIRMED)", async () => {
    const disp = await manager.getDispositionAsync(sampleTraceId);
    const dispId = disp.latest.disposition_id;

    // Transition to PENDING_OUTCOME
    const p1 = await manager.updateFeedbackStatusAsync(sampleTraceId, dispId, "PENDING_OUTCOME", "OPERATOR_01", "Awaiting 168h ATE re-test");
    assert.strictEqual(p1.feedback_status, "PENDING_OUTCOME");
    assert.strictEqual(p1.lifecycle_events.length, 2, "2 lifecycle events recorded");

    // Transition to CONFIRMED
    const p2 = await manager.updateFeedbackStatusAsync(sampleTraceId, dispId, "CONFIRMED", "OPERATOR_01", "168h re-test confirmed defect");
    assert.strictEqual(p2.feedback_status, "CONFIRMED");
    assert.strictEqual(p2.lifecycle_events.length, 3, "All 3 historical lifecycle events preserved");

    // Verify events details
    assert.strictEqual(p2.lifecycle_events[0].new_status, "RECORDED_ONLY");
    assert.strictEqual(p2.lifecycle_events[1].new_status, "PENDING_OUTCOME");
    assert.strictEqual(p2.lifecycle_events[2].new_status, "CONFIRMED");
  });

  await runTest("Invalid Lifecycle Transition Fails Closed (CONFIRMED -> PENDING_OUTCOME)", async () => {
    const disp = await manager.getDispositionAsync(sampleTraceId);
    const dispId = disp.latest.disposition_id;

    // Terminal state transition attempt must fail
    await assert.rejects(
      () => manager.updateFeedbackStatusAsync(sampleTraceId, dispId, "PENDING_OUTCOME"),
      /INVALID_LIFECYCLE_TRANSITION/
    );
  });

  await runTest("Taxonomy Separation: Reject Governance-Only States as Lifecycle States", async () => {
    await assert.rejects(
      () => manager.recordDispositionAsync({
        trace_id: sampleTraceId,
        disposition: "HOLD",
        reason_code: "OTHER",
        feedback_status: "ELIGIBLE_FOR_OFFLINE_REVIEW"
      }),
      /INVALID_FEEDBACK_STATUS/
    );

    const disp = await manager.getDispositionAsync(sampleTraceId);
    const dispId = disp.latest.disposition_id;
    await assert.rejects(
      () => manager.updateFeedbackStatusAsync(sampleTraceId, dispId, "REJECTED_GOVERNANCE"),
      /INVALID_FEEDBACK_STATUS/
    );
  });

  // -------------------------------------------------------------------------
  // 2. Conflict Handling Tests
  // -------------------------------------------------------------------------
  await runTest("Multiple Operator Dispositions for Single Trace & Explicit Conflict Flag", async () => {
    const traceIdConflict = "TRACE-P11-CONFLICT";
    registerAuthoritativePrediction({
      trace_id: traceIdConflict,
      component_id: "COMP-P11-102",
      lot_id: "LOT-SYN-045",
      prediction: "FAIL",
      probability: 0.72
    });

    // Operator A submits ACCEPT
    const opA = await manager.recordDispositionAsync({
      trace_id: traceIdConflict,
      disposition: "ACCEPT",
      reason_code: "FALSE_POSITIVE_SUSPECTED",
      operator_id: "OPERATOR_A",
      comment: "Passed manual visual probe."
    });
    assert.strictEqual(opA.disposition, "ACCEPT");
    assert.strictEqual(opA.conflict, false, "First disposition has no conflict");

    // Operator B submits REJECT
    const opB = await manager.recordDispositionAsync({
      trace_id: traceIdConflict,
      disposition: "REJECT",
      reason_code: "MANUAL_ENGINEERING_REVIEW",
      operator_id: "OPERATOR_B",
      comment: "Failed secondary threshold check."
    });
    assert.strictEqual(opB.disposition, "REJECT");
    assert.strictEqual(opB.conflict, true, "Second conflicting disposition sets conflict=true");

    // Trace lookup must preserve BOTH records and expose conflict=true
    const summary = await manager.getDispositionAsync(traceIdConflict);
    assert.strictEqual(summary.total_dispositions, 2, "Both dispositions preserved intact");
    assert.strictEqual(summary.has_conflict, true, "Summary exposes has_conflict=true");
    assert.strictEqual(summary.conflict, true, "Summary exposes conflict=true");
    assert.strictEqual(summary.history[0].disposition, "ACCEPT");
    assert.strictEqual(summary.history[1].disposition, "REJECT");
    assert.strictEqual(summary.history[0].original_ml_decision, "FAIL", "Original ML decision unaltered");
    assert.strictEqual(summary.history[1].original_ml_decision, "FAIL", "Original ML decision unaltered");
  });

  // -------------------------------------------------------------------------
  // 3. Security Rejections (Client-Controlled ML Output & Identity Tampering)
  // -------------------------------------------------------------------------
  await runTest("Security: Reject Client-Supplied Probability", async () => {
    await assert.rejects(
      () => manager.recordDispositionAsync({ trace_id: sampleTraceId, disposition: "ACCEPT", reason_code: "OTHER", probability: 0.01 }),
      /CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED/
    );
  });

  await runTest("Security: Reject Client-Supplied ML Decision", async () => {
    await assert.rejects(
      () => manager.recordDispositionAsync({ trace_id: sampleTraceId, disposition: "ACCEPT", reason_code: "OTHER", ml_decision: "PASS" }),
      /CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED/
    );
  });

  await runTest("Security: Reject Client-Supplied Model Hash", async () => {
    await assert.rejects(
      () => manager.recordDispositionAsync({ trace_id: sampleTraceId, disposition: "ACCEPT", reason_code: "OTHER", model_hash: "fake_hash" }),
      /CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED/
    );
  });

  await runTest("Security: Reject Client-Supplied Model ID", async () => {
    await assert.rejects(
      () => manager.recordDispositionAsync({ trace_id: sampleTraceId, disposition: "ACCEPT", reason_code: "OTHER", model_id: "fake_model" }),
      /CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED/
    );
  });

  await runTest("Security: Reject Client-Supplied Anomaly Score", async () => {
    await assert.rejects(
      () => manager.recordDispositionAsync({ trace_id: sampleTraceId, disposition: "ACCEPT", reason_code: "OTHER", anomaly_score: 0.0 }),
      /CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED/
    );
  });

  await runTest("Security: Reject Client-Supplied Prognostic Output", async () => {
    await assert.rejects(
      () => manager.recordDispositionAsync({ trace_id: sampleTraceId, disposition: "ACCEPT", reason_code: "OTHER", prognostic_output: "SAFE" }),
      /CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED/
    );
  });

  await runTest("Security: Reject Client-Supplied Ground Truth", async () => {
    await assert.rejects(
      () => manager.recordDispositionAsync({ trace_id: sampleTraceId, disposition: "ACCEPT", reason_code: "OTHER", ground_truth: 0 }),
      /CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED/
    );
  });

  await runTest("Security: Reject Client-Supplied Component ID", async () => {
    await assert.rejects(
      () => manager.recordDispositionAsync({ trace_id: sampleTraceId, disposition: "ACCEPT", reason_code: "OTHER", component_id: "COMP-FAKE" }),
      /CLIENT_CONTROLLED_IDENTITY_PROHIBITED/
    );
  });

  await runTest("Security: Reject Client-Supplied Lot ID", async () => {
    await assert.rejects(
      () => manager.recordDispositionAsync({ trace_id: sampleTraceId, disposition: "ACCEPT", reason_code: "OTHER", lot_id: "LOT-FAKE" }),
      /CLIENT_CONTROLLED_IDENTITY_PROHIBITED/
    );
  });

  await runTest("Security: Reject Unauthorized Operator Role", async () => {
    await assert.rejects(
      () => manager.recordDispositionAsync({ trace_id: sampleTraceId, disposition: "ACCEPT", reason_code: "OTHER", operator_role: "GUEST" }),
      /UNAUTHORIZED_ROLE/
    );
  });

  await runTest("Security: Reject Client Attempt to Disable Durable Persistence", async () => {
    await assert.rejects(
      () => manager.recordDispositionAsync({
        trace_id: sampleTraceId,
        disposition: "ACCEPT",
        reason_code: "OTHER",
        client_supplied_require_durable: false
      }),
      /CLIENT_TAINT_REJECTED/
    );
  });

  // -------------------------------------------------------------------------
  // 4. Persistence Governance & Fail-Closed Behavior
  // -------------------------------------------------------------------------
  await runTest("Persistence: Fail Closed When Require Durable Persistence Fails", async () => {
    const unconfiguredManager = new HumanDispositionManagerJS(DISPOSITION_CONTRACT_PATH, PROD_MANIFEST_PATH, MODEL_JSON_PATH, null);
    await assert.rejects(
      () => unconfiguredManager.recordDispositionAsync({
        trace_id: sampleTraceId,
        disposition: "HOLD",
        reason_code: "EQUIPMENT_ISSUE",
        require_durable_persistence: true
      }),
      /PERSISTENCE_ERROR/
    );
  });

  // -------------------------------------------------------------------------
  // 5. Governance Invariants & Production Protection
  // -------------------------------------------------------------------------
  await runTest("Governance: Original ML Decision Remains Immutable", async () => {
    const summary = await manager.getDispositionAsync(sampleTraceId);
    for (const rec of summary.history) {
      assert.strictEqual(rec.original_ml_decision, "FAIL", "Original ML decision MUST NOT change regardless of operator dispositions");
      assert.strictEqual(rec.original_ml_probability, 0.85);
    }
  });

  await runTest("Governance: Production Model SHA & Operating Threshold Lock", () => {
    const actualModelSha = manager.verifyModelProvenance();
    assert.strictEqual(actualModelSha, EXPECTED_MODEL_SHA, "Production model SHA must match authoritative SHA");
    assert.strictEqual(inferenceService.operatingThreshold, EXPECTED_THRESHOLD, "Production threshold must remain locked at 0.20");
  });

  await runTest("Governance: Feedback Dataset Isolation Guarantee", () => {
    const rules = manager.contract.governance_rules;
    assert.strictEqual(rules.no_automatic_retraining, true, "no_automatic_retraining must be true");
    assert.strictEqual(rules.no_threshold_modification, true, "no_threshold_modification must be true");
    assert.ok(rules.test_set_isolation.includes("never be injected"), "Feedback records must never enter training, validation, or test sets");
  });

  console.log("\n=========================================================================");
  console.log(`ALL ${passed}/${total} PHASE 11 TASK 1 HUMAN FEEDBACK GOVERNANCE TESTS PASSED! ✅`);
  console.log("=========================================================================\n");
}

runPhase11Task1Tests().catch((err) => {
  console.error("Phase 11 Task 1 Test Suite Exception:", err);
  process.exit(1);
});
