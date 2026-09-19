/**
 * Predicta Semiconductor Intelligence Platform — Isolation Forest Detector (Node.js)
 * File: src/anomaly_detection/isolation_forest.js
 */

function eulerHarmonicC(n) {
  if (n <= 1) return 0.0;
  if (n === 2) return 1.0;
  return 2.0 * (Math.log(n - 1) + 0.5772156649015329) - (2.0 * (n - 1) / n);
}

class IsolationForestDetectorJS {
  constructor(config = {}) {
    this.featureNames = config.feature_names || ["iddq", "ileak", "tpd"];
    this.trees = config.trees || [];
    this.maxSamples = config.max_samples || 256;
    this.offset = config.offset !== undefined ? Number(config.offset) : -0.5;
    this.cFactor = config.c_factor !== undefined ? Number(config.c_factor) : eulerHarmonicC(this.maxSamples);
    const thresholds = config.thresholds || {};
    this.warningScore = thresholds.warning_score !== undefined ? Number(thresholds.warning_score) : 0.55;
    this.rejectScore = thresholds.reject_score !== undefined ? Number(thresholds.reject_score) : 0.65;
  }

  scoreTree(tree, featVec) {
    const left = tree.children_left;
    const right = tree.children_right;
    const featIdx = tree.feature;
    const thresh = tree.threshold;
    const samples = tree.n_node_samples;

    let node = 0;
    let depth = 0;
    let splitFeatureHit = null;

    while (node >= 0 && node < left.length) {
      if (left[node] === -1 && right[node] === -1) {
        const nSamples = samples[node];
        const h = depth + (nSamples > 1 ? eulerHarmonicC(nSamples) : 0.0);
        return { pathLength: h, splitFeature: splitFeatureHit };
      }

      const fId = featIdx[node];
      if (splitFeatureHit === null && fId >= 0) {
        splitFeatureHit = fId;
      }

      const val = featVec[fId];
      node = val <= thresh[node] ? left[node] : right[node];
      depth++;
    }

    return { pathLength: depth, splitFeature: splitFeatureHit };
  }

  scoreSingle(features) {
    if (!features || typeof features !== 'object' || Array.isArray(features)) {
      throw new Error("Input features must be a valid dictionary/object");
    }

    const featureKeys = Object.keys(features);
    if (
      featureKeys.length !== this.featureNames.length ||
      featureKeys.some((k, i) => k !== this.featureNames[i])
    ) {
      throw new Error(
        `Feature schema/order mismatch. Expected exact canonical keys [${this.featureNames.join(', ')}] in exact order, got [${featureKeys.join(', ')}]`
      );
    }

    const featVec = [];
    for (const col of this.featureNames) {
      const val = features[col];
      if (typeof val === 'string' || typeof val === 'boolean' || val === null || val === undefined || !Number.isFinite(Number(val))) {
        throw new Error(`Invalid non-numeric or non-finite value for feature '${col}': ${val}`);
      }
      featVec.push(Number(val));
    }

    if (!this.trees || this.trees.length === 0) {
      throw new Error("Isolation Forest model contains no decision trees.");
    }

    let totalPath = 0.0;
    const featDepthSum = new Array(this.featureNames.length).fill(0.0);
    const featSplitCount = new Array(this.featureNames.length).fill(0);

    for (let i = 0; i < this.trees.length; i++) {
      const { pathLength, splitFeature } = this.scoreTree(this.trees[i], featVec);
      totalPath += pathLength;
      if (splitFeature !== null && splitFeature >= 0 && splitFeature < this.featureNames.length) {
        featDepthSum[splitFeature] += pathLength;
        featSplitCount[splitFeature]++;
      }
    }

    const meanPath = totalPath / this.trees.length;
    const cDenom = this.cFactor > 1e-6 ? this.cFactor : 1.0;
    const anomalyScore = Math.pow(2.0, -meanPath / cDenom);

    const featureAttributions = {};
    for (let j = 0; j < this.featureNames.length; j++) {
      const col = this.featureNames[j];
      if (featSplitCount[j] > 0) {
        const avgDepth = featDepthSum[j] / featSplitCount[j];
        const fScore = Math.pow(2.0, -avgDepth / cDenom);
        featureAttributions[col] = Number(fScore.toFixed(4));
      } else {
        featureAttributions[col] = Number(anomalyScore.toFixed(4));
      }
    }

    const status = anomalyScore > this.rejectScore ? "REJECT" : (anomalyScore > this.warningScore ? "MONITOR" : "PASS");
    const normScore = anomalyScore >= 0.40 ? Number(Math.min(1.0, Math.max(0.0, (anomalyScore - 0.40) / 0.30)).toFixed(4)) : 0.0;

    return {
      detector: "isolation_forest",
      score: Number(anomalyScore.toFixed(4)),
      normalized_score: normScore,
      threshold: Number(this.rejectScore),
      status,
      feature_scores: featureAttributions,
      mean_path_length: Number(meanPath.toFixed(4)),
      anomaly_evidence: featureAttributions,
      reference_status: "GLOBAL_REFERENCE",
      reference_source: "GLOBAL_REFERENCE",
      reference_sample_count: 3500,
      lot_id: null,
      calibration_status: "NOT_CALIBRATED",
      validation_status: "PROJECT_DEFINED_SCREENING_CRITERION",
    };
  }
}

module.exports = { IsolationForestDetectorJS, eulerHarmonicC };
