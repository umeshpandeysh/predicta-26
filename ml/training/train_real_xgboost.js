/**
 * Predicta Semiconductor Test Analytics Platform — Fast Histogram GBDT Model Trainer
 * File: ml/training/train_real_xgboost.js
 * 
 * Trains 500 Gradient Boosted Decision Trees on real dataset records:
 *   ml/data/synthetic/predicta_dataset_v3_50000.csv
 * 
 * Generates:
 *   - ml/models/production/predicta_xgboost_model.json
 *   - ml/models/production/predicta_xgboost_metadata.json
 *   - ml/models/production/predicta_production_manifest.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_DIR = path.join(__dirname, '../..');
const DATASET_PATH = path.join(BASE_DIR, 'ml/data/synthetic/predicta_dataset_v3_50000.csv');
const PROD_MODELS_DIR = path.join(BASE_DIR, 'ml/models/production');
const ROOT_MODELS_DIR = path.join(BASE_DIR, 'ml/models');

const RAW_NUMERICAL_FEATURES = [
  "supply_voltage", "output_voltage", "current", "leakage_current",
  "resistance", "capacitance", "threshold_voltage", "frequency",
  "propagation_delay", "setup_time", "hold_time", "timing_margin",
  "temperature", "dynamic_power", "total_power", "test_duration"
];

const ENGINEERED_FEATURES = [
  "voltage_headroom", "voltage_utilization", "leakage_fraction",
  "power_per_current", "normalized_timing_margin", "frequency_delay_product",
  "thermal_delta"
];

const EQUIPMENT_ONE_HOT_COLS = ["eq_EQP-101", "eq_EQP-102", "eq_EQP-103", "eq_EQP-104", "eq_EQP-105"];
const ALL_28_FEATURE_NAMES = [...RAW_NUMERICAL_FEATURES, ...ENGINEERED_FEATURES, ...EQUIPMENT_ONE_HOT_COLS];

const LOCKED_OPERATING_THRESHOLD = 0.20;

function parseCsvDataset(filePath) {
  console.log(`[TRAIN] Loading training dataset from ${filePath}...`);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  const header = lines[0].split(',').map(s => s.trim());

  const rawX = [];
  const y = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < header.length) continue;

    const row = {};
    header.forEach((name, idx) => {
      row[name] = parts[idx] ? parts[idx].trim() : '';
    });

    const resStr = (row.result || '').toUpperCase();
    const defStr = (row.defect_type || '').toUpperCase();
    const isDefect = resStr === 'FAIL' || resStr === 'REJECT' || resStr === '1' || (defStr && defStr !== 'NORMAL');
    const label = isDefect ? 1 : 0;

    const featVec = new Float64Array(28);

    // 16 Raw numericals
    RAW_NUMERICAL_FEATURES.forEach((f, idx) => {
      featVec[idx] = parseFloat(row[f]) || 0.0;
    });

    // 7 Engineered features
    const vSup = featVec[0];
    const vTh = featVec[6];
    const iTot = featVec[2];
    const iLeak = featVec[3];
    const pDyn = featVec[13];
    const tPd = featVec[8];
    const tMargin = featVec[11];
    const freq = featVec[7];
    const temp = featVec[12];

    featVec[16] = vSup - vTh;
    featVec[17] = vSup > 0 ? vTh / vSup : 0.0;
    featVec[18] = iTot > 0 ? (iLeak * 1e-3) / iTot : 0.0;
    featVec[19] = iTot > 0 ? pDyn / iTot : 0.0;
    featVec[20] = tPd > 0 ? tMargin / tPd : 0.0;
    featVec[21] = freq * tPd;
    featVec[22] = temp - 25.0;

    // 5 Equipment one-hot columns
    const eqId = row.equipment_id || 'EQP-101';
    EQUIPMENT_ONE_HOT_COLS.forEach((eqCol, idx) => {
      featVec[23 + idx] = (`eq_${eqId}` === eqCol) ? 1.0 : 0.0;
    });

    rawX.push(featVec);
    y.push(label);
  }

  const N = rawX.length;
  console.log(`[TRAIN] Raw dataset parsed: ${N} records, ${ALL_28_FEATURE_NAMES.length} features.`);

  // Dynamically calculate empirical mean and std for all 23 numerical features
  const referenceStats = {};
  const numericalFeatureNames = [...RAW_NUMERICAL_FEATURES, ...ENGINEERED_FEATURES];

  numericalFeatureNames.forEach((fName) => {
    const fIdx = ALL_28_FEATURE_NAMES.indexOf(fName);
    let sum = 0.0;
    for (let i = 0; i < N; i++) sum += rawX[i][fIdx];
    const mean = sum / N;

    let varSum = 0.0;
    for (let i = 0; i < N; i++) varSum += Math.pow(rawX[i][fIdx] - mean, 2);
    const std = Math.sqrt(varSum / N) || 1e-6;

    referenceStats[fName] = {
      mean: Number(mean.toFixed(4)),
      std: Number(std.toFixed(4))
    };
  });

  // Standardize X using calculated empirical referenceStats
  const X = rawX.map(row => {
    const norm = new Float64Array(28);
    for (let i = 0; i < 28; i++) {
      const fName = ALL_28_FEATURE_NAMES[i];
      if (referenceStats[fName]) {
        const { mean, std } = referenceStats[fName];
        norm[i] = (row[i] - mean) / std;
      } else {
        norm[i] = row[i];
      }
    }
    return norm;
  });

  const posCount = y.reduce((a, b) => a + b, 0);
  const negCount = N - posCount;
  const scalePosWeight = Number((negCount / posCount).toFixed(4));
  const initialLogit = Number((Math.log(posCount / negCount)).toFixed(4));

  console.log(`[TRAIN] Class distribution: ${posCount} FAIL (positive), ${negCount} PASS (negative).`);
  console.log(`[TRAIN] Programmatic scale_pos_weight: ${scalePosWeight}`);
  console.log(`[TRAIN] Programmatic initial logit (z0): ${initialLogit}`);

  return { X, y, referenceStats, scalePosWeight, initialLogit, posCount, negCount };
}

function quantizeDataset(X, numBins = 16) {
  const N = X.length;
  const numFeatures = ALL_28_FEATURE_NAMES.length;
  const binEdges = [];
  const Xbins = new Uint8Array(N * numFeatures);

  for (let f = 0; f < numFeatures; f++) {
    const vals = new Float64Array(N);
    for (let i = 0; i < N; i++) vals[i] = X[i][f];
    vals.sort();

    const edges = new Float64Array(numBins);
    for (let b = 0; b < numBins; b++) {
      const idx = Math.floor(((b + 1) / numBins) * (N - 1));
      edges[b] = vals[idx];
    }
    binEdges.push(edges);

    for (let i = 0; i < N; i++) {
      const val = X[i][f];
      let bin = 0;
      while (bin < numBins - 1 && val > edges[bin]) {
        bin++;
      }
      Xbins[i * numFeatures + f] = bin;
    }
  }

  return { binEdges, Xbins };
}

function trainGbdtHistogramModel(X, y, scalePosWeight, initialLogit) {
  const N = X.length;
  const numFeatures = ALL_28_FEATURE_NAMES.length;
  const numBins = 16;
  const { binEdges, Xbins } = quantizeDataset(X, numBins);

  const hyperparameters = {
    n_estimators: 500,
    max_depth: 5,
    learning_rate: 0.03,
    scale_pos_weight: scalePosWeight,
    reg_lambda: 1.0,
    eval_metric: "logloss",
    random_state: 42
  };

  const eta = hyperparameters.learning_rate;
  const lambda = hyperparameters.reg_lambda;
  const posWeight = hyperparameters.scale_pos_weight;

  const logits = new Float64Array(N);
  const probs = new Float64Array(N);
  const initialProb = 1.0 / (1.0 + Math.exp(-initialLogit));

  for (let i = 0; i < N; i++) {
    logits[i] = initialLogit;
    probs[i] = initialProb;
  }

  const trees = [];

  for (let treeIdx = 0; treeIdx < hyperparameters.n_estimators; treeIdx++) {
    const g = new Float64Array(N);
    const h = new Float64Array(N);

    for (let i = 0; i < N; i++) {
      const p = probs[i];
      const target = y[i];
      const weight = (target === 1) ? posWeight : 1.0;
      g[i] = (p - target) * weight;
      h[i] = Math.max(1e-6, p * (1.0 - p) * weight);
    }

    const sampleIndices = new Int32Array(N);
    for (let i = 0; i < N; i++) sampleIndices[i] = i;

    function fitNode(indices, depth) {
      let sumG = 0.0;
      let sumH = 0.0;
      for (let k = 0; k < indices.length; k++) {
        const idx = indices[k];
        sumG += g[idx];
        sumH += h[idx];
      }

      const leafValue = -eta * (sumG / (sumH + lambda));

      if (depth >= hyperparameters.max_depth || indices.length < 10) {
        return {
          depth: depth,
          isLeaf: true,
          leafValue: Number(leafValue.toFixed(6)),
          splitFeature: null,
          splitThreshold: null,
          left: null,
          right: null
        };
      }

      const baseScore = (sumG * sumG) / (sumH + lambda);
      let bestGain = 0.0;
      let bestFeatureIdx = -1;
      let bestBinIdx = -1;

      for (let f = 0; f < numFeatures; f++) {
        const binG = new Float64Array(numBins);
        const binH = new Float64Array(numBins);
        const binCount = new Int32Array(numBins);

        for (let k = 0; k < indices.length; k++) {
          const idx = indices[k];
          const b = Xbins[idx * numFeatures + f];
          binG[b] += g[idx];
          binH[b] += h[idx];
          binCount[b]++;
        }

        let gL = 0.0, hL = 0.0, countL = 0;
        for (let b = 0; b < numBins - 1; b++) {
          gL += binG[b];
          hL += binH[b];
          countL += binCount[b];
          const countR = indices.length - countL;
          if (countL === 0 || countR === 0) continue;

          const gR = sumG - gL;
          const hR = sumH - hL;

          const scoreL = (gL * gL) / (hL + lambda);
          const scoreR = (gR * gR) / (hR + lambda);
          const gain = 0.5 * (scoreL + scoreR - baseScore);

          if (gain > bestGain) {
            bestGain = gain;
            bestFeatureIdx = f;
            bestBinIdx = b;
          }
        }
      }

      if (bestFeatureIdx === -1 || bestGain <= 1e-4) {
        return {
          depth: depth,
          isLeaf: true,
          leafValue: Number(leafValue.toFixed(6)),
          splitFeature: null,
          splitThreshold: null,
          left: null,
          right: null
        };
      }

      const splitThresh = binEdges[bestFeatureIdx][bestBinIdx];
      const leftIdxs = [];
      const rightIdxs = [];

      for (let k = 0; k < indices.length; k++) {
        const idx = indices[k];
        if (Xbins[idx * numFeatures + bestFeatureIdx] <= bestBinIdx) {
          leftIdxs.push(idx);
        } else {
          rightIdxs.push(idx);
        }
      }

      const leftChild = fitNode(new Int32Array(leftIdxs), depth + 1);
      const rightChild = fitNode(new Int32Array(rightIdxs), depth + 1);

      return {
        depth: depth,
        isLeaf: false,
        leafValue: 0.0,
        splitFeature: ALL_28_FEATURE_NAMES[bestFeatureIdx],
        splitThreshold: Number(splitThresh.toFixed(4)),
        left: leftChild,
        right: rightChild
      };
    }

    const treeRoot = fitNode(sampleIndices, 0);
    treeRoot.tree_id = treeIdx;
    trees.push(treeRoot);

    function evalNode(node, featVec) {
      if (node.isLeaf) return node.leafValue;
      const fIdx = ALL_28_FEATURE_NAMES.indexOf(node.splitFeature);
      const val = fIdx >= 0 ? featVec[fIdx] : 0.0;
      if (val <= node.splitThreshold) {
        return evalNode(node.left, featVec);
      } else {
        return evalNode(node.right, featVec);
      }
    }

    for (let i = 0; i < N; i++) {
      const pred = evalNode(treeRoot, X[i]);
      logits[i] += pred;
      probs[i] = 1.0 / (1.0 + Math.exp(-logits[i]));
    }

    if ((treeIdx + 1) % 100 === 0 || treeIdx === 0) {
      let lossSum = 0.0;
      for (let i = 0; i < N; i++) {
        const pClamped = Math.max(1e-7, Math.min(1.0 - 1e-7, probs[i]));
        lossSum += -(y[i] * Math.log(pClamped) + (1 - y[i]) * Math.log(1 - pClamped));
      }
      const avgLoss = lossSum / N;
      console.log(`[TRAIN] Tree ${treeIdx + 1}/${hyperparameters.n_estimators} complete. LogLoss: ${avgLoss.toFixed(5)}`);
    }
  }

  return { trees, hyperparameters };
}

function runRealTrainingPipeline() {
  console.log("=========================================================================");
  console.log("PREDICTA — REAL FAST HISTOGRAM GBDT TRAINING ON 50,000 DATASET RECORDS");
  console.log("=========================================================================\n");

  const { X, y, referenceStats, scalePosWeight, initialLogit, posCount, negCount } = parseCsvDataset(DATASET_PATH);
  const { trees, hyperparameters } = trainGbdtHistogramModel(X, y, scalePosWeight, initialLogit);

  fs.mkdirSync(PROD_MODELS_DIR, { recursive: true });
  fs.mkdirSync(ROOT_MODELS_DIR, { recursive: true });

  const modelArtifact = {
    model_version: "2.0_production",
    model_type: "FastHistogramGBDT",
    model_architecture: "Predicta Fast Histogram Gradient Boosted Decision Tree",
    objective: "binary:logistic",
    base_score: initialLogit,
    num_features: 28,
    features: ALL_28_FEATURE_NAMES,
    trees_count: trees.length,
    trees: trees
  };

  const prodModelPath = path.join(PROD_MODELS_DIR, 'predicta_xgboost_model.json');
  const rootModelV2Path = path.join(ROOT_MODELS_DIR, 'predicta_xgboost_v2.json');

  const modelContent = JSON.stringify(modelArtifact, null, 2);
  fs.writeFileSync(prodModelPath, modelContent, 'utf-8');
  fs.writeFileSync(rootModelV2Path, modelContent, 'utf-8');

  const normalizedContent = modelContent.replace(/\r\n/g, '\n');
  const modelSha256 = crypto.createHash('sha256').update(normalizedContent, 'utf-8').digest('hex');

  console.log(`\n✔ Production Model file written to: ${prodModelPath}`);
  console.log(`✔ SHA-256 Checksum: ${modelSha256}`);

  const metadataArtifact = {
    model_name: "predicta_xgboost_model",
    model_version: "2.0_production",
    model_type: "FastHistogramGBDT",
    model_architecture: "Predicta Fast Histogram Gradient Boosted Decision Tree",
    model_sha256: modelSha256,
    raw_features: RAW_NUMERICAL_FEATURES,
    engineered_features: ENGINEERED_FEATURES,
    categorical_encoding: {
      feature: "equipment_id",
      encoding_type: "one_hot_encoding",
      categories: ["EQP-101", "EQP-102", "EQP-103", "EQP-104", "EQP-105"],
      one_hot_columns: EQUIPMENT_ONE_HOT_COLS
    },
    all_feature_names: ALL_28_FEATURE_NAMES,
    reference_stats: referenceStats,
    class_distribution: {
      total_records: X.length,
      positive_fail: posCount,
      negative_pass: negCount,
      scale_pos_weight: scalePosWeight,
      initial_logit: initialLogit
    },
    hyperparameters: hyperparameters,
    operating_threshold: LOCKED_OPERATING_THRESHOLD,
    training_dataset: "ml/data/synthetic/predicta_dataset_v3_50000.csv",
    training_records: X.length,
    created_timestamp: new Date().toISOString()
  };

  const prodMetadataPath = path.join(PROD_MODELS_DIR, 'predicta_xgboost_metadata.json');
  fs.writeFileSync(prodMetadataPath, JSON.stringify(metadataArtifact, null, 2), 'utf-8');
  fs.writeFileSync(path.join(ROOT_MODELS_DIR, 'predicta_xgboost_v2_metadata.json'), JSON.stringify(metadataArtifact, null, 2), 'utf-8');
  fs.writeFileSync(path.join(ROOT_MODELS_DIR, 'predicta_final_metadata.json'), JSON.stringify(metadataArtifact, null, 2), 'utf-8');

  console.log(`✔ Metadata Artifact written to: ${prodMetadataPath}`);

  const manifestArtifact = {
    manifest_version: "2.0.0",
    active_version: "2.0_production",
    contract_file: "ml/models/predicta_ml_contract.json",
    xgboost_model: "ml/models/production/predicta_xgboost_model.json",
    xgboost_metadata: "ml/models/production/predicta_xgboost_metadata.json",
    model_sha256: modelSha256,
    anomaly_artifacts: "ml/models/predicta_anomaly_artifacts.json",
    gpr_artifacts: "ml/models/predicta_gpr_kernel_artifacts.json",
    operating_threshold: LOCKED_OPERATING_THRESHOLD,
    status: "ACTIVE_PRODUCTION"
  };

  const prodManifestPath = path.join(PROD_MODELS_DIR, 'predicta_production_manifest.json');
  fs.writeFileSync(prodManifestPath, JSON.stringify(manifestArtifact, null, 2), 'utf-8');

  console.log(`✔ Production Manifest written to: ${prodManifestPath}`);
  console.log("\n=========================================================================");
  console.log("REAL GRADIENT BOOSTED TREE TRAINING AND ARTIFACT GENERATION COMPLETE! ✅");
  console.log("=========================================================================\n");
}

if (require.main === module) {
  runRealTrainingPipeline();
}

module.exports = { runRealTrainingPipeline, parseCsvDataset, trainGbdtHistogramModel };
