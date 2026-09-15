/**
 * PREDICTA SIH 2026 — VERSION ARCHITECTURE GOVERNANCE TEST SUITE
 * File: tests/test_version_governance.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const inf = require('../src/api/inference');

console.log('=========================================================================');
console.log('PREDICTA — VERSION ARCHITECTURE GOVERNANCE TEST');
console.log('=========================================================================\n');

// 1. Manifest Version Governance
const manifestPath = path.resolve(__dirname, '../ml/models/production/predicta_production_manifest.json');
assert.ok(fs.existsSync(manifestPath), "Production manifest must exist");
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.strictEqual(manifest.active_version, "2.0_production", "Manifest active_version must be 2.0_production");
console.log("✔ Test 01 Passed: Production manifest version authority validated");

// 2. Inference Service Prediction Version Contract
const record = {
  test_id: "VER-GOV-001", equipment_id: "EQP-101", iddq_standby: 10.2,
  supply_voltage: 1.20, output_voltage: 1.19, current: 40.0, leakage_current: 110.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
  propagation_delay: 12.0, setup_time: 1.5, hold_time: 1.0, timing_margin: 3.0,
  temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 10.0
};
const res = inf.predictSingle(record);
assert.strictEqual(res.model_version, "2.0_production", "Inference response model_version must be 2.0_production");
assert.strictEqual(res.system_release_version, "2.0.0", "Inference response system_release_version must be 2.0.0");
assert.strictEqual(res.feature_schema_version, "28_features_v2", "Inference response feature_schema_version must be 28_features_v2");
console.log("✔ Test 02 Passed: Inference response exposes unambiguous multi-tier version specifications");

// 3. System Status Version Contract
const status = inf.getSystemStatus();
assert.strictEqual(status.model_version, "2.0_production", "System status model_version must be 2.0_production");
assert.strictEqual(status.system_release_version, "2.0.0", "System status system_release_version must be 2.0.0");
assert.strictEqual(status.feature_schema_version, "28_features_v2", "System status feature_schema_version must be 28_features_v2");
assert.strictEqual(status.manifest_version, "2.0.0", "System status manifest_version must be 2.0.0");
console.log("✔ Test 03 Passed: System status contract exposes complete version architecture");

console.log('\n=========================================================================');
console.log('ALL VERSION GOVERNANCE TESTS PASSED! ✅');
console.log('=========================================================================\n');
