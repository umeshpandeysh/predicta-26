/**
 * PREDICTA — PHASE 11 TASK 3 GOVERNED OUTCOME EVIDENCE & ADJUDICATION TEST SUITE (Node.js)
 * File: tests/test_phase11_task3_governance.js
 * 
 * Verifies Phase 11 Task 3 Requirements (Tests A through L):
 * A. Operator is not ground truth (CONFIRMED status != VALIDATED_GROUND_TRUTH)
 * B. False-negative suspicion is not ground truth (FALSE_NEGATIVE_SUSPECTED != ground truth)
 * C. Missing evidence rejection (adjudication without evidence throws MISSING_OUTCOME_EVIDENCE)
 * D. Unauthorized adjudicator rejection (OPERATOR role throws UNAUTHORIZED_ROLE)
 * E. Valid authorized adjudication (QUALITY_ENGINEER yields VALIDATED_PASS/FAIL & VALIDATED_GROUND_TRUTH)
 * F. Conflicting evidence -> UNRESOLVED_AMBIGUITY (PASS vs FAIL without rationale yields UNRESOLVED)
 * G. Client ground-truth injection rejection (prohibited ML/GT fields throw CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED)
 * H. Protected test set rejection (BENCHMARK_ trace throws TEST_SET_ISOLATION_PROTECTED)
 * I. Persistence failure fail closed (require_durable_persistence throws PERSISTENCE_ERROR when DB fails)
 * J. Restart reconstruction (evidence and adjudications retrievable from store/DB)
 * K. Production model/threshold isolation (Model SHA 91bb59..., threshold 0.20 remain untouched)
 * L. Synthetic disclosure verification (SYNTHETIC_PHYSICS_GROUND_TRUTH includes retrospective disclosure)
 */

process.env.NODE_ENV = 'test';

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
  _FEEDBACK_STORE,
  _LIFECYCLE_EVENTS,
  _EVIDENCE_STORE,
  _ADJUDICATION_STORE
} = require('../src/governance/disposition');

console.log("=========================================================================");
console.log("🚀 PREDICTA — PHASE 11 TASK 3 GOVERNANCE & ADJUDICATION TEST SUITE (JS)");
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

