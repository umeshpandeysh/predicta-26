/**
 * PREDICTA — AUDIT-FIX-01 Automated Threshold Contract Test Suite
 * File: tests/test_threshold_contract.js
 * 
 * Objective: Verify single-source-of-truth threshold integrity across metadata, API engines,
 * and contract boundaries:
 *   - Metadata operating threshold === 0.20
 *   - Zero 0.45 fallback paths in active API/frontend code
 *   - Probability 0.19 -> PASS
 *   - Probability 0.20 -> FAIL
 *   - Probability 0.21 -> FAIL
 */

const fs = require('fs');
const path = require('path');
const inferenceService = require('../src/api/inference');

function runThresholdContractTests() {
  console.log("=========================================================================");
  console.log("PREDICTA AUDIT-FIX-01 — THRESHOLD CONTRACT TEST SUITE");
  console.log("=========================================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`✔ Test ${totalTests.toString().padStart(2, '0')} Passed: ${message}`);
      passedTests++;
    } else {
      console.error(`✖ Test ${totalTests.toString().padStart(2, '0')} FAILED: ${message}`);
      process.exit(1);
    }
  }

  // 1. Authoritative Metadata Check
  const metaPath = path.join(__dirname, '../ml/models/predicta_xgboost_v2_metadata.json');
  const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  const metaThreshold = Number(metadata.operating_threshold || (metadata.hyperparameters && metadata.hyperparameters.operating_threshold));
  assert(metaThreshold === 0.20, `Authoritative metadata operating threshold must be exactly 0.20 (Found: ${metaThreshold})`);

  // 2. Active API Service Threshold Check
  assert(inferenceService.operatingThreshold === 0.20, `Inference service operatingThreshold must equal 0.20 (Found: ${inferenceService.operatingThreshold})`);

  // 3. Fallback Code Audit (Ensure no 0.45 model thresholds remain in frontend clients)
  const apiJsContent = fs.readFileSync(path.join(__dirname, '../api.js'), 'utf-8');
  const frontendApiJsContent = fs.readFileSync(path.join(__dirname, '../frontend/api.js'), 'utf-8');
  
  assert(!apiJsContent.includes("threshold: 0.45"), "api.js must not contain fallback threshold: 0.45");
  assert(!apiJsContent.includes("prob >= 0.45"), "api.js must not contain prob >= 0.45 decision rule");
  assert(!frontendApiJsContent.includes("threshold: 0.45"), "frontend/api.js must not contain fallback threshold: 0.45");
  assert(!frontendApiJsContent.includes("prob >= 0.45"), "frontend/api.js must not contain prob >= 0.45 decision rule");

  // 4. Contract Boundary Tests (0.19 -> PASS, 0.20 -> FAIL, 0.21 -> FAIL)
  const thresh = inferenceService.operatingThreshold;
  
  const pred19 = (0.19 >= thresh) ? "FAIL" : "PASS";
  assert(pred19 === "PASS", `Probability 0.19 under threshold 0.20 must evaluate to PASS (Found: ${pred19})`);

  const pred20 = (0.20 >= thresh) ? "FAIL" : "PASS";
  assert(pred20 === "FAIL", `Probability 0.20 at threshold 0.20 must evaluate to FAIL (Found: ${pred20})`);

  const pred21 = (0.21 >= thresh) ? "FAIL" : "PASS";
  assert(pred21 === "FAIL", `Probability 0.21 above threshold 0.20 must evaluate to FAIL (Found: ${pred21})`);

  // 5. Model SHA-256 Checksum Verification
  const crypto = require('crypto');
  const modelPath = path.join(__dirname, '../ml/models/predicta_xgboost_v2.json');
  const modelBytes = fs.readFileSync(modelPath);
  const sha256 = crypto.createHash('sha256').update(modelBytes).digest('hex');
  const expectedSha = "2e7df9f1e2ad3cad66c1556e16e6b1694b167b6b04323387f761d4a1cda021ed";
  assert(sha256 === expectedSha, `Production model SHA-256 must match certified ${expectedSha} (Found: ${sha256})`);

  console.log("\n=========================================================================");
  console.log(`ALL ${passedTests}/${totalTests} THRESHOLD CONTRACT TESTS PASSED SUCCESSFULLY! ✅`);
  console.log("=========================================================================\n");
}

runThresholdContractTests();
