/**
 * Predicta Semiconductor Intelligence Platform — Phase 9 Cost-Sensitive Latent Defect JS Test Suite
 * File: tests/test_phase9_cost_sensitive_evaluation.js
 * 
 * Validates JS companion calculations for Node.js parity.
 */

const assert = require('assert');
const {
  TrajectoryState,
  PREDICTOR_NAME,
  PREDICTOR_TYPE,
  PRODUCTION_MODEL_USED,
  Phase9CostContract,
  computeTotalCost,
  computeCostPerSample,
  computeNormalizedCost,
  auditCohortEligibility,
  assertLeakageSafeFeatureMatrix,
  evaluateCostSensitivePerformance,
  selectOptimalCostThreshold
} = require('../src/evaluation/cost_contract');

console.log("=========================================================================");
console.log("RUNNING PHASE 9 COST-SENSITIVE LATENT DEFECT JS PARITY SUITE");
console.log("=========================================================================");

// Test 1: Predictor Provenance & Cost Contract Values
assert.strictEqual(PREDICTOR_NAME, "24H_MULTI_CHANNEL_DRIFT_HEURISTIC_BASELINE");
assert.strictEqual(PREDICTOR_TYPE, "HEURISTIC_BASELINE");
assert.strictEqual(PRODUCTION_MODEL_USED, false);
assert.strictEqual(Phase9CostContract.false_negative_cost, 500.0);
assert.strictEqual(Phase9CostContract.false_positive_cost, 100.0);
assert.strictEqual(Phase9CostContract.cost_ratio_fn_to_fp, 5.0);
console.log("  ✓ [PASS] Test 1: Predictor provenance & CostContract values verified ($500 FN, $100 FP, 5:1 ratio)");

// Test 2: Arithmetic Costs
const fn = 2, fp = 5, total = 25;
const totalCost = computeTotalCost(fn, fp);
assert.strictEqual(totalCost, 1500.0);

const costPerSample = computeCostPerSample(totalCost, total);
assert.strictEqual(costPerSample, 60.0);

const normCost = computeNormalizedCost(totalCost, 10);
assert.strictEqual(normCost, 0.30); // 1500 / 5000
console.log("  ✓ [PASS] Test 2: Cost arithmetic verified (FN=$1000, FP=$500, Total=$1500, Cost/Sample=$60, NormCost=0.30)");

// Test 3: Cohort Eligibility Audit
const dummyCohort = [
  { trajectory_state: TrajectoryState.PASS_24H_PASS_168H },
  { trajectory_state: TrajectoryState.PASS_24H_PASS_168H },
  { trajectory_state: TrajectoryState.PASS_24H_PASS_168H },
  { trajectory_state: TrajectoryState.PASS_24H_PASS_168H },
  { trajectory_state: TrajectoryState.PASS_24H_FAIL_168H }, // 1 Latent Pos
  { trajectory_state: TrajectoryState.FAIL_24H_FAIL_168H }, // 1 Early Fail 24h
  { trajectory_state: TrajectoryState.INSUFFICIENT_HISTORY }, // 2 Insufficient
  { trajectory_state: TrajectoryState.INSUFFICIENT_HISTORY }
];

const acct = auditCohortEligibility(dummyCohort);
assert.strictEqual(acct.total_cohort_samples, 8);
assert.strictEqual(acct.excluded_insufficient_samples, 2);
assert.strictEqual(acct.early_failures_24h_samples, 1);
assert.strictEqual(acct.total_eligible_samples, 5);
assert.strictEqual(acct.latent_positives, 1);
assert.strictEqual(acct.non_latent_negatives, 4);
assert.strictEqual(acct.latent_prevalence, 0.20);
assert.strictEqual(acct.class_imbalance_ratio, 4.0);
console.log("  ✓ [PASS] Test 3: Cohort eligibility audit verified (8 Total, 2 Insufficient, 5 Eligible, 1 Pos, 4 Neg)");

// Test 4: Leakage Guard
const safeFeatures = ["iddq_0h", "tpd_24h"];
assert.strictEqual(assertLeakageSafeFeatureMatrix(safeFeatures), true);

assert.throws(() => {
  assertLeakageSafeFeatureMatrix(["iddq_24h", "tpd_168h"]);
}, /TEMPORAL LEAKAGE DETECTED/);
console.log("  ✓ [PASS] Test 4: Feature leakage guard verified (Rejects post-24h tokens)");

// Test 5: Cost Evaluation Function
const yTrue = [1, 0, 1, 0, 0];
const yProb = [0.8, 0.2, 0.9, 0.1, 0.05];
const evalRes = evaluateCostSensitivePerformance(yTrue, yProb, 0.5);

assert.strictEqual(evalRes.confusion_matrix.tp, 2);
assert.strictEqual(evalRes.confusion_matrix.tn, 3);
assert.strictEqual(evalRes.confusion_matrix.fp, 0);
assert.strictEqual(evalRes.confusion_matrix.fn, 0);
assert.strictEqual(evalRes.reliability_metrics.recall, 1.0);
assert.strictEqual(evalRes.cost_metrics.total_decision_cost, 0.0);
console.log("  ✓ [PASS] Test 5: Cost evaluation function verified (TP=2, TN=3, FP=0, FN=0, TotalCost=$0)");

// Test 6: Threshold Selection & Tie-Breaking
const optRes = selectOptimalCostThreshold(yTrue, yProb, "validation_tune", 500.0, 100.0);
assert.ok(optRes.optimal_threshold >= 0.0 && optRes.optimal_threshold <= 1.0);
assert.strictEqual(optRes.min_total_cost, 0.0);
assert.strictEqual(optRes.tie_breaking_rule, "1. Minimum total cost; 2. Lower FNR (higher recall); 3. Higher threshold");
console.log("  ✓ [PASS] Test 6: Threshold selection & deterministic tie-breaking verified");

// Test 7: Test-Set Optimization Governance Rejection
assert.throws(() => {
  selectOptimalCostThreshold(yTrue, yProb, "held_out_test_split", 500.0, 100.0);
}, /CRITICAL GOVERNANCE VIOLATION/);
console.log("  ✓ [PASS] Test 7: Test-set threshold optimization governance rejection verified");

console.log("=========================================================================");
console.log("🏆 ALL 7/7 PHASE 9 JS COST EVALUATION TESTS PASSED CLEANLY!");
console.log("=========================================================================\n");

