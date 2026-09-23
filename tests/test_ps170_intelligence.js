/**
 * Predicta Semiconductor Intelligence Platform — Phase 15 Task 1
 * Comprehensive PS-170 Reliability Intelligence Test Suite (Node.js)
 * File: tests/test_ps170_intelligence.js
 */

'use strict';

const assert = require('assert');
const { DiscriminationEngine, RootEvidenceType, NON_CAUSAL_DISCLAIMER } = require('../src/governance/discrimination_engine');
const { OODClassifier, ShiftClassification } = require('../src/governance/ood_classifier');
const { UncertaintyDecisionPathway, GovernedDecision, NextAction, PROD_OPERATING_THRESHOLD } = require('../src/decision_engine/uncertainty_decision_pathway');
const { EvidenceCardGenerator, COUNTERFACTUAL_DISCLAIMER, PROD_MODEL_HASH, PROD_MODEL_VERSION } = require('../src/governance/evidence_card');

async function runAllIntelligenceTests() {
  console.log('=========================================================================');
  console.log('🚀 PREDICTA — PHASE 15 TASK 1 RELIABILITY INTELLIGENCE TEST SUITE (JS)');
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

  console.log('--- 1. Sensor / Equipment / Component Discrimination Engine ---');
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

  runTest('Discrim: Localized degradation -> COMPONENT_SILICON', () => {
    const res = discrim.evaluate({
      telemetry_0h: { threshold_voltage: 0.450, leakage_current: 120.0 },
      telemetry_24h: { threshold_voltage: 0.490, leakage_current: 220.0 },
      anomaly_evidence: { status: 'MONITOR', copod: { score: 6.5 } }
    });
    assert.strictEqual(res.root_evidence_type, RootEvidenceType.COMPONENT_SILICON);
  });

  runTest('Discrim: Missing input -> INSUFFICIENT_EVIDENCE', () => {
    const res = discrim.evaluate(null);
    assert.strictEqual(res.root_evidence_type, RootEvidenceType.INSUFFICIENT_EVIDENCE);
    assert.strictEqual(res.confidence_score, 0.0);
  });

  console.log('\n--- 2. Distribution Shift & OOD Classifier ---');
  runTest('OOD: Nominal distribution -> NORMAL, requires_hold: false', () => {
    const res = ood.classify({
      supply_voltage: 1.20,
      current: 15.0,
      leakage_current: 120.0,
      threshold_voltage: 0.45
    });
    assert.strictEqual(res.classification, ShiftClassification.NORMAL);
    assert.strictEqual(res.requires_hold, false);
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

  console.log('\n--- 4. Engineering Evidence Card Generator ---');
  runTest('Evidence Card: Full packet generation & provenance', () => {
    const sample = {
      component_id: 'DIE_TEST_001',
      lot_id: 'LOT_01',
      wafer_id: 'WAF_01',
      equipment_id: 'EQP-101',
      telemetry_0h: { supply_voltage: 1.20, leakage_current: 120.0, threshold_voltage: 0.45 },
      telemetry_24h: { supply_voltage: 1.20, leakage_current: 125.0, threshold_voltage: 0.452 },
      calibrated_probability: 0.04
    };
    const res = cardGen.generateCard(sample);
    assert(res.json);
    assert(res.markdown);
    assert.strictEqual(res.json.component_identity.component_id, 'DIE_TEST_001');
    assert.strictEqual(res.json.provenance_and_twin.production_model_hash, PROD_MODEL_HASH);
    assert.strictEqual(res.json.provenance_and_twin.production_model_version, PROD_MODEL_VERSION);
    assert.strictEqual(res.json.counterfactual_explanation.disclaimer, COUNTERFACTUAL_DISCLAIMER);
    assert(res.markdown.includes('PREDICTA-26 — ENGINEERING EVIDENCE CARD'));
    assert(res.markdown.includes(COUNTERFACTUAL_DISCLAIMER));
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
