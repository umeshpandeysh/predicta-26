/**
 * PREDICTA SIH 2026 — ARTIFACT GOVERNANCE & GPR PRODUCTION INTEGRITY TEST
 * File: tests/test_artifact_governance.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('=========================================================================');
console.log('PREDICTA — PRODUCTION ARTIFACT GOVERNANCE & INTEGRITY TEST');
console.log('=========================================================================\n');

const repoRoot = path.resolve(__dirname, '..');
const prodDir = path.join(repoRoot, 'ml/models/production');
const modelsDir = path.join(repoRoot, 'ml/models');

// 1. Verify Production Manifest Canonical Authority
const manifestPath = path.join(prodDir, 'predicta_production_manifest.json');
assert.ok(fs.existsSync(manifestPath), "Production manifest must exist in ml/models/production/");
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const modelPath = path.join(prodDir, 'predicta_xgboost_model.json');
assert.ok(fs.existsSync(modelPath), "Production XGBoost model must exist in ml/models/production/");
const modelContent = fs.readFileSync(modelPath, 'utf8').replace(/\r\n/g, '\n');
const computedModelSha = crypto.createHash('sha256').update(modelContent, 'utf8').digest('hex');

assert.strictEqual(computedModelSha, manifest.model_sha256, "Manifest model_sha256 must match computed model SHA-256");
console.log("✔ Test 01 Passed: Production manifest SHA-256 integrity verified (" + computedModelSha + ")");

// 2. Verify Production Metadata Checksum Parity
const metaPath = path.join(prodDir, 'predicta_xgboost_metadata.json');
assert.ok(fs.existsSync(metaPath), "Production metadata must exist in ml/models/production/");
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
assert.strictEqual(computedModelSha, meta.model_sha256, "Metadata model_sha256 must match computed model SHA-256");
console.log("✔ Test 02 Passed: Production metadata SHA-256 matches model artifact 100%");

// 3. Verify GPR & Anomaly Artifacts Present in Production Bundle
const prodGprPath = path.join(prodDir, 'predicta_gpr_kernel_artifacts.json');
const rootGprPath = path.join(modelsDir, 'predicta_gpr_kernel_artifacts.json');
assert.ok(fs.existsSync(prodGprPath), "predicta_gpr_kernel_artifacts.json must exist in ml/models/production/");
assert.ok(fs.existsSync(rootGprPath), "predicta_gpr_kernel_artifacts.json must exist in ml/models/");

const prodGprBuf = fs.readFileSync(prodGprPath);
const rootGprBuf = fs.readFileSync(rootGprPath);
assert.ok(prodGprBuf.equals(rootGprBuf), "Production GPR artifact must be byte-identical to models GPR artifact");
console.log("✔ Test 03 Passed: GPR kernel artifacts present and byte-verified in production directory (" + prodGprBuf.length + " bytes)");

// 4. Verify Anomaly Artifacts Present in Production Bundle
const prodAnomPath = path.join(prodDir, 'predicta_anomaly_artifacts.json');
const rootAnomPath = path.join(modelsDir, 'predicta_anomaly_artifacts.json');
assert.ok(fs.existsSync(prodAnomPath), "predicta_anomaly_artifacts.json must exist in ml/models/production/");
assert.ok(fs.existsSync(rootAnomPath), "predicta_anomaly_artifacts.json must exist in ml/models/");

const prodAnomBuf = fs.readFileSync(prodAnomPath);
const rootAnomBuf = fs.readFileSync(rootAnomPath);
assert.ok(prodAnomBuf.equals(rootAnomBuf), "Production anomaly artifact must be byte-identical to models anomaly artifact");
console.log("✔ Test 04 Passed: Anomaly artifacts present and byte-verified in production directory (" + prodAnomBuf.length + " bytes)");

// 5. Verify Inference Service Resolves and Executes GPR & Anomaly Models
const inf = require('../src/api/inference');
const testRecord = {
  test_id: "ART-GOV-001",
  equipment_id: "EQP-101",
  iddq_standby: 10.2,
  supply_voltage: 1.20, output_voltage: 1.19, current: 40.0, leakage_current: 110.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
  propagation_delay: 12.0, setup_time: 1.5, hold_time: 1.0, timing_margin: 3.0,
  temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 10.0
};
const res = inf.predictSingle(testRecord);
assert.ok(res.ml_details.anomaly_detection, "Anomaly detection details must be returned");
assert.ok(res.ml_details.drift_prediction, "GPR drift prediction details must be returned");
assert.ok(res.ml_details.safety_slope, "Safety slope details must be returned");
console.log("✔ Test 05 Passed: Inference service seamlessly executes with governed production artifacts");

console.log('\n=========================================================================');
console.log('ALL ARTIFACT GOVERNANCE TESTS PASSED! ✅');
console.log('=========================================================================\n');
