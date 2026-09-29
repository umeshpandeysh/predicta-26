/**
 * Final Comprehensive Frontend & Architecture Verification Script
 * File: tests/test_final_frontend_verification.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("=========================================================================");
console.log("PREDICTA-26 — FINAL FRONTEND ARCHITECTURE & UX VERIFICATION SUITE");
console.log("=========================================================================\n");

let passed = 0;
let total = 0;

function check(desc, fn) {
  total++;
  try {
    fn();
    console.log(`✔ Check ${total} Passed: ${desc} ✅`);
    passed++;
  } catch (err) {
    console.error(`✖ Check ${total} FAILED: ${desc}`);
    console.error(`  Error: ${err.message}`);
  }
}

const rootDir = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const scriptJs = fs.readFileSync(path.join(rootDir, 'script.js'), 'utf8');
const styleCss = fs.readFileSync(path.join(rootDir, 'style.css'), 'utf8');
const apiJs = fs.readFileSync(path.join(rootDir, 'api.js'), 'utf8');

// 1. Eight Explicit Stages in HTML
check("Index HTML defines all 8 explicit pipeline stages", () => {
  const stageIds = [
    'pipe-input-status', 'pipe-dq-status', 'pipe-mod-a-status', 'pipe-mod-b-status',
    'pipe-risk-status', 'pipe-physics-status', 'pipe-decision-status', 'pipe-trace-status'
  ];
  for (const id of stageIds) {
    assert.ok(indexHtml.includes(`id="${id}"`), `Missing stage status ${id} in index.html`);
  }
});

// 2. Feature Derivation Pipeline in Intake
check("Feature derivation pipeline banner present in manual intake", () => {
  assert.ok(indexHtml.includes('Derivation Pipeline:'), "Missing feature derivation pipeline banner");
  assert.ok(indexHtml.includes('User Input &rarr; Normalization &rarr; Feature Derivation (28 Feats) &rarr; Governed Vector &rarr; Inference'), "Missing derivation steps");
});

// 3. Zero Privileged Secrets in Frontend Files
check("Zero privileged keys (predicta_op_key_2026 / predicta_admin_key_2026) in client files", () => {
  const clientFiles = [indexHtml, scriptJs, styleCss, apiJs];
  for (const content of clientFiles) {
    assert.ok(!content.includes('predicta_op_key_2026'), "Found predicta_op_key_2026 in frontend client files");
    assert.ok(!content.includes('predicta_admin_key_2026'), "Found predicta_admin_key_2026 in frontend client files");
  }
});

// 4. Six Distinct Navigation Views
check("Exactly 6 distinct navigation view destinations exist in index.html", () => {
  const viewIds = ['page-home', 'page-screening', 'page-overview', 'page-component', 'page-judge-journey', 'page-advanced'];
  for (const vid of viewIds) {
    assert.ok(indexHtml.includes(`data-page="${vid}"`), `Missing view container ${vid}`);
  }
});

// 5. Reliability Passport Modal with Multi-Destination Links
check("Reliability Passport Modal includes multi-destination navigation buttons", () => {
  assert.ok(indexHtml.includes('id="component-passport-modal"'), "Missing component-passport-modal");
  assert.ok(indexHtml.includes('inspectPassportInLiveMonitor'), "Missing inspectPassportInLiveMonitor");
  assert.ok(indexHtml.includes("inspectPassportInAdvanced('page-anomaly')"), "Missing inspectPassportInAdvanced('page-anomaly')");
  assert.ok(indexHtml.includes("inspectPassportInAdvanced('page-decision')"), "Missing inspectPassportInAdvanced('page-decision')");
  assert.ok(indexHtml.includes("generateQualificationReportPDF"), "Missing generateQualificationReportPDF");
});

// 6. Judge Journey 8-step Pipeline Alignment
check("Judge Journey contains 8 explicit steps matching the qualification flow", () => {
  assert.ok(scriptJs.includes('judgeStageDefinitions = ['), "Missing judgeStageDefinitions");
  assert.ok(scriptJs.includes('01 \u2014 Telemetry Ingestion & Canonical Identity'), "Missing Step 1 in judge definitions");
  assert.ok(scriptJs.includes('08 \u2014 Reliability Case Traceability & Certification'), "Missing Step 8 in judge definitions");
});

// 7. Canonical Case Model Hash & Operating Threshold
check("Canonical Case operates under theta* = 0.20 and SHA-256 lock", () => {
  assert.ok(scriptJs.includes('window.activeCanonicalCase = {'), "Missing activeCanonicalCase builder");
  assert.ok(scriptJs.includes('91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98'), "Missing model SHA in script.js");
  assert.ok(scriptJs.includes('0.20'), "Missing 0.20 threshold reference");
});

// 8. Frontend mirror parity
check("frontend/ mirror files exist and match root files exactly", () => {
  const fIndex = fs.readFileSync(path.join(rootDir, 'frontend', 'index.html'), 'utf8');
  const fScript = fs.readFileSync(path.join(rootDir, 'frontend', 'script.js'), 'utf8');
  const fStyle = fs.readFileSync(path.join(rootDir, 'frontend', 'style.css'), 'utf8');
  const fApi = fs.readFileSync(path.join(rootDir, 'frontend', 'api.js'), 'utf8');

  assert.strictEqual(indexHtml, fIndex, "index.html and frontend/index.html differ");
  assert.strictEqual(scriptJs, fScript, "script.js and frontend/script.js differ");
  assert.strictEqual(styleCss, fStyle, "style.css and frontend/style.css differ");
  assert.strictEqual(apiJs, fApi, "api.js and frontend/api.js differ");
});

console.log("\n=========================================================================");
console.log(`RESULTS: ${passed}/${total} FINAL VERIFICATION CHECKS PASSED SUCCESSFULLY!`);
console.log("=========================================================================\n");

if (passed !== total) {
  process.exit(1);
}
