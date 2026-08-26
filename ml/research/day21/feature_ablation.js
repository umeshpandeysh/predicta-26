/**
 * Predicta Day 21 — Feature Ablation Research Experiment
 * File: ml/research/day21/feature_ablation.js
 * 
 * RESEARCH ONLY — DO NOT REPLACE PRODUCTION MODEL
 */

const fs = require('fs');
const path = require('path');
const inf = require('../../../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 21 — FEATURE ABLATION RESEARCH EXPERIMENT");
console.log("=========================================================================\n");

const valCsvPath = path.join(__dirname, 'data', 'validation_v2.csv');
const lines = fs.readFileSync(valCsvPath, 'utf-8').trim().split('\n');
const headers = lines[0].split(',');

const records = lines.slice(1).map(line => {
  const values = line.split(',');
  const obj = {};
  headers.forEach((h, idx) => {
    const val = values[idx];
    obj[h] = isNaN(val) ? val : parseFloat(val);
  });
  return obj;
});

const ablationScenarios = [
  { name: "Full Baseline Vector (28 Features)", ablateField: null },
  { name: "Ablate thermal_delta (Redundant Ratio)", ablateField: "thermal_delta" },
  { name: "Ablate leakage_current (Primary Defect Feature)", ablateField: "leakage_current" },
  { name: "Ablate propagation_delay (Primary Timing Feature)", ablateField: "propagation_delay" }
];

console.log(`${'ABLATION SCENARIO'.padEnd(45)} | ${'RECALL (%)'.padEnd(12)} | ${'FPR (%)'}`);
console.log("-".repeat(72));

const ablationResults = [];

ablationScenarios.forEach(sc => {
  let tp = 0, fp = 0, tn = 0, fn = 0;

  records.forEach(r => {
    const rec = { ...r };
    if (sc.ablateField === "thermal_delta") rec.temperature = 25.0; // neutralize
    if (sc.ablateField === "leakage_current") rec.leakage_current = 110.0;
    if (sc.ablateField === "propagation_delay") rec.propagation_delay = 11.5;

    const res = inf.predictSingle(rec);
    const isPredFail = res.probability >= 0.45;
    const isActualFail = r.result === "FAIL";

    if (isActualFail && isPredFail) tp++;
    else if (!isActualFail && isPredFail) fp++;
    else if (!isActualFail && !isPredFail) tn++;
    else if (isActualFail && !isPredFail) fn++;
  });

  const recall = (tp / (tp + fn)) * 100;
  const fpr = (fp / (fp + tn)) * 100;

  console.log(`${sc.name.padEnd(45)} | ${recall.toFixed(2).padEnd(12)} | ${fpr.toFixed(2)}`);
  ablationResults.push({ scenario: sc.name, recall: recall.toFixed(2), fpr: fpr.toFixed(2) });
});

fs.writeFileSync(path.join(__dirname, 'feature_ablation_results.json'), JSON.stringify(ablationResults, null, 2));
console.log("\n✔ Saved Feature Ablation Results to ml/research/day21/feature_ablation_results.json ✅\n");
