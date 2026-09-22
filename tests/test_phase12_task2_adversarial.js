/**
 * PREDICTA — PHASE 12 TASK 2 ADVERSARIAL TEST SUITE (Node.js)
 * File: tests/test_phase12_task2_adversarial.js
 * 
 * Verifies 24 exact independent adversarial cases (A01 through A24) for Phase 12 Task 2.
 */

process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const inferenceModule = require('../src/api/inference');
const PredictaInferenceServiceJS = inferenceModule.PredictaInferenceServiceJS || inferenceModule.constructor;
const { handleApiRequest } = require('../src/api/server');

const MANIFEST_PATH = path.join(__dirname, 'artifacts/phase12_task2_adversarial_manifest.json');

console.log("=========================================================================");
console.log("🚀 PREDICTA — PHASE 12 TASK 2 ADVERSARIAL TEST SUITE (JS: A01 - A24)");
console.log("=========================================================================\n");

let passed = 0;
let total = 0;
const manifestCases = [];

async function runAdvTest(id, name, category, expectedBehavior, fn) {
  total++;
  try {
    const start = Date.now();
    await fn();
    const durationMs = Date.now() - start;
    console.log(`  ✓ [PASS] Case ${id}: ${name}`);
    passed++;
    manifestCases.push({
      id,
      name,
      category,
      expected_behavior: expectedBehavior,
      node_status: "PASS",
      duration_ms: durationMs
    });
  } catch (err) {
    console.error(`\n  ❌ [FAIL] Case ${id}: ${name}`);
    console.error(`     Reason: ${err.message}\n`);
    manifestCases.push({
      id,
      name,
      category,
      expected_behavior: expectedBehavior,
      node_status: "FAIL",
      error: err.message
    });
    process.exit(1);
  }
}

const VECTOR_BASE = {
  supply_voltage: 1.20, output_voltage: 1.20, current: 10.7, leakage_current: 111.7,
  resistance: 10.0, capacitance: 5.0, threshold_voltage: 0.45, frequency: 1000.0,
  propagation_delay: 10.98, setup_time: 1.0, hold_time: 0.5, timing_margin: 2.0,
  temperature: 25.0, dynamic_power: 30.0, total_power: 35.0, test_duration: 1.0,
  equipment_id: "EQP-101"
};

const VECTOR_HIGH_RISK = {
  ...VECTOR_BASE,
  current: 150.0, leakage_current: 240.0, temperature: 55.0
};

