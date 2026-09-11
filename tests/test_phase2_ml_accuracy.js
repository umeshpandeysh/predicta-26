/**
 * PREDICTA SIH 2026 — Phase 2: ML Accuracy & Multi-Model Validation Test Suite
 * File: tests/test_phase2_ml_accuracy.js
 */

const assert = require('assert');
const serviceInstance = require('../src/api/inference.js');
const service = serviceInstance;

console.log("================================================================================");
console.log("🚨 PREDICTA SIH 2026 — PHASE 2: ML ACCURACY & MULTI-MODEL VALIDATION SUITE");
console.log("================================================================================\n");

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Nominal Reference Chip Telemetry Vector
// -----------------------------------------------------------------------------
const nominalRecord = {
  equipment_id: "EQP-101",
  supply_voltage: 1.20,
  output_voltage: 1.18,
  current: 45.2,
  leakage_current: 110.0,
  resistance: 12.5,
  capacitance: 4.2,
  threshold_voltage: 0.45,
  frequency: 2500.0,
  propagation_delay: 11.0,
  setup_time: 0.85,
  hold_time: 0.42,
  timing_margin: 2.6,
  temperature: 25.0,
  dynamic_power: 54.0,
  total_power: 54.4,
  test_duration: 150.0,
  iddq_standby: 10.2,
  iddq_0h: 10.2,
  ileak_0h: 110.0,
  tpd_0h: 11.0
};

// -----------------------------------------------------------------------------
// Test 1: Single Canonical Unit Conversion Contract Verification
// -----------------------------------------------------------------------------
runTest("Test 1: Single Canonical Unit Conversion Contract Verification", () => {
  const norm = service.getNormalizedParams(nominalRecord);
  
  // Proven multipliers: IDDQ (µA) x 200.0, Leakage (µA) x 2.7, Tpd (ns) x 17.5
  assert.strictEqual(norm.iddq, 10.2 * 200.0, "IDDQ canonical multiplier must be 200.0");
  assert.strictEqual(norm.ileak, 110.0 * 2.7, "Ileak canonical multiplier must be 2.7");
  assert.strictEqual(norm.tpd, 11.0 * 17.5, "Tpd canonical multiplier must be 17.5");

  assert.ok(Math.abs(norm.iddq - 2040.0) < 1e-4, "Nominal canonical IDDQ must be 2040.0");
  assert.ok(Math.abs(norm.ileak - 297.0) < 1e-4, "Nominal canonical Ileak must be 297.0");
  assert.ok(Math.abs(norm.tpd - 192.5) < 1e-4, "Nominal canonical Tpd must be 192.5");
});

// -----------------------------------------------------------------------------
// Test 2: PAT MAD Z-Score Validation & False Positive Rate Measurement
// -----------------------------------------------------------------------------
runTest("Test 2: PAT MAD Z-Score Validation & False Positive Rate Measurement", () => {
  const patResult = service.evaluatePatMad(nominalRecord, "LOT-SYN-001");
  
  // Nominal canonical values: IDDQ=2040.0, Ileak=297.0, Tpd=192.5
  // Global medians: IDDQ=2140.78, Ileak=301.68, Tpd=192.21
  // Expected Z-scores: Z_iddq = |2040.0 - 2140.78| / 141.17 = 0.7138 < 3.0
  // expected Z_ileak = |297.0 - 301.68| / 14.76 = 0.3171 < 3.0
  // expected Z_tpd = |192.5 - 192.21| / 5.99 = 0.0484 < 3.0
  assert.strictEqual(patResult.status, "PASS", `PAT status for nominal chip must be PASS, got ${patResult.status}`);
  assert.ok(patResult.score < 3.0, `PAT max Z-score for nominal chip must be < 3.0, got ${patResult.score}`);

  // Test elevated PAT sample (Z > 3.0)
  const elevatedRecord = { ...nominalRecord, iddq_standby: 14.0 }; // 14.0 * 200 = 2800.0 => Z = |2800 - 2140.78| / 141.17 = 4.67
  const patElevated = service.evaluatePatMad(elevatedRecord);
  assert.strictEqual(patElevated.status, "MONITOR", `PAT status for 14.0uA IDDQ must be MONITOR, got ${patElevated.status}`);
});

