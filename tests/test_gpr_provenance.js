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

// 1. Verify GPR Artifact Cryptographic Manifest Binding & Integrity
const manifestPath = path.resolve(__dirname, '../ml/models/production/predicta_production_manifest.json');
assert.ok(fs.existsSync(manifestPath), "Production manifest must exist at ml/models/production/predicta_production_manifest.json");

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.ok(manifest.models && manifest.models.drift_forecasting, "Manifest must contain models.drift_forecasting section");

const manifestGprRelPath = manifest.models.drift_forecasting.file;
assert.ok(manifestGprRelPath, "Manifest must declare drift_forecasting.file");
assert.strictEqual(manifestGprRelPath, "ml/models/production/predicta_gpr_kernel_artifacts.json", "Manifest GPR relative path must be ml/models/production/predicta_gpr_kernel_artifacts.json");

const manifestGprSha = manifest.models.drift_forecasting.sha256;
assert.ok(manifestGprSha, "Manifest must declare drift_forecasting.sha256");
assert.strictEqual(
  manifestGprSha,
  '1d5fd207ecbd8fed31c09c9e0e8f4655b72f2596ba6c9faf421c7d54fd6a3fcf',
  "Manifest drift_forecasting.sha256 must match authoritative GPR SHA-256"
);

const gprPath = path.resolve(__dirname, '..', manifestGprRelPath);
assert.ok(fs.existsSync(gprPath), `Production GPR artifact must exist at resolved path: ${gprPath}`);

// Direct byte-level hashing (NO re-serialization or normalization)
const gprBuf = fs.readFileSync(gprPath);
const gprSha = crypto.createHash('sha256').update(gprBuf).digest('hex');
console.log(`✔ GPR Artifact Verified: ${gprPath}`);
console.log(`  Actual Byte SHA-256: ${gprSha}`);
console.log(`  Manifest Declared SHA-256: ${manifestGprSha}`);

assert.strictEqual(
  gprSha,
  manifestGprSha,
  `GPR computed SHA-256 (${gprSha}) must match manifest declared SHA-256 (${manifestGprSha})`
);

// 2. Cryptographic Governance Enforcement Suite (Negative & Boundary Tests)
function verifyGprGovernanceBinding(manifestObj, baseDir) {
  if (!manifestObj.models || !manifestObj.models.drift_forecasting) {
    throw new Error("GOVERNANCE_ERROR: Manifest missing 'models.drift_forecasting' section");
  }
  const relPath = manifestObj.models.drift_forecasting.file;
  if (!relPath) {
    throw new Error("GOVERNANCE_ERROR: Manifest missing 'file' attribute in drift_forecasting");
  }
  const expectedSha = manifestObj.models.drift_forecasting.sha256;
  if (!expectedSha) {
    throw new Error("GOVERNANCE_ERROR: Manifest missing 'sha256' cryptographic binding in drift_forecasting");
  }
  const targetPath = path.resolve(baseDir, relPath);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`GOVERNANCE_ERROR: GPR artifact file not found at declared path: ${targetPath}`);
  }
  const rawBytes = fs.readFileSync(targetPath);
  const actualSha = crypto.createHash('sha256').update(rawBytes).digest('hex');
  if (actualSha !== expectedSha) {
    throw new Error(`GOVERNANCE_ERROR: GPR SHA-256 mismatch! Expected: ${expectedSha}, Actual: ${actualSha}`);
  }
  return { valid: true, sha256: actualSha };
}

// Positive Case: Canonical Manifest & Resolved GPR
const govResult = verifyGprGovernanceBinding(manifest, path.resolve(__dirname, '..'));
assert.ok(govResult.valid, "Governance verification must succeed for canonical manifest");
console.log("✔ Positive Governance Test Passed: Canonical GPR manifest binding validated");

// Negative Test 0: In-memory wrong SHA rejection
const wrongSha = '0'.repeat(64);
assert.notStrictEqual(gprSha, wrongSha, "Calculated GPR SHA must never match arbitrary/zero hash");
console.log("✔ Negative Test 0 Passed: Deliberately mismatched SHA rejected");

// Negative Test A: Tampered / In-Memory Expected SHA Mismatch
assert.throws(() => {
  const tamperedManifest = JSON.parse(JSON.stringify(manifest));
  tamperedManifest.models.drift_forecasting.sha256 = '0'.repeat(64);
  verifyGprGovernanceBinding(tamperedManifest, path.resolve(__dirname, '..'));
}, /GOVERNANCE_ERROR: GPR SHA-256 mismatch/);
console.log("✔ Negative Test A Passed: Tampered SHA-256 rejected");

// Negative Test B: Missing SHA-256 in Manifest
assert.throws(() => {
  const missingShaManifest = JSON.parse(JSON.stringify(manifest));
  delete missingShaManifest.models.drift_forecasting.sha256;
  verifyGprGovernanceBinding(missingShaManifest, path.resolve(__dirname, '..'));
}, /GOVERNANCE_ERROR: Manifest missing 'sha256'/);
console.log("✔ Negative Test B Passed: Missing manifest SHA-256 rejected");

// Negative Test C: Unresolvable / Missing Artifact Path
assert.throws(() => {
  const missingPathManifest = JSON.parse(JSON.stringify(manifest));
  missingPathManifest.models.drift_forecasting.file = 'ml/models/production/non_existent_gpr_file.json';
  verifyGprGovernanceBinding(missingPathManifest, path.resolve(__dirname, '..'));
}, /GOVERNANCE_ERROR: GPR artifact file not found/);
console.log("✔ Negative Test C Passed: Unresolvable artifact path rejected");

// 3. Verify Internal Metadata Structure
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
