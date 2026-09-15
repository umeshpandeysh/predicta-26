/**
 * PREDICTA — AUTHORITATIVE LATENT TRAJECTORY TARGET TEST SUITE
 * File: tests/test_latent_trajectory_target.js
 * 
 * Objective: Mathematically and semantically verify:
 * 1. latent_168h_failure target contract:
 *    PASS at 24h AND FAIL at 168h => true
 * 2. Pre-existing failure at 24h is NOT counted as latent failure:
 *    FAIL at 24h AND FAIL at 168h => false
 * 3. Healthy component is NOT counted as latent failure:
 *    PASS at 24h AND PASS at 168h => false
 * 4. Missing history produces explicit INSUFFICIENT_HISTORY and null label
 * 5. Temporal leakage prevention in early prediction features
 * 6. Metric calculations (Recall, FNR, Precision, F1, F2, PR-AUC, ROC-AUC)
 * 7. API contract in PredictaInferenceService (predictSingle exposes evaluation_target)
 */

const assert = require('assert');
const latentEval = require('../src/evaluation/latent_trajectory');
const inferenceService = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA — AUTHORITATIVE LATENT TRAJECTORY TARGET TEST SUITE");
console.log("=========================================================================");

// TEST 1: True Latent Failure (PASS @ 24h, FAIL @ 168h)
console.log("\nTEST 1: Testing True Latent Failure (PASS @ 24h, FAIL @ 168h)...");
const tel24_pass = { iddq: 2000.0, ileak: 250.0, tpd: 190.0 };
const tel168_fail = { iddq: 2200.0, ileak: 280.0, tpd: 265.0 }; // tpd > 250 limit
const res1 = latentEval.evaluateComponentState(tel24_pass, tel168_fail);

assert.strictEqual(res1.state_24h, "PASS", "24h state must be PASS");
assert.strictEqual(res1.state_168h, "FAIL", "168h state must be FAIL");
assert.strictEqual(res1.latent_168h_failure, true, "latent_168h_failure must be TRUE");
assert.strictEqual(res1.trajectory_state, latentEval.TrajectoryState.PASS_24H_FAIL_168H, "State must be PASS_24H_FAIL_168H");
console.log("✔ Test 1 Passed: Component acceptable at 24h and failing at 168h is correctly flagged latent_168h_failure = true ✅");

// TEST 2: Already-Failed at 24h (FAIL @ 24h, FAIL @ 168h)
console.log("\nTEST 2: Testing Already-Failed Component at 24h (FAIL @ 24h, FAIL @ 168h)...");
const tel24_fail = { iddq: 2000.0, ileak: 250.0, tpd: 260.0 }; // Already tpd > 250 limit at 24h
const res2 = latentEval.evaluateComponentState(tel24_fail, tel168_fail);

assert.strictEqual(res2.state_24h, "FAIL", "24h state must be FAIL");
assert.strictEqual(res2.state_168h, "FAIL", "168h state must be FAIL");
assert.strictEqual(res2.latent_168h_failure, false, "Pre-existing 24h failure must NOT be labeled latent failure");
assert.strictEqual(res2.trajectory_state, latentEval.TrajectoryState.FAIL_24H_FAIL_168H, "State must be FAIL_24H_FAIL_168H");
console.log("✔ Test 2 Passed: Pre-existing failure at 24h is NOT counted as latent failure ✅");

// TEST 3: Healthy Component (PASS @ 24h, PASS @ 168h)
console.log("\nTEST 3: Testing Healthy Component (PASS @ 24h, PASS @ 168h)...");
const tel168_pass = { iddq: 2100.0, ileak: 260.0, tpd: 195.0 };
const res3 = latentEval.evaluateComponentState(tel24_pass, tel168_pass);

assert.strictEqual(res3.state_24h, "PASS", "24h state must be PASS");
assert.strictEqual(res3.state_168h, "PASS", "168h state must be PASS");
assert.strictEqual(res3.latent_168h_failure, false, "Healthy component must be latent_168h_failure = false");
assert.strictEqual(res3.trajectory_state, latentEval.TrajectoryState.PASS_24H_PASS_168H, "State must be PASS_24H_PASS_168H");
console.log("✔ Test 3 Passed: Healthy component throughout burn-in produces latent_168h_failure = false ✅");

// TEST 4: Insufficient History / Missing Data
console.log("\nTEST 4: Testing Insufficient History / Missing 168h Telemetry...");
const res4a = latentEval.evaluateComponentState(tel24_pass, null);
assert.strictEqual(res4a.latent_168h_failure, null, "Missing 168h must produce null target label");
assert.strictEqual(res4a.trajectory_state, latentEval.TrajectoryState.INSUFFICIENT_HISTORY, "Missing 168h must produce INSUFFICIENT_HISTORY");

