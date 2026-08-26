/**
 * Predicta Final Adversarial Acceptance & Bug-Hunt Test Suite
 * File: tests/test_adversarial_final.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');
const ateSim = require('../src/simulation/ate_simulator');
const fs = require('fs');
const path = require('path');

console.log("=========================================================================");
console.log("PREDICTA FINAL ADVERSARIAL ACCEPTANCE & BUG-HUNT TEST SUITE");
console.log("=========================================================================\n");

// 1. Health & System Status Audit
const sysStatus = inf.getSystemStatus();
assert.strictEqual(sysStatus.api, "ONLINE", "[1] API status must be ONLINE");
assert.strictEqual(sysStatus.ml_engine, "ONLINE", "[2] ML Engine status must be ONLINE");
assert.strictEqual(sysStatus.threshold, 0.45, "[3] Operating threshold must be 0.45");
console.log("✔ Audit 1-3 Passed: API ONLINE, ML Engine ONLINE, Threshold strictly 0.45");

// 2. Manual Custom Telemetry Input Execution
const customTelemetry = {
  test_id: "ADV-CUST-001", equipment_id: "EQP-102",
  supply_voltage: 1.15, output_voltage: 1.12, current: 48.0, leakage_current: 240.0,
  resistance: 14.0, capacitance: 5.0, threshold_voltage: 0.42, frequency: 2600.0,
  propagation_delay: 18.5, setup_time: 1.8, hold_time: 1.1, timing_margin: 1.2,
  temperature: 55.0, dynamic_power: 65.0, total_power: 82.0, test_duration: 15.0
};
const resCustom = inf.predictSingle(customTelemetry);
assert.strictEqual(resCustom.prediction, "FAIL", "[4] High leakage custom record must predict FAIL");
assert.strictEqual(resCustom.operational_decision, "FAIL", "[5] High leakage custom record operational decision must be FAIL");
assert.ok(resCustom.trace_id.startsWith("PRED-2026-"), "[6] Custom record trace ID format PRED-2026-XXXXXXXX required");
console.log("✔ Audit 4-6 Passed: Custom manual telemetry record correctly executed ML inference & 3-zone decision engine");

// 3. Demo Scenario Presets Execution (7 Scenarios)
const scenarioKeys = ["NORMAL", "HIGH_LEAKAGE", "THERMAL_ANOMALY", "TIMING_FAILURE", "EQUIPMENT_DRIFT", "COMBINED_DEFECT", "REVIEW_CASE"];
scenarioKeys.forEach((key, idx) => {
  const scenario = ateSim.getDemoScenario(key);
  assert.ok(scenario, `Demo scenario ${key} missing`);
  const resScenario = inf.predictSingle(scenario);
  assert.ok(resScenario.prediction, `Demo scenario ${key} prediction missing`);
  assert.ok(resScenario.operational_decision, `Demo scenario ${key} decision missing`);
});
console.log("✔ Audit 7 Passed: Validated all 7 SIH Demo Mode scenarios through production inference engine");

// 4. Data Quality Gate Contract Attack
const malformedRecord = { ...customTelemetry, temperature: -999.0 };
assert.throws(() => {
  inf.predictSingle(malformedRecord);
}, (err) => {
  return err.message.includes("DATA_QUALITY_REJECTED");
}, "[8] Physically impossible temperature (-999°C) must trigger DATA_QUALITY_REJECTED");
console.log("✔ Audit 8 Passed: Data Quality Gate intercepted malformed telemetry prior to ML inference");

// 5. Operator Workflow Safeguards & Immutability
const reviewRecord = {
  test_id: "ADV-REV-001", equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 160.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
  propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 31.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0
};
const resReview = inf.predictSingle(reviewRecord);
assert.strictEqual(resReview.operational_decision, "SECONDARY_TEST", "[9] Borderline record must trigger SECONDARY_TEST");

const secReq = inf.requestSecondaryTest(resReview.test_id, "OP-101", "Secondary ATE re-test requested");
assert.strictEqual(secReq.lifecycle_state, "SECONDARY_TEST_PENDING", "[10] Lifecycle state must be SECONDARY_TEST_PENDING");

const secComp = inf.completeSecondaryTest(resReview.test_id, "PASS", "OP-101", "Secondary test passed");
assert.strictEqual(secComp.lifecycle_state, "CONFIRMED_PASS", "[11] Lifecycle state must be CONFIRMED_PASS");
assert.strictEqual(secComp.prediction, resReview.prediction, "[12] Original ML prediction must remain strictly immutable");
console.log("✔ Audit 9-12 Passed: Operator workflow state machine & ML immutability safeguards verified");

// 6. Security Isolation Audit
const frontendDir = path.join(__dirname, '../frontend');
const frontendFiles = fs.readdirSync(frontendDir).filter(f => f.endsWith('.js') || f.endsWith('.html'));
frontendFiles.forEach(file => {
  const content = fs.readFileSync(path.join(frontendDir, file), 'utf-8');
  assert.strictEqual(content.includes("SUPABASE_SERVICE_ROLE_KEY"), false, `Security leak in ${file}`);
  assert.strictEqual(content.includes("SUPABASE_SECRET_KEY"), false, `Security leak in ${file}`);
});
console.log("✔ Audit 13 Passed: Zero secret database keys or service role credentials in client scripts");

console.log("\n=========================================================================");
console.log("ALL ADVERSARIAL ACCEPTANCE AUDITS PASSED SUCCESSFULLY! ✅");
console.log("=========================================================================\n");
