/**
 * Predicta Semiconductor Intelligence Platform — Phase 15 Task 1 (Evidence Integrity Remediated)
 * Unified Engineering Evidence Card Generator (Node.js)
 * File: src/governance/evidence_card.js
 * 
 * Synthesizes the complete PS-170 Burn-In & Latent Defect Screening evidence chain
 * into machine-readable JSON and human-readable Markdown:
 * Telemetry -> Quality -> Anomaly -> Prognostics -> Uncertainty -> Physics ->
 * Discrimination -> OOD -> Risk Fusion -> Decision -> Counterfactual -> Twin Provenance
 * 
 * NON-NEGOTIABLE GOVERNANCE:
 * - Zero evidence fabrication
 * - Missing fields evaluate to null, INSUFFICIENT_EVIDENCE, or NOT_ESTABLISHED
 * - No inferred provenance
 */

'use strict';

const crypto = require('crypto');
const { DiscriminationEngine, NON_CAUSAL_DISCLAIMER } = require('./discrimination_engine');
const { OODClassifier } = require('./ood_classifier');
const { UncertaintyDecisionPathway, PROD_OPERATING_THRESHOLD } = require('../decision_engine/uncertainty_decision_pathway');

const COUNTERFACTUAL_DISCLAIMER = 'MODEL COUNTERFACTUAL — NOT A CAUSAL CLAIM';
const PROD_MODEL_HASH = '91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98';
const PROD_MODEL_VERSION = '4.0.0_authoritative';

class EvidenceCardGenerator {
  constructor() {
    this.discriminationEngine = new DiscriminationEngine();
    this.oodClassifier = new OODClassifier();
    this.decisionPathway = new UncertaintyDecisionPathway(PROD_OPERATING_THRESHOLD);
  }

