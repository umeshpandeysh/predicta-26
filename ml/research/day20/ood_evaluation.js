/**
 * Predicta Day 20 — Independent Out-of-Distribution (OOD) Research Evaluation
 * File: ml/research/day20/ood_evaluation.js
 */

const fs = require('fs');
const path = require('path');
const inf = require('../../../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 20 — INDEPENDENT OOD RESEARCH EVALUATION");
console.log("=========================================================================\n");

// Generate 500 independent OOD research samples with overlapping distributions, sensor noise & shifted means
const oodSamples = [];
const numSamples = 500;

for (let i = 0; i < numSamples; i++) {
  const isDefect = i >= 350; // 70% Normal (350), 30% Defect (150)
  
  // Base Parameters with increased noise & shifted equipment offsets
  const eqId = `EQP-10${(i % 5) + 1}`;
  const eqOffset = (i % 5) * 0.5; // Sensor offset
  
  const rec = {
    test_id: `OOD-${(i + 1).toString().padStart(4, '0')}`,
    equipment_id: eqId,
    supply_voltage: 1.18 + Math.random() * 0.05,
    output_voltage: 1.15 + Math.random() * 0.05,
    current: 42.0 + Math.random() * 8.0,
    leakage_current: isDefect ? (130.0 + Math.random() * 85.0 + eqOffset) : (105.0 + Math.random() * 45.0 + eqOffset),
    resistance: 12.0 + Math.random() * 2.0,
    capacitance: 4.0 + Math.random() * 0.5,
    threshold_voltage: 0.44 + Math.random() * 0.04,
    frequency: isDefect ? (2350.0 + Math.random() * 150.0) : (2480.0 + Math.random() * 100.0),
    propagation_delay: isDefect ? (12.2 + Math.random() * 3.5) : (11.4 + Math.random() * 1.0),
    setup_time: 1.1 + Math.random() * 0.2,
    hold_time: 0.75 + Math.random() * 0.1,
    timing_margin: isDefect ? (1.5 + Math.random() * 1.0) : (2.2 + Math.random() * 0.5),
    temperature: isDefect ? (28.0 + Math.random() * 14.0) : (25.5 + Math.random() * 4.0),
    dynamic_power: 45.0 + Math.random() * 15.0,
    total_power: 55.0 + Math.random() * 18.0,
    test_duration: 12.0 + Math.random() * 5.0,
    ground_truth: isDefect ? "FAIL" : "PASS"
  };

  const res = inf.predictSingle(rec);
  oodSamples.push({ ...rec, prediction: res.prediction, probability: res.probability, op_decision: res.operational_decision });
}

// Compute Confusion Matrix & Metrics at Threshold 0.45
let tp = 0, fp = 0, tn = 0, fn = 0;
let lowRiskPass = 0, reviewSecondary = 0, criticalFail = 0;

oodSamples.forEach(s => {
  const isPredFail = s.probability >= 0.45;
  if (s.ground_truth === "FAIL" && isPredFail) tp++;
  else if (s.ground_truth === "PASS" && isPredFail) fp++;
  else if (s.ground_truth === "PASS" && !isPredFail) tn++;
  else if (s.ground_truth === "FAIL" && !isPredFail) fn++;

  if (s.op_decision === "FAIL") criticalFail++;
  else if (s.op_decision === "SECONDARY_TEST") reviewSecondary++;
  else lowRiskPass++;
});

const totalPass = 350;
const totalFail = 150;
const recall = (tp / totalFail) * 100;
const fpr = (fp / totalPass) * 100;
const precision = (tp / (tp + fp)) * 100;
const f1 = (2 * precision * recall) / (precision + recall);

console.log(`OOD Research Dataset Size: ${numSamples} records (350 PASS, 150 FAIL)`);
console.log(`-------------------------------------------------------------------------`);
console.log(`   • FAIL Recall:             ${recall.toFixed(2)}% (${tp}/${totalFail})`);
console.log(`   • False Positive Rate (FPR): ${fpr.toFixed(2)}% (${fp}/${totalPass})`);
console.log(`   • Precision:               ${precision.toFixed(2)}%`);
console.log(`   • F1 Score:                ${f1.toFixed(2)}%`);
console.log(`   • Confusion Matrix:        TP=${tp}, FP=${fp}, TN=${tn}, FN=${fn}`);
console.log(`   • Operational Triage Breakdown:`);
console.log(`        - 🟢 LOW_RISK PASS:         ${lowRiskPass} (${(lowRiskPass/numSamples*100).toFixed(1)}%)`);
console.log(`        - 🟡 REVIEW SECONDARY_TEST: ${reviewSecondary} (${(reviewSecondary/numSamples*100).toFixed(1)}%)`);
console.log(`        - 🔴 CRITICAL FAIL:         ${criticalFail} (${(criticalFail/numSamples*100).toFixed(1)}%)`);

const resultsObj = {
  samples: numSamples,
  recall: recall.toFixed(2),
  fpr: fpr.toFixed(2),
  precision: precision.toFixed(2),
  f1: f1.toFixed(2),
  tp, fp, tn, fn,
  triage: { lowRiskPass, reviewSecondary, criticalFail }
};

fs.writeFileSync(path.join(__dirname, 'ood_results.json'), JSON.stringify(resultsObj, null, 2));
console.log("\n✔ Saved OOD Research Evaluation Results to ml/research/day20/ood_results.json ✅\n");
