/**
 * Predicta Day 23 — Research Threshold Sweep & Calibration Analysis
 * File: ml/research/day23/threshold_sweep.js
 * 
 * RESEARCH ONLY — DO NOT CHANGE PRODUCTION THRESHOLD 0.45
 */

const fs = require('fs');
const path = require('path');
const inf = require('../../../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 23 — RESEARCH THRESHOLD SWEEP & CALIBRATION ANALYSIS");
console.log("=========================================================================\n");

const valV3Path = path.join(__dirname, '..', 'day22', 'data', 'validation_v3.csv');
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

const thresholds = [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90];
const sweepResults = [];

thresholds.forEach(t => {
  let tp = 0, fp = 0, tn = 0, fn = 0;

  v3Records.forEach(r => {
    const res = inf.predictSingle(r);
    const prob = res.probability;
    const isPredFail = prob >= t;
    const isActualFail = r.result === "FAIL";

    if (isActualFail && isPredFail) tp++;
    else if (!isActualFail && isPredFail) fp++;
    else if (!isActualFail && !isPredFail) tn++;
    else if (isActualFail && !isPredFail) fn++;
  });

  const totalFail = tp + fn;
  const totalPass = fp + tn;
  const recall = (tp / totalFail) * 100;
  const fpr = (fp / totalPass) * 100;
  const precision = tp + fp > 0 ? (tp / (tp + fp)) * 100 : 0;
  const specificity = (tn / totalPass) * 100;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const balAcc = (recall + specificity) / 2;

  sweepResults.push({
    threshold: t.toFixed(2),
    recall: recall.toFixed(2),
    fpr: fpr.toFixed(2),
    precision: precision.toFixed(2),
    specificity: specificity.toFixed(2),
    f1: f1.toFixed(2),
    balanced_accuracy: balAcc.toFixed(2),
    tp, fp, tn, fn
  });
});

console.log("THRESHOLD | RECALL (%) | FPR (%)   | PRECISION | SPECIFICITY | F1 (%)   | BAL ACC (%)");
console.log("-----------------------------------------------------------------------------------");
sweepResults.forEach(r => {
  const isProd = r.threshold === "0.45" ? " ⬅ PRODUCTION FROZEN THRESHOLD" : "";
  console.log(`${r.threshold.padEnd(9)} | ${r.recall.padEnd(10)} | ${r.fpr.padEnd(9)} | ${r.precision.padEnd(9)} | ${r.specificity.padEnd(11)} | ${r.f1.padEnd(8)} | ${r.balanced_accuracy}${isProd}`);
});

const resultsPath = path.join(__dirname, 'results', 'threshold_sweep.json');
fs.writeFileSync(resultsPath, JSON.stringify(sweepResults, null, 2));
console.log(`\n✔ Threshold sweep results saved to ${resultsPath} ✅\n`);
