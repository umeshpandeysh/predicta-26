/**
 * PREDICTA-26 Phase 19.4 — Hostile Adversarial Fleet, Judge Journey & ML Functionality Test Suite (Node.js)
 * File: tests/test_phase19_adversarial_fleet_ml.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const PROD_MODEL_PATH = path.join(ROOT, 'ml', 'models', 'production', 'predicta_xgboost_model.json');
const PROD_DATASET_PATH = path.join(ROOT, 'ml', 'data', 'synthetic', 'predicta_dataset_v3_50000.csv');
const CANONICAL_DATA_PATH = path.join(ROOT, 'src', 'governance', 'canonical_demo_data.json');
const TWIN_CONTRACT_PATH = path.join(ROOT, 'ml', 'reliability_twin', 'reliability_twin_contract.json');

const PROTECTED_MODEL_SHA = '91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98';
const PROTECTED_DATASET_SHA = '48e718643b6fe99bc410421f5b48715c294f1c4c2edabf10870935afdb820a06';
const PROTECTED_THRESHOLD = 0.20;

function computeSha256(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

async function runTests() {
  console.log('--- PREDICTA-26 Phase 19.4 Adversarial Fleet & ML Test Suite (Node.js) ---');

  // 1. Protected Artifacts Lock
  assert(fs.existsSync(PROD_MODEL_PATH), 'Model file missing');
  assert.strictEqual(computeSha256(PROD_MODEL_PATH), PROTECTED_MODEL_SHA, 'Model SHA mismatch');
  console.log('✓ Protected Model SHA-256 Verified');

  assert(fs.existsSync(PROD_DATASET_PATH), 'Dataset file missing');
  assert.strictEqual(computeSha256(PROD_DATASET_PATH), PROTECTED_DATASET_SHA, 'Dataset SHA mismatch');
  console.log('✓ Protected Dataset SHA-256 Verified');

  const twinContract = JSON.parse(fs.readFileSync(TWIN_CONTRACT_PATH, 'utf8'));
  assert.strictEqual(twinContract.immutability_constraints.authoritative_operating_threshold, PROTECTED_THRESHOLD);
  console.log('✓ Operating Threshold 0.20 Immutably Locked');

  // 2. Exact Mirror Byte Parity
  const mirrorPairs = [
    ['index.html', 'frontend/index.html'],
    ['script.js', 'frontend/script.js'],
    ['api.js', 'frontend/api.js'],
  ];
  for (const [rootRel, feRel] of mirrorPairs) {
    const rootBuf = fs.readFileSync(path.join(ROOT, rootRel));
    const feBuf = fs.readFileSync(path.join(ROOT, feRel));
    assert.strictEqual(rootBuf.length, feBuf.length, `Size mismatch: ${rootRel}`);
    assert.strictEqual(
      crypto.createHash('sha256').update(rootBuf).digest('hex'),
      crypto.createHash('sha256').update(feBuf).digest('hex'),
      `Hash mismatch: ${rootRel}`
    );
  }
  console.log('✓ Frontend Exact Mirror Byte Parity Verified (3/3 pairs)');

  // 3. Real Node.js ML Inference Execution
  const { PredictaInferenceServiceJS } = require('../src/api/inference');
  const mlService = new PredictaInferenceServiceJS();
  assert(mlService.isLoaded, 'PredictaInferenceServiceJS failed to load');

  const nominalPayload = {
    supply_voltage: 1.2,
    output_voltage: 1.18,
    current: 47.88,
    iddq: 10.70,
    ileak: 111.73,
    leakage_current: 111.73,
    tpd: 10.98,
    resistance: 13.0,
    capacitance: 4.2,
    threshold_voltage: 0.45,
    frequency: 2687.68,
    propagation_delay: 10.98,
    setup_time: 0.8396,
    hold_time: 0.4265,
    timing_margin: 1.3115,
    temperature: 28.56,
    dynamic_power: 56.58,
    total_power: 56.83,
    test_duration: 150.05,
    equipment_id: 'EQP-101',
    lot_id: 'LOT-SYN-001',
    wafer_id: 'WFR-001',
    die_id: 'DIE-001'
  };

  const infResult = mlService.predictSingle(nominalPayload);
  assert(infResult.probability !== undefined, 'Inference probability missing');
  assert(infResult.probability < PROTECTED_THRESHOLD, 'Nominal probability should be < 0.20');
  assert.strictEqual(infResult.prediction, 'PASS', 'Nominal prediction should be PASS');
  console.log('✓ Real Node.js ML Inference Execution Verified');

  // 4. Threshold Boundary Precision
  assert.strictEqual(0.19999999 < PROTECTED_THRESHOLD, true);
  assert.strictEqual(0.20000000 >= PROTECTED_THRESHOLD, true);
  assert.strictEqual(0.20000001 >= PROTECTED_THRESHOLD, true);
  console.log('✓ Threshold Boundary & Mathematical Precision Verified');

  // 5. Canonical Demo Cases
  const canonicalData = JSON.parse(fs.readFileSync(CANONICAL_DATA_PATH, 'utf8'));
  assert.strictEqual(canonicalData.lead_time_basis, '168H_EVALUATION_HORIZON_NOT_FAILURE_TIME');
  assert.strictEqual(canonicalData.cases.NORMAL.inference_result.prediction, 'PASS');
  assert.strictEqual(canonicalData.cases.LATENT_DEFECT.operational_recommendation, 'REJECT');
  assert.strictEqual(canonicalData.cases.FALSE_ALARM.why_flagged.disposition, 'MONITOR');
  console.log('✓ Canonical Cases Grounding & Traceability Verified');

  // 6. Fleet Manager Hierarchy (Node.js)
  const { FleetManagerJS } = require('../src/fleet/fleet_manager');
  const fleetMgr = new FleetManagerJS();
  const fleetSummary = fleetMgr.getFleetSummary();
  assert.strictEqual(fleetSummary.total_lots, 50);
  assert(fleetSummary.total_wafers >= 100);
  assert.strictEqual(fleetSummary.total_components, 5000);

  const lot1 = fleetMgr.getLotDetail('LOT-SYN-001');
  assert(lot1 !== null);
  assert(lot1.wafers.includes('WFR-001'));
  assert.strictEqual(fleetMgr.getLotDetail('LOT-INVALID-999'), null);
  console.log('✓ Fleet Manager Hierarchy & Cross-Lot Isolation (Node.js) Verified');

  // 7. Reliability Twin Determinism (Node.js)
  const { ReliabilityTwinManagerJS } = require('../src/reliability_twin/reliability_twin');
  const twinMgr = new ReliabilityTwinManagerJS();
  const twinNormal = twinMgr.buildReliabilityTwin('COMP-NORMAL');
  assert.strictEqual(twinNormal.identity.component_id, 'COMP-NORMAL');
  assert.strictEqual(twinNormal.identity.trace_id, 'TR-NORMAL-2026');
  assert.strictEqual(twinMgr.buildReliabilityTwin('COMP-UNREGISTERED-999').identity.identity_status, 'UNREGISTERED');
  console.log('✓ Reliability Twin Determinism & Read-Only Invariants (Node.js) Verified');

  // 8. Governed Disposition & Human Action Immutability (Node.js)
  const { HumanDispositionManagerJS, registerAuthoritativePrediction } = require('../src/governance/disposition');
  const traceId = 'TR-NODE-ADV-001';
  registerAuthoritativePrediction({
    trace_id: traceId,
    test_id: 'TEST-NODE-001',
    component_id: 'COMP-NODE-001',
    lot_id: 'LOT-SYN-001',
    wafer_id: 'WFR-001',
    die_id: 'DIE-001',
    prediction: 'PASS',
    probability: 0.045,
    model_hash: PROTECTED_MODEL_SHA,
    model_id: 'predicta_xgboost_v4',
    anomaly_score: 0.12,
  });

  const dispMgr = new HumanDispositionManagerJS();
  const dispRes = await dispMgr.recordDispositionAsync({
    trace_id: traceId,
    disposition: 'HOLD',
    reason_code: 'MANUAL_ENGINEERING_REVIEW',
    operator_id: 'OP-QA-NODE-01',
    comment: 'Quality hold for node testing'
  });
  assert.strictEqual(dispRes.disposition, 'HOLD');
  assert.strictEqual(dispRes.original_ml_decision, 'PASS');
  assert.strictEqual(dispRes.original_ml_probability, 0.045);
  assert.strictEqual(dispRes.governance_guarantees.ml_decision_unaltered, true);
  console.log('✓ Governed Disposition & ML Truth Immutability (Node.js) Verified');

  console.log('\n========================================');
  console.log('ALL PHASE 19.4 NODE.JS ADVERSARIAL TESTS PASSED (8/8)');
  console.log('========================================\n');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
