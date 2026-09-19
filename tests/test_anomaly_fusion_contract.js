/**
 * Predicta Semiconductor Intelligence Platform — Anomaly Fusion Contract Test Suite (Node.js)
 * File: tests/test_anomaly_fusion_contract.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

const { AnomalyFusionEngineJS } = require('../src/anomaly_detection/fusion');
const { RobustMADDetectorJS } = require('../src/anomaly_detection/robust_mad');
const { COPODDetectorJS } = require('../src/anomaly_detection/copod');
const { IsolationForestDetectorJS } = require('../src/anomaly_detection/isolation_forest');
const {
  DEFAULT_NORMALIZATION_SCALES,
  CALIBRATION_STATUS,
  VALIDATION_STATUS,
  normalizeDetectorScore,
} = require('../src/anomaly_detection/normalization');

const FUSION_CONTRACT_PATH = path.join(__dirname, '../ml/anomaly/fusion_contract.json');
const FIXTURE_PATH = path.join(__dirname, 'fixtures/anomaly_fusion_parity.json');

console.log("=========================================================================");
console.log("PREDICTA SIH 2026 — ANOMALY FUSION CONTRACT SUITE (Node.js)");
console.log("=========================================================================\n");

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ [PASS] Test ${total.toString().padStart(2, '0')}: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] Test ${total.toString().padStart(2, '0')}: ${name}`);
    console.error(`    Error: ${err.stack || err.message}`);
    process.exitCode = 1;
  }
}

// 1. Contract Schema & Integrity
runTest("Authoritative Fusion Contract Schema & Integrity", () => {
  assert(fs.existsSync(FUSION_CONTRACT_PATH), "Contract file must exist");
  const contract = JSON.parse(fs.readFileSync(FUSION_CONTRACT_PATH, 'utf-8'));
  assert.strictEqual(contract.contract_name, "PREDICTA_ANOMALY_FUSION_CONTRACT");
  assert.strictEqual(contract.authority_level, "AUTHORITATIVE_ANOMALY_FUSION_CONTRACT");
  assert.strictEqual(contract.data_governance.is_synthetic, true);
  assert.strictEqual(contract.calibration_and_validation_governance.calibration_status, "NOT_CALIBRATED");
  assert.strictEqual(contract.calibration_and_validation_governance.promotion_status, "BENCHMARK_ONLY");
  assert.strictEqual(contract.calibration_and_validation_governance.probability_claims_permitted, false);
  assert.strictEqual(contract.fusion_methodology.two_threshold_policy.monitor_threshold, 0.35);
  assert.strictEqual(contract.fusion_methodology.two_threshold_policy.reject_threshold, 0.50);
  assert.strictEqual(contract.fusion_methodology.zero_detectors_available_policy.allow_pass, false);
});

// 2. Normalization Bounds & Monotonicity
runTest("Deterministic Normalization Bounding and Monotonicity", () => {
  assert.strictEqual(normalizeDetectorScore("robust_mad", 0.0), 0.0);
  assert.strictEqual(normalizeDetectorScore("robust_mad", 3.0), 0.50);
  assert.strictEqual(normalizeDetectorScore("robust_mad", 6.0), 1.0);
  assert.strictEqual(normalizeDetectorScore("robust_mad", 12.0), 1.0);

  assert.strictEqual(normalizeDetectorScore("copod", 0.0), 0.0);
  assert.strictEqual(normalizeDetectorScore("copod", 9.5), 1.0);
  assert.strictEqual(normalizeDetectorScore("copod", 20.0), 1.0);

  assert.strictEqual(normalizeDetectorScore("isolation_forest", 0.35), 0.0);
  assert.strictEqual(normalizeDetectorScore("isolation_forest", 0.40), 0.0);
  assert.strictEqual(normalizeDetectorScore("isolation_forest", 0.55), 0.50);
  assert.strictEqual(normalizeDetectorScore("isolation_forest", 0.70), 1.0);
  assert.strictEqual(normalizeDetectorScore("isolation_forest", 0.95), 1.0);
});

// Load Fixture
assert(fs.existsSync(FIXTURE_PATH), "Fixture file must exist");
const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
const engine = new AnomalyFusionEngineJS(fixture.fusion_config);

// 3. Case A: Nominal with all detectors
runTest("Case A: Nominal Component -> PASS with all detectors active", () => {
  const c = fixture.test_cases.case_a_nominal_all_detectors;
  const res = engine.evaluateComponent(c.input.features, c.input.lot_id);
  assert.strictEqual(res.anomaly_status, c.expected.anomaly_status);
  assert.strictEqual(res.reference_status, c.expected.reference_status);
  assert.strictEqual(res.reference_source, c.expected.reference_source);
  assert.deepStrictEqual(res.contributing_detectors.sort(), c.expected.contributing_detectors.sort());
  assert.strictEqual(res.calibration_status, "NOT_CALIBRATED");
  assert.strictEqual(res.validation_status, "PROJECT_DEFINED_SCREENING_CRITERION");
  assert.strictEqual(res.promotion_status, "BENCHMARK_ONLY");
});

// 4. Cases B-E: Dynamic weight re-normalization with missing detectors
runTest("Cases B-E: Dynamic Weight Re-normalization for Detector Subsets", () => {
  const comp = { iddq: 2100.0, ileak: 300.0, tpd: 190.0 };

  // Case B: No MAD
  const engB = new AnomalyFusionEngineJS({
    copod_parameters: fixture.fusion_config.copod_parameters,
    isolation_forest_parameters: fixture.fusion_config.isolation_forest_parameters,
  });
  const resB = engB.evaluateComponent(comp, "LOT-SYN-001");
  assert.deepStrictEqual(resB.contributing_detectors, ["copod", "isolation_forest"]);
  assert.strictEqual(resB.anomaly_status, "PASS");

  // Case C: No COPOD
  const engC = new AnomalyFusionEngineJS({
    mad_parameters: fixture.fusion_config.mad_parameters,
    isolation_forest_parameters: fixture.fusion_config.isolation_forest_parameters,
  });
  const resC = engC.evaluateComponent(comp, "LOT-SYN-001");
  assert.deepStrictEqual(resC.contributing_detectors, ["robust_mad", "isolation_forest"]);
  assert.strictEqual(resC.reference_status, "LOT_RELATIVE");

  // Case D: No ISO
  const engD = new AnomalyFusionEngineJS({
    mad_parameters: fixture.fusion_config.mad_parameters,
    copod_parameters: fixture.fusion_config.copod_parameters,
  });
  const resD = engD.evaluateComponent(comp, "LOT-SYN-001");
  assert.deepStrictEqual(resD.contributing_detectors, ["robust_mad", "copod"]);

  // Case E: Only MAD
  const engE = new AnomalyFusionEngineJS({
    mad_parameters: fixture.fusion_config.mad_parameters,
  });
  const resE = engE.evaluateComponent(comp, "LOT-SYN-001");
  assert.deepStrictEqual(resE.contributing_detectors, ["robust_mad"]);
});

// 5. Case F: Zero Detectors Fail-Closed
runTest("Case F: Zero active detectors fail-closed (NEVER return PASS)", () => {
  const emptyEng = new AnomalyFusionEngineJS();
  const comp = { iddq: 2100.0, ileak: 300.0, tpd: 190.0 };
  const res = emptyEng.evaluateComponent(comp, "LOT-SYN-001");
  assert.strictEqual(res.anomaly_status, "INSUFFICIENT_EVIDENCE");
  assert.strictEqual(res.overall_status, "INSUFFICIENT_EVIDENCE");
  assert.strictEqual(res.anomaly_score, null);
  assert.strictEqual(res.fusion_method, "NO_ACTIVE_DETECTORS");
  assert.deepStrictEqual(res.contributing_detectors, []);
  assert.strictEqual(res.reference_status, "INSUFFICIENT_EVIDENCE");
});

// 6. Cases G-J: Lot reference provenance propagation
runTest("Cases G-J: Lot reference provenance propagation", () => {
  const cases = fixture.test_cases;

  // Undersized
  const resG = engine.evaluateComponent(cases.case_g_undersized_known_lot.input.features, "LOT-SYN-UNDERSIZED");
  assert.strictEqual(resG.reference_status, "INSUFFICIENT_REFERENCE");
  assert.strictEqual(resG.reference_source, "GLOBAL_FALLBACK");
  assert.strictEqual(resG.reference_sample_count, 5);

  // Unseen
  const resH = engine.evaluateComponent(cases.case_h_unseen_lot.input.features, "LOT-UNSEEN-999");
  assert.strictEqual(resH.reference_status, "UNKNOWN_LOT");
  assert.strictEqual(resH.reference_source, "GLOBAL_FALLBACK");
  assert.strictEqual(resH.reference_sample_count, 0);

  // Missing
  const resI = engine.evaluateComponent(cases.case_i_missing_lot.input.features, null);
  assert.strictEqual(resI.reference_status, "UNKNOWN_LOT");
  assert.strictEqual(resI.reference_source, "GLOBAL_FALLBACK");

  // Degenerate
  const resJ = engine.evaluateComponent(cases.case_j_degenerate_constant_lot.input.features, "LOT-SYN-CONSTANT");
  assert.strictEqual(resJ.reference_status, "INSUFFICIENT_REFERENCE");
  assert.strictEqual(resJ.reference_source, "GLOBAL_FALLBACK");
});

// 7. Case K: Extreme Anomaly Reject
runTest("Case K: Extreme Anomaly triggers REJECT and conservative alarm", () => {
  const c = fixture.test_cases.case_k_extreme_anomaly_reject;
  const res = engine.evaluateComponent(c.input.features, c.input.lot_id);
  assert.strictEqual(res.anomaly_status, "REJECT");
  assert.strictEqual(res.overall_status, "REJECT");
  assert.strictEqual(res.conservative_alarm, true);
  assert(res.weighted_fusion_score >= 0.50);
});

// 8. Cases L-O: Schema order and numeric input validation
runTest("Cases L-O: Schema order and non-numeric/non-finite rejection", () => {
  const cases = fixture.test_cases;

  assert.throws(
    () => engine.evaluateComponent(cases.case_l_reordered_features_rejection.input.features),
    /Feature schema\/order mismatch/
  );

  assert.throws(
    () => engine.evaluateComponent(cases.case_m_missing_feature_rejection.input.features),
    /Feature schema\/order mismatch/
  );

  assert.throws(
    () => engine.evaluateComponent(cases.case_n_extra_feature_rejection.input.features),
    /Feature schema\/order mismatch/
  );

  assert.throws(
    () => engine.evaluateComponent(cases.case_o_nan_inf_rejection.input.features),
    /non-numeric or non-finite/
  );
});

// 9. Immutability
runTest("Pure Immutability: Engine state unchanged after 50 scoring runs", () => {
  const hashBefore = crypto.createHash('sha256').update(JSON.stringify({
    mad: engine.madDetector ? engine.madDetector.lotStats : null,
    copod: engine.copodDetector ? engine.copodDetector.globalEcdfs : null,
    iso: engine.isoDetector ? engine.isoDetector.trees : null,
  })).digest('hex');

  const sample = { iddq: 2100.0, ileak: 300.0, tpd: 190.0 };
  for (let i = 0; i < 50; i++) {
    engine.evaluateComponent(sample, `LOT-TEST-${i}`);
  }

  const hashAfter = crypto.createHash('sha256').update(JSON.stringify({
    mad: engine.madDetector ? engine.madDetector.lotStats : null,
    copod: engine.copodDetector ? engine.copodDetector.globalEcdfs : null,
    iso: engine.isoDetector ? engine.isoDetector.trees : null,
  })).digest('hex');

  assert.strictEqual(hashBefore, hashAfter, "Engine state mutated during evaluation!");
});

console.log("\n=========================================================================");
if (passed === total) {
  console.log(`🏆 ALL ${passed}/${total} ANOMALY FUSION CONTRACT TESTS PASSED 100%! ✅`);
} else {
  console.log(`❌ ${total - passed}/${total} TESTS FAILED!`);
  process.exit(1);
}
console.log("=========================================================================\n");