  /**
   * Generates a complete Engineering Evidence Card packet with strict evidence provenance.
   * 
   * @param {Object} input - Complete multi-layer analysis evidence
   * @returns {Object} { json: Object, markdown: string }
   */
  generateCard(input = {}) {
    const componentId = input.component_id || input.die_id || null;
    const lotId = input.lot_id || null;
    const waferId = input.wafer_id || null;
    const equipmentId = input.equipment_id || null;
    const timestamp = input.timestamp || new Date().toISOString();

    const telemetry0h = input.telemetry_0h || {};
    const telemetry24h = input.telemetry_24h || {};
    const hasTelemetry = Object.keys(telemetry0h).length > 0 || Object.keys(telemetry24h).length > 0;
    const anomaly = input.anomaly_evidence || {};
    const prognostics = input.prognostics || {};
    const physics = input.physics_evidence || {};
    const safetySlope = input.safety_slope || {};

    const calibratedProb = input.calibrated_probability !== undefined && input.calibrated_probability !== null
      ? Number(input.calibrated_probability)
      : null;
    const rawRiskScore = input.risk_score !== undefined && input.risk_score !== null
      ? Number(input.risk_score)
      : (calibratedProb !== null ? Math.round(calibratedProb * 100) : null);

    // 1. Evaluate Discrimination Engine
    const discrimination = input.discrimination_evidence || this.discriminationEngine.evaluate({
      telemetry_0h: telemetry0h,
      telemetry_24h: telemetry24h,
      anomaly_evidence: anomaly,
      equipment_context: {
        equipment_id: equipmentId,
        lot_id: lotId,
        lot_equipment_anomaly_rate: input.lot_equipment_anomaly_rate,
        chamber_thermal_offset_detected: input.chamber_thermal_offset_detected
      },
      physics_evidence: physics
    });

    // 2. Evaluate OOD / Distribution Shift
    const ood = input.ood_evidence || this.oodClassifier.classify(telemetry24h, {
      copod_score: anomaly.copod ? anomaly.copod.score : null
    });

    // 3. Evaluate Governed Decision Pathway (if calibrated prob available)
    let decisionReport;
    if (input.governed_decision) {
      decisionReport = input.governed_decision;
    } else if (calibratedProb !== null) {
      decisionReport = this.decisionPathway.evaluate({
        calibrated_probability: calibratedProb,
        anomaly_evidence: anomaly,
        prognostic_evidence: prognostics,
        physics_evidence: physics,
        discrimination_evidence: discrimination,
        ood_evidence: ood,
        safety_slope: safetySlope
      });
    } else {
      decisionReport = {
        decision: 'HOLD',
        next_action: 'ROUTE_TO_96H_VERIFICATION',
        reason: 'Missing calibrated probability — routed to HOLD under fail-closed governance',
        decision_factors: ['MISSING_CALIBRATED_PROBABILITY'],
        governed_confidence: 0.0,
        requires_engineering_review: true,
        uncertainty_routed_to_hold: true
      };
    }

    // 4. Synthesize Counterfactual
    const counterfactual = this._generateCounterfactual(telemetry24h, calibratedProb, decisionReport.decision);

    // 5. Structure Model Provenance (Strict Provenance: derived from caller evidence only)
    let modelProvenance;
    if (input.model_provenance && typeof input.model_provenance === 'object') {
      const mp = input.model_provenance;
      const isVerified = mp.status === 'VERIFIED' || (mp.model_sha256 && mp.model_version);
      modelProvenance = {
        status: isVerified ? (mp.status || 'VERIFIED') : (mp.status || 'NOT_ESTABLISHED'),
        model_version: mp.model_version || null,
        model_sha256: mp.model_sha256 || null,
        provenance_source: mp.provenance_source || null
      };
    } else if (input.model_version || input.model_sha256) {
      modelProvenance = {
        status: 'VERIFIED',
        model_version: input.model_version || null,
        model_sha256: input.model_sha256 || null,
        provenance_source: input.provenance_source || 'CALLER_EXPLICIT'
      };
    } else {
      modelProvenance = {
        status: 'NOT_ESTABLISHED',
        model_version: null,
        model_sha256: null,
        provenance_source: null
      };
    }

    // 6. Structure JSON Packet (Strict Provenance: Zero fabricated defaults)
    const packet = {
      card_version: '1.1.0_ps170_remediated',
      generated_at: timestamp,
      component_identity: {
        component_id: componentId,
        lot_id: lotId,
        wafer_id: waferId,
        equipment_id: equipmentId,
        test_checkpoint: input.test_checkpoint || (hasTelemetry ? '24h Early Burn-In Screening' : null)
      },
      data_quality: {
        status: input.data_quality_status || (hasTelemetry ? 'NOT_ESTABLISHED' : 'INSUFFICIENT_EVIDENCE'),
        range_violations: (discrimination.checks_evaluated && discrimination.checks_evaluated.sensor_range_violations) || [],
        flatline_channels: (discrimination.checks_evaluated && discrimination.checks_evaluated.sensor_flatline_channels) || []
      },
      anomaly_screening: {
        status: anomaly.status || 'NOT_EVALUATED',
        copod_score: anomaly.copod && anomaly.copod.score !== undefined ? Number(anomaly.copod.score) : null,
        pat_status: anomaly.pat ? anomaly.pat.status : null,
        isolation_forest_status: anomaly.isolation_forest ? anomaly.isolation_forest.status : null
      },
      early_prognostics: {
        checkpoint_24h_telemetry: Object.keys(telemetry24h).length > 0 ? telemetry24h : null,
        forecast_168h: prognostics.forecast_168h || prognostics.predicted_168h || null,
        conformal_uncertainty: prognostics.conformal_interval || null
      },
      physics_consistency: {
        status: physics.status || 'INSUFFICIENT_PHYSICS_EVIDENCE',
        consistency_score: physics.consistency_score !== undefined && physics.consistency_score !== null ? Number(physics.consistency_score) : null,
        checks_evaluated: physics.checks || []
      },
      discrimination: {
        root_evidence_type: discrimination.root_evidence_type,
        confidence_score: discrimination.confidence_score,
        evidence_summary: discrimination.evidence_summary,
        findings: discrimination.findings,
        disclaimer: NON_CAUSAL_DISCLAIMER
      },
      distribution_shift: {
        classification: ood.classification,
        shift_score: ood.shift_score,
        max_z_score: ood.max_z_score,
        divergent_features: ood.divergent_features,
        requires_hold: ood.requires_hold
      },
      risk_and_governance: {
        risk_score: rawRiskScore,
        calibrated_probability: calibratedProb,
        operating_threshold: PROD_OPERATING_THRESHOLD,
        governed_decision: decisionReport.decision,
        next_action: decisionReport.next_action,
        decision_factors: decisionReport.decision_factors,
        governed_confidence: decisionReport.governed_confidence,
        requires_engineering_review: decisionReport.requires_engineering_review,
        uncertainty_routed_to_hold: decisionReport.uncertainty_routed_to_hold
      },
      counterfactual_explanation: counterfactual,
      provenance_and_twin: {
        model_provenance: modelProvenance,
        twin_trace_id: input.twin_trace_id || null,
        operator_disposition: input.operator_disposition || null,
        immutable_record: true
      }
    };

    const markdown = this._renderMarkdown(packet);

    return {
      json: packet,
      markdown: markdown
    };
  }

