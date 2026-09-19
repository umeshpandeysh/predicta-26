const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const { GovernedCounterfactualExplainerJS, computeFileSha256 } = require('../src/explainability/counterfactual');
const { HumanDispositionManagerJS } = require('../src/governance/disposition');
const { PredictaInferenceServiceJS } = require('../src/api/inference');

console.log("================================================================================");
console.log("RUNNING STAGE 6 TASK 2 COUNTERFACTUAL & DISPOSITION TEST SUITE (NODE.JS)");
console.log("================================================================================\n");

const SAMPLE_FAILING_RECORD = {
  test_id: "TEST-ATTACK-001",
  equipment_id: "EQP-101",
  lot_id: "LOT-SYN-045",
  component_id: "COMP-001",
  wafer_id: "W-01",
  supply_voltage: 1.1911,
  output_voltage: 1.1598,
  current: 47.7968,
  leakage_current: 195.0,
  resistance: 13.1914,
  capacitance: 4.054,
  threshold_voltage: 0.4797,
  frequency: 2616.57,
  propagation_delay: 15.2,
  setup_time: 0.8355,
  hold_time: 0.4317,
  timing_margin: 1.3069,
  temperature: 34.0,
  dynamic_power: 56.8358,
  total_power: 56.8972,
  test_duration: 156.27
};

const explainer = new GovernedCounterfactualExplainerJS();
const dispManager = new HumanDispositionManagerJS();

// Test 1: Contracts Integrity
console.log("Test 1: Contracts Integrity & Status Governance...");
assert.strictEqual(explainer.contract.model_status, "BENCHMARK_ONLY");
assert.strictEqual(explainer.contract.explanation_status, "BENCHMARK_ONLY");
assert.strictEqual(dispManager.contract.governance_rules.default_feedback_status, "RECORDED_ONLY");
console.log("  ✓ Test 1 Passed: Contract status locked to BENCHMARK_ONLY and RECORDED_ONLY");

// Test 2: Genuine Counterfactual Generation
console.log("Test 2: Genuine Counterfactual Generation...");
const cfRes = explainer.generateCounterfactual(SAMPLE_FAILING_RECORD, "TARGET_PASS");
assert.strictEqual(cfRes.target_reached, true);
assert.ok(cfRes.counterfactual_prediction.calibrated_probability < 0.20);
assert.strictEqual(cfRes.counterfactual_prediction.decision, "PASS");
assert.ok(cfRes.distance > 0);
assert.ok(Object.keys(cfRes.changed_features).length > 0);
console.log("  ✓ Test 2 Passed: Genuine counterfactual reaches TARGET_PASS (P < 0.20)");

// Attack A: Missing feature
console.log("Attack A: Missing required numerical feature...");
assert.throws(() => {
  const bad = { ...SAMPLE_FAILING_RECORD };
  delete bad.leakage_current;
  explainer.generateCounterfactual(bad);
}, /MISSING_REQUIRED_FEATURE/);
console.log("  ✓ Attack A Passed: Missing feature rejected");

// Attack B: Extra feature
console.log("Attack B: Extra feature handling...");
const extraRec = { ...SAMPLE_FAILING_RECORD, malicious_extra: 999.9 };
const resExtra = explainer.generateCounterfactual(extraRec);
assert.strictEqual(resExtra.schema_verified, true);
assert.strictEqual(resExtra.counterfactual_input.malicious_extra, undefined);
console.log("  ✓ Attack B Passed: Extra features strictly omitted from canonical schema");

// Attack C: Reordered / wrong length feature vector
console.log("Attack C: Feature vector length validation...");
assert.throws(() => {
  explainer.evaluateProbability([1.0, 2.0, 3.0]);
}, /INVALID_FEATURE_VECTOR_LENGTH/);
console.log("  ✓ Attack C Passed: Invalid vector length rejected");

// Attack D: NaN
console.log("Attack D: NaN input value...");
assert.throws(() => {
  explainer.generateCounterfactual({ ...SAMPLE_FAILING_RECORD, temperature: NaN });
}, /NON_FINITE_INPUT/);
console.log("  ✓ Attack D Passed: NaN rejected");

