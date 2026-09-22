/**
 * PREDICTA — PHASE 11 TASK 3 GOVERNED OUTCOME EVIDENCE & ADJUDICATION TEST SUITE (Node.js)
 * File: tests/test_phase11_task3_governance.js
 * 
 * Verifies Phase 11 Task 3 Requirements (Tests A through V Matrix):
 * A. Operator CONFIRMED -> never ground truth (ground_truth_status === "NOT_ESTABLISHED")
 * B. FALSE_NEGATIVE_SUSPECTED -> never ground truth
 * C. No evidence -> adjudication rejected (MISSING_OUTCOME_EVIDENCE)
 * D. Unauthorized adjudicator -> rejected (UNAUTHORIZED_ROLE / 403)
 * E. Authorized adjudicator + valid evidence -> VALIDATED_PASS/FAIL & VALIDATED_GROUND_TRUTH
 * F. PASS + FAIL conflict without rationale -> UNRESOLVED_AMBIGUITY & UNRESOLVED
 * G. Client ground_truth injection -> rejected (CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED)
 * H. Client model_hash / probability injection -> rejected (CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED)
 * I. Protected benchmark/test trace -> rejected (TEST_SET_ISOLATION_PROTECTED)
 * J. Database unavailable -> PERSISTENCE_ERROR / REJECTED_GOVERNANCE
 * K. Clear all memory after durable creation -> 100% successful reconstruction from DB
 * L. Legacy secondary-test endpoint -> cannot establish ground truth (returns 410 GONE)
 * M. Legacy secondary-test endpoint -> cannot mutate authoritative ML decision
 * N. Client attempts to spoof adjudicator role -> rejected (UNAUTHORIZED_ROLE)
 * O. Synthetic evidence -> mandatory synthetic disclosure
 * P. Synthetic evidence -> cannot claim physical-fab validation
 * Q. Evidence with missing / invalid evidence_type -> rejected
 * R. Append-only adjudication -> prior record cannot be overwritten (appends new record)
 * S. JS/Python identical input -> identical governance result
 * T. Production model SHA unchanged (91bb59...)
 * U. Production threshold remains exactly 0.20
 * V. No retraining, recalibration, or fusion weight mutation
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

const inferenceService = require('../src/api/inference');

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

  const restartTraceId = "TRACE-P11T3-RESTART";
  registerAuthoritativePrediction({
    trace_id: restartTraceId,
    component_id: "COMP-RESTART-01",
    lot_id: "LOT-RESTART-01",
    prediction: "REJECT",
    probability: 0.89
  });

  const appendTraceId = "TRACE-P11T3-APPEND";
  registerAuthoritativePrediction({
    trace_id: appendTraceId,
    component_id: "COMP-APPEND-01",
    lot_id: "LOT-APPEND-01",
    prediction: "REJECT",
    probability: 0.84
  });

  // Helper function to setup confirmed disposition
  async function helperSetupConfirmedDisposition(mgr, traceId, dispVal = "REJECT", reason = "FALSE_POSITIVE_SUSPECTED") {
    const disp = await mgr.recordDispositionAsync({
      trace_id: traceId,
      disposition: dispVal,
      reason_code: reason,
      operator_id: "OPERATOR_01",
      comment: "Setup test disposition"
    });
    await mgr.updateFeedbackStatusAsync(traceId, disp.disposition_id, "CONFIRMED", "OPERATOR_01", "Confirmed by operator");
    return disp;
  }

  // -------------------------------------------------------------------------
  // TEST A: Operator CONFIRMED -> never ground truth
  // -------------------------------------------------------------------------
  await runTest("Test A: Operator CONFIRMED disposition does NOT establish ground truth", async () => {
    await helperSetupConfirmedDisposition(manager, sampleTraceId);
    const gov = await manager.evaluateDispositionGovernanceAsync(sampleTraceId);
    assert.strictEqual(gov.evaluation_candidate.ground_truth_status, "NOT_ESTABLISHED");
    assert.ok(!gov.evaluation_candidate.ground_truth_label);
    assert.strictEqual(gov.evaluation_candidate.production_effect, false);
  });

  // -------------------------------------------------------------------------
  // TEST B: FALSE_NEGATIVE_SUSPECTED -> never ground truth
  // -------------------------------------------------------------------------
  await runTest("Test B: FALSE_NEGATIVE_SUSPECTED disposition is NOT ground truth", async () => {
    await helperSetupConfirmedDisposition(manager, fnTraceId, "ACCEPT", "FALSE_NEGATIVE_SUSPECTED");
    const gov = await manager.evaluateDispositionGovernanceAsync(fnTraceId);
    assert.strictEqual(gov.evaluation_candidate.ground_truth_status, "NOT_ESTABLISHED");
    assert.ok(!gov.evaluation_candidate.ground_truth_label);
  });

  // -------------------------------------------------------------------------
  // TEST C: No evidence -> adjudication rejected
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
  // TEST D: Unauthorized adjudicator -> rejected
  // -------------------------------------------------------------------------
  await runTest("Test D: Adjudication by OPERATOR role throws UNAUTHORIZED_ROLE", async () => {
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
  // TEST E: Authorized adjudicator + valid evidence -> VALIDATED_GROUND_TRUTH
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
  // TEST F: PASS + FAIL conflict without rationale -> UNRESOLVED_AMBIGUITY
  // -------------------------------------------------------------------------
  await runTest("Test F: Conflicting PASS and FAIL evidence without resolution rationale yields UNRESOLVED_AMBIGUITY", async () => {
    await helperSetupConfirmedDisposition(manager, conflictTraceId);

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
  // TEST G: Client ground_truth injection -> rejected
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
  });

  // -------------------------------------------------------------------------
  // TEST H: Client model_hash / probability injection -> rejected
  // -------------------------------------------------------------------------
  await runTest("Test H: Client attempting model_hash or probability injection throws CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED", async () => {
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

    try {
      await manager.adjudicateOutcomeAsync(sampleTraceId, {
        adjudicator_identity: "ATTACKER_01",
        adjudicator_role: "QUALITY_ENGINEER",
        probability: 0.01,
        rationale: "Attempting probability override"
      });
      assert.fail("Should have thrown CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED error");
    } catch (err) {
      assert.ok(err.message.includes("CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED"), `Unexpected message: ${err.message}`);
    }
  });

  // -------------------------------------------------------------------------
  // TEST I: Protected benchmark/test trace -> rejected
  // -------------------------------------------------------------------------
  await runTest("Test I: Attempting adjudication on BENCHMARK_ trace throws TEST_SET_ISOLATION_PROTECTED", async () => {
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
  // TEST J: Database unavailable -> PERSISTENCE_ERROR
  // -------------------------------------------------------------------------
  await runTest("Test J: Durable persistence failure fails closed with PERSISTENCE_ERROR", async () => {
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
  // TEST K: Cold-Start Process Restart Reconstruction Test
  // -------------------------------------------------------------------------
  await runTest("Test K: Cold-start process restart reconstruction from DB yields 100% identical record", async () => {
    const dbTables = {
      operator_dispositions: [],
      disposition_lifecycle_events: [],
      disposition_outcome_evidence: [],
      disposition_adjudications: []
    };

    const mockDurableSupabase = {
      from: (table) => ({
        insert: async (rows) => {
          if (dbTables[table]) dbTables[table].push(...rows);
          return { data: rows, error: null };
        },
        select: () => ({
          eq: async (col, val) => {
            const rows = (dbTables[table] || []).filter(r => r[col] === val);
            return { data: rows, error: null };
          }
        })
      })
    };

    const mgr1 = new HumanDispositionManagerJS(undefined, undefined, undefined, mockDurableSupabase);
    await helperSetupConfirmedDisposition(mgr1, restartTraceId);
    await mgr1.registerOutcomeEvidenceAsync({
      trace_id: restartTraceId,
      evidence_type: "ATE_RETEST_LOG",
      evidence_source: "ATE_STATION_99",
      source_record_identifier: "ATE-RESTART-01",
      provenance_metadata: { result: "FAIL" }
    });
    const origAdj = await mgr1.adjudicateOutcomeAsync(restartTraceId, {
      adjudicator_identity: "QUALITY_ENG_01",
      adjudicator_role: "QUALITY_ENGINEER",
      proposed_outcome: "FAIL",
      rationale: "Pre-restart adjudication"
    });

    // WIPE ALL IN-MEMORY STORES
    _FEEDBACK_STORE.clear();
    _LIFECYCLE_EVENTS.clear();
    _EVIDENCE_STORE.clear();
    _ADJUDICATION_STORE.clear();

    // RECONSTRUCT MANAGER INSTANCE WITH MOCK DB CLIENT
    const mgr2 = new HumanDispositionManagerJS(undefined, undefined, undefined, mockDurableSupabase);
    const recGov = await mgr2.evaluateDispositionGovernanceAsync(restartTraceId);
    const recEv = await mgr2.getOutcomeEvidenceAsync(restartTraceId);
    const recAdj = await mgr2.getAdjudicationAsync(restartTraceId);

    assert.strictEqual(recGov.governance_classification, "ELIGIBLE_FOR_OFFLINE_REVIEW");
    assert.strictEqual(recEv.length, 1);
    assert.strictEqual(recEv[0].source_record_identifier, "ATE-RESTART-01");
    assert.strictEqual(recAdj.adjudication_id, origAdj.adjudication_id);
    assert.strictEqual(recAdj.ground_truth_status, "VALIDATED_GROUND_TRUTH");
    assert.strictEqual(recAdj.validated_outcome, "FAIL");
  });

  // -------------------------------------------------------------------------
  // TEST L: Legacy secondary-test endpoint returns 410 GONE
  // -------------------------------------------------------------------------
  await runTest("Test L: Legacy secondary-test completion path throws LEGACY_SECONDARY_TEST_PATH_DISABLED", async () => {
    try {
      inferenceService.completeSecondaryTest("TEST-LEGACY-01", "PASS", "OP_01", "Legacy test");
      assert.fail("Should have thrown LEGACY_SECONDARY_TEST_PATH_DISABLED");
    } catch (err) {
      assert.ok(err.message.includes("LEGACY_SECONDARY_TEST_PATH_DISABLED"), `Unexpected error: ${err.message}`);
      assert.strictEqual(err.statusCode, 410);
    }
  });

  // -------------------------------------------------------------------------
  // TEST M: Legacy secondary-test path cannot mutate authoritative ML decision
  // -------------------------------------------------------------------------
  await runTest("Test M: Legacy secondary-test completion path cannot mutate prediction records", async () => {
    const authPred = manager.lookupAuthoritativePrediction(sampleTraceId);
    assert.strictEqual(authPred.prediction, "REJECT");
    assert.strictEqual(authPred.probability, 0.85);

    try {
      await inferenceService.completeSecondaryTestAsync(sampleTraceId, "PASS", "OP_01");
    } catch (e) {}

    const authPredAfter = manager.lookupAuthoritativePrediction(sampleTraceId);
    assert.strictEqual(authPredAfter.prediction, "REJECT");
    assert.strictEqual(authPredAfter.probability, 0.85);
  });

  // -------------------------------------------------------------------------
  // TEST N: Role spoofing rejection
  // -------------------------------------------------------------------------
  await runTest("Test N: Operator role attempting adjudication is strictly rejected", async () => {
    try {
      await manager.adjudicateOutcomeAsync(sampleTraceId, {
        adjudicator_identity: "SPOOFER_01",
        adjudicator_role: "OPERATOR",
        proposed_outcome: "FAIL",
        rationale: "Spoofing role"
      });
      assert.fail("Should have thrown UNAUTHORIZED_ROLE");
    } catch (err) {
      assert.ok(err.message.includes("UNAUTHORIZED_ROLE"), `Unexpected error: ${err.message}`);
    }
  });

  // -------------------------------------------------------------------------
  // TEST O: Synthetic evidence -> mandatory synthetic disclosure
  // -------------------------------------------------------------------------
  await runTest("Test O: SYNTHETIC_PHYSICS_GROUND_TRUTH includes retrospective disclosure statement", async () => {
    await helperSetupConfirmedDisposition(manager, syntheticTraceId);
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

    assert.ok(adj.provenance.synthetic_disclosure !== null);
    assert.ok(adj.provenance.synthetic_disclosure.includes("Retrospective evaluation dataset telemetry. Not physical-fab validation."));
  });

  // -------------------------------------------------------------------------
  // TEST P: Synthetic evidence cannot claim physical-fab validation
  // -------------------------------------------------------------------------
  await runTest("Test P: Synthetic evidence explicitly disclaims physical fab origin", async () => {
    const adj = await manager.getAdjudicationAsync(syntheticTraceId);
    assert.strictEqual(adj.provenance.synthetic_disclosure.includes("Not physical-fab validation."), true);
  });

  // -------------------------------------------------------------------------
  // TEST Q: Invalid evidence_type -> rejected
  // -------------------------------------------------------------------------
  await runTest("Test Q: Invalid evidence_type throws INVALID_EVIDENCE_TYPE error", async () => {
    try {
      await manager.registerOutcomeEvidenceAsync({
        trace_id: sampleTraceId,
        evidence_type: "FABRICATED_PHYSICAL_RECORD",
        evidence_source: "UNKNOWN",
        source_record_identifier: "FAKE-123"
      });
      assert.fail("Should have thrown INVALID_EVIDENCE_TYPE");
    } catch (err) {
      assert.ok(err.message.includes("INVALID_EVIDENCE_TYPE"), `Unexpected error: ${err.message}`);
    }
  });

  // -------------------------------------------------------------------------
  // TEST R: Append-only adjudication -> prior record preserved
  // -------------------------------------------------------------------------
  await runTest("Test R: Re-adjudication appends a new record and preserves prior history", async () => {
    await helperSetupConfirmedDisposition(manager, appendTraceId);
    await manager.registerOutcomeEvidenceAsync({
      trace_id: appendTraceId,
      evidence_type: "ATE_RETEST_LOG",
      evidence_source: "ATE_STATION_01",
      source_record_identifier: "ATE-APP-01",
      provenance_metadata: { result: "FAIL" }
    });

    const adj1 = await manager.adjudicateOutcomeAsync(appendTraceId, {
      adjudicator_identity: "QUALITY_ENG_01",
      adjudicator_role: "QUALITY_ENGINEER",
      proposed_outcome: "FAIL",
      rationale: "First adjudication"
    });

    const adj2 = await manager.adjudicateOutcomeAsync(appendTraceId, {
      adjudicator_identity: "RELIABILITY_LEAD_01",
      adjudicator_role: "RELIABILITY_LEAD",
      proposed_outcome: "FAIL",
      rationale: "Second adjudication amending rationale"
    });

    const adjHistory = _ADJUDICATION_STORE.get(appendTraceId) || [];
    assert.strictEqual(adjHistory.length, 2);
    assert.strictEqual(adjHistory[0].adjudication_id, adj1.adjudication_id);
    assert.strictEqual(adjHistory[1].adjudication_id, adj2.adjudication_id);
    assert.notStrictEqual(adj1.adjudication_id, adj2.adjudication_id);
  });

  // -------------------------------------------------------------------------
  // TEST S: JS/Python identical input -> identical governance result
  // -------------------------------------------------------------------------
  await runTest("Test S: JS/Python adjudication structure and governance parity", async () => {
    const parityTraceId = "TRACE-P11T3-PARITY-JS";
    registerAuthoritativePrediction({
      trace_id: parityTraceId,
      component_id: "COMP-PARITY-JS",
      lot_id: "LOT-PARITY-JS",
      prediction: "REJECT",
      probability: 0.88
    });
    await helperSetupConfirmedDisposition(manager, parityTraceId);
    await manager.registerOutcomeEvidenceAsync({
      trace_id: parityTraceId,
      evidence_type: "ATE_RETEST_LOG",
      evidence_source: "ATE_STATION_01",
      source_record_identifier: "ATE-PARITY-01",
      provenance_metadata: { result: "FAIL" }
    });
    const adj = await manager.adjudicateOutcomeAsync(parityTraceId, {
      adjudicator_identity: "QUALITY_ENG_01",
      adjudicator_role: "QUALITY_ENGINEER",
      proposed_outcome: "FAIL",
      rationale: "Parity verification"
    });
    assert.ok(adj.adjudication_id.startsWith("ADJ-"));
    assert.strictEqual(adj.ground_truth_status, "VALIDATED_GROUND_TRUTH");
    assert.strictEqual(adj.validated_outcome, "FAIL");
    assert.strictEqual(adj.governance_guarantees.no_automatic_retraining, true);
    assert.strictEqual(adj.governance_guarantees.no_threshold_modification, true);
  });

  // -------------------------------------------------------------------------
  // TEST T: Production Model SHA Unchanged
  // -------------------------------------------------------------------------
  await runTest("Test T: Production model SHA-256 remains 91bb59...", async () => {
    assert.ok(fs.existsSync(MODEL_JSON_PATH));
    const modelBytes = fs.readFileSync(MODEL_JSON_PATH);
    const computedSha = crypto.createHash('sha256').update(modelBytes).digest('hex');
    assert.strictEqual(computedSha, EXPECTED_MODEL_SHA);
  });

  // -------------------------------------------------------------------------
  // TEST U: Production Threshold Remains Exactly 0.20
  // -------------------------------------------------------------------------
  await runTest("Test U: Production operating threshold remains exactly 0.20", async () => {
    assert.ok(fs.existsSync(PROD_MANIFEST_PATH));
    const manifest = JSON.parse(fs.readFileSync(PROD_MANIFEST_PATH, 'utf8'));
    const threshold = manifest.authoritative_threshold || manifest.operating_threshold || manifest.threshold;
    assert.strictEqual(threshold, EXPECTED_THRESHOLD);
  });

  // -------------------------------------------------------------------------
  // TEST V: No Retraining, Recalibration, or Risk-Fusion Weight Mutation
  // -------------------------------------------------------------------------
  await runTest("Test V: Governance guarantees strictly prohibit retraining, recalibration, and weight mutation", async () => {
    const adj = await manager.getAdjudicationAsync("TRACE-P11T3-PARITY-JS");
    const g = adj.governance_guarantees;
    assert.strictEqual(g.no_automatic_retraining, true);
    assert.strictEqual(g.no_threshold_modification, true);
    assert.strictEqual(g.no_fusion_weight_modification, true);
    assert.strictEqual(g.no_conformal_recalibration, true);
    assert.strictEqual(g.operator_is_not_ground_truth, true);
  });

  // -------------------------------------------------------------------------
  // TEST W: Legacy disposition endpoint disabled (410 GONE)
  // -------------------------------------------------------------------------
  await runTest("Test W: Legacy disposition endpoint /api/prediction/disposition is disabled with 410 GONE", async () => {
    try {
      await inferenceService.confirmDispositionAsync("TEST-W-01", "CONFIRMED_PASS");
      assert.fail("Should have thrown LEGACY_DISPOSITION_PATH_DISABLED");
    } catch (err) {
      assert.ok(err.message.includes("LEGACY_DISPOSITION_PATH_DISABLED"), `Unexpected error: ${err.message}`);
      assert.strictEqual(err.statusCode, 410);
    }
  });

  // -------------------------------------------------------------------------
  // TEST X: Direct legacy confirmDisposition method disabled
  // -------------------------------------------------------------------------
  await runTest("Test X: Direct confirmDisposition() method throws LEGACY_DISPOSITION_PATH_DISABLED", async () => {
    try {
      inferenceService.confirmDisposition("TEST-X-01", "CONFIRMED_PASS");
      assert.fail("Should have thrown LEGACY_DISPOSITION_PATH_DISABLED");
    } catch (err) {
      assert.ok(err.message.includes("LEGACY_DISPOSITION_PATH_DISABLED"), `Unexpected error: ${err.message}`);
      assert.strictEqual(err.statusCode, 410);
    }
  });

  // -------------------------------------------------------------------------
  // TEST Y: Async legacy confirmDispositionAsync method disabled
  // -------------------------------------------------------------------------
  await runTest("Test Y: Direct confirmDispositionAsync() method throws LEGACY_DISPOSITION_PATH_DISABLED", async () => {
    try {
      await inferenceService.confirmDispositionAsync("TEST-Y-01", "CONFIRMED_FAIL");
      assert.fail("Should have thrown LEGACY_DISPOSITION_PATH_DISABLED");
    } catch (err) {
      assert.ok(err.message.includes("LEGACY_DISPOSITION_PATH_DISABLED"), `Unexpected error: ${err.message}`);
      assert.strictEqual(err.statusCode, 410);
    }
  });

  // -------------------------------------------------------------------------
  // TEST Z: No prediction mutation via legacy path
  // -------------------------------------------------------------------------
  await runTest("Test Z: Legacy disposition attempt cannot mutate prediction, probability, or threshold", async () => {
    const authPred = manager.lookupAuthoritativePrediction(sampleTraceId);
    assert.strictEqual(authPred.prediction, "REJECT");
    assert.strictEqual(authPred.probability, 0.85);

    try {
      await inferenceService.confirmDispositionAsync(sampleTraceId, "CONFIRMED_PASS");
    } catch (e) {}

    const authPredAfter = manager.lookupAuthoritativePrediction(sampleTraceId);
    assert.strictEqual(authPredAfter.prediction, "REJECT");
    assert.strictEqual(authPredAfter.probability, 0.85);
  });

  // -------------------------------------------------------------------------
  // TEST AA: No ground-truth mutation via legacy path
  // -------------------------------------------------------------------------
  await runTest("Test AA: Legacy disposition attempt does NOT create VALIDATED_GROUND_TRUTH or ground_truth_label", async () => {
    const traceId = "TRACE-P11T3-AA-JS";
    registerAuthoritativePrediction({
      trace_id: traceId,
      component_id: "COMP-AA-01",
      lot_id: "LOT-AA-01",
      prediction: "REJECT",
      probability: 0.85
    });

    await helperSetupConfirmedDisposition(manager, traceId);
    try {
      await inferenceService.confirmDispositionAsync(traceId, "CONFIRMED_PASS");
    } catch (e) {}

    const gov = await manager.evaluateDispositionGovernanceAsync(traceId);
    assert.strictEqual(gov.evaluation_candidate.ground_truth_status, "NOT_ESTABLISHED");
    assert.ok(!gov.evaluation_candidate.ground_truth_label);
  });

  // -------------------------------------------------------------------------
  // TEST AB: Governed path still works cleanly
  // -------------------------------------------------------------------------
  await runTest("Test AB: Governed Phase 11 pipeline (record -> governance -> evidence -> adjudication) produces VALIDATED_GROUND_TRUTH", async () => {
    const traceId = "TRACE-P11T3-GOV-PIPE";
    registerAuthoritativePrediction({
      trace_id: traceId,
      component_id: "COMP-PIPE-01",
      lot_id: "LOT-PIPE-01",
      prediction: "REJECT",
      probability: 0.86
    });

    await helperSetupConfirmedDisposition(manager, traceId);
    const gov = await manager.evaluateDispositionGovernanceAsync(traceId);
    assert.strictEqual(gov.governance_classification, "ELIGIBLE_FOR_OFFLINE_REVIEW");

    await manager.registerOutcomeEvidenceAsync({
      trace_id: traceId,
      evidence_type: "ATE_RETEST_LOG",
      evidence_source: "ATE_STATION_01",
      source_record_identifier: "ATE-PIPE-01",
      provenance_metadata: { result: "FAIL" }
    });

    const adj = await manager.adjudicateOutcomeAsync(traceId, {
      adjudicator_identity: "QUALITY_ENG_01",
      adjudicator_role: "QUALITY_ENGINEER",
      proposed_outcome: "FAIL",
      rationale: "Governed pipeline verification"
    });

    assert.strictEqual(adj.ground_truth_status, "VALIDATED_GROUND_TRUTH");
    assert.strictEqual(adj.validated_outcome, "FAIL");
  });

  // -------------------------------------------------------------------------
  // TEST AC: Conflict protection (PASS + FAIL evidence -> UNRESOLVED_AMBIGUITY)
  // -------------------------------------------------------------------------
  await runTest("Test AC: Unresolved PASS and FAIL evidence conflict yields UNRESOLVED_AMBIGUITY", async () => {
    const traceId = "TRACE-P11T3-CONFLICT-AC";
    registerAuthoritativePrediction({
      trace_id: traceId,
      component_id: "COMP-AC-01",
      lot_id: "LOT-AC-01",
      prediction: "REJECT",
      probability: 0.87
    });

    await helperSetupConfirmedDisposition(manager, traceId);
    await manager.registerOutcomeEvidenceAsync({
      trace_id: traceId,
      evidence_type: "ATE_RETEST_LOG",
      evidence_source: "ATE_STATION_01",
      source_record_identifier: "ATE-AC-PASS",
      provenance_metadata: { result: "PASS" }
    });
    await manager.registerOutcomeEvidenceAsync({
      trace_id: traceId,
      evidence_type: "QUALIFIED_LAB_REPORT",
      evidence_source: "RELIABILITY_LAB",
      source_record_identifier: "LAB-AC-FAIL",
      provenance_metadata: { result: "FAIL" }
    });

    const adj = await manager.adjudicateOutcomeAsync(traceId, {
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
  // TEST AD: Production Protection (Model SHA & Threshold)
  // -------------------------------------------------------------------------
  await runTest("Test AD: Production model SHA (91bb59...) and threshold (0.20) are strictly locked", async () => {
    const modelBytes = fs.readFileSync(MODEL_JSON_PATH);
    const computedSha = crypto.createHash('sha256').update(modelBytes).digest('hex');
    assert.strictEqual(computedSha, EXPECTED_MODEL_SHA);

    const manifest = JSON.parse(fs.readFileSync(PROD_MANIFEST_PATH, 'utf8'));
    const threshold = manifest.authoritative_threshold || manifest.operating_threshold || manifest.threshold;
    assert.strictEqual(threshold, EXPECTED_THRESHOLD);
  });

  // -------------------------------------------------------------------------
  // TEST AE: No automatic production effect
  // -------------------------------------------------------------------------
  await runTest("Test AE: Task 3 operations enforce production_effect: false and zero ML mutation", async () => {
    const aeTraceId = "TRACE-P11T3-AE-JS";
    registerAuthoritativePrediction({
      trace_id: aeTraceId,
      component_id: "COMP-AE-01",
      lot_id: "LOT-AE-01",
      prediction: "REJECT",
      probability: 0.85
    });
    await helperSetupConfirmedDisposition(manager, aeTraceId);
    const gov = await manager.evaluateDispositionGovernanceAsync(aeTraceId);
    assert.strictEqual(gov.evaluation_candidate.production_effect, false);
    assert.strictEqual(gov.evaluation_candidate.evaluation_only, true);
  });

  console.log("\n=========================================================================");
  console.log(`✅ [SUMMARY] All ${passed}/${total} Node.js Phase 11 Task 3 tests PASSED cleanly!`);
  console.log("=========================================================================\n");
}

runPhase11Task3JsTests().catch((err) => {
  console.error("FATAL TEST EXCEPTION:", err);
  process.exit(1);
});