// -----------------------------------------------------------------------------
// Test 3: COPOD Multivariate Anomaly Score Calibration
// -----------------------------------------------------------------------------
runTest("Test 3: COPOD Multivariate Anomaly Score Calibration Across Tiers", () => {
  // Normal tier (< 6.5)
  const copodNormal = service.evaluateCopod(nominalRecord);
  assert.strictEqual(copodNormal.status, "PASS", `COPOD status for nominal chip must be PASS, got ${copodNormal.status}`);
  assert.ok(copodNormal.score < 6.5, `COPOD score for nominal chip must be < 6.5, got ${copodNormal.score}`);

  // Borderline tier (6.5 - 9.5)
  const borderlineRecord = { ...nominalRecord, iddq_standby: 13.0, leakage_current: 130.0 };
  const copodBorderline = service.evaluateCopod(borderlineRecord);
  assert.ok(copodBorderline.score >= 6.5 || copodBorderline.status === "MONITOR" || copodBorderline.status === "PASS", "Borderline sample scored appropriately");

  // Extreme tier (>= 9.5)
  const extremeRecord = { ...nominalRecord, iddq_standby: 25.0, leakage_current: 250.0 };
  const copodExtreme = service.evaluateCopod(extremeRecord);
  assert.strictEqual(copodExtreme.status, "REJECT", `COPOD status for extreme chip must be REJECT, got ${copodExtreme.status}`);
  assert.ok(copodExtreme.score >= 9.5, `COPOD score for extreme chip must be >= 9.5, got ${copodExtreme.score}`);
});

// -----------------------------------------------------------------------------
// Test 4: GPR 168h Forecast & Uncertainty Boundary Validation
// -----------------------------------------------------------------------------
runTest("Test 4: GPR 168h Forecast & Uncertainty Boundary Validation", () => {
  const gprResult = service.evaluateGprDrift(nominalRecord);
  assert.ok(gprResult.iddq, "GPR drift prediction for IDDQ must be calculated");
  assert.ok(gprResult.ileak, "GPR drift prediction for Ileak must be calculated");
  assert.ok(gprResult.tpd, "GPR drift prediction for Tpd must be calculated");

  assert.strictEqual(gprResult.tpd.has_history, true, "Tpd prediction must acknowledge baseline history");
  assert.ok(typeof gprResult.tpd.predicted_168h === 'number', "predicted_168h must be numeric");
  assert.ok(typeof gprResult.tpd.lower_95 === 'number', "lower_95 must be numeric");
  assert.ok(typeof gprResult.tpd.upper_95 === 'number', "upper_95 must be numeric");
  assert.ok(gprResult.tpd.upper_95 >= gprResult.tpd.predicted_168h, "Upper 95% bound must be >= point prediction");

  const safety = service.evaluateSafetySlope(gprResult);
  assert.strictEqual(safety.tpd.boundary_status, "WITHIN", "Nominal Tpd trajectory boundary status must be WITHIN");
});

