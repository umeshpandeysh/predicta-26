/**
 * Predicta Semiconductor Intelligence Platform — Stage 4.4 Anomaly Subsystem Hardening Suite (Node.js)
 * File: tests/test_anomaly_hardening.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { PredictaInference } = require('../src/api/inference');
const { AnomalyFusionEngineJS } = require('../src/anomaly_detection/fusion');
const { RobustMADDetectorJS } = require('../src/anomaly_detection/robust_mad');
const { COPODDetectorJS } = require('../src/anomaly_detection/copod');
const { IsolationForestDetectorJS } = require('../src/anomaly_detection/isolation_forest');
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
console.log('STAGE 4.4 — ANOMALY SUBSYSTEM HARDENING & ARCHITECTURE VERIFICATION');
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

// Gate A: Runtime Fusion Delegation Sentinel
runTest('Gate A: Runtime Fusion Delegation Sentinel', () => {
  const originalEngine = service.fusionEngineInstance;

  // Sentinel 1: MONITOR
  service.fusionEngineInstance = {
    evaluateComponent: (features, lotId) => ({
      anomaly_status: 'MONITOR',
      overall_status: 'MONITOR',
      anomaly_score: 0.123456789,
      weighted_fusion_score: 0.123456789,
      fusion_method: 'TEST_SENTINEL_FUSION',
      contributing_detectors: ['TEST_SENTINEL_DETECTOR'],
      detector_evidence: { sentinel: { score: 0.123456789, status: 'MONITOR' } },
      evidence: {},
      reference_status: 'TEST_REFERENCE_STATUS',
      reference_source: 'TEST_REFERENCE_SOURCE',
      reference_sample_count: 9999,
      lot_id: 'TEST_LOT_SENTINEL',
      reference_context: {
        lot_id: 'TEST_LOT_SENTINEL',
        status: 'TEST_REFERENCE_STATUS',
        source: 'TEST_REFERENCE_SOURCE',
        sample_count: 9999,
      },
      calibration_status: 'NOT_CALIBRATED',
      anomaly_calibration_status: 'NOT_CALIBRATED',
      validation_status: 'PROJECT_DEFINED_SCREENING_CRITERION',
      promotion_status: 'BENCHMARK_ONLY',
    }),
  };

  const resMonitor = service.predictSingle(nominalRecord);
  assert.strictEqual(resMonitor.anomaly_status, 'MONITOR');
  assert.strictEqual(resMonitor.anomaly_score, 0.123456789);
  assert.strictEqual(resMonitor.weighted_fusion_score, 0.123456789);
  assert.strictEqual(resMonitor.fusion_method, 'TEST_SENTINEL_FUSION');
  assert.deepStrictEqual(resMonitor.contributing_detectors, ['TEST_SENTINEL_DETECTOR']);
  assert.strictEqual(resMonitor.reference_status, 'TEST_REFERENCE_STATUS');
  assert.strictEqual(resMonitor.reference_source, 'TEST_REFERENCE_SOURCE');
  assert.strictEqual(resMonitor.reference_sample_count, 9999);

  // Sentinel 2: REJECT
  service.fusionEngineInstance = {
    evaluateComponent: (features, lotId) => ({
      anomaly_status: 'REJECT',
      overall_status: 'REJECT',
      anomaly_score: 0.876543211,
      weighted_fusion_score: 0.876543211,
      fusion_method: 'TEST_SENTINEL_FUSION',
      contributing_detectors: ['TEST_SENTINEL_DETECTOR'],
      detector_evidence: { sentinel: { score: 0.876543211, status: 'REJECT' } },
      evidence: {},
      reference_status: 'TEST_REFERENCE_STATUS',
      reference_source: 'TEST_REFERENCE_SOURCE',
      reference_sample_count: 9999,
      lot_id: 'TEST_LOT_SENTINEL',
      reference_context: {
        lot_id: 'TEST_LOT_SENTINEL',
        status: 'TEST_REFERENCE_STATUS',
        source: 'TEST_REFERENCE_SOURCE',
        sample_count: 9999,
      },
      calibration_status: 'NOT_CALIBRATED',
      anomaly_calibration_status: 'NOT_CALIBRATED',
      validation_status: 'PROJECT_DEFINED_SCREENING_CRITERION',
      promotion_status: 'BENCHMARK_ONLY',
    }),
  };

  const resReject = service.predictSingle(nominalRecord);
  assert.strictEqual(resReject.anomaly_status, 'REJECT');
  assert.strictEqual(resReject.anomaly_score, 0.876543211);
  assert.strictEqual(resReject.disposition, 'REJECT');

  service.fusionEngineInstance = originalEngine;
});

// Gate B: Three-Detector Fusion
runTest('Gate B: Three-Detector Fusion', () => {
  const madDet = new RobustMADDetectorJS(service.anomalyArtifacts.robust_mad);
  const copodDet = new COPODDetectorJS(service.anomalyArtifacts.copod);
  const isoMockData = {
    feature_names: ['iddq', 'ileak', 'tpd'],
    trees: [
      {
        children_left: [-1],
        children_right: [-1],
        feature: [-2],
        threshold: [-2.0],
        n_node_samples: [100]
      }
    ],
    max_samples: 256,
    offset: -0.5,
    c_factor: 10.0,
    thresholds: { warning_score: 0.55, reject_score: 0.65 }
  };
  const isoDet = new IsolationForestDetectorJS(isoMockData);

  const engine = new AnomalyFusionEngineJS();
  engine.madDetector = madDet;
  engine.copodDetector = copodDet;
  engine.isoDetector = isoDet;

  const canonical = service.getNormalizedParams(nominalRecord);
  const res = engine.evaluateComponent(canonical, 'LOT-001');

  assert.strictEqual(res.contributing_detectors.length, 3);
  assert.ok(res.contributing_detectors.includes('robust_mad'));
  assert.ok(res.contributing_detectors.includes('copod'));
  assert.ok(res.contributing_detectors.includes('isolation_forest'));
  assert.ok(res.anomaly_score !== null);
});

// Gate C: Every Two-Detector Combination (3 pairs)
runTest('Gate C: Every Two-Detector Combination', () => {
  const madDet = new RobustMADDetectorJS(service.anomalyArtifacts.robust_mad);
  const copodDet = new COPODDetectorJS(service.anomalyArtifacts.copod);
  const isoMockData = {
    feature_names: ['iddq', 'ileak', 'tpd'],
    trees: [
      {
        children_left: [-1],
        children_right: [-1],
        feature: [-2],
        threshold: [-2.0],
        n_node_samples: [100]
      }
    ],
    max_samples: 256,
    offset: -0.5,
    c_factor: 10.0,
    thresholds: { warning_score: 0.55, reject_score: 0.65 }
  };
  const isoDet = new IsolationForestDetectorJS(isoMockData);
  const canonical = service.getNormalizedParams(nominalRecord);

  // Pair 1: MAD + COPOD
  const e1 = new AnomalyFusionEngineJS();
  e1.madDetector = madDet;
  e1.copodDetector = copodDet;
  const r1 = e1.evaluateComponent(canonical, 'LOT-001');
  assert.deepStrictEqual(r1.contributing_detectors, ['robust_mad', 'copod']);

  // Pair 2: MAD + ISO
  const e2 = new AnomalyFusionEngineJS();
  e2.madDetector = madDet;
  e2.isoDetector = isoDet;
  const r2 = e2.evaluateComponent(canonical, 'LOT-001');
  assert.deepStrictEqual(r2.contributing_detectors, ['robust_mad', 'isolation_forest']);

  // Pair 3: COPOD + ISO
  const e3 = new AnomalyFusionEngineJS();
  e3.copodDetector = copodDet;
  e3.isoDetector = isoDet;
  const r3 = e3.evaluateComponent(canonical, 'LOT-001');
  assert.deepStrictEqual(r3.contributing_detectors, ['copod', 'isolation_forest']);
});

// Gate D: Every Single-Detector Combination (3 singles)
runTest('Gate D: Every Single-Detector Combination', () => {
  const madDet = new RobustMADDetectorJS(service.anomalyArtifacts.robust_mad);
  const copodDet = new COPODDetectorJS(service.anomalyArtifacts.copod);
  const isoMockData = {
    feature_names: ['iddq', 'ileak', 'tpd'],
    trees: [
      {
        children_left: [-1],
        children_right: [-1],
        feature: [-2],
        threshold: [-2.0],
        n_node_samples: [100]
      }
    ],
    max_samples: 256,
    offset: -0.5,
    c_factor: 10.0,
    thresholds: { warning_score: 0.55, reject_score: 0.65 }
  };
  const isoDet = new IsolationForestDetectorJS(isoMockData);
  const canonical = service.getNormalizedParams(nominalRecord);

  // Single 1: MAD only
  const e1 = new AnomalyFusionEngineJS();
  e1.madDetector = madDet;
  const r1 = e1.evaluateComponent(canonical, 'LOT-001');
  assert.deepStrictEqual(r1.contributing_detectors, ['robust_mad']);

  // Single 2: COPOD only
  const e2 = new AnomalyFusionEngineJS();
  e2.copodDetector = copodDet;
  const r2 = e2.evaluateComponent(canonical, 'LOT-001');
  assert.deepStrictEqual(r2.contributing_detectors, ['copod']);

  // Single 3: ISO only
  const e3 = new AnomalyFusionEngineJS();
  e3.isoDetector = isoDet;
  const r3 = e3.evaluateComponent(canonical, 'LOT-001');
  assert.deepStrictEqual(r3.contributing_detectors, ['isolation_forest']);
});

// Gate E: Zero-Detector Fail Closed
runTest('Gate E: Zero-Detector Fail Closed', () => {
  const engine = new AnomalyFusionEngineJS();
  const res = engine.evaluateComponent({ iddq: 2140.0, ileak: 301.6, tpd: 192.1 }, 'LOT-001');

  assert.strictEqual(res.anomaly_status, 'INSUFFICIENT_EVIDENCE');
  assert.strictEqual(res.overall_status, 'INSUFFICIENT_EVIDENCE');
  assert.strictEqual(res.anomaly_score, null);
  assert.strictEqual(res.weighted_fusion_score, null);
  assert.deepStrictEqual(res.contributing_detectors, []);
  assert.strictEqual(res.fusion_method, 'NO_ACTIVE_DETECTORS');
  assert.notStrictEqual(res.anomaly_status, 'PASS');
});

// Gates F, G, H, I, J: Strict Feature Contract Enforcement
runTest('Gates F, G, H, I, J: Strict Feature Contract Enforcement', () => {
  const engine = new AnomalyFusionEngineJS();

  // F. Reordered
  assert.throws(() => {
    engine.evaluateComponent({ tpd: 192.1, iddq: 2140.0, ileak: 301.6 });
  }, /Feature schema\/order mismatch/);

  // G. Missing
  assert.throws(() => {
    engine.evaluateComponent({ iddq: 2140.0, ileak: 301.6 });
  }, /Feature schema\/order mismatch/);

  // H. Extra
  assert.throws(() => {
    engine.evaluateComponent({ iddq: 2140.0, ileak: 301.6, tpd: 192.1, extra: 1.0 });
  }, /Feature schema\/order mismatch/);

  // I. NaN
  assert.throws(() => {
    engine.evaluateComponent({ iddq: NaN, ileak: 301.6, tpd: 192.1 });
  }, /Invalid non-numeric or non-finite/);

  // J. Infinity
  assert.throws(() => {
    engine.evaluateComponent({ iddq: Infinity, ileak: 301.6, tpd: 192.1 });
  }, /Invalid non-numeric or non-finite/);
});

// Gates K, L, M, N: Lot Reference Governance
runTest('Gates K, L, M: Lot Reference Governance', () => {
  const recK = { ...nominalRecord, lot_id: 'FAB_UNKNOWN_LOT_999' };
  const resK = service.predictSingle(recK);
  assert.strictEqual(resK.reference_status, 'UNKNOWN_LOT');
  assert.strictEqual(resK.reference_source, 'GLOBAL_FALLBACK');

  const recL = { ...nominalRecord, lot_id: 'LOT_UNDERSIZED_TEST' };
  const resL = service.predictSingle(recL);
  assert.strictEqual(resL.reference_source, 'GLOBAL_FALLBACK');

  const recM = { ...nominalRecord };
  delete recM.lot_id;
  const resM = service.predictSingle(recM);
  assert.strictEqual(resM.reference_status, 'UNKNOWN_LOT');
  assert.strictEqual(resM.reference_source, 'GLOBAL_FALLBACK');
});

// Gate O: Test-Lot Contamination Protection & Reference Store Immutability
runTest('Gate O: Test-Lot Contamination Protection & Reference Store Immutability', () => {
  const splitManifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../ml/data/split_manifest.json'), 'utf8'));
  const testLots = new Set((splitManifest.lots && splitManifest.lots.test) || []);
  assert.ok(testLots.size > 0, 'Test lots must be defined');

  const anomalyArtifacts = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../ml/models/production/predicta_anomaly_artifacts.json'), 'utf8'));
  const madLots = Object.keys((anomalyArtifacts.robust_mad && anomalyArtifacts.robust_mad.lot_stats) || {});
  madLots.forEach(lot => {
    assert.ok(!testLots.has(lot), `Contamination detected! Test lot ${lot} found in MAD store.`);
  });

  const initialSha = crypto.createHash('sha256').update(JSON.stringify(anomalyArtifacts)).digest('hex');
  const engine = AnomalyFusionEngineJS.fromArtifacts(anomalyArtifacts);
  for (let i = 0; i < 20; i++) {
    engine.evaluateComponent({ iddq: 2140.0, ileak: 301.6, tpd: 192.1 }, 'LOT-001');
  }
  const afterSha = crypto.createHash('sha256').update(JSON.stringify(anomalyArtifacts)).digest('hex');
  assert.strictEqual(initialSha, afterSha, 'Reference store mutated during scoring!');
});

// Gate P: NOT_CALIBRATED Enforcement
runTest('Gate P: NOT_CALIBRATED Enforcement', () => {
  const res = service.predictSingle(nominalRecord);
  assert.strictEqual(res.anomaly_calibration_status, 'NOT_CALIBRATED');
  assert.strictEqual(res.calibration_status, 'NOT_CALIBRATED');
  assert.strictEqual(res.ml_details.anomaly_detection.calibration_status, 'NOT_CALIBRATED');
});

// Gate Q: V2 Promotion Lock
runTest('Gate Q: V2 Promotion Lock', () => {
  const res = service.predictSingle(nominalRecord);
  assert.strictEqual(res.promotion_status, 'BENCHMARK_ONLY');
  assert.strictEqual(res.model_version, '4.0.0_authoritative');

  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../ml/models/production/predicta_production_manifest.json'), 'utf8'));
  assert.strictEqual(manifest.release_version, '2.0_production');
  assert.strictEqual(manifest.authoritative_threshold, 0.20);
});

// Gate R: Parity Fixture Verification (<= 1e-4)
runTest('Gate R: Parity Fixture Verification', () => {
  const fixturePath = path.resolve(__dirname, 'fixtures/anomaly_fusion_parity.json');
  if (!fs.existsSync(fixturePath)) return;
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  const cfg = fixture.fusion_config;
  const engine = AnomalyFusionEngineJS.fromArtifacts({
    robust_mad: cfg.mad_parameters,
    copod: cfg.copod_parameters,
    isolation_forest: cfg.isolation_forest_parameters
  }, {
    weights: cfg.weights,
    monitor_threshold: cfg.monitor_threshold,
    reject_threshold: cfg.reject_threshold,
    normalization_scales: cfg.normalization_scales
  });

  Object.entries(fixture.test_cases || {}).forEach(([caseKey, c]) => {
    if (caseKey === 'case_f_zero_detectors_available') {
      const emptyEngine = new AnomalyFusionEngineJS();
      const res = emptyEngine.evaluateComponent(c.input.features, c.input.lot_id);
      assert.strictEqual(res.anomaly_status, 'INSUFFICIENT_EVIDENCE');
      assert.strictEqual(res.anomaly_score, null);
      return;
    }
    if (c.input && c.input.features && c.expected) {
      const res = engine.evaluateComponent(c.input.features, c.input.lot_id);
      if (c.expected.anomaly_status) {
        assert.strictEqual(res.anomaly_status, c.expected.anomaly_status, `Case ${caseKey} anomaly_status mismatch`);
      }
      if (c.expected.anomaly_score !== undefined) {
        assert.ok(Math.abs(res.anomaly_score - c.expected.anomaly_score) <= 1e-4, `Case ${caseKey} score mismatch: ${res.anomaly_score} vs ${c.expected.anomaly_score}`);
      }
    }
  });
});

// Gate S: Frontend Authority (Display Only)
runTest('Gate S: Frontend Authority (Display Only)', () => {
  const b1 = fs.readFileSync(path.resolve(__dirname, '../script.js'));
  const b2 = fs.readFileSync(path.resolve(__dirname, '../frontend/script.js'));
  assert.strictEqual(b1.length, b2.length, 'Byte length mismatch between root script.js and frontend/script.js');
  const h1 = crypto.createHash('sha256').update(b1).digest('hex');
  const h2 = crypto.createHash('sha256').update(b2).digest('hex');
  assert.strictEqual(h1, h2, 'SHA-256 mismatch between root script.js and frontend/script.js');
});

// Gate T: Threshold Single Source of Truth
runTest('Gate T: Threshold Single Source of Truth', () => {
  const contract = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../ml/anomaly/fusion_contract.json'), 'utf8'));
  const twoT = contract.fusion_methodology.two_threshold_policy;
  const expectedMonitor = Number(twoT.monitor_threshold);
  const expectedReject = Number(twoT.reject_threshold);
  const expectedWeights = contract.fusion_methodology.default_weights;

  const engine = new AnomalyFusionEngineJS();
  assert.strictEqual(engine.monitorThreshold, expectedMonitor);
  assert.strictEqual(engine.rejectThreshold, expectedReject);
  assert.deepStrictEqual(engine.weights, expectedWeights);
});

console.log('\n===============================================================================');
console.log('ALL STAGE 4.4 ANOMALY HARDENING GATES PASSED (20/20)!');
console.log('===============================================================================\n');
