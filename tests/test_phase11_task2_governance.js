/**
 * PREDICTA — PHASE 11 TASK 2 HUMAN FEEDBACK GOVERNANCE & OFFLINE EVALUATION TEST SUITE (Node.js)
 * File: tests/test_phase11_task2_governance.js
 * 
 * Verifies Phase 11 Task 2 Requirements:
 * 1. Eligibility contract evaluation (ELIGIBLE_FOR_OFFLINE_REVIEW vs REJECTED_GOVERNANCE)
 * 2. Strict separation between operator feedback and ground truth (ground_truth_status === "NOT_ESTABLISHED")
 * 3. Conflict governance (conflicting operators yield REJECTED_GOVERNANCE, preserve all records)
 * 4. Offline evaluation candidate generation (evaluation_only: true, production_effect: false)
 * 5. Database-authoritative history reconstruction across cold starts / memory wipes
 * 6. Dataset leakage prevention & test set isolation
 * 7. Production protection (Model SHA 91bb59..., threshold 0.20, no retraining, no recalibration)
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
  DISPOSITION_CONTRACT_PATH
} = require('../src/governance/disposition');

console.log("=========================================================================");
console.log("🚀 PREDICTA — PHASE 11 TASK 2 GOVERNANCE & EVALUATION TEST SUITE (JS)");
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

async function runPhase11Task2JsTests() {
  const manager = new HumanDispositionManagerJS();

  // Test setup: Register authoritative predictions
  const sampleTraceId = "TRACE-P11T2-001";
  registerAuthoritativePrediction({
    trace_id: sampleTraceId,
    component_id: "COMP-P11T2-001",
    lot_id: "LOT-P11T2-001",
    prediction: "REJECT",
    probability: 0.85,
    anomaly_score: 0.92,
    prognostic_summary: "CRITICAL_DEGRADATION"
  });

  const conflictTraceId = "TRACE-P11T2-CONFLICT";
  registerAuthoritativePrediction({
    trace_id: conflictTraceId,
    component_id: "COMP-P11T2-CONF",
    lot_id: "LOT-P11T2-CONF",
    prediction: "REJECT",
    probability: 0.88,
    anomaly_score: 0.90
  });

  const unresolvedTraceId = "TRACE-P11T2-UNRESOLVED";
  registerAuthoritativePrediction({
    trace_id: unresolvedTraceId,
    component_id: "COMP-P11T2-UNRES",
    lot_id: "LOT-P11T2-UNRES",
    prediction: "ACCEPT",
    probability: 0.12
  });

  const benchmarkTraceId = "BENCHMARK_TRACE_001";
  registerAuthoritativePrediction({
    trace_id: benchmarkTraceId,
    component_id: "COMP-BENCH-01",
    lot_id: "LOT-BENCH-01",
    prediction: "REJECT",
    probability: 0.75
  });

  // -------------------------------------------------------------------------
  // TEST 1: Valid Candidate -> ELIGIBLE_FOR_OFFLINE_REVIEW
  // -------------------------------------------------------------------------
  await runTest("Valid complete record yields ELIGIBLE_FOR_OFFLINE_REVIEW", async () => {
    const disp = await manager.recordDispositionAsync({
      trace_id: sampleTraceId,
      disposition: "REJECT",
      reason_code: "FALSE_POSITIVE_SUSPECTED",
      operator_id: "OPERATOR_QUAL_01",
      comment: "Verified offline candidate candidate test"
    });

    await manager.updateFeedbackStatusAsync(sampleTraceId, disp.disposition_id, "CONFIRMED", "OPERATOR_QUAL_01", "Lab confirmation completed");

    const gov = await manager.evaluateDispositionGovernanceAsync(sampleTraceId);
    assert.strictEqual(gov.governance_classification, "ELIGIBLE_FOR_OFFLINE_REVIEW");
    assert.strictEqual(gov.rejection_reasons.length, 0);
    assert.ok(gov.evaluation_candidate);
    assert.strictEqual(gov.evaluation_candidate.trace_id, sampleTraceId);
    assert.strictEqual(gov.evaluation_candidate.ground_truth_status, "NOT_ESTABLISHED");
    assert.strictEqual(gov.evaluation_candidate.evaluation_only, true);
    assert.strictEqual(gov.evaluation_candidate.production_effect, false);
  });

  // -------------------------------------------------------------------------
  // TEST 2: Missing ML Provenance -> REJECTED_GOVERNANCE
  // -------------------------------------------------------------------------
  await runTest("Missing or corrupted ML model provenance yields REJECTED_GOVERNANCE", async () => {
    const badManager = new HumanDispositionManagerJS(
      DISPOSITION_CONTRACT_PATH,
      PROD_MANIFEST_PATH,
      MODEL_JSON_PATH
    );
    badManager.expectedModelSha = "0000000000000000000000000000000000000000000000000000000000000000";

    const gov = await badManager.evaluateDispositionGovernanceAsync(sampleTraceId);
    assert.strictEqual(gov.governance_classification, "REJECTED_GOVERNANCE");
    assert.ok(gov.rejection_reasons.includes("INVALID_MODEL_PROVENANCE"));
    assert.strictEqual(gov.evaluation_candidate, null);
  });

  // -------------------------------------------------------------------------
  // TEST 3: Missing Authoritative Prediction -> REJECTED_GOVERNANCE
  // -------------------------------------------------------------------------
  await runTest("Missing authoritative prediction record yields REJECTED_GOVERNANCE", async () => {
    const gov = await manager.evaluateDispositionGovernanceAsync("TRACE-NONEXISTENT-999");
    assert.strictEqual(gov.governance_classification, "REJECTED_GOVERNANCE");
    assert.ok(gov.rejection_reasons.includes("AUTHORITATIVE_ML_RECORD_NOT_FOUND"));
    assert.strictEqual(gov.evaluation_candidate, null);
  });

  // -------------------------------------------------------------------------
  // TEST 4: Client-Supplied ML Snapshot -> Rejected
  // -------------------------------------------------------------------------
  await runTest("Client-supplied ML snapshot injection attempt is rejected", async () => {
    let errOccurred = false;
    try {
      await manager.recordDispositionAsync({
        trace_id: sampleTraceId,
        disposition: "REJECT",
        reason_code: "FALSE_POSITIVE_SUSPECTED",
        probability: 0.10,
        ground_truth: "PASS"
      });
    } catch (err) {
      errOccurred = true;
      assert.ok(err.message.includes("CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED"));
    }
    assert.ok(errOccurred, "Expected error on client-supplied ML fields");
  });

  // -------------------------------------------------------------------------
  // TEST 5: Operator Feedback is Not Ground Truth
  // -------------------------------------------------------------------------
  await runTest("Operator CONFIRMED disposition does NOT set ground truth label", async () => {
    const gov = await manager.evaluateDispositionGovernanceAsync(sampleTraceId);
    assert.strictEqual(gov.evaluation_candidate.ground_truth_status, "NOT_ESTABLISHED");
    assert.notStrictEqual(gov.evaluation_candidate.ground_truth_status, "PASS");
    assert.notStrictEqual(gov.evaluation_candidate.ground_truth_status, "FAIL");
  });

  // -------------------------------------------------------------------------
  // TEST 6: Conflicting Operators -> REJECTED_GOVERNANCE
  // -------------------------------------------------------------------------
  await runTest("Conflicting operator dispositions yield REJECTED_GOVERNANCE with preserved ledger", async () => {
    const disp1 = await manager.recordDispositionAsync({
      trace_id: conflictTraceId,
      disposition: "ACCEPT",
      reason_code: "FALSE_POSITIVE_SUSPECTED",
      operator_id: "OPERATOR_01"
    });
    await manager.updateFeedbackStatusAsync(conflictTraceId, disp1.disposition_id, "CONFIRMED", "OPERATOR_01");

    const disp2 = await manager.recordDispositionAsync({
      trace_id: conflictTraceId,
      disposition: "REJECT",
      reason_code: "PROCESS_EXCEPTION",
      operator_id: "OPERATOR_02"
    });
    await manager.updateFeedbackStatusAsync(conflictTraceId, disp2.disposition_id, "CONFIRMED", "OPERATOR_02");

    const history = await manager.getDispositionAsync(conflictTraceId);
    assert.strictEqual(history.total_dispositions, 2);
    assert.strictEqual(history.has_conflict, true);

    const gov = await manager.evaluateDispositionGovernanceAsync(conflictTraceId);
    assert.strictEqual(gov.governance_classification, "REJECTED_GOVERNANCE");
    assert.ok(gov.rejection_reasons.some(r => r.includes("UNRESOLVED_GOVERNANCE_CONFLICT")));
    assert.strictEqual(gov.evaluation_candidate, null);
  });

  // -------------------------------------------------------------------------
  // TEST 7: Unresolved Lifecycle -> REJECTED_GOVERNANCE
  // -------------------------------------------------------------------------
  await runTest("Unresolved lifecycle status yields REJECTED_GOVERNANCE", async () => {
    const disp = await manager.recordDispositionAsync({
      trace_id: unresolvedTraceId,
      disposition: "HOLD",
      reason_code: "INSUFFICIENT_DATA",
      operator_id: "OPERATOR_03"
    });
    await manager.updateFeedbackStatusAsync(unresolvedTraceId, disp.disposition_id, "UNRESOLVED", "OPERATOR_03");

    const gov = await manager.evaluateDispositionGovernanceAsync(unresolvedTraceId);
    assert.strictEqual(gov.governance_classification, "REJECTED_GOVERNANCE");
    assert.ok(gov.rejection_reasons.some(r => r.includes("UNRESOLVED_LIFECYCLE_STATUS")));
  });

  // -------------------------------------------------------------------------
  // TEST 8: Missing Lifecycle History -> Fail Closed
  // -------------------------------------------------------------------------
  await runTest("Missing lifecycle history fails closed (REJECTED_GOVERNANCE)", async () => {
    const noEvtTraceId = "TRACE-P11T2-NOEVT";
    registerAuthoritativePrediction({
      trace_id: noEvtTraceId,
      component_id: "COMP-NOEVT",
      lot_id: "LOT-NOEVT",
      prediction: "REJECT",
      probability: 0.90
    });

    const disp = await manager.recordDispositionAsync({
      trace_id: noEvtTraceId,
      disposition: "REJECT",
      reason_code: "EQUIPMENT_ISSUE",
      operator_id: "OPERATOR_04"
    });

    // Clear lifecycle events map entry manually to simulate corrupt/missing lifecycle history
    const { _LIFECYCLE_EVENTS } = require('../src/governance/disposition');
    _LIFECYCLE_EVENTS.delete(disp.disposition_id);

    const gov = await manager.evaluateDispositionGovernanceAsync(noEvtTraceId);
    assert.strictEqual(gov.governance_classification, "REJECTED_GOVERNANCE");
    assert.ok(gov.rejection_reasons.some(r => r.includes("MISSING_LIFECYCLE_HISTORY")));
    assert.strictEqual(gov.evaluation_candidate, null);
  });

  // -------------------------------------------------------------------------
  // TEST A: Governed Evaluation without DB Client (require_durable_persistence=true) -> PERSISTENCE_ERROR
  // -------------------------------------------------------------------------
  await runTest("Governed evaluation without DB client and require_durable_persistence=true throws PERSISTENCE_ERROR", async () => {
    const noDbManager = new HumanDispositionManagerJS(
      DISPOSITION_CONTRACT_PATH,
      PROD_MANIFEST_PATH,
      MODEL_JSON_PATH,
      null
    );
    let thrown = false;
    try {
      await noDbManager.evaluateDispositionGovernanceAsync(sampleTraceId, { require_durable_persistence: true });
    } catch (err) {
      thrown = true;
      assert.ok(err.message.includes("PERSISTENCE_ERROR"), `Expected PERSISTENCE_ERROR, got: ${err.message}`);
    }
    assert.ok(thrown, "Expected evaluateDispositionGovernanceAsync to throw PERSISTENCE_ERROR when require_durable_persistence=true without DB client");
  });

  // -------------------------------------------------------------------------
  // TEST B / 9: Cold Start / Restart Reconstruction from Durable Storage
  // -------------------------------------------------------------------------
  await runTest("Restart reconstruction loads history from durable database client", async () => {
    const restartTraceId = "TRACE-RESTART-001";
    registerAuthoritativePrediction({
      trace_id: restartTraceId,
      component_id: "COMP-RESTART",
      lot_id: "LOT-RESTART",
      prediction: "REJECT",
      probability: 0.82
    });

    const mockSupabase = {
      from: (table) => {
        if (table === 'operator_dispositions') {
          return {
            select: () => ({
              eq: (col, val) => Promise.resolve({
                data: [{
                  disposition_id: "DISP-DURABLE-001",
                  trace_id: restartTraceId,
                  component_id: "COMP-RESTART",
                  lot_id: "LOT-RESTART",
                  operator_id: "OPERATOR_DURABLE",
                  disposition: "REJECT",
                  reason_code: "MANUAL_ENGINEERING_REVIEW",
                  created_at: new Date().toISOString(),
                  model_id_at_decision: "predicta_xgboost_model",
                  model_hash_at_decision: EXPECTED_MODEL_SHA,
                  original_ml_decision: "REJECT",
                  original_ml_probability: 0.82,
                  feedback_status: "CONFIRMED",
                  conflict: false
                }],
                error: null
              })
            })
          };
        }
        if (table === 'disposition_lifecycle_events') {
          return {
            select: () => ({
              eq: (col, val) => Promise.resolve({
                data: [{
                  event_id: "EVT-DURABLE-001",
                  disposition_id: "DISP-DURABLE-001",
                  trace_id: restartTraceId,
                  previous_status: "RECORDED_ONLY",
                  new_status: "CONFIRMED",
                  changed_by: "OPERATOR_DURABLE",
                  timestamp: new Date().toISOString()
                }],
                error: null
              })
            })
          };
        }
        return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
      }
    };

    const durableManager = new HumanDispositionManagerJS(
      DISPOSITION_CONTRACT_PATH,
      PROD_MANIFEST_PATH,
      MODEL_JSON_PATH,
      mockSupabase
    );

    const gov = await durableManager.evaluateDispositionGovernanceAsync(restartTraceId);
    assert.strictEqual(gov.governance_classification, "ELIGIBLE_FOR_OFFLINE_REVIEW");
    assert.strictEqual(gov.evaluation_candidate.trace_id, restartTraceId);
    assert.strictEqual(gov.evaluation_candidate.lifecycle_status, "CONFIRMED");
  });

  // -------------------------------------------------------------------------
  // TEST D: isValidProbability rejects booleans
  // -------------------------------------------------------------------------
  await runTest("isValidProbability strictly rejects booleans (true/false)", async () => {
    const { isValidProbability } = require('../src/governance/disposition');
    assert.strictEqual(isValidProbability(true), false);
    assert.strictEqual(isValidProbability(false), false);
  });

  // -------------------------------------------------------------------------
  // TEST E: isValidProbability rejects NaN, Infinity, -Infinity
  // -------------------------------------------------------------------------
  await runTest("isValidProbability strictly rejects NaN, Infinity, -Infinity", async () => {
    const { isValidProbability } = require('../src/governance/disposition');
    assert.strictEqual(isValidProbability(NaN), false);
    assert.strictEqual(isValidProbability(Infinity), false);
    assert.strictEqual(isValidProbability(-Infinity), false);
  });

  // -------------------------------------------------------------------------
  // TEST F: isValidProbability bounds validation
  // -------------------------------------------------------------------------
  await runTest("isValidProbability bounds validation (-0.01, 1.01, string, null, 0.0, 1.0)", async () => {
    const { isValidProbability } = require('../src/governance/disposition');
    assert.strictEqual(isValidProbability(-0.01), false);
    assert.strictEqual(isValidProbability(1.01), false);
    assert.strictEqual(isValidProbability("0.5"), false);
    assert.strictEqual(isValidProbability(null), false);
    assert.strictEqual(isValidProbability(undefined), false);
    assert.strictEqual(isValidProbability(0.0), true);
    assert.strictEqual(isValidProbability(1.0), true);
    assert.strictEqual(isValidProbability(0.5), true);
  });

  // -------------------------------------------------------------------------
  // TEST G: extractOriginalMlDecision fallback order
  // -------------------------------------------------------------------------
  await runTest("extractOriginalMlDecision fallback order (prediction -> disposition -> decision)", async () => {
    const { extractOriginalMlDecision } = require('../src/governance/disposition');
    assert.strictEqual(extractOriginalMlDecision({ prediction: "REJECT", disposition: "ACCEPT", decision: "HOLD" }), "REJECT");
    assert.strictEqual(extractOriginalMlDecision({ disposition: "ACCEPT", decision: "HOLD" }), "ACCEPT");
    assert.strictEqual(extractOriginalMlDecision({ decision: "HOLD" }), "HOLD");
    assert.strictEqual(extractOriginalMlDecision({ prediction: null, disposition: "ACCEPT" }), "ACCEPT");
    assert.strictEqual(extractOriginalMlDecision({ prediction: undefined, disposition: null, decision: "HOLD" }), "HOLD");
    assert.strictEqual(extractOriginalMlDecision(null), null);
  });

  // -------------------------------------------------------------------------
  // TEST 10: Leakage Protection & Benchmark Isolation
  // -------------------------------------------------------------------------
  await runTest("Benchmark traces are protected against evaluation dataset leakage", async () => {
    const disp = await manager.recordDispositionAsync({
      trace_id: benchmarkTraceId,
      disposition: "REJECT",
      reason_code: "PROCESS_EXCEPTION",
      operator_id: "OPERATOR_05"
    });
    await manager.updateFeedbackStatusAsync(benchmarkTraceId, disp.disposition_id, "CONFIRMED", "OPERATOR_05");

    const gov = await manager.evaluateDispositionGovernanceAsync(benchmarkTraceId);
    assert.strictEqual(gov.governance_classification, "REJECTED_GOVERNANCE");
    assert.ok(gov.rejection_reasons.some(r => r.includes("TEST_SET_ISOLATION_PROTECTED")));
  });

  // -------------------------------------------------------------------------
  // TEST 11: Production Model Protection
  // -------------------------------------------------------------------------
  await runTest("Production model artifact SHA is unchanged", async () => {
    const content = fs.readFileSync(MODEL_JSON_PATH, 'utf-8').replace(/\r\n/g, '\n');
    const sha = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
    assert.strictEqual(sha, EXPECTED_MODEL_SHA, "Production model SHA MUST remain untouched");
  });

  // -------------------------------------------------------------------------
  // TEST 12: Threshold Protection
  // -------------------------------------------------------------------------
  await runTest("Production operating threshold remains exactly 0.20", async () => {
    const manifest = JSON.parse(fs.readFileSync(PROD_MANIFEST_PATH, 'utf-8'));
    const threshold = manifest.authoritative_threshold || manifest.operating_threshold || manifest.threshold;
    assert.strictEqual(threshold, EXPECTED_THRESHOLD, "Threshold must remain 0.20");
  });

  // -------------------------------------------------------------------------
  // TEST 13 & 14: No Retraining & No Recalibration
  // -------------------------------------------------------------------------
  await runTest("No retraining or recalibration artifacts generated", async () => {
    const gov = await manager.evaluateDispositionGovernanceAsync(sampleTraceId);
    assert.strictEqual(gov.governance_guarantees.no_automatic_retraining, true);
    assert.strictEqual(gov.governance_guarantees.no_threshold_modification, true);
    assert.strictEqual(gov.governance_guarantees.no_conformal_recalibration, true);
  });

  console.log("\n=========================================================================");
  console.log(`✅ ALL ${passed}/${total} PHASE 11 TASK 2 JS GOVERNANCE TESTS PASSED SUCCESSFULLY!`);
  console.log("=========================================================================\n");
}

runPhase11Task2JsTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
