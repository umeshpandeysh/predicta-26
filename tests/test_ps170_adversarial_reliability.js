/**
 * PREDICTA-26 — PS-170 Adversarial Reliability Unit Test Suite (JavaScript)
 * File: tests/test_ps170_adversarial_reliability.js
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { DiscriminationEngine } = require('../src/governance/discrimination_engine');
const { UncertaintyDecisionPathway, GovernedDecision, NextAction, PROD_OPERATING_THRESHOLD } = require('../src/decision_engine/uncertainty_decision_pathway');
const { OODClassifier } = require('../src/governance/ood_classifier');
const { EvidenceCardGenerator, PROD_MODEL_HASH } = require('../src/governance/evidence_card');

function runAdversarialJsSuite() {
  console.log('='.repeat(80));
  console.log('🚀 PREDICTA — PS-170 ADVERSARIAL RELIABILITY TEST SUITE (JS)');
  console.log('='.repeat(80));

  const discriminationEngine = new DiscriminationEngine();
  const decisionPathway = new UncertaintyDecisionPathway();
  const oodClassifier = new OODClassifier();
  const cardGenerator = new EvidenceCardGenerator();

  let passed = 0;
  let total = 0;

  function runTest(id, name, fn) {
    total++;
    try {
      fn();
      passed++;
      console.log(`  ✓ [PASS] Attack ${String(id).padStart(2, '0')}: ${name}`);
    } catch (err) {
      console.error(`  ✗ [FAIL] Attack ${String(id).padStart(2, '0')}: ${name} -> ${err.message}`);
    }
  }

  // Attack 1: Sensor Range Breach
  runTest(1, 'Sensor Range Breach', () => {
    const res = discriminationEngine.evaluate({ telemetry_24h: { supply_voltage: 4.85, current: 10.0 } });
    assert.strictEqual(res.root_evidence_type, 'SENSOR_OR_DATA_QUALITY');
  });

  // Attack 2: Unphysical Single-Channel Step
  runTest(2, 'Single Channel Unphysical Step', () => {
    const res = discriminationEngine.evaluate({
      telemetry_0h: { supply_voltage: 1.20, current: 10.0 },
      telemetry_24h: { supply_voltage: 1.85, current: 10.0001 }
    });
    assert.strictEqual(res.root_evidence_type, 'SENSOR_OR_DATA_QUALITY');
  });

  // Attack 3: Dynamic Channel Flatline
  runTest(3, 'Dynamic Channel Flatline', () => {
    const res = discriminationEngine.evaluate({
      telemetry_0h: { leakage_current: 120.0, propagation_delay: 11.0, dynamic_power: 12.0, temperature: 25.0 },
      telemetry_24h: { leakage_current: 120.0, propagation_delay: 11.0, dynamic_power: 12.0, temperature: 25.0 }
    });
    assert.strictEqual(res.root_evidence_type, 'SENSOR_OR_DATA_QUALITY');
  });

  // Attack 4: NaN Telemetry Injection
  runTest(4, 'NaN Telemetry Injection', () => {
    const res = discriminationEngine.evaluate({ telemetry_24h: { supply_voltage: NaN, current: 10.0 } });
    assert.strictEqual(res.root_evidence_type, 'SENSOR_OR_DATA_QUALITY');
  });

  // Attack 5: Negative Parameter
  runTest(5, 'Negative Parameter Violation', () => {
    const res = discriminationEngine.evaluate({ telemetry_24h: { leakage_current: -15.0, current: 10.0 } });
    assert.strictEqual(res.root_evidence_type, 'SENSOR_OR_DATA_QUALITY');
  });

  // Attack 6: Lot-Wide Equipment Shift
  runTest(6, 'Lot-Wide Equipment Shift', () => {
    const res = discriminationEngine.evaluate({
      telemetry_0h: { current: 10.0 },
      telemetry_24h: { current: 10.2 },
      equipment_context: { equipment_id: 'EQP-101', lot_equipment_anomaly_rate: 0.65 }
    });
    assert.strictEqual(res.root_evidence_type, 'EQUIPMENT_OR_CHAMBER');
  });

  // Attack 7: Chamber Thermal Excursion
  runTest(7, 'Chamber Thermal Excursion', () => {
    const res = discriminationEngine.evaluate({
      telemetry_0h: { current: 10.0 },
      telemetry_24h: { current: 10.2 },
      equipment_context: { chamber_thermal_offset_detected: true, chamber_thermal_offset_c: 18.5 }
    });
    assert.strictEqual(res.root_evidence_type, 'EQUIPMENT_OR_CHAMBER');
  });

  // Attack 8: Unseen Equipment ID Handling
  runTest(8, 'Unseen Equipment ID Handling', () => {
    const pkt = cardGenerator.generatePacket({
      component_id: 'DIE-01',
      equipment_id: 'EQP-UNKNOWN-999'
    });
    assert.strictEqual(pkt.component_genealogy.tester_id, 'EQP-UNKNOWN-999');
  });

  // Attack 9: Spatial Wafer Topology
  runTest(9, 'Spatial Wafer Topology', () => {
    const pkt = cardGenerator.generatePacket({
      component_id: 'DIE-EDGE-01',
      genealogy_context: { spatial_cluster_detected: true, die_x: 48, die_y: 48 }
    });
    assert.strictEqual(pkt.component_genealogy.die_x, 48);
  });

  // Attack 10: OOD Non-Authoritative Screening
  runTest(10, 'OOD Non-Authoritative Screening', () => {
    const ood = oodClassifier.classify({ current: 85.0, temperature: 180.0, leakage_current: 950.0 });
    assert.strictEqual(ood.classification, 'OOD');
    assert.strictEqual(ood.governance_metadata.is_authoritative_decision_input, false);
  });

  // Attack 11: Operating Threshold Breach (0.25 >= 0.20)
  runTest(11, 'Operating Threshold Breach (0.25 >= 0.20)', () => {
    const dec = decisionPathway.evaluate({ calibrated_probability: 0.25 });
    assert.strictEqual(dec.decision, GovernedDecision.REJECT);
    assert.strictEqual(dec.next_action, NextAction.SCRAP_OR_FAILURE_ANALYSIS);
  });

  // Attack 12: Critical Probability Breach (0.82)
  runTest(12, 'Critical Probability Breach (0.82)', () => {
    const dec = decisionPathway.evaluate({ calibrated_probability: 0.82 });
    assert.strictEqual(dec.decision, GovernedDecision.REJECT);
  });

  // Attack 13: Nominal Component Release
  runTest(13, 'Nominal Component Release', () => {
    const dec = decisionPathway.evaluate({ calibrated_probability: 0.04 });
    assert.strictEqual(dec.decision, GovernedDecision.PASS);
    assert.strictEqual(dec.next_action, NextAction.RELEASE_TO_PRODUCTION);
  });

  // Attack 14: Borderline Risk Monitored Burn-In
  runTest(14, 'Borderline Risk Monitored Burn-In', () => {
    const dec = decisionPathway.evaluate({ calibrated_probability: 0.14 });
    assert.strictEqual(dec.decision, GovernedDecision.MONITOR);
    assert.strictEqual(dec.next_action, NextAction.CONTINUE_MONITORED_BURN_IN);
  });

  // Attack 15: Safety Slope Boundary Breach
  runTest(15, 'Safety Slope Boundary Breach', () => {
    const dec = decisionPathway.evaluate({
      calibrated_probability: 0.05,
      safety_slope: { iddq: { boundary_status: 'EXCEEDED', slope_per_hour: 1.85 } }
    });
    assert.strictEqual(dec.decision, GovernedDecision.REJECT);
  });

  // Attack 16: Physics Consistency Violation
  runTest(16, 'Physics Consistency Violation', () => {
    const dec = decisionPathway.evaluate({
      calibrated_probability: 0.05,
      physics_evidence: { status: 'PHYSICS_INCONSISTENT' }
    });
    assert.strictEqual(dec.decision, GovernedDecision.REJECT);
  });

  // Attack 17: HTML Export Rendering
  runTest(17, 'HTML Evidence Packet Export', () => {
    const pkt = cardGenerator.generatePacket({ component_id: 'DIE-HTML-01', calibrated_probability: 0.08 });
    const html = cardGenerator.exportHtml(pkt);
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('DIE-HTML-01'));
  });

  // Attack 18: Fail-Closed Decision on Empty Object
  runTest(18, 'Fail-Closed Decision on Empty Object', () => {
    const dec = decisionPathway.evaluate(null);
    assert.strictEqual(dec.decision, GovernedDecision.HOLD);
  });

  // Attack 19: Missing Model Provenance Anti-Fabrication
  runTest(19, 'Missing Model Provenance Anti-Fabrication', () => {
    const card = cardGenerator.generateCard({ component_id: 'TEST-01' });
    const mp = card.json.provenance_and_twin.model_provenance;
    assert.strictEqual(mp.model_sha256, null);
    assert.strictEqual(mp.status, 'NOT_ESTABLISHED');
  });

  // Attack 20: Protected Model SHA & Threshold
  runTest(20, 'Protected Model SHA & Threshold', () => {
    const prodModelPath = path.join(__dirname, '..', 'ml', 'models', 'production', 'predicta_xgboost_model.json');
    const content = fs.readFileSync(prodModelPath);
    const sha = crypto.createHash('sha256').update(content).digest('hex');
    assert.strictEqual(sha, PROD_MODEL_HASH);
    assert.strictEqual(PROD_OPERATING_THRESHOLD, 0.20);
  });

  console.log('='.repeat(80));
  console.log(`SUMMARY: Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log('='.repeat(80));
  assert.strictEqual(passed, total, 'All 20 adversarial tests must pass');
}

if (require.main === module) {
  runAdversarialJsSuite();
}

module.exports = { runAdversarialJsSuite };