// Attack E: Infinity
console.log("Attack E: Infinity input value...");
assert.throws(() => {
  explainer.generateCounterfactual({ ...SAMPLE_FAILING_RECORD, supply_voltage: Infinity });
}, /NON_FINITE_INPUT/);
console.log("  ✓ Attack E Passed: Infinity rejected");

// Attack F: Negative impossible physical value
console.log("Attack F: Negative physical value...");
assert.throws(() => {
  explainer.generateCounterfactual({ ...SAMPLE_FAILING_RECORD, supply_voltage: -1.2 });
}, /PHYSICAL_BOUND_VIOLATION/);
console.log("  ✓ Attack F Passed: Negative physical values rejected");

// Attack G & H: Immutable features preservation
console.log("Attack G & H: Immutable component and lot preservation...");
assert.strictEqual(cfRes.immutable_features_verified, true);
assert.strictEqual(cfRes.changed_features.component_id, undefined);
assert.strictEqual(cfRes.changed_features.lot_id, undefined);
assert.strictEqual(cfRes.changed_features.equipment_id, undefined);
console.log("  ✓ Attack G & H Passed: Immutable identifiers preserved untouched");

// Attack I: Per-feature movement limit
console.log("Attack I: Per-feature delta bounds...");
for (const p in cfRes.changed_features) {
  const item = cfRes.changed_features[p];
  assert.ok(Math.abs(item.delta_std) <= explainer.maxFeatureChangeStd + 1e-4);
}
console.log("  ✓ Attack I Passed: Per-feature movement within configured limits");

// Attack J: Impossible target under zero budget
console.log("Attack J: Target impossible under constraints...");
const origMax = explainer.maxTotalDistance;
explainer.maxTotalDistance = 0.001;
try {
  const impossibleRes = explainer.generateCounterfactual(SAMPLE_FAILING_RECORD, "TARGET_PASS");
  assert.strictEqual(impossibleRes.target_reached, false);
  assert.strictEqual(impossibleRes.counterfactual_prediction.decision, "FAIL");
} finally {
  explainer.maxTotalDistance = origMax;
}
console.log("  ✓ Attack J Passed: Unreachable target cleanly returned with target_reached: false");

// Attack K: Determinism
console.log("Attack K: Deterministic repeatability...");
const r1 = explainer.generateCounterfactual(SAMPLE_FAILING_RECORD);
const r2 = explainer.generateCounterfactual(SAMPLE_FAILING_RECORD);
assert.strictEqual(r1.distance, r2.distance);
assert.strictEqual(r1.counterfactual_prediction.calibrated_probability, r2.counterfactual_prediction.calibrated_probability);
assert.deepStrictEqual(r1.changed_features, r2.changed_features);
console.log("  ✓ Attack K Passed: Counterfactual search is 100% deterministic");

// Attack L: Model hash tampering detection
console.log("Attack L: Model hash mismatch rejection...");
assert.throws(() => {
  new GovernedCounterfactualExplainerJS(undefined, path.join(__dirname, 'test_release_certification.js'));
}, /MODEL_HASH_MISMATCH/);
console.log("  ✓ Attack L Passed: Model hash mutation/mismatch detected");

// Attack M: Prediction parity against model
console.log("Attack M: Prediction parity verification...");
const cfVec = explainer.buildFeatureVectorFromRaw(cfRes.counterfactual_input, SAMPLE_FAILING_RECORD.equipment_id);
const [, actualP] = explainer.evaluateProbability(cfVec);
assert.ok(Math.abs(actualP - cfRes.counterfactual_prediction.calibrated_probability) <= 1e-5);
console.log("  ✓ Attack M Passed: Reported counterfactual prediction matches actual model evaluation");

