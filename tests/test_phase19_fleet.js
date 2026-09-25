/**
 * Phase 19.2 — Operational Fleet Monitoring & Evidence Integration Test Suite (Node.js)
 * =====================================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const { FleetManagerJS, VALID_EQUIPMENT_IDS } = require('../src/fleet/fleet_manager');

function computeSha256(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

console.log('--- PREDICTA-26 Phase 19.2 Fleet Monitoring Test Suite (Node.js) ---');

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

// 4. Fleet Monitoring Dashboard DOM Contract
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const requiredIds = [
  'fleet-monitoring-dashboard',
  'fleet-total-lots',
  'fleet-total-wafers',
  'fleet-total-components',
  'fleet-total-equipment',
  'fleet-operating-threshold',
  'fleet-cohort-filter',
  'btn-fleet-refresh',
  'fleet-lots-table',
  'fleet-lots-tbody',
  'fleet-lot-detail-panel',
  'fleet-selected-lot-id',
  'fleet-selected-lot-cohort',
  'fleet-selected-lot-station',
  'fleet-selected-lot-wafers',
  'fleet-selected-lot-components',
  'btn-fleet-close-detail'
];
for (const id of requiredIds) {
  assert(html.includes(`id="${id}"`), `Missing required DOM ID: ${id}`);
}
console.log('✓ Fleet Monitoring Dashboard DOM Contract Verified');

// 5. Fleet Manager Summary & Lot Queries
const mgr = new FleetManagerJS();
const summary = mgr.getFleetSummary();
assert.strictEqual(summary.total_lots, 50, 'Total lots must be 50');
assert(summary.total_wafers >= 100, 'Total wafers must be >= 100');
assert.strictEqual(summary.total_components, 5000, 'Total components must be 5000');
assert.strictEqual(summary.total_equipment, 5, 'Total equipment stations must be 5');
assert.strictEqual(summary.provenance.operating_threshold, 0.20, 'Operating threshold must be 0.20');
assert.strictEqual(summary.lot_cohort_distribution.TRAIN, 35, 'Train cohort must have 35 lots');
assert.strictEqual(summary.lot_cohort_distribution.TEST, 8, 'Test cohort must have 8 lots');
console.log('✓ Fleet Manager Summary Resolution Verified');

// 6. Lot and Wafer Details
const lot1 = mgr.getLotDetail('LOT-SYN-001');
assert(lot1 !== null);
assert.strictEqual(lot1.cohort_type, 'TRAIN');
assert(lot1.canonical_components.length === 3);
assert(lot1.wafers.includes('W-2026-01'));
console.log('✓ Demo Lot LOT-SYN-001 Canonical Links Verified');

const wfr1 = mgr.getWaferDetail('WFR-001');
assert(wfr1 !== null);
assert.strictEqual(wfr1.lot_id, 'LOT-SYN-001');
assert.strictEqual(wfr1.die_count, 50);
console.log('✓ Wafer Detail Query Resolution Verified');

// 7. Fail-closed behavior
assert.strictEqual(mgr.getLotDetail('INVALID_LOT'), null);
assert.strictEqual(mgr.getLotDetail(''), null);
assert.strictEqual(mgr.getLotDetail(null), null);
assert.strictEqual(mgr.getWaferDetail('INVALID_WFR'), null);
assert.strictEqual(mgr.getWaferDetail(''), null);
assert.strictEqual(mgr.getWaferDetail(null), null);
console.log('✓ Fail-Closed Behavior on Unregistered Entities Verified');

console.log('\n========================================');
console.log('ALL PHASE 19.2 NODE.JS TESTS PASSED (7/7)');
console.log('========================================\n');
