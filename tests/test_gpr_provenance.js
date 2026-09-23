/**
 * PREDICTA SIH 2026 — GPR ARTIFACT PROVENANCE & LINEAGE REGRESSION TEST
 * File: tests/test_gpr_provenance.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

console.log("=========================================================================");
console.log("PREDICTA — GPR PROVENANCE & LINEAGE INTEGRITY TEST");
console.log("=========================================================================\n");

// 1. Verify GPR Artifact Exists and Matches Hash
const gprPath = path.resolve(__dirname, '../ml/models/production/predicta_gpr_kernel_artifacts.json');
assert.ok(fs.existsSync(gprPath), "Production GPR artifact must exist");

const gprBuf = fs.readFileSync(gprPath);
const gprSha = crypto.createHash('sha256').update(gprBuf).digest('hex');
console.log(`✔ GPR Artifact Verified: ${gprPath}`);
console.log(`  Artifact SHA-256: ${gprSha}`);
assert.strictEqual(
  gprSha,
  '1d5fd207ecbd8fed31c09c9e0e8f4655b72f2596ba6c9faf421c7d54fd6a3fcf',
  "GPR artifact SHA-256 must match authoritative value"
);

// 2. Verify Internal Metadata Structure
const gpr = JSON.parse(gprBuf.toString('utf8'));
assert.strictEqual(gpr.model_version, "2.2_calibrated_gpr_3way_split", "Model version must be 2.2_calibrated_gpr_3way_split");
assert.strictEqual(gpr.model_type, "GaussianProcessRegressor_Calibrated", "Model type must be GaussianProcessRegressor_Calibrated");

// 3. Verify Lot Split Metadata
assert.ok(gpr.lot_split, "Lot split metadata must be present");
assert.strictEqual(gpr.lot_split.train_lots, "LOT-SYN-001 through LOT-SYN-030", "Train lots must be 1-30");
assert.strictEqual(gpr.lot_split.calibration_lots, "LOT-SYN-031 through LOT-SYN-035", "Calibration lots must be 31-35");
assert.strictEqual(gpr.lot_split.test_lots, "LOT-SYN-036 through LOT-SYN-050", "Test lots must be 36-50");
console.log("✔ GPR Lot Split Contract Verified (Lots 1-30 Train, 31-35 Cal, 36-50 Test)");

// 4. Verify Parameter Structures (iddq, ileak, tpd)
const expectedParams = ['iddq', 'ileak', 'tpd'];
expectedParams.forEach(param => {
  const pData = gpr.parameters[param];
  assert.ok(pData, `Parameter ${param} must exist in GPR artifact`);
  assert.strictEqual(pData.support_x.length, 60, `${param} must have 60 support vectors`);
  assert.strictEqual(pData.alpha.length, 60, `${param} must have 60 alpha coefficients`);
  assert.strictEqual(pData.K_inv.length, 60, `${param} must have 60x60 K_inv matrix`);
  assert.strictEqual(pData.K_inv[0].length, 60, `${param} K_inv row length must be 60`);
  assert.ok(typeof pData.sigma_obs === 'number' && pData.sigma_obs > 0, `${param} sigma_obs must be positive number`);
  console.log(`✔ Parameter '${param}' Structure Verified (60 support points, K_inv, alpha, sigma_obs=${pData.sigma_obs})`);
});

// 5. Verify Preserved Historical Trainer & Lineage Documentation
const historicalTrainerPath = path.resolve(__dirname, '../ml/training/legacy/train_calibrated_gpr_split.js.historical');
assert.ok(fs.existsSync(historicalTrainerPath), "Historical GPR trainer reference must exist in legacy folder");

const lineageDocPath = path.resolve(__dirname, '../docs/GPR_LINEAGE_AND_PROVENANCE.md');
assert.ok(fs.existsSync(lineageDocPath), "GPR Lineage documentation must exist");

console.log("✔ Historical Trainer & Lineage Documentation Verified");
console.log("\n=========================================================================");
console.log("ALL GPR PROVENANCE & LINEAGE TESTS PASSED! ✅");
console.log("=========================================================================\n");
