const engine = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA SIH 2026 — 5 QUALIFICATION DECISION TEST CASES");
console.log("=========================================================================");

const base = {
  test_id: "TEST-001",
  lot_id: "LOT-2026-08-A17",
  wafer_id: "WFR-2026-01",
  equipment_id: "EQP-101",
  temperature: 24.0,
  supply_voltage: 1.20,
  frequency: 2500,
  iddq_standby: 10.2,
  leakage_current: 110.0,
  propagation_delay: 11.0,
  dynamic_power: 56.0,
  total_power: 65.0,
  output_voltage: 1.18,
  current: 40.0,
  resistance: 12.0,
  capacitance: 4.0,
  threshold_voltage: 0.42,
  setup_time: 1.2,
  hold_time: 0.8,
  timing_margin: 2.2,
  test_duration: 12.0
};

// Case 1: PASS for 4.4% Low Risk
const tc1 = engine.predictSingle({ ...base, test_id: "TC1-PASS" });
console.log("\n[TEST CASE 1] Nominal 4.4% Risk Inputs:");
console.log("  Probability:", (tc1.probability * 100).toFixed(1) + "%");
console.log("  Disposition:", tc1.disposition);
console.log("  Operational Decision:", tc1.operational_decision);
console.log("  Recommended Action:", tc1.recommended_action);

// Case 2: REJECT for Critical Anomaly
const tc2 = engine.predictSingle({ ...base, test_id: "TC2-ANOMALY", leakage_current: 1500.0 });
console.log("\n[TEST CASE 2] Critical Anomaly (Leakage = 1500 uA):");
console.log("  Probability:", (tc2.probability * 100).toFixed(1) + "%");
console.log("  Disposition:", tc2.disposition);
console.log("  Anomaly Score:", tc2.anomaly_score);
console.log("  Recommended Action:", tc2.recommended_action);

// Case 3: REJECT for Critical Drift
const tc3 = engine.predictSingle({ ...base, test_id: "TC3-DRIFT", propagation_delay: 60.0 });
console.log("\n[TEST CASE 3] Critical Drift (Delay = 60 ns):");
console.log("  Probability:", (tc3.probability * 100).toFixed(1) + "%");
console.log("  Disposition:", tc3.disposition);
console.log("  Recommended Action:", tc3.recommended_action);

// Case 4: MONITOR for Review Boundary (P in 0.20 - 0.65)
const tc4 = engine.predictSingle({ ...base, test_id: "TC4-MONITOR", temperature: 75.0, supply_voltage: 1.25 });
console.log("\n[TEST CASE 4] Review Boundary (Temp = 75C, Volt = 1.25V):");
console.log("  Probability:", (tc4.probability * 100).toFixed(1) + "%");
console.log("  Disposition:", tc4.disposition);
console.log("  Recommended Action:", tc4.recommended_action);

// Case 5: REJECT for P >= 0.65
const tc5 = engine.predictSingle({ ...base, test_id: "TC5-REJECT", temperature: 160.0, supply_voltage: 1.55, dynamic_power: 300.0 });
console.log("\n[TEST CASE 5] Critical Fail (Temp = 160C, Volt = 1.55V):");
console.log("  Probability:", (tc5.probability * 100).toFixed(1) + "%");
console.log("  Disposition:", tc5.disposition);
console.log("  Recommended Action:", tc5.recommended_action);

// Automated Regression Assertion Guard
const assert = require('assert');
assert.strictEqual(tc1.disposition, "PASS", "FAIL: 4.4% Low Risk + Normal + Within Limits evaluated to " + tc1.disposition + " instead of PASS!");
assert.notStrictEqual(tc1.disposition, "REJECT", "FAIL: Low risk component evaluated to REJECT contradiction!");
assert.strictEqual(tc2.disposition, "REJECT", "FAIL: Critical anomaly should evaluate to REJECT!");
assert.strictEqual(tc3.disposition, "REJECT", "FAIL: Critical drift should evaluate to REJECT!");
assert.strictEqual(tc5.disposition, "REJECT", "FAIL: High ML probability should evaluate to REJECT!");

console.log("\n✅ ALL REGRESSION ASSERTIONS PASSED: 4.4% Low Risk + Normal + Within Limits MUST EQUAL PASS!");
console.log("=========================================================================");
