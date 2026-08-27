/**
 * PREDICTA — Final Production & Deployment Readiness Verification Test Suite
 * File: scratch/verify_production_readiness.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA — PRODUCTION & DEPLOYMENT READINESS VERIFICATION");
console.log("=========================================================================\n");

let passed = 0;
let total = 0;

function check(desc, fn) {
  total++;
  try {
    fn();
    console.log(`[PASS] Check ${total.toString().padStart(2, '0')}: ${desc}`);
    passed++;
  } catch (e) {
    console.error(`[FAIL] Check ${total.toString().padStart(2, '0')}: ${desc}`);
    console.error(`       Error: ${e.message}`);
    process.exit(1);
  }
}

// 1. Production Model Artifacts Audit
check("Production ML Artifacts Availability & Schema", () => {
  const anomalyPath = path.join(__dirname, '../ml/models/predicta_anomaly_artifacts.json');
  const gprPath = path.join(__dirname, '../ml/models/predicta_gpr_kernel_artifacts.json');

  assert.ok(fs.existsSync(anomalyPath), "Anomaly artifacts JSON missing");
  assert.ok(fs.existsSync(gprPath), "GPR kernel artifacts JSON missing");

  const anomalyObj = JSON.parse(fs.readFileSync(anomalyPath, 'utf8'));
  const gprObj = JSON.parse(fs.readFileSync(gprPath, 'utf8'));

  assert.ok(anomalyObj.robust_mad && anomalyObj.copod, "Anomaly artifact schema invalid");
  assert.strictEqual(gprObj.model_version, "2.2_calibrated_gpr_3way_split", "GPR model version mismatch");
  assert.ok(gprObj.parameters.tpd.K_inv, "GPR inverse matrix missing");
});

// 2. Production API Response Contract Hardening
check("API Response Schema Contract Hardening", () => {
  const validRecord = {
    equipment_id: "EQP-101",
    supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
    resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
    propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
    temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0,
    iddq: 2100.0, ileak: 290.0, tpd: 190.0, iddq_0h: 2080.0, ileak_0h: 288.0, tpd_0h: 188.0
  };

  const res = inf.predictSingle(validRecord);
  assert.ok(res.trace_id && res.trace_id.startsWith("PRED-2026-"), "trace_id missing");
  assert.ok(res.prediction && res.probability !== undefined, "Core prediction fields missing");
  assert.ok(res.ml_details.anomaly_detection, "ml_details.anomaly_detection missing");
  assert.ok(res.ml_details.drift_prediction, "ml_details.drift_prediction missing");
  assert.ok(res.ml_details.safety_slope, "ml_details.safety_slope missing");
  assert.ok(res.ml_details.risk_engine, "ml_details.risk_engine missing");
  assert.ok(res.ml_details.explainability, "ml_details.explainability missing");
});

// 3. Zero Future-Data Leakage Verification
check("Zero Future-Data Runtime Leakage Isolation", () => {
  const baseRecord = {
    equipment_id: "EQP-101",
    supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
    resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
    propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
    temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0,
    iddq: 2100.0, ileak: 290.0, tpd: 190.0, iddq_0h: 2080.0, ileak_0h: 288.0, tpd_0h: 188.0,
    // Add fake future leakage values
    iddq_96h: 99999.0, iddq_168h: 99999.0, health_state: "LATENT_DEFECT", anomaly_label: 1
  };

  const res = inf.predictSingle(baseRecord);
  assert.strictEqual(res.ml_details.risk_engine.risk_class, "SAFE");
});

// 4. Deterministic SIH Profile Profiles
check("Deterministic SIH Profile Profiles (Healthy, Moderate, Severe, Safety Exceeded)", () => {
  const base = {
    equipment_id: "EQP-101",
    supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
    resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
    propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
    temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0,
    iddq: 2100.0, ileak: 290.0, tpd: 190.0, iddq_0h: 2080.0, ileak_0h: 288.0, tpd_0h: 188.0
  };

  const resHealthy = inf.predictSingle(base);
  assert.strictEqual(resHealthy.ml_details.risk_engine.risk_class, "SAFE");

  const resMod = inf.predictSingle({ ...base, iddq: 2350.0, ileak: 325.0, tpd: 202.0 });
  assert.ok(["MONITOR", "AT RISK"].includes(resMod.ml_details.risk_engine.risk_class));

  const resSev = inf.predictSingle({ ...base, iddq: 4500.0, ileak: 480.0, tpd: 240.0 });
  assert.strictEqual(resSev.ml_details.risk_engine.risk_class, "AT RISK");

  const resExc = inf.predictSingle({ ...base, tpd: 255.0, tpd_0h: 180.0 });
  assert.strictEqual(resExc.ml_details.risk_engine.risk_class, "AT RISK");
});

// 5. Phase 5 Parameter Attribution & Direction Labeling
check("Phase 5 Parameter Attribution Direction Audit", () => {
  const base = {
    equipment_id: "EQP-101",
    supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
    resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
    propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
    temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0,
    iddq: 2100.0, ileak: 290.0, tpd: 190.0, iddq_0h: 2080.0, ileak_0h: 288.0, tpd_0h: 188.0
  };
  const res = inf.predictSingle(base);
  const exp = res.ml_details.explainability;
  assert.strictEqual(exp.parameter_attribution.tpd.direction, "INCREASES_RISK");
});

// 6. Portable Paths & Deployment Configuration
check("Serverless & Deployment Configuration Hygiene", () => {
  const vercelJsonPath = path.join(__dirname, '../vercel.json');
  assert.ok(fs.existsSync(vercelJsonPath), "vercel.json missing");

  const serverlessHandler = path.join(__dirname, '../api/index.js');
  assert.ok(fs.existsSync(serverlessHandler), "api/index.js serverless handler missing");
});

console.log("\n=========================================================================");
console.log(`ALL ${passed}/${total} PRODUCTION & DEPLOYMENT CHECKS PASSED! ✅`);
console.log("=========================================================================\n");
