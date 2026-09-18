const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

const { RobustMADDetectorJS } = require('../src/anomaly_detection/robust_mad');
const { COPODDetectorJS } = require('../src/anomaly_detection/copod');
const { IsolationForestDetectorJS } = require('../src/anomaly_detection/isolation_forest');
const { AnomalyFusionEngineJS } = require('../src/anomaly_detection/fusion');

const LOT_CONTRACT_PATH = path.join(__dirname, '../ml/anomaly/lot_reference_contract.json');
const FIXTURE_PATH = path.join(__dirname, 'fixtures/lot_reference_governance_parity.json');

console.log("=========================================================================");
console.log("PREDICTA SIH 2026 — LOT REFERENCE GOVERNANCE SUITE (Node.js)");
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
    console.error(`    Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// 1. Contract Integrity
runTest("Authoritative Lot Reference Contract Schema, Rules & Contamination Status", () => {
  assert(fs.existsSync(LOT_CONTRACT_PATH), "Contract file must exist");
  const contract = JSON.parse(fs.readFileSync(LOT_CONTRACT_PATH, 'utf-8'));
  assert.strictEqual(contract.contract_name, "PREDICTA_LOT_REFERENCE_GOVERNANCE_CONTRACT");
  assert.strictEqual(contract.authority_level, "AUTHORITATIVE_LOT_REFERENCE_CONTRACT");
  assert.strictEqual(contract.data_lineage.is_synthetic, true);
  assert.strictEqual(contract.population_thresholds.minimum_reference_population_size, 10);
  assert.strictEqual(contract.population_thresholds.allow_fabricated_lot_confidence, false);
  
  const statuses = Object.values(contract.semantics_and_provenance).map(v => v.status);
  assert(statuses.includes("LOT_RELATIVE"));
  assert(statuses.includes("INSUFFICIENT_REFERENCE"));
  assert(statuses.includes("UNKNOWN_LOT"));
  assert(statuses.includes("INVALID_INPUT"));

  // Contamination evaluation verification
  assert.strictEqual(
    contract.reference_quality_rules.contamination_evaluation.contamination_status,
    "NOT_EVALUATED_BEYOND_ROBUST_DISPERSION"
  );
  assert.strictEqual(
    contract.reference_quality_rules.contamination_evaluation.classification,
    "PROJECT_DEFINED_SCREENING_CRITERION"
  );

  // Input validation rules verification
  assert.deepStrictEqual(contract.input_validation_rules.strict_canonical_feature_order, ["iddq", "ileak", "tpd"]);
  assert.strictEqual(contract.input_validation_rules.strict_dictionary_order_enforced, true);
});

// Load Fixture Data
assert(fs.existsSync(FIXTURE_PATH), "Fixture file must exist");
const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
const detector = new RobustMADDetectorJS(fixture.model_config);

// CASE A: Known lot >= min reference
runTest("CASE A: Sufficient Known Lot -> LOT_RELATIVE", () => {
  const c = fixture.test_cases.case_a_sufficient_known_lot;
  const res = detector.scoreSingle(c.input.features, c.input.lot_id);
  assert.strictEqual(res.reference_status, c.expected.reference_status);
  assert.strictEqual(res.reference_source, c.expected.reference_source);
  assert.strictEqual(res.reference_sample_count, c.expected.reference_sample_count);
  assert.strictEqual(res.lot_id, c.expected.lot_id);
  assert.strictEqual(res.status, c.expected.status);
  assert(Math.abs(res.score - c.expected.score) < 1e-3);
  for (const feat of Object.keys(c.expected.parameter_z_scores)) {
    assert(Math.abs(res.parameter_z_scores[feat] - c.expected.parameter_z_scores[feat]) < 1e-3);
  }
});

// CASE B: Undersized known lot
runTest("CASE B: Undersized Known Lot -> INSUFFICIENT_REFERENCE + GLOBAL_FALLBACK", () => {
  const c = fixture.test_cases.case_b_undersized_known_lot;
  const res = detector.scoreSingle(c.input.features, c.input.lot_id);
  assert.strictEqual(res.reference_status, c.expected.reference_status);
  assert.strictEqual(res.reference_source, c.expected.reference_source);
  assert.strictEqual(res.reference_sample_count, c.expected.reference_sample_count);
  assert.strictEqual(res.lot_id, c.expected.lot_id);
  assert.strictEqual(res.status, c.expected.status);
  assert(Math.abs(res.score - c.expected.score) < 1e-3);
});

// CASE C: Unseen lot
runTest("CASE C: Completely Unseen Lot -> UNKNOWN_LOT + GLOBAL_FALLBACK", () => {
  const c = fixture.test_cases.case_c_unseen_lot;
  const res = detector.scoreSingle(c.input.features, c.input.lot_id);
  assert.strictEqual(res.reference_status, c.expected.reference_status);
  assert.strictEqual(res.reference_source, c.expected.reference_source);
  assert.strictEqual(res.reference_sample_count, c.expected.reference_sample_count);
  assert.strictEqual(res.lot_id, c.expected.lot_id);
});

// CASE D: Missing lot_id
runTest("CASE D: Missing lot_id -> UNKNOWN_LOT + GLOBAL_FALLBACK", () => {
  const c = fixture.test_cases.case_d_missing_lot;
  const res = detector.scoreSingle(c.input.features, c.input.lot_id);
  assert.strictEqual(res.reference_status, c.expected.reference_status);
  assert.strictEqual(res.reference_source, c.expected.reference_source);
  assert.strictEqual(res.reference_sample_count, 0);
  assert.strictEqual(res.lot_id, null);
});

// CASE E: Empty lot_id
runTest("CASE E: Empty/whitespace lot_id -> UNKNOWN_LOT + GLOBAL_FALLBACK", () => {
  const c = fixture.test_cases.case_e_empty_whitespace_lot;
  const res = detector.scoreSingle(c.input.features, c.input.lot_id);
  assert.strictEqual(res.reference_status, c.expected.reference_status);
  assert.strictEqual(res.reference_source, c.expected.reference_source);
  assert.strictEqual(res.reference_sample_count, 0);
});

// CASE F: Degenerate scale fallback
runTest("CASE F: Degenerate scale falls back safely to global reference", () => {
  const c = fixture.test_cases.case_f_degenerate_zero_scale_lot;
  const res = detector.scoreSingle(c.input.features, c.input.lot_id);
  assert.strictEqual(res.reference_status, c.expected.reference_status);
  assert.strictEqual(res.reference_source, c.expected.reference_source);
  assert(Number.isFinite(res.score));
});

// CASE G: Extreme anomaly reject
runTest("CASE G: Extreme anomaly values trigger REJECT status", () => {
  const c = fixture.test_cases.case_g_extreme_anomaly_reject;
  const res = detector.scoreSingle(c.input.features, c.input.lot_id);
  assert.strictEqual(res.status, c.expected.status);
  assert.strictEqual(res.reference_status, c.expected.reference_status);
  assert(Math.abs(res.score - c.expected.score) < 1e-2);
  assert.deepStrictEqual(res.contributing_features.sort(), c.expected.contributing_features.sort());
});

// CASE H: Reordered dictionary keys rejection
runTest("CASE H: Reordered dictionary keys throw SCHEMA_ORDER_MISMATCH error", () => {
  const c = fixture.test_cases.case_h_reordered_input_rejection;
  assert.throws(
    () => detector.scoreSingle(c.input.features, c.input.lot_id),
    /Feature schema\/order mismatch/
  );
});

// CASE I: Missing feature rejection
runTest("CASE I: Missing required feature throws SCHEMA_ORDER_MISMATCH error", () => {
  const c = fixture.test_cases.case_i_missing_feature_rejection;
  assert.throws(
    () => detector.scoreSingle(c.input.features, c.input.lot_id),
    /Feature schema\/order mismatch/
  );
});

// CASE J: Extra feature rejection
runTest("CASE J: Extra feature throws SCHEMA_ORDER_MISMATCH error", () => {
  const c = fixture.test_cases.case_j_extra_feature_rejection;
  assert.throws(
    () => detector.scoreSingle(c.input.features, c.input.lot_id),
    /Feature schema\/order mismatch/
  );
});

// CASE K: Non-finite input rejection
runTest("CASE K: Non-finite / non-numeric inputs throw explicit error", () => {
  const c = fixture.test_cases.case_k_nan_inf_rejection;
  assert.throws(
    () => detector.scoreSingle(c.input.features, c.input.lot_id),
    /non-finite|non-numeric/i
  );
});

// CASE L: Reference Store Immutability with SHA-256 Hash
runTest("CASE L: Reference store SHA-256 is 100% immutable across scoring runs", () => {
  const sampleComp = { iddq: 2110.0, ileak: 302.0, tpd: 191.0 };
  const hashBefore = crypto.createHash('sha256').update(JSON.stringify({
    global: detector.globalStats,
    lots: detector.lotStats
  })).digest('hex');

  for (let i = 0; i < 50; i++) {
    detector.scoreSingle(sampleComp, `LOT-NEW-${i}`);
  }

  const hashAfter = crypto.createHash('sha256').update(JSON.stringify({
    global: detector.globalStats,
    lots: detector.lotStats
  })).digest('hex');

  assert.strictEqual(hashBefore, hashAfter, "Detector internal state mutated during scoring!");
});

// CASE M: Multi-Criteria Fusion Provenance Propagation
runTest("CASE M: Fusion engine propagates reference provenance", () => {
  const fusion = new AnomalyFusionEngineJS({
    mad_parameters: fixture.model_config,
  });

  const sampleComp = { iddq: 2110.0, ileak: 302.0, tpd: 191.0 };

  const res = fusion.evaluateComponent(sampleComp, "LOT-SYN-001");
  assert.strictEqual(res.reference_status, "LOT_RELATIVE");
  assert.strictEqual(res.reference_source, "LOT_RELATIVE");
  assert.strictEqual(res.reference_sample_count, 100);
  assert.strictEqual(res.lot_id, "LOT-SYN-001");
  assert(res.evidence.mad);
  assert.strictEqual(res.evidence.mad.reference_source, "LOT_RELATIVE");

  const resUnseen = fusion.evaluateComponent(sampleComp, "LOT-UNSEEN");
  assert.strictEqual(resUnseen.reference_status, "UNKNOWN_LOT");
  assert.strictEqual(resUnseen.reference_source, "GLOBAL_FALLBACK");
  assert.strictEqual(resUnseen.reference_sample_count, 0);
});

console.log("\n=========================================================================");
if (passed === total) {
  console.log(`🏆 ALL ${passed}/${total} LOT REFERENCE GOVERNANCE TESTS PASSED 100%! ✅`);
} else {
  console.log(`❌ ${total - passed}/${total} TESTS FAILED!`);
  process.exit(1);
}
console.log("=========================================================================\n");
