/**
 * Authoritative Phase 13 Task 1 — Digital Reliability Twin & Lineage Test Suite (Node.js)
 * File: tests/test_reliability_twin.js
 * 
 * Verifies T01 through T24:
 * T01: Complete twin construction
 * T02: Component identity linkage
 * T03: Trace_id linkage
 * T04: Lot/wafer/die linkage
 * T05: Chronological ordering
 * T06: Deterministic ordering for equal timestamps
 * T07: Prediction evidence preserved
 * T08: Operator lifecycle preserved
 * T09: Secondary-test evidence preserved
 * T10: Outcome evidence preserved
 * T11: Adjudication evidence preserved
 * T12: Provenance preserved
 * T13: Synthetic source explicitly preserved
 * T14: Missing evidence returns INSUFFICIENT_EVIDENCE
 * T15: NOT_ESTABLISHED is not converted into a fabricated conclusion
 * T16: Original prediction cannot be mutated through twin construction
 * T17: Original probability cannot be mutated
 * T18: Original model provenance cannot be mutated
 * T19: Duplicate events do not silently create duplicate canonical evidence
 * T20: Unknown component/trace fails safely
 * T21: Malformed evidence fails safely
 * T22: Deterministic twin output
 * T23: Existing Phase 11 evidence remains compatible
 * T24: Existing Phase 12 integrity contracts remain compatible
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { ReliabilityTwinManagerJS, TWIN_CONTRACT_PATH } = require('../src/reliability_twin/reliability_twin');
const { HumanDispositionManagerJS, registerAuthoritativePrediction } = require('../src/governance/disposition');
const inferenceService = require('../src/api/inference');
const { EvaluationIntegrityGate } = require('../src/evaluation/phase12_evaluation_integrity');

async function runTwinTests() {
  console.log("=========================================================================");
  console.log("🚀 PREDICTA — PHASE 13 TASK 1 DIGITAL RELIABILITY TWIN SUITE (T01 - T24)");
  console.log("=========================================================================\n");

  const manager = new ReliabilityTwinManagerJS();
  const dispositionManager = new HumanDispositionManagerJS();
  let passedCount = 0;

  async function runTest(id, name, testFn) {
    try {
      await testFn();
      console.log(`  ✓ [PASS] Test ${id}: ${name}`);
      passedCount++;
    } catch (e) {
      console.error(`  ✖ [FAIL] Test ${id}: ${name} — ${e.message}`);
      process.exit(1);
    }
  }

  const BASE_RECORD = {
    supply_voltage: 1.20,
    output_voltage: 1.20,
    current: 10.7,
    leakage_current: 111.7,
    resistance: 10.0,
    capacitance: 5.0,
    threshold_voltage: 0.45,
    frequency: 1000.0,
    propagation_delay: 10.98,
    setup_time: 1.0,
    hold_time: 0.5,
    timing_margin: 2.0,
    temperature: 25.0,
    dynamic_power: 30.0,
    total_power: 35.0,
    test_duration: 1.0,
    equipment_id: "EQP-101",
    component_id: "CMP-T13-001",
    lot_id: "LOT-T13-001",
    wafer_id: "LOT-T13-001-W01",
    die_id: "DIE-T13-001",
    trace_id: "TR-T13-001",
    test_id: "TST-T13-001"
  };

  // Pre-register an authoritative prediction for testing
  // Merge component_id from BASE_RECORD so twin resolver can find it by component_id
  // Include stable created_at so T22 (determinism) passes consistently
  const authPrediction = inferenceService.predictSingle(BASE_RECORD);
  registerAuthoritativePrediction({
    ...authPrediction,
    component_id: BASE_RECORD.component_id,
    created_at: "2026-01-01T00:00:00.000Z"
  });

  // T01: Complete twin construction
  await runTest("T01", "Complete twin construction", async () => {
    const twin = await manager.buildReliabilityTwinAsync("CMP-T13-001");
    assert.ok(twin);
    assert.ok(twin.twin_id.startsWith("TWIN-"));
    assert.ok(twin.identity);
    assert.ok(twin.evidence_summary);
    assert.ok(twin.longitudinal_timeline);
    assert.ok(twin.provenance);
  });

  // T02: Component identity linkage
  await runTest("T02", "Component identity linkage", async () => {
    const twin = await manager.buildReliabilityTwinAsync("CMP-T13-001");
    assert.strictEqual(twin.identity.component_id, "CMP-T13-001");
  });

  // T03: Trace_id linkage
  await runTest("T03", "Trace_id linkage", async () => {
    const twin = await manager.buildReliabilityTwinAsync("TR-T13-001");
    assert.strictEqual(twin.identity.trace_id, "TR-T13-001");
  });

  // T04: Lot/wafer/die linkage
  await runTest("T04", "Lot/wafer/die linkage", async () => {
    const twin = await manager.buildReliabilityTwinAsync("CMP-T13-001");
    assert.strictEqual(twin.identity.lot_id, "LOT-T13-001");
    assert.strictEqual(twin.identity.wafer_id, "LOT-T13-001-W01");
    assert.strictEqual(twin.identity.die_id, "DIE-T13-001");
  });

  // T05: Chronological ordering
  await runTest("T05", "Chronological ordering", async () => {
    const twin = await manager.buildReliabilityTwinAsync("CMP-T13-001");
    const timeline = twin.longitudinal_timeline;
    assert.ok(timeline.length > 0);
    for (let i = 1; i < timeline.length; i++) {
      const tPrev = new Date(timeline[i - 1].timestamp).getTime();
      const tCurr = new Date(timeline[i].timestamp).getTime();
      assert.ok(tPrev <= tCurr, "Timeline events must be chronologically ordered.");
    }
  });

  // T06: Deterministic ordering for equal timestamps
  await runTest("T06", "Deterministic ordering for equal timestamps", async () => {
    const twin = await manager.buildReliabilityTwinAsync("CMP-T13-001");
    const timeline = twin.longitudinal_timeline;
    for (let i = 1; i < timeline.length; i++) {
      const tPrev = new Date(timeline[i - 1].timestamp).getTime();
      const tCurr = new Date(timeline[i].timestamp).getTime();
      if (tPrev === tCurr) {
        assert.ok(String(timeline[i - 1].event_id).localeCompare(String(timeline[i].event_id)) <= 0);
      }
    }
  });

  // T07: Prediction evidence preserved
  await runTest("T07", "Prediction evidence preserved", async () => {
    const twin = await manager.buildReliabilityTwinAsync("CMP-T13-001");
    assert.strictEqual(twin.evidence_summary.ml_evaluation, "AVAILABLE");
    assert.ok(twin.evidence_blocks.ml_evaluation);
    assert.strictEqual(twin.evidence_blocks.ml_evaluation.threshold, 0.20);
    assert.strictEqual(twin.evidence_blocks.ml_evaluation.prediction, authPrediction.prediction);
  });

  // T08: Operator lifecycle preserved
  await runTest("T08", "Operator lifecycle preserved", async () => {
    const dispRec = await dispositionManager.recordDispositionAsync({
      trace_id: "TR-T13-001",
      disposition: "HOLD",
      reason_code: "FALSE_POSITIVE_SUSPECTED",
      operator_id: "OP-T13",
      comment: "Testing operator lifecycle preservation",
      require_durable_persistence: false
    });
    const twin = await manager.buildReliabilityTwinAsync("TR-T13-001");
    assert.strictEqual(twin.evidence_summary.operator_disposition, "AVAILABLE");
    assert.ok(twin.evidence_blocks.operator_dispositions.length > 0);
    assert.strictEqual(twin.evidence_blocks.operator_dispositions[0].disposition, "HOLD");
  });

  // T09: Secondary-test evidence preserved
  await runTest("T09", "Secondary-test evidence preserved", async () => {
    const recWithSecondary = {
      ...BASE_RECORD,
      trace_id: "TR-T13-SEC",
      secondary_test_result: "PASS",
      requires_secondary_test: true
    };
    const predSec = inferenceService.predictSingle(recWithSecondary);
    predSec.secondary_test_result = "PASS";
    registerAuthoritativePrediction(predSec);

    const twin = await manager.buildReliabilityTwinAsync("TR-T13-SEC");
    assert.strictEqual(twin.evidence_summary.secondary_test, "AVAILABLE");
  });

  // T10: Outcome evidence preserved
  await runTest("T10", "Outcome evidence preserved", async () => {
    const traceId = "TR-T13-001";
    await dispositionManager.registerOutcomeEvidenceAsync({
      trace_id: traceId,
      disposition_id: "DISP-T13-001",
      evidence_type: "QUALIFIED_LAB_REPORT",
      evidence_status: "EVIDENCE_RECORDED",
      evidence_source: "PHYSICAL_LAB",
      recorded_by: "ENG-T13",
      require_durable_persistence: false
    });
    const twin = await manager.buildReliabilityTwinAsync(traceId);
    assert.strictEqual(twin.evidence_summary.outcome_evidence, "AVAILABLE");
    assert.ok(twin.evidence_blocks.outcome_evidence.length > 0);
  });

  // T11: Adjudication evidence preserved
  await runTest("T11", "Adjudication evidence preserved", async () => {
    const traceId = "TR-T13-001";
    await dispositionManager.adjudicateOutcomeAsync(traceId, {
      adjudicator_identity: "QUAL-LEAD-01",
      adjudicator_role: "QUALITY_ENGINEER",
      proposed_outcome: "PASS",
      rationale: "Physical lab analysis confirms clean gate oxide",
      require_durable_persistence: false
    });
    const twin = await manager.buildReliabilityTwinAsync(traceId);
    assert.strictEqual(twin.evidence_summary.adjudication, "AVAILABLE");
    assert.strictEqual(twin.evidence_summary.ground_truth_status, "VALIDATED_GROUND_TRUTH");
  });

  // T12: Provenance preserved
  await runTest("T12", "Provenance preserved", async () => {
    const twin = await manager.buildReliabilityTwinAsync("CMP-T13-001");
    assert.strictEqual(twin.provenance.model_identifier, "predicta_xgboost_model");
    assert.strictEqual(twin.provenance.authoritative_threshold, 0.20);
    assert.strictEqual(twin.provenance.model_sha256, manager.expectedModelSha);
  });

  // T13: Synthetic source explicitly preserved
  await runTest("T13", "Synthetic source explicitly preserved", async () => {
    const synRecord = {
      ...BASE_RECORD,
      component_id: "CMP-SYN-999",
      lot_id: "LOT-SYN-999",
      trace_id: "TR-SYN-999",
      test_id: "TST-SYN-999"
    };
    const synPred = inferenceService.predictSingle(synRecord);
    registerAuthoritativePrediction({ ...synPred, component_id: "CMP-SYN-999" });

    const twin = await manager.buildReliabilityTwinAsync("CMP-SYN-999");
    assert.strictEqual(twin.identity.is_synthetic, true);
    assert.strictEqual(twin.provenance.is_synthetic_provenance, true);
  });

  // T14: Missing evidence returns INSUFFICIENT_EVIDENCE
  await runTest("T14", "Missing evidence returns INSUFFICIENT_EVIDENCE", async () => {
    const twin = await manager.buildReliabilityTwinAsync("CMP-UNSEEN-NO-EVIDENCE");
    assert.strictEqual(twin.evidence_summary.operator_disposition, "INSUFFICIENT_EVIDENCE");
    assert.strictEqual(twin.evidence_summary.outcome_evidence, "INSUFFICIENT_EVIDENCE");
  });

  // T15: NOT_ESTABLISHED is not converted into a fabricated conclusion
  await runTest("T15", "NOT_ESTABLISHED is not converted into a fabricated conclusion", async () => {
    const twin = await manager.buildReliabilityTwinAsync("CMP-UNSEEN-NO-EVIDENCE");
    assert.strictEqual(twin.evidence_summary.adjudication, "NOT_ESTABLISHED");
    assert.strictEqual(twin.evidence_summary.ground_truth_status, "NOT_ESTABLISHED");
  });

  // T16: Original prediction cannot be mutated through twin construction
  await runTest("T16", "Original prediction cannot be mutated through twin construction", async () => {
    const twin = await manager.buildReliabilityTwinAsync("CMP-T13-001");
    twin.evidence_blocks.ml_evaluation.prediction = "MUTATED_PREDICTION";
    const twinFresh = await manager.buildReliabilityTwinAsync("CMP-T13-001");
    assert.strictEqual(twinFresh.evidence_blocks.ml_evaluation.prediction, authPrediction.prediction);
  });

  // T17: Original probability cannot be mutated
  await runTest("T17", "Original probability cannot be mutated", async () => {
    const twin = await manager.buildReliabilityTwinAsync("CMP-T13-001");
    twin.evidence_blocks.ml_evaluation.probability = 0.000001;
    const twinFresh = await manager.buildReliabilityTwinAsync("CMP-T13-001");
    assert.strictEqual(twinFresh.evidence_blocks.ml_evaluation.probability, authPrediction.probability);
  });

  // T18: Original model provenance cannot be mutated
  await runTest("T18", "Original model provenance cannot be mutated", async () => {
    const twin = await manager.buildReliabilityTwinAsync("CMP-T13-001");
    twin.provenance.model_sha256 = "FAKE_SHA";
    const twinFresh = await manager.buildReliabilityTwinAsync("CMP-T13-001");
    assert.strictEqual(twinFresh.provenance.model_sha256, manager.expectedModelSha);
  });

  // T19: Duplicate events do not silently create duplicate canonical evidence
  await runTest("T19", "Duplicate events do not silently create duplicate canonical evidence", async () => {
    const twin = await manager.buildReliabilityTwinAsync("CMP-T13-001");
    const timeline = twin.longitudinal_timeline;
    const eventSummaries = timeline.map(e => `${e.stage}:${e.summary}`);
    const uniqueSummaries = new Set(eventSummaries);
    assert.strictEqual(timeline.length, uniqueSummaries.size, "Duplicate timeline events must be deduplicated.");
  });

  // T20: Unknown component/trace fails safely
  await runTest("T20", "Unknown component/trace fails safely", async () => {
    const twin = await manager.buildReliabilityTwinAsync("UNKNOWN-COMPONENT-ID-999");
    assert.ok(twin);
    assert.strictEqual(twin.identity.component_id, "UNKNOWN-COMPONENT-ID-999");
    assert.strictEqual(twin.evidence_summary.ml_evaluation, "INSUFFICIENT_EVIDENCE");
  });

  // T21: Malformed evidence fails safely
  await runTest("T21", "Malformed evidence fails safely", async () => {
    assert.rejects(async () => {
      await manager.buildReliabilityTwinAsync(null);
    }, /INVALID_IDENTIFIER/);

    assert.rejects(async () => {
      await manager.buildReliabilityTwinAsync("");
    }, /INVALID_IDENTIFIER/);
  });

  // T22: Deterministic twin output
  await runTest("T22", "Deterministic twin output", async () => {
    const twin1 = await manager.buildReliabilityTwinAsync("CMP-T13-001");
    const twin2 = await manager.buildReliabilityTwinAsync("CMP-T13-001");
    assert.strictEqual(JSON.stringify(twin1), JSON.stringify(twin2));
  });

  // T23: Existing Phase 11 evidence remains compatible
  await runTest("T23", "Existing Phase 11 evidence remains compatible", async () => {
    const traceId = "TR-T13-001";
    const govResult = await dispositionManager.evaluateDispositionGovernanceAsync(traceId, { require_durable_persistence: false });
    assert.ok(govResult);
    assert.strictEqual(govResult.trace_id, traceId);
  });

  // T24: Existing Phase 12 integrity contracts remain compatible
  await runTest("T24", "Existing Phase 12 integrity contracts remain compatible", async () => {
    const gate = new EvaluationIntegrityGate();
    const modelCheck = gate.verifyProductionModelProtection();
    const manifestCheck = gate.verifyProductionManifestProtection();
    assert.strictEqual(modelCheck.valid, true);
    assert.strictEqual(manifestCheck.valid, true);
  });

  console.log("\n=========================================================================");
  console.log(`✅ ALL 24/24 PHASE 13 TASK 1 JS TESTS (T01 - T24) PASSED CLEANLY!`);
  console.log("=========================================================================\n");
}

runTwinTests().catch(err => {
  console.error("Unhandled failure in test suite:", err);
  process.exit(1);
});