// Attack O: Disposition preserves original ML decision
console.log("Attack O: Human disposition does not overwrite original ML decision...");
(async () => {
  const mlSnap = {
    ml_decision: "REJECT",
    probability: 0.85,
    model_id: "predicta_xgboost_model"
  };
  const dRec = await dispManager.recordDispositionAsync({
    trace_id: "TRACE-NODE-001",
    disposition: "ACCEPT",
    reason_code: "MANUAL_ENGINEERING_REVIEW",
    operator_id: "OP_NODE",
    comment: "Engineering override waiver",
    ml_decision_snapshot: mlSnap
  });
  assert.strictEqual(dRec.original_ml_decision, "REJECT");
  assert.strictEqual(dRec.disposition, "ACCEPT");
  assert.strictEqual(dRec.feedback_status, "RECORDED_ONLY");
  console.log("  ✓ Attack O Passed: Original ML decision preserved; human disposition stored separately");

  // Attack P: Unauthorized role
  console.log("Attack P: Unauthorized role rejection...");
  await assert.rejects(async () => {
    await dispManager.recordDispositionAsync({
      trace_id: "TRACE-NODE-002",
      disposition: "ACCEPT",
      reason_code: "OTHER",
      operator_id: "ANON",
      operator_role: "ANONYMOUS"
    });
  }, /UNAUTHORIZED_ROLE/);
  console.log("  ✓ Attack P Passed: Unauthorized role rejected");

  // Attack Q: Malformed reason code
  console.log("Attack Q: Malformed reason code...");
  await assert.rejects(async () => {
    await dispManager.recordDispositionAsync({
      trace_id: "TRACE-NODE-003",
      disposition: "ACCEPT",
      reason_code: "INVALID_CODE_123",
      operator_id: "OP_01"
    });
  }, /INVALID_REASON_CODE/);
  console.log("  ✓ Attack Q Passed: Invalid reason code rejected");

  // Attack R: Oversized comment
  console.log("Attack R: Oversized comment rejection...");
  await assert.rejects(async () => {
    await dispManager.recordDispositionAsync({
      trace_id: "TRACE-NODE-004",
      disposition: "REJECT",
      reason_code: "OTHER",
      operator_id: "OP_01",
      comment: "A".repeat(1005)
    });
  }, /OVERSIZED_COMMENT/);
  console.log("  ✓ Attack R Passed: Oversized comment rejected");

  // Attack S, T, U, V, W: Isolation tests
  console.log("Attack S-W: Isolation of datasets, conformal artifacts, anomaly models, thresholds...");
  const datasetShaBefore = computeFileSha256(path.join(__dirname, '../ml/data/synthetic/predicta_dataset_v4_production.csv'));
  const conformalShaBefore = computeFileSha256(path.join(__dirname, '../ml/models/production/conformal_calibration_artifacts.json'));
  const anomalyShaBefore = computeFileSha256(path.join(__dirname, '../ml/models/production/predicta_anomaly_artifacts.json'));
  const manifestShaBefore = computeFileSha256(path.join(__dirname, '../ml/data/split_manifest.json'));

  await dispManager.recordDispositionAsync({
    trace_id: "TRACE-NODE-005",
    disposition: "HOLD",
    reason_code: "EQUIPMENT_ISSUE",
    operator_id: "OP_01"
  });

  assert.strictEqual(computeFileSha256(path.join(__dirname, '../ml/data/synthetic/predicta_dataset_v4_production.csv')), datasetShaBefore);
  assert.strictEqual(computeFileSha256(path.join(__dirname, '../ml/models/production/conformal_calibration_artifacts.json')), conformalShaBefore);
  assert.strictEqual(computeFileSha256(path.join(__dirname, '../ml/models/production/predicta_anomaly_artifacts.json')), anomalyShaBefore);
  assert.strictEqual(computeFileSha256(path.join(__dirname, '../ml/data/split_manifest.json')), manifestShaBefore);
  assert.strictEqual(explainer.operatingThreshold, 0.20);
  console.log("  ✓ Attack S-W Passed: 100% isolation verified across all ML artifacts and datasets");

  console.log("\n================================================================================");
  console.log("🏆 ALL NODE.JS COUNTERFACTUAL & DISPOSITION TESTS PASSED! ✅");
  console.log("================================================================================");
})();
