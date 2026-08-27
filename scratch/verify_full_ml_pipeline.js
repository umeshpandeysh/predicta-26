/**
 * PREDICTA Final End-to-End ML Pipeline & Integration Audit Test Suite
 * File: scratch/verify_full_ml_pipeline.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA FINAL END-TO-END ML PIPELINE INTEGRATION AUDIT");
console.log("=========================================================================\n");

let passed = 0;
let total = 0;

function check(desc, fn) {
  total++;
  try {
    fn();
    console.log(`✔ [PASS] Test ${total.toString().padStart(2, '0')}: ${desc}`);
    passed++;
  } catch (e) {
    console.error(`❌ [FAIL] Test ${total.toString().padStart(2, '0')}: ${desc}`);
    console.error(`   Error: ${e.message}`);
    process.exit(1);
  }
}

// 1. Model Artifact Loading Audit
check("Model Artifacts Audit (Anomaly & Calibrated GPR loaded)", () => {
  const anomalyPath = path.join(__dirname, '../ml/models/predicta_anomaly_artifacts.json');
  const gprPath = path.join(__dirname, '../ml/models/predicta_gpr_kernel_artifacts.json');

  assert.ok(fs.existsSync(anomalyPath), "predicta_anomaly_artifacts.json missing");
  assert.ok(fs.existsSync(gprPath), "predicta_gpr_kernel_artifacts.json missing");

  const anomalyData = JSON.parse(fs.readFileSync(anomalyPath, 'utf8'));
  const gprData = JSON.parse(fs.readFileSync(gprPath, 'utf8'));

  assert.ok(anomalyData.robust_mad && anomalyData.copod, "Anomaly artifacts schema invalid");
  assert.strictEqual(gprData.model_version, "2.2_calibrated_gpr_3way_split", "GPR artifact version mismatch");
  assert.ok(gprData.parameters.tpd.K_inv, "GPR full inverse matrix missing");
});

// 2. Data Leakage Audit
check("Data Leakage Audit (Runtime strictly isolated to 0h + 24h data)", () => {
  const baseRecord = {
    test_id: "LEAKAGE-AUDIT-01",
    equipment_id: "EQP-101",
    supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
    resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
    propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
    temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0,
    iddq: 2100.0, ileak: 290.0, tpd: 190.0, iddq_0h: 2080.0, ileak_0h: 288.0, tpd_0h: 188.0,
    // Add fake future leakage values
    iddq_96h: 99999.0, iddq_168h: 99999.0, health_state: "LATENT_DEFECT", anomaly_label: 1
  };

  const resClean = inf.predictSingle(baseRecord);
  assert.strictEqual(resClean.ml_details.risk_engine.risk_class, "SAFE", "Future leakage should not mutate runtime decision!");
});

// 3. Case Study A: Healthy Component
check("Case Study A (Healthy Component -> SAFE / PASS)", () => {
  const record = {
    equipment_id: "EQP-101",
    supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
    resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
    propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
    temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0,
    iddq: 2100.0, ileak: 290.0, tpd: 190.0, iddq_0h: 2080.0, ileak_0h: 288.0, tpd_0h: 188.0
  };
  const res = inf.predictSingle(record);
  assert.strictEqual(res.ml_details.risk_engine.risk_class, "SAFE");
  assert.strictEqual(res.ml_details.risk_engine.decision.action, "PROCEED_STANDARD_SCREENING");
});

// 4. Case Study B: Moderate Anomaly
check("Case Study B (Moderate Anomaly -> MONITOR)", () => {
  const record = {
    equipment_id: "EQP-101",
    supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
    resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
    propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
    temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0,
    iddq: 2350.0, ileak: 325.0, tpd: 202.0, iddq_0h: 2080.0, ileak_0h: 288.0, tpd_0h: 188.0
  };
  const res = inf.predictSingle(record);
  assert.ok(["MONITOR", "AT RISK"].includes(res.ml_details.risk_engine.risk_class));
});

// 5. Case Study C: Severe Anomaly
check("Case Study C (Severe Anomaly -> AT RISK / REJECT)", () => {
  const record = {
    equipment_id: "EQP-101",
    supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
    resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
    propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
    temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0,
    iddq: 4500.0, ileak: 480.0, tpd: 240.0, iddq_0h: 2080.0, ileak_0h: 288.0, tpd_0h: 188.0
  };
  const res = inf.predictSingle(record);
  assert.strictEqual(res.ml_details.risk_engine.risk_class, "AT RISK");
  assert.strictEqual(res.ml_details.risk_engine.decision.action, "QUARANTINE_REJECT_RECOMMENDATION");
});

// 6. Case Study F: Safety Boundary EXCEEDED
check("Case Study F (Safety Boundary EXCEEDED -> AT RISK Override)", () => {
  const record = {
    equipment_id: "EQP-101",
    supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
    resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
    propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
    temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0,
    iddq: 2100.0, ileak: 290.0, tpd: 255.0, iddq_0h: 2080.0, ileak_0h: 288.0, tpd_0h: 188.0
  };
  const res = inf.predictSingle(record);
  assert.strictEqual(res.ml_details.risk_engine.risk_class, "AT RISK");
});

// 7. Phase 5 Direction Label Audit
check("Phase 5 Direction Label Audit (INCREASES_RISK when risk > 0)", () => {
  const record = {
    equipment_id: "EQP-101",
    supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
    resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
    propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
    temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0,
    iddq: 2100.0, ileak: 290.0, tpd: 190.0, iddq_0h: 2080.0, ileak_0h: 288.0, tpd_0h: 188.0
  };
  const res = inf.predictSingle(record);
  const exp = res.ml_details.explainability;
  assert.strictEqual(exp.parameter_attribution.tpd.direction, "INCREASES_RISK", "Direction for tpd (risk > 0) must be INCREASES_RISK");
});

// 8. Performance Benchmark
check("Inference Performance Audit (Single request < 5ms)", () => {
  const record = {
    equipment_id: "EQP-101",
    supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
    resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
    propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
    temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0,
    iddq: 2100.0, ileak: 290.0, tpd: 190.0, iddq_0h: 2080.0, ileak_0h: 288.0, tpd_0h: 188.0
  };
  const start = Date.now();
  for (let i = 0; i < 100; i++) {
    inf.predictSingle(record);
  }
  const elapsed = (Date.now() - start) / 100;
  assert.ok(elapsed < 5.0, `Avg request latency ${elapsed}ms exceeded 5.0ms threshold`);
});

console.log("\n=========================================================================");
console.log(`ALL ${passed}/${total} PIPELINE INTEGRATION AUDIT CHECKS PASSED! ✅`);
console.log("=========================================================================\n");
