/**
 * Predicta Semiconductor Intelligence Platform — Phase 15 Task 1 (Evidence Integrity Remediated)
 * Governed Out-of-Distribution (OOD) & Distribution Shift Classifier (Node.js)
 * File: src/governance/ood_classifier.js
 * 
 * Classifies telemetry into:
 * 1. NORMAL: Within nominal baseline distribution envelope.
 * 2. MILD_SHIFT: Benign lot-to-lot variance within allowable process window.
 * 3. SIGNIFICANT_SHIFT: Noticeable distribution divergence triggering mandatory manual engineering review.
 * 4. OOD: Out-of-distribution observation where automated ML probabilities cannot be safely trusted;
 *    routes to HOLD / 96H_VERIFICATION.
 * 
 * GOVERNANCE NOTICE:
 * Baseline feature statistics and distance thresholds in this module are governed
 * heuristic reference specifications for benchmark/screening isolation, NOT empirically
 * certified production fab distributions. They must NOT be claimed as production calibration.
 */

'use strict';

const ShiftClassification = Object.freeze({
  NORMAL: 'NORMAL',
  MILD_SHIFT: 'MILD_SHIFT',
  SIGNIFICANT_SHIFT: 'SIGNIFICANT_SHIFT',
  OOD: 'OOD'
});

const OOD_GOVERNANCE_METADATA = Object.freeze({
  baseline_type: 'GOVERNED_HEURISTIC_SPECIFICATION',
  calibration_status: 'NOT_EMPIRICALLY_CALIBRATED_PRODUCTION_BASELINE',
  limitations: 'Reference baseline statistics and shift thresholds are governed heuristic specifications for benchmark/screening isolation, not empirically certified fab baseline distributions.'
});

// Heuristic reference population statistics (mean, std) for semiconductor burn-in telemetry
const BASELINE_FEATURE_STATS = Object.freeze({
  supply_voltage: { mean: 1.20, std: 0.04 },
  output_voltage: { mean: 1.20, std: 0.04 },
  current: { mean: 15.0, std: 2.5 },
  leakage_current: { mean: 120.0, std: 35.0 },
  resistance: { mean: 50.0, std: 5.0 },
  capacitance: { mean: 1.0, std: 0.15 },
  threshold_voltage: { mean: 0.45, std: 0.04 },
  frequency: { mean: 1200.0, std: 100.0 },
  propagation_delay: { mean: 85.0, std: 12.0 },
  temperature: { mean: 85.0, std: 8.0 },
  dynamic_power: { mean: 18.0, std: 3.0 },
  total_power: { mean: 25.0, std: 4.5 }
});

class OODClassifier {
  constructor(customStats = null) {
    this.stats = customStats || BASELINE_FEATURE_STATS;
    this.governanceMetadata = OOD_GOVERNANCE_METADATA;
  }

  /**
   * Evaluates telemetry features for distribution shift and OOD status.
   * 
   * @param {Object} telemetry - Feature dictionary (e.g. 24h telemetry)
   * @param {Object} [options] - Additional metrics like copod_score, psi_metric
   * @returns {Object} OOD evaluation report
   */
  classify(telemetry = {}, options = {}) {
    if (!telemetry || typeof telemetry !== 'object' || Object.keys(telemetry).length === 0) {
      return {
        classification: ShiftClassification.OOD,
        shift_score: 1.0,
        max_z_score: 99.0,
        rms_z_score: 99.0,
        copod_score: null,
        divergent_features: ['MISSING_TELEMETRY'],
        requires_hold: true,
        reason: 'Missing or empty telemetry feature vector — fail closed to OOD',
        governance_metadata: this.governanceMetadata,
        feature_z_scores: {}
      };
    }

    const zScores = {};
    const divergentFeatures = [];
    let maxZ = 0.0;
    let sumSqZ = 0.0;
    let count = 0;

    for (const [key, val] of Object.entries(telemetry)) {
      if (this.stats[key]) {
        const numVal = Number(val);
        if (!isNaN(numVal) && Number.isFinite(numVal)) {
          const mean = this.stats[key].mean;
          const std = this.stats[key].std;
          const z = Math.abs((numVal - mean) / std);
          zScores[key] = Number(z.toFixed(2));
          if (z > maxZ) maxZ = z;
          sumSqZ += z * z;
          count++;

          if (z > 3.0) {
            divergentFeatures.push(`${key} (Z=${z.toFixed(2)})`);
          }
        }
      }
    }

    // Mahalanobis proxy (RMS Z-score)
    const rmsZ = count > 0 ? Math.sqrt(sumSqZ / count) : 0.0;
    const copodScore = options.copod_score !== undefined && options.copod_score !== null ? Number(options.copod_score) : 0.0;
    const psiScore = options.psi !== undefined && options.psi !== null ? Number(options.psi) : 0.0;

    // Shift score normalized [0.0 - 1.0]
    const rawShift = Math.max(
      maxZ / 6.0,
      rmsZ / 4.0,
      copodScore / 12.0,
      psiScore / 0.50
    );
    const shiftScore = Number(Math.min(1.0, Math.max(0.0, rawShift)).toFixed(3));

    let classification = ShiftClassification.NORMAL;
    let requiresHold = false;
    let reason = 'Telemetry lies within nominal 3-sigma process window';

    if (maxZ > 5.0 || copodScore > 9.0 || psiScore > 0.40 || rmsZ > 3.5) {
      classification = ShiftClassification.OOD;
      requiresHold = true;
      reason = `Severe distribution divergence (max_z=${maxZ.toFixed(2)}, RMS_z=${rmsZ.toFixed(2)}); ML automated probability unverified`;
    } else if (maxZ > 3.5 || copodScore > 6.5 || psiScore > 0.25 || rmsZ > 2.5) {
      classification = ShiftClassification.SIGNIFICANT_SHIFT;
      requiresHold = true;
      reason = `Significant process distribution shift (max_z=${maxZ.toFixed(2)}); engineering review recommended`;
    } else if (maxZ > 2.5 || copodScore > 4.5 || psiScore > 0.10 || rmsZ > 1.8) {
      classification = ShiftClassification.MILD_SHIFT;
      requiresHold = false;
      reason = `Mild lot-to-lot parameter variation within acceptable tolerances`;
    }

    return {
      classification,
      shift_score: shiftScore,
      max_z_score: Number(maxZ.toFixed(2)),
      rms_z_score: Number(rmsZ.toFixed(2)),
      copod_score: Number(copodScore.toFixed(2)),
      divergent_features: divergentFeatures,
      requires_hold: requiresHold,
      reason,
      governance_metadata: this.governanceMetadata,
      feature_z_scores: zScores
    };
  }
}

module.exports = {
  OODClassifier,
  ShiftClassification,
  OOD_GOVERNANCE_METADATA,
  BASELINE_FEATURE_STATS
};