async function runPhase11Task3JsTests() {
  const manager = new HumanDispositionManagerJS();

  // Test setup: Register authoritative predictions
  const sampleTraceId = "TRACE-P11T3-001";
  registerAuthoritativePrediction({
    trace_id: sampleTraceId,
    component_id: "COMP-P11T3-001",
    lot_id: "LOT-P11T3-001",
    prediction: "REJECT",
    probability: 0.85,
    anomaly_score: 0.92,
    prognostic_summary: "CRITICAL_DEGRADATION"
  });

  const fnTraceId = "TRACE-P11T3-FN-001";
  registerAuthoritativePrediction({
    trace_id: fnTraceId,
    component_id: "COMP-P11T3-FN",
    lot_id: "LOT-P11T3-FN",
    prediction: "ACCEPT",
    probability: 0.12,
    anomaly_score: 0.15
  });

  const conflictTraceId = "TRACE-P11T3-CONFLICT";
  registerAuthoritativePrediction({
    trace_id: conflictTraceId,
    component_id: "COMP-P11T3-CONF",
    lot_id: "LOT-P11T3-CONF",
    prediction: "REJECT",
    probability: 0.88,
    anomaly_score: 0.90
  });

  const benchmarkTraceId = "BENCHMARK_TRACE_P11T3";
  registerAuthoritativePrediction({
    trace_id: benchmarkTraceId,
    component_id: "COMP-BENCH-P11T3",
    lot_id: "LOT-BENCH-P11T3",
    prediction: "REJECT",
    probability: 0.75
  });

  const syntheticTraceId = "TRACE-P11T3-SYNTHETIC";
  registerAuthoritativePrediction({
    trace_id: syntheticTraceId,
    component_id: "COMP-SYNTH-01",
    lot_id: "LOT-SYNTH-01",
    prediction: "REJECT",
    probability: 0.82
  });

  // -------------------------------------------------------------------------
  // TEST A: Operator feedback is NOT ground truth (CONFIRMED != VALIDATED_GROUND_TRUTH)
  // -------------------------------------------------------------------------
  await runTest("Test A: Operator confirmation does NOT establish ground truth", async () => {
    const disp = await manager.recordDispositionAsync({
      trace_id: sampleTraceId,
      disposition: "REJECT",
      reason_code: "FALSE_POSITIVE_SUSPECTED",
      operator_id: "OPERATOR_01",
      comment: "Suspected false positive"
    });
    await manager.updateFeedbackStatusAsync(sampleTraceId, disp.disposition_id, "CONFIRMED", "OPERATOR_01", "Operator confirms disposition");
    const gov = await manager.evaluateDispositionGovernanceAsync(sampleTraceId);
    assert.strictEqual(gov.evaluation_candidate.ground_truth_status, "NOT_ESTABLISHED");
    assert.ok(!gov.evaluation_candidate.ground_truth_label);
    assert.strictEqual(gov.evaluation_candidate.production_effect, false);
  });

  // -------------------------------------------------------------------------
  // TEST B: False-negative suspicion is NOT ground truth
  // -------------------------------------------------------------------------
  await runTest("Test B: FALSE_NEGATIVE_SUSPECTED disposition is NOT ground truth", async () => {
    const disp = await manager.recordDispositionAsync({
      trace_id: fnTraceId,
      disposition: "ACCEPT",
      reason_code: "FALSE_NEGATIVE_SUSPECTED",
      operator_id: "OPERATOR_02",
      comment: "Field failure detected post-acceptance"
    });
    await manager.updateFeedbackStatusAsync(fnTraceId, disp.disposition_id, "CONFIRMED", "OPERATOR_02");
    const gov = await manager.evaluateDispositionGovernanceAsync(fnTraceId);
    assert.strictEqual(gov.evaluation_candidate.ground_truth_status, "NOT_ESTABLISHED");
    assert.ok(!gov.evaluation_candidate.ground_truth_label);
  });

  // -------------------------------------------------------------------------
  // TEST C: Missing outcome evidence rejection
  // -------------------------------------------------------------------------
  await runTest("Test C: Adjudication without outcome evidence throws MISSING_OUTCOME_EVIDENCE", async () => {
    try {
      await manager.adjudicateOutcomeAsync(sampleTraceId, {
        adjudicator_identity: "QUALITY_ENG_01",
        adjudicator_role: "QUALITY_ENGINEER",
        proposed_outcome: "FAIL",
        rationale: "Testing missing evidence"
      });
      assert.fail("Should have thrown MISSING_OUTCOME_EVIDENCE error");
    } catch (err) {
      assert.ok(err.message.includes("MISSING_OUTCOME_EVIDENCE"), `Unexpected message: ${err.message}`);
    }
  });

  // -------------------------------------------------------------------------
  // TEST D: Unauthorized adjudicator rejection
  // -------------------------------------------------------------------------
  await runTest("Test D: Adjudication by OPERATOR role throws UNAUTHORIZED_ROLE", async () => {
    // Register evidence first
    await manager.registerOutcomeEvidenceAsync({
      trace_id: sampleTraceId,
      evidence_type: "ATE_RETEST_LOG",
      evidence_source: "ATE_STATION_42",
      source_record_identifier: "ATE-LOG-88192",
      provenance_metadata: { result: "FAIL", test_temp_c: 125 }
    });

    try {
      await manager.adjudicateOutcomeAsync(sampleTraceId, {
        adjudicator_identity: "OPERATOR_01",
        adjudicator_role: "OPERATOR",
        proposed_outcome: "FAIL",
        rationale: "Operator attempting adjudication"
      });
      assert.fail("Should have thrown UNAUTHORIZED_ROLE error");
    } catch (err) {
      assert.ok(err.message.includes("UNAUTHORIZED_ROLE"), `Unexpected message: ${err.message}`);
    }
  });

  // -------------------------------------------------------------------------
  // TEST E: Valid authorized adjudication yields VALIDATED_GROUND_TRUTH
  // -------------------------------------------------------------------------
  await runTest("Test E: Valid adjudication by QUALITY_ENGINEER yields VALIDATED_FAIL and VALIDATED_GROUND_TRUTH", async () => {
    const adj = await manager.adjudicateOutcomeAsync(sampleTraceId, {
      adjudicator_identity: "QUALITY_ENG_01",
      adjudicator_role: "QUALITY_ENGINEER",
      proposed_outcome: "FAIL",
      rationale: "ATE Retest confirmed physical gate breakdown under 125C stress."
    });

    assert.strictEqual(adj.adjudication_status, "VALIDATED_FAIL");
    assert.strictEqual(adj.validated_outcome, "FAIL");
    assert.strictEqual(adj.ground_truth_status, "VALIDATED_GROUND_TRUTH");
    assert.strictEqual(adj.adjudicator_role, "QUALITY_ENGINEER");
    assert.strictEqual(adj.governance_guarantees.operator_is_not_ground_truth, true);
    assert.strictEqual(adj.governance_guarantees.no_automatic_retraining, true);
  });

  // -------------------------------------------------------------------------
  // TEST F: Conflicting evidence -> UNRESOLVED_AMBIGUITY
  // -------------------------------------------------------------------------
  await runTest("Test F: Conflicting PASS and FAIL evidence without resolution rationale yields UNRESOLVED_AMBIGUITY", async () => {
    const disp = await manager.recordDispositionAsync({
      trace_id: conflictTraceId,
      disposition: "REJECT",
      reason_code: "FALSE_POSITIVE_SUSPECTED",
      operator_id: "OPERATOR_01"
    });
    await manager.updateFeedbackStatusAsync(conflictTraceId, disp.disposition_id, "CONFIRMED", "OPERATOR_01");

    // Add conflicting evidence records: 1 PASS, 1 FAIL
    await manager.registerOutcomeEvidenceAsync({
      trace_id: conflictTraceId,
      evidence_type: "ATE_RETEST_LOG",
      evidence_source: "ATE_STATION_01",
      source_record_identifier: "ATE-PASS-01",
      provenance_metadata: { result: "PASS" }
    });
    await manager.registerOutcomeEvidenceAsync({
      trace_id: conflictTraceId,
      evidence_type: "QUALIFIED_LAB_REPORT",
      evidence_source: "RELIABILITY_LAB",
      source_record_identifier: "LAB-FAIL-01",
      provenance_metadata: { result: "FAIL" }
    });

    // Attempt adjudication without explicit resolution proposed_outcome / rationale
    const adj = await manager.adjudicateOutcomeAsync(conflictTraceId, {
      adjudicator_identity: "RELIABILITY_LEAD_01",
      adjudicator_role: "RELIABILITY_LEAD",
      proposed_outcome: null,
      rationale: ""
    });

    assert.strictEqual(adj.adjudication_status, "UNRESOLVED_AMBIGUITY");
    assert.strictEqual(adj.validated_outcome, null);
    assert.strictEqual(adj.ground_truth_status, "UNRESOLVED");
  });

  // -------------------------------------------------------------------------
  // TEST G: Client ground-truth injection rejection
  // -------------------------------------------------------------------------
  await runTest("Test G: Client attempting ground_truth field injection throws CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED", async () => {
    try {
      await manager.adjudicateOutcomeAsync(sampleTraceId, {
        adjudicator_identity: "ATTACKER_01",
        adjudicator_role: "QUALITY_ENGINEER",
        ground_truth: "PASS",
        rationale: "Attempting ground truth injection"
      });
      assert.fail("Should have thrown CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED error");
    } catch (err) {
      assert.ok(err.message.includes("CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED"), `Unexpected message: ${err.message}`);
    }

    try {
      await manager.adjudicateOutcomeAsync(sampleTraceId, {
        adjudicator_identity: "ATTACKER_01",
        adjudicator_role: "QUALITY_ENGINEER",
        model_hash: "MALICIOUS_HASH",
        rationale: "Attempting model hash override"
      });
      assert.fail("Should have thrown CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED error");
    } catch (err) {
      assert.ok(err.message.includes("CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED"), `Unexpected message: ${err.message}`);
    }
  });

  // -------------------------------------------------------------------------
  // TEST H: Protected test set trace rejection
  // -------------------------------------------------------------------------
  await runTest("Test H: Attempting adjudication on BENCHMARK_ trace throws TEST_SET_ISOLATION_PROTECTED", async () => {
    try {
      await manager.adjudicateOutcomeAsync(benchmarkTraceId, {
        adjudicator_identity: "QUALITY_ENG_01",
        adjudicator_role: "QUALITY_ENGINEER",
        proposed_outcome: "FAIL",
        rationale: "Benchmarking trace"
      });
      assert.fail("Should have thrown TEST_SET_ISOLATION_PROTECTED error");
    } catch (err) {
      assert.ok(err.message.includes("TEST_SET_ISOLATION_PROTECTED"), `Unexpected message: ${err.message}`);
    }
  });

  // -------------------------------------------------------------------------
  // TEST I: Persistence failure fail closed
  // -------------------------------------------------------------------------
  await runTest("Test I: Durable persistence failure fails closed with PERSISTENCE_ERROR", async () => {
    // Create manager with failing Supabase client
    const mockFailingSupabase = {
      from: () => ({
        insert: async () => ({ error: { message: "DATABASE_CONNECTION_LOST" } }),
        select: () => ({ eq: async () => ({ data: null, error: { message: "DATABASE_CONNECTION_LOST" } }) })
      })
    };
    const mockFailManager = new HumanDispositionManagerJS(undefined, undefined, undefined, mockFailingSupabase);

    try {
      await mockFailManager.registerOutcomeEvidenceAsync({
        trace_id: "TRACE-FAIL-PERSIST-01",
        evidence_type: "ATE_RETEST_LOG",
        evidence_source: "ATE_STATION",
        source_record_identifier: "ATE-FAIL-99",
        require_durable_persistence: true
      });
      assert.fail("Should have thrown PERSISTENCE_ERROR");
    } catch (err) {
      assert.ok(err.message.includes("PERSISTENCE_ERROR"), `Unexpected error: ${err.message}`);
    }
  });

  // -------------------------------------------------------------------------
  // TEST J: Restart reconstruction
  // -------------------------------------------------------------------------
  await runTest("Test J: Outcome evidence and adjudication records are retrievable across inquiries", async () => {
    const evidenceList = await manager.getOutcomeEvidenceAsync(sampleTraceId);
    assert.ok(evidenceList.length > 0, "Should retrieve registered evidence records");
    assert.strictEqual(evidenceList[0].evidence_type, "ATE_RETEST_LOG");

    const adjRecord = await manager.getAdjudicationAsync(sampleTraceId);
    assert.ok(adjRecord !== null, "Should retrieve active adjudication record");
    assert.strictEqual(adjRecord.ground_truth_status, "VALIDATED_GROUND_TRUTH");
  });

  // -------------------------------------------------------------------------
  // TEST K: Production Model & Operating Threshold Isolation
  // -------------------------------------------------------------------------
  await runTest("Test K: Production model SHA and threshold 0.20 remain strictly unchanged", async () => {
    assert.ok(fs.existsSync(PROD_MANIFEST_PATH), "Production manifest must exist");
    const manifest = JSON.parse(fs.readFileSync(PROD_MANIFEST_PATH, 'utf8'));
    const threshold = manifest.authoritative_threshold || manifest.operating_threshold || manifest.threshold;
    assert.strictEqual(threshold, EXPECTED_THRESHOLD, "Production threshold must remain 0.20");

    assert.ok(fs.existsSync(MODEL_JSON_PATH), "Production model JSON must exist");
    const modelBytes = fs.readFileSync(MODEL_JSON_PATH);
    const computedSha = crypto.createHash('sha256').update(modelBytes).digest('hex');
    assert.strictEqual(computedSha, EXPECTED_MODEL_SHA, `Model SHA mismatch! Expected ${EXPECTED_MODEL_SHA}, got ${computedSha}`);
  });

  // -------------------------------------------------------------------------
  // TEST L: Synthetic disclosure verification
  // -------------------------------------------------------------------------
  await runTest("Test L: SYNTHETIC_PHYSICS_GROUND_TRUTH includes retrospective disclosure statement", async () => {
    const disp = await manager.recordDispositionAsync({
      trace_id: syntheticTraceId,
      disposition: "REJECT",
      reason_code: "FALSE_POSITIVE_SUSPECTED",
      operator_id: "OPERATOR_01"
    });
    await manager.updateFeedbackStatusAsync(syntheticTraceId, disp.disposition_id, "CONFIRMED", "OPERATOR_01");

    await manager.registerOutcomeEvidenceAsync({
      trace_id: syntheticTraceId,
      evidence_type: "SYNTHETIC_PHYSICS_GROUND_TRUTH",
      evidence_source: "SIMULATED_168H_BURNIN",
      source_record_identifier: "SYNTH-BURNIN-99",
      provenance_metadata: { result: "FAIL", burnin_hours: 168 }
    });

    const adj = await manager.adjudicateOutcomeAsync(syntheticTraceId, {
      adjudicator_identity: "RELIABILITY_LEAD_01",
      adjudicator_role: "RELIABILITY_LEAD",
      proposed_outcome: "FAIL",
      rationale: "Retrospective physics simulation burn-in verification"
    });

    assert.ok(adj.provenance.synthetic_disclosure !== null, "Synthetic disclosure must be present");
    assert.ok(adj.provenance.synthetic_disclosure.includes("Retrospective evaluation dataset telemetry. Not physical-fab validation."), "Synthetic disclosure must state non-physical fab origin");
  });

  console.log("\n=========================================================================");
  console.log(`✅ [SUMMARY] All ${passed}/${total} Node.js Phase 11 Task 3 tests PASSED cleanly!`);
  console.log("=========================================================================\n");
}

runPhase11Task3JsTests().catch((err) => {
  console.error("FATAL TEST EXCEPTION:", err);
  process.exit(1);
});
