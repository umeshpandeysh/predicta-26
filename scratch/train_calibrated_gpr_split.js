/**
 * Phase 2D — Strict 3-Way Lot Split GPR Training & Observation Noise Calibration
 * File: scratch/train_calibrated_gpr_split.js
 * 
 * Strict Lot Allocation:
 *   TRAIN:       Lots 1–30 (N = 3,000)
 *   CALIBRATION: Lots 31–35 (N = 500)
 *   FINAL TEST:  Lots 36–50 (N = 1,500) — UNTOUCHED UNTIL FINAL EVALUATION
 */

const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '../data/synthetic/SEMICONDUCTOR_TELEMETRY_synthetic_full.csv');
const artifactPath = path.join(__dirname, '../ml/models/predicta_gpr_kernel_artifacts.json');

console.log("=========================================================================");
console.log("PHASE 2D — 3-WAY LOT SPLIT GPR TRAINING & CALIBRATION");
console.log("=========================================================================\n");

const content = fs.readFileSync(csvPath, 'utf8');
const lines = content.trim().split(/\r?\n/);
const header = lines[0].split(',');

const trainComps = {};
const calComps = {};
const testComps = {};

lines.slice(1).forEach(line => {
  const cols = line.split(',');
  if (cols.length < header.length) return;
  const compId = cols[header.indexOf('component_id')];
  const lotId = cols[header.indexOf('lot_id')];
  const lotNum = parseInt(lotId.replace(/\D/g, ''), 10);
  const hour = Number(cols[header.indexOf('burn_in_hour')]);

  let targetMap = null;
  if (lotNum >= 1 && lotNum <= 30) targetMap = trainComps;
  else if (lotNum >= 31 && lotNum <= 35) targetMap = calComps;
  else if (lotNum >= 36 && lotNum <= 50) targetMap = testComps;

  if (!targetMap) return;

  if (!targetMap[compId]) targetMap[compId] = { id: compId, lot_id: lotId, times: {} };
  targetMap[compId].times[hour] = {
    iddq: Number(cols[header.indexOf('iddq')]),
    ileak: Number(cols[header.indexOf('ileak')]),
    tpd: Number(cols[header.indexOf('tpd')])
  };
});

const trainList = Object.values(trainComps).filter(c => c.times[0] && c.times[24] && c.times[168]);
const calList = Object.values(calComps).filter(c => c.times[0] && c.times[24] && c.times[168]);
const testList = Object.values(testComps).filter(c => c.times[0] && c.times[24] && c.times[168]);

console.log("STRICT LOT ALLOCATION VERIFICATION:");
console.log(`  TRAIN LOTS:       Lots 1–30 (N = ${trainList.length} components)`);
console.log(`  CALIBRATION LOTS: Lots 31–35 (N = ${calList.length} components)`);
console.log(`  FINAL TEST LOTS:  Lots 36–50 (N = ${testList.length} components)`);
console.log("  ZERO LOT OVERLAP CONFIRMED! ✅\n");

const params = ['iddq', 'ileak', 'tpd'];
const gprKernelArtifacts = {
  model_version: "2.2_calibrated_gpr_3way_split",
  model_type: "GaussianProcessRegressor_Calibrated",
  kernel: "RBF(length_scale) + WhiteKernel(noise_level)",
  lot_split: {
    train_lots: "LOT-SYN-001 through LOT-SYN-030",
    calibration_lots: "LOT-SYN-031 through LOT-SYN-035",
    test_lots: "LOT-SYN-036 through LOT-SYN-050"
  },
  parameters: {}
};

const calibrationSummary = {};

