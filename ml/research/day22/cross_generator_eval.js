/**
 * Predicta Day 22 — Same-Data Cross-Generator Benchmark & Matrix Evaluation
 * File: ml/research/day22/cross_generator_eval.js
 * 
 * RESEARCH ONLY — DO NOT DEPLOY OR REPLACE PRODUCTION MODEL
 */

const fs = require('fs');
const path = require('path');
const inf = require('../../../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 22 — SAME-DATA CROSS-GENERATOR MATRIX BENCHMARK");
console.log("=========================================================================\n");

const valV3Path = path.join(__dirname, 'data', 'validation_v3.csv');
const lines = fs.readFileSync(valV3Path, 'utf-8').trim().split('\n');
const headers = lines[0].split(',');

const v3Records = lines.slice(1).map(line => {
  const values = line.split(',');
  const obj = {};
  headers.forEach((h, idx) => {
    const val = values[idx];
    obj[h] = isNaN(val) ? val : parseFloat(val);
  });
  return obj;
});

console.log(`Ingested ${v3Records.length} records from independent V3 evaluation set (ml/research/day22/data/validation_v3.csv)...`);

let tp = 0, fp = 0, tn = 0, fn = 0;
let brierSum = 0;
const defectRecalls = {};
const eqRecalls = {};

v3Records.forEach(r => {
  const res = inf.predictSingle(r);
  const prob = res.probability;
  const isPredFail = prob >= 0.45;
  const isActualFail = r.result === "FAIL";

  const err = prob - (isActualFail ? 1 : 0);
  brierSum += err * err;

  if (isActualFail && isPredFail) tp++;
  else if (!isActualFail && isPredFail) fp++;
  else if (!isActualFail && !isPredFail) tn++;
  else if (isActualFail && !isPredFail) fn++;

  // Defect-wise
  const dType = r.defect_type;
  if (!defectRecalls[dType]) defectRecalls[dType] = { tp: 0, total: 0 };
  if (isActualFail) {
    defectRecalls[dType].total++;
    if (isPredFail) defectRecalls[dType].tp++;
  }

  // Equipment-wise
  const eqId = r.equipment_id;
  if (!eqRecalls[eqId]) eqRecalls[eqId] = { tp: 0, total: 0 };
  if (isActualFail) {
    eqRecalls[eqId].total++;
    if (isPredFail) eqRecalls[eqId].tp++;
  }
});

const totalFail = tp + fn;
const totalPass = fp + tn;
const recall = (tp / totalFail) * 100;
const fpr = (fp / totalPass) * 100;
const precision = (tp / (tp + fp)) * 100;
const f1 = (2 * precision * recall) / (precision + recall);
const brierScore = brierSum / v3Records.length;

console.log(`\n--- FROZEN PRODUCTION MODEL EVALUATION ON INDEPENDENT V3 DATASET ---`);
console.log(`   • FAIL Recall:             ${recall.toFixed(2)}% (${tp}/${totalFail})`);
console.log(`   • False Positive Rate (FPR): ${fpr.toFixed(2)}% (${fp}/${totalPass})`);
console.log(`   • Precision:               ${precision.toFixed(2)}%`);
console.log(`   • F1 Score:                ${f1.toFixed(2)}%`);
console.log(`   • Brier Calibration Score: ${brierScore.toFixed(4)}`);
console.log(`   • Confusion Matrix:        TP=${tp}, FP=${fp}, TN=${tn}, FN=${fn}`);

console.log(`\n   • Defect-Wise Recalls on V3 Generator:`);
Object.keys(defectRecalls).forEach(dt => {
  if (dt !== "NORMAL") {
    const dRec = defectRecalls[dt].total > 0 ? (defectRecalls[dt].tp / defectRecalls[dt].total) * 100 : 0;
    console.log(`        - ${dt.padEnd(24)}: ${dRec.toFixed(2)}% (${defectRecalls[dt].tp}/${defectRecalls[dt].total})`);
  }
});

console.log(`\n   • Equipment-Wise Recalls on V3 Generator:`);
Object.keys(eqRecalls).forEach(eq => {
  const eRec = eqRecalls[eq].total > 0 ? (eqRecalls[eq].tp / eqRecalls[eq].total) * 100 : 0;
  console.log(`        - ${eq.padEnd(10)}: ${eRec.toFixed(2)}% (${eqRecalls[eq].tp}/${eqRecalls[eq].total})`);
});

const evalResults = {
  generator: "V3_independent",
  recall: recall.toFixed(2),
  fpr: fpr.toFixed(2),
  precision: precision.toFixed(2),
  f1: f1.toFixed(2),
  brierScore: brierScore.toFixed(4),
  tp, fp, tn, fn
};

const resultsDir = path.join(__dirname, 'results');
fs.mkdirSync(resultsDir, { recursive: true });
fs.writeFileSync(path.join(resultsDir, 'cross_generator_matrix.json'), JSON.stringify(evalResults, null, 2));

console.log("\n✔ Saved Cross-Generator Matrix Results to ml/research/day22/results/cross_generator_matrix.json ✅\n");
