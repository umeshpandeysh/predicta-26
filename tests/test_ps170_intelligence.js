/**
 * Predicta Semiconductor Intelligence Platform — Phase 15 Task 1 (Evidence Integrity Remediated)
 * Comprehensive PS-170 Reliability Intelligence & Anti-Fabrication Test Suite (Node.js)
 * File: tests/test_ps170_intelligence.js
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DiscriminationEngine, RootEvidenceType, NON_CAUSAL_DISCLAIMER } = require('../src/governance/discrimination_engine');
const { OODClassifier, ShiftClassification, OOD_GOVERNANCE_METADATA } = require('../src/governance/ood_classifier');
const { UncertaintyDecisionPathway, GovernedDecision, NextAction, PROD_OPERATING_THRESHOLD } = require('../src/decision_engine/uncertainty_decision_pathway');
const { EvidenceCardGenerator, COUNTERFACTUAL_DISCLAIMER, PROD_MODEL_HASH, PROD_MODEL_VERSION } = require('../src/governance/evidence_card');

async function runAllIntelligenceTests() {
  console.log('=========================================================================');
  console.log('🚀 PREDICTA — PHASE 15 TASK 1 EVIDENCE INTEGRITY REMEDIATION SUITE (JS)');
  console.log('=========================================================================\n');

  const discrim = new DiscriminationEngine();
  const ood = new OODClassifier();
  const pathway = new UncertaintyDecisionPathway();
  const cardGen = new EvidenceCardGenerator();

  let passed = 0;
  let failed = 0;

  function runTest(name, fn) {
    try {
      fn();
      passed++;
      console.log(`  ✓ [PASS] ${name}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ [FAIL] ${name}: ${err.message}`);
    }
  }

  console.log('--- 1. Sensor / Equipment / Component Discrimination Engine & Fail-Closed Behavior ---');
  runTest('Discrim: Range violation -> SENSOR_OR_DATA_QUALITY', () => {
    const res = discrim.evaluate({
      telemetry_0h: { supply_voltage: 1.20, current: 15.0 },
      telemetry_24h: { supply_voltage: 99.0, current: 15.0 }
    });
    assert.strictEqual(res.root_evidence_type, RootEvidenceType.SENSOR_OR_DATA_QUALITY);
    assert.strictEqual(res.disclaimer, NON_CAUSAL_DISCLAIMER);
    assert(res.findings.length > 0);
  });

  runTest('Discrim: Single channel unphysical jump -> SENSOR_OR_DATA_QUALITY', () => {
    const res = discrim.evaluate({
      telemetry_0h: { supply_voltage: 1.20, current: 15.0 },
      telemetry_24h: { supply_voltage: 1.90, current: 15.0 }
    });
    assert.strictEqual(res.root_evidence_type, RootEvidenceType.SENSOR_OR_DATA_QUALITY);
  });

  runTest('Discrim: Equipment/chamber correlation -> EQUIPMENT_OR_CHAMBER', () => {
    const res = discrim.evaluate({
      telemetry_0h: { supply_voltage: 1.20, current: 15.0 },
      telemetry_24h: { supply_voltage: 1.20, current: 15.0 },
      equipment_context: {
        equipment_id: 'EQP-103',
        lot_equipment_anomaly_rate: 0.65,
        chamber_thermal_offset_detected: true
      }
    });
    assert.strictEqual(res.root_evidence_type, RootEvidenceType.EQUIPMENT_OR_CHAMBER);
  });

  runTest('Discrim: Explicit localized silicon degradation -> COMPONENT_SILICON', () => {
    const res = discrim.evaluate({
      telemetry_0h: { threshold_voltage: 0.450, leakage_current: 120.0 },
      telemetry_24h: { threshold_voltage: 0.490, leakage_current: 220.0 },
      anomaly_evidence: { status: 'MONITOR', copod: { score: 6.5 } }
    });
    assert.strictEqual(res.root_evidence_type, RootEvidenceType.COMPONENT_SILICON);
  });

  runTest('Discrim: Nominal telemetry without fault evidence -> INSUFFICIENT_EVIDENCE (anti-fabrication)', () => {
    const res = discrim.evaluate({
      telemetry_0h: { supply_voltage: 1.20, current: 15.0, leakage_current: 120.0, threshold_voltage: 0.45 },
      telemetry_24h: { supply_voltage: 1.20, current: 15.0, leakage_current: 120.0, threshold_voltage: 0.45 }
    });
    // Absence of fault evidence must NOT become COMPONENT_SILICON
    assert.strictEqual(res.root_evidence_type, RootEvidenceType.INSUFFICIENT_EVIDENCE);
    assert.strictEqual(res.confidence_score, 0.0);
    assert.notStrictEqual(res.root_evidence_type, RootEvidenceType.COMPONENT_SILICON);
  });

  runTest('Discrim: Missing / null input -> INSUFFICIENT_EVIDENCE fail closed', () => {
    const res = discrim.evaluate(null);
    assert.strictEqual(res.root_evidence_type, RootEvidenceType.INSUFFICIENT_EVIDENCE);
    assert.strictEqual(res.confidence_score, 0.0);
  });

  console.log('\n--- 2. Distribution Shift & OOD Classifier Governance ---');
  runTest('OOD: Nominal distribution -> NORMAL, requires_hold: false', () => {
    const res = ood.classify({
      supply_voltage: 1.20,
      current: 15.0,
      leakage_current: 120.0,
      threshold_voltage: 0.45
    });
    assert.strictEqual(res.classification, ShiftClassification.NORMAL);
    assert.strictEqual(res.requires_hold, false);
    assert.strictEqual(res.governance_metadata.baseline_type, 'GOVERNED_HEURISTIC_SPECIFICATION');
  });

  runTest('OOD: Extreme values -> OOD, requires_hold: true', () => {
    const res = ood.classify({
      supply_voltage: 1.20,
      current: 45.0,
      leakage_current: 800.0,
      threshold_voltage: 0.85
    });
    assert.strictEqual(res.classification, ShiftClassification.OOD);
    assert.strictEqual(res.requires_hold, true);
  });

  runTest('OOD: Empty telemetry -> OOD fail closed', () => {
    const res = ood.classify({});
    assert.strictEqual(res.classification, ShiftClassification.OOD);
    assert.strictEqual(res.requires_hold, true);
  });

  console.log('\n--- 3. Governed Uncertainty Decision Pathway ---');
  runTest('Decision: High uncertainty -> HOLD (ROUTE_TO_96H_VERIFICATION)', () => {
    const res = pathway.evaluate({
      calibrated_probability: 0.05,
      prognostic_evidence: {
        conformal_interval: { lower: 0.02, upper: 0.60 }
      },
      ood_evidence: { classification: 'NORMAL', requires_hold: false }
    });
    assert.strictEqual(res.decision, GovernedDecision.HOLD);
    assert.strictEqual(res.next_action, NextAction.ROUTE_TO_96H_VERIFICATION);
    assert.strictEqual(res.uncertainty_routed_to_hold, true);
  });

  runTest('Decision: OOD shift -> HOLD (ROUTE_TO_96H_VERIFICATION)', () => {
    const res = pathway.evaluate({
      calibrated_probability: 0.08,
      ood_evidence: { classification: 'OOD', requires_hold: true }
    });
    assert.strictEqual(res.decision, GovernedDecision.HOLD);
    assert.strictEqual(res.next_action, NextAction.ROUTE_TO_96H_VERIFICATION);
  });

  runTest('Decision: Prob >= 0.20 -> REJECT', () => {
    const res = pathway.evaluate({
      calibrated_probability: 0.205
    });
    assert.strictEqual(res.decision, GovernedDecision.REJECT);
    assert.strictEqual(res.next_action, NextAction.SCRAP_OR_FAILURE_ANALYSIS);
    assert.strictEqual(res.uncertainty_routed_to_hold, false);
  });

  runTest('Decision: Physics inconsistent -> REJECT', () => {
    const res = pathway.evaluate({
      calibrated_probability: 0.05,
      physics_evidence: { status: 'PHYSICS_INCONSISTENT' }
    });
    assert.strictEqual(res.decision, GovernedDecision.REJECT);
    assert.strictEqual(res.next_action, NextAction.SCRAP_OR_FAILURE_ANALYSIS);
  });

  runTest('Decision: Sensor anomaly -> HOLD (SENSOR_RECALIBRATION)', () => {
    const res = pathway.evaluate({
      calibrated_probability: 0.05,
      discrimination_evidence: { root_evidence_type: 'SENSOR_OR_DATA_QUALITY', findings: ['Range breach'] }
    });
    assert.strictEqual(res.decision, GovernedDecision.HOLD);
    assert.strictEqual(res.next_action, NextAction.SENSOR_RECALIBRATION);
  });

  runTest('Decision: Equipment shift -> HOLD (EQUIPMENT_CHAMBER_AUDIT)', () => {
    const res = pathway.evaluate({
      calibrated_probability: 0.05,
      discrimination_evidence: { root_evidence_type: 'EQUIPMENT_OR_CHAMBER', findings: ['Lot shift'] }
    });
    assert.strictEqual(res.decision, GovernedDecision.HOLD);
    assert.strictEqual(res.next_action, NextAction.EQUIPMENT_CHAMBER_AUDIT);
  });

  runTest('Decision: Nominal low probability -> PASS', () => {
    const res = pathway.evaluate({
      calibrated_probability: 0.03
    });
    assert.strictEqual(res.decision, GovernedDecision.PASS);
    assert.strictEqual(res.next_action, NextAction.RELEASE_TO_PRODUCTION);
  });

  console.log('\n--- 4. Strict Provenance & Anti-Fabrication Evidence Card Assertions ---');
  runTest('Evidence Card: Missing identity remains null (no DIE_UNKNOWN/LOT_UNKNOWN fabrication)', () => {
    const sample = {
      // Explicitly missing component_id, lot_id, wafer_id, equipment_id
      telemetry_24h: { supply_voltage: 1.20, leakage_current: 120.0, threshold_voltage: 0.45 },
      calibrated_probability: 0.04
    };
    const res = cardGen.generateCard(sample);
    assert.strictEqual(res.json.component_identity.component_id, null);
    assert.strictEqual(res.json.component_identity.lot_id, null);
    assert.strictEqual(res.json.component_identity.wafer_id, null);
    assert.strictEqual(res.json.component_identity.equipment_id, null);
  });

  runTest('Evidence Card: Missing physics evaluates to INSUFFICIENT_PHYSICS_EVIDENCE (not PHYSICS_CONSISTENT)', () => {
    const sample = {
      component_id: 'DIE_REAL_001',
      telemetry_24h: { supply_voltage: 1.20, leakage_current: 120.0 },
      calibrated_probability: 0.04
      // physics_evidence omitted
    };
    const res = cardGen.generateCard(sample);
    assert.strictEqual(res.json.physics_consistency.status, 'INSUFFICIENT_PHYSICS_EVIDENCE');
    assert.strictEqual(res.json.physics_consistency.consistency_score, null);
    assert.deepStrictEqual(res.json.physics_consistency.checks_evaluated, []);
  });

  runTest('Evidence Card: Missing conformal interval remains null (no fabricated [p-0.05, p+0.05])', () => {
    const sample = {
      component_id: 'DIE_REAL_001',
      calibrated_probability: 0.04
      // prognostics.conformal_interval omitted
    };
    const res = cardGen.generateCard(sample);
    assert.strictEqual(res.json.early_prognostics.conformal_uncertainty, null);
  });

  runTest('Evidence Card: Missing telemetry data quality evaluates to INSUFFICIENT_EVIDENCE', () => {
    const sample = {};
    const res = cardGen.generateCard(sample);
    assert.strictEqual(res.json.data_quality.status, 'INSUFFICIENT_EVIDENCE');
    assert.strictEqual(res.json.provenance_and_twin.twin_trace_id, null);
    assert.strictEqual(res.json.provenance_and_twin.operator_disposition, null);
  });

  runTest('Evidence Card: Enforces non-causal counterfactual disclaimer and model SHA-256', () => {
    const sample = {
      component_id: 'DIE_TEST_001',
      calibrated_probability: 0.25
    };
    const res = cardGen.generateCard(sample);
    assert.strictEqual(res.json.counterfactual_explanation.disclaimer, COUNTERFACTUAL_DISCLAIMER);
    assert.strictEqual(res.json.provenance_and_twin.production_model_hash, PROD_MODEL_HASH);
    assert.strictEqual(res.json.provenance_and_twin.production_model_version, PROD_MODEL_VERSION);
  });

  console.log('\n--- 5. Protected Artifact SHA-256 and Threshold Integrity ---');
  runTest('Protected: Production XGBoost Model SHA-256 verification', () => {
    const modelPath = path.resolve(__dirname, '../ml/models/production/predicta_xgboost_model.json');
    const content = fs.readFileSync(modelPath);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    assert.strictEqual(hash, '91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98');
  });

  runTest('Protected: Authoritative Operating Threshold is strictly 0.20', () => {
    assert.strictEqual(PROD_OPERATING_THRESHOLD, 0.20);
  });

  console.log('\n=========================================================================');
  console.log(`SUMMARY: Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('=========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runAllIntelligenceTests();
}

module.exports = { runAllIntelligenceTests };
