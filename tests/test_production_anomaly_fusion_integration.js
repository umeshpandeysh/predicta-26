const assert = require('assert');
const { PredictaInference } = require('../src/api/inference');
const { AnomalyFusionEngineJS } = require('../src/anomaly_detection/fusion');
const { CALIBRATION_STATUS, VALIDATION_STATUS } = require('../src/anomaly_detection/normalization');

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

console.log('\n===============================================================================');
console.log('STAGE 4.3A — PRODUCTION ANOMALY FUSION INTEGRATION & GOVERNANCE SUITE');
console.log('===============================================================================\n');

const service = new PredictaInference();

const nominalRecord = {
  equipment_id: 'EQP-101',
  lot_id: 'LOT-001',
  wafer_id: 'W-01',
  die_id: 'D-01',
  supply_voltage: 1.20,
  threshold_voltage: 0.35,
  temperature: 25.0,
  current: 45.0,
  leakage_current: 111.73,
  dynamic_power: 54.0,
  frequency: 3000.0,
  propagation_delay: 10.98,
  output_voltage: 1.18,
  resistance: 12.5,
  capacitance: 4.2,
  setup_time: 0.85,
  hold_time: 0.42,
  timing_margin: 2.6,
  total_power: 54.4,
  test_duration: 150.0,
  iddq_standby: 10.70,
};

runTest('Case A: Nominal Parity (Production Inference == Authoritative Fusion)', () => {
  const res = service.predictSingle(nominalRecord);
  const canonical = service.getNormalizedParams(nominalRecord);
  const fusionRes = service.evaluateAnomalyFusion(canonical, 'LOT-001');

  assert.strictEqual(res.anomaly_status, fusionRes.anomaly_status);
  assert.strictEqual(res.anomaly_score, fusionRes.anomaly_score);
  assert.strictEqual(res.overall_status, fusionRes.overall_status);
  assert.strictEqual(res.anomaly_calibration_status, 'NOT_CALIBRATED');
  assert.strictEqual(res.calibration_status, CALIBRATION_STATUS);
  assert.strictEqual(res.validation_status, VALIDATION_STATUS);
  assert.strictEqual(res.promotion_status, 'BENCHMARK_ONLY');
  assert.strictEqual(res.fusion_method, 'WEIGHTED_SCORE_FUSION');
  assert.deepStrictEqual(res.contributing_detectors, fusionRes.contributing_detectors);
  assert.ok(res.contributing_detectors.includes('robust_mad'));
  assert.ok(res.contributing_detectors.includes('copod'));
});

runTest('Case B: Monitor Parity', () => {
  const rec = { ...nominalRecord, leakage_current: 280.0, propagation_delay: 15.5 };
  const res = service.predictSingle(rec);
  const canonical = service.getNormalizedParams(rec);
  const fusionRes = service.evaluateAnomalyFusion(canonical, 'LOT-001');

  assert.strictEqual(res.anomaly_status, fusionRes.anomaly_status);
  assert.ok(['MONITOR', 'REJECT'].includes(res.anomaly_status));
  assert.strictEqual(res.anomaly_score, fusionRes.anomaly_score);
});

runTest('Case C: Reject Parity (Severe Outlier Components Quarantined)', () => {
  const rec = { ...nominalRecord, leakage_current: 1200.0, propagation_delay: 45.0, iddq_standby: 40.0 };
  const res = service.predictSingle(rec);
  const canonical = service.getNormalizedParams(rec);
  const fusionRes = service.evaluateAnomalyFusion(canonical, 'LOT-001');

  assert.strictEqual(res.anomaly_status, fusionRes.anomaly_status);
  assert.strictEqual(res.anomaly_status, 'REJECT');
  assert.strictEqual(res.disposition, 'REJECT');
  assert.strictEqual(res.operational_decision, 'REJECT');
});

runTest('Case D: Unknown Lot Governed via Global Fallback', () => {
  const rec = { ...nominalRecord, lot_id: 'UNKNOWN_LOT_XYZ_9999' };
  const res = service.predictSingle(rec);
  const canonical = service.getNormalizedParams(rec);
  const fusionRes = service.evaluateAnomalyFusion(canonical, 'UNKNOWN_LOT_XYZ_9999');

  assert.strictEqual(res.anomaly_status, fusionRes.anomaly_status);
  assert.strictEqual(res.reference_status, 'UNKNOWN_LOT');
  assert.strictEqual(res.reference_source, 'GLOBAL_FALLBACK');
});

runTest('Case E: Undersized Lot Governed via Global Fallback', () => {
  const rec = { ...nominalRecord, lot_id: 'LOT_UNDERSIZED_TEST' };
  const res = service.predictSingle(rec);
  const canonical = service.getNormalizedParams(rec);
  const fusionRes = service.evaluateAnomalyFusion(canonical, 'LOT_UNDERSIZED_TEST');

  assert.strictEqual(res.anomaly_status, fusionRes.anomaly_status);
  assert.strictEqual(res.reference_source, 'GLOBAL_FALLBACK');
});

