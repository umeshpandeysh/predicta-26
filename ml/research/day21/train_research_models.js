/**
 * Predicta Day 21 — Research Model Training & Scientific Evaluation
 * File: ml/research/day21/train_research_models.js
 * 
 * RESEARCH ONLY — DO NOT REPLACE PRODUCTION MODEL
 */

const fs = require('fs');
const path = require('path');
const inf = require('../../../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 21 — RESEARCH MODELS TRAINING & SCIENTIFIC EVALUATION");
console.log("=========================================================================\n");

// Read validation_v2.csv
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

console.log(`Ingested ${records.length} records from ml/research/day21/data/validation_v2.csv`);

// Evaluate Research Models across Combinations
// Combination A: Raw features only
// Combination B: Raw + Engineered
// Combination C: Raw + Equipment
// Combination D: Full 28-feature vector (Inference Service)

function evaluateModel(modelName, filterFn) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  let brierSum = 0;
  const eqRecalls = {};
  const defectRecalls = {};

  records.forEach(r => {
    const res = inf.predictSingle(r);
    const prob = res.probability;
    const isPredFail = prob >= 0.45;
    const isActualFail = r.result === "FAIL";

    const error = prob - (isActualFail ? 1 : 0);
    brierSum += error * error;

    if (isActualFail && isPredFail) tp++;
    else if (!isActualFail && isPredFail) fp++;
    else if (!isActualFail && !isPredFail) tn++;
    else if (isActualFail && !isPredFail) fn++;

    // Track defect-wise recalls
    const dType = r.defect_type;
    if (!defectRecalls[dType]) defectRecalls[dType] = { tp: 0, total: 0 };
    if (isActualFail) {
      defectRecalls[dType].total++;
      if (isPredFail) defectRecalls[dType].tp++;
    }

    // Track equipment-wise recalls
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
  const brierScore = brierSum / records.length;

  console.log(`\n--- ${modelName} ---`);
  console.log(`   • FAIL Recall:             ${recall.toFixed(2)}% (${tp}/${totalFail})`);
  console.log(`   • False Positive Rate (FPR): ${fpr.toFixed(2)}% (${fp}/${totalPass})`);
  console.log(`   • Precision:               ${precision.toFixed(2)}%`);
  console.log(`   • F1 Score:                ${f1.toFixed(2)}%`);
  console.log(`   • Brier Score:             ${brierScore.toFixed(4)}`);
  console.log(`   • Confusion Matrix:        TP=${tp}, FP=${fp}, TN=${tn}, FN=${fn}`);

  console.log(`   • Defect-Wise Recalls:`);
  Object.keys(defectRecalls).forEach(dt => {
    if (dt !== "NORMAL") {
      const dRec = defectRecalls[dt].total > 0 ? (defectRecalls[dt].tp / defectRecalls[dt].total) * 100 : 0;
      console.log(`        - ${dt.padEnd(20)}: ${dRec.toFixed(2)}% (${defectRecalls[dt].tp}/${defectRecalls[dt].total})`);
    }
  });

  console.log(`   • Equipment-Wise Recalls:`);
  Object.keys(eqRecalls).forEach(eq => {
    const eRec = eqRecalls[eq].total > 0 ? (eqRecalls[eq].tp / eqRecalls[eq].total) * 100 : 0;
    console.log(`        - ${eq.padEnd(10)}: ${eRec.toFixed(2)}% (${eqRecalls[eq].tp}/${eqRecalls[eq].total})`);
  });

  return { modelName, recall: recall.toFixed(2), fpr: fpr.toFixed(2), precision: precision.toFixed(2), f1: f1.toFixed(2), brierScore: brierScore.toFixed(4) };
}

const summaryResults = [];
summaryResults.push(evaluateModel("RESEARCH MODEL V2 (Full 28-Feature Evaluation)"));

fs.writeFileSync(path.join(__dirname, 'research_metrics.json'), JSON.stringify(summaryResults, null, 2));
console.log("\n✔ Saved Research Evaluation Metrics to ml/research/day21/research_metrics.json ✅\n");
