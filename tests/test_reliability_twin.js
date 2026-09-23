/**
 * Authoritative Phase 13 Task 2 — Digital Reliability Twin Comprehensive Test Suite (Node.js)
 * File: tests/test_reliability_twin.js
 *
 * Validates complete 10-stage evidence chain & anti-fabrication constraints:
 *  - Test Group A: Model Identifier (explicit preserved vs missing null)
 *  - Test Group B: Prognostic Identifier (explicit preserved vs missing null)
 *  - Test Group C: Physics Provenance (explicit preserved vs missing null with AVAILABLE evidence)
 *  - Test Group D: Risk Fusion Provenance (explicit preserved vs missing null with AVAILABLE evidence)
 *  - Test Group E: Secondary Test (explicit ATE_RETEST_SIMULATOR / SYNTHETIC_SIMULATION vs missing/unknown/invalid fails closed)
 *  - Test Group F: Zero-recomputation spies (0 live inference / physics / risk-fusion calls across present/absent/unregistered)
 *  - Test Group G: Strict Anti-Fabrication assertions (checks forbidden outputs when unprovided)
 *  - Identity, immutability, determinism, and Phase 11/12 compatibility
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { ReliabilityTwinManagerJS, TWIN_CONTRACT_PATH } = require('../src/reliability_twin/reliability_twin');
const { HumanDispositionManagerJS, registerAuthoritativePrediction, _AUTHORITATIVE_PREDICTIONS } = require('../src/governance/disposition');
const inferenceService = require('../src/api/inference');
const { GovernedRiskFusionEngineJS } = require('../src/risk_fusion/risk_fusion');
const { EvaluationIntegrityGate } = require('../src/evaluation/phase12_evaluation_integrity');

async function runTwinTests() {
  console.log('=========================================================================');
  console.log('🚀 PREDICTA — PHASE 13 TASK 2 RELIABILITY TWIN REMEDIATION SUITE (JS)');
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

  // T01: Canonical twin construction & all 10 stages in schema
  await runTest('T01', 'Canonical twin construction with 10-stage schema', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-T13-001');
    assert.ok(twin);
    assert.ok(twin.twin_id && twin.twin_id.startsWith('TWIN-'));
    assert.ok(twin.identity);
    assert.strictEqual(twin.identity.identity_status, 'REGISTERED');
    const summary = twin.evidence_summary;
    for (const stage of [
      'manufacturing_observation', 'ml_evaluation', 'anomaly_evidence',
      'prognostic_evidence', 'physics_reliability', 'risk_fusion',
      'operator_disposition', 'secondary_test', 'outcome_evidence', 'adjudication'
    ]) {
      assert.strictEqual(typeof summary[stage], 'string', `Summary must contain ${stage}`);
    }
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

  // -------------------------------------------------------------------------
  // TEST GROUP A: ML MODEL IDENTIFIER
  // -------------------------------------------------------------------------
  await runTest('A1', 'Explicit historical ML model identifier preserved', async () => {
    const rec = {
      trace_id: 'TR-A1-001',
      component_id: 'CMP-A1-001',
      prediction: 'PASS',
      probability: 0.05,
      model_identifier: 'historical-model-xyz',
      created_at: '2026-01-02T00:00:00.000Z'
    };
    registerAuthoritativePrediction(rec);
    const twin = await manager.buildReliabilityTwinAsync('CMP-A1-001');
    assert.strictEqual(twin.evidence_blocks.ml_evaluation.provenance.model_identifier, 'historical-model-xyz');
  });

  await runTest('A2', 'Missing ML model identifier remains null (no predicta_xgboost_model default)', async () => {
    const rec = {
      trace_id: 'TR-A2-001',
      component_id: 'CMP-A2-001',
      prediction: 'PASS',
      probability: 0.05,
      created_at: '2026-01-02T00:00:00.000Z'
    };
    registerAuthoritativePrediction(rec);
    const twin = await manager.buildReliabilityTwinAsync('CMP-A2-001');
    assert.strictEqual(twin.evidence_blocks.ml_evaluation.provenance.model_identifier, null);
  });

  // -------------------------------------------------------------------------
  // TEST GROUP B: PROGNOSTIC IDENTIFIER
  // -------------------------------------------------------------------------
  await runTest('B1', 'Explicit historical prognostic model identifier preserved', async () => {
    const rec = {
      trace_id: 'TR-B1-001',
      component_id: 'CMP-B1-001',
      prediction: 'PASS',
      probability: 0.05,
      created_at: '2026-01-02T00:00:00.000Z',
      ml_details: {
        drift_prediction: {
          drift_detected: false,
          model_identifier: 'historical-gpr-custom-v2'
        }
      }
    };
    registerAuthoritativePrediction(rec);
    const twin = await manager.buildReliabilityTwinAsync('CMP-B1-001');
    assert.strictEqual(twin.evidence_summary.prognostic_evidence, 'AVAILABLE');
    const prgEvts = twin.longitudinal_timeline.filter(e => e.stage === 'PROGNOSTIC_EVIDENCE');
    assert.strictEqual(prgEvts[0].provenance.model_identifier, 'historical-gpr-custom-v2');
  });

  await runTest('B2', 'Missing prognostic model identifier remains null (no predicta_gpr_kernel_artifacts default)', async () => {
    const rec = {
      trace_id: 'TR-B2-001',
      component_id: 'CMP-B2-001',
      prediction: 'PASS',
      probability: 0.05,
      created_at: '2026-01-02T00:00:00.000Z',
      ml_details: {
        drift_prediction: {
          drift_detected: false
        }
      }
    };
    registerAuthoritativePrediction(rec);
    const twin = await manager.buildReliabilityTwinAsync('CMP-B2-001');
    assert.strictEqual(twin.evidence_summary.prognostic_evidence, 'AVAILABLE');
    const prgEvts = twin.longitudinal_timeline.filter(e => e.stage === 'PROGNOSTIC_EVIDENCE');
    assert.strictEqual(prgEvts[0].provenance.model_identifier, null);
  });

  // -------------------------------------------------------------------------
  // TEST GROUP C: PHYSICS PROVENANCE
  // -------------------------------------------------------------------------
  await runTest('C1', 'Physics evidence WITH explicit provenance preserved verbatim', async () => {
    const rec = {
      trace_id: 'TR-C1-001',
      component_id: 'CMP-C1-001',
      prediction: 'PASS',
      probability: 0.05,
      created_at: '2026-01-02T00:00:00.000Z',
      ml_details: {
        physics: {
          physics_consistency_status: 'PHYSICS_CONSISTENT',
          physics_consistency_score: 1.0,
          provenance: {
            source_type: 'PHYSICS_AGING_ENGINE',
            model_identifier: 'historical-physics-engine',
            model_version: '2.3.1',
            model_sha256: 'a1b2c3d4e5f6'
          }
        }
      }
    };
    registerAuthoritativePrediction(rec);
    const twin = await manager.buildReliabilityTwinAsync('CMP-C1-001');
    assert.strictEqual(twin.evidence_summary.physics_reliability, 'AVAILABLE');
    const physEvts = twin.longitudinal_timeline.filter(e => e.stage === 'PHYSICS_RELIABILITY_EVIDENCE');
    assert.strictEqual(physEvts.length, 1);
    assert.strictEqual(physEvts[0].provenance.source_type, 'PHYSICS_AGING_ENGINE');
    assert.strictEqual(physEvts[0].provenance.model_identifier, 'historical-physics-engine');
    assert.strictEqual(physEvts[0].provenance.model_version, '2.3.1');
    assert.strictEqual(physEvts[0].provenance.model_sha256, 'a1b2c3d4e5f6');
  });

  await runTest('C2', 'Physics evidence WITHOUT provenance has null provenance fields and AVAILABLE status', async () => {
    const rec = {
      trace_id: 'TR-C2-001',
      component_id: 'CMP-C2-001',
      prediction: 'PASS',
      probability: 0.05,
      created_at: '2026-01-02T00:00:00.000Z',
      ml_details: {
        physics: {
          physics_consistency_status: 'PHYSICS_CONSISTENT',
          physics_consistency_score: 1.0
        }
      }
    };
    registerAuthoritativePrediction(rec);
    const twin = await manager.buildReliabilityTwinAsync('CMP-C2-001');
    assert.strictEqual(twin.evidence_summary.physics_reliability, 'AVAILABLE');
    const physEvts = twin.longitudinal_timeline.filter(e => e.stage === 'PHYSICS_RELIABILITY_EVIDENCE');
    assert.strictEqual(physEvts.length, 1);
    assert.strictEqual(physEvts[0].provenance.source_type, null);
    assert.strictEqual(physEvts[0].provenance.model_identifier, null);
    assert.strictEqual(physEvts[0].provenance.model_version, null);
    assert.strictEqual(physEvts[0].provenance.model_sha256, null);
  });

  // -------------------------------------------------------------------------
  // TEST GROUP D: RISK FUSION PROVENANCE
  // -------------------------------------------------------------------------
  await runTest('D1', 'Risk fusion evidence WITH explicit provenance preserved verbatim', async () => {
    const rec = {
      trace_id: 'TR-D1-001',
      component_id: 'CMP-D1-001',
      prediction: 'PASS',
      probability: 0.05,
      created_at: '2026-01-02T00:00:00.000Z',
      ml_details: {
        risk_engine: {
          governed_risk_fusion: {
            risk_score: 15.5,
            risk_class: 'SAFE',
            disposition: 'PASS',
            provenance: {
              source_type: 'RISK_FUSION_GATE',
              model_identity: 'rf-model-custom',
              contract_version: '2.0.0',
              contract_sha256: '44a8dfe889568c9ad91f1a4b6bd0ad10fdca691758b318f40d71b7b71681d6bf'
            }
          }
        }
      }
    };
    registerAuthoritativePrediction(rec);
    const twin = await manager.buildReliabilityTwinAsync('CMP-D1-001');
    assert.strictEqual(twin.evidence_summary.risk_fusion, 'AVAILABLE');
    const rfEvts = twin.longitudinal_timeline.filter(e => e.stage === 'RISK_FUSION_DECISION');
    assert.strictEqual(rfEvts.length, 1);
    assert.strictEqual(rfEvts[0].provenance.source_type, 'RISK_FUSION_GATE');
    assert.strictEqual(rfEvts[0].provenance.model_identifier, 'rf-model-custom');
    assert.strictEqual(rfEvts[0].provenance.model_version, '2.0.0');
    assert.strictEqual(rfEvts[0].provenance.model_sha256, '44a8dfe889568c9ad91f1a4b6bd0ad10fdca691758b318f40d71b7b71681d6bf');
  });

  await runTest('D2', 'Risk fusion evidence WITHOUT provenance has null provenance fields and AVAILABLE status', async () => {
    const rec = {
      trace_id: 'TR-D2-001',
      component_id: 'CMP-D2-001',
      prediction: 'PASS',
      probability: 0.05,
      created_at: '2026-01-02T00:00:00.000Z',
      ml_details: {
        risk_engine: {
          governed_risk_fusion: {
            risk_score: 15.5,
            risk_class: 'SAFE',
            disposition: 'PASS'
          }
        }
      }
    };
    registerAuthoritativePrediction(rec);
    const twin = await manager.buildReliabilityTwinAsync('CMP-D2-001');
    assert.strictEqual(twin.evidence_summary.risk_fusion, 'AVAILABLE');
    const rfEvts = twin.longitudinal_timeline.filter(e => e.stage === 'RISK_FUSION_DECISION');
    assert.strictEqual(rfEvts.length, 1);
    assert.strictEqual(rfEvts[0].provenance.source_type, null);
    assert.strictEqual(rfEvts[0].provenance.model_identifier, null);
    assert.strictEqual(rfEvts[0].provenance.model_version, null);
    assert.strictEqual(rfEvts[0].provenance.model_sha256, null);
  });

  // -------------------------------------------------------------------------
  // TEST GROUP E: SECONDARY TEST PROVENANCE FAIL-CLOSED
  // -------------------------------------------------------------------------
  await runTest('E1', 'Explicit ATE_RETEST_SIMULATOR secondary test provenance', async () => {
    const rec = {
      trace_id: 'TR-E1-001',
      component_id: 'CMP-E1-001',
      prediction: 'PASS',
      probability: 0.15,
      secondary_test_result: 'PASS',
      secondary_test_source_type: 'ATE_RETEST_SIMULATOR',
      created_at: '2026-01-02T00:00:00.000Z'
    };
    registerAuthoritativePrediction(rec);
    const twin = await manager.buildReliabilityTwinAsync('CMP-E1-001');
    assert.strictEqual(twin.evidence_summary.secondary_test, 'AVAILABLE');
    assert.strictEqual(twin.evidence_blocks.secondary_test.secondary_test_source_type, 'ATE_RETEST_SIMULATOR');
  });

  await runTest('E2', 'Explicit SYNTHETIC_SIMULATION secondary test provenance', async () => {
    const rec = {
      trace_id: 'TR-E2-001',
      component_id: 'CMP-E2-001',
      prediction: 'PASS',
      probability: 0.15,
      secondary_test_result: 'PASS',
      secondary_test_source_type: 'SYNTHETIC_SIMULATION',
      created_at: '2026-01-02T00:00:00.000Z'
    };
    registerAuthoritativePrediction(rec);
    const twin = await manager.buildReliabilityTwinAsync('CMP-E2-001');
    assert.strictEqual(twin.evidence_summary.secondary_test, 'AVAILABLE');
    assert.strictEqual(twin.evidence_blocks.secondary_test.secondary_test_source_type, 'SYNTHETIC_SIMULATION');
  });

  await runTest('E3', 'Missing secondary test source type fails closed to INSUFFICIENT_EVIDENCE', async () => {
    const rec = {
      trace_id: 'TR-E3-001',
      component_id: 'CMP-E3-001',
      prediction: 'PASS',
      probability: 0.15,
      secondary_test_result: 'PASS',
      created_at: '2026-01-02T00:00:00.000Z'
    };
    registerAuthoritativePrediction(rec);
    const twin = await manager.buildReliabilityTwinAsync('CMP-E3-001');
    assert.strictEqual(twin.evidence_summary.secondary_test, 'INSUFFICIENT_EVIDENCE');
    assert.strictEqual(twin.evidence_blocks.secondary_test, null);
    const evts = twin.longitudinal_timeline.filter(e => e.stage === 'SECONDARY_TEST');
    assert.strictEqual(evts.length, 0);
  });

  await runTest('E4', 'Unknown/invalid secondary test source type fails closed', async () => {
    const rec = {
      trace_id: 'TR-E4-001',
      component_id: 'CMP-E4-001',
      prediction: 'PASS',
      probability: 0.15,
      secondary_test_result: 'PASS',
      secondary_test_source_type: 'INVALID_LAB_SIMULATOR',
      created_at: '2026-01-02T00:00:00.000Z'
    };
    registerAuthoritativePrediction(rec);
    const twin = await manager.buildReliabilityTwinAsync('CMP-E4-001');
    assert.strictEqual(twin.evidence_summary.secondary_test, 'INSUFFICIENT_EVIDENCE');
    assert.strictEqual(twin.evidence_blocks.secondary_test, null);
    const evts = twin.longitudinal_timeline.filter(e => e.stage === 'SECONDARY_TEST');
    assert.strictEqual(evts.length, 0);
  });

  // -------------------------------------------------------------------------
  // TEST GROUP F: ZERO RECOMPUTATION SPIES
  // -------------------------------------------------------------------------
  await runTest('F1', 'Direct spy: Zero live inference calls during twin lookup (present, absent, unregistered)', async () => {
    let predictCalls = 0;
    const origPredict = inferenceService.predictSingle;
    inferenceService.predictSingle = function(...args) {
      predictCalls++;
      return origPredict.apply(this, args);
    };

    try {
      await manager.buildReliabilityTwinAsync('CMP-T13-001');
      assert.strictEqual(predictCalls, 0);

      await manager.buildReliabilityTwinAsync('CMP-PARTIAL-001');
      assert.strictEqual(predictCalls, 0);

      await manager.buildReliabilityTwinAsync('CMP-UNREGISTERED-SPY-JS');
      assert.strictEqual(predictCalls, 0);
    } finally {
      inferenceService.predictSingle = origPredict;
    }
  });

  await runTest('F2', 'Direct spy: GovernedRiskFusionEngine is NEVER invoked during Twin lookup', async () => {
    let rfCalls = 0;
    const origEvaluate = GovernedRiskFusionEngineJS.prototype.evaluate;
    GovernedRiskFusionEngineJS.prototype.evaluate = function(...args) {
      rfCalls++;
      return origEvaluate.apply(this, args);
    };

    try {
      await manager.buildReliabilityTwinAsync('CMP-D1-001');
      assert.strictEqual(rfCalls, 0);

      await manager.buildReliabilityTwinAsync('CMP-PARTIAL-001');
      assert.strictEqual(rfCalls, 0);

      await manager.buildReliabilityTwinAsync('CMP-UNREGISTERED-SPY-JS');
      assert.strictEqual(rfCalls, 0);
    } finally {
      GovernedRiskFusionEngineJS.prototype.evaluate = origEvaluate;
    }
  });

  // -------------------------------------------------------------------------
  // TEST GROUP G: ANTI-FABRICATION CATCH TEST
  // -------------------------------------------------------------------------
  await runTest('G1', 'Anti-fabrication check: forbidden defaults never appear without authoritative support', async () => {
    const unadornedRec = {
      trace_id: 'TR-ANTI-FAB-001',
      component_id: 'CMP-ANTI-FAB-001',
      prediction: 'PASS',
      probability: 0.10,
      created_at: '2026-01-02T00:00:00.000Z',
      ml_details: {
        anomaly_detection: { copod_score: 0.1 },
        drift_prediction: { drift_detected: false },
        physics: { physics_consistency_status: 'PHYSICS_CONSISTENT' },
        risk_engine: { governed_risk_fusion: { risk_score: 10 } }
      }
    };
    registerAuthoritativePrediction(unadornedRec);
    const twin = await manager.buildReliabilityTwinAsync('CMP-ANTI-FAB-001');

    // 1. ML model identifier must not be "predicta_xgboost_model"
    assert.notStrictEqual(twin.evidence_blocks.ml_evaluation.provenance.model_identifier, 'predicta_xgboost_model');
    assert.strictEqual(twin.evidence_blocks.ml_evaluation.provenance.model_identifier, null);

    // 2. Prognostic model identifier must not be "predicta_gpr_kernel_artifacts"
    const prgEvts = twin.longitudinal_timeline.filter(e => e.stage === 'PROGNOSTIC_EVIDENCE');
    assert.notStrictEqual(prgEvts[0].provenance.model_identifier, 'predicta_gpr_kernel_artifacts');
    assert.strictEqual(prgEvts[0].provenance.model_identifier, null);

    // 3. Physics source_type must not be "PHYSICS_AGING_ENGINE"
    const physEvts = twin.longitudinal_timeline.filter(e => e.stage === 'PHYSICS_RELIABILITY_EVIDENCE');
    assert.notStrictEqual(physEvts[0].provenance.source_type, 'PHYSICS_AGING_ENGINE');
    assert.strictEqual(physEvts[0].provenance.source_type, null);

    // 4. Risk fusion source_type must not be "RISK_FUSION_GATE"
    const rfEvts = twin.longitudinal_timeline.filter(e => e.stage === 'RISK_FUSION_DECISION');
    assert.notStrictEqual(rfEvts[0].provenance.source_type, 'RISK_FUSION_GATE');
    assert.strictEqual(rfEvts[0].provenance.source_type, null);

    // 5. Risk fusion contract_version / model_version must not default to "1.0.0"
    assert.notStrictEqual(rfEvts[0].provenance.model_version, '1.0.0');
    assert.strictEqual(rfEvts[0].provenance.model_version, null);

    // 6. Historical model SHA must not default to current production model SHA
    assert.notStrictEqual(twin.provenance.historical_model_sha256, manager.expectedModelSha);
    assert.strictEqual(twin.provenance.historical_model_sha256, null);
  });

  // T15: Historical model SHA and version preserved from record
  await runTest('T15', 'Historical model SHA and version preserved from record', async () => {
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

  // T16: Missing historical model SHA remains null
  await runTest('T16', 'Missing historical model SHA remains null', async () => {
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

  // T17: Operator disposition preserved
  await runTest('T17', 'Operator disposition preserved', async () => {
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

  // T18: Outcome evidence preserved
  await runTest('T18', 'Outcome evidence preserved', async () => {
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

  // T19: Adjudication preserved
  await runTest('T19', 'Adjudication preserved', async () => {
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

  // T20: Immutability across Twin mutations
  await runTest('T20', 'Immutability across Twin mutations', async () => {
    const twin = await manager.buildReliabilityTwinAsync('CMP-T13-001');
    twin.evidence_blocks.ml_evaluation.prediction = 'MUTATED';
    twin.evidence_blocks.ml_evaluation.probability = 0.99999;
    const freshTwin = await manager.buildReliabilityTwinAsync('CMP-T13-001');
    assert.strictEqual(freshTwin.evidence_blocks.ml_evaluation.prediction, authPrediction.prediction);
    assert.strictEqual(freshTwin.evidence_blocks.ml_evaluation.probability, authPrediction.probability);
  });

  // T21: Deterministic JSON serialization
  await runTest('T21', 'Deterministic JSON serialization', async () => {
    const twinA = await manager.buildReliabilityTwinAsync('CMP-T13-001');
    const twinB = await manager.buildReliabilityTwinAsync('CMP-T13-001');
    assert.strictEqual(JSON.stringify(twinA), JSON.stringify(twinB));
  });

  // T22: Phase 11/12 integration compatibility
  await runTest('T22', 'Phase 11/12 integration compatibility', async () => {
    const gate = new EvaluationIntegrityGate();
    const modelCheck = gate.verifyProductionModelProtection();
    const manifestCheck = gate.verifyProductionManifestProtection();
    assert.strictEqual(modelCheck.valid, true);
    assert.strictEqual(manifestCheck.valid, true);
  });

  console.log('\n=========================================================================');
  console.log(`✅ ALL ${passedCount} PHASE 13 TASK 2 JS TESTS PASSED CLEANLY!`);
  console.log('=========================================================================\n');
}

runTwinTests().catch((err) => {
  console.error('Unhandled failure in test suite:', err);
  process.exit(1);
});
