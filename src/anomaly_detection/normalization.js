/**
 * Predicta Semiconductor Intelligence Platform — Authoritative Anomaly Normalization (Node.js)
 * File: src/anomaly_detection/normalization.js
 *
 * Deterministic normalization layer converting heterogeneous detector raw scores to [0, 1].
 * Derived strictly from training/validation optimization boundaries without test leakage.
 * Explicitly marked as uncalibrated (NOT_CALIBRATED).
 */

const DEFAULT_NORMALIZATION_SCALES = {
  mad_scale: 6.0,
  copod_scale: 9.5,
  iso_min: 0.40,
  iso_scale: 0.30,
};

const CALIBRATION_STATUS = "NOT_CALIBRATED";
const VALIDATION_STATUS = "PROJECT_DEFINED_SCREENING_CRITERION";

/**
 * Deterministically normalizes raw anomaly detector scores into [0, 1] range.
 *
 * @param {string} detectorName - Detector name ('robust_mad', 'copod', 'isolation_forest')
 * @param {number} rawScore - Raw score from detector
 * @param {object} [normScales] - Optional normalization scales override
 * @returns {number} Normalized anomaly score in [0, 1]
 */
function normalizeDetectorScore(detectorName, rawScore, normScales = null) {
  const scales = normScales || DEFAULT_NORMALIZATION_SCALES;
  const det = String(detectorName || "").trim().toLowerCase();

  if (rawScore === null || rawScore === undefined || isNaN(rawScore)) {
    return 0.0;
  }

  const val = Number(rawScore);

  if (det === "robust_mad" || det === "mad" || det === "pat_mad") {
    const scale = scales.mad_scale || 6.0;
    return Number(Math.min(1.0, Math.max(0.0, val / scale)).toFixed(4));
  } else if (det === "copod") {
    const scale = scales.copod_scale || 9.5;
    return Number(Math.min(1.0, Math.max(0.0, val / scale)).toFixed(4));
  } else if (det === "isolation_forest" || det === "iforest" || det === "iso") {
    const isoMin = scales.iso_min !== undefined ? scales.iso_min : 0.40;
    const isoScale = scales.iso_scale || 0.30;
    if (val < isoMin) {
      return 0.0;
    }
    return Number(Math.min(1.0, Math.max(0.0, (val - isoMin) / isoScale)).toFixed(4));
  } else {
    return Number(Math.min(1.0, Math.max(0.0, val)).toFixed(4));
  }
}

module.exports = {
  DEFAULT_NORMALIZATION_SCALES,
  CALIBRATION_STATUS,
  VALIDATION_STATUS,
  normalizeDetectorScore,
};
