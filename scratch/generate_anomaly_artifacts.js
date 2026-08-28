/**
 * Artifact Generator Script for PREDICTA Anomaly Detection (PAT + COPOD)
 * File: scratch/generate_anomaly_artifacts.js
 */

const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '../data/synthetic/SEMICONDUCTOR_TELEMETRY_synthetic_full.csv');
const artifactPath = path.join(__dirname, '../ml/models/predicta_anomaly_artifacts.json');

console.log("Generating PREDICTA Anomaly Artifacts (PAT + COPOD)...");

const content = fs.readFileSync(csvPath, 'utf8');
const lines = content.trim().split(/\r?\n/);
const header = lines[0].split(',');

// Filter 24h training data (lots 1 to 35)
const trainRecords = [];
lines.slice(1).forEach(line => {
  const cols = line.split(',');
  if (cols.length < header.length) return;
  const hour = Number(cols[header.indexOf('burn_in_hour')]);
  const lotId = cols[header.indexOf('lot_id')];
  const lotNum = parseInt(lotId.replace(/\D/g, ''), 10);
  
  if (hour === 24 && lotNum <= 35) {
    trainRecords.push({
      component_id: cols[header.indexOf('component_id')],
      lot_id: lotId,
      iddq: Number(cols[header.indexOf('iddq')]),
      ileak: Number(cols[header.indexOf('ileak')]),
      tpd: Number(cols[header.indexOf('tpd')])
    });
  }
});

console.log(`Training 24h records loaded: ${trainRecords.length}`);

// 1. PAT / Robust MAD Global & Lot Stats
function calcMedian(arr) {
  const sorted = arr.slice().sort((a,b)=>a-b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid-1] + sorted[mid]) / 2;
}

function calcMAD(arr, median) {
  const mads = arr.map(v => Math.abs(v - median)).sort((a,b)=>a-b);
  return calcMedian(mads);
}

const params = ['iddq', 'ileak', 'tpd'];
const globalStats = {};

params.forEach(p => {
  const vals = trainRecords.map(r => r[p]);
  const median = calcMedian(vals);
  const mad = calcMAD(vals, median);
  const sigma = Math.max(1e-6, 1.4826 * mad);
  globalStats[p] = { median: Number(median.toFixed(4)), mad: Number(mad.toFixed(4)), sigma: Number(sigma.toFixed(4)) };
});

const lotStats = {};
const lotGroups = {};
trainRecords.forEach(r => {
  if (!lotGroups[r.lot_id]) lotGroups[r.lot_id] = { iddq: [], ileak: [], tpd: [] };
  params.forEach(p => lotGroups[r.lot_id][p].push(r[p]));
});

Object.keys(lotGroups).forEach(lotId => {
  lotStats[lotId] = {};
  params.forEach(p => {
    const vals = lotGroups[lotId][p];
    const median = calcMedian(vals);
    const mad = calcMAD(vals, median);
    const sigma = Math.max(1e-6, 1.4826 * mad);
    lotStats[lotId][p] = { median: Number(median.toFixed(4)), mad: Number(mad.toFixed(4)), sigma: Number(sigma.toFixed(4)) };
  });
});

// 2. COPOD Global Empirical CDF arrays
const globalEcdfs = {};
params.forEach(p => {
  globalEcdfs[p] = trainRecords.map(r => Number(r[p].toFixed(4))).sort((a,b)=>a-b);
});

const artifactData = {
  model_version: "1.0_anomaly_prod",
  features: params,
  robust_mad: {
    global_stats: globalStats,
    lot_stats: lotStats,
    thresholds: {
      warning_z: 3.0,
      reject_z: 6.0
    }
  },
  copod: {
    global_ecdfs: globalEcdfs,
    thresholds: {
      warning_score: 6.5,
      reject_score: 9.5
    }
  }
};

fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
fs.writeFileSync(artifactPath, JSON.stringify(artifactData, null, 2), 'utf8');

console.log(`Successfully generated anomaly artifact: ${artifactPath}`);
console.log("Global Robust MAD Stats:", globalStats);
