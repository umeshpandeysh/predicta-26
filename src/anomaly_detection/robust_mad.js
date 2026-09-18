/**
 * Predicta Semiconductor Intelligence Platform — Robust MAD Detector (Node.js)
 * File: src/anomaly_detection/robust_mad.js
 */

const CANONICAL_ANOMALY_FEATURES = ["iddq", "ileak", "tpd"];
const MIN_ROBUST_SCALE = 1e-9;

class RobustMADDetectorJS {
  constructor(config = {}) {
    this.globalStats = config.global_stats || {};
    this.lotStats = config.lot_stats || {};
    this.minReferenceSize = config.min_reference_size !== undefined ? Number(config.min_reference_size) : 10;
    const thresholds = config.thresholds || {};
    this.warningZ = thresholds.warning_z !== undefined ? Number(thresholds.warning_z) : 3.0;
    this.rejectZ = thresholds.reject_z !== undefined ? Number(thresholds.reject_z) : 6.0;
    this.featureNames = config.features || CANONICAL_ANOMALY_FEATURES;
  }

  scoreSingle(features, lotId = null) {
    if (!features || typeof features !== 'object' || Array.isArray(features)) {
      throw new Error("Input features must be a valid dictionary/object");
    }

    // Strict canonical feature validation
    for (const col of this.featureNames) {
      if (features[col] === undefined || features[col] === null) {
        throw new Error(`Missing required canonical anomaly feature: '${col}'`);
      }
    }

    const featureKeys = Object.keys(features);
    for (const k of featureKeys) {
      if (!this.featureNames.includes(k)) {
        throw new Error(`Extra feature '${k}' not permitted in canonical anomaly contract`);
      }
    }

    for (const col of this.featureNames) {
      const num = Number(features[col]);
      if (!Number.isFinite(num)) {
        throw new Error(`Invalid non-numeric or non-finite value for feature '${col}': ${features[col]}`);
      }
    }

    // Determine reference context
    let cleanLot = null;
    if (lotId !== null && lotId !== undefined) {
      const s = String(lotId).trim();
      if (s !== "" && s.toLowerCase() !== "nan" && s.toLowerCase() !== "none" && s.toLowerCase() !== "null") {
        cleanLot = s;
      }
    }

    let stats = this.globalStats;
    let refStatus = "UNKNOWN_LOT";
    let refSource = "GLOBAL_FALLBACK";
    let refSampleCount = 0;

    if (cleanLot === null || !this.lotStats[cleanLot]) {
      refStatus = "UNKNOWN_LOT";
      refSource = "GLOBAL_FALLBACK";
      refSampleCount = 0;
      stats = this.globalStats;
    } else {
      const lotEntry = this.lotStats[cleanLot];
      if (lotEntry.features !== undefined) {
        // Structured lot governance metadata format
        refSampleCount = lotEntry.sample_count !== undefined ? Number(lotEntry.sample_count) : 0;
        refStatus = lotEntry.reference_status || "LOT_RELATIVE";
        refSource = lotEntry.reference_source || "LOT_RELATIVE";
        const qualityStatus = lotEntry.quality_status || "VALID";

        if (refSource === "LOT_RELATIVE" && qualityStatus === "VALID" && lotEntry.features) {
          stats = lotEntry.features;
        } else {
          stats = this.globalStats;
        }
      } else {
        // Legacy flat format
        refSampleCount = lotEntry.sample_count || 100;
        refStatus = "LOT_RELATIVE";
        refSource = "LOT_RELATIVE";
        stats = lotEntry;
      }
    }

    let maxZ = 0.0;
    const paramZ = {};
    const contributing = [];

    for (const col of this.featureNames) {
      const val = Number(features[col]);
      const colStat = stats[col] || this.globalStats[col];
      if (!colStat) continue;

      const med = Number(colStat.median);
      const sig = colStat.sigma !== null && colStat.sigma !== undefined ? Number(colStat.sigma) : null;
      let z = 0.0;

      if (colStat.is_degenerate || sig === null || sig <= MIN_ROBUST_SCALE) {
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
      reference_status: refStatus,
      reference_source: refSource,
      reference_sample_count: refSampleCount,
      lot_id: cleanLot,
      parameter_z_scores: paramZ,
      contributing_features: contributing,
      reference_context: {
        lot_id: cleanLot,
        status: refStatus,
        source: refSource,
        sample_count: refSampleCount,
      },
    };
  }
}

module.exports = { RobustMADDetectorJS, CANONICAL_ANOMALY_FEATURES };
