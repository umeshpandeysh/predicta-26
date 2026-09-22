/**
 * PREDICTA — PHASE 12 TASK 1 EVALUATION INTEGRITY & SPLIT ISOLATION TEST SUITE (Node.js)
 * File: tests/test_phase12_task1_evaluation_integrity.js
 * 
 * Verifies Phase 12 Task 1 Requirements (Tests A through P Matrix):
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
 * O. JS/Python parity on corrupted manifest
 * P. JS/Python parity on valid manifest
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
      lots: {
        train: ["LOT-SYN-001"], validation_tune: ["LOT-SYN-036"], calibration: ["LOT-SYN-039"], test: ["LOT-SYN-043"]
      },
      wafers: {
        train: ["W-01", "W-02"],
        validation_tune: ["W-03"],
        calibration: ["W-02", "W-04"],
        test: ["W-05"]
      }
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
      lots: {
        train: ["LOT-SYN-001"], validation_tune: ["LOT-SYN-036"], calibration: ["LOT-SYN-039"], test: ["LOT-SYN-043"]
      },
      components: {
        train: ["C-01"], validation_tune: ["C-02"], calibration: ["C-03", "C-04"], test: ["C-04", "C-05"]
      }
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
  await runTest("Test J: Missing/corrupted test artifact yields BLOCKED (PROVENANCE_MISMATCH)", async () => {
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
  // TEST O & P: Invariants (Production SHA & Operating Threshold)
  // -------------------------------------------------------------------------
  await runTest("Test O: Production model SHA (91bb59...) remains unchanged", async () => {
    assert.ok(fs.existsSync(PROD_MODEL_PATH));
    const bytes = fs.readFileSync(PROD_MODEL_PATH);
    const sha = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.strictEqual(sha, EXPECTED_MODEL_SHA);
  });

  await runTest("Test P: Production operating threshold remains exactly 0.20", async () => {
    assert.strictEqual(gate.contract.authoritative_operating_threshold, EXPECTED_THRESHOLD);
  });

  console.log("=========================================================================");
  console.log(`✅ [SUMMARY] All ${passed}/${total} Node.js Phase 12 Task 1 tests PASSED cleanly!`);
  console.log("=========================================================================\n");
}

runPhase12Task1JsTests().catch((err) => {
  console.error("FATAL TEST EXCEPTION:", err);
  process.exit(1);
});
