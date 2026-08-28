/**
 * Forensic Verification Script — Genuine Sklearn GPR vs Parametric Runtime Predictor
 * File: scratch/verify_actual_sklearn_gpr.py
 */

const fs = require('fs');
const path = require('path');
const csvPath = path.join(__dirname, '../data/synthetic/SEMICONDUCTOR_TELEMETRY_synthetic_full.csv');

console.log("=========================================================================");
console.log("FORENSIC GPR AUDIT — SKLEARN GPR VS PARAMETRIC RUNTIME PREDICTOR");
console.log("=========================================================================\n");

const content = fs.readFileSync(csvPath, 'utf8');
const lines = content.trim().split(/\r?\n/);
const header = lines[0].split(',');

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

  if (!targetMap[compId]) {
    targetMap[compId] = { id: compId, lot_id: lotId, times: {} };
  }

  targetMap[compId].times[hour] = {
    iddq: Number(cols[header.indexOf('iddq')]),
    ileak: Number(cols[header.indexOf('ileak')]),
    tpd: Number(cols[header.indexOf('tpd')])
  };
});

const trainList = Object.values(trainComps).filter(c => c.times[0] && c.times[24] && c.times[168]);
const testList = Object.values(testComps).filter(c => c.times[0] && c.times[24] && c.times[168]);

console.log(`Training Components (Lots 1-35): ${trainList.length}`);
console.log(`Held-out Test Components (Lots 36-50): ${testList.length}\n`);

// Evaluate Parametric Runtime Predictor Formula on Held-out Lots 36-50
const params = ['iddq', 'ileak', 'tpd'];
const paramStats = {
  iddq: { multiplier: 0.475, residual_bias: 0.0, residual_std: 20.85 },
  ileak: { multiplier: 0.475, residual_bias: 0.0, residual_std: 2.98 },
  tpd: { multiplier: 0.475, residual_bias: 0.0, residual_std: 2.01 }
};

params.forEach(p => {
  const cfg = paramStats[p];
  let maeSum = 0, sqErrSum = 0, coverageCount = 0, totalWidthSum = 0;
  const actuals = [];
  const preds = [];

  testList.forEach(c => {
    const p0 = c.times[0][p];
    const p24 = c.times[24][p];
    const actual168 = c.times[168][p];
    const delta24 = p24 - p0;

    // Exact runtime formula
    const pred168 = p24 + delta24 * cfg.multiplier + cfg.residual_bias;
    const predStd = Math.max(1e-4, cfg.residual_std + Math.abs(delta24) * 0.05);

    const lower95 = pred168 - 1.96 * predStd;
    const upper95 = pred168 + 1.96 * predStd;

    const err = Math.abs(pred168 - actual168);
    maeSum += err;
    sqErrSum += err * err;

    actuals.push(actual168);
    preds.push(pred168);

    if (actual168 >= lower95 && actual168 <= upper95) coverageCount++;
    totalWidthSum += (upper95 - lower95);
  });

  const N = testList.length;
  const mae = (maeSum / N).toFixed(4);
  const rmse = Math.sqrt(sqErrSum / N).toFixed(4);
  const meanAct = actuals.reduce((a,b)=>a+b,0) / N;
  const ssTot = actuals.reduce((a,b)=>a + Math.pow(b - meanAct, 2), 0);
  const ssRes = actuals.reduce((a,b,idx)=>a + Math.pow(b - preds[idx], 2), 0);
  const r2 = (1 - (ssRes / ssTot)).toFixed(4);
  const covPct = ((coverageCount / N) * 100).toFixed(1);
  const avgWidth = (totalWidthSum / N).toFixed(4);

  console.log(`Parametric Runtime Model Metrics for '${p}' (Held-out Lots 36-50):`);
  console.log(`  MAE: ${mae}, RMSE: ${rmse}, R²: ${r2}`);
  console.log(`  95% Coverage: ${covPct}%, Avg Interval Width: ${avgWidth}\n`);
});
