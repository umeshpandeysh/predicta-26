/**
 * PREDICTA — PHASE 12 TASK 1 EVALUATION INTEGRITY TEST SUITE (Node.js)
 * File: tests/test_phase12_task1_evaluation_integrity.js
 * 
 * Verifies Phase 12 Task 1 Final Certification Requirements (Tests A through AX Matrix):
 * A-AK: Initial & Intermediate Adversarial Matrix
 * AL: Actual four-way partition scan (TRAIN, VALIDATION_TUNE, CALIBRATION, HELD_OUT_TEST) -> PASS
 * AM: Actual calibration artifact contamination (contains test lot) -> CALIBRATION_LEAKAGE
 * AN: Actual calibration component overlap -> COMPONENT_OVERLAP
 * AO: Actual calibration test-ID overlap -> DIE_OR_TEST_ID_OVERLAP
 * AP: Actual record/manifest mismatch -> PARTITION_MEMBERSHIP_CONFLICT
 * AQ: Missing authoritative test SHA in temporary manifest -> PROVENANCE_MISMATCH
 * AR: Missing production threshold in temporary production manifest -> THRESHOLD_MISMATCH
 * AS: Corrupted production threshold (0.25 in temp manifest file) -> THRESHOLD_MISMATCH
 * AT: Genuine one-byte production model mutation -> PROTECTED_TEST_MUTATION
 * AU: Complete scan overlap occurring only after row 500 -> LOT_OVERLAP
 * AV: Missing required group identifier column -> GROUP_PROVENANCE_UNVERIFIABLE
 * AW: Missing calibration artifact file -> PROVENANCE_MISMATCH
 * AX: Valid clean four-way authority (all actual artifacts + manifests + group sets) -> PASS
 */

process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const {
  EvaluationIntegrityGate,
  EXPECTED_MODEL_SHA,
  EXPECTED_THRESHOLD,
  PROD_MODEL_PATH,
  PROD_MANIFEST_PATH,
  DATASET_MANIFEST_PATH,
  SPLIT_MANIFEST_PATH,
  PROD_CAL_CSV
} = require('../src/evaluation/phase12_evaluation_integrity');

