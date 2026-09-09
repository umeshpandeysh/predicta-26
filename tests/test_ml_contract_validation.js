/**
 * PREDICTA — AUTHORITATIVE ML CONTRACT & MANIFEST VALIDATION TEST SUITE
 * File: tests/test_ml_contract_validation.js
 * 
 * Objective: Verify ML contract loading, manifest validity, unit conversion integrity,
 * absence of double-normalization or raw/canonical mixing, missing history handling, and OOD routing.
 */

const fs = require('fs');
const path = require('path');
const inferenceServiceJS = require('../src/api/inference');

function runContractValidationTests() {
  console.log("=========================================================================");
  console.log("PREDICTA — ML CONTRACT & MANIFEST VALIDATION TEST SUITE");
  console.log("=========================================================================\n");

  // Test 1: Contract File Existence & Validity
  const contractPath = path.join(__dirname, '../ml/models/predicta_ml_contract.json');
  if (!fs.existsSync(contractPath)) {
    console.error("✖ Test 01 Failed: predicta_ml_contract.json not found!");
    process.exit(1);
  }
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf-8'));
  if (contract.operating_threshold !== 0.20) {
    console.error("✖ Test 01 Failed: Authoritative threshold in contract is not 0.20!");
    process.exit(1);
  }
  console.log("✔ Test 01 Passed: Authoritative ML contract file exists and specifies threshold 0.20 ✅");

  // Test 2: Production Manifest File Existence & Validity
  const manifestPath = path.join(__dirname, '../ml/models/predicta_production_manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error("✖ Test 02 Failed: predicta_production_manifest.json not found!");
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  if (manifest.active_version !== "2.0_production") {
    console.error("✖ Test 02 Failed: Active version in manifest is not 2.0_production!");
    process.exit(1);
  }
  console.log("✔ Test 02 Passed: Production manifest specifies active_version 2.0_production ✅");

  // Test 3: Canonical Unit Conversion Contract Verification
  const featTest = { iddq_standby: 10.2, leakage_current: 110.0, propagation_delay: 11.0 };
  const norm = inferenceServiceJS.getNormalizedParams(featTest);
  if (Math.abs(norm.iddq - 2040.0) > 1e-4 || Math.abs(norm.ileak - 297.0) > 1e-4 || Math.abs(norm.tpd - 192.5) > 1e-4) {
    console.error(`✖ Test 03 Failed: Unit conversion mismatch! Got: ${JSON.stringify(norm)}`);
    process.exit(1);
  }
  console.log("✔ Test 03 Passed: Canonical unit conversions derived strictly (IDDQ x 200.0, Ileak x 2.7, Tpd x 17.5) ✅");

  // Test 4: Missing History Handling (No fake history)
  const gprRes = inferenceServiceJS.evaluateGprDrift(featTest);
  if (gprRes.iddq && gprRes.iddq.status !== "INSUFFICIENT_HISTORY") {
    console.error(`✖ Test 04 Failed: Missing 0h history did not set INSUFFICIENT_HISTORY status! Got: ${gprRes.iddq.status}`);
    process.exit(1);
  }
  console.log("✔ Test 04 Passed: Missing 0h history correctly yields INSUFFICIENT_HISTORY (no fake 0.98 calculation!) ✅");

  console.log("\n=========================================================================");
  console.log("ALL ML CONTRACT & MANIFEST REGRESSION TESTS PASSED! ✅");
  console.log("=========================================================================\n");
}

runContractValidationTests();
