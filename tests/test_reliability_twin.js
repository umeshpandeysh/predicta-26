/**
 * Authoritative Phase 13 Task 1 — Digital Reliability Twin & Lineage Test Suite (Node.js)
 * File: tests/test_reliability_twin.js
 *
 * Strict 24-point lineage verification without evidence fabrication:
 *  - T01: Canonical twin construction
 *  - T02: Authoritative component linkage
 *  - T03: Authoritative trace linkage
 *  - T04: Missing lot/wafer/die remains missing (null)
 *  - T05: Missing equipment remains missing (null)
 *  - T06: No fabricated manufacturing event
 *  - T07: Actual telemetry / prediction details preserved when available
 *  - T08: Chronological ordering
 *  - T09: Deterministic equal-timestamp ordering
 *  - T10: Prediction evidence preserved exactly
 *  - T11: Probability preserved exactly
 *  - T12: Threshold not rewritten
 *  - T13: Model provenance preserved
 *  - T14: Missing anomaly = INSUFFICIENT_EVIDENCE
 *  - T15: Missing prognostic = INSUFFICIENT_EVIDENCE
 *  - T16: Missing physics / unestablished signals = INSUFFICIENT_EVIDENCE
 *  - T17: Missing operator evidence = INSUFFICIENT_EVIDENCE
 *  - T18: Missing outcome evidence = INSUFFICIENT_EVIDENCE
 *  - T19: Missing adjudication = NOT_ESTABLISHED
 *  - T20: Synthetic evidence explicitly labelled (is_synthetic: true)
 *  - T21: Twin cannot mutate source evidence
 *  - T22: No fabricated timestamps (null when not authoritative)
 *  - T23: Deterministic twin output
 *  - T24: Phase 11/12 compatibility
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { ReliabilityTwinManagerJS, TWIN_CONTRACT_PATH } = require('../src/reliability_twin/reliability_twin');
const { HumanDispositionManagerJS, registerAuthoritativePrediction, _AUTHORITATIVE_PREDICTIONS } = require('../src/governance/disposition');
const inferenceService = require('../src/api/inference');
const { EvaluationIntegrityGate } = require('../src/evaluation/phase12_evaluation_integrity');

async function runTwinTests() {
  console.log('=========================================================================');
  console.log('🚀 PREDICTA — PHASE 13 TASK 1 DIGITAL RELIABILITY TWIN SUITE (T01 - T24)');
  console.log('=========================================================================\n');

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
    equipment_id: 'EQP-101',
    component_id: 'CMP-T13-001',
    lot_id: 'LOT-T13-001',
    wafer_id: 'LOT-T13-001-W01',
    die_id: 'DIE-T13-001',
    trace_id: 'TR-T13-001',
    test_id: 'TST-T13-001',
    created_at: '2026-01-01T00:00:00.000Z'
  };

  const authPrediction = inferenceService.predictSingle(BASE_RECORD);
  registerAuthoritativePrediction({
    ...authPrediction,
    component_id: BASE_RECORD.component_id,
    lot_id: BASE_RECORD.lot_id,
    wafer_id: BASE_RECORD.wafer_id,
    die_id: BASE_RECORD.die_id,
    equipment_id: BASE_RECORD.equipment_id,
    created_at: '2026-01-01T00:00:00.000Z'
  });

  // T01: Canonical twin construction
  await runTest('T01', 'Canonical twin construction', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-T13-001');
    assert.ok(twin);
    assert.ok(twin.twin_id && twin.twin_id.startsWith('TWIN-'));
    assert.ok(twin.identity);
    assert.ok(twin.evidence_summary);
    assert.ok(twin.evidence_blocks);
    assert.ok(Array.isArray(twin.longitudinal_timeline));
    assert.ok(twin.provenance);
  });

  // T02: Authoritative component linkage
  await runTest('T02', 'Authoritative component linkage', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-T13-001');
    assert.strictEqual(twin.identity.component_id, 'CMP-T13-001');
  });

  // T03: Authoritative trace linkage
  await runTest('T03', 'Authoritative trace linkage', async () => {
    const twin = await manager.buildReliabilityTwinAsync('TR-T13-001');
    assert.strictEqual(twin.identity.trace_id, 'TR-T13-001');
  });

  // T04: Missing lot/wafer/die remains missing (null)
  await runTest('T04', 'Missing lot/wafer/die remains missing (null)', async () => {
    const partialRecord = {
      trace_id: 'TR-PARTIAL-001',
      component_id: 'CMP-PARTIAL-001',
      prediction: 'PASS',
      probability: 0.05,
      threshold: 0.20,
      risk_level: 'LOW_RISK',
      created_at: '2026-01-02T00:00:00.000Z'
    };
    registerAuthoritativePrediction(partialRecord);

    const twin = await manager.buildReliabilityTwinAsync('CMP-PARTIAL-001');
    assert.strictEqual(twin.identity.lot_id, null, 'Missing lot_id must be null');
    assert.strictEqual(twin.identity.wafer_id, null, 'Missing wafer_id must be null');
    assert.strictEqual(twin.identity.die_id, null, 'Missing die_id must be null');
  });

  // T05: Missing equipment remains missing
  await runTest('T05', 'Missing equipment remains missing', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-PARTIAL-001');
    assert.strictEqual(twin.identity.equipment_id, null, 'Missing equipment_id must be null, not defaulted');
  });

  // T06: No fabricated manufacturing event
  await runTest('T06', 'No fabricated manufacturing event', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-PARTIAL-001');
    const mfgEvents = twin.longitudinal_timeline.filter(e => e.stage === 'MANUFACTURING_OBSERVATION');
    assert.strictEqual(mfgEvents.length, 0, 'Must NOT fabricate MANUFACTURING_OBSERVATION events');
  });

  // T07: Actual telemetry preserved when available
  await runTest('T07', 'Actual telemetry preserved when available', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-T13-001');
    assert.strictEqual(twin.identity.equipment_id, 'EQP-101');
    assert.strictEqual(twin.identity.lot_id, 'LOT-T13-001');
    assert.strictEqual(twin.identity.wafer_id, 'LOT-T13-001-W01');
    assert.strictEqual(twin.identity.die_id, 'DIE-T13-001');
  });

  // T08: Chronological ordering
  await runTest('T08', 'Chronological ordering', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-T13-001');
    const timeline = twin.longitudinal_timeline;
    for (let i = 1; i < timeline.length; i++) {
      if (timeline[i - 1].timestamp && timeline[i].timestamp) {
        const tPrev = new Date(timeline[i - 1].timestamp).getTime();
        const tCurr = new Date(timeline[i].timestamp).getTime();
        assert.ok(tPrev <= tCurr, 'Timeline events must be chronologically ordered');
      }
    }
  });

  // T09: Deterministic equal-timestamp ordering
  await runTest('T09', 'Deterministic equal-timestamp ordering', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-T13-001');
    const timeline = twin.longitudinal_timeline;
    for (let i = 1; i < timeline.length; i++) {
      if (timeline[i - 1].timestamp === timeline[i].timestamp) {
        assert.ok(
          String(timeline[i - 1].event_id).localeCompare(String(timeline[i].event_id)) <= 0,
          'Equal-timestamp events must be deterministically sorted by event_id'
        );
      }
    }
  });

  // T10: Prediction evidence preserved exactly
  await runTest('T10', 'Prediction evidence preserved exactly', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-T13-001');
    assert.strictEqual(twin.evidence_summary.ml_evaluation, 'AVAILABLE');
    assert.strictEqual(twin.evidence_blocks.ml_evaluation.prediction, authPrediction.prediction);
  });

  // T11: Probability preserved exactly
  await runTest('T11', 'Probability preserved exactly', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-T13-001');
    assert.strictEqual(twin.evidence_blocks.ml_evaluation.probability, authPrediction.probability);
  });

  // T12: Threshold not rewritten
  await runTest('T12', 'Threshold not rewritten', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-T13-001');
    assert.strictEqual(twin.evidence_blocks.ml_evaluation.threshold, 0.20);
  });

  // T13: Model provenance preserved
  await runTest('T13', 'Model provenance preserved', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-T13-001');
    assert.strictEqual(twin.provenance.model_identifier, 'predicta_xgboost_model');
    assert.strictEqual(twin.provenance.model_sha256, manager.expectedModelSha);
  });

  // T14: Missing anomaly = INSUFFICIENT_EVIDENCE
  await runTest('T14', 'Missing anomaly = INSUFFICIENT_EVIDENCE', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-PARTIAL-001');
    assert.strictEqual(twin.evidence_summary.anomaly_evidence, 'INSUFFICIENT_EVIDENCE');
    assert.strictEqual(twin.evidence_blocks.anomaly_evidence, null);
  });

  // T15: Missing prognostic = INSUFFICIENT_EVIDENCE
  await runTest('T15', 'Missing prognostic = INSUFFICIENT_EVIDENCE', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-PARTIAL-001');
    assert.strictEqual(twin.evidence_summary.prognostic_evidence, 'INSUFFICIENT_EVIDENCE');
    assert.strictEqual(twin.evidence_blocks.prognostic_evidence, null);
  });

  // T16: Missing physics / unestablished signals = INSUFFICIENT_EVIDENCE
  await runTest('T16', 'Missing physics / unestablished signals = INSUFFICIENT_EVIDENCE', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-UNSEEN-SIGNAL');
    assert.strictEqual(twin.evidence_summary.secondary_test, 'INSUFFICIENT_EVIDENCE');
    assert.strictEqual(twin.evidence_summary.ml_evaluation, 'INSUFFICIENT_EVIDENCE');
  });

  // T17: Missing operator evidence = INSUFFICIENT_EVIDENCE
  await runTest('T17', 'Missing operator evidence = INSUFFICIENT_EVIDENCE', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-PARTIAL-001');
    assert.strictEqual(twin.evidence_summary.operator_disposition, 'INSUFFICIENT_EVIDENCE');
  });

  // T18: Missing outcome evidence = INSUFFICIENT_EVIDENCE
  await runTest('T18', 'Missing outcome evidence = INSUFFICIENT_EVIDENCE', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-PARTIAL-001');
    assert.strictEqual(twin.evidence_summary.outcome_evidence, 'INSUFFICIENT_EVIDENCE');
  });

  // T19: Missing adjudication = NOT_ESTABLISHED
  await runTest('T19', 'Missing adjudication = NOT_ESTABLISHED', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-PARTIAL-001');
    assert.strictEqual(twin.evidence_summary.adjudication, 'NOT_ESTABLISHED');
    assert.strictEqual(twin.evidence_summary.ground_truth_status, 'NOT_ESTABLISHED');
  });

  // T20: Synthetic evidence explicitly labelled
  await runTest('T20', 'Synthetic evidence explicitly labelled', async () => {
    const synRecord = {
      trace_id: 'TR-SYN-T20',
      component_id: 'CMP-SYN-020',
      lot_id: 'LOT-SYN-020',
      prediction: 'PASS',
      probability: 0.08,
      is_synthetic: true,
      created_at: '2026-01-03T00:00:00.000Z'
    };
    registerAuthoritativePrediction(synRecord);

    const twin = await manager.buildReliabilityTwinAsync('CMP-SYN-020');
    assert.strictEqual(twin.identity.is_synthetic, true);
    assert.strictEqual(twin.provenance.is_synthetic_provenance, true);
  });

  // T21: Twin cannot mutate source evidence
  await runTest('T21', 'Twin cannot mutate source evidence', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-T13-001');
    twin.evidence_blocks.ml_evaluation.prediction = 'MUTATED_PREDICTION';
    twin.evidence_blocks.ml_evaluation.probability = 0.99999;
    const freshTwin = await manager.buildReliabilityTwinAsync('CMP-T13-001');
    assert.strictEqual(freshTwin.evidence_blocks.ml_evaluation.prediction, authPrediction.prediction);
    assert.strictEqual(freshTwin.evidence_blocks.ml_evaluation.probability, authPrediction.probability);
  });

  // T22: No fabricated timestamps
  await runTest('T22', 'No fabricated timestamps', async () => {
    const untimedRecord = {
      trace_id: 'TR-UNTIMED-001',
      component_id: 'CMP-UNTIMED-001',
      prediction: 'PASS',
      probability: 0.05,
      created_at: null
    };
    registerAuthoritativePrediction(untimedRecord);

    const twin = await manager.buildReliabilityTwinAsync('CMP-UNTIMED-001');
    assert.strictEqual(twin.created_at, null, 'Must NOT fabricate created_at timestamp');
  });

  // T23: Deterministic twin output
  await runTest('T23', 'Deterministic twin output', async () => {
    const twinA = await manager.buildReliabilityTwinAsync('CMP-T13-001');
    const twinB = await manager.buildReliabilityTwinAsync('CMP-T13-001');
    assert.strictEqual(JSON.stringify(twinA), JSON.stringify(twinB), 'Subsequent calls must produce identical JSON');
  });

  // T24: Phase 11/12 compatibility
  await runTest('T24', 'Phase 11/12 compatibility', async () => {
    const dispResult = await dispositionManager.evaluateDispositionGovernanceAsync('TR-T13-001', { require_durable_persistence: false });
    assert.ok(dispResult);
    assert.strictEqual(dispResult.trace_id, 'TR-T13-001');

    const gate = new EvaluationIntegrityGate();
    const modelCheck = gate.verifyProductionModelProtection();
    const manifestCheck = gate.verifyProductionManifestProtection();
    assert.strictEqual(modelCheck.valid, true);
    assert.strictEqual(manifestCheck.valid, true);
  });

  console.log('\n=========================================================================');
  console.log(`✅ ALL ${passedCount}/24 PHASE 13 TASK 1 JS TESTS (T01 - T24) PASSED CLEANLY!`);
  console.log('=========================================================================\n');
}

runTwinTests().catch((err) => {
  console.error('Unhandled failure in test suite:', err);
  process.exit(1);
});
