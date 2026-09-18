/**
 * Predicta Semiconductor Intelligence Platform — Robust MAD Detector (Node.js)
 * File: src/anomaly_detection/robust_mad.js
 */

class RobustMADDetectorJS {
  constructor(config = {}) {
    this.globalStats = config.global_stats || {};
    this.lotStats = config.lot_stats || {};
    this.minReferenceSize = config.min_reference_size || 10;
    const thresholds = config.thresholds || {};
    this.warningZ = thresholds.warning_z !== undefined ? Number(thresholds.warning_z) : 3.0;
    this.rejectZ = thresholds.reject_z !== undefined ? Number(thresholds.reject_z) : 6.0;
    this.featureNames = config.features || ["iddq", "ileak", "tpd"];
  }

  scoreSingle(features, lotId = null) {
    if (!features || typeof features !== 'object') {
      throw new Error("Input features must be a valid object");
    }
    for (const col of this.featureNames) {
      if (features[col] === undefined || features[col] === null) {
        throw new Error(`Missing required canonical anomaly feature: '${col}'`);
      }
      const num = Number(features[col]);
      if (!Number.isFinite(num)) {
        throw new Error(`Invalid non-numeric or non-finite value for feature '${col}': ${features[col]}`);
      }
    }

    let stats = this.globalStats;
    let refSource = "GLOBAL_FALLBACK";

    const cleanLot = lotId ? String(lotId).trim() : null;
    if (cleanLot && this.lotStats[cleanLot]) {
      stats = this.lotStats[cleanLot];
      refSource = "LOT_RELATIVE";
    } else if (cleanLot) {
      refSource = "GLOBAL_FALLBACK_UNSEEN_OR_SMALL_LOT";
    }

    let maxZ = 0.0;
    const paramZ = {};
    const contributing = [];

    for (const col of this.featureNames) {
      const val = Number(features[col]);
      const colStat = stats[col] || this.globalStats[col];
      if (!colStat) continue;

      const med = colStat.median;
      const sig = colStat.sigma;
      let z = 0.0;

      if (colStat.is_degenerate || !sig || sig <= 1e-9) {
        z = Math.abs(val - med) < 1e-7 ? 0.0 : 999.0;
      } else {
        z = Math.abs(val - med) / sig;
      }

      paramZ[col] = Number(z.toFixed(4));
      if (z > maxZ) maxZ = z;
      if (z > this.warningZ) contributing.push(col);
    }

    const status = maxZ > this.rejectZ ? "REJECT" : (maxZ > this.warningZ ? "MONITOR" : "PASS");

    return {
      score: Number(maxZ.toFixed(4)),
      status,
      reference_source: refSource,
      parameter_z_scores: paramZ,
      contributing_features: contributing,
    };
  }
}

module.exports = { RobustMADDetectorJS };
