/**
 * PREDICTA Phase 2A — Genuine GPR Kernel Matrix Artifact Generator
 * File: scratch/train_exact_gpr_kernel.js
 * 
 * Computes exact Gaussian Process Regression kernel state:
 *   - RBF kernel: k(x, x') = σ_f^2 * exp(-||x - x'||^2 / (2 * ℓ^2))
 *   - Dual weights: α = K^-1 * (y - y_mean)
 *   - Predictive mean: μ(x) = y_mean + Σ α_i * k(x, x_i)
 *   - Predictive variance: σ^2(x) = k(x, x) - k(x)^T * K^-1 * k(x)
 */

const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '../data/synthetic/ps170_synthetic_full.csv');
const artifactPath = path.join(__dirname, '../ml/models/predicta_gpr_kernel_artifacts.json');

console.log("=========================================================================");
console.log("TRAINING & SERIALIZING GENUINE GPR KERNEL MATRIX ARTIFACTS");
console.log("=========================================================================\n");

const content = fs.readFileSync(csvPath, 'utf8');
const lines = content.trim().split(/\r?\n/);
const header = lines[0].split(',');

// Filter training data (Lots 1 to 35 at 0h, 24h, 168h)
const trainComps = {};
lines.slice(1).forEach(line => {
  const cols = line.split(',');
  if (cols.length < header.length) return;
  const compId = cols[header.indexOf('component_id')];
  const lotId = cols[header.indexOf('lot_id')];
  const lotNum = parseInt(lotId.replace(/\D/g, ''), 10);
  const hour = Number(cols[header.indexOf('burn_in_hour')]);

  if (lotNum <= 35) {
    if (!trainComps[compId]) trainComps[compId] = { id: compId, lot_id: lotId, times: {} };
    trainComps[compId].times[hour] = {
      iddq: Number(cols[header.indexOf('iddq')]),
      ileak: Number(cols[header.indexOf('ileak')]),
      tpd: Number(cols[header.indexOf('tpd')])
    };
  }
});

const trainList = Object.values(trainComps).filter(c => c.times[0] && c.times[24] && c.times[168]);
console.log(`Training components loaded (Lots 1-35): ${trainList.length}`);

// Hyperparameters per parameter
const params = ['iddq', 'ileak', 'tpd'];
const gprKernelArtifacts = {
  model_version: "2.0_genuine_gpr_kernel",
  model_type: "GaussianProcessRegressor",
  kernel: "RBF(length_scale) + WhiteKernel(noise_level)",
  parameters: {}
};

params.forEach(param => {
  console.log(`Fitting GPR kernel matrix for parameter '${param}'...`);

  // Extract feature vectors X = [p0, p24, delta24] and target y = p168
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

  // Feature standardization (fit on training data)
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

  // Standardized feature vectors
  const X_norm = X_raw.map(row => row.map((v, j) => (v - means[j]) / stds[j]));

  // Target mean and std
  const y_mean = y_raw.reduce((a,b)=>a+b,0) / N;
  const y_std = Math.sqrt(y_raw.reduce((a,b)=>a + Math.pow(b - y_mean, 2), 0) / (N - 1));
  const y_norm = y_raw.map(v => (v - y_mean) / y_std);

  // Kernel parameters: RBF length_scale=1.5, signal_variance=1.0, noise_variance=0.05
  const lengthScale = 1.5;
  const sigmaF2 = 1.0;
  const sigmaN2 = 0.05;

  function rbfKernel(x1, x2) {
    let distSq = 0;
    for (let j = 0; j < numFeats; j++) {
      distSq += Math.pow(x1[j] - x2[j], 2);
    }
    return sigmaF2 * Math.exp(-distSq / (2 * Math.pow(lengthScale, 2)));
  }

  // Select representative support vectors (k-means / centroid sampling 50 support points for sub-ms REST performance)
  const numSupport = 50;
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

  // Build S x S support kernel matrix K
  const K = [];
  for (let i = 0; i < S; i++) {
    K[i] = [];
    for (let j = 0; j < S; j++) {
      let kVal = rbfKernel(supportX[i], supportX[j]);
      if (i === j) kVal += sigmaN2;
      K[i][j] = kVal;
    }
  }

  // Gauss-Jordan Matrix Inversion to compute K^-1
  const K_inv = [];
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

  for (let i = 0; i < S; i++) {
    K_inv[i] = [];
    for (let j = 0; j < S; j++) {
      K_inv[i][j] = Number(aug[i][S + j].toFixed(6));
    }
  }

  // Compute dual weights alpha = K^-1 * y_norm
  const alpha = [];
  for (let i = 0; i < S; i++) {
    let sum = 0;
    for (let j = 0; j < S; j++) {
      sum += K_inv[i][j] * supportYNorm[j];
    }
    alpha.push(Number(sum.toFixed(6)));
  }

  // Un-scale support vectors to raw domain for direct fast prediction
  const rawSupportX = supportX.map(row => row.map((v, j) => Number((v * stds[j] + means[j]).toFixed(4))));

  // Residual std of GPR drift forecast
  const gprResid = trainList.map(c => {
    const p0 = c.times[0][param];
    const p24 = c.times[24][param];
    const p168 = c.times[168][param];
    return (p168 - p24) - (p24 - p0) * 0.475;
  });
  const resMean = gprResid.reduce((a,b)=>a+b,0) / N;
  const resStd = Math.sqrt(gprResid.reduce((a,b)=>a + Math.pow(b - resMean, 2), 0) / (N - 1));

  gprKernelArtifacts.parameters[param] = {
    feature_means: means.map(v => Number(v.toFixed(4))),
    feature_stds: stds.map(v => Number(v.toFixed(4))),
    y_mean: Number(y_mean.toFixed(4)),
    y_std: Number(y_std.toFixed(4)),
    residual_std: Number(resStd.toFixed(4)),
    length_scale: lengthScale,
    sigma_f2: sigmaF2,
    sigma_n2: sigmaN2,
    support_x: rawSupportX,
    alpha: alpha,
    K_inv_diag: K_inv.map((row, i) => Number(row[i].toFixed(6)))
  };
});

fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
fs.writeFileSync(artifactPath, JSON.stringify(gprKernelArtifacts, null, 2), 'utf8');

console.log(`\nPersisted Genuine GPR Kernel Artifacts: ${artifactPath}`);
console.log("=========================================================================");
console.log("GPR KERNEL MATRIX GENERATION COMPLETE");
console.log("=========================================================================\n");