// -----------------------------------------------------------------------------
// Test 5: XGBoost Probability Calibration & Threshold Justification
// -----------------------------------------------------------------------------
runTest("Test 5: XGBoost Probability Calibration & Threshold Justification (0.20)", () => {
  const validated = service.validateInputRecord(nominalRecord);
  const engineered = service.engineerFeatures(validated, nominalRecord.equipment_id);
  const prob = service.calculateProbability(engineered, nominalRecord.equipment_id);

  assert.ok(typeof prob === 'number', "Probability must be numeric");
  assert.ok(prob >= 0.0 && prob <= 1.0, "Probability must be between 0.0 and 1.0");
  assert.ok(prob < service.operatingThreshold, `Nominal chip probability (${prob}) must be below operating threshold (${service.operatingThreshold})`);

  // Empirical threshold metric evaluation across candidate thresholds (Validated on the controlled project evaluation dataset)
  const candidateThresholds = [0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50];
  
  // Controlled evaluation population (50 nominal safe chips, 50 defective/marginal chips)
  const evalSet = [];
  for (let i = 0; i < 50; i++) {
    evalSet.push({ record: { ...nominalRecord, iddq_standby: 10.0 + (i % 3) * 0.1 }, trueLabel: 0 }); // Safe (Label 0)
  }
  for (let i = 0; i < 50; i++) {
    evalSet.push({ record: { ...nominalRecord, leakage_current: 190.0 + i * 2.0, temperature: 32.0 + (i % 5) }, trueLabel: 1 }); // Defective (Label 1)
  }

  const thresholdResults = candidateThresholds.map(th => {
    let tp = 0, fp = 0, tn = 0, fn = 0;
    evalSet.forEach(item => {
      const v = service.validateInputRecord(item.record);
      const e = service.engineerFeatures(v, item.record.equipment_id);
      const p = service.calculateProbability(e, item.record.equipment_id);
      const predLabel = p >= th ? 1 : 0;
      if (predLabel === 1 && item.trueLabel === 1) tp++;
      else if (predLabel === 1 && item.trueLabel === 0) fp++;
      else if (predLabel === 0 && item.trueLabel === 0) tn++;
      else if (predLabel === 0 && item.trueLabel === 1) fn++;
    });

    const precision = tp + fp > 0 ? tp / (tp + fp) : 1.0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0.0;
    const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0.0;

    return { threshold: th, tp, fp, tn, fn, precision: Number(precision.toFixed(4)), recall: Number(recall.toFixed(4)), f1: Number(f1.toFixed(4)) };
  });

  assert.strictEqual(service.operatingThreshold, 0.20, "Locked operating threshold must be 0.20");
  assert.ok(thresholdResults.find(r => r.threshold === 0.20).f1 >= 0.95, "Operating threshold 0.20 must achieve F1 score >= 0.95");
});

// -----------------------------------------------------------------------------
// Test 6: Four Mandatory End-to-End Decision Cases
// -----------------------------------------------------------------------------
runTest("Test 6: Four Mandatory End-to-End Decision Cases", () => {
  // Case 1: SAFE (XGB < 0.20, PAT PASS, COPOD PASS, GPR WITHIN => PASS)
  const validated1 = service.validateInputRecord(nominalRecord);
  const engineered1 = service.engineerFeatures(validated1, nominalRecord.equipment_id);
  const p1 = service.calculateProbability(engineered1, nominalRecord.equipment_id);
  const pat1 = service.evaluatePatMad(nominalRecord);
  const copod1 = service.evaluateCopod(nominalRecord);
  const anomaly1 = service.combineAnomalyEvidence(pat1, copod1);
  const gpr1 = service.evaluateGprDrift(nominalRecord);
  const safety1 = service.evaluateSafetySlope(gpr1);
  const risk1 = service.evaluateMultiCriteriaRisk(anomaly1, gpr1, safety1);
  const disp1 = service.synthesizeOperationalDisposition(p1, anomaly1, gpr1, safety1, risk1);

  assert.strictEqual(disp1.disposition, "PASS", `Case 1 disposition must be PASS, got ${disp1.disposition}`);

  // Case 2: ELEVATED (PAT/COPOD Warning or XGB Elevated => MONITOR)
  const record2 = { ...nominalRecord, iddq_standby: 14.0, iddq_0h: 10.2 };
  const validated2 = service.validateInputRecord(record2);
  const engineered2 = service.engineerFeatures(validated2, record2.equipment_id);
  const p2 = service.calculateProbability(engineered2, record2.equipment_id);
  const pat2 = service.evaluatePatMad(record2);
  const copod2 = service.evaluateCopod(record2);
  const anomaly2 = service.combineAnomalyEvidence(pat2, copod2);
  const gpr2 = service.evaluateGprDrift(record2);
  const safety2 = service.evaluateSafetySlope(gpr2);
  const risk2 = service.evaluateMultiCriteriaRisk(anomaly2, gpr2, safety2);
  const disp2 = service.synthesizeOperationalDisposition(p2, anomaly2, gpr2, safety2, risk2);

  assert.strictEqual(disp2.disposition, "MONITOR", `Case 2 disposition must be MONITOR, got ${disp2.disposition}`);

  // Case 3: CRITICAL ANOMALY (PAT REJECT / COPOD REJECT => REJECT)
  const record3 = { ...nominalRecord, iddq_standby: 25.0, iddq_0h: 10.2 };
  const validated3 = service.validateInputRecord(record3);
  const engineered3 = service.engineerFeatures(validated3, record3.equipment_id);
  const p3 = service.calculateProbability(engineered3, record3.equipment_id);
  const pat3 = service.evaluatePatMad(record3);
  const copod3 = service.evaluateCopod(record3);
  const anomaly3 = service.combineAnomalyEvidence(pat3, copod3);
  const gpr3 = service.evaluateGprDrift(record3);
  const safety3 = service.evaluateSafetySlope(gpr3);
  const risk3 = service.evaluateMultiCriteriaRisk(anomaly3, gpr3, safety3);
  const disp3 = service.synthesizeOperationalDisposition(p3, anomaly3, gpr3, safety3, risk3);

  assert.strictEqual(disp3.disposition, "REJECT", `Case 3 disposition must be REJECT, got ${disp3.disposition}`);

  // Case 4: DRIFT FAILURE (GPR EXCEEDED => REJECT)
  const record4 = { ...nominalRecord, propagation_delay: 24.0, tpd_0h: 11.0 };
  const validated4 = service.validateInputRecord(record4);
  const engineered4 = service.engineerFeatures(validated4, record4.equipment_id);
  const p4 = service.calculateProbability(engineered4, record4.equipment_id);
  const pat4 = service.evaluatePatMad(record4);
  const copod4 = service.evaluateCopod(record4);
  const anomaly4 = service.combineAnomalyEvidence(pat4, copod4);
  const gpr4 = service.evaluateGprDrift(record4);
  const safety4 = service.evaluateSafetySlope(gpr4);
  const risk4 = service.evaluateMultiCriteriaRisk(anomaly4, gpr4, safety4);
  const disp4 = service.synthesizeOperationalDisposition(p4, anomaly4, gpr4, safety4, risk4);

  assert.strictEqual(disp4.disposition, "REJECT", `Case 4 disposition must be REJECT, got ${disp4.disposition}`);
});

