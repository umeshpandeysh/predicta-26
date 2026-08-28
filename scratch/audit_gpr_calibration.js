/**
 * Phase 2C Diagnostic Audit Script — GPR Calibration & Standardized Residuals
 * File: scratch/audit_gpr_calibration.js
 */

const fs = require('fs');
const path = require('path');
const inf = require('../src/api/inference');

const csvPath = path.join(__dirname, '../data/synthetic/SEMICONDUCTOR_TELEMETRY_synthetic_full.csv');
const artifactPath = path.join(__dirname, '../ml/models/predicta_gpr_kernel_artifacts.json');

console.log("=========================================================================");
console.log("PHASE 2C — FORENSIC GPR UNCERTAINTY CALIBRATION AUDIT");
console.log("=========================================================================\n");

const content = fs.readFileSync(csvPath, 'utf8');
const lines = content.trim().split(/\r?\n/);
const header = lines[0].split(',');

// Separate Training (Lots 1-35) and Test (Lots 36-50)
const trainComps = {};
const testComps = {};

lines.slice(1).forEach(line => {
  const cols = line.split(',');
  if (cols.length < header.length) return;
  const compId = cols[header.indexOf('component_id')];
  const lotId = cols[header.indexOf('lot_id')];
  const lotNum = parseInt(lotId.replace(/\D/g, ''), 10);
  const hour = Number(cols[header.indexOf('burn_in_hour')]);

  const targetMap = lotNum <= 35 ? trainComps : (lotNum >= 36 ? testComps : null);
  if (!targetMap) return;

  if (!targetMap[compId]) targetMap[compId] = { id: compId, lot_id: lotId, times: {} };
  targetMap[compId].times[hour] = {
    iddq: Number(cols[header.indexOf('iddq')]),
    ileak: Number(cols[header.indexOf('ileak')]),
    tpd: Number(cols[header.indexOf('tpd')])
  };
});

const trainList = Object.values(trainComps).filter(c => c.times[0] && c.times[24] && c.times[168]);
const testList = Object.values(testComps).filter(c => c.times[0] && c.times[24] && c.times[168]);

console.log(`Training Set (Lots 1-35): ${trainList.length} components`);
console.log(`Held-out Test Set (Lots 36-50): ${testList.length} components\n`);

const params = ['iddq', 'ileak', 'tpd'];

// Step 7: Compare Residual Distributions on Train vs Test
console.log("--- STEP 7: TRAIN VS TEST RESIDUAL ANALYSIS ---");
params.forEach(param => {
  // Train Residuals
  const trainResids = trainList.map(c => {
    const val0 = c.times[0][param];
    const val24 = c.times[24][param];
    const actual168 = c.times[168][param];
    const inputFeat = { current: val24, leakage_current: val24, propagation_delay: val24, iddq: val24, ileak: val24, tpd: val24, [`${param}_0h`]: val0 };
    const driftRes = inf.evaluateGprDrift(inputFeat);
    return actual168 - driftRes[param].predicted_168h;
  });

  const trMean = trainResids.reduce((a,b)=>a+b,0) / trainList.length;
  const trStd = Math.sqrt(trainResids.reduce((a,b)=>a+Math.pow(b-trMean,2),0) / trainList.length);
  const trMAE = trainResids.reduce((a,b)=>a+Math.abs(b),0) / trainList.length;
  const trRMSE = Math.sqrt(trainResids.reduce((a,b)=>a+Math.pow(b,2),0) / trainList.length);

  // Test Residuals
  const testResids = testList.map(c => {
    const val0 = c.times[0][param];
    const val24 = c.times[24][param];
    const actual168 = c.times[168][param];
    const inputFeat = { current: val24, leakage_current: val24, propagation_delay: val24, iddq: val24, ileak: val24, tpd: val24, [`${param}_0h`]: val0 };
    const driftRes = inf.evaluateGprDrift(inputFeat);
    return actual168 - driftRes[param].predicted_168h;
  });

  const teMean = testResids.reduce((a,b)=>a+b,0) / testList.length;
  const teStd = Math.sqrt(testResids.reduce((a,b)=>a+Math.pow(b-teMean,2),0) / testList.length);
  const teMAE = testResids.reduce((a,b)=>a+Math.abs(b),0) / testList.length;
  const teRMSE = Math.sqrt(testResids.reduce((a,b)=>a+Math.pow(b,2),0) / testList.length);

  console.log(`Parameter '${param}':`);
  console.log(`  Train (Lots 1-35): Mean Resid = ${trMean.toFixed(4)}, Std Resid = ${trStd.toFixed(4)}, MAE = ${trMAE.toFixed(4)}, RMSE = ${trRMSE.toFixed(4)}`);
  console.log(`  Test  (Lots 36-50): Mean Resid = ${teMean.toFixed(4)}, Std Resid = ${teStd.toFixed(4)}, MAE = ${teMAE.toFixed(4)}, RMSE = ${teRMSE.toFixed(4)}`);
});
console.log("");

// Step 8: Standardized Residual Diagnostic z = (actual - predicted) / pred_std
console.log("--- STEP 8: STANDARDIZED RESIDUAL DIAGNOSTICS z = (y - μ) / σ ---");
params.forEach(param => {
  const zList = [];
  let within1Sig = 0;
  let within196Sig = 0;

  testList.forEach(c => {
    const val0 = c.times[0][param];
    const val24 = c.times[24][param];
    const actual168 = c.times[168][param];
    const inputFeat = { current: val24, leakage_current: val24, propagation_delay: val24, iddq: val24, ileak: val24, tpd: val24, [`${param}_0h`]: val0 };
    const driftRes = inf.evaluateGprDrift(inputFeat);
    const item = driftRes[param];
    const z = (actual168 - item.predicted_168h) / Math.max(1e-6, item.uncertainty_std);
    zList.push(z);

    if (Math.abs(z) <= 1.0) within1Sig++;
    if (Math.abs(z) <= 1.96) within196Sig++;
  });

  const N = zList.length;
  const zMean = zList.reduce((a,b)=>a+b,0) / N;
  const zStd = Math.sqrt(zList.reduce((a,b)=>a+Math.pow(b-zMean,2),0) / N);
  const pct1Sig = ((within1Sig / N) * 100).toFixed(1);
  const pct196Sig = ((within196Sig / N) * 100).toFixed(1);

  console.log(`Parameter '${param}':`);
  console.log(`  Mean Z: ${zMean.toFixed(4)}`);
  console.log(`  Std Z:  ${zStd.toFixed(4)}  (Ideal Gaussian = 1.0)`);
  console.log(`  % within ±1.0σ:  ${pct1Sig}%  (Ideal Gaussian = 68.3%)`);
  console.log(`  % within ±1.96σ: ${pct196Sig}% (Ideal Gaussian = 95.0%)`);
});
console.log("\n=========================================================================");
console.log("FORENSIC GPR UNCERTAINTY CALIBRATION AUDIT COMPLETE");
console.log("=========================================================================\n");
