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
const { DiscriminationEngine, RootEvidenceType, TopologyPattern, NON_CAUSAL_DISCLAIMER } = require('../src/governance/discrimination_engine');
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

  runTest('Decision: Authoritative OOD shift -> HOLD (ROUTE_TO_96H_VERIFICATION)', () => {
    const res = pathway.evaluate({
      calibrated_probability: 0.08,
      ood_evidence: { classification: 'OOD', requires_hold: true, is_authoritative_decision_input: true }
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

  runTest('Targeted Anti-Fabrication Test 1: Evidence Card model provenance without supplied provenance yields NOT_ESTABLISHED', () => {
    const sample = {
      component_id: 'DIE_TEST_001',
      calibrated_probability: 0.25
      // model_provenance, model_version, model_sha256 omitted
    };
    const res = cardGen.generateCard(sample);
    assert.strictEqual(res.json.counterfactual_explanation.disclaimer, COUNTERFACTUAL_DISCLAIMER);
    assert.strictEqual(res.json.provenance_and_twin.model_provenance.status, 'NOT_ESTABLISHED');
    assert.strictEqual(res.json.provenance_and_twin.model_provenance.model_version, null);
    assert.strictEqual(res.json.provenance_and_twin.model_provenance.model_sha256, null);
    assert.strictEqual(res.json.provenance_and_twin.model_provenance.provenance_source, null);

    // Verify when caller explicitly provides verified model provenance
    const sampleVerified = {
      component_id: 'DIE_TEST_001',
      calibrated_probability: 0.25,
      model_provenance: {
        status: 'VERIFIED',
        model_version: '4.0.0_authoritative',
        model_sha256: '91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98',
        provenance_source: 'AUTHORITATIVE_PRODUCTION_MANIFEST'
      }
    };
    const resVerified = cardGen.generateCard(sampleVerified);
    assert.strictEqual(resVerified.json.provenance_and_twin.model_provenance.status, 'VERIFIED');
    assert.strictEqual(resVerified.json.provenance_and_twin.model_provenance.model_version, '4.0.0_authoritative');
    assert.strictEqual(resVerified.json.provenance_and_twin.model_provenance.model_sha256, '91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98');
  });

  console.log('\n--- 5. Targeted Governance & Provenance Integrity Tests ---');
  runTest('Targeted Anti-Fabrication Test 2: Heuristic OOD Classifier governance metadata declaration', () => {
    const meta = ood.governanceMetadata;
    assert.strictEqual(meta.baseline_type, 'GOVERNED_HEURISTIC_SPECIFICATION');
    assert.strictEqual(meta.calibration_status, 'NOT_EMPIRICALLY_CALIBRATED_PRODUCTION_BASELINE');
    assert.strictEqual(meta.usage_scope, 'BENCHMARK_SCREENING_ONLY');
    assert.strictEqual(meta.is_production_calibrated, false);
    assert.strictEqual(meta.is_authoritative_decision_input, false);
  });

  runTest('Targeted Anti-Fabrication Test 3: Uncalibrated heuristic OOD does not become authoritative production evidence', () => {
    const classification = ood.classify({
      current: 55.0, // severe divergence
      temperature: 140.0
    });
    assert.strictEqual(classification.classification, 'OOD');
    assert.strictEqual(classification.governance_metadata.is_production_calibrated, false);
    assert.strictEqual(classification.governance_metadata.usage_scope, 'BENCHMARK_SCREENING_ONLY');
    assert.strictEqual(classification.governance_metadata.baseline_type, 'GOVERNED_HEURISTIC_SPECIFICATION');
  });

  runTest('OOD Boundary Test A: Heuristic OOD cannot alter production disposition', () => {
    // Severe out-of-distribution telemetry that triggers OOD in heuristic classifier
    const sample = {
      component_id: 'DIE_HEURISTIC_OOD',
      telemetry_24h: { supply_voltage: 1.20, current: 55.0, temperature: 140.0 },
      calibrated_probability: 0.04
      // no ood_evidence provided
    };
    const res = cardGen.generateCard(sample);
    // 1. Screening OOD result is retained for transparency
    assert.strictEqual(res.json.distribution_shift.classification, 'OOD');
    // 2. Governance metadata remains non-authoritative
    assert.strictEqual(res.json.distribution_shift.is_authoritative_decision_input, false);
    assert.strictEqual(res.json.distribution_shift.usage_scope, 'BENCHMARK_SCREENING_ONLY');
    // 3 & 4. Authoritative decision pathway does NOT receive heuristic OOD as decision input; decision remains PASS
    assert.strictEqual(res.json.risk_and_governance.governed_decision, 'PASS');
    assert.strictEqual(res.json.risk_and_governance.next_action, 'RELEASE_TO_PRODUCTION');
  });

  runTest('OOD Boundary Test B: Explicitly non-authoritative caller OOD cannot alter production disposition', () => {
    const res = pathway.evaluate({
      calibrated_probability: 0.04,
      ood_evidence: {
        classification: 'OOD',
        requires_hold: true,
        is_authoritative_decision_input: false,
        governance_metadata: { is_authoritative_decision_input: false }
      }
    });
    assert.strictEqual(res.decision, GovernedDecision.PASS);
    assert.strictEqual(res.next_action, NextAction.RELEASE_TO_PRODUCTION);
  });

  runTest('OOD Boundary Test C: Verified production OOD is consumable (Governance contract test only)', () => {
    const syntheticAuthoritativeOod = {
      classification: 'OOD',
      requires_hold: true,
      is_authoritative_decision_input: true,
      provenance: 'SYNTHETIC_GOVERNED_CONTRACT_TEST_FIXTURE'
    };
    const res = pathway.evaluate({
      calibrated_probability: 0.04,
      ood_evidence: syntheticAuthoritativeOod
    });
    assert.strictEqual(res.decision, GovernedDecision.HOLD);
    assert.strictEqual(res.next_action, NextAction.ROUTE_TO_96H_VERIFICATION);
  });

  runTest('OOD Boundary Test D: No silent fallback from OODClassifier to authoritative ood_evidence', () => {
    const res = cardGen.generateCard({
      component_id: 'DIE_NO_OOD',
      telemetry_24h: { supply_voltage: 1.20 },
      calibrated_probability: 0.03
    });
    assert.strictEqual(res.json.distribution_shift.is_authoritative_decision_input, false);
    const factors = res.json.risk_and_governance.decision_factors || [];
    assert(!factors.some(f => f.includes('DISTRIBUTION_SHIFT_OOD')));
  });

  runTest('Targeted Anti-Fabrication Test 4: Champion and Challenger Ledger Provenance Verification', () => {
    const ledgerPath = path.resolve(__dirname, '../ml/governance/champion_challenger_ledger.json');
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));

    // Champion checks
    assert.strictEqual(ledger.champion.status, 'CHAMPION_ACTIVE');
    assert.strictEqual(ledger.champion.sha256_hash, '91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98');
    assert.strictEqual(ledger.champion.operating_threshold, 0.20);
    assert.strictEqual(ledger.champion.conformal_calibration_status, 'BENCHMARK_EVALUATION_ONLY');
    assert.strictEqual(ledger.champion.conformal_coverage, undefined, 'conformal_coverage must not be claimed without production calibration artifact');

    // Challenger checks
    const challenger = ledger.challengers[0];
    assert.strictEqual(challenger.artifact_status, 'HISTORICAL_REFERENCE_ONLY');
    assert.strictEqual(challenger.verification_status, 'HISTORICAL_UNVERIFIED');
    assert.strictEqual(challenger.rejection_performance_evidence, 'NOT_ESTABLISHED');
    assert.notStrictEqual(challenger.status, 'REJECTED_UNACCEPTABLE_LATENT_ESCAPES', 'Unsupported rejection claim must be removed');
  });

  console.log('\n--- 1b. Topology Pattern Synthesis & Anti-Fabrication Genealogy Checks ---');
  runTest('Topology: Missing genealogy -> INSUFFICIENT_TOPOLOGY_EVIDENCE and strictly null IDs', () => {
    const card = cardGen.generateCard({
      component_id: 'TEST-DIE-JS-01',
      telemetry_24h: { supply_voltage: 1.20 }
    });
    assert.strictEqual(card.json.component_identity.lot_id, null);
    assert.strictEqual(card.json.component_identity.wafer_id, null);
    assert.strictEqual(card.json.component_identity.equipment_id, null);

    const html = cardGen.exportHtml(card.json);
    assert(!html.includes('TSMC-FAB14'));
    assert(!html.includes('FAB-14B'));
    assert(!card.markdown.includes('TSMC-FAB14'));

    const res = discrim.evaluate({
      telemetry_0h: { supply_voltage: 1.20 },
      telemetry_24h: { supply_voltage: 1.20 }
    });
    assert.strictEqual(res.topology_pattern, TopologyPattern.INSUFFICIENT_TOPOLOGY_EVIDENCE);
    assert.strictEqual(res.topology_analytics.lot_id, null);
  });

  runTest('Topology: Spatial cluster -> WAFER_CLUSTER_PATTERN', () => {
    const res = discrim.evaluate({
      telemetry_0h: { supply_voltage: 1.20 },
      telemetry_24h: { supply_voltage: 1.20 },
      genealogy_context: {
        lot_id: 'LOT-01',
        wafer_id: 'W-05',
        spatial_cluster_detected: true
      }
    });
    assert.strictEqual(res.topology_pattern, TopologyPattern.WAFER_CLUSTER_PATTERN);
  });

  runTest('Topology: Chamber synchronization -> CHAMBER_WIDE_PATTERN', () => {
    const res = discrim.evaluate({
      telemetry_0h: { supply_voltage: 1.20 },
      telemetry_24h: { supply_voltage: 1.20 },
      genealogy_context: {
        lot_id: 'LOT-01',
        chamber_id: 'CHAMBER-B',
        chamber_synchronization_detected: true
      }
    });
    assert.strictEqual(res.topology_pattern, TopologyPattern.CHAMBER_WIDE_PATTERN);
  });

  runTest('Topology: Equipment high anomaly rate -> EQUIPMENT_WIDE_PATTERN', () => {
    const res = discrim.evaluate({
      telemetry_0h: { supply_voltage: 1.20 },
      telemetry_24h: { supply_voltage: 1.20 },
      equipment_context: {
        equipment_id: 'EQP-101',
        lot_equipment_anomaly_rate: 0.55
      }
    });
    assert.strictEqual(res.topology_pattern, TopologyPattern.EQUIPMENT_WIDE_PATTERN);
  });

  runTest('Topology: Isolated silicon degradation -> ISOLATED_COMPONENT_PATTERN', () => {
    const res = discrim.evaluate({
      telemetry_0h: { threshold_voltage: 0.450, leakage_current: 120.0 },
      telemetry_24h: { threshold_voltage: 0.490, leakage_current: 220.0 },
      anomaly_evidence: { status: 'MONITOR', copod: { score: 6.5 } },
      genealogy_context: { lot_id: 'LOT-01', wafer_id: 'W-01' }
    });
    assert.strictEqual(res.topology_pattern, TopologyPattern.ISOLATED_COMPONENT_PATTERN);
  });

  console.log('\n--- 5b. Governed Experiment Reports Verification ---');
  runTest('Report: Champion/Challenger report structure and status provenance', () => {
    const repPath = path.resolve(__dirname, '../ml/reports/ps170_champion_challenger_report.json');
    assert(fs.existsSync(repPath));
    const rep = JSON.parse(fs.readFileSync(repPath, 'utf8'));
    assert.strictEqual(rep.authoritative_champion.status, 'MEASURED');
    assert.strictEqual(rep.authoritative_champion.operating_threshold, 0.20);
    assert(rep.authoritative_champion.metrics.recall >= 0.99);

    const lgb = rep.challengers_evaluated.find(c => c.model_id === 'CHALLENGER_01_LIGHTGBM_FAST_TREE');
    assert.strictEqual(lgb.status, 'NOT_ESTABLISHED');
    assert.strictEqual(lgb.reason, 'DEPENDENCY_OR_EXECUTION_UNAVAILABLE');
  });

  runTest('Report: External Transfer report dual-section separation and UCI SECOM fail-closed', () => {
    const repPath = path.resolve(__dirname, '../ml/reports/ps170_external_transfer_experiment_report.json');
    assert(fs.existsSync(repPath));
    const rep = JSON.parse(fs.readFileSync(repPath, 'utf8'));
    assert(Array.isArray(rep.domain_compatibility_assessment));
    assert(Array.isArray(rep.quantitative_transfer_experiment));
    assert.strictEqual(rep.summary_statistics.governance_compliance, 'PASS');

    const secom = rep.quantitative_transfer_experiment.find(q => q.dataset_id === 'UCI_SECOM_SEMICONDUCTOR');
    assert.strictEqual(secom.quantitative_evaluation_status, 'NOT_ESTABLISHED');
  });

  runTest('Report: Temporal Replay causal future mutation invariance', () => {
    const repPath = path.resolve(__dirname, '../ml/reports/ps170_temporal_replay_report.json');
    assert(fs.existsSync(repPath));
    const rep = JSON.parse(fs.readFileSync(repPath, 'utf8'));
    assert.strictEqual(rep.future_information_mutation_test, 'PASS');
    assert.strictEqual(rep.mutation_invariance_details.invariance_0h_under_future_mutation, true);
    assert.strictEqual(rep.mutation_invariance_details.invariance_24h_under_future_mutation, true);
  });

  console.log('\n--- 6. Protected Artifact SHA-256 and Threshold Integrity ---');
  runTest('Protected: Production XGBoost Model SHA-256 verification', () => {
    const modelPath = path.resolve(__dirname, '../ml/models/production/predicta_xgboost_model.json');
    const content = fs.readFileSync(modelPath);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    assert.strictEqual(hash, '91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98');
  });

  runTest('Protected: Production Dataset SHA-256 verification', () => {
    const datasetPath = path.resolve(__dirname, '../ml/data/synthetic/predicta_dataset_v4_production.csv');
    const content = fs.readFileSync(datasetPath);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    assert.strictEqual(hash, '9a8367a96a7d2dcf83a62e9c0e02ab41502b6069deebc116a0e9cd0ef45fab24');
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
