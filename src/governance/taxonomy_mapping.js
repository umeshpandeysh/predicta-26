/**
 * PREDICTA-26 Phase 17.1 — Governed Decision Center Taxonomy Mapping Engine (Node.js)
 * File: src/governance/taxonomy_mapping.js
 *
 * Implements 100% parity with src/governance/taxonomy_mapping.py:
 * 1. ML Decision Layer: PASS / FAIL
 * 2. Operational Recommendation Layer: PASS / MONITOR / REJECT
 * 3. Backend Human Governance Layer: ACCEPT / REJECT / HOLD / RETEST / ESCALATE
 * 4. Target Judge/Operator UI Actions: PASS / MONITOR / RETEST / REJECT
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const TAXONOMY_CONTRACT_PATH = path.join(PROJECT_ROOT, 'ml/governance/taxonomy_mapping_contract.json');

const UI_ACTION_TAXONOMY = ['PASS', 'MONITOR', 'RETEST', 'REJECT'];
const ML_DECISION_TAXONOMY = ['PASS', 'FAIL'];
const OPERATIONAL_RECOMMENDATION_TAXONOMY = ['PASS', 'MONITOR', 'REJECT'];
const BACKEND_DISPOSITION_TAXONOMY = ['ACCEPT', 'REJECT', 'HOLD', 'RETEST', 'ESCALATE'];

const REASON_CODE_TAXONOMY = [
  'FALSE_POSITIVE_SUSPECTED',
  'FALSE_NEGATIVE_SUSPECTED',
  'INSUFFICIENT_DATA',
  'RETEST_REQUIRED',
  'EQUIPMENT_ISSUE',
  'PROCESS_EXCEPTION',
  'MANUAL_ENGINEERING_REVIEW',
  'OTHER'
];

const LEAD_TIME_BASIS = '168H_EVALUATION_HORIZON_NOT_FAILURE_TIME';
const INSUFFICIENT_EVIDENCE_STATUS = 'INSUFFICIENT EVIDENCE';
const OPERATING_THRESHOLD = 0.20;

function loadTaxonomyContract(contractPath = TAXONOMY_CONTRACT_PATH) {
  if (!fs.existsSync(contractPath)) {
    throw new Error(`CONTRACT_MISSING: Taxonomy contract missing at ${contractPath}`);
  }
  return JSON.parse(fs.readFileSync(contractPath, 'utf-8'));
}

function mapUiToBackendDisposition(uiAction) {
  if (typeof uiAction !== 'string') {
    throw new Error('INVALID_UI_ACTION: UI action must be a string.');
  }
  const cleaned = uiAction.trim().toUpperCase();
  const mapping = {
    PASS: 'ACCEPT',
    MONITOR: 'HOLD',
    RETEST: 'RETEST',
    REJECT: 'REJECT'
  };
  if (!mapping[cleaned]) {
    throw new Error(
      `INVALID_UI_ACTION: '${uiAction}' is not a valid UI action. Allowed actions: ${UI_ACTION_TAXONOMY.join(', ')}`
    );
  }
  return mapping[cleaned];
}

function mapBackendToUiDisposition(backendDisp) {
  if (typeof backendDisp !== 'string') {
    throw new Error('INVALID_BACKEND_DISPOSITION: Backend disposition must be a string.');
  }
  const cleaned = backendDisp.trim().toUpperCase();
  switch (cleaned) {
    case 'ACCEPT':
      return {
        ui_action: 'PASS',
        escalation_flag: false,
        badge_class: 'pass',
        display_label: 'PASS (ACCEPT)',
        escalation_indicator: null
      };
    case 'HOLD':
      return {
        ui_action: 'MONITOR',
        escalation_flag: false,
        badge_class: 'warning',
        display_label: 'MONITOR (HOLD)',
        escalation_indicator: null
      };
    case 'RETEST':
      return {
        ui_action: 'RETEST',
        escalation_flag: false,
        badge_class: 'info',
        display_label: 'RETEST',
        escalation_indicator: null
      };
    case 'REJECT':
      return {
        ui_action: 'REJECT',
        escalation_flag: false,
        badge_class: 'reject',
        display_label: 'REJECT',
        escalation_indicator: null
      };
    case 'ESCALATE':
      return {
        ui_action: 'MONITOR',
        escalation_flag: true,
        badge_class: 'critical',
        display_label: 'MONITOR (ESCALATED REVIEW REQUIRED)',
        escalation_indicator: 'ESCALATED_TO_QUALITY_ENGINEERING'
      };
    default:
      throw new Error(
        `INVALID_BACKEND_DISPOSITION: '${backendDisp}' is not a recognized backend disposition. Allowed: ${BACKEND_DISPOSITION_TAXONOMY.join(', ')}`
      );
  }
}

function validateGovernedAction(uiAction, reasonCode, comment = '') {
  const backendDisp = mapUiToBackendDisposition(uiAction);

  if (!reasonCode || typeof reasonCode !== 'string') {
    throw new Error('REASON_CODE_REQUIRED: A valid controlled reason code is required for every governed disposition.');
  }
  const cleanedReason = reasonCode.trim().toUpperCase();
  if (!REASON_CODE_TAXONOMY.includes(cleanedReason)) {
    throw new Error(
      `INVALID_REASON_CODE: '${reasonCode}' is not in authoritative reason code taxonomy. Allowed codes: ${REASON_CODE_TAXONOMY.join(', ')}`
    );
  }

  const cleanComment = String(comment || '').trim();
  if (cleanComment.length > 1000) {
    throw new Error(`COMMENT_TOO_LONG: Maximum allowed comment length is 1000 characters. Got: ${cleanComment.length}`);
  }

  return {
    ui_action: uiAction.trim().toUpperCase(),
    backend_disposition: backendDisp,
    reason_code: cleanedReason,
    comment: cleanComment,
    is_valid: true
  };
}

function deriveOperationalRecommendation(mlPrediction, probability, anomalyStatus = null, driftStatus = null, physicsStatus = null) {
  const predUpper = String(mlPrediction || '').trim().toUpperCase();
  const anomUpper = String(anomalyStatus || '').trim().toUpperCase();
  const driftUpper = String(driftStatus || '').trim().toUpperCase();
  const physUpper = String(physicsStatus || '').trim().toUpperCase();

  const numProb = Number(probability) || 0.0;

  if (numProb >= OPERATING_THRESHOLD || predUpper === 'FAIL' || anomUpper === 'REJECT' || physUpper === 'VIOLATION') {
    return 'REJECT';
  }

  if (
    anomUpper === 'MONITOR' ||
    anomUpper === 'WARNING' ||
    driftUpper === 'WARNING' ||
    driftUpper === 'HIGH_DRIFT' ||
    driftUpper === 'EXCEEDED_LIMIT' ||
    physUpper === 'DEGRADATION_FLAGGED' ||
    physUpper === 'WARNING' ||
    numProb >= (OPERATING_THRESHOLD / 2.0)
  ) {
    return 'MONITOR';
  }

  return 'PASS';
}

function formatEvidenceExplainerLayers(evidenceData = {}) {
  const data = evidenceData || {};

  // 1. Lot Deviation
  const rawLot = data.lot_deviation;
  const lotDev = (rawLot && typeof rawLot === 'object' && rawLot.status && rawLot.status !== 'INSUFFICIENT_EVIDENCE')
    ? {
        status: rawLot.status || 'NORMAL',
        max_z_score: rawLot.max_z_score !== undefined ? rawLot.max_z_score : 0.0,
        contributing_features: rawLot.contributing_features || [],
        has_evidence: true
      }
    : {
        status: INSUFFICIENT_EVIDENCE_STATUS,
        max_z_score: null,
        contributing_features: [],
        has_evidence: false
      };

  // 2. Trajectory Drift
  const rawDrift = data.trajectory_drift;
  const trajDrift = (rawDrift && typeof rawDrift === 'object' && rawDrift.has_history === true)
    ? {
        status: rawDrift.forecast_status || 'STABLE',
        drift_rate_per_hour: rawDrift.drift_rate !== undefined ? rawDrift.drift_rate : null,
        has_history: true,
        has_evidence: true
      }
    : {
        status: INSUFFICIENT_EVIDENCE_STATUS,
        drift_rate_per_hour: null,
        has_history: false,
        has_evidence: false
      };

  // 3. 168h Prognostic Forecast
  const rawProg = data.forecast_168h || data.prognostic_forecast_168h;
  const forecast168h = (rawProg && typeof rawProg === 'object' && (rawProg.predicted_leakage_168h !== undefined || rawProg.predicted_delay_168h !== undefined))
    ? {
        status: rawProg.status || 'WITHIN_LIMITS',
        predicted_leakage_168h: rawProg.predicted_leakage_168h,
        predicted_delay_168h: rawProg.predicted_delay_168h,
        lead_time_basis: LEAD_TIME_BASIS,
        has_evidence: true
      }
    : {
        status: INSUFFICIENT_EVIDENCE_STATUS,
        predicted_leakage_168h: null,
        predicted_delay_168h: null,
        lead_time_basis: LEAD_TIME_BASIS,
        has_evidence: false
      };

  // 4. Uncertainty Envelope
  const rawUncert = data.uncertainty_envelope || data.conformal_uncertainty;
  const uncertEnv = (rawUncert && typeof rawUncert === 'object' && rawUncert.coverage_probability !== undefined)
    ? {
        status: rawUncert.status || 'STABLE_ENVELOPE',
        coverage_probability: rawUncert.coverage_probability,
        conformal_band: rawUncert.conformal_band || null,
        has_evidence: true
      }
    : {
        status: INSUFFICIENT_EVIDENCE_STATUS,
        coverage_probability: null,
        conformal_band: null,
        has_evidence: false
      };

  // 5. Physics Consistency
  const rawPhys = data.physics_consistency;
  const physCons = (rawPhys && typeof rawPhys === 'object' && rawPhys.status && rawPhys.status !== 'INSUFFICIENT_PHYSICS_EVIDENCE')
    ? {
        status: rawPhys.status || 'CONSISTENT',
        consistency_score: rawPhys.consistency_score !== undefined ? rawPhys.consistency_score : null,
        checks_evaluated: rawPhys.checks_evaluated || [],
        has_evidence: true
      }
    : {
        status: INSUFFICIENT_EVIDENCE_STATUS,
        consistency_score: null,
        checks_evaluated: [],
        has_evidence: false
      };

  // 6. Risk Contribution
  const rawRisk = data.risk_contribution || data.model_counterfactual;
  const riskContrib = (rawRisk && typeof rawRisk === 'object' && Array.isArray(rawRisk.top_features) && rawRisk.top_features.length > 0)
    ? {
        status: 'ATTRIBUTION_COMPUTED',
        top_features: rawRisk.top_features,
        disclaimer: 'MODEL ATTRIBUTION — NOT A CAUSAL CLAIM',
        has_evidence: true
      }
    : {
        status: INSUFFICIENT_EVIDENCE_STATUS,
        top_features: [],
        disclaimer: 'MODEL ATTRIBUTION — NOT A CAUSAL CLAIM',
        has_evidence: false
      };

  return {
    lot_deviation: lotDev,
    trajectory_drift: trajDrift,
    prognostic_forecast_168h: forecast168h,
    uncertainty_envelope: uncertEnv,
    physics_consistency: physCons,
    risk_contribution: riskContrib
  };
}

module.exports = {
  UI_ACTION_TAXONOMY,
  ML_DECISION_TAXONOMY,
  OPERATIONAL_RECOMMENDATION_TAXONOMY,
  BACKEND_DISPOSITION_TAXONOMY,
  REASON_CODE_TAXONOMY,
  LEAD_TIME_BASIS,
  INSUFFICIENT_EVIDENCE_STATUS,
  OPERATING_THRESHOLD,
  loadTaxonomyContract,
  mapUiToBackendDisposition,
  mapBackendToUiDisposition,
  validateGovernedAction,
  deriveOperationalRecommendation,
  formatEvidenceExplainerLayers
};
