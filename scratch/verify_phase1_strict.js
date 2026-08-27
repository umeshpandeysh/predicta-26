/**
 * Phase 1 Strict Verification Script (Train Lots 1-35 vs Held-out Test Lots 36-50)
 * File: scratch/verify_phase1_strict.js
 */

const fs = require('fs');
const path = require('path');
const inf = require('../src/api/inference');

const csvPath = path.join(__dirname, '../data/synthetic/ps170_synthetic_full.csv');
const artifactPath = path.join(__dirname, '../ml/models/predicta_anomaly_artifacts.json');

console.log("=========================================================================");
console.log("PHASE 1 STRICT VERIFICATION & HELD-OUT EVALUATION (LOTS 36-50)");
console.log("=========================================================================\n");

// 1. Check Artifact Train Split Confirmation
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const trainedLotKeys = Object.keys(artifact.robust_mad.lot_stats);
console.log(`Artifact Model Version: ${artifact.model_version}`);
console.log(`Trained Lot Keys Count: ${trainedLotKeys.length} (Lots: ${trainedLotKeys.join(', ')})`);
const allTrainedInLots1to35 = trainedLotKeys.every(k => parseInt(k.replace(/\D/g, ''), 10) <= 35);
console.log(`Train/Holdout Split Check: ${allTrainedInLots1to35 ? "✅ Artifact built STRICTLY from Lots 1–35 ONLY" : "❌ Leakage detected in artifact!"}\n`);

// 2. Load held-out test data (Lots 36 to 50 at 24h)
const content = fs.readFileSync(csvPath, 'utf8');
const lines = content.trim().split(/\r?\n/);
const header = lines[0].split(',');

const testRecords = [];
lines.slice(1).forEach(line => {
  const cols = line.split(',');
  if (cols.length < header.length) return;
  const hour = Number(cols[header.indexOf('burn_in_hour')]);
  const lotId = cols[header.indexOf('lot_id')];
  const lotNum = parseInt(lotId.replace(/\D/g, ''), 10);

  // Held-out test set: Lots 36 to 50 at 24h
  if (hour === 24 && lotNum >= 36) {
    testRecords.push({
      component_id: cols[header.indexOf('component_id')],
      lot_id: lotId,
      equipment_id: "EQP-101",
      current: Number(cols[header.indexOf('iddq')]),
      leakage_current: Number(cols[header.indexOf('ileak')]),
      propagation_delay: Number(cols[header.indexOf('tpd')]),
      health_state: cols[header.indexOf('health_state')],
      anomaly_label: Number(cols[header.indexOf('anomaly_label')]),
      // 16 dummy fields required for full schema validation
      supply_voltage: 1.20, output_voltage: 1.18, resistance: 12.0, capacitance: 4.0,
      threshold_voltage: 0.45, frequency: 2500.0, setup_time: 1.2, hold_time: 0.8,
      timing_margin: 2.2, temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0
    });
  }
});

console.log(`Held-out Test Records (Lots 36-50 at 24h): ${testRecords.length}`);

// Ground truth mapping: Anomaly if anomaly_label === 1 OR health_state !== "HEALTHY"
function getMetrics(preds, actuals) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (let i = 0; i < preds.length; i++) {
    if (preds[i] && actuals[i]) tp++;
    else if (preds[i] && !actuals[i]) fp++;
    else if (!preds[i] && !actuals[i]) tn++;
    else fn++;
  }
  const precision = tp + fp > 0 ? (tp / (tp + fp)).toFixed(4) : "0.0000";
  const recall = tp + fn > 0 ? (tp / (tp + fn)).toFixed(4) : "0.0000";
  return { tp, fp, tn, fn, precision: Number(precision), recall: Number(recall) };
}

const actualAnomalies = testRecords.map(r => r.anomaly_label === 1 || r.health_state !== "HEALTHY" ? 1 : 0);

// Evaluate PAT metrics (Z > 3.0 Warning, Z > 6.0 Reject)
const patRejectPreds = [];
const patAnyPreds = [];
const copodWarningPreds = [];
const copodRejectPreds = [];
const combinedAnomalousPreds = []; // REJECT level
const combinedAnyPreds = []; // MONITOR or REJECT level

testRecords.forEach(rec => {
  const patRes = inf.evaluatePatMad(rec, rec.lot_id);
  const copodRes = inf.evaluateCopod(rec);
  const det = inf.combineAnomalyEvidence(patRes, copodRes);

  patRejectPreds.push(patRes.status === "REJECT" ? 1 : 0);
  patAnyPreds.push(patRes.status !== "PASS" ? 1 : 0);

  copodWarningPreds.push(copodRes.score > 6.5 ? 1 : 0);
  copodRejectPreds.push(copodRes.score > 9.5 ? 1 : 0);

  combinedAnomalousPreds.push(det.overall_status === "ANOMALOUS" ? 1 : 0);
  combinedAnyPreds.push(det.overall_status !== "NORMAL" ? 1 : 0);
});

console.log("\n--- 1. RECALCULATED PAT METRICS (HELD-OUT LOTS 36-50) ---");
const patRejectMetrics = getMetrics(patRejectPreds, actualAnomalies);
const patAnyMetrics = getMetrics(patAnyPreds, actualAnomalies);
console.log("PAT Reject Level (Z > 6.0):", patRejectMetrics);
console.log("PAT Any Warning Level (Z > 3.0):", patAnyMetrics);

console.log("\n--- 2. RECALCULATED COPOD METRICS (HELD-OUT LOTS 36-50) ---");
const copod65Metrics = getMetrics(copodWarningPreds, actualAnomalies);
const copod95Metrics = getMetrics(copodRejectPreds, actualAnomalies);
console.log("COPOD Warning Threshold (Score > 6.5):", copod65Metrics);
console.log("COPOD Reject Threshold (Score > 9.5):", copod95Metrics);

console.log("\n--- 3. RECALCULATED COMBINED PAT + COPOD METRICS (HELD-OUT LOTS 36-50) ---");
const combinedAnomalousMetrics = getMetrics(combinedAnomalousPreds, actualAnomalies);
const combinedAnyMetrics = getMetrics(combinedAnyPreds, actualAnomalies);
console.log("Combined ANOMALOUS Level (PAT=REJECT || COPOD=REJECT):", combinedAnomalousMetrics);
console.log("Combined MONITOR/ANOMALOUS Level (PAT!=PASS || COPOD!=PASS):", combinedAnyMetrics);

console.log("\n=========================================================================");
console.log("STRICT VERIFICATION RUN COMPLETE");
console.log("=========================================================================\n");
