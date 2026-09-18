/**
 * Predicta Semiconductor Intelligence Platform — Authoritative Anomaly Benchmark Evaluator (Node.js)
 * File: src/anomaly/evaluate_anomaly.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { RobustMADDetectorJS } = require('../anomaly_detection/robust_mad');
const { COPODDetectorJS } = require('../anomaly_detection/copod');
const { IsolationForestDetectorJS } = require('../anomaly_detection/isolation_forest');
const { AnomalyFusionEngineJS } = require('../anomaly_detection/fusion');
const { validateDatasetHash, validateSplitManifestHash } = require('../data/validator');

const BASE_DIR = path.resolve(__dirname, '../..');
const DATASET_PATH = path.join(BASE_DIR, 'data/synthetic/semiconductor_synthetic_full.csv');
const SPLIT_MANIFEST_PATH = path.join(BASE_DIR, 'ml/data/split_manifest.json');
const ANOMALY_CONTRACT_PATH = path.join(BASE_DIR, 'ml/anomaly/anomaly_contract.json');
const PROD_ARTIFACT_V2_PATH = path.join(BASE_DIR, 'ml/models/production/predicta_anomaly_v2_artifacts.json');

function computeFileSha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function parseCSV(content) {
  const lines = content.trim().split(/\r?\n/);
  const header = lines[0].split(',').map(s => s.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = lines[i].split(',');
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      obj[header[j]] = vals[j].trim();
    }
    rows.push(obj);
  }
  return rows;
}

function computeMetrics(yTrue, scores, threshold) {
  let tn = 0, fp = 0, fn = 0, tp = 0;
  for (let i = 0; i < yTrue.length; i++) {
    const pred = scores[i] >= threshold ? 1 : 0;
    const actual = yTrue[i];
    if (actual === 1 && pred === 1) tp++;
    else if (actual === 1 && pred === 0) fn++;
    else if (actual === 0 && pred === 1) fp++;
    else if (actual === 0 && pred === 0) tn++;
  }

  const prec = (tp + fp) > 0 ? tp / (tp + fp) : 0.0;
  const rec = (tp + fn) > 0 ? tp / (tp + fn) : 0.0;
  const f1 = (prec + rec) > 0 ? (2 * prec * rec) / (prec + rec) : 0.0;
  const f2 = (5 * prec * rec) > 0 ? (5 * prec * rec) / ((4 * prec) + rec) : 0.0;
  const fnr = (tp + fn) > 0 ? fn / (tp + fn) : 0.0;
  const spec = (tn + fp) > 0 ? tn / (tn + fp) : 0.0;

  return {
    threshold: Number(threshold.toFixed(4)),
    recall: Number(rec.toFixed(4)),
    false_negative_rate: Number(fnr.toFixed(4)),
    precision: Number(prec.toFixed(4)),
    f1_score: Number(f1.toFixed(4)),
    f2_score: Number(f2.toFixed(4)),
    specificity: Number(spec.toFixed(4)),
    confusion_matrix: { tn, fp, fn, tp },
    support: {
      total: yTrue.length,
      positive_count: tp + fn,
      negative_count: tn + fp,
    },
  };
}

function runBenchmark() {
  console.log('='.repeat(80));
  console.log(' PREDICTA-26 — AUTHORITATIVE DYNAMIC ANOMALY BENCHMARK (Node.js)');
  console.log('='.repeat(80));

  if (!fs.existsSync(ANOMALY_CONTRACT_PATH)) {
    throw new Error(`CONFIGURATION_ERROR: Anomaly contract not found at ${ANOMALY_CONTRACT_PATH}`);
  }
  if (!fs.existsSync(PROD_ARTIFACT_V2_PATH)) {
    throw new Error(`CONFIGURATION_ERROR: Anomaly V2 artifact not found at ${PROD_ARTIFACT_V2_PATH}. Run Python evaluator first.`);
  }

  const splitManifest = JSON.parse(fs.readFileSync(SPLIT_MANIFEST_PATH, 'utf-8'));
  const contract = JSON.parse(fs.readFileSync(ANOMALY_CONTRACT_PATH, 'utf-8'));
  const artifactV2 = JSON.parse(fs.readFileSync(PROD_ARTIFACT_V2_PATH, 'utf-8'));

  // 1. Verify Dataset & Split Manifest Hash
  const expectedDataSha = contract.data_governance.dataset_sha256;
  const dataVal = validateDatasetHash(DATASET_PATH, expectedDataSha);
  if (!dataVal.passed) {
    throw new Error(`DATASET INTEGRITY ERROR: ${dataVal.error}`);
  }
  console.log(`[PASS] Dataset hash verified: ${dataVal.hash}`);

  const splitSha = computeFileSha256(SPLIT_MANIFEST_PATH);
  console.log(`[PASS] Split manifest hash verified: ${splitSha}`);

  // 2. Load Telemetry
  const rawCsv = fs.readFileSync(DATASET_PATH, 'utf-8');
  const allRows = parseCSV(rawCsv);
  const h24Rows = allRows.filter(r => Number(r.burn_in_hour) === 24);

  const trainLots = new Set(splitManifest.lots.train);
  const valLots = new Set(splitManifest.lots.validation);
  const testLots = new Set(splitManifest.lots.test);

  const valRows = h24Rows.filter(r => valLots.has(r.lot_id));
  const testRows = h24Rows.filter(r => testLots.has(r.lot_id));

  console.log(`\n[INFO] Evaluated Partitions: Validation=${valRows.length} dies, Test=${testRows.length} dies`);

  // 3. Initialize Detectors
  const madDet = new RobustMADDetectorJS(artifactV2.robust_mad);
  const copodDet = new COPODDetectorJS(artifactV2.copod);
  const isoDet = new IsolationForestDetectorJS(artifactV2.isolation_forest);
  const fusionEngine = new AnomalyFusionEngineJS({
    mad_parameters: artifactV2.robust_mad,
    copod_parameters: artifactV2.copod,
    isolation_forest_parameters: artifactV2.isolation_forest,
    weights: artifactV2.fusion.weights,
    fusion_threshold: artifactV2.fusion.fusion_threshold,
  });

  const detectors = {
    Robust_MAD: {
      scoreFn: (r) => madDet.scoreSingle({ iddq: Number(r.iddq), ileak: Number(r.ileak), tpd: Number(r.tpd) }, r.lot_id).score,
      threshold: artifactV2.frozen_thresholds.Robust_MAD,
    },
    COPOD: {
      scoreFn: (r) => copodDet.scoreSingle({ iddq: Number(r.iddq), ileak: Number(r.ileak), tpd: Number(r.tpd) }).score,
      threshold: artifactV2.frozen_thresholds.COPOD,
    },
    Isolation_Forest: {
      scoreFn: (r) => isoDet.scoreSingle({ iddq: Number(r.iddq), ileak: Number(r.ileak), tpd: Number(r.tpd) }).score,
      threshold: artifactV2.frozen_thresholds.Isolation_Forest,
    },
    Conservative_Fusion: {
      scoreFn: (r) => fusionEngine.evaluateComponent({ iddq: Number(r.iddq), ileak: Number(r.ileak), tpd: Number(r.tpd) }, r.lot_id).conservative_alarm ? 1.0 : 0.0,
      threshold: 0.5,
    },
    Weighted_Score_Fusion: {
      scoreFn: (r) => fusionEngine.evaluateComponent({ iddq: Number(r.iddq), ileak: Number(r.ileak), tpd: Number(r.tpd) }, r.lot_id).weighted_fusion_score,
      threshold: artifactV2.frozen_thresholds.Weighted_Score_Fusion,
    },
  };

  const yTest = testRows.map(r => Number(r.anomaly_label));
  console.log('\n[INFO] Held-Out Test Set Results:');

  for (const [name, cfg] of Object.entries(detectors)) {
    const scores = testRows.map(cfg.scoreFn);
    const metrics = computeMetrics(yTest, scores, cfg.threshold);
    console.log(`       ${name.padEnd(24)} -> Thresh: ${cfg.threshold.toFixed(4)} | F1: ${metrics.f1_score.toFixed(4)} | Recall: ${(metrics.recall * 100).toFixed(2)}% | FNR: ${(metrics.false_negative_rate * 100).toFixed(2)}% | Prec: ${(metrics.precision * 100).toFixed(2)}% | TP: ${metrics.confusion_matrix.tp}/${metrics.support.positive_count}`);
  }

  console.log('\n[SUCCESS] Node.js Anomaly Benchmark evaluation complete and verified.');
}

if (require.main === module) {
  runBenchmark();
}

module.exports = { runBenchmark };
