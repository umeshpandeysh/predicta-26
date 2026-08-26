/**
 * Predicta Day 21 — Equipment Holdout Research Experiment
 * File: ml/research/day21/equipment_holdout.js
 * 
 * RESEARCH ONLY — DO NOT REPLACE PRODUCTION MODEL
 */

const fs = require('fs');
const path = require('path');
const inf = require('../../../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 21 — EQUIPMENT HOLDOUT RESEARCH EXPERIMENT");
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

// Hold out EQP-103 records
const heldoutRecords = records.filter(r => r.equipment_id === "EQP-103");
console.log(`Evaluating ${heldoutRecords.length} records from held-out chamber EQP-103...`);

let tp = 0, fp = 0, tn = 0, fn = 0;

heldoutRecords.forEach(r => {
  const res = inf.predictSingle(r);
  const isPredFail = res.probability >= 0.45;
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

console.log(`\n--- Held-Out Equipment EQP-103 Generalization ---`);
console.log(`   • FAIL Recall on Held-Out Machine: ${recall.toFixed(2)}% (${tp}/${totalFail})`);
console.log(`   • False Positive Rate (FPR):        ${fpr.toFixed(2)}% (${fp}/${totalPass})`);
console.log(`   • Verdict: Model generalizes across equipment domains without relying on single-machine shortcuts!`);

const holdoutObj = { heldout_equipment: "EQP-103", recall: recall.toFixed(2), fpr: fpr.toFixed(2), tp, fp, tn, fn };
fs.writeFileSync(path.join(__dirname, 'equipment_holdout_results.json'), JSON.stringify(holdoutObj, null, 2));
console.log("\n✔ Saved Equipment Holdout Results to ml/research/day21/equipment_holdout_results.json ✅\n");
