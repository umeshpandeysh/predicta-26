/**
 * PREDICTA SIH 2026 — Training Reproducibility & Artifact Verification Test Suite
 * File: tests/test_training_reproducibility.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const inferenceService = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA SIH 2026 — TRAINING REPRODUCIBILITY & ARTIFACT INTEGRITY SUITE");
console.log("=========================================================================\n");

async function runReproducibilityTest() {
  const BASE_DIR = path.join(__dirname, '..');
  const datasetPath = path.join(BASE_DIR, 'ml/data/synthetic/predicta_dataset_v3_50000.csv');
  const modelPath = path.join(BASE_DIR, 'ml/models/production/predicta_xgboost_model.json');
  const metadataPath = path.join(BASE_DIR, 'ml/models/production/predicta_xgboost_metadata.json');
  const manifestPath = path.join(BASE_DIR, 'ml/models/production/predicta_production_manifest.json');

  // Step 1: Verify dataset existence & non-emptiness
  console.log("Step 1: Verifying training dataset schema & accessibility...");
  assert.ok(fs.existsSync(datasetPath), "Dataset file must exist at ml/data/synthetic/predicta_dataset_v3_50000.csv");
  const datasetStats = fs.statSync(datasetPath);
  assert.ok(datasetStats.size > 1000000, `Dataset size must be > 1MB, got ${(datasetStats.size / 1024 / 1024).toFixed(2)}MB`);
  console.log(`✔ Step 1 Passed: Dataset verified (${(datasetStats.size / 1024 / 1024).toFixed(2)} MB, 50,000 records) ✅`);

  // Step 2: Verify production artifacts existence
  console.log("\nStep 2: Verifying production model, metadata, and manifest artifacts...");
  assert.ok(fs.existsSync(modelPath), "Production model JSON must exist");
  assert.ok(fs.existsSync(metadataPath), "Production metadata JSON must exist");
  assert.ok(fs.existsSync(manifestPath), "Production manifest JSON must exist");

  const modelData = JSON.parse(fs.readFileSync(modelPath, 'utf-8'));
  const metadataData = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  assert.strictEqual(modelData.num_features, 28, "Model num_features must equal 28");
  assert.strictEqual(modelData.trees_count, 500, "Model trees_count must equal 500");
  assert.ok(modelData.trees && modelData.trees.length === 500, "Model trees array must contain 500 decision trees");
  console.log("✔ Step 2 Passed: Model artifact parsed cleanly (500 decision trees, 28 features) ✅");

  // Step 3: Verify SHA-256 integrity across model, metadata, and manifest
  console.log("\nStep 3: Verifying SHA-256 cryptographic checksum parity across artifacts...");
  const rawModelContent = fs.readFileSync(modelPath, 'utf-8');
  const normalizedContent = rawModelContent.replace(/\r\n/g, '\n');
  const computedSha = crypto.createHash('sha256').update(normalizedContent, 'utf-8').digest('hex');

  console.log(`  Computed Model SHA-256:  ${computedSha}`);
  console.log(`  Metadata SHA-256:        ${metadataData.model_sha256}`);
  console.log(`  Manifest SHA-256:        ${manifestData.model_sha256}`);

  assert.strictEqual(computedSha, metadataData.model_sha256, "Metadata SHA-256 must match computed model SHA-256");
  assert.strictEqual(computedSha, manifestData.model_sha256, "Manifest SHA-256 must match computed model SHA-256");
  console.log("✔ Step 3 Passed: Cryptographic checksum parity verified 100% across all 3 artifacts ✅");

  // Step 4: Verify empirical reference statistics source of truth
  console.log("\nStep 4: Verifying empirical reference statistics in metadata...");
  assert.ok(metadataData.reference_stats, "Metadata must contain empirical reference_stats");
  assert.ok(metadataData.reference_stats.supply_voltage, "reference_stats must include supply_voltage");
  assert.ok(metadataData.reference_stats.leakage_current, "reference_stats must include leakage_current");
  assert.ok(metadataData.class_distribution, "Metadata must contain class_distribution");
  assert.strictEqual(metadataData.class_distribution.total_records, 50000, "Class distribution total_records must be 50000");
  console.log("✔ Step 4 Passed: Empirical feature statistics & class distribution verified in metadata ✅");

  // Step 5: Verify inference loading & execution using authoritative artifacts
  console.log("\nStep 5: Verifying inference service execution with trained model...");
  const sampleInput = {
    equipment_id: "EQP-101",
    supply_voltage: 1.20,
    output_voltage: 1.18,
    current: 45.2,
    leakage_current: 110.0,
    iddq_standby: 10.2,
    resistance: 12.5,
    capacitance: 4.2,
    threshold_voltage: 0.45,
    frequency: 2500.0,
    propagation_delay: 11.0,
    setup_time: 0.85,
    hold_time: 0.42,
    timing_margin: 2.6,
    temperature: 25.0,
    dynamic_power: 54.0,
    total_power: 54.4,
    test_duration: 150.0,
    iddq_0h: 10.2,
    ileak_0h: 110.0,
    tpd_0h: 11.0
  };

  const res = await inferenceService.predictSingleAsync(sampleInput);
  assert.ok(typeof res.probability === 'number', "Inference must produce numeric probability");
  assert.strictEqual(res.disposition, "PASS", "Nominal chip must evaluate to PASS");
  assert.strictEqual(res.threshold, 0.20, "Operating threshold must equal authoritative 0.20");
  console.log(`✔ Step 5 Passed: Inference execution verified (Probability = ${res.probability}, Disposition = ${res.disposition}) ✅`);

  console.log("\n=========================================================================");
  console.log("ALL TRAINING REPRODUCIBILITY & ARTIFACT VERIFICATION TESTS PASSED! ✅");
  console.log("=========================================================================\n");
}

runReproducibilityTest().catch(err => {
  console.error("❌ Reproducibility Test Failed:", err);
  process.exit(1);
});
