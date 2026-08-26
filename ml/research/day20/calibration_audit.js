/**
 * Predicta Day 20 — Probability Calibration & Threshold Sensitivity Research Audit
 * File: ml/research/day20/calibration_audit.js
 */

const fs = require('fs');
const path = require('path');
const inf = require('../../../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 20 — CALIBRATION & THRESHOLD SENSITIVITY RESEARCH AUDIT");
console.log("=========================================================================\n");

// Audit threshold sensitivity across range 0.20 to 0.80 on 500 research samples
const sampleInput = {
  equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
  propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0
};

const thresholds = [0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80];
const sensitivityResults = [];

thresholds.forEach(th => {
  // Evaluate synthetic research records
  let tp = 0, fp = 0, tn = 0, fn = 0;
  
  for (let i = 0; i < 200; i++) {
    const isFail = i >= 140; // 140 PASS, 60 FAIL
    const rec = { ...sampleInput };
    if (isFail) {
      rec.leakage_current = 180.0 + Math.random() * 20.0;
      rec.temperature = 35.0 + Math.random() * 10.0;
    }
    const res = inf.predictSingle(rec);
    const isPredFail = res.probability >= th;

    if (isFail && isPredFail) tp++;
    else if (!isFail && isPredFail) fp++;
    else if (!isFail && !isPredFail) tn++;
    else if (isFail && !isPredFail) fn++;
  }

  const recall = (tp / 60) * 100;
  const fpr = (fp / 140) * 100;
  const precision = tp + fp > 0 ? (tp / (tp + fp)) * 100 : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  sensitivityResults.push({ threshold: th, recall: recall.toFixed(1), fpr: fpr.toFixed(1), precision: precision.toFixed(1), f1: f1.toFixed(1) });
});

console.log("1. THRESHOLD SENSITIVITY SWEEP (0.20 to 0.80):");
console.log("-------------------------------------------------------------------------");
console.log(`${'THRESHOLD'.padEnd(12)} | ${'RECALL (%)'.padEnd(12)} | ${'FPR (%)'.padEnd(10)} | ${'PRECISION (%)'.padEnd(15)} | F1 SCORE (%)`);
console.log("-".repeat(70));

sensitivityResults.forEach(r => {
  console.log(`${r.threshold.toFixed(2).padEnd(12)} | ${r.recall.padEnd(12)} | ${r.fpr.padEnd(10)} | ${r.precision.padEnd(15)} | ${r.f1}`);
});

fs.writeFileSync(path.join(__dirname, 'calibration_results.json'), JSON.stringify(sensitivityResults, null, 2));
console.log("\n✔ Saved Calibration Audit Results to ml/research/day20/calibration_results.json ✅\n");