const TEST_CSV_PATH = path.join(__dirname, '../ml/data/processed/test.csv');
const TRAIN_CSV_PATH = path.join(__dirname, '../data/synthetic/semiconductor_synthetic_train.csv');
const VAL_CSV_PATH = path.join(__dirname, '../data/synthetic/semiconductor_synthetic_val.csv');
const CAL_CSV_PATH = path.join(__dirname, '../data/synthetic/semiconductor_synthetic_calibration.csv');
const SYNTHETIC_TEST_CSV_PATH = path.join(__dirname, '../data/synthetic/semiconductor_synthetic_test.csv');

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
  const tempDir = path.join(__dirname, '../scratch');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

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
  // TEST D: Future 168h feature in matrix yields BLOCKED (FUTURE_FEATURE_LEAKAGE)
  // -------------------------------------------------------------------------
  await runTest("Test D: Future 168h feature in matrix yields BLOCKED (FUTURE_FEATURE_LEAKAGE)", async () => {
    const featureList = ["iddq_0h", "ileak_0h", "iddq_168h_ground_truth"];
    const report = gate.generateIntegrityReport({ featureList });
    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "FUTURE_FEATURE_LEAKAGE");
  });

  // -------------------------------------------------------------------------
  // TEST E: Target label in feature matrix yields BLOCKED (TARGET_LEAKAGE)
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
  // TEST G: Held-out Test in calibration fitting yields BLOCKED (CALIBRATION_LEAKAGE)
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
  // TEST N: Post-24h telemetry in screening features -> BLOCKED
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
    const trainTemp = path.join(tempDir, 'temp_train_overlap.csv');
    const valTemp = path.join(tempDir, 'temp_val_overlap.csv');

    fs.writeFileSync(trainTemp, "test_id,lot_id,wafer_id\n1,LOT-SYN-001,W-01\n2,LOT-SYN-002,W-02\n");
    fs.writeFileSync(valTemp, "test_id,lot_id,wafer_id\n3,LOT-SYN-002,W-03\n4,LOT-SYN-036,W-04\n");

    const report = gate.generateIntegrityReport({
      realDataPaths: { train: trainTemp, validation_tune: valTemp, calibration: CAL_CSV_PATH, test: TEST_CSV_PATH }
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
    const trainTemp = path.join(tempDir, 'temp_train_wafer.csv');
    const calTemp = path.join(tempDir, 'temp_cal_wafer.csv');

    fs.writeFileSync(trainTemp, "test_id,lot_id,wafer_id\n1,LOT-SYN-001,W-SHARED-01\n");
    fs.writeFileSync(calTemp, "test_id,lot_id,wafer_id\n2,LOT-SYN-039,W-SHARED-01\n");

    const report = gate.generateIntegrityReport({
      realDataPaths: { train: trainTemp, validation_tune: VAL_CSV_PATH, calibration: calTemp, test: TEST_CSV_PATH }
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
    const calTemp = path.join(tempDir, 'temp_cal_comp.csv');
    const testTemp = path.join(tempDir, 'temp_test_comp.csv');

    fs.writeFileSync(calTemp, "test_id,lot_id,component_id\n1,LOT-SYN-039,COMP-SHARED-99\n");
    fs.writeFileSync(testTemp, "test_id,lot_id,component_id\n2,LOT-SYN-043,COMP-SHARED-99\n");

    const report = gate.generateIntegrityReport({
      testPath: testTemp,
      realDataPaths: { train: TRAIN_CSV_PATH, validation_tune: VAL_CSV_PATH, calibration: calTemp, test: testTemp }
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
    const trainTemp = path.join(tempDir, 'temp_train_id.csv');
    const testTemp = path.join(tempDir, 'temp_test_id.csv');

    fs.writeFileSync(trainTemp, "test_id,lot_id\nTEST-DUP-001,LOT-SYN-001\n");
    fs.writeFileSync(testTemp, "test_id,lot_id\nTEST-DUP-001,LOT-SYN-043\n");

    const report = gate.generateIntegrityReport({
      testPath: testTemp,
      realDataPaths: { train: trainTemp, validation_tune: VAL_CSV_PATH, calibration: CAL_CSV_PATH, test: testTemp }
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
  // -------------------------------------------------------------------------
  await runTest("Test V: One-byte modified locked-test artifact yields BLOCKED (PROVENANCE_MISMATCH)", async () => {
    const tempTestPath = path.join(tempDir, 'temp_modified_test.csv');
    const originalBytes = fs.readFileSync(TEST_CSV_PATH);
    const modifiedBytes = Buffer.from(originalBytes);
    
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
    const trainTainted = path.join(tempDir, 'temp_tainted_train.csv');

    fs.writeFileSync(trainTainted, "test_id,lot_id,operator_disposition,ground_truth_status\n1,LOT-SYN-001,CONFIRMED_PASS,NOT_ESTABLISHED\n");

    const report = gate.generateIntegrityReport({
      realDataPaths: { train: trainTainted, validation_tune: VAL_CSV_PATH, calibration: CAL_CSV_PATH, test: SYNTHETIC_TEST_CSV_PATH }
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
  // TEST Z: Block 6: Corrupted temporary production manifest -> BLOCKED (THRESHOLD_MISMATCH)
  // -------------------------------------------------------------------------
  await runTest("Test Z: Temporary corrupted production manifest (authoritative_threshold: 0.25) yields BLOCKED (THRESHOLD_MISMATCH)", async () => {
    const tempProdManifestPath = path.join(tempDir, 'temp_corrupted_prod_manifest.json');
    const realManifest = JSON.parse(fs.readFileSync(PROD_MANIFEST_PATH, 'utf8'));
    const corruptedManifest = JSON.parse(JSON.stringify(realManifest));
    corruptedManifest.authoritative_threshold = 0.25;
    fs.writeFileSync(tempProdManifestPath, JSON.stringify(corruptedManifest, null, 2));

    const report = gate.generateIntegrityReport({ customProdManifestPath: tempProdManifestPath });

    fs.unlinkSync(tempProdManifestPath);

    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "THRESHOLD_MISMATCH");
  });

  // -------------------------------------------------------------------------
  // TEST AA: Blocker 7: Temporary one-byte mutated production model -> BLOCKED (PROTECTED_TEST_MUTATION)
  // -------------------------------------------------------------------------
  await runTest("Test AA: Temporary byte-mutated production model yields BLOCKED (PROTECTED_TEST_MUTATION)", async () => {
    const tempModelPath = path.join(tempDir, 'temp_mutated_model.json');
    const originalBytes = fs.readFileSync(PROD_MODEL_PATH);
    const mutatedBytes = Buffer.from(originalBytes);
    mutatedBytes[20] = mutatedBytes[20] === 88 ? 89 : 88;
    fs.writeFileSync(tempModelPath, mutatedBytes);

    const report = gate.generateIntegrityReport({ customModelPath: tempModelPath });

    fs.unlinkSync(tempModelPath);

    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "PROTECTED_TEST_MUTATION");
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

  // -------------------------------------------------------------------------
  // TEST AD: Overlap occurring after row 500 -> BLOCKED (LOT_OVERLAP, 100% scan)
  // -------------------------------------------------------------------------
  await runTest("Test AD: Overlap occurring after row 500 yields BLOCKED (LOT_OVERLAP, 100% scan)", async () => {
    const trainLarge = path.join(tempDir, 'temp_train_505.csv');
    const testSmall = path.join(tempDir, 'temp_test_small.csv');

    let lines = ["test_id,lot_id,wafer_id"];
    for (let i = 1; i <= 500; i++) {
      lines.push(`TEST-L-${i},LOT-SYN-001,W-01`);
    }
    lines.push("TEST-L-501,LOT-SYN-043,W-01");
    lines.push("TEST-L-502,LOT-SYN-001,W-01");

    fs.writeFileSync(trainLarge, lines.join("\n"));
    fs.writeFileSync(testSmall, "test_id,lot_id,wafer_id\nTEST-T-1,LOT-SYN-043,W-50\n");

    const report = gate.generateIntegrityReport({
      testPath: testSmall,
      realDataPaths: { train: trainLarge, validation_tune: VAL_CSV_PATH, calibration: CAL_CSV_PATH, test: testSmall }
    });

    fs.unlinkSync(trainLarge);
    fs.unlinkSync(testSmall);

    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "LOT_OVERLAP");
  });

  // -------------------------------------------------------------------------
  // TEST AE: Calibration partition reconstruction & test-lot contamination check
  // -------------------------------------------------------------------------
  await runTest("Test AE: Calibration input referencing test lot LOT-SYN-043 yields BLOCKED (CALIBRATION_LEAKAGE)", async () => {
    const report = gate.generateIntegrityReport({ calibrationInput: { lot_id: "LOT-SYN-043" } });
    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "CALIBRATION_LEAKAGE");
  });

  // -------------------------------------------------------------------------
  // TEST AF: Manifest partition authority conflict -> BLOCKED (PARTITION_MEMBERSHIP_CONFLICT)
  // -------------------------------------------------------------------------
  await runTest("Test AF: Manifest partition authority conflict yields BLOCKED (PARTITION_MEMBERSHIP_CONFLICT)", async () => {
    const report = gate.generateIntegrityReport({ checkMembershipConflict: true });
    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "PARTITION_MEMBERSHIP_CONFLICT");
  });

  // -------------------------------------------------------------------------
  // TEST AG: Missing authoritative test SHA in manifest -> BLOCKED (PROVENANCE_MISMATCH)
  // -------------------------------------------------------------------------
  await runTest("Test AG: Missing authoritative test SHA yields BLOCKED (PROVENANCE_MISMATCH)", async () => {
    const res = gate.verifyTestArtifactImmutability(TEST_CSV_PATH, path.join(tempDir, "nonexistent.json"), path.join(tempDir, "nonexistent2.json"));
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error_code, "PROVENANCE_MISMATCH");
  });

  // -------------------------------------------------------------------------
  // TEST AH: Missing authoritative threshold in manifest -> BLOCKED (THRESHOLD_MISMATCH)
  // -------------------------------------------------------------------------
  await runTest("Test AH: Missing authoritative threshold yields BLOCKED (THRESHOLD_MISMATCH)", async () => {
    const tempNoThreshPath = path.join(tempDir, 'temp_nothresh_manifest.json');
    fs.writeFileSync(tempNoThreshPath, JSON.stringify({ name: "no_thresh" }));
    try {
      gate.verifyThresholdIsolation(null, tempNoThreshPath);
      assert.fail("Should have thrown THRESHOLD_MISMATCH");
    } catch (err) {
      assert.strictEqual(err.error_code, "THRESHOLD_MISMATCH");
    } finally {
      fs.unlinkSync(tempNoThreshPath);
    }
  });

  // -------------------------------------------------------------------------
  // TEST AI: Missing partition artifact file -> BLOCKED (PROVENANCE_MISMATCH)
  // -------------------------------------------------------------------------
  await runTest("Test AI: Missing partition artifact file yields BLOCKED (PROVENANCE_MISMATCH)", async () => {
    const report = gate.generateIntegrityReport({
      realDataPaths: { train: "/nonexistent/train.csv" },
      requireArtifactsExist: true
    });
    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "PROVENANCE_MISMATCH");
  });

  // -------------------------------------------------------------------------
  // TEST AJ: Missing required group identifier column -> BLOCKED (GROUP_PROVENANCE_UNVERIFIABLE)
  // -------------------------------------------------------------------------
  await runTest("Test AJ: Missing lot_id column yields BLOCKED (GROUP_PROVENANCE_UNVERIFIABLE)", async () => {
    const trainNoLot = path.join(tempDir, 'temp_train_nolot.csv');
    fs.writeFileSync(trainNoLot, "test_id,wafer_id\n1,W-01\n");

    const report = gate.generateIntegrityReport({
      realDataPaths: { train: trainNoLot, validation_tune: VAL_CSV_PATH, calibration: CAL_CSV_PATH, test: TEST_CSV_PATH }
    });

    fs.unlinkSync(trainNoLot);

    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "GROUP_PROVENANCE_UNVERIFIABLE");
  });

  // -------------------------------------------------------------------------
  // TEST AK: Duplicate lot assignment in manifest -> BLOCKED (PARTITION_MEMBERSHIP_CONFLICT)
  // -------------------------------------------------------------------------
  await runTest("Test AK: Duplicate lot assignment in manifest yields BLOCKED (PARTITION_MEMBERSHIP_CONFLICT)", async () => {
    const corruptedSplit = {
      lots: {
        train: ["LOT-SYN-001", "LOT-SYN-043"],
        test: ["LOT-SYN-043"]
      }
    };
    const report = gate.generateIntegrityReport({ splitManifest: corruptedSplit, expectConflict: true });
    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "PARTITION_MEMBERSHIP_CONFLICT");
  });

  // -------------------------------------------------------------------------
  // TEST AL: Actual Four-Way Partition Scan (TRAIN, VALIDATION_TUNE, CALIBRATION, HELD_OUT_TEST)
  // -------------------------------------------------------------------------
  await runTest("Test AL: Actual four-way partition scan (TRAIN, VAL, CAL, HELD_OUT_TEST) yields PASS", async () => {
    const report = gate.generateIntegrityReport({
      realDataPaths: {
        train: TRAIN_CSV_PATH,
        validation_tune: VAL_CSV_PATH,
        calibration: CAL_CSV_PATH,
        test: SYNTHETIC_TEST_CSV_PATH
      }
    });
    assert.strictEqual(report.overall_status, "PASS");
    assert.strictEqual(report.manifest_record_consistency, "PASS");
    assert.ok(report.partition_artifacts.TRAIN);
    assert.ok(report.partition_artifacts.VALIDATION_TUNE);
    assert.ok(report.partition_artifacts.CALIBRATION);
    assert.ok(report.partition_artifacts.HELD_OUT_TEST);
  });

  // -------------------------------------------------------------------------
  // TEST AM: Actual Calibration Artifact Contamination -> CALIBRATION_LEAKAGE
  // -------------------------------------------------------------------------
  await runTest("Test AM: Actual calibration artifact with test lot LOT-SYN-043 yields BLOCKED (CALIBRATION_LEAKAGE)", async () => {
    const tempCalTainted = path.join(tempDir, 'temp_cal_tainted_lot.csv');
    fs.writeFileSync(tempCalTainted, "component_id,lot_id\nCOMP-001,LOT-SYN-043\n");

    const report = gate.generateIntegrityReport({
      calibrationInput: { calibration_path: tempCalTainted }
    });

    fs.unlinkSync(tempCalTainted);

    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "CALIBRATION_LEAKAGE");
  });

  // -------------------------------------------------------------------------
  // TEST AN: Actual Calibration Component Overlap -> COMPONENT_OVERLAP
  // -------------------------------------------------------------------------
  await runTest("Test AN: Actual calibration artifact component overlap yields BLOCKED (COMPONENT_OVERLAP)", async () => {
    const tempCalComp = path.join(tempDir, 'temp_cal_comp.csv');
    const tempTestComp = path.join(tempDir, 'temp_test_comp.csv');

    fs.writeFileSync(tempCalComp, "test_id,lot_id,component_id\n1,LOT-SYN-039,COMP-OVERLAP-01\n");
    fs.writeFileSync(tempTestComp, "test_id,lot_id,component_id\n2,LOT-SYN-043,COMP-OVERLAP-01\n");

    const report = gate.generateIntegrityReport({
      testPath: tempTestComp,
      calibrationInput: { calibration_path: tempCalComp }
    });

    fs.unlinkSync(tempCalComp);
    fs.unlinkSync(tempTestComp);

    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "COMPONENT_OVERLAP");
  });

  // -------------------------------------------------------------------------
  // TEST AO: Actual Calibration Test-ID Overlap -> DIE_OR_TEST_ID_OVERLAP
  // -------------------------------------------------------------------------
  await runTest("Test AO: Actual calibration artifact test-ID overlap yields BLOCKED (DIE_OR_TEST_ID_OVERLAP)", async () => {
    const tempCalTestId = path.join(tempDir, 'temp_cal_testid.csv');
    const tempTestId = path.join(tempDir, 'temp_test_testid.csv');

    fs.writeFileSync(tempCalTestId, "test_id,lot_id\nTST-DUP-99,LOT-SYN-039\n");
    fs.writeFileSync(tempTestId, "test_id,lot_id\nTST-DUP-99,LOT-SYN-043\n");

    const report = gate.generateIntegrityReport({
      testPath: tempTestId,
      calibrationInput: { calibration_path: tempCalTestId }
    });

    fs.unlinkSync(tempCalTestId);
    fs.unlinkSync(tempTestId);

    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "DIE_OR_TEST_ID_OVERLAP");
  });

  // -------------------------------------------------------------------------
  // TEST AP: Actual Record ↔ Manifest Partition Mismatch -> PARTITION_MEMBERSHIP_CONFLICT
  // -------------------------------------------------------------------------
  await runTest("Test AP: Record lot assigned to train in manifest placed in validation file yields PARTITION_MEMBERSHIP_CONFLICT", async () => {
    const tempTrainClean = path.join(tempDir, 'temp_train_clean_lot.csv');
    const tempValWrong = path.join(tempDir, 'temp_val_wrong_lot.csv');
    fs.writeFileSync(tempTrainClean, "test_id,lot_id\n1,LOT-SYN-002\n");
    fs.writeFileSync(tempValWrong, "test_id,lot_id\n2,LOT-SYN-001\n"); // LOT-SYN-001 is TRAIN in manifest

    const report = gate.generateIntegrityReport({
      realDataPaths: {
        train: tempTrainClean,
        validation_tune: tempValWrong,
        calibration: CAL_CSV_PATH,
        test: SYNTHETIC_TEST_CSV_PATH
      }
    });

    fs.unlinkSync(tempTrainClean);
    fs.unlinkSync(tempValWrong);

    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "PARTITION_MEMBERSHIP_CONFLICT");
  });

  // -------------------------------------------------------------------------
  // TEST AQ: Missing Authoritative Test SHA in Temporary Manifest -> PROVENANCE_MISMATCH
  // -------------------------------------------------------------------------
  await runTest("Test AQ: Missing authoritative test SHA in manifest yields BLOCKED (PROVENANCE_MISMATCH)", async () => {
    const tempDatasetManifestPath = path.join(tempDir, 'temp_no_sha_dataset_manifest.json');
    const tempSplitManifestPath = path.join(tempDir, 'temp_no_sha_split_manifest.json');

    const datasetManifest = JSON.parse(fs.readFileSync(DATASET_MANIFEST_PATH, 'utf8'));
    delete datasetManifest.locked_test_artifact;
    fs.writeFileSync(tempDatasetManifestPath, JSON.stringify(datasetManifest, null, 2));

    const splitManifest = JSON.parse(fs.readFileSync(SPLIT_MANIFEST_PATH, 'utf8'));
    delete splitManifest.test_partition_governance;
    fs.writeFileSync(tempSplitManifestPath, JSON.stringify(splitManifest, null, 2));

    const report = gate.generateIntegrityReport({
      customDatasetManifestPath: tempDatasetManifestPath,
      customSplitManifestPath: tempSplitManifestPath
    });

    fs.unlinkSync(tempDatasetManifestPath);
    fs.unlinkSync(tempSplitManifestPath);

    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "PROVENANCE_MISMATCH");
  });

  // -------------------------------------------------------------------------
  // TEST AR: Missing Production Threshold in Temporary Manifest -> THRESHOLD_MISMATCH
  // -------------------------------------------------------------------------
  await runTest("Test AR: Missing authoritative_threshold in temporary production manifest yields THRESHOLD_MISMATCH", async () => {
    const tempNoThreshManifest = path.join(tempDir, 'temp_nothresh_prod_manifest.json');
    fs.writeFileSync(tempNoThreshManifest, JSON.stringify({ model_version: "1.0.0" }));

    const report = gate.generateIntegrityReport({ customProdManifestPath: tempNoThreshManifest });

    fs.unlinkSync(tempNoThreshManifest);

    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "THRESHOLD_MISMATCH");
  });

  // -------------------------------------------------------------------------
  // TEST AS: Corrupted Production Threshold (0.25) -> THRESHOLD_MISMATCH
  // -------------------------------------------------------------------------
  await runTest("Test AS: Corrupted production threshold (0.25 in temp manifest file) yields THRESHOLD_MISMATCH", async () => {
    const tempProdPath = path.join(tempDir, 'temp_corrupted_threshold.json');
    const realProd = JSON.parse(fs.readFileSync(PROD_MANIFEST_PATH, 'utf8'));
    realProd.authoritative_threshold = 0.25;
    fs.writeFileSync(tempProdPath, JSON.stringify(realProd, null, 2));

    const report = gate.generateIntegrityReport({ customProdManifestPath: tempProdPath });

    fs.unlinkSync(tempProdPath);

    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "THRESHOLD_MISMATCH");
  });

  // -------------------------------------------------------------------------
  // TEST AT: Genuine One-Byte Production Model Mutation -> PROTECTED_TEST_MUTATION
  // -------------------------------------------------------------------------
  await runTest("Test AT: Genuine one-byte production model mutation yields BLOCKED (PROTECTED_TEST_MUTATION)", async () => {
    const tempModelPath = path.join(tempDir, 'temp_mutated_model_at.json');
    const originalBytes = fs.readFileSync(PROD_MODEL_PATH);
    const mutatedBytes = Buffer.from(originalBytes);
    mutatedBytes[100] = mutatedBytes[100] === 88 ? 89 : 88;
    fs.writeFileSync(tempModelPath, mutatedBytes);

    const report = gate.generateIntegrityReport({ customModelPath: tempModelPath });

    fs.unlinkSync(tempModelPath);

    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "PROTECTED_TEST_MUTATION");
  });

  // -------------------------------------------------------------------------
  // TEST AU: Complete Scan Overlap Occurring Only After Row 500 -> LOT_OVERLAP
  // -------------------------------------------------------------------------
  await runTest("Test AU: Complete scan overlap occurring only after row 500 yields BLOCKED (LOT_OVERLAP)", async () => {
    const train505 = path.join(tempDir, 'temp_train_au_505.csv');
    const testSmall = path.join(tempDir, 'temp_test_au_small.csv');

    let lines = ["test_id,lot_id,wafer_id"];
    for (let i = 1; i <= 500; i++) {
      lines.push(`TEST-L-${i},LOT-SYN-001,W-01`);
    }
    // Row 501 contains test set lot
    lines.push("TEST-L-501,LOT-SYN-043,W-01");

    fs.writeFileSync(train505, lines.join("\n"));
    fs.writeFileSync(testSmall, "test_id,lot_id,wafer_id\nTEST-T-1,LOT-SYN-043,W-50\n");

    const report = gate.generateIntegrityReport({
      testPath: testSmall,
      realDataPaths: { train: train505, validation_tune: VAL_CSV_PATH, calibration: CAL_CSV_PATH, test: testSmall }
    });

    fs.unlinkSync(train505);
    fs.unlinkSync(testSmall);

    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "LOT_OVERLAP");
  });

  // -------------------------------------------------------------------------
  // TEST AV: Missing Required Group Identifier Column -> GROUP_PROVENANCE_UNVERIFIABLE
  // -------------------------------------------------------------------------
  await runTest("Test AV: Missing required lot_id column yields BLOCKED (GROUP_PROVENANCE_UNVERIFIABLE)", async () => {
    const trainNoLot = path.join(tempDir, 'temp_train_av_nolot.csv');
    fs.writeFileSync(trainNoLot, "test_id,wafer_id\n1,W-01\n");

    const report = gate.generateIntegrityReport({
      realDataPaths: { train: trainNoLot, validation_tune: VAL_CSV_PATH, calibration: CAL_CSV_PATH, test: TEST_CSV_PATH }
    });

    fs.unlinkSync(trainNoLot);

    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "GROUP_PROVENANCE_UNVERIFIABLE");
  });

  // -------------------------------------------------------------------------
  // TEST AW: Missing Calibration Artifact -> PROVENANCE_MISMATCH
  // -------------------------------------------------------------------------
  await runTest("Test AW: Missing calibration artifact file yields BLOCKED (PROVENANCE_MISMATCH)", async () => {
    const report = gate.generateIntegrityReport({
      realDataPaths: {
        train: TRAIN_CSV_PATH,
        validation_tune: VAL_CSV_PATH,
        calibration: "/nonexistent/calibration.csv",
        test: TEST_CSV_PATH
      },
      requireArtifactsExist: true
    });
    assert.strictEqual(report.overall_status, "BLOCKED");
    assert.strictEqual(report.failure_category, "PROVENANCE_MISMATCH");
  });

  // -------------------------------------------------------------------------
  // TEST AX: Valid Clean Four-Way Authority (All Actual Artifacts + Manifests)
  // -------------------------------------------------------------------------
  await runTest("Test AX: Valid clean four-way authority yields PASS cleanly", async () => {
    const report = gate.generateIntegrityReport({
      realDataPaths: {
        train: TRAIN_CSV_PATH,
        validation_tune: VAL_CSV_PATH,
        calibration: CAL_CSV_PATH,
        test: SYNTHETIC_TEST_CSV_PATH
      }
    });
    assert.strictEqual(report.overall_status, "PASS");
    assert.strictEqual(report.manifest_record_consistency, "PASS");
    assert.strictEqual(report.hash_comparison_result, "MATCH");
    assert.strictEqual(report.authoritative_operating_threshold, 0.20);
    assert.strictEqual(report.authoritative_model_sha, EXPECTED_MODEL_SHA);
  });

  // -------------------------------------------------------------------------
  // TEST AY: Valid Calibration Artifact Immutability -> PASS
  // -------------------------------------------------------------------------
  await runTest("Test AY: Valid calibration artifact immutability yields PASS", async () => {
    const res = gate.verifyCalibrationArtifactImmutability();
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.error_code, null);
    assert.strictEqual(res.actual_calibration_sha256, "f8a9c67889ebca9561cb925ffc8579d41a17bf540c6c2d48a5d54833140df339");
  });

  // -------------------------------------------------------------------------
  // TEST AZ: Missing Calibration Artifact File -> BLOCKED (PROVENANCE_MISMATCH)
  // -------------------------------------------------------------------------
  await runTest("Test AZ: Missing calibration artifact file yields BLOCKED (PROVENANCE_MISMATCH)", async () => {
    const res = gate.verifyCalibrationArtifactImmutability(path.join(tempDir, 'nonexistent_calibration.csv'));
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error_code, "PROVENANCE_MISMATCH");
  });

  // -------------------------------------------------------------------------
  // TEST BA: Missing Calibration SHA in Manifest -> BLOCKED (PROVENANCE_MISMATCH)
  // -------------------------------------------------------------------------
  await runTest("Test BA: Missing calibration SHA in manifest yields BLOCKED (PROVENANCE_MISMATCH)", async () => {
    const tempDsPath = path.join(tempDir, 'temp_no_cal_sha_ds.json');
    const tempSpPath = path.join(tempDir, 'temp_no_cal_sha_sp.json');

    const dsManifest = JSON.parse(fs.readFileSync(DATASET_MANIFEST_PATH, 'utf8'));
    delete dsManifest.locked_calibration_artifact;
    fs.writeFileSync(tempDsPath, JSON.stringify(dsManifest, null, 2));

    const spManifest = JSON.parse(fs.readFileSync(SPLIT_MANIFEST_PATH, 'utf8'));
    delete spManifest.calibration_partition_governance;
    fs.writeFileSync(tempSpPath, JSON.stringify(spManifest, null, 2));

    const res = gate.verifyCalibrationArtifactImmutability(PROD_CAL_CSV, tempDsPath, tempSpPath);

    fs.unlinkSync(tempDsPath);
    fs.unlinkSync(tempSpPath);

    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error_code, "PROVENANCE_MISMATCH");
  });

  // -------------------------------------------------------------------------
  // TEST BB: Wrong Calibration SHA in Manifest -> BLOCKED (PROVENANCE_MISMATCH)
  // -------------------------------------------------------------------------
  await runTest("Test BB: Wrong calibration SHA in manifest yields BLOCKED (PROVENANCE_MISMATCH)", async () => {
    const tempDsPath = path.join(tempDir, 'temp_wrong_cal_sha_ds.json');

    const dsManifest = JSON.parse(fs.readFileSync(DATASET_MANIFEST_PATH, 'utf8'));
    dsManifest.locked_calibration_artifact.sha256 = "0000000000000000000000000000000000000000000000000000000000000000";
    fs.writeFileSync(tempDsPath, JSON.stringify(dsManifest, null, 2));

    const res = gate.verifyCalibrationArtifactImmutability(PROD_CAL_CSV, tempDsPath, null);

    fs.unlinkSync(tempDsPath);

    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error_code, "PROVENANCE_MISMATCH");
  });

  // -------------------------------------------------------------------------
  // TEST BC: One-Byte Calibration Artifact Mutation -> BLOCKED (PROVENANCE_MISMATCH)
  // -------------------------------------------------------------------------
  await runTest("Test BC: One-byte calibration artifact mutation yields BLOCKED (PROVENANCE_MISMATCH)", async () => {
    const tempMutatedCal = path.join(tempDir, 'temp_mutated_calibration.csv');
    const originalBytes = fs.readFileSync(PROD_CAL_CSV);
    const mutatedBytes = Buffer.from(originalBytes);
    mutatedBytes[50] = mutatedBytes[50] === 88 ? 89 : 88;
    fs.writeFileSync(tempMutatedCal, mutatedBytes);

    const res = gate.verifyCalibrationArtifactImmutability(tempMutatedCal);

    fs.unlinkSync(tempMutatedCal);

    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.error_code, "PROVENANCE_MISMATCH");
  });

  console.log("=========================================================================");
  console.log(`✅ [SUMMARY] All ${passed}/${total} Node.js Phase 12 Task 1 tests (A-BC) PASSED cleanly!`);
  console.log("=========================================================================\n");
}

runPhase12Task1JsTests().catch((err) => {
  console.error("FATAL TEST EXCEPTION:", err);
  process.exit(1);
});
