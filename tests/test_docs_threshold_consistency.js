/**
 * PREDICTA SIH 2026 — DOCUMENTATION & THRESHOLD INTEGRITY REGRESSION TEST
 * File: tests/test_docs_threshold_consistency.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=========================================================================');
console.log('PREDICTA — DOCUMENTATION & THRESHOLD INTEGRITY REGRESSION TEST');
console.log('=========================================================================\n');

// 1. Check Active Production Documentation Files
const activeDocs = [
  'docs/api_documentation.md',
  'docs/PRODUCTION_DRIFT_RUNBOOK.md',
  'docs/final_api_contract.md',
  'docs/frontend_backend_contract_lock.md',
  'ml/experiments/EXP-12/PRODUCTION_DRIFT_RUNBOOK.md'
];

activeDocs.forEach(relPath => {
  const fullPath = path.resolve(__dirname, '..', relPath);
  assert.ok(fs.existsSync(fullPath), `Active doc missing: ${relPath}`);
  const text = fs.readFileSync(fullPath, 'utf8');

  // Must explicitly state 0.20
  assert.ok(text.includes('0.20'), `${relPath} must reference authoritative threshold 0.20`);

  // Must NOT claim 0.45 is current production threshold
  const invalidClaims = [
    'Operating Threshold: 0.45',
    'threshold: 0.45',
    'Threshold: 0.45',
    'Threshold: `0.45`',
    'threshold of 0.45',
    'Displays legacy 0.45 threshold'
  ];
  invalidClaims.forEach(claim => {
    assert.ok(!text.includes(claim), `Active doc ${relPath} contains invalid production threshold claim: "${claim}"`);
  });
  console.log(`✔ Active Doc Verified: ${relPath} (authoritative 0.20 threshold locked)`);
});

// 2. Check Supabase DDL Schema
const schemaPath = path.resolve(__dirname, '../supabase/schema.sql');
assert.ok(fs.existsSync(schemaPath), 'supabase/schema.sql must exist');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');
assert.ok(schemaContent.includes('DEFAULT 0.20'), 'supabase/schema.sql must have DEFAULT 0.20 for threshold column');
assert.ok(!schemaContent.includes('DEFAULT 0.45'), 'supabase/schema.sql must not have DEFAULT 0.45');
console.log('✔ Supabase Schema Verified: default threshold column is 0.20');

// 3. Check All Documentation Markdown Files for Category Classification
const cp = require('child_process');
const mdFiles = cp.execSync('git ls-files *.md', { encoding: 'utf8', cwd: path.resolve(__dirname, '..') })
  .split('\n')
  .filter(Boolean);

let banneredCount = 0;
let physicalCount = 0;
let cleanCount = 0;

mdFiles.forEach(relPath => {
  const fullPath = path.resolve(__dirname, '..', relPath);
  if (!fs.existsSync(fullPath)) return;
  const text = fs.readFileSync(fullPath, 'utf8');

  if (!text.includes('0.45')) {
    cleanCount++;
    return;
  }

  const hasBanner = text.includes('HISTORICAL / EXPERIMENTAL CONFIGURATION');
  if (hasBanner) {
    banneredCount++;
    return;
  }

  // If no banner, verify it only contains physical parameters / non-threshold constants
  const lines = text.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('0.45')) {
      const isPhysical = /setup_time|threshold_voltage|iddq|0\.4520\s*Ω|0\.4510/i.test(line);
      assert.ok(isPhysical, `Unbannered doc ${relPath}:L${idx + 1} has unclassified 0.45 reference: "${line.trim()}"`);
    }
  });
  physicalCount++;
});

console.log(`✔ Repository Markdown Audit: ${banneredCount} historical bannered, ${physicalCount} physical parameters, ${cleanCount} clean`);

// 4. Client API Local Decision Engine Prohibition Verification
const apiPath = path.resolve(__dirname, '../api.js');
const frontApiPath = path.resolve(__dirname, '../frontend/api.js');
const apiContent = fs.readFileSync(apiPath, 'utf8');
const frontApiContent = fs.readFileSync(frontApiPath, 'utf8');

assert.ok(!apiContent.includes('function fallbackLocalPredict'), 'api.js must not contain fallbackLocalPredict function');
assert.ok(!frontApiContent.includes('function fallbackLocalPredict'), 'frontend/api.js must not contain fallbackLocalPredict function');
assert.ok(!apiContent.includes('fallbackLocalPredict,'), 'api.js must not export fallbackLocalPredict');
assert.ok(!frontApiContent.includes('fallbackLocalPredict,'), 'frontend/api.js must not export fallbackLocalPredict');
assert.ok(apiContent.includes('LOCAL_DECISION_ENGINE_DISABLED'), 'api.js must enforce LOCAL_DECISION_ENGINE_DISABLED');
assert.ok(frontApiContent.includes('LOCAL_DECISION_ENGINE_DISABLED'), 'frontend/api.js must enforce LOCAL_DECISION_ENGINE_DISABLED');

const apiBuf = fs.readFileSync(apiPath);
const frontApiBuf = fs.readFileSync(frontApiPath);
assert.strictEqual(apiBuf.length, frontApiBuf.length, 'api.js and frontend/api.js length mismatch');
assert.ok(apiBuf.equals(frontApiBuf), 'api.js and frontend/api.js byte parity mismatch');
console.log('✔ Client API Verified: fallbackLocalPredict eliminated, fail-closed locked, 100% byte parity');

console.log('\n=========================================================================');
console.log('ALL DOCUMENTATION & THRESHOLD INTEGRITY TESTS PASSED! ✅');
console.log('=========================================================================\n');