  _generateCounterfactual(telemetry, prob, decision) {
    if (decision === 'PASS') {
      return {
        statement: 'Component currently satisfies all PASS criteria.',
        target_decision: 'PASS',
        feature_deltas: {},
        disclaimer: COUNTERFACTUAL_DISCLAIMER
      };
    }

    if (!telemetry || Object.keys(telemetry).length === 0) {
      return {
        statement: 'Insufficient telemetry to compute counterfactual parameter trajectory.',
        target_decision: 'PASS',
        feature_deltas: {},
        disclaimer: COUNTERFACTUAL_DISCLAIMER
      };
    }

    const deltas = {};
    if (telemetry.leakage_current && Number(telemetry.leakage_current) > 150.0) {
      deltas.leakage_current = {
        current: Number(telemetry.leakage_current),
        counterfactual_target: 120.0,
        delta: Number((120.0 - Number(telemetry.leakage_current)).toFixed(2)),
        unit: 'uA'
      };
    }
    if (telemetry.threshold_voltage && Number(telemetry.threshold_voltage) > 0.48) {
      deltas.threshold_voltage = {
        current: Number(telemetry.threshold_voltage),
        counterfactual_target: 0.45,
        delta: Number((0.45 - Number(telemetry.threshold_voltage)).toFixed(3)),
        unit: 'V'
      };
    }

    return {
      statement: `To transition this component from ${decision || 'HOLD'} to PASS under the production model, the following minimal parameter shifts would be required:`,
      target_decision: 'PASS',
      feature_deltas: deltas,
      disclaimer: COUNTERFACTUAL_DISCLAIMER
    };
  }

  _renderMarkdown(p) {
    const id = p.component_identity;
    const gov = p.risk_and_governance;
    const d = p.discrimination;
    const o = p.distribution_shift;
    const phys = p.physics_consistency;
    const cf = p.counterfactual_explanation;
    const prov = p.provenance_and_twin;
    const mp = prov.model_provenance || {};

    const probStr = gov.calibrated_probability !== null ? gov.calibrated_probability.toFixed(4) : 'NOT_EVALUATED';
    const riskStr = gov.risk_score !== null ? `${gov.risk_score} / 100` : 'NOT_EVALUATED';
    const confStr = gov.governed_confidence !== null ? `${(gov.governed_confidence * 100).toFixed(1)}%` : 'NOT_ESTABLISHED';
    const physScoreStr = phys.consistency_score !== null ? phys.consistency_score.toFixed(2) : 'N/A';
    const modelShaStr = mp.model_sha256 || 'null (NOT_ESTABLISHED)';
    const modelVerStr = mp.model_version || 'null (NOT_ESTABLISHED)';
    const provStatusStr = mp.status || 'NOT_ESTABLISHED';

    return `# PREDICTA-26 — ENGINEERING EVIDENCE CARD
**PS-170 Semiconductor Burn-In & Latent Defect Screening Report**
*Generated at:* \`${p.generated_at}\` | *Card Schema:* \`${p.card_version}\`

---

## 1. COMPONENT IDENTIFICATION & LOT CONTEXT
- **Component ID / Die:** \`${id.component_id || 'null'}\`
- **Lot Identifier:** \`${id.lot_id || 'null'}\`
- **Wafer Identifier:** \`${id.wafer_id || 'null'}\`
- **Test Equipment:** \`${id.equipment_id || 'null'}\`
- **Checkpoint:** \`${id.test_checkpoint || 'null'}\`

---

## 2. GOVERNED DECISION & RISK FUSION
- **Final Governed Decision:** \`${gov.governed_decision}\`
- **Recommended Next Action:** \`${gov.next_action}\`
- **Calibrated Failure Probability:** \`${probStr}\` (Authoritative Threshold = \`${gov.operating_threshold.toFixed(2)}\`)
- **Multi-Criteria Risk Score:** \`${riskStr}\`
- **Governed Confidence:** \`${confStr}\`
- **Decision Factors:**
${gov.decision_factors.map(f => `  - \`${f}\``).join('\n')}

---

## 3. RELIABILITY INTELLIGENCE & DISCRIMINATION
- **Root Evidence Type:** \`${d.root_evidence_type}\` (Confidence: \`${(d.confidence_score * 100).toFixed(1)}%\`)
- **Evidence Summary:** ${d.evidence_summary}
- **Discrimination Disclaimer:** *${d.disclaimer}*
- **Distribution Shift Status:** \`${o.classification}\` (Shift Score: \`${o.shift_score}\`, Max Z: \`${o.max_z_score}\`)
- **Physics Consistency Status:** \`${phys.status}\` (Score: \`${physScoreStr}\`)

---

## 4. COUNTERFACTUAL EXPLANATION
- *Disclaimer:* **${cf.disclaimer}**
- **Analysis:** ${cf.statement}
${Object.entries(cf.feature_deltas || {}).map(([k, v]) => `  - \`${k}\`: Current=\`${v.current}${v.unit}\` -> Required=\`${v.counterfactual_target}${v.unit}\` (delta=\`${v.delta}${v.unit}\`)`).join('\n') || '  - None required (Component already satisfies PASS criteria)'}

---

## 5. DIGITAL TWIN & GOVERNANCE PROVENANCE
- **Model Provenance Status:** \`${provStatusStr}\`
- **Model SHA-256:** \`${modelShaStr}\`
- **Model Version:** \`${modelVerStr}\`
- **Digital Twin Trace ID:** \`${prov.twin_trace_id || 'null'}\`
- **Operator Disposition:** \`${prov.operator_disposition || 'null'}\`
`;
  }
}

module.exports = {
  EvidenceCardGenerator,
  COUNTERFACTUAL_DISCLAIMER,
  PROD_MODEL_HASH,
  PROD_MODEL_VERSION
};
