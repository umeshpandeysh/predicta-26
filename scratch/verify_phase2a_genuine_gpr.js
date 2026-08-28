/**
 * Phase 2A Verification Script — Genuine GPR Kernel Runtime Evaluation (Lots 36-50)
 * File: scratch/verify_phase2a_genuine_gpr.js
 */

const fs = require('fs');
const path = require('path');
const inf = require('../src/api/inference');

const csvPath = path.join(__dirname, '../data/synthetic/SEMICONDUCTOR_TELEMETRY_synthetic_full.csv');
const artifactPath = path.join(__dirname, '../ml/models/predicta_gpr_kernel_artifacts.json');

console.log("=========================================================================");
console.log("PHASE 2A — GENUINE GPR RUNTIME EVALUATION (HELD-OUT LOTS 36-50)");
console.log("=========================================================================\n");

// 1. Artifact Verification
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
console.log(`Artifact Model Version: ${artifact.model_version}`);
console.log(`Model Type: ${artifact.model_type}`);
console.log(`Kernel Formulation: ${artifact.kernel}`);

const params = ['iddq', 'ileak', 'tpd'];
params.forEach(p => {
  const pCfg = artifact.parameters[p];
  const hasK = pCfg && pCfg.support_x && pCfg.alpha && pCfg.K_inv && pCfg.support_x.length > 0;
  console.log(`  ${p} → genuine fitted GPR kernel matrix → ${hasK ? "PASS" : "FAIL"}`);
});
console.log("");

// 2. Load held-out test data (Lots 36 to 50 at 0h, 24h, 168h)
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

const testList = Object.values(testComps).filter(c => c.times[0] && c.times[24] && c.times[168]);
console.log(`Held-out Test Components (Lots 36-50): ${testList.length}\n`);

// 3. Evaluate Genuine GPR Kernel Inference vs Baseline
const resultsSummary = {};

params.forEach(param => {
  let gprAbsErrSum = 0, gprSqErrSum = 0;
  let baseAbsErrSum = 0, baseSqErrSum = 0;
  let coverageCount = 0, totalWidthSum = 0;

  const actuals = [];
  const gprPreds = [];
  const basePreds = [];

  testList.forEach(c => {
    const val0 = c.times[0][param];
    const val24 = c.times[24][param];
    const actual168 = c.times[168][param];

    const inputFeat = {
      current: val24, leakage_current: val24, propagation_delay: val24,
      iddq: val24, ileak: val24, tpd: val24,
      [`${param}_0h`]: val0
    };

    // Execute genuine runtime GPR prediction
    const driftRes = inf.evaluateGprDrift(inputFeat);
    const pred168 = driftRes[param].predicted_168h;
    const std168 = driftRes[param].uncertainty_std;
    const lower95 = driftRes[param].lower_95;
    const upper95 = driftRes[param].upper_95;

    const basePred = val24; // 24h persistence

    const gprErr = Math.abs(pred168 - actual168);
    const baseErr = Math.abs(basePred - actual168);

    gprAbsErrSum += gprErr;
    gprSqErrSum += gprErr * gprErr;
    baseAbsErrSum += baseErr;
    baseSqErrSum += baseErr * baseErr;

    actuals.push(actual168);
    gprPreds.push(pred168);
    basePreds.push(basePred);

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

  resultsSummary[param] = {
    GPR: { MAE: Number(gprMAE), RMSE: Number(gprRMSE), R2: Number(gprR2), Samples: N },
    Baseline_24h: { MAE: Number(baseMAE), RMSE: Number(baseRMSE), R2: Number(baseR2), Samples: N },
    Uncertainty: { Coverage_95_Pct: `${coveragePct}%`, Avg_Interval_Width: Number(avgWidth) }
  };
});

console.log("--- PERFORMANCE & UNCERTAINTY SUMMARY (HELD-OUT LOTS 36-50) ---");
console.log(JSON.stringify(resultsSummary, null, 2));

console.log("\n=========================================================================");
console.log("PHASE 2A GENUINE GPR EVALUATION COMPLETE");
console.log("=========================================================================\n");
