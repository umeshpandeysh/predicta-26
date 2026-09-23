/**
 * Predicta Semiconductor Intelligence Platform — Phase 15 Task 1
 * Governed Uncertainty Decision Pathway (Node.js)
 * File: src/decision_engine/uncertainty_decision_pathway.js
 * 
 * Implements the 4-way governed decision pathway:
 * 1. PASS: Low probability (<0.10), nominal anomaly envelope, low prognostic uncertainty.
 * 2. MONITOR: Moderate probability (0.10 - 0.199) or mild drift; safe for ongoing burn-in with logging.
 * 3. HOLD (-> 96H_VERIFICATION): High prognostic uncertainty, OOD shift, or ambiguous chamber/sensor
 *    evidence requiring intermediate 96h burn-in verification.
 *    INVARIANT: Uncertainty is not automatically failure.
 * 4. REJECT: High calibrated probability (>= 0.20), safety slope breach, physics violation,
 *    or severe silicon anomaly override.
 */

'use strict';

const GovernedDecision = Object.freeze({
  PASS: 'PASS',
  MONITOR: 'MONITOR',
  HOLD: 'HOLD',
  REJECT: 'REJECT'
});

const NextAction = Object.freeze({
  RELEASE_TO_PRODUCTION: 'RELEASE_TO_PRODUCTION',
  CONTINUE_MONITORED_BURN_IN: 'CONTINUE_MONITORED_BURN_IN',
  ROUTE_TO_96H_VERIFICATION: 'ROUTE_TO_96H_VERIFICATION',
  SCRAP_OR_FAILURE_ANALYSIS: 'SCRAP_OR_FAILURE_ANALYSIS',
  EQUIPMENT_CHAMBER_AUDIT: 'EQUIPMENT_CHAMBER_AUDIT',
  SENSOR_RECALIBRATION: 'SENSOR_RECALIBRATION'
});

const PROD_OPERATING_THRESHOLD = 0.20;

class UncertaintyDecisionPathway {
  constructor(threshold = PROD_OPERATING_THRESHOLD) {
    this.operatingThreshold = threshold;
  }

