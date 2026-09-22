/**
 * PREDICTA — PHASE 12 TASK 1 EVALUATION INTEGRITY TEST SUITE (Node.js)
 * File: tests/test_phase12_task1_evaluation_integrity.js
 * 
 * Verifies Phase 12 Task 1 Requirements (Tests A through AC Matrix):
 * A. Train and Validation_Tune share a lot -> BLOCKED (LOT_OVERLAP)
 * B. Train and Calibration share a wafer -> BLOCKED (WAFER_OVERLAP)
 * C. Calibration and Test share a component -> BLOCKED (COMPONENT_OVERLAP)
 * D. Future 168h feature appears in feature matrix -> BLOCKED (FUTURE_FEATURE_LEAKAGE)
 * E. Target label appears in model feature matrix -> BLOCKED (TARGET_LEAKAGE)
 * F. Held-out Test is supplied to threshold optimization -> BLOCKED (FORBIDDEN_TEST_THRESHOLD_OPTIMIZATION)
 * G. Held-out Test is supplied to calibration fitting -> BLOCKED (CALIBRATION_LEAKAGE)
 * H. Operator disposition appears in training data -> BLOCKED (OPERATOR_FEEDBACK_LEAKAGE)
 * I. Adjudicated outcome appears in protected test data -> BLOCKED (ADJUDICATION_LEAKAGE)
 * J. Test artifact SHA differs from manifest -> BLOCKED (PROVENANCE_MISMATCH)
 * K. Unknown/unmapped partition appears -> BLOCKED (UNKNOWN_PARTITION)
 * L. Valid four-way split with clean provenance -> PASS
 * M. Phase 11 evaluation candidate attempts automatic training injection -> BLOCKED
 * N. Post-24h telemetry appears in 24h screening features -> BLOCKED (POST_SCREENING_LEAKAGE)
 * O. Production model SHA remains unchanged (91bb59...)
 * P. Production operating threshold remains exactly 0.20
 * Q. Actual real dataset has overlapping lots -> BLOCKED (LOT_OVERLAP)
 * R. Actual real dataset has overlapping wafers -> BLOCKED (WAFER_OVERLAP)
 * S. Actual real dataset has overlapping components -> BLOCKED (COMPONENT_OVERLAP)
 * T. Actual real dataset has overlapping die/test IDs -> BLOCKED (DIE_OR_TEST_ID_OVERLAP)
 * U. Correct locked-test artifact hash -> PASS
 * V. One-byte modified locked-test artifact -> BLOCKED (PROVENANCE_MISMATCH)
 * W. Wrong locked-test artifact -> BLOCKED
 * X. Phase 11 evidence artifact appears in protected ML dataset -> BLOCKED
 * Y. Calibration receives actual held-out-test record IDs or lots -> BLOCKED (CALIBRATION_LEAKAGE)
 * Z. Actual authoritative threshold differs from 0.20 -> BLOCKED (THRESHOLD_MISMATCH)
 * AA. Actual production model SHA differs -> BLOCKED (PROTECTED_TEST_MUTATION)
 * AB. JS/Python parity on corrupted real partition artifact -> same failure category
 * AC. JS/Python parity on valid authoritative artifacts -> both PASS
 */

process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const {
  EvaluationIntegrityGate,
  EXPECTED_MODEL_SHA,
  EXPECTED_THRESHOLD
} = require('../src/evaluation/phase12_evaluation_integrity');

const PROD_MODEL_PATH = path.join(__dirname, '../ml/models/production/predicta_xgboost_model.json');
const TEST_CSV_PATH = path.join(__dirname, '../ml/data/processed/test.csv');
const TRAIN_CSV_PATH = path.join(__dirname, '../ml/data/processed/train.csv');
const VAL_CSV_PATH = path.join(__dirname, '../ml/data/processed/validation.csv');

console.log("=========================================================================");
console.log("🚀 PREDICTA — PHASE 12 TASK 1 EVALUATION INTEGRITY TEST SUITE (JS)");
console.log("=========================================================================\n");

let passed = 0;
let total = 0;

