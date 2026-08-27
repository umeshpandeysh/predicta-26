/**
 * Phase 2B — 10 Sample Component Equivalence Test for GPR Mean and Standard Deviation
 * File: scratch/test_gpr_equivalence_10_samples.js
 */

const fs = require('fs');
const path = require('path');
const inf = require('../src/api/inference');

const csvPath = path.join(__dirname, '../data/synthetic/ps170_synthetic_full.csv');
const content = fs.readFileSync(csvPath, 'utf8');
const lines = content.trim().split(/\r?\n/);
const header = lines[0].split(',');

const testComps = {};
lines.slice(1).forEach(line => {
  const cols = line.split(',');
  if (cols.length < header.length) return;
  const compId = cols[header.indexOf('component_id')];
  const lotId = cols[header.indexOf('lot_id')];
  const lotNum = parseInt(lotId.replace(/\D/g, ''), 10);
  const hour = Number(cols[header.indexOf('burn_in_hour')]);

  if (lotNum >= 36) {
    if (!testComps[compId]) testComps[compId] = { id: compId, lot_id: lotId, times: {} };
    testComps[compId].times[hour] = {
      iddq: Number(cols[header.indexOf('iddq')]),
      ileak: Number(cols[header.indexOf('ileak')]),
      tpd: Number(cols[header.indexOf('tpd')])
    };
  }
});

const sampleComps = Object.values(testComps).filter(c => c.times[0] && c.times[24] && c.times[168]).slice(0, 10);

console.log("=========================================================================");
console.log("PHASE 2B — 10 HELD-OUT COMPONENT SAMPLE EQUIVALENCE TABLE");
console.log("=========================================================================\n");

console.log("Component ID      | Param | 24h Val  | Predicted 168h | GPR Std (σ) | 95% CI Lower | 95% CI Upper");
console.log("------------------|-------|----------|----------------|-------------|--------------|--------------");

sampleComps.forEach(c => {
  ['iddq', 'ileak', 'tpd'].forEach(param => {
    const val0 = c.times[0][param];
    const val24 = c.times[24][param];
    const inputFeat = {
      current: val24, leakage_current: val24, propagation_delay: val24,
      iddq: val24, ileak: val24, tpd: val24,
      [`${param}_0h`]: val0
    };

    const driftRes = inf.evaluateGprDrift(inputFeat);
    const item = driftRes[param];
    console.log(
      `${c.id.padEnd(17)} | ${param.padEnd(5)} | ${item.value_24h.toFixed(2).padStart(8)} | ${item.predicted_168h.toFixed(2).padStart(14)} | ${item.uncertainty_std.toFixed(2).padStart(11)} | ${item.lower_95.toFixed(2).padStart(12)} | ${item.upper_95.toFixed(2).padStart(12)}`
    );
  });
});

console.log("\n=========================================================================");
console.log("EQUIVALENCE SAMPLE AUDIT COMPLETE");
console.log("=========================================================================\n");