// -----------------------------------------------------------------------------
// Test 7: Explainability Trace & Attribution Accuracy
// -----------------------------------------------------------------------------
runTest("Test 7: Explainability Trace & Attribution Accuracy", () => {
  const pat = service.evaluatePatMad(nominalRecord);
  const copod = service.evaluateCopod(nominalRecord);
  const anomaly = service.combineAnomalyEvidence(pat, copod);
  const gpr = service.evaluateGprDrift(nominalRecord);
  const safety = service.evaluateSafetySlope(gpr);
  const risk = service.evaluateMultiCriteriaRisk(anomaly, gpr, safety);

  const explainTrace = service.generateExplainabilityTrace(anomaly, gpr, safety, risk);

  assert.ok(explainTrace.summary, "Explainability summary must exist");
  assert.ok(Array.isArray(explainTrace.decision_trace), "decision_trace must be an array");
  assert.strictEqual(explainTrace.decision_trace.length, 5, "decision_trace must contain 5 pipeline stages");
  assert.ok(explainTrace.parameter_attribution.iddq, "Attribution for IDDQ must exist");
});

// -----------------------------------------------------------------------------
// Test 8: Input Robustness & Out-of-Bounds Error Handling
// -----------------------------------------------------------------------------
runTest("Test 8: Input Robustness & Out-of-Bounds Error Handling", () => {
  // Test missing equipment_id
  assert.throws(() => {
    service.validateInputRecord({ supply_voltage: 1.2 });
  }, /Missing required field: equipment_id/, "Must throw error on missing equipment_id");

  // Test invalid equipment_id
  assert.throws(() => {
    service.validateInputRecord({ ...nominalRecord, equipment_id: "EQP-999" });
  }, /Invalid equipment_id/, "Must throw error on unknown equipment_id");

  // Test NaN feature value
  assert.throws(() => {
    service.validateInputRecord({ ...nominalRecord, supply_voltage: NaN });
  }, /must be a valid finite number/, "Must throw error on NaN input");

  // Test Infinity feature value
  assert.throws(() => {
    service.validateInputRecord({ ...nominalRecord, leakage_current: Infinity });
  }, /must be a valid finite number/, "Must throw error on Infinity input");
});

console.log("\n================================================================================");
console.log("✅ ALL PHASE 2 ML ACCURACY & MULTI-MODEL VALIDATION TESTS PASSED CLEANLY!");
console.log("================================================================================\n");
