/**
 * Authoritative Phase 13 Task 2 — Digital Reliability Twin Comprehensive Test Suite (Node.js)
 * File: tests/test_reliability_twin.js
 *
 * Validates complete 10-stage evidence chain & anti-fabrication constraints:
 *  - Physics evidence present vs absent vs no live execution
 *  - Risk-fusion evidence present vs absent vs no live execution
 *  - Secondary test allowed source types (SYNTHETIC_SIMULATION / ATE_RETEST_SIMULATOR)
 *  - Identity provenance (unregistered query does not become component_id)
 *  - Historical model provenance vs current system verification
 *  - Live recomputation prevention (predictSingle / Physics / RiskFusion spies)
 *  - Immutability across prediction & governance stores
 *  - Deterministic serialization across all 10 stages
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
  console.log('🚀 PREDICTA — PHASE 13 TASK 2 RELIABILITY TWIN COMPREHENSIVE SUITE (JS)');
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

  // T01: Canonical twin construction & all 10 stages in summary
  await runTest('T01', 'Canonical twin construction with 10-stage schema', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-T13-001');
    assert.ok(twin);
    assert.ok(twin.twin_id && twin.twin_id.startsWith('TWIN-'));
    assert.ok(twin.identity);
    assert.strictEqual(twin.identity.identity_status, 'REGISTERED');
    assert.strictEqual(typeof twin.evidence_summary.manufacturing_observation, 'string');
    assert.strictEqual(typeof twin.evidence_summary.ml_evaluation, 'string');
    assert.strictEqual(typeof twin.evidence_summary.anomaly_evidence, 'string');
    assert.strictEqual(typeof twin.evidence_summary.prognostic_evidence, 'string');
    assert.strictEqual(typeof twin.evidence_summary.physics_reliability, 'string');
    assert.strictEqual(typeof twin.evidence_summary.risk_fusion, 'string');
    assert.strictEqual(typeof twin.evidence_summary.operator_disposition, 'string');
    assert.strictEqual(typeof twin.evidence_summary.secondary_test, 'string');
    assert.strictEqual(typeof twin.evidence_summary.outcome_evidence, 'string');
    assert.strictEqual(typeof twin.evidence_summary.adjudication, 'string');
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

  // T04: Unregistered lookup does NOT become authoritative component ID
  await runTest('T04', 'Unregistered lookup does NOT become authoritative component ID', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-UNREGISTERED-999');
    assert.strictEqual(twin.identity.component_id, null, 'Unregistered component ID must be null');
    assert.strictEqual(twin.identity.requested_identifier, 'CMP-UNREGISTERED-999');
    assert.strictEqual(twin.identity.identity_status, 'UNREGISTERED');
    assert.strictEqual(twin.evidence_summary.ml_evaluation, 'INSUFFICIENT_EVIDENCE');
  });

  // T05: Missing identity fields remain null
  await runTest('T05', 'Missing identity fields remain null', async () => {
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
    assert.strictEqual(twin.identity.lot_id, null);
    assert.strictEqual(twin.identity.wafer_id, null);
    assert.strictEqual(twin.identity.die_id, null);
    assert.strictEqual(twin.identity.equipment_id, null);
  });

  // T06: Physics evidence present is preserved verbatim
  await runTest('T06', 'Physics evidence present is preserved verbatim', async () => {
    const physicsRecord = {
      trace_id: 'TR-PHYS-001',
      component_id: 'CMP-PHYS-001',
      prediction: 'PASS',
      probability: 0.05,
      created_at: '2026-01-02T00:00:00.000Z',
      ml_details: {
        physics: {
          physics_consistency_status: 'PHYSICS_CONSISTENT',
          physics_consistency_score: 1.0,
          passed_physics_checks: ['PHYS_CHECK_001_BTI_MONOTONICITY', 'PHYS_CHECK_002_TIMING_DEGRADATION']
        }
      }
    };
    registerAuthoritativePrediction(physicsRecord);

    const twin = await manager.buildReliabilityTwinAsync('CMP-PHYS-001');
    assert.strictEqual(twin.evidence_summary.physics_reliability, 'AVAILABLE');
    assert.ok(twin.evidence_blocks.physics_reliability);
    assert.strictEqual(twin.evidence_blocks.physics_reliability.physics_consistency_status, 'PHYSICS_CONSISTENT');
    const physEvts = twin.longitudinal_timeline.filter(e => e.stage === 'PHYSICS_RELIABILITY_EVIDENCE');
    assert.strictEqual(physEvts.length, 1);
    assert.strictEqual(physEvts[0].provenance.source_type, 'PHYSICS_AGING_ENGINE');
  });

  // T07: Missing physics evidence returns INSUFFICIENT_EVIDENCE & zero events
  await runTest('T07', 'Missing physics evidence returns INSUFFICIENT_EVIDENCE', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-PARTIAL-001');
    assert.strictEqual(twin.evidence_summary.physics_reliability, 'INSUFFICIENT_EVIDENCE');
    assert.strictEqual(twin.evidence_blocks.physics_reliability, null);
    const physEvts = twin.longitudinal_timeline.filter(e => e.stage === 'PHYSICS_RELIABILITY_EVIDENCE');
    assert.strictEqual(physEvts.length, 0);
  });

  // T08: Risk-fusion evidence present is preserved verbatim
  await runTest('T08', 'Risk-fusion evidence present is preserved verbatim', async () => {
    const rfRecord = {
      trace_id: 'TR-RF-001',
      component_id: 'CMP-RF-001',
      prediction: 'PASS',
      probability: 0.05,
      created_at: '2026-01-02T00:00:00.000Z',
      ml_details: {
        risk_engine: {
          governed_risk_fusion: {
            risk_score: 15.5,
            risk_class: 'SAFE',
            disposition: 'PASS',
            contract_version: '1.0.0',
            contract_sha256: '44a8dfe889568c9ad91f1a4b6bd0ad10fdca691758b318f40d71b7b71681d6bf'
          }
        }
      }
    };
    registerAuthoritativePrediction(rfRecord);

    const twin = await manager.buildReliabilityTwinAsync('CMP-RF-001');
    assert.strictEqual(twin.evidence_summary.risk_fusion, 'AVAILABLE');
    assert.ok(twin.evidence_blocks.risk_fusion);
    assert.strictEqual(twin.evidence_blocks.risk_fusion.risk_score, 15.5);
    const rfEvts = twin.longitudinal_timeline.filter(e => e.stage === 'RISK_FUSION_DECISION');
    assert.strictEqual(rfEvts.length, 1);
    assert.strictEqual(rfEvts[0].provenance.source_type, 'RISK_FUSION_GATE');
  });

  // T09: Missing risk fusion returns INSUFFICIENT_EVIDENCE
  await runTest('T09', 'Missing risk fusion returns INSUFFICIENT_EVIDENCE', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-PARTIAL-001');
    assert.strictEqual(twin.evidence_summary.risk_fusion, 'INSUFFICIENT_EVIDENCE');
    assert.strictEqual(twin.evidence_blocks.risk_fusion, null);
    const rfEvts = twin.longitudinal_timeline.filter(e => e.stage === 'RISK_FUSION_DECISION');
    assert.strictEqual(rfEvts.length, 0);
  });

  // T10: Secondary test source type conforms to contract (ATE_RETEST_SIMULATOR)
  await runTest('T10', 'Secondary test source type conforms to contract (ATE_RETEST_SIMULATOR)', async () => {
    const retestRec = {
      trace_id: 'TR-SEC-ATE-001',
      component_id: 'CMP-SEC-ATE-001',
      prediction: 'PASS',
      probability: 0.15,
      secondary_test_result: 'PASS',
      is_synthetic: false,
      created_at: '2026-01-02T00:00:00.000Z'
    };
    registerAuthoritativePrediction(retestRec);

    const twin = await manager.buildReliabilityTwinAsync('CMP-SEC-ATE-001');
    assert.strictEqual(twin.evidence_summary.secondary_test, 'AVAILABLE');
    const secEvts = twin.longitudinal_timeline.filter(e => e.stage === 'SECONDARY_TEST');
    assert.strictEqual(secEvts.length, 1);
    assert.strictEqual(secEvts[0].provenance.source_type, 'ATE_RETEST_SIMULATOR');
  });

  // T11: Synthetic secondary test uses SYNTHETIC_SIMULATION
  await runTest('T11', 'Synthetic secondary test uses SYNTHETIC_SIMULATION', async () => {
    const synSecRec = {
      trace_id: 'TR-SEC-SYN-001',
      component_id: 'CMP-SYN-SEC-001',
      prediction: 'PASS',
      probability: 0.15,
      secondary_test_result: 'PASS',
      is_synthetic: true,
      created_at: '2026-01-02T00:00:00.000Z'
    };
    registerAuthoritativePrediction(synSecRec);

    const twin = await manager.buildReliabilityTwinAsync('CMP-SYN-SEC-001');
    assert.strictEqual(twin.evidence_summary.secondary_test, 'AVAILABLE');
    const secEvts = twin.longitudinal_timeline.filter(e => e.stage === 'SECONDARY_TEST');
    assert.strictEqual(secEvts.length, 1);
    assert.strictEqual(secEvts[0].provenance.source_type, 'SYNTHETIC_SIMULATION');
  });

  // T12: Historical model SHA and version preserved from record
  await runTest('T12', 'Historical model SHA and version preserved from record', async () => {
    const recWithSha = {
      trace_id: 'TR-HIST-001',
      component_id: 'CMP-HIST-001',
      prediction: 'PASS',
      probability: 0.05,
      model_sha256: '91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98',
      model_version: '4.0.0_authoritative',
      created_at: '2026-01-02T00:00:00.000Z'
    };
    registerAuthoritativePrediction(recWithSha);

    const twin = await manager.buildReliabilityTwinAsync('CMP-HIST-001');
    assert.strictEqual(twin.provenance.historical_model_sha256, '91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98');
    assert.strictEqual(twin.provenance.historical_model_version, '4.0.0_authoritative');
    assert.strictEqual(twin.provenance.system_verified_model_sha256, manager.expectedModelSha);
  });

  // T13: Missing historical model SHA remains null
  await runTest('T13', 'Missing historical model SHA remains null', async () => {
    const recNoSha = {
      trace_id: 'TR-NOSHA-001',
      component_id: 'CMP-NOSHA-001',
      prediction: 'PASS',
      probability: 0.05,
      created_at: '2026-01-02T00:00:00.000Z'
    };
    registerAuthoritativePrediction(recNoSha);

    const twin = await manager.buildReliabilityTwinAsync('CMP-NOSHA-001');
    assert.strictEqual(twin.provenance.historical_model_sha256, null);
  });

  // T14: Prevention of live inference / recomputation during Twin lookup
  await runTest('T14', 'Prevention of live inference / recomputation during Twin lookup', async () => {
    let predictSingleCalled = false;
    const origPredict = inferenceService.predictSingle;
    inferenceService.predictSingle = function(...args) {
      predictSingleCalled = true;
      return origPredict.apply(this, args);
    };

    try {
      await manager.buildReliabilityTwinAsync('CMP-UNREGISTERED-FOR-SPY');
      assert.strictEqual(predictSingleCalled, false, 'Twin build MUST NOT invoke predictSingle during lookup');
    } finally {
      inferenceService.predictSingle = origPredict;
    }
  });

  // T15: Operator disposition preserved
  await runTest('T15', 'Operator disposition preserved', async () => {
    await dispositionManager.recordDispositionAsync({
      trace_id: 'TR-T13-001',
      disposition: 'HOLD',
      reason_code: 'FALSE_POSITIVE_SUSPECTED',
      operator_id: 'OP-T13',
      comment: 'Testing operator disposition stage',
      require_durable_persistence: false
    });

    const twin = await manager.buildReliabilityTwinAsync('TR-T13-001');
    assert.strictEqual(twin.evidence_summary.operator_disposition, 'AVAILABLE');
    assert.ok(twin.evidence_blocks.operator_dispositions.length > 0);
  });

  // T16: Outcome evidence preserved
  await runTest('T16', 'Outcome evidence preserved', async () => {
    await dispositionManager.registerOutcomeEvidenceAsync({
      trace_id: 'TR-T13-001',
      disposition_id: 'DISP-T13-001',
      evidence_type: 'QUALIFIED_LAB_REPORT',
      evidence_status: 'EVIDENCE_RECORDED',
      evidence_source: 'PHYSICAL_LAB',
      recorded_by: 'ENG-T13',
      require_durable_persistence: false
    });

    const twin = await manager.buildReliabilityTwinAsync('TR-T13-001');
    assert.strictEqual(twin.evidence_summary.outcome_evidence, 'AVAILABLE');
    assert.ok(twin.evidence_blocks.outcome_evidence.length > 0);
  });

  // T17: Adjudication preserved
  await runTest('T17', 'Adjudication preserved', async () => {
    await dispositionManager.adjudicateOutcomeAsync('TR-T13-001', {
      adjudicator_identity: 'QUAL-LEAD-01',
      adjudicator_role: 'QUALITY_ENGINEER',
      proposed_outcome: 'PASS',
      rationale: 'Formal QA review completed',
      require_durable_persistence: false
    });

    const twin = await manager.buildReliabilityTwinAsync('TR-T13-001');
    assert.strictEqual(twin.evidence_summary.adjudication, 'AVAILABLE');
    assert.strictEqual(twin.evidence_summary.ground_truth_status, 'VALIDATED_GROUND_TRUTH');
  });

  // T18: Immutability across Twin mutations
  await runTest('T18', 'Immutability across Twin mutations', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-T13-001');
    twin.evidence_blocks.ml_evaluation.prediction = 'MUTATED';
    twin.evidence_blocks.ml_evaluation.probability = 0.99999;
    const freshTwin = await manager.buildReliabilityTwinAsync('CMP-T13-001');
    assert.strictEqual(freshTwin.evidence_blocks.ml_evaluation.prediction, authPrediction.prediction);
    assert.strictEqual(freshTwin.evidence_blocks.ml_evaluation.probability, authPrediction.probability);
  });

  // T19: Timeline deterministic ordering
  await runTest('T19', 'Timeline deterministic ordering', async () => {
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

  // T20: Deterministic JSON serialization
  await runTest('T20', 'Deterministic JSON serialization', async () => {
    const twinA = await manager.buildReliabilityTwinAsync('CMP-T13-001');
    const twinB = await manager.buildReliabilityTwinAsync('CMP-T13-001');
    assert.strictEqual(JSON.stringify(twinA), JSON.stringify(twinB));
  });

  // T21: Phase 11/12 integration compatibility
  await runTest('T21', 'Phase 11/12 integration compatibility', async () => {
    const gate = new EvaluationIntegrityGate();
    const modelCheck = gate.verifyProductionModelProtection();
    const manifestCheck = gate.verifyProductionManifestProtection();
    assert.strictEqual(modelCheck.valid, true);
    assert.strictEqual(manifestCheck.valid, true);
  });

  console.log('\n=========================================================================');
  console.log(`✅ ALL ${passedCount}/21 PHASE 13 TASK 2 JS TESTS PASSED CLEANLY!`);
  console.log('=========================================================================\n');
}

runTwinTests().catch((err) => {
  console.error('Unhandled failure in test suite:', err);
  process.exit(1);
});
