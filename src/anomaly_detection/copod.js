/**
 * Predicta Semiconductor Intelligence Platform — COPOD Detector (Node.js)
 * File: src/anomaly_detection/copod.js
 */

class COPODDetectorJS {
  constructor(config = {}) {
    this.globalEcdfs = config.global_ecdfs || {};
    const thresholds = config.thresholds || {};
    this.warningScore = thresholds.warning_score !== undefined ? Number(thresholds.warning_score) : 6.5;
    this.rejectScore = thresholds.reject_score !== undefined ? Number(thresholds.reject_score) : 9.5;
    this.featureNames = config.features || ["iddq", "ileak", "tpd"];
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

    for (const col of this.featureNames) {
      const val = features[col];
      if (typeof val === 'string' || typeof val === 'boolean' || val === null || val === undefined || !Number.isFinite(Number(val))) {
        throw new Error(`Invalid non-numeric or non-finite value for feature '${col}': ${val}`);
      }
    }

    let leftTailSum = 0.0;
    let rightTailSum = 0.0;
    const featureScores = {};

    for (const col of this.featureNames) {
      const val = Number(features[col]);
      const sorted = this.globalEcdfs[col] || [];
      if (sorted.length === 0) continue;

      let count = 0;
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i] <= val) count++;
        else break;
      }

      const pct = Math.max(1e-6, Math.min(1.0 - 1e-6, count / sorted.length));
      const leftTail = -Math.log(pct);
      const rightTail = -Math.log(1.0 - pct);
      const dimScore = Math.max(leftTail, rightTail);
      featureScores[col] = Number(dimScore.toFixed(4));

      leftTailSum += leftTail;
      rightTailSum += rightTail;
    }

    const totalScore = Math.max(leftTailSum, rightTailSum);
    const status = totalScore > this.rejectScore ? "REJECT" : (totalScore > this.warningScore ? "MONITOR" : "PASS");

    return {
      score: Number(totalScore.toFixed(4)),
      status,
      feature_scores: featureScores,
      left_tail_sum: Number(leftTailSum.toFixed(4)),
      right_tail_sum: Number(rightTailSum.toFixed(4)),
    };
  }
}

module.exports = { COPODDetectorJS };
