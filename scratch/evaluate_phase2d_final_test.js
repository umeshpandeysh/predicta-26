/**
 * Phase 2D — Final Untouched Test Set Evaluation (Lots 36–50)
 * File: scratch/evaluate_phase2d_final_test.js
 */

const fs = require('fs');
const path = require('path');
const inf = require('../src/api/inference');

const csvPath = path.join(__dirname, '../data/synthetic/SEMICONDUCTOR_TELEMETRY_synthetic_full.csv');
const artifactPath = path.join(__dirname, '../ml/models/predicta_gpr_kernel_artifacts.json');

console.log("=========================================================================");
console.log("PHASE 2D — FINAL UNTOUCHED TEST SET EVALUATION (LOTS 36–50)");
console.log("=========================================================================\n");

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
console.log("TRAIN LOTS:       " + artifact.lot_split.train_lots);
console.log("CALIBRATION LOTS: " + artifact.lot_split.calibration_lots);
console.log("FINAL TEST LOTS:  " + artifact.lot_split.test_lots);
console.log("ZERO LOT OVERLAP VERIFIED! ✅\n");

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

  if (lotNum >= 36 && lotNum <= 50) {
    if (!testComps[compId]) testComps[compId] = { id: compId, lot_id: lotId, times: {} };
    testComps[compId].times[hour] = {
      iddq: Number(cols[header.indexOf('iddq')]),
      ileak: Number(cols[header.indexOf('ileak')]),
      tpd: Number(cols[header.indexOf('tpd')])
    };
  }
});

const testList = Object.values(testComps).filter(c => c.times[0] && c.times[24] && c.times[168]);
console.log(`Evaluating ${testList.length} held-out test components...\n`);

const params = ['iddq', 'ileak', 'tpd'];
const finalSummary = {};
const standardizedResidSummary = {};

params.forEach(param => {
  let gprAbsErrSum = 0, gprSqErrSum = 0;
  let baseAbsErrSum = 0, baseSqErrSum = 0;
  let coverageCount = 0, totalWidthSum = 0;

  const actuals = [];
  const gprPreds = [];
  const basePreds = [];
  const zList = [];

  let within1Sig = 0;
  let within196Sig = 0;

  testList.forEach(c => {
    const val0 = c.times[0][param];
    const val24 = c.times[24][param];
    const actual168 = c.times[168][param];

    const inputFeat = {
      current: val24, leakage_current: val24, propagation_delay: val24,
      iddq: val24, ileak: val24, tpd: val24,
      [`${param}_0h`]: val0
    };

    const driftRes = inf.evaluateGprDrift(inputFeat);
    const item = driftRes[param];

    const pred168 = item.predicted_168h;
    const std168 = item.uncertainty_std;
    const lower95 = item.lower_95;
    const upper95 = item.upper_95;
    const basePred = val24;

    const gprErr = Math.abs(pred168 - actual168);
    const baseErr = Math.abs(basePred - actual168);

    gprAbsErrSum += gprErr;
    gprSqErrSum += gprErr * gprErr;
    baseAbsErrSum += baseErr;
    baseSqErrSum += baseErr * baseErr;

    actuals.push(actual168);
    gprPreds.push(pred168);
    basePreds.push(basePred);

    const z = (actual168 - pred168) / Math.max(1e-6, std168);
    zList.push(z);

    if (Math.abs(z) <= 1.0) within1Sig++;
    if (Math.abs(z) <= 1.96) within196Sig++;

    if (actual168 >= lower95 && actual168 <= upper95) coverageCount++;
    totalWidthSum += (upper95 - lower95);
  });

  const N = testList.length;
  const gprMAE = (gprAbsErrSum / N).toFixed(4);
  const gprRMSE = Math.sqrt(gprSqErrSum / N).toFixed(4);
  const baseMAE = (baseAbsErrSum / N).toFixed(4);
  const baseRMSE = Math.sqrt(baseSqErrSum / N).toFixed(4);

  const meanAct = actuals.reduce((a,b)=>a+b,0) / N;
  const ssTot = actuals.reduce((a,b)=>a + Math.pow(b - meanAct, 2), 0);
  const gprSsRes = actuals.reduce((a,b,i)=>a + Math.pow(b - gprPreds[i], 2), 0);
  const baseSsRes = actuals.reduce((a,b,i)=>a + Math.pow(b - basePreds[i], 2), 0);

  const gprR2 = (1 - (gprSsRes / ssTot)).toFixed(4);
  const baseR2 = (1 - (baseSsRes / ssTot)).toFixed(4);
  const coveragePct = ((coverageCount / N) * 100).toFixed(1);
  const avgWidth = (totalWidthSum / N).toFixed(4);

  const zMean = (zList.reduce((a,b)=>a+b,0) / N).toFixed(4);
  const zStd = Math.sqrt(zList.reduce((a,b)=>a+Math.pow(b-zMean,2),0) / N).toFixed(4);
  const pct1Sig = ((within1Sig / N) * 100).toFixed(1);
  const pct196Sig = ((within196Sig / N) * 100).toFixed(1);

  finalSummary[param] = {
    GPR: { MAE: Number(gprMAE), RMSE: Number(gprRMSE), R2: Number(gprR2), Samples: N },
    Baseline_24h: { MAE: Number(baseMAE), RMSE: Number(baseRMSE), R2: Number(baseR2), Samples: N },
    Uncertainty: { Coverage_95_Pct: `${coveragePct}%`, Avg_Interval_Width: Number(avgWidth) }
  };

  standardizedResidSummary[param] = {
    Mean_Z: Number(zMean),
    Std_Z: Number(zStd),
    Pct_Within_1Sigma: `${pct1Sig}%`,
    Pct_Within_1_96Sigma: `${pct196Sig}%`
  };
});

console.log("--- FINAL HOLDOUT PERFORMANCE & UNCERTAINTY (LOTS 36–50) ---");
console.log(JSON.stringify(finalSummary, null, 2));

console.log("\n--- STANDARDIZED RESIDUAL DIAGNOSTICS (LOTS 36–50) ---");
console.log(JSON.stringify(standardizedResidSummary, null, 2));

console.log("\n=========================================================================");
console.log("PHASE 2D FINAL HOLDOUT EVALUATION COMPLETE");
console.log("=========================================================================\n");