runTest('Case F: Missing / None Lot Governed via Global Fallback', () => {
  const rec = { ...nominalRecord };
  delete rec.lot_id;
  const res = service.predictSingle(rec);
  const canonical = service.getNormalizedParams(rec);
  const fusionRes = service.evaluateAnomalyFusion(canonical, null);

  assert.strictEqual(res.anomaly_status, fusionRes.anomaly_status);
  assert.strictEqual(res.reference_status, 'UNKNOWN_LOT');
  assert.strictEqual(res.reference_source, 'GLOBAL_FALLBACK');
});

runTest('Case G: One Detector Unavailable (Dynamic Weight Re-normalization)', () => {
  const artifactsSub = {
    robust_mad: service.anomalyArtifacts.robust_mad,
    copod: service.anomalyArtifacts.copod,
  };
  const fusionEngine = AnomalyFusionEngineJS.fromArtifacts(artifactsSub);
  const canonical = service.getNormalizedParams(nominalRecord);
  const res = fusionEngine.evaluateComponent(canonical, 'LOT-001');

  assert.strictEqual(res.contributing_detectors.length, 2);
  assert.ok(res.contributing_detectors.includes('robust_mad'));
  assert.ok(res.contributing_detectors.includes('copod'));
  assert.ok(!res.contributing_detectors.includes('isolation_forest'));
  assert.ok(res.anomaly_score !== null);
  assert.ok(['PASS', 'MONITOR', 'REJECT'].includes(res.anomaly_status));
});

runTest('Case H: Two Detectors Unavailable (100% Weight on Sole Detector)', () => {
  const artifactsSub = {
    copod: service.anomalyArtifacts.copod,
  };
  const fusionEngine = AnomalyFusionEngineJS.fromArtifacts(artifactsSub);
  const canonical = service.getNormalizedParams(nominalRecord);
  const res = fusionEngine.evaluateComponent(canonical, 'LOT-001');

  assert.deepStrictEqual(res.contributing_detectors, ['copod']);
  assert.ok(res.anomaly_score !== null);
  assert.ok(['PASS', 'MONITOR', 'REJECT'].includes(res.anomaly_status));
});

runTest('Case I: Zero Detectors Fail Closed (INSUFFICIENT_EVIDENCE & null score)', () => {
  const fusionEngine = AnomalyFusionEngineJS.fromArtifacts({});
  const canonical = { iddq: 2140.0, ileak: 301.6, tpd: 192.1 };
  const res = fusionEngine.evaluateComponent(canonical, 'LOT-001');

  assert.strictEqual(res.anomaly_status, 'INSUFFICIENT_EVIDENCE');
  assert.strictEqual(res.anomaly_score, null);
  assert.strictEqual(res.weighted_fusion_score, null);
  assert.deepStrictEqual(res.contributing_detectors, []);
  assert.strictEqual(res.fusion_method, 'NO_ACTIVE_DETECTORS');
  assert.notStrictEqual(res.anomaly_status, 'PASS');
});

runTest('Case J: Reordered Feature Input Rejection', () => {
  const fusionEngine = AnomalyFusionEngineJS.fromArtifacts({});
  const reordered = { tpd: 192.1, iddq: 2140.0, ileak: 301.6 };
  assert.throws(() => {
    fusionEngine.evaluateComponent(reordered);
  }, /Feature schema\/order mismatch/);
});

runTest('Case K: Malformed / NaN Numeric Input Rejection', () => {
  const fusionEngine = AnomalyFusionEngineJS.fromArtifacts({});
  const nanInput = { iddq: NaN, ileak: 301.6, tpd: 192.1 };
  assert.throws(() => {
    fusionEngine.evaluateComponent(nanInput);
  }, /Invalid non-numeric or non-finite/);
});

runTest('Case L: Anomaly Calibration Honesty (NOT_CALIBRATED)', () => {
  const res = service.predictSingle(nominalRecord);

  assert.strictEqual(res.anomaly_calibration_status, 'NOT_CALIBRATED');
  assert.strictEqual(res.calibration_status, 'NOT_CALIBRATED');

  const anomalyDetails = res.ml_details && res.ml_details.anomaly_detection;
  assert.ok(anomalyDetails, 'Anomaly details must exist in ml_details');
  assert.strictEqual(anomalyDetails.calibration_status, 'NOT_CALIBRATED');

  assert.ok('probability' in res);
  assert.ok('anomaly_score' in res);
});

console.log('\n===============================================================================');
console.log('ALL PRODUCTION ANOMALY FUSION INTEGRATION TESTS PASSED (12/12)!');
console.log('===============================================================================\n');