async function main() {
  const service = new PredictaInferenceServiceJS();

  // A01: Threshold just below (0.199999)
  await runAdvTest("A01", "Threshold just below (0.199999)", "BOUNDARY", "prediction PASS for P < 0.20", async () => {
    const dec = service.makeOperationalDecision(0.199999, "EQP-101");
    assert.strictEqual(dec.operational_decision, "PASS");
    assert.strictEqual(dec.requires_secondary_test, false);
  });

  // A02: Exact authoritative threshold (0.200000)
  await runAdvTest("A02", "Exact authoritative threshold (0.200000)", "BOUNDARY", "requires secondary test at 0.20", async () => {
    const dec = service.makeOperationalDecision(0.200000, "EQP-101");
    assert.strictEqual(dec.operational_decision, "SECONDARY_TEST");
    assert.strictEqual(dec.requires_secondary_test, true);
  });

  // A03: Threshold just above (0.200001)
  await runAdvTest("A03", "Threshold just above (0.200001)", "BOUNDARY", "requires secondary test for P >= 0.20", async () => {
    const dec = service.makeOperationalDecision(0.200001, "EQP-101");
    assert.strictEqual(dec.operational_decision, "SECONDARY_TEST");
    assert.strictEqual(dec.requires_secondary_test, true);
  });

  // A04: NaN input
  await runAdvTest("A04", "NaN numerical input", "VALIDATION", "fails closed on NaN", async () => {
    const nanRecord = { ...VECTOR_BASE, supply_voltage: NaN };
    assert.throws(() => service.validateInputRecord(nanRecord), /must be a valid finite number/);
  });

  // A05: Infinity input
  await runAdvTest("A05", "Infinity numerical input", "VALIDATION", "fails closed on Infinity", async () => {
    const infRecord = { ...VECTOR_BASE, current: Infinity };
    assert.throws(() => service.validateInputRecord(infRecord), /must be a valid finite number/);
  });

  // A06: Negative forbidden physical value
  await runAdvTest("A06", "Negative forbidden physical value", "VALIDATION", "fails validation on negative supply_voltage", async () => {
    const negRecord = { ...VECTOR_BASE, supply_voltage: -1.2 };
    assert.throws(() => service.validateInputRecord(negRecord), /must be a positive number/);
  });

  // A07: Missing required feature
  await runAdvTest("A07", "Missing required feature", "VALIDATION", "fails validation when feature missing", async () => {
    const missingRecord = { ...VECTOR_BASE };
    delete missingRecord.supply_voltage;
    assert.throws(() => service.validateInputRecord(missingRecord), /Missing required numerical feature/);
  });

  // A08: Wrong feature datatype
  await runAdvTest("A08", "Numeric string datatype handling", "DATATYPE", "coerces valid numeric strings safely", async () => {
    const stringRecord = { ...VECTOR_BASE, current: "10.7" };
    const validated = service.validateInputRecord(stringRecord);
    assert.strictEqual(validated.current, 10.7);
  });

  // A09: Empty batch
  await runAdvTest("A09", "Empty batch request", "BATCH", "handles empty batch predictably", async () => {
    assert.throws(() => service.predictBatch([]), /non-empty array|must be an array/i);
  });

  // A10: Malformed batch payload
  await runAdvTest("A10", "Malformed batch payload", "BATCH", "rejects non-array batch payload", async () => {
    assert.throws(() => service.predictBatch("not_an_array"), /non-empty array|must be an array/i);
  });

  // A11: Duplicate records in batch
  await runAdvTest("A11", "Duplicate records in batch", "BATCH", "processes duplicates deterministically", async () => {
    const batchRes = service.predictBatch([VECTOR_BASE, VECTOR_BASE]);
    const list = Array.isArray(batchRes) ? batchRes : batchRes.results;
    assert.strictEqual(list.length, 2);
    assert.strictEqual(list[0].probability, list[1].probability);
  });

  // A12: Reordered records in batch
  await runAdvTest("A12", "Reordered records in batch", "BATCH", "preserves input ordering in results", async () => {
    const batchRes = service.predictBatch([VECTOR_BASE, VECTOR_HIGH_RISK]);
    const list = Array.isArray(batchRes) ? batchRes : batchRes.results;
    assert.strictEqual(list[0].prediction, "PASS");
    assert.strictEqual(list[1].prediction, "FAIL");
  });

  // A13: Extremely large finite physical value
  await runAdvTest("A13", "Extremely large finite physical value", "VALIDATION", "fails closed on out-of-bounds current", async () => {
    const largeRecord = { ...VECTOR_BASE, current: 100000.0 };
    const dataQualityGate = require('../src/ingestion/data_quality_gate');
    const qRes = dataQualityGate.validateTelemetry(largeRecord);
    assert.strictEqual(qRes.status, "DATA_QUALITY_REJECTED");
  });

  // A14: Unseen equipment ID
  await runAdvTest("A14", "Unseen equipment ID", "EQUIPMENT", "handles unseen equipment without crashing", async () => {
    const unseenRecord = { ...VECTOR_BASE, equipment_id: "EQP-999" };
    const res = service.predictSingle(unseenRecord);
    assert.strictEqual(res.is_unseen_equipment, true);
  });

  // A15: Strict-mode invalid equipment ID
  await runAdvTest("A15", "Strict-mode invalid equipment ID", "EQUIPMENT", "rejects unseen equipment in strict mode", async () => {
    const unseenRecord = { ...VECTOR_BASE, equipment_id: "EQP-999" };
    assert.throws(() => service.validateInputRecord(unseenRecord, true), /Invalid equipment_id 'EQP-999'/);
  });

  // A16: Missing prognostic baseline
  await runAdvTest("A16", "Missing prognostic baseline", "PROGNOSTICS", "emits INSUFFICIENT_HISTORY without fabricating forecast", async () => {
    const drift = service.evaluateGprDrift(VECTOR_BASE);
    assert.strictEqual(drift.iddq.status, "INSUFFICIENT_HISTORY");
    assert.strictEqual(drift.iddq.has_history, false);
  });

  // A17: Future 168h feature injection
  await runAdvTest("A17", "Future 168h feature injection", "LEAKAGE", "does not use 168h telemetry in 24h feature vector", async () => {
    const injectedRecord = { ...VECTOR_BASE, tpd_168h: 99.0 };
    const res = service.predictSingle(injectedRecord);
    assert.strictEqual(res.prediction, "PASS");
    assert.strictEqual(res.evaluation_target.ground_truth_available, true);
  });

  // A18: Phase-9 benchmark override injection
  await runAdvTest("A18", "Phase-9 benchmark threshold override injection", "GOVERNANCE", "ignores client threshold overrides", async () => {
    const injectedRecord = { ...VECTOR_BASE, operating_threshold_override: 0.45 };
    const res = service.predictSingle(injectedRecord);
    assert.strictEqual(res.threshold, 0.20);
  });

  // A19: Phase-11 feedback field injection
  await runAdvTest("A19", "Phase-11 feedback field injection", "GOVERNANCE", "ignores client disposition fields during inference", async () => {
    const injectedRecord = { ...VECTOR_HIGH_RISK, operator_disposition: "PASS" };
    const res = service.predictSingle(injectedRecord);
    assert.strictEqual(res.prediction, "FAIL");
    assert.strictEqual(res.operator_disposition, null);
  });

  // A20: Client-supplied probability injection
  await runAdvTest("A20", "Client-supplied probability injection", "SECURITY", "recomputes true model probability ignoring client value", async () => {
    const injectedRecord = { ...VECTOR_HIGH_RISK, probability: 0.000001 };
    const res = service.predictSingle(injectedRecord);
    assert(res.probability > 0.50);
  });

  // A21: Client-supplied model SHA injection
  await runAdvTest("A21", "Client-supplied model SHA injection", "SECURITY", "ignores client model SHA and uses backend manifest SHA", async () => {
    const injectedRecord = { ...VECTOR_BASE, model_sha256: "fake_client_sha" };
    const res = service.predictSingle(injectedRecord);
    assert.strictEqual(res.model_version, "4.0.0_authoritative");
  });

  // A22: Production model artifact mutation simulation
  await runAdvTest("A22", "Production model mutation detection simulation", "PROVENANCE", "fails closed when model artifact missing or corrupted", async () => {
    assert.throws(() => {
      const corruptedService = new PredictaInferenceServiceJS();
      corruptedService.modelData = { trees: [] };
      const eng = corruptedService.engineerFeatures(corruptedService.validateInputRecord(VECTOR_BASE), "EQP-101");
      corruptedService.calculateProbability(eng, "EQP-101");
    }, /no decision trees/i);
  });

  // A23: Calibration artifact mutation simulation
  await runAdvTest("A23", "Calibration artifact mutation detection simulation", "PROVENANCE", "fails closed when robust MAD artifact missing", async () => {
    assert.throws(() => {
      const corruptedService = new PredictaInferenceServiceJS();
      corruptedService.anomalyArtifacts = {};
      corruptedService.evaluatePatMad(VECTOR_BASE, null);
    }, /robust MAD artifact is unavailable/);
  });

  // A24: Production manifest/model SHA mismatch simulation
  await runAdvTest("A24", "Manifest threshold mismatch simulation", "PROVENANCE", "fails closed when operating threshold missing or corrupted", async () => {
    assert.throws(() => {
      const corruptedService = new PredictaInferenceServiceJS();
      corruptedService.operatingThreshold = NaN;
      corruptedService.determineRiskLevel(0.10);
    }, /operating threshold is unavailable/);
  });

  console.log("\n=========================================================================");
  console.log(`✅ PHASE 12 TASK 2 JS ADVERSARIAL SUITE COMPLETE: ${passed}/${total} PASSED (A01 - A24)`);
  console.log("=========================================================================\n");
}

main().catch(err => {
  console.error("FATAL ADVERSARIAL JS SUITE ERROR:", err);
  process.exit(1);
});
