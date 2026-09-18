/**
 * Predicta Semiconductor Intelligence Platform — Lot Reference Governance Test Suite (Node.js)
 * File: tests/test_lot_reference_governance.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { RobustMADDetectorJS } = require('../src/anomaly_detection/robust_mad');
const { COPODDetectorJS } = require('../src/anomaly_detection/copod');
const { IsolationForestDetectorJS } = require('../src/anomaly_detection/isolation_forest');
const { AnomalyFusionEngineJS } = require('../src/anomaly_detection/fusion');

const LOT_CONTRACT_PATH = path.join(__dirname, '../ml/anomaly/lot_reference_contract.json');
const SPLIT_MANIFEST_PATH = path.join(__dirname, '../ml/data/split_manifest.json');

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
runTest("Authoritative Lot Reference Contract Schema and Rules", () => {
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
});

// Setup mock detector config
const mockConfig = {
  min_reference_size: 10,
  thresholds: { warning_z: 3.0, reject_z: 6.0 },
  global_stats: {
    iddq: { median: 2100.0, mad: 30.0, sigma: 44.478, is_degenerate: false, sample_count: 1000 },
    ileak: { median: 300.0, mad: 7.0, sigma: 10.3782, is_degenerate: false, sample_count: 1000 },
    tpd: { median: 190.0, mad: 3.5, sigma: 5.1891, is_degenerate: false, sample_count: 1000 },
  },
  lot_stats: {
    "LOT-SYN-001": {
      sample_count: 100,
      reference_source: "LOT_RELATIVE",
      reference_status: "LOT_RELATIVE",
      quality_status: "VALID",
      features: {
        iddq: { median: 2105.0, mad: 28.0, sigma: 41.5128, is_degenerate: false, sample_count: 100 },
        ileak: { median: 298.0, mad: 6.5, sigma: 9.6369, is_degenerate: false, sample_count: 100 },
        tpd: { median: 189.0, mad: 3.2, sigma: 4.7443, is_degenerate: false, sample_count: 100 },
      }
    },
    "LOT-SYN-UNDERSIZED": {
      sample_count: 5,
      reference_source: "GLOBAL_FALLBACK",
      reference_status: "INSUFFICIENT_REFERENCE",
      quality_status: "INSUFFICIENT_SAMPLE_SIZE",
      features: {}
    },
    "LOT-SYN-CONSTANT": {
      sample_count: 50,
      reference_source: "GLOBAL_FALLBACK",
      reference_status: "INSUFFICIENT_REFERENCE",
      quality_status: "DEGENERATE_SCALE",
      features: {
        iddq: { median: 2100.0, mad: 0.0, sigma: null, is_degenerate: true, sample_count: 50 },
        ileak: { median: 300.0, mad: 6.5, sigma: 9.6369, is_degenerate: false, sample_count: 50 },
        tpd: { median: 189.0, mad: 3.2, sigma: 4.7443, is_degenerate: false, sample_count: 50 },
      }
    }
  }
};

const detector = new RobustMADDetectorJS(mockConfig);
const sampleComponent = { iddq: 2110.0, ileak: 302.0, tpd: 191.0 };

// CASE A: Known lot >= min reference
runTest("CASE A: Sufficient Known Lot -> LOT_RELATIVE", () => {
  const res = detector.scoreSingle(sampleComponent, "LOT-SYN-001");
  assert.strictEqual(res.reference_status, "LOT_RELATIVE");
  assert.strictEqual(res.reference_source, "LOT_RELATIVE");
  assert.strictEqual(res.reference_sample_count, 100);
  assert.strictEqual(res.lot_id, "LOT-SYN-001");
  assert.strictEqual(res.reference_context.status, "LOT_RELATIVE");
  assert.strictEqual(res.reference_context.source, "LOT_RELATIVE");
});

// CASE B: Undersized known lot
runTest("CASE B: Undersized Known Lot -> INSUFFICIENT_REFERENCE + GLOBAL_FALLBACK", () => {
  const res = detector.scoreSingle(sampleComponent, "LOT-SYN-UNDERSIZED");
  assert.strictEqual(res.reference_status, "INSUFFICIENT_REFERENCE");
  assert.strictEqual(res.reference_source, "GLOBAL_FALLBACK");
  assert.strictEqual(res.reference_sample_count, 5);
  assert.strictEqual(res.lot_id, "LOT-SYN-UNDERSIZED");
});

// CASE C: Unseen lot
runTest("CASE C: Completely Unseen Lot -> UNKNOWN_LOT + GLOBAL_FALLBACK", () => {
  const res = detector.scoreSingle(sampleComponent, "LOT-SYN-999-UNSEEN");
  assert.strictEqual(res.reference_status, "UNKNOWN_LOT");
  assert.strictEqual(res.reference_source, "GLOBAL_FALLBACK");
  assert.strictEqual(res.reference_sample_count, 0);
  assert.strictEqual(res.lot_id, "LOT-SYN-999-UNSEEN");
});

// CASE D: Missing lot_id
runTest("CASE D: Missing lot_id -> UNKNOWN_LOT + GLOBAL_FALLBACK", () => {
  const res = detector.scoreSingle(sampleComponent, null);
  assert.strictEqual(res.reference_status, "UNKNOWN_LOT");
  assert.strictEqual(res.reference_source, "GLOBAL_FALLBACK");
  assert.strictEqual(res.reference_sample_count, 0);
  assert.strictEqual(res.lot_id, null);
});

// CASE E: Empty lot_id
runTest("CASE E: Empty/whitespace lot_id -> UNKNOWN_LOT + GLOBAL_FALLBACK", () => {
  for (const emptyVal of ["", "   ", "nan", "None", "null"]) {
    const res = detector.scoreSingle(sampleComponent, emptyVal);
    assert.strictEqual(res.reference_status, "UNKNOWN_LOT");
    assert.strictEqual(res.reference_source, "GLOBAL_FALLBACK");
    assert.strictEqual(res.reference_sample_count, 0);
  }
});

// CASE F: Non-finite input rejection
runTest("CASE F: Non-finite inputs throw explicit error", () => {
  assert.throws(() => detector.scoreSingle({ iddq: NaN, ileak: 300.0, tpd: 190.0 }), /non-finite/);
  assert.throws(() => detector.scoreSingle({ iddq: 2100.0, ileak: Infinity, tpd: 190.0 }), /non-finite/);
});

// CASE G: Degenerate scale fallback
runTest("CASE G: Degenerate scale falls back safely to global reference", () => {
  const res = detector.scoreSingle(sampleComponent, "LOT-SYN-CONSTANT");
  assert.strictEqual(res.reference_status, "INSUFFICIENT_REFERENCE");
  assert.strictEqual(res.reference_source, "GLOBAL_FALLBACK");
  assert(Number.isFinite(res.score));
});

// CASE H & I: Determinism
runTest("CASE H & I: Deterministic scoring across repeated evaluations", () => {
  const r1 = detector.scoreSingle(sampleComponent, "LOT-SYN-001");
  const r2 = detector.scoreSingle(sampleComponent, "LOT-SYN-001");
  assert.deepStrictEqual(r1, r2);
});

// CASE J: Missing feature
runTest("CASE J: Missing required feature throws Error", () => {
  assert.throws(() => detector.scoreSingle({ iddq: 2100.0, ileak: 300.0 }), /Missing required canonical anomaly feature/);
});

// CASE K: Extra feature
runTest("CASE K: Extra feature throws Error", () => {
  assert.throws(() => detector.scoreSingle({ iddq: 2100.0, ileak: 300.0, tpd: 190.0, extra: 123.0 }), /Extra feature/);
});

// CASE L: Reference Store Immutability
runTest("CASE L: Scoring unseen lots does not mutate detector reference state", () => {
  const initialLotKeys = Object.keys(detector.lotStats);
  for (let i = 0; i < 50; i++) {
    detector.scoreSingle(sampleComponent, `LOT-NEW-${i}`);
  }
  const postLotKeys = Object.keys(detector.lotStats);
  assert.deepStrictEqual(initialLotKeys, postLotKeys);
});

// CASE M: Multi-Criteria Fusion Provenance
runTest("CASE M: Fusion engine propagates reference provenance", () => {
  const fusion = new AnomalyFusionEngineJS({
    mad_parameters: mockConfig,
  });

  const res = fusion.evaluateComponent(sampleComponent, "LOT-SYN-001");
  assert.strictEqual(res.reference_status, "LOT_RELATIVE");
  assert.strictEqual(res.reference_source, "LOT_RELATIVE");
  assert.strictEqual(res.reference_sample_count, 100);
  assert.strictEqual(res.lot_id, "LOT-SYN-001");
  assert(res.evidence.mad);
  assert.strictEqual(res.evidence.mad.reference_source, "LOT_RELATIVE");

  const resUnseen = fusion.evaluateComponent(sampleComponent, "LOT-UNSEEN");
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
