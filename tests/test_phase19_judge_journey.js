/**
 * Phase 19.3 — Judge Journey & SIH GitHub Presentation Test Suite (Node.js)
 * =========================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');

function computeSha256(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

console.log('--- PREDICTA-26 Phase 19.3 Judge Journey Test Suite (Node.js) ---');

// 1. Protected Model & Dataset Integrity
const modelSha = computeSha256(path.join(ROOT, 'ml/models/production/predicta_xgboost_model.json'));
assert.strictEqual(modelSha, '91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98', 'Model SHA mismatch');
console.log('✓ Protected Model SHA-256 Verified');

const datasetSha = computeSha256(path.join(ROOT, 'ml/data/synthetic/predicta_dataset_v3_50000.csv'));
assert.strictEqual(datasetSha, '48e718643b6fe99bc410421f5b48715c294f1c4c2edabf10870935afdb820a06', 'Dataset SHA mismatch');
console.log('✓ Protected Dataset SHA-256 Verified');

// 2. Frontend Mirror Byte Parity
const pairs = [
  ['index.html', 'frontend/index.html'],
  ['script.js', 'frontend/script.js'],
  ['api.js', 'frontend/api.js']
];
for (const [r, f] of pairs) {
  const rBuf = fs.readFileSync(path.join(ROOT, r));
  const fBuf = fs.readFileSync(path.join(ROOT, f));
  assert.strictEqual(rBuf.length, fBuf.length, `Byte length mismatch on ${r} vs ${f}`);
  assert.strictEqual(
    crypto.createHash('sha256').update(rBuf).digest('hex'),
    crypto.createHash('sha256').update(fBuf).digest('hex'),
    `Hash mismatch on ${r} vs ${f}`
  );
}
console.log('✓ Frontend Exact Mirror Byte Parity Verified (3/3 pairs)');

// 3. Zero SHAP & Prohibited Multipliers
const feFiles = ['index.html', 'frontend/index.html', 'script.js', 'frontend/script.js', 'api.js', 'frontend/api.js'];
const shapRegex = /\bshap\b/i;
const multRegexes = [/\*\s*1\.2\b/, /\*\s*1\.05\b/, /\*\s*0\.95\b/];

for (const rel of feFiles) {
  const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  assert(!shapRegex.test(content), `Prohibited SHAP token in ${rel}`);
  for (const rx of multRegexes) {
    assert(!rx.test(content), `Prohibited client multiplier in ${rel}`);
  }
}
console.log('✓ Zero SHAP and Multipliers in Frontend Code Verified');

// 4. Judge Journey DOM Contract
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const requiredIds = [
  'nav-btn-judge-journey',
  'judge-journey-dashboard',
  'btn-judge-prev',
  'btn-judge-next',
  'judge-stage-indicator',
  'judge-stepper-pills',
  'judge-stage-content',
  'judge-stage-title',
  'judge-stage-tag',
  'judge-stage-desc',
  'judge-stage-details',
  'btn-judge-load-normal',
  'btn-judge-load-latent',
  'btn-judge-load-false'
];
for (const id of requiredIds) {
  assert(html.includes(`id="${id}"`), `Missing required Judge Journey DOM ID: ${id}`);
}
for (let i = 1; i <= 10; i++) {
  assert(html.includes(`data-stage="${i}"`), `Missing stepper pill data-stage="${i}"`);
}
console.log('✓ Judge Journey DOM Contract Verified (10 Stages + Stepper + Controls)');

// 5. Canonical Demo Data Contract
const canonicalData = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/governance/canonical_demo_data.json'), 'utf8'));
assert.strictEqual(canonicalData.lead_time_basis, '168H_EVALUATION_HORIZON_NOT_FAILURE_TIME');
assert(canonicalData.cases.NORMAL !== undefined);
assert(canonicalData.cases.LATENT_DEFECT !== undefined);
assert(canonicalData.cases.FALSE_ALARM !== undefined);
console.log('✓ Canonical Demo Data Grounding Verified');

// 6. README SIH Structure & Diagrams
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
assert(readme.includes('# Judge Overview'), 'Missing # Judge Overview in README');
assert(readme.includes('# Judge Quick Start'), 'Missing # Judge Quick Start in README');
assert(readme.includes('# Demonstration Cases'), 'Missing # Demonstration Cases in README');
assert(readme.includes('# System Architecture & Manufacturing Data Flow'), 'Missing Architecture in README');
assert(readme.includes('# Multi-Layer Evidence Pipeline'), 'Missing Evidence Pipeline in README');
assert(readme.includes('# Governed Decision & Disposition Architecture'), 'Missing Governance in README');
assert(readme.includes('# Digital Reliability Twin & Traceability'), 'Missing Twin in README');
assert(readme.includes('# Scientific Rigor & Governance Boundaries'), 'Missing Boundaries in README');

const mermaidMatches = readme.match(/```mermaid/g) || [];
assert(mermaidMatches.length >= 5, `Expected >= 5 Mermaid diagrams, found ${mermaidMatches.length}`);
assert(!readme.includes('file:///'), 'Raw file URL found in README');
assert(!readme.includes('C:\\Users'), 'Local path found in README');
console.log(`✓ README SIH Presentation & ${mermaidMatches.length} Architecture Diagrams Verified`);

// 7. Script exports
const scriptContent = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
assert(scriptContent.includes('window.renderJudgeJourneyStage = renderJudgeJourneyStage;'), 'Missing window.renderJudgeJourneyStage');
assert(scriptContent.includes('window.initJudgeJourney = initJudgeJourney;'), 'Missing window.initJudgeJourney');
console.log('✓ script.js Judge Journey Global Exports Verified');

console.log('\n========================================');
console.log('ALL PHASE 19.3 NODE.JS TESTS PASSED (7/7)');
console.log('========================================\n');