  /**
   * Evaluates the full evidence packet to synthesize a governed decision.
   * 
   * @param {Object} input
   * @param {number} input.calibrated_probability - Calibrated ML failure probability [0.0 - 1.0]
   * @param {Object} [input.anomaly_evidence] - Anomaly detector outputs (PAT, COPOD, IF)
   * @param {Object} [input.prognostic_evidence] - 168h GPR forecast & conformal interval
   * @param {Object} [input.physics_evidence] - Physics consistency evaluation results
   * @param {Object} [input.discrimination_evidence] - Sensor / Equipment / Component discrimination
   * @param {Object} [input.ood_evidence] - OOD / distribution shift classification
   * @param {Object} [input.safety_slope] - Safety slope boundary evaluations
   * @returns {Object} Governed decision report
   */
  evaluate(input = {}) {
    if (!input || typeof input !== 'object') {
      return this._failClosedDecision('Missing or invalid input object');
    }

    const prob = Number(input.calibrated_probability);
    if (isNaN(prob) || !Number.isFinite(prob) || prob < 0.0 || prob > 1.0) {
      return this._failClosedDecision(`Invalid calibrated probability: ${input.calibrated_probability}`);
    }

    const anomaly = input.anomaly_evidence || {};
    const prog = input.prognostic_evidence || {};
    const physics = input.physics_evidence || {};
    const discrim = input.discrimination_evidence || {};
    const ood = input.ood_evidence || {};
    const safety = input.safety_slope || {};

    const decisionFactors = [];
    let decision = GovernedDecision.PASS;
    let nextAction = NextAction.RELEASE_TO_PRODUCTION;
    let confidence = 0.90;

    // Check 1: Root Discrimination overrides
    const rootType = discrim.root_evidence_type;
    if (rootType === 'SENSOR_OR_DATA_QUALITY') {
      return {
        decision: GovernedDecision.HOLD,
        next_action: NextAction.SENSOR_RECALIBRATION,
        reason: 'Sensor or data quality anomaly detected; silicon failure cannot be reliably inferred.',
        decision_factors: ['SENSOR_DATA_QUALITY_OVERRIDE'].concat(discrim.findings || []),
        governed_confidence: 0.85,
        operating_threshold: this.operatingThreshold,
        requires_engineering_review: true,
        uncertainty_routed_to_hold: true
      };
    }

    if (rootType === 'EQUIPMENT_OR_CHAMBER') {
      return {
        decision: GovernedDecision.HOLD,
        next_action: NextAction.EQUIPMENT_CHAMBER_AUDIT,
        reason: 'Chamber/equipment-level shift detected across test cohort; die routed to hold pending chamber audit.',
        decision_factors: ['EQUIPMENT_CHAMBER_CORRELATION_OVERRIDE'].concat(discrim.findings || []),
        governed_confidence: 0.85,
        operating_threshold: this.operatingThreshold,
        requires_engineering_review: true,
        uncertainty_routed_to_hold: true
      };
    }

    // Check 2: Hard Rejection Criteria (Safety breach, severe physics violation, or Prob >= 0.20)
    const anySafetyExceeded = Object.values(safety).some(s => s && s.boundary_status === 'EXCEEDED');
    const isPhysicsInconsistent = physics.status === 'PHYSICS_INCONSISTENT';
    const isSevereAnomaly = anomaly.status === 'REJECT' || (anomaly.pat && anomaly.pat.status === 'REJECT');

    if (prob >= this.operatingThreshold) {
      decision = GovernedDecision.REJECT;
      nextAction = NextAction.SCRAP_OR_FAILURE_ANALYSIS;
      confidence = Math.max(0.85, prob);
      decisionFactors.push(`CALIBRATED_PROBABILITY_BREACH (P=${prob.toFixed(4)} >= ${this.operatingThreshold.toFixed(2)})`);
    } else if (anySafetyExceeded) {
      decision = GovernedDecision.REJECT;
      nextAction = NextAction.SCRAP_OR_FAILURE_ANALYSIS;
      confidence = 0.95;
      decisionFactors.push('SAFETY_SLOPE_BOUNDARY_EXCEEDED');
    } else if (isPhysicsInconsistent) {
      decision = GovernedDecision.REJECT;
      nextAction = NextAction.SCRAP_OR_FAILURE_ANALYSIS;
      confidence = 0.90;
      decisionFactors.push('PHYSICS_CONSISTENCY_VIOLATION');
    } else if (isSevereAnomaly && prob >= 0.15) {
      decision = GovernedDecision.REJECT;
      nextAction = NextAction.SCRAP_OR_FAILURE_ANALYSIS;
      confidence = 0.88;
      decisionFactors.push('SEVERE_ANOMALY_WITH_ELEVATED_PROBABILITY');
    }

    if (decision === GovernedDecision.REJECT) {
      return {
        decision,
        next_action: nextAction,
        reason: `Component rejected by safety/reliability rules: ${decisionFactors.join('; ')}`,
        decision_factors: decisionFactors,
        governed_confidence: Number(confidence.toFixed(3)),
        operating_threshold: this.operatingThreshold,
        requires_engineering_review: true,
        uncertainty_routed_to_hold: false
      };
    }

    // Check 3: Governed HOLD (Uncertainty is not failure)
    // High prognostic uncertainty, OOD shift, or high conformal interval width
    let highUncertainty = false;

    // OOD is only consumed if it is explicitly marked as an authoritative decision input
    const isAuthoritativeOod = ood && (
      ood.is_authoritative_decision_input === true ||
      (ood.governance_metadata && ood.governance_metadata.is_authoritative_decision_input === true)
    );
    if (isAuthoritativeOod && (ood.classification === 'OOD' || ood.requires_hold)) {
      highUncertainty = true;
      decisionFactors.push(`DISTRIBUTION_SHIFT_OOD (${ood.classification})`);
    }

    // Conformal uncertainty width check: e.g. conformal interval width > 0.40
    if (prog.conformal_interval) {
      const lower = Number(prog.conformal_interval.lower_bound || prog.conformal_interval.lower);
      const upper = Number(prog.conformal_interval.upper_bound || prog.conformal_interval.upper);
      if (!isNaN(lower) && !isNaN(upper) && (upper - lower) > 0.40) {
        highUncertainty = true;
        decisionFactors.push(`WIDE_CONFORMAL_INTERVAL (width=${(upper - lower).toFixed(3)})`);
      }
    }

    // GPR uncertainty standard deviation
    if (prog.uncertainty_std && Number(prog.uncertainty_std) > 0.25) {
      highUncertainty = true;
      decisionFactors.push(`HIGH_GPR_PROGNOSTIC_UNCERTAINTY (std=${Number(prog.uncertainty_std).toFixed(3)})`);
    }

    if (highUncertainty) {
      return {
        decision: GovernedDecision.HOLD,
        next_action: NextAction.ROUTE_TO_96H_VERIFICATION,
        reason: 'Component exhibits elevated uncertainty or distribution divergence without confirmed failure signature; routed to 96h burn-in verification rather than scrap.',
        decision_factors: decisionFactors,
        governed_confidence: 0.80,
        operating_threshold: this.operatingThreshold,
        requires_engineering_review: true,
        uncertainty_routed_to_hold: true
      };
    }

    // Check 4: MONITOR vs PASS
    const anySafetyWarning = Object.values(safety).some(s => s && s.boundary_status === 'WARNING');
    const isModerateProb = prob >= 0.10 && prob < this.operatingThreshold;
    const isAnomalyMonitor = anomaly.status === 'MONITOR';
    const isMildShift = ood.classification === 'MILD_SHIFT';

    if (isModerateProb || anySafetyWarning || isAnomalyMonitor || isMildShift) {
      decision = GovernedDecision.MONITOR;
      nextAction = NextAction.CONTINUE_MONITORED_BURN_IN;
      if (isModerateProb) decisionFactors.push(`MODERATE_PROBABILITY (P=${prob.toFixed(4)})`);
      if (anySafetyWarning) decisionFactors.push('SAFETY_SLOPE_WARNING');
      if (isAnomalyMonitor) decisionFactors.push('ANOMALY_MONITOR_STATUS');
      if (isMildShift) decisionFactors.push('MILD_DISTRIBUTION_SHIFT');

      return {
        decision,
        next_action: nextAction,
        reason: `Component permitted to continue burn-in with telemetry monitoring: ${decisionFactors.join('; ')}`,
        decision_factors: decisionFactors,
        governed_confidence: 0.85,
        operating_threshold: this.operatingThreshold,
        requires_engineering_review: false,
        uncertainty_routed_to_hold: false
      };
    }

    // Nominal PASS
    return {
      decision: GovernedDecision.PASS,
      next_action: NextAction.RELEASE_TO_PRODUCTION,
      reason: `Nominal operating telemetry and low failure probability (P=${prob.toFixed(4)} < ${this.operatingThreshold.toFixed(2)}) within verified envelope.`,
      decision_factors: ['NOMINAL_TELEMETRY', 'LOW_UNCERTAINTY', 'PHYSICS_CONSISTENT'],
      governed_confidence: 0.95,
      operating_threshold: this.operatingThreshold,
      requires_engineering_review: false,
      uncertainty_routed_to_hold: false
    };
  }

  _failClosedDecision(reason) {
    return {
      decision: GovernedDecision.HOLD,
      next_action: NextAction.ROUTE_TO_96H_VERIFICATION,
      reason: `Fail-closed decision fallback: ${reason}`,
      decision_factors: ['FAIL_CLOSED_FALLBACK', reason],
      governed_confidence: 0.0,
      operating_threshold: this.operatingThreshold,
      requires_engineering_review: true,
      uncertainty_routed_to_hold: true
    };
  }
}

module.exports = {
  UncertaintyDecisionPathway,
  GovernedDecision,
  NextAction,
  PROD_OPERATING_THRESHOLD
};
