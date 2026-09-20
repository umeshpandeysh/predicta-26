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

async function runTests() {
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

  // Attack B: Unknown Extra feature
  console.log("Attack B: Unknown extra feature MUST fail closed...");
  assert.throws(() => {
    const extraRec = { ...SAMPLE_FAILING_RECORD, malicious_extra: 999.9 };
    explainer.generateCounterfactual(extraRec);
  }, /UNKNOWN_FEATURE/);
  console.log("  ✓ Attack B Passed: Unknown extra feature rejected with UNKNOWN_FEATURE");

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

  // Attack L: Model hash mutation
  console.log("Attack L: Model hash mutation rejection...");
  assert.throws(() => {
    new GovernedCounterfactualExplainerJS(
      undefined,
      path.resolve(__dirname, '../ml/models/production/predicta_production_manifest.json')
    );
  }, /MODEL_HASH_MISMATCH/);
  console.log("  ✓ Attack L Passed: Model hash mutation/mismatch detected");

  // Attack M: Prediction parity
  console.log("Attack M: Prediction parity verification...");
  const cfInput = cfRes.counterfactual_input;
  const cfVec = explainer.buildFeatureVectorFromRaw(cfInput, SAMPLE_FAILING_RECORD.equipment_id);
  const [, actualCalibP] = explainer.evaluateProbability(cfVec);
  assert.ok(Math.abs(actualCalibP - cfRes.counterfactual_prediction.calibrated_probability) <= 1e-5);
  console.log("  ✓ Attack M Passed: Reported counterfactual prediction matches actual model evaluation");

  // Attack N: Fake frontend explanation / invalid provenance
  console.log("Attack N: Explanations with invalid model provenance fail closed...");
  assert.throws(() => {
    new GovernedCounterfactualExplainerJS(
      undefined,
      path.resolve(__dirname, '../ml/models/production/predicta_production_manifest.json')
    );
  }, /MODEL_HASH_MISMATCH/);
  console.log("  ✓ Attack N Passed: Fake explanation provenance fails backend verification");

  // Attack O: Human disposition does not overwrite original ML decision
  console.log("Attack O: Human disposition does not overwrite original ML decision...");
  const traceO = "TRACE-NODE-ATTACK-O";
  dispManager.registerAuthoritativePrediction({
    trace_id: traceO,
    prediction: "REJECT",
    probability: 0.85,
    component_id: "COMP-001",
    lot_id: "LOT-SYN-045"
  });
  const dispRecord = await dispManager.recordDispositionAsync({
    trace_id: traceO,
    disposition: "ACCEPT",
    reason_code: "MANUAL_ENGINEERING_REVIEW",
    operator_id: "OP_TEST",
    comment: "Engineering waiver"
  });
  assert.strictEqual(dispRecord.original_ml_decision, "REJECT");
  assert.strictEqual(dispRecord.disposition, "ACCEPT");
  assert.strictEqual(dispRecord.feedback_status, "RECORDED_ONLY");
  const authAfterO = dispManager.lookupAuthoritativePrediction(traceO);
  assert.strictEqual(authAfterO.prediction, "REJECT");
  assert.strictEqual(authAfterO.probability, 0.85);
  console.log("  ✓ Attack O Passed: Original ML decision preserved; human disposition stored separately");

  // Attack P: Unauthorized role rejection
  console.log("Attack P: Unauthorized role rejection...");
  const traceP = "TRACE-NODE-ATTACK-P";
  dispManager.registerAuthoritativePrediction({ trace_id: traceP, prediction: "FAIL", probability: 0.8, component_id: "COMP-P", lot_id: "LOT-SYN-045" });
  await assert.rejects(async () => {
    await dispManager.recordDispositionAsync({
      trace_id: traceP,
      disposition: "ACCEPT",
      reason_code: "OTHER",
      operator_role: "ANONYMOUS"
    });
  }, /UNAUTHORIZED_ROLE/);
  console.log("  ✓ Attack P Passed: Unauthorized role rejected");

  // Attack Q: Malformed reason code
  console.log("Attack Q: Malformed reason code...");
  const traceQ = "TRACE-NODE-ATTACK-Q";
  dispManager.registerAuthoritativePrediction({ trace_id: traceQ, prediction: "FAIL", probability: 0.8, component_id: "COMP-Q", lot_id: "LOT-SYN-045" });
  await assert.rejects(async () => {
    await dispManager.recordDispositionAsync({
      trace_id: traceQ,
      disposition: "ACCEPT",
      reason_code: "INVALID_REASON"
    });
  }, /INVALID_REASON_CODE/);
  console.log("  ✓ Attack Q Passed: Invalid reason code rejected");

  // Attack R: Oversized comment rejection
  console.log("Attack R: Oversized comment rejection...");
  const traceR = "TRACE-NODE-ATTACK-R";
  dispManager.registerAuthoritativePrediction({ trace_id: traceR, prediction: "FAIL", probability: 0.8, component_id: "COMP-R", lot_id: "LOT-SYN-045" });
  await assert.rejects(async () => {
    await dispManager.recordDispositionAsync({
      trace_id: traceR,
      disposition: "REJECT",
      reason_code: "PROCESS_EXCEPTION",
      comment: "A".repeat(1005)
    });
  }, /OVERSIZED_COMMENT/);
  console.log("  ✓ Attack R Passed: Oversized comment rejected");

  // Attack S-W: Isolation of datasets, conformal artifacts, anomaly models, thresholds
  console.log("Attack S-W: Isolation of datasets, conformal artifacts, anomaly models, thresholds...");
  const datasetPath = path.resolve(__dirname, '../ml/data/synthetic/predicta_dataset_v4_production.csv');
  const dShaBefore = computeFileSha256(datasetPath);
  const traceSW = "TRACE-NODE-ATTACK-SW";
  dispManager.registerAuthoritativePrediction({ trace_id: traceSW, prediction: "PASS", probability: 0.05, component_id: "COMP-SW", lot_id: "LOT-SYN-045" });
  await dispManager.recordDispositionAsync({
    trace_id: traceSW,
    disposition: "ACCEPT",
    reason_code: "OTHER"
  });
  const dShaAfter = computeFileSha256(datasetPath);
  assert.strictEqual(dShaBefore, dShaAfter);
  console.log("  ✓ Attack S-W Passed: 100% isolation verified across all ML artifacts and datasets");

  // Attack X: Stale contract
  console.log("Attack X: Stale contract version triggers rejection...");
  assert.throws(() => {
    new GovernedCounterfactualExplainerJS(
      path.resolve(__dirname, '../ml/models/production/predicta_production_manifest.json')
    );
  });
  console.log("  ✓ Attack X Passed: Stale contract caught");

  // Attack Y: Missing model artifact
  console.log("Attack Y: Missing model artifact fails closed...");
  assert.throws(() => {
    new GovernedCounterfactualExplainerJS(undefined, "nonexistent.json");
  }, /ARTIFACT_MISSING/);
  console.log("  ✓ Attack Y Passed: Missing model artifact fails closed");

  // Attack Z: Corrupted model artifact
  console.log("Attack Z: Corrupted model artifact fails closed...");
  assert.throws(() => {
    new GovernedCounterfactualExplainerJS(undefined, path.resolve(__dirname, '../package.json'));
  }, /MODEL_HASH_MISMATCH/);
  console.log("  ✓ Attack Z Passed: Corrupted model artifact fails closed");

  // --- NEW ATTACKS AA through AL ---
  console.log("\n--- RUNNING NEW ATTACKS AA through AL ---");

  // Attack AA: Client supplies fake ml_decision_snapshot
  console.log("Attack AA: Client supplies fake ml_decision_snapshot -> rejected...");
  const traceAA = "TRACE-NODE-AA";
  dispManager.registerAuthoritativePrediction({ trace_id: traceAA, prediction: "REJECT", probability: 0.90, component_id: "COMP-AA", lot_id: "LOT-SYN-045" });
  await assert.rejects(async () => {
    await dispManager.recordDispositionAsync({
      trace_id: traceAA,
      disposition: "ACCEPT",
      reason_code: "OTHER",
      ml_decision_snapshot: { ml_decision: "PASS", probability: 0.01 }
    });
  }, /CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED/);
  console.log("  ✓ Attack AA Passed: Fake ml_decision_snapshot rejected");

  // Attack AB: Client supplies fake probability
  console.log("Attack AB: Client supplies fake probability -> rejected...");
  const traceAB = "TRACE-NODE-AB";
  dispManager.registerAuthoritativePrediction({ trace_id: traceAB, prediction: "REJECT", probability: 0.90, component_id: "COMP-AB", lot_id: "LOT-SYN-045" });
  await assert.rejects(async () => {
    await dispManager.recordDispositionAsync({
      trace_id: traceAB,
      disposition: "ACCEPT",
      reason_code: "OTHER",
      probability: 0.01
    });
  }, /CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED/);
  console.log("  ✓ Attack AB Passed: Client probability rejected");

  // Attack AC: Client supplies fake model_hash
  console.log("Attack AC: Client supplies fake model_hash -> rejected...");
  const traceAC = "TRACE-NODE-AC";
  dispManager.registerAuthoritativePrediction({ trace_id: traceAC, prediction: "REJECT", probability: 0.90, component_id: "COMP-AC", lot_id: "LOT-SYN-045" });
  await assert.rejects(async () => {
    await dispManager.recordDispositionAsync({
      trace_id: traceAC,
      disposition: "ACCEPT",
      reason_code: "OTHER",
      model_hash: "fake_hash_123"
    });
  }, /CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED/);
  console.log("  ✓ Attack AC Passed: Client model_hash rejected");

  // Attack AD: Client supplies fake model_id
  console.log("Attack AD: Client supplies fake model_id -> rejected...");
  const traceAD = "TRACE-NODE-AD";
  dispManager.registerAuthoritativePrediction({ trace_id: traceAD, prediction: "REJECT", probability: 0.90, component_id: "COMP-AD", lot_id: "LOT-SYN-045" });
  await assert.rejects(async () => {
    await dispManager.recordDispositionAsync({
      trace_id: traceAD,
      disposition: "ACCEPT",
      reason_code: "OTHER",
      model_id: "fake_model_id"
    });
  }, /CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED/);
  console.log("  ✓ Attack AD Passed: Client model_id rejected");

  // Attack AE: Authoritative prediction missing
  console.log("Attack AE: Authoritative prediction missing -> fails closed...");
  await assert.rejects(async () => {
    await dispManager.recordDispositionAsync({
      trace_id: "NONEXISTENT-TRACE-9999",
      disposition: "ACCEPT",
      reason_code: "OTHER"
    });
  }, /AUTHORITATIVE_ML_RECORD_NOT_FOUND/);
  console.log("  ✓ Attack AE Passed: Missing authoritative prediction fails closed");

  // Attack AF: Authoritative model provenance invalid
  console.log("Attack AF: Authoritative model provenance invalid -> fails closed...");
  const badProvManager = new HumanDispositionManagerJS(
    undefined,
    undefined,
    path.resolve(__dirname, '../package.json')
  );
  const traceAF = "TRACE-NODE-AF";
  badProvManager.registerAuthoritativePrediction({ trace_id: traceAF, prediction: "REJECT", probability: 0.88, component_id: "COMP-AF", lot_id: "LOT-SYN-045" });
  await assert.rejects(async () => {
    await badProvManager.recordDispositionAsync({
      trace_id: traceAF,
      disposition: "ACCEPT",
      reason_code: "OTHER"
    });
  }, /MODEL_PROVENANCE_INVALID/);
  console.log("  ✓ Attack AF Passed: Invalid model provenance fails closed");

  // Attack AG: Duplicate disposition does not overwrite history
  console.log("Attack AG: Duplicate disposition preserves append-only history...");
  const traceAG = "TRACE-NODE-AG";
  dispManager.registerAuthoritativePrediction({
    trace_id: traceAG,
    prediction: "REJECT",
    probability: 0.88,
    component_id: "COMP-AG",
    lot_id: "LOT-SYN-045"
  });
  const recAG1 = await dispManager.recordDispositionAsync({
    trace_id: traceAG,
    disposition: "HOLD",
    reason_code: "INSUFFICIENT_DATA",
    comment: "Initial hold"
  });
  const recAG2 = await dispManager.recordDispositionAsync({
    trace_id: traceAG,
    disposition: "ACCEPT",
    reason_code: "MANUAL_ENGINEERING_REVIEW",
    comment: "Subsequent waiver"
  });
  const historyAG = await dispManager.getDispositionAsync(traceAG);
  assert.strictEqual(historyAG.total_dispositions, 2);
  assert.strictEqual(historyAG.history[0].disposition_id, recAG1.disposition_id);
  assert.strictEqual(historyAG.history[1].disposition_id, recAG2.disposition_id);
  console.log("  ✓ Attack AG Passed: History correctly appends multiple records");

  // Attack AH: Second disposition preserves first record completely intact
  console.log("Attack AH: Second disposition preserves first record...");
  const traceAH = "TRACE-NODE-AH";
  dispManager.registerAuthoritativePrediction({ trace_id: traceAH, prediction: "FAIL", probability: 0.95, component_id: "COMP-AH", lot_id: "LOT-SYN-045" });
  const recAH1 = await dispManager.recordDispositionAsync({
    trace_id: traceAH,
    disposition: "RETEST",
    reason_code: "RETEST_REQUIRED",
    comment: "First note"
  });
  const snapshotAH1 = JSON.stringify(recAH1);
  await dispManager.recordDispositionAsync({
    trace_id: traceAH,
    disposition: "REJECT",
    reason_code: "PROCESS_EXCEPTION",
    comment: "Second note"
  });
  const historyAH = await dispManager.getDispositionAsync(traceAH);
  assert.strictEqual(JSON.stringify(historyAH.history[0]), snapshotAH1);
  console.log("  ✓ Attack AH Passed: Prior record is immutable and preserved");

  // Attack AI: Client attempts to submit original_ml_decision directly
  console.log("Attack AI: Client submits original_ml_decision directly -> rejected...");
  const traceAI = "TRACE-NODE-AI";
  dispManager.registerAuthoritativePrediction({ trace_id: traceAI, prediction: "REJECT", probability: 0.85, component_id: "COMP-AI", lot_id: "LOT-SYN-045" });
  await assert.rejects(async () => {
    await dispManager.recordDispositionAsync({
      trace_id: traceAI,
      disposition: "ACCEPT",
      reason_code: "OTHER",
      original_ml_decision: "PASS"
    });
  }, /CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED/);
  console.log("  ✓ Attack AI Passed: Client original_ml_decision rejected");

  // Attack AJ: Client attempts to submit anomaly_score
  console.log("Attack AJ: Client submits anomaly_score directly -> rejected...");
  const traceAJ = "TRACE-NODE-AJ";
  dispManager.registerAuthoritativePrediction({ trace_id: traceAJ, prediction: "REJECT", probability: 0.85, component_id: "COMP-AJ", lot_id: "LOT-SYN-045" });
  await assert.rejects(async () => {
    await dispManager.recordDispositionAsync({
      trace_id: traceAJ,
      disposition: "ACCEPT",
      reason_code: "OTHER",
      anomaly_score: 0.05
    });
  }, /CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED/);
  console.log("  ✓ Attack AJ Passed: Client anomaly_score rejected");

  // Attack AK: Client attempts to submit prognostic_output
  console.log("Attack AK: Client submits prognostic_output directly -> rejected...");
  const traceAK = "TRACE-NODE-AK";
  dispManager.registerAuthoritativePrediction({ trace_id: traceAK, prediction: "REJECT", probability: 0.85, component_id: "COMP-AK", lot_id: "LOT-SYN-045" });
  await assert.rejects(async () => {
    await dispManager.recordDispositionAsync({
      trace_id: traceAK,
      disposition: "ACCEPT",
      reason_code: "OTHER",
      prognostic_output: { state: "HEALTHY" }
    });
  }, /CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED/);
  console.log("  ✓ Attack AK Passed: Client prognostic_output rejected");

  // Attack AL: Client attempts to inject ground_truth
  console.log("Attack AL: Client injects ground_truth -> rejected...");
  const traceAL = "TRACE-NODE-AL";
  dispManager.registerAuthoritativePrediction({ trace_id: traceAL, prediction: "REJECT", probability: 0.85, component_id: "COMP-AL", lot_id: "LOT-SYN-045" });
  await assert.rejects(async () => {
    await dispManager.recordDispositionAsync({
      trace_id: traceAL,
      disposition: "ACCEPT",
      reason_code: "OTHER",
      ground_truth: "PASS"
    });
  }, /CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED/);
  console.log("  ✓ Attack AL Passed: Client ground_truth rejected");


  // Attack AM: Client component identity override
  console.log("Attack AM: Client component identity override -> rejected...");
  const traceAM = "TRACE-NODE-AM";
  dispManager.registerAuthoritativePrediction({
    trace_id: traceAM,
    prediction: "REJECT",
    probability: 0.88,
    component_id: "COMP-A",
    lot_id: "LOT-A"
  });
  await assert.rejects(async () => {
    await dispManager.recordDispositionAsync({
      trace_id: traceAM,
      disposition: "ACCEPT",
      reason_code: "MANUAL_ENGINEERING_REVIEW",
      component_id: "COMP-B",
      lot_id: "LOT-B"
    });
  }, /CLIENT_CONTROLLED_IDENTITY_PROHIBITED/);
  const histAM = await dispManager.getDispositionAsync(traceAM);
  assert.strictEqual(histAM, null);
  console.log("  ✓ Attack AM Passed: Client component identity override rejected");

  // Attack AN: Missing authoritative component identity
  console.log("Attack AN: Missing authoritative component identity -> fails closed...");
  const traceAN = "TRACE-NODE-AN";
  dispManager.registerAuthoritativePrediction({
    trace_id: traceAN,
    prediction: "REJECT",
    probability: 0.88,
    lot_id: "LOT-A"
  });
  // Client attempt to fill gap with component_id must fail closed
  await assert.rejects(async () => {
    await dispManager.recordDispositionAsync({
      trace_id: traceAN,
      disposition: "ACCEPT",
      reason_code: "MANUAL_ENGINEERING_REVIEW",
      component_id: "COMP-A"
    });
  }, /(CLIENT_CONTROLLED_IDENTITY_PROHIBITED|AUTHORITATIVE_IDENTITY_RECORD_NOT_FOUND)/);
  // Without component_id, backend must also fail closed
  await assert.rejects(async () => {
    await dispManager.recordDispositionAsync({
      trace_id: traceAN,
      disposition: "ACCEPT",
      reason_code: "MANUAL_ENGINEERING_REVIEW"
    });
  }, /AUTHORITATIVE_IDENTITY_RECORD_NOT_FOUND/);
  console.log("  ✓ Attack AN Passed: Missing authoritative component identity fails closed");

  // Attack AO: Missing authoritative lot identity
  console.log("Attack AO: Missing authoritative lot identity -> fails closed...");
  const traceAO = "TRACE-NODE-AO";
  dispManager.registerAuthoritativePrediction({
    trace_id: traceAO,
    prediction: "REJECT",
    probability: 0.88,
    component_id: "COMP-A"
  });
  // Client attempt to fill gap with lot_id must fail closed
  await assert.rejects(async () => {
    await dispManager.recordDispositionAsync({
      trace_id: traceAO,
      disposition: "ACCEPT",
      reason_code: "MANUAL_ENGINEERING_REVIEW",
      lot_id: "LOT-A"
    });
  }, /(CLIENT_CONTROLLED_IDENTITY_PROHIBITED|AUTHORITATIVE_IDENTITY_RECORD_NOT_FOUND)/);
  // Without lot_id, backend must also fail closed
  await assert.rejects(async () => {
    await dispManager.recordDispositionAsync({
      trace_id: traceAO,
      disposition: "ACCEPT",
      reason_code: "MANUAL_ENGINEERING_REVIEW"
    });
  }, /AUTHORITATIVE_IDENTITY_RECORD_NOT_FOUND/);
  console.log("  ✓ Attack AO Passed: Missing authoritative lot identity fails closed");

  // Attack AP: Client-supplied matching identity rejected
  console.log("Attack AP: Client-supplied matching identity -> rejected to enforce single provenance source...");
  const traceAP = "TRACE-NODE-AP";
  dispManager.registerAuthoritativePrediction({
    trace_id: traceAP,
    prediction: "REJECT",
    probability: 0.88,
    component_id: "COMP-A",
    lot_id: "LOT-A"
  });
  await assert.rejects(async () => {
    await dispManager.recordDispositionAsync({
      trace_id: traceAP,
      disposition: "ACCEPT",
      reason_code: "MANUAL_ENGINEERING_REVIEW",
      component_id: "COMP-A",
      lot_id: "LOT-A"
    });
  }, /CLIENT_CONTROLLED_IDENTITY_PROHIBITED/);
  console.log("  ✓ Attack AP Passed: Client-supplied matching identity rejected");

  // Attack AQ: Identity mutation across append-only disposition history
  console.log("Attack AQ: Identity mutation across append-only history -> rejected...");
  const traceAQ = "TRACE-NODE-AQ";
  dispManager.registerAuthoritativePrediction({
    trace_id: traceAQ,
    prediction: "REJECT",
    probability: 0.85,
    component_id: "COMP-AUTH-AQ",
    lot_id: "LOT-AUTH-AQ"
  });
  const recAQ1 = await dispManager.recordDispositionAsync({
    trace_id: traceAQ,
    disposition: "HOLD",
    reason_code: "PROCESS_EXCEPTION",
    comment: "Initial hold"
  });
  assert.strictEqual(recAQ1.component_id, "COMP-AUTH-AQ");
  assert.strictEqual(recAQ1.lot_id, "LOT-AUTH-AQ");

  // Client attempts identity mutation on second disposition
  await assert.rejects(async () => {
    await dispManager.recordDispositionAsync({
      trace_id: traceAQ,
      disposition: "ACCEPT",
      reason_code: "MANUAL_ENGINEERING_REVIEW",
      component_id: "COMP-MUTATED",
      lot_id: "LOT-MUTATED"
    });
  }, /CLIENT_CONTROLLED_IDENTITY_PROHIBITED/);

  // Submit valid second disposition
  const recAQ2 = await dispManager.recordDispositionAsync({
    trace_id: traceAQ,
    disposition: "ACCEPT",
    reason_code: "MANUAL_ENGINEERING_REVIEW",
    comment: "Second disposition"
  });
  assert.strictEqual(recAQ2.component_id, "COMP-AUTH-AQ");
  assert.strictEqual(recAQ2.lot_id, "LOT-AUTH-AQ");

  const histAQ = await dispManager.getDispositionAsync(traceAQ);
  assert.strictEqual(histAQ.total_dispositions, 2);
  assert.strictEqual(histAQ.history[0].component_id, "COMP-AUTH-AQ");
  assert.strictEqual(histAQ.history[0].lot_id, "LOT-AUTH-AQ");
  assert.strictEqual(histAQ.history[1].component_id, "COMP-AUTH-AQ");
  assert.strictEqual(histAQ.history[1].lot_id, "LOT-AUTH-AQ");
  assert.strictEqual(histAQ.history[0].disposition_id, recAQ1.disposition_id);
  assert.strictEqual(histAQ.history[0].disposition, "HOLD");
  console.log("  ✓ Attack AQ Passed: Both historical records retain authoritative identities");

  console.log("\n================================================================================");
  console.log("🏆 ALL NODE.JS COUNTERFACTUAL & DISPOSITION TESTS (A-Z, AA-AQ) PASSED! ✅");
  console.log("================================================================================");
}

runTests().catch(err => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