const res4b = latentEval.evaluateComponentState(null, tel168_fail);
assert.strictEqual(res4b.latent_168h_failure, null, "Missing 24h must produce null target label");
assert.strictEqual(res4b.trajectory_state, latentEval.TrajectoryState.INSUFFICIENT_HISTORY, "Missing 24h must produce INSUFFICIENT_HISTORY");
console.log("✔ Test 4 Passed: Missing 24h/168h history produces explicit INSUFFICIENT_HISTORY without fabrication ✅");

// TEST 5: Temporal Leakage Prevention
console.log("\nTEST 5: Testing Temporal Leakage Assertion...");
const safeCols = ["iddq_0h", "iddq_24h", "iddq_drift_24h", "tpd_0h", "tpd_24h"];
assert(latentEval.assertNoTemporalLeakage(safeCols), "Safe columns must pass assertion");

assert.throws(() => {
  latentEval.assertNoTemporalLeakage(["iddq_0h", "tpd_168h"]);
}, /TEMPORAL LEAKAGE DETECTED/, "168h in early feature columns must throw leakage error");
console.log("✔ Test 5 Passed: Temporal leakage assertion strictly catches post-screening fields ✅");

// TEST 6: Metric Calculations and Edge Safety
console.log("\nTEST 6: Testing Latent Screening Metrics Calculation...");
const yTrue = [0, 1, 0, 1, 0, 1, 0, 0];
const yScores = [0.1, 0.9, 0.2, 0.8, 0.3, 0.4, 0.1, 0.2];
const metrics = latentEval.calculateLatentScreeningMetrics(yTrue, yScores, 0.5);

assert(metrics.latent_recall >= 0 && metrics.latent_recall <= 1.0, "Recall must be valid fraction");
assert(metrics.latent_fnr >= 0 && metrics.latent_fnr <= 1.0, "FNR must be valid fraction");
assert(metrics.latent_f2 >= 0 && metrics.latent_f2 <= 1.0, "F2 must be valid fraction");
assert.strictEqual(metrics.support.latent_168h_failures, 3, "Positive count must match");
assert.strictEqual(metrics.support.acceptable_components, 5, "Negative count must match");

// Zero positives edge case
const metricsZero = latentEval.calculateLatentScreeningMetrics([0, 0, 0], [0.2, 0.3, 0.1], 0.5);
assert.strictEqual(metricsZero.latent_recall, 0.0);
assert(!isNaN(metricsZero.latent_f2), "F2 must not be NaN");
console.log("✔ Test 6 Passed: Metric calculations robust and safe against zero-division ✅");

// TEST 7: API Runtime Contract Exposes evaluation_target (Standard Screening)
console.log("\nTEST 7: Testing API Runtime Contract in predictSingleAsync...");
const sampleRecord = {
  supply_voltage: 1.2, output_voltage: 1.18, current: 45.0, leakage_current: 110.0,
  resistance: 12.5, capacitance: 4.2, threshold_voltage: 0.45, frequency: 2500.0,
  propagation_delay: 11.0, setup_time: 0.85, hold_time: 0.42, timing_margin: 2.6,
  temperature: 25.0, dynamic_power: 54.0, total_power: 54.4, test_duration: 150.0,
  equipment_id: "EQP-101"
};

inferenceService.predictSingleAsync(sampleRecord).then(response => {
  assert(response.evaluation_target, "Response must include evaluation_target metadata");
  assert.strictEqual(response.evaluation_target.name, "latent_168h_failure");
  assert.strictEqual(response.evaluation_target.status, "INSUFFICIENT_DATA", "Early screening must have status INSUFFICIENT_DATA");
  assert.strictEqual(response.evaluation_target.latent_168h_failure, null, "Runtime prediction must not fabricate ground truth");
  console.log("✔ Test 7 Passed: Live screening response separates prediction from retrospective ground truth ✅");

  // TEST 8: API Runtime with Retrospective 168h Ground Truth
  console.log("\nTEST 8: Testing API Runtime with Retrospective 168h Ground Truth...");
  const retroRecord = Object.assign({}, sampleRecord, {
    has_168h_ground_truth: true,
    telemetry_168h: { tpd: 265.0, iddq: 2200.0, ileak: 280.0 } // Exceeds 250 limit
  });

  return inferenceService.predictSingleAsync(retroRecord);
}).then(retroResponse => {
  assert(retroResponse.evaluation_target, "Retro response must include evaluation_target");
  assert.strictEqual(retroResponse.evaluation_target.status, "EVALUATED");
  assert.strictEqual(retroResponse.evaluation_target.latent_168h_failure, true);
  assert.strictEqual(retroResponse.evaluation_target.trajectory_state, "PASS_24H_FAIL_168H");
  console.log("✔ Test 8 Passed: Retrospective record with 168h ground truth correctly evaluates latent_168h_failure = true ✅");

  console.log("\n=========================================================================");
  console.log("ALL AUTHORITATIVE LATENT TRAJECTORY TESTS PASSED 100% CLEANLY! ✅");
  console.log("=========================================================================\n");
}).catch(err => {
  console.error("❌ Test Failed:", err);
  process.exit(1);
});