params.forEach(param => {
  console.log(`Fitting GPR & Calibrating Observation Noise for '${param}'...`);

  // Step 1: Feature & Target Preparation (TRAIN LOTS 1–30 ONLY)
  const X_raw = [];
  const y_raw = [];

  trainList.forEach(c => {
    const p0 = c.times[0][param];
    const p24 = c.times[24][param];
    const p168 = c.times[168][param];
    const delta24 = p24 - p0;
    const delta168 = p168 - p24;
    X_raw.push([p0, p24, delta24]);
    y_raw.push(delta168);
  });

  const N = X_raw.length;
  const numFeats = 3;
  const means = [];
  const stds = [];

  for (let j = 0; j < numFeats; j++) {
    const vals = X_raw.map(row => row[j]);
    const mean = vals.reduce((a,b)=>a+b,0) / N;
    const std = Math.sqrt(vals.reduce((a,b)=>a + Math.pow(b - mean, 2), 0) / (N - 1));
    means.push(mean);
    stds.push(Math.max(1e-6, std));
  }

  const X_norm = X_raw.map(row => row.map((v, j) => (v - means[j]) / stds[j]));

  const y_mean = y_raw.reduce((a,b)=>a+b,0) / N;
  const y_std = Math.sqrt(y_raw.reduce((a,b)=>a + Math.pow(b - y_mean, 2), 0) / (N - 1));
  const y_norm = y_raw.map(v => (v - y_mean) / Math.max(1e-6, y_std));

  // Hyperparameters
  const lengthScale = 1.2;
  const sigmaF2 = 1.0;
  const sigmaN2 = 0.02;

  function rbfKernel(x1, x2) {
    let distSq = 0;
    for (let j = 0; j < numFeats; j++) {
      distSq += Math.pow(x1[j] - x2[j], 2);
    }
    return sigmaF2 * Math.exp(-distSq / (2 * Math.pow(lengthScale, 2)));
  }

  // 60 support points sampled from Train Lots 1-30
  const numSupport = 60;
  const step = Math.floor(N / numSupport);
  const supportX = [];
  const supportYNorm = [];

  for (let i = 0; i < N; i += step) {
    if (supportX.length < numSupport) {
      supportX.push(X_norm[i]);
      supportYNorm.push(y_norm[i]);
    }
  }

  const S = supportX.length;

  // Build S x S kernel matrix K and Gauss-Jordan inverse
  const K = [];
  for (let i = 0; i < S; i++) {
    K[i] = [];
    for (let j = 0; j < S; j++) {
      let kVal = rbfKernel(supportX[i], supportX[j]);
      if (i === j) kVal += sigmaN2;
      K[i][j] = kVal;
    }
  }

  const aug = [];
  for (let i = 0; i < S; i++) {
    aug[i] = [];
    for (let j = 0; j < S; j++) aug[i][j] = K[i][j];
    for (let j = 0; j < S; j++) aug[i][S + j] = i === j ? 1.0 : 0.0;
  }

  for (let i = 0; i < S; i++) {
    let pivot = aug[i][i];
    if (Math.abs(pivot) < 1e-12) pivot = 1e-6;
    for (let j = 0; j < 2 * S; j++) aug[i][j] /= pivot;
    for (let k = 0; k < S; k++) {
      if (k !== i) {
        const factor = aug[k][i];
        for (let j = 0; j < 2 * S; j++) aug[k][j] -= factor * aug[i][j];
      }
    }
  }

  const K_inv = [];
  for (let i = 0; i < S; i++) {
    K_inv[i] = [];
    for (let j = 0; j < S; j++) {
      K_inv[i][j] = Number(aug[i][S + j].toFixed(6));
    }
  }

  const alpha = [];
  for (let i = 0; i < S; i++) {
    let sum = 0;
    for (let j = 0; j < S; j++) {
      sum += K_inv[i][j] * supportYNorm[j];
    }
    alpha.push(Number(sum.toFixed(6)));
  }

  const rawSupportX = supportX.map(row => row.map((v, j) => Number((v * stds[j] + means[j]).toFixed(4))));

  // Step 2 & 3: CALIBRATION SPLIT EVALUATION (LOTS 31–35 ONLY)
  const calResids = [];
  const calLatentSigmas = [];
  let calCoverageCount = 0;

  calList.forEach(c => {
    const val0 = c.times[0][param];
    const val24 = c.times[24][param];
    const actual168 = c.times[168][param];
    const delta24 = val24 - val0;
    const xRaw = [val0, val24, delta24];

    const xNorm = xRaw.map((v, j) => (v - means[j]) / stds[j]);

    const kVec = [];
    supportX.forEach(sup => {
      let distSq = 0;
      for (let j = 0; j < 3; j++) distSq += Math.pow(xNorm[j] - sup[j], 2);
      kVec.push(sigmaF2 * Math.exp(-distSq / (2.0 * Math.pow(lengthScale, 2))));
    });

    let predDelta = y_mean;
    for (let i = 0; i < S; i++) predDelta += alpha[i] * kVec[i] * y_std;
    const pred168 = val24 + predDelta;

    const kXX = sigmaF2 + sigmaN2;
    let varReduction = 0;
    for (let i = 0; i < S; i++) {
      for (let j = 0; j < S; j++) {
        varReduction += kVec[i] * K_inv[i][j] * kVec[j];
      }
    }
    const predVarNorm = Math.max(1e-6, kXX - varReduction);
    const latentStd = Math.sqrt(predVarNorm) * y_std;

    const resid = actual168 - pred168;
    calResids.push(resid);
    calLatentSigmas.push(latentStd);
  });

  const N_cal = calList.length;
  const calMAE = calResids.reduce((a,b)=>a+Math.abs(b),0) / N_cal;
  const calRMSE = Math.sqrt(calResids.reduce((a,b)=>a+Math.pow(b,2),0) / N_cal);
  const calResidMean = calResids.reduce((a,b)=>a+b,0) / N_cal;
  const calResidStd = Math.sqrt(calResids.reduce((a,b)=>a+Math.pow(b-calResidMean,2),0) / N_cal);
  const meanLatentStd = calLatentSigmas.reduce((a,b)=>a+b,0) / N_cal;

  // Calculate observation noise sigma_obs = sqrt(max(0, calResidStd^2 - meanLatentStd^2))
  const sigmaObsSq = Math.max(1e-4, Math.pow(calResidStd, 2) - Math.pow(meanLatentStd, 2));
  const sigmaObs = Math.sqrt(sigmaObsSq);

  // Evaluate calibrated coverage on Lots 31-35
  let calCovered = 0;
  calList.forEach((c, idx) => {
    const actual168 = c.times[168][param];
    const latentStd = calLatentSigmas[idx];
    const totalStd = Math.sqrt(Math.pow(latentStd, 2) + Math.pow(sigmaObs, 2));
    const val24 = c.times[24][param];
    const val0 = c.times[0][param];
    const delta24 = val24 - val0;
    const xNorm = [val0, val24, delta24].map((v, j) => (v - means[j]) / stds[j]);

    const kVec = [];
    supportX.forEach(sup => {
      let distSq = 0;
      for (let j = 0; j < 3; j++) distSq += Math.pow(xNorm[j] - sup[j], 2);
      kVec.push(sigmaF2 * Math.exp(-distSq / (2.0 * Math.pow(lengthScale, 2))));
    });
    let predDelta = y_mean;
    for (let i = 0; i < S; i++) predDelta += alpha[i] * kVec[i] * y_std;
    const pred168 = val24 + predDelta;

    if (actual168 >= pred168 - 1.96 * totalStd && actual168 <= pred168 + 1.96 * totalStd) {
      calCovered++;
    }
  });

  const calCoveragePct = ((calCovered / N_cal) * 100).toFixed(1);

  calibrationSummary[param] = {
    MAE: Number(calMAE.toFixed(4)),
    RMSE: Number(calRMSE.toFixed(4)),
    Residual_Mean: Number(calResidMean.toFixed(4)),
    Residual_Std: Number(calResidStd.toFixed(4)),
    Mean_Latent_Sigma: Number(meanLatentStd.toFixed(4)),
    Estimated_Observation_Sigma: Number(sigmaObs.toFixed(4)),
    Calibrated_Coverage_Lots31_35: `${calCoveragePct}%`
  };

  gprKernelArtifacts.parameters[param] = {
    feature_means: means.map(v => Number(v.toFixed(4))),
    feature_stds: stds.map(v => Number(v.toFixed(4))),
    y_mean: Number(y_mean.toFixed(4)),
    y_std: Number(y_std.toFixed(4)),
    sigma_obs: Number(sigmaObs.toFixed(4)),
    length_scale: lengthScale,
    sigma_f2: sigmaF2,
    sigma_n2: sigmaN2,
    support_x: rawSupportX,
    alpha: alpha,
    K_inv: K_inv
  };
});

fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
fs.writeFileSync(artifactPath, JSON.stringify(gprKernelArtifacts, null, 2), 'utf8');

console.log("--- CALIBRATION SPLIT DIAGNOSTICS (LOTS 31–35) ---");
console.log(JSON.stringify(calibrationSummary, null, 2));

console.log(`\nPersisted Calibrated 3-Way Split Artifact: ${artifactPath}`);
console.log("=========================================================================");
console.log("GPR TRAINING & CALIBRATION COMPLETE");
console.log("=========================================================================\n");
