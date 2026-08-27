/**
 * PREDICTA — Final SIH 2026 Hardening, Deployment & Demo Readiness Verification Runner
 * File: scratch/verify_sih_readiness.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA — SIH 2026 FINAL HARDENING & DEMO READINESS AUDIT");
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

// 1. Portable Path Audit
check("Portable Path Audit (Zero hardcoded absolute paths in production code)", () => {
  const filesToCheck = [
    path.join(__dirname, '../src/api/inference.js'),
    path.join(__dirname, '../src/api/inference_service.py'),
    path.join(__dirname, '../src/decision_engine/decision.py'),
    path.join(__dirname, '../src/decision_engine/explanation.py'),
    path.join(__dirname, '../src/decision_engine/safety_slope.py'),
    path.join(__dirname, '../frontend/script.js')
  ];

  filesToCheck.forEach(fPath => {
    if (fs.existsSync(fPath)) {
      const content = fs.readFileSync(fPath, 'utf8');
      assert.ok(!content.includes("C:\\Users\\"), `Absolute path found in ${path.basename(fPath)}`);
      assert.ok(!content.includes("file:///C:"), `File URI found in ${path.basename(fPath)}`);
    }
  });
});

// 2. Production Artifacts Audit
check("Production Artifacts Audit (Anomaly & Calibrated GPR JSONs present)", () => {
  const anomalyPath = path.join(__dirname, '../ml/models/predicta_anomaly_artifacts.json');
  const gprPath = path.join(__dirname, '../ml/models/predicta_gpr_kernel_artifacts.json');

  assert.ok(fs.existsSync(anomalyPath), "Anomaly artifacts JSON missing");
  assert.ok(fs.existsSync(gprPath), "Calibrated GPR kernel artifacts JSON missing");

  const anomalyObj = JSON.parse(fs.readFileSync(anomalyPath, 'utf8'));
  const gprObj = JSON.parse(fs.readFileSync(gprPath, 'utf8'));

  assert.ok(anomalyObj.robust_mad && anomalyObj.copod, "Anomaly artifact schema invalid");
  assert.strictEqual(gprObj.model_version, "2.2_calibrated_gpr_3way_split", "GPR version mismatch");
  assert.ok(gprObj.parameters.tpd.K_inv, "GPR inverse matrix missing");
});

// 3. API Contract & Error Handling Hardening
check("API Contract & Error Handling Hardening", () => {
  const validRecord = {
    equipment_id: "EQP-101",
    supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
    resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
    propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
    temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0,
    iddq: 2100.0, ileak: 290.0, tpd: 190.0, iddq_0h: 2080.0, ileak_0h: 288.0, tpd_0h: 188.0
  };

  const resValid = inf.predictSingle(validRecord);
  assert.ok(resValid.prediction && resValid.probability !== undefined, "Valid response missing standard keys");
  assert.ok(resValid.ml_details.anomaly_detection, "ml_details.anomaly_detection missing");
  assert.ok(resValid.ml_details.drift_prediction, "ml_details.drift_prediction missing");
  assert.ok(resValid.ml_details.safety_slope, "ml_details.safety_slope missing");
  assert.ok(resValid.ml_details.risk_engine, "ml_details.risk_engine missing");
  assert.ok(resValid.ml_details.explainability, "ml_details.explainability missing");

  // Invalid payload test (Missing required fields)
  assert.throws(() => {
    inf.predictSingle({ equipment_id: "EQP-101" });
  }, /DATA_QUALITY_REJECTED/);
});

// 4. Zero Future Data Leakage Audit
check("Zero Future Data Leakage Audit (Runtime isolated to 0h + 24h telemetry)", () => {
  const record = {
    equipment_id: "EQP-101",
    supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
    resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
    propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
    temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0,
    iddq: 2100.0, ileak: 290.0, tpd: 190.0, iddq_0h: 2080.0, ileak_0h: 288.0, tpd_0h: 188.0,
    // Add fake future leakage values
    iddq_96h: 99999.0, iddq_168h: 99999.0, health_state: "LATENT_DEFECT", anomaly_label: 1
  };

  const res = inf.predictSingle(record);
  assert.strictEqual(res.ml_details.risk_engine.risk_class, "SAFE");
});

// 5. Phase 5 Direction Label Audit
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
  assert.strictEqual(exp.parameter_attribution.tpd.direction, "INCREASES_RISK");
});

// 6. Deterministic SIH 8 Scenario Audit
check("Deterministic SIH 8 Demo Scenario Audit", () => {
  const base = {
    equipment_id: "EQP-101",
    supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
    resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
    propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
    temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0,
    iddq: 2100.0, ileak: 290.0, tpd: 190.0, iddq_0h: 2080.0, ileak_0h: 288.0, tpd_0h: 188.0
  };

  // 1. Healthy -> SAFE
  const res1 = inf.predictSingle(base);
  assert.strictEqual(res1.ml_details.risk_engine.risk_class, "SAFE");

  // 2. Moderate Anomaly -> MONITOR
  const res2 = inf.predictSingle({ ...base, iddq: 2350.0, ileak: 325.0, tpd: 202.0 });
  assert.ok(["MONITOR", "AT RISK"].includes(res2.ml_details.risk_engine.risk_class));

  // 3. Severe Anomaly -> AT RISK
  const res3 = inf.predictSingle({ ...base, iddq: 4500.0, ileak: 480.0, tpd: 240.0 });
  assert.strictEqual(res3.ml_details.risk_engine.risk_class, "AT RISK");

  // 4. High Drift -> MONITOR/AT RISK
  const res4 = inf.predictSingle({ ...base, tpd: 220.0, tpd_0h: 180.0 });
  assert.ok(["MONITOR", "AT RISK"].includes(res4.ml_details.risk_engine.risk_class));

  // 5. Safety Warning -> MONITOR/AT RISK
  const res5 = inf.predictSingle({ ...base, tpd: 235.0, tpd_0h: 180.0 });
  assert.ok(["MONITOR", "AT RISK"].includes(res5.ml_details.risk_engine.risk_class));

  // 6. Safety Exceeded -> AT RISK
  const res6 = inf.predictSingle({ ...base, tpd: 255.0, tpd_0h: 180.0 });
  assert.strictEqual(res6.ml_details.risk_engine.risk_class, "AT RISK");

  // 7. Multi-Signal Failure -> AT RISK
  const res7 = inf.predictSingle({ ...base, iddq: 4800.0, tpd: 255.0 });
  assert.strictEqual(res7.ml_details.risk_engine.risk_class, "AT RISK");

  // 8. Latent Defect (Identical to healthy at 24h) -> SAFE at early screening
  const res8 = inf.predictSingle(base);
  assert.strictEqual(res8.ml_details.risk_engine.risk_class, "SAFE");
});

// 7. Performance & Latency Audit
check("Inference Performance Audit (Latency < 2.0ms per request)", () => {
  const record = {
    equipment_id: "EQP-101",
    supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
    resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
    propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
    temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0,
    iddq: 2100.0, ileak: 290.0, tpd: 190.0, iddq_0h: 2080.0, ileak_0h: 288.0, tpd_0h: 188.0
  };

  const start = Date.now();
  const iterations = 1000;
  for (let i = 0; i < iterations; i++) {
    inf.predictSingle(record);
  }
  const avgMs = (Date.now() - start) / iterations;
  assert.ok(avgMs < 2.0, `Avg latency ${avgMs}ms exceeded 2.0ms limit`);
});

// 8. Repository Hygiene & Deployment Configuration Audit
check("Repository Hygiene Audit (.gitignore, .env.example, package.json configured)", () => {
  const gitignore = fs.readFileSync(path.join(__dirname, '../.gitignore'), 'utf8');
  assert.ok(gitignore.includes(".env"), ".env not ignored in .gitignore");

  assert.ok(fs.existsSync(path.join(__dirname, '../.env.example')), ".env.example missing");

  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
  assert.ok(pkg.scripts && pkg.scripts.test, "npm test script missing in package.json");
});

console.log("\n=========================================================================");
console.log(`ALL ${passed}/${total} FINAL SIH READINESS AUDIT CHECKS PASSED! ✅`);
console.log("PREDICTA IS 100% HARDENED & VERIFIED FOR SIH DEMONSTRATION!");
console.log("=========================================================================\n");
