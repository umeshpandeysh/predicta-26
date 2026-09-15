/**
 * PREDICTA SIH 2026 — Data & Evaluation Foundation Node.js Parity Suite
 * File: tests/test_data_foundation.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  computeFileSha256,
  validateDatasetHash,
  validateTemporalLeakage,
  validateSplitDisjointness
} = require('../src/data/validator');

console.log('=========================================================================');
console.log('PREDICTA SIH 2026 — DATA & EVALUATION FOUNDATION PARITY SUITE');
console.log('=========================================================================\n');

// 1. Validate Dataset Manifest
console.log('Step 1: Verifying ml/data/dataset_manifest.json...');
const manifestPath = path.resolve(__dirname, '../ml/data/dataset_manifest.json');
assert.ok(fs.existsSync(manifestPath), 'dataset_manifest.json must exist');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assert.strictEqual(manifest.authority_level, 'AUTHORITATIVE_DATASET_MANIFEST');
const primary = manifest.primary_latent_trajectory_dataset;
assert.ok(primary, 'Must contain primary_latent_trajectory_dataset');
assert.strictEqual(primary.is_synthetic, true, 'Must disclose synthetic nature');
assert.strictEqual(primary.is_externally_validated, false, 'Must not claim external validation');

const datasetPath = path.resolve(__dirname, '..', primary.dataset_path);
const hashRes = validateDatasetHash(datasetPath, primary.dataset_sha256);
assert.strictEqual(hashRes.passed, true, `Dataset SHA-256 mismatch: ${hashRes.error}`);
console.log(`✔ Step 1 Passed: Dataset manifest & SHA-256 verified (${hashRes.hash.slice(0, 16)}...)`);

// 2. Validate Feature Contract
console.log('\nStep 2: Verifying ml/data/feature_contract.json...');
const contractPath = path.resolve(__dirname, '../ml/data/feature_contract.json');
assert.ok(fs.existsSync(contractPath), 'feature_contract.json must exist');
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

assert.strictEqual(contract.authority_level, 'AUTHORITATIVE_FEATURE_CONTRACT');
const earlyFeatures = contract.features.early_observable.map(f => f.name);
const leakRes = validateTemporalLeakage(earlyFeatures, contract.forbidden_leakage_tokens);
assert.strictEqual(leakRes.passed, true, `Temporal leakage detected: ${leakRes.error}`);
console.log(`✔ Step 2 Passed: Feature contract verified with ${earlyFeatures.length} safe early features`);

// 3. Validate Split Manifest
console.log('\nStep 3: Verifying ml/data/split_manifest.json...');
const splitPath = path.resolve(__dirname, '../ml/data/split_manifest.json');
assert.ok(fs.existsSync(splitPath), 'split_manifest.json must exist');
const splitManifest = JSON.parse(fs.readFileSync(splitPath, 'utf8'));

assert.strictEqual(splitManifest.authority_level, 'AUTHORITATIVE_SPLIT_MANIFEST');
assert.strictEqual(splitManifest.split_strategy, 'LOT_HELD_OUT_DISJOINT');

const trainLots = splitManifest.lots.train;
const valLots = splitManifest.lots.validation;
const testLots = splitManifest.lots.test;

assert.strictEqual(trainLots.length, 35);
assert.strictEqual(valLots.length, 7);
assert.strictEqual(testLots.length, 8);

const splitDisjoint = validateSplitDisjointness(trainLots, valLots, testLots);
assert.strictEqual(splitDisjoint.passed, true, `Lot overlap in split manifest: ${splitDisjoint.error}`);
console.log('✔ Step 3 Passed: Split manifest verified with 0 lot leakage');

// 4. Test Temporal Leakage Detector on Synthetic Bad Input
console.log('\nStep 4: Testing temporal leakage detector defense...');
const badFeatures = ['iddq_0h', 'tpd_168h_leak', 'future_prediction'];
const badLeakRes = validateTemporalLeakage(badFeatures);
assert.strictEqual(badLeakRes.passed, false, 'Validator must catch 168h and future tokens');
console.log('✔ Step 4 Passed: Temporal leakage detector catches simulated attacks');

// 5. Test Split Disjointness Detector on Overlapping Input
console.log('\nStep 5: Testing split disjointness detector defense...');
const badSplit = validateSplitDisjointness(['LOT-001', 'LOT-002'], ['LOT-003'], ['LOT-001', 'LOT-004']);
assert.strictEqual(badSplit.passed, false, 'Validator must catch overlapping lots');
console.log('✔ Step 5 Passed: Split disjointness detector catches simulated lot overlap');

console.log('\n=========================================================================');
console.log('ALL DATA & EVALUATION FOUNDATION PARITY TESTS PASSED! ✅');
console.log('=========================================================================\n');