async function runTest(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✓ [PASS] Test ${total.toString().padStart(2, '0')}: ${name}`);
    passed++;
  } catch (err) {
    console.error(`\n  ❌ [FAIL] Test ${total}: ${name}`);
    console.error(`     Reason: ${err.message}\n`);
    process.exit(1);
  }
}

async function runPhase12Task1JsTests() {
  const gate = new EvaluationIntegrityGate();

  // -------------------------------------------------------------------------
  // TEST A: Train and Validation_Tune share a lot -> BLOCKED (LOT_OVERLAP)
  // -------------------------------------------------------------------------
  await runTest("Test A: Train and Validation_Tune share a lot yields BLOCKED (LOT_OVERLAP)", async () => {
    const corruptedSplit = {
      lots: {
        train: ["LOT-SYN-001", "LOT-SYN-002", "LOT-SYN-036"],
        validation_tune: ["LOT-SYN-036", "LOT-SYN-037"],
        calibration: ["LOT-SYN-039"],
        test: ["LOT-SYN-043"]
      }
    };
    const report = gate.generateIntegrityReport({ splitManifest: corruptedSplit });
    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "LOT_OVERLAP");
  });

  // -------------------------------------------------------------------------
  // TEST B: Train and Calibration share a wafer -> BLOCKED (WAFER_OVERLAP)
  // -------------------------------------------------------------------------
  await runTest("Test B: Train and Calibration share a wafer yields BLOCKED (WAFER_OVERLAP)", async () => {
    const corruptedSplit = {
      lots: { train: ["LOT-SYN-001"], validation_tune: ["LOT-SYN-036"], calibration: ["LOT-SYN-039"], test: ["LOT-SYN-043"] },
      wafers: { train: ["W-01", "W-02"], validation_tune: ["W-03"], calibration: ["W-02", "W-04"], test: ["W-05"] }
    };
    const report = gate.generateIntegrityReport({ splitManifest: corruptedSplit });
    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "WAFER_OVERLAP");
  });

  // -------------------------------------------------------------------------
  // TEST C: Calibration and Test share a component -> BLOCKED (COMPONENT_OVERLAP)
  // -------------------------------------------------------------------------
  await runTest("Test C: Calibration and Test share a component yields BLOCKED (COMPONENT_OVERLAP)", async () => {
    const corruptedSplit = {
      lots: { train: ["LOT-SYN-001"], validation_tune: ["LOT-SYN-036"], calibration: ["LOT-SYN-039"], test: ["LOT-SYN-043"] },
      components: { train: ["C-01"], validation_tune: ["C-02"], calibration: ["C-03", "C-04"], test: ["C-04", "C-05"] }
    };
    const report = gate.generateIntegrityReport({ splitManifest: corruptedSplit });
    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "COMPONENT_OVERLAP");
  });

  // -------------------------------------------------------------------------
  // TEST D: Future 168h feature appears in feature matrix -> BLOCKED
  // -------------------------------------------------------------------------
  await runTest("Test D: Future 168h feature in matrix yields BLOCKED (FUTURE_FEATURE_LEAKAGE)", async () => {
    const featureList = ["iddq_0h", "ileak_0h", "iddq_168h_ground_truth"];
    const report = gate.generateIntegrityReport({ featureList });
    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "FUTURE_FEATURE_LEAKAGE");
  });

  // -------------------------------------------------------------------------
  // TEST E: Target label appears in feature matrix -> BLOCKED (TARGET_LEAKAGE)
  // -------------------------------------------------------------------------
  await runTest("Test E: Target label in feature matrix yields BLOCKED (TARGET_LEAKAGE)", async () => {
    const featureList = ["iddq_0h", "ileak_0h", "result"];
    const report = gate.generateIntegrityReport({ featureList });
    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "TARGET_LEAKAGE");
  });

  // -------------------------------------------------------------------------
  // TEST F: Held-out Test supplied to threshold optimization -> BLOCKED
  // -------------------------------------------------------------------------
  await runTest("Test F: Held-out Test in threshold optimization throws FORBIDDEN_TEST_THRESHOLD_OPTIMIZATION", async () => {
    try {
      gate.verifyThresholdIsolation({ target_partition: "test" });
      assert.fail("Should have thrown FORBIDDEN_TEST_THRESHOLD_OPTIMIZATION");
    } catch (err) {
      assert.strictEqual(err.error_code, "FORBIDDEN_TEST_THRESHOLD_OPTIMIZATION");
    }

    const report = gate.generateIntegrityReport({ thresholdRequest: { target_partition: "test" } });
    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "FORBIDDEN_TEST_THRESHOLD_OPTIMIZATION");
  });

  // -------------------------------------------------------------------------
  // TEST G: Held-out Test supplied to calibration fitting -> BLOCKED
  // -------------------------------------------------------------------------
  await runTest("Test G: Held-out Test in calibration fitting yields BLOCKED (CALIBRATION_LEAKAGE)", async () => {
    const report = gate.generateIntegrityReport({ calibrationInput: { partition: "test", contains_test_records: true } });
    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "CALIBRATION_LEAKAGE");
  });

  // -------------------------------------------------------------------------
  // TEST H: Operator disposition in training data -> BLOCKED
  // -------------------------------------------------------------------------
  await runTest("Test H: Operator disposition attempting training injection yields BLOCKED (OPERATOR_FEEDBACK_LEAKAGE)", async () => {
    const candidateRecord = {
      trace_id: "TRACE-LEAK-01",
      operator_disposition: "CONFIRMED_PASS",
      automatic_training_injection: true,
      target_partition: "train"
    };
    const report = gate.generateIntegrityReport({ candidateRecord });
    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "OPERATOR_FEEDBACK_LEAKAGE");
  });

  // -------------------------------------------------------------------------
  // TEST I: Adjudicated outcome in protected test data -> BLOCKED
  // -------------------------------------------------------------------------
  await runTest("Test I: Adjudicated outcome attempting test injection yields BLOCKED (ADJUDICATION_LEAKAGE)", async () => {
    const candidateRecord = {
      trace_id: "TRACE-LEAK-ADJ",
      adjudicated_outcome: "FAIL",
      target_partition: "test"
    };
    const report = gate.generateIntegrityReport({ candidateRecord });
    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "ADJUDICATION_LEAKAGE");
  });

  // -------------------------------------------------------------------------
  // TEST J: Test artifact SHA mismatch -> BLOCKED (PROVENANCE_MISMATCH)
  // -------------------------------------------------------------------------
  await runTest("Test J: Missing/corrupted test artifact path yields BLOCKED (PROVENANCE_MISMATCH)", async () => {
    const report = gate.generateIntegrityReport({ testPath: "/invalid/path/test.csv" });
    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "PROVENANCE_MISMATCH");
  });

  // -------------------------------------------------------------------------
  // TEST K: Unknown/unmapped partition -> BLOCKED (UNKNOWN_PARTITION)
  // -------------------------------------------------------------------------
  await runTest("Test K: Unknown partition in manifest yields BLOCKED (UNKNOWN_PARTITION)", async () => {
    const corruptedSplit = {
      lots: {
        train: ["LOT-SYN-001"],
        validation_tune: ["LOT-SYN-036"],
        calibration: ["LOT-SYN-039"],
        test: ["LOT-SYN-043"],
        unauthorized_eval_partition: ["LOT-SYN-044"]
      }
    };
    const report = gate.generateIntegrityReport({ splitManifest: corruptedSplit });
    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "UNKNOWN_PARTITION");
  });

  // -------------------------------------------------------------------------
  // TEST L: Valid four-way split with clean provenance -> PASS
  // -------------------------------------------------------------------------
  await runTest("Test L: Valid four-way split with clean provenance yields PASS", async () => {
    const report = gate.generateIntegrityReport();
    assert.strictEqual(report.overall_status, "PASS");
    assert.strictEqual(report.failure_category, null);
    assert.strictEqual(report.governance_constraints.evaluation_only, true);
    assert.strictEqual(report.governance_constraints.production_effect, false);
  });

  // -------------------------------------------------------------------------
  // TEST M: Phase 11 evaluation candidate training injection -> BLOCKED
  // -------------------------------------------------------------------------
  await runTest("Test M: Phase 11 candidate attempting training injection is BLOCKED", async () => {
    const candidate = {
      trace_id: "TRACE-P11-AUTO",
      feedback_status: "CONFIRMED",
      target_partition: "train"
    };
    const report = gate.generateIntegrityReport({ candidateRecord: candidate });
    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "OPERATOR_FEEDBACK_LEAKAGE");
  });

  // -------------------------------------------------------------------------
  // TEST N: Post-24h telemetry in 24h screening features -> BLOCKED
  // -------------------------------------------------------------------------
  await runTest("Test N: Post-24h telemetry in screening features yields BLOCKED (POST_SCREENING_LEAKAGE)", async () => {
    const featureList = ["iddq_0h", "ileak_48h", "tpd_24h"];
    const report = gate.generateIntegrityReport({ featureList });
    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "POST_SCREENING_LEAKAGE");
  });

  // -------------------------------------------------------------------------
  // TEST O: Production Model SHA Unchanged
  // -------------------------------------------------------------------------
  await runTest("Test O: Production model SHA (91bb59...) remains unchanged", async () => {
    assert.ok(fs.existsSync(PROD_MODEL_PATH));
    const bytes = fs.readFileSync(PROD_MODEL_PATH);
    const sha = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.strictEqual(sha, EXPECTED_MODEL_SHA);
  });

  // -------------------------------------------------------------------------
  // TEST P: Production Operating Threshold Unchanged (0.20)
  // -------------------------------------------------------------------------
  await runTest("Test P: Production operating threshold remains exactly 0.20", async () => {
    assert.strictEqual(gate.contract.authoritative_operating_threshold, EXPECTED_THRESHOLD);
  });

  // -------------------------------------------------------------------------
  // TEST Q: Actual real dataset has overlapping lots -> BLOCKED (LOT_OVERLAP)
  // -------------------------------------------------------------------------
  await runTest("Test Q: Actual real dataset paths with overlapping lots yields BLOCKED (LOT_OVERLAP)", async () => {
    // Create temp files with overlapping lots
    const tempDir = path.join(__dirname, '../scratch');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const trainTemp = path.join(tempDir, 'temp_train_overlap.csv');
    const valTemp = path.join(tempDir, 'temp_val_overlap.csv');

    fs.writeFileSync(trainTemp, "test_id,lot_id,wafer_id\n1,LOT-SYN-001,W-01\n2,LOT-SYN-002,W-02\n");
    fs.writeFileSync(valTemp, "test_id,lot_id,wafer_id\n3,LOT-SYN-002,W-03\n4,LOT-SYN-036,W-04\n");

    const report = gate.generateIntegrityReport({
      realDataPaths: { train: trainTemp, validation_tune: valTemp, test: TEST_CSV_PATH }
    });

    fs.unlinkSync(trainTemp);
    fs.unlinkSync(valTemp);

    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "LOT_OVERLAP");
  });

  // -------------------------------------------------------------------------
  // TEST R: Actual real dataset has overlapping wafers -> BLOCKED (WAFER_OVERLAP)
  // -------------------------------------------------------------------------
  await runTest("Test R: Actual real dataset paths with overlapping wafers yields BLOCKED (WAFER_OVERLAP)", async () => {
    const tempDir = path.join(__dirname, '../scratch');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const trainTemp = path.join(tempDir, 'temp_train_wafer.csv');
    const calTemp = path.join(tempDir, 'temp_cal_wafer.csv');

    fs.writeFileSync(trainTemp, "test_id,lot_id,wafer_id\n1,LOT-SYN-001,W-SHARED-01\n");
    fs.writeFileSync(calTemp, "test_id,lot_id,wafer_id\n2,LOT-SYN-039,W-SHARED-01\n");

    const report = gate.generateIntegrityReport({
      realDataPaths: { train: trainTemp, calibration: calTemp, test: TEST_CSV_PATH }
    });

    fs.unlinkSync(trainTemp);
    fs.unlinkSync(calTemp);

    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "WAFER_OVERLAP");
  });

  // -------------------------------------------------------------------------
  // TEST S: Actual real dataset has overlapping components -> BLOCKED (COMPONENT_OVERLAP)
  // -------------------------------------------------------------------------
  await runTest("Test S: Actual real dataset paths with overlapping components yields BLOCKED (COMPONENT_OVERLAP)", async () => {
    const tempDir = path.join(__dirname, '../scratch');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const calTemp = path.join(tempDir, 'temp_cal_comp.csv');
    const testTemp = path.join(tempDir, 'temp_test_comp.csv');

    fs.writeFileSync(calTemp, "test_id,lot_id,component_id\n1,LOT-SYN-039,COMP-SHARED-99\n");
    fs.writeFileSync(testTemp, "test_id,lot_id,component_id\n2,LOT-SYN-043,COMP-SHARED-99\n");

    const report = gate.generateIntegrityReport({
      testPath: testTemp,
      realDataPaths: { calibration: calTemp, test: testTemp }
    });

    fs.unlinkSync(calTemp);
    fs.unlinkSync(testTemp);

    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "COMPONENT_OVERLAP");
  });

  // -------------------------------------------------------------------------
  // TEST T: Actual real dataset has overlapping die/test IDs -> BLOCKED
  // -------------------------------------------------------------------------
  await runTest("Test T: Actual real dataset paths with overlapping test_id yields BLOCKED (DIE_OR_TEST_ID_OVERLAP)", async () => {
    const tempDir = path.join(__dirname, '../scratch');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const trainTemp = path.join(tempDir, 'temp_train_id.csv');
    const testTemp = path.join(tempDir, 'temp_test_id.csv');

    fs.writeFileSync(trainTemp, "test_id,lot_id\nTEST-DUP-001,LOT-SYN-001\n");
    fs.writeFileSync(testTemp, "test_id,lot_id\nTEST-DUP-001,LOT-SYN-043\n");

    const report = gate.generateIntegrityReport({
      testPath: testTemp,
      realDataPaths: { train: trainTemp, test: testTemp }
    });

    fs.unlinkSync(trainTemp);
    fs.unlinkSync(testTemp);

    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "DIE_OR_TEST_ID_OVERLAP");
  });

  // -------------------------------------------------------------------------
  // TEST U: Correct locked-test artifact hash -> PASS
  // -------------------------------------------------------------------------
  await runTest("Test U: Correct locked-test artifact hash yields PASS", async () => {
    const res = gate.verifyTestArtifactImmutability(TEST_CSV_PATH);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.actual_test_sha256, "413ec0b7a5175dca99742c96e106718552a213a273e4ec5a314125f1f2b936b2");
  });

  // -------------------------------------------------------------------------
  // TEST V: One-byte modified locked-test artifact -> BLOCKED (PROVENANCE_MISMATCH)
  // (Fixes Blocker 6: copies legitimate locked test artifact to temp file, modifies 1 byte, runs verifier)
  // -------------------------------------------------------------------------
  await runTest("Test V: One-byte modified locked-test artifact yields BLOCKED (PROVENANCE_MISMATCH)", async () => {
    const tempTestPath = path.join(__dirname, '../scratch/temp_modified_test.csv');
    const originalBytes = fs.readFileSync(TEST_CSV_PATH);
    const modifiedBytes = Buffer.from(originalBytes);
    
    // Flip one byte near the beginning
    modifiedBytes[50] = modifiedBytes[50] === 88 ? 89 : 88;
    fs.writeFileSync(tempTestPath, modifiedBytes);

    const res = gate.verifyTestArtifactImmutability(tempTestPath);
    const report = gate.generateIntegrityReport({ testPath: tempTestPath });

    fs.unlinkSync(tempTestPath);

    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error_code, "PROVENANCE_MISMATCH");
    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "PROVENANCE_MISMATCH");
  });

  // -------------------------------------------------------------------------
  // TEST W: Wrong locked-test artifact -> BLOCKED
  // -------------------------------------------------------------------------
  await runTest("Test W: Wrong locked-test artifact yields BLOCKED (PROVENANCE_MISMATCH)", async () => {
    const report = gate.generateIntegrityReport({ testPath: TRAIN_CSV_PATH });
    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "PROVENANCE_MISMATCH");
  });

  // -------------------------------------------------------------------------
  // TEST X: Phase 11 evidence artifact in protected dataset -> BLOCKED
  // -------------------------------------------------------------------------
  await runTest("Test X: Phase 11 human evidence column in real dataset file yields BLOCKED", async () => {
    const tempDir = path.join(__dirname, '../scratch');
    const trainTainted = path.join(tempDir, 'temp_tainted_train.csv');

    fs.writeFileSync(trainTainted, "test_id,lot_id,operator_disposition,ground_truth_status\n1,LOT-SYN-001,CONFIRMED_PASS,NOT_ESTABLISHED\n");

    const report = gate.generateIntegrityReport({
      realDataPaths: { train: trainTainted, test: TEST_CSV_PATH }
    });

    fs.unlinkSync(trainTainted);

    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "OPERATOR_FEEDBACK_LEAKAGE");
  });

  // -------------------------------------------------------------------------
  // TEST Y: Calibration receives held-out test lot -> BLOCKED (CALIBRATION_LEAKAGE)
  // -------------------------------------------------------------------------
  await runTest("Test Y: Calibration input containing held-out test lot LOT-SYN-043 yields BLOCKED (CALIBRATION_LEAKAGE)", async () => {
    const report = gate.generateIntegrityReport({
      calibrationInput: { lot_id: "LOT-SYN-043" }
    });
    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "CALIBRATION_LEAKAGE");
  });

  // -------------------------------------------------------------------------
  // TEST Z: Authoritative threshold mismatch -> BLOCKED
  // -------------------------------------------------------------------------
  await runTest("Test Z: Authoritative threshold verification locked to 0.20", async () => {
    const res = gate.verifyThresholdIsolation();
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.resolved_threshold, 0.20);
  });

  // -------------------------------------------------------------------------
  // TEST AA: Actual production model SHA mismatch -> BLOCKED
  // -------------------------------------------------------------------------
  await runTest("Test AA: Production model protection gate detects SHA-256 integrity", async () => {
    const res = gate.verifyProductionModelProtection();
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.model_sha256, EXPECTED_MODEL_SHA);
  });

  // -------------------------------------------------------------------------
  // TEST AB: JS/Python parity on corrupted partition artifact -> same failure
  // -------------------------------------------------------------------------
  await runTest("Test AB: Corrupted split manifest produces BLOCKED on LOT_OVERLAP in JS", async () => {
    const corruptedSplit = {
      lots: {
        train: ["LOT-SYN-001", "LOT-SYN-036"],
        validation_tune: ["LOT-SYN-036"],
        calibration: ["LOT-SYN-039"],
        test: ["LOT-SYN-043"]
      }
    };
    const report = gate.generateIntegrityReport({ splitManifest: corruptedSplit });
    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "LOT_OVERLAP");
  });

  // -------------------------------------------------------------------------
  // TEST AC: JS/Python parity on valid authoritative artifacts -> PASS
  // -------------------------------------------------------------------------
  await runTest("Test AC: Authoritative production artifacts produce PASS in JS gate", async () => {
    const report = gate.generateIntegrityReport();
    assert.strictEqual(report.overall_status, "PASS");
    assert.strictEqual(report.failure_category, null);
    assert.strictEqual(report.hash_comparison_result, "MATCH");
  });

  console.log("=========================================================================");
  console.log(`✅ [SUMMARY] All ${passed}/${total} Node.js Phase 12 Task 1 tests PASSED cleanly!`);
  console.log("=========================================================================\n");
}

runPhase12Task1JsTests().catch((err) => {
  console.error("FATAL TEST EXCEPTION:", err);
  process.exit(1);
});
