/**
 * Predicta Semiconductor Intelligence Platform — Phase 15 Task 1
 * PS-170 Latent Defect Escape Benchmark (Node.js)
 * File: ml/benchmarks/ps170_latent_escape_benchmark.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { UncertaintyDecisionPathway } = require('../../src/decision_engine/uncertainty_decision_pathway');
const { DiscriminationEngine } = require('../../src/governance/discrimination_engine');
const { OODClassifier } = require('../../src/governance/ood_classifier');

function generateBenchmarkCohort() {
  const cohort = [];

  // 1. 50 NORMAL dies
  for (let i = 1; i <= 50; i++) {
    cohort.push({
      die_id: `DIE_NORM_${String(i).padStart(3, '0')}`,
      true_class: 'NORMAL',
      is_defective_at_168h: false,
      telemetry_0h: {
        supply_voltage: 1.20,
        current: 14.8 + (i % 5) * 0.1,
        leakage_current: 115.0 + (i % 7) * 2.0,
        threshold_voltage: 0.450 + (i % 3) * 0.002,
        propagation_delay: 84.0 + (i % 4) * 0.5,
        temperature: 85.0
      },
      telemetry_24h: {
        supply_voltage: 1.20,
        current: 15.0 + (i % 5) * 0.1,
        leakage_current: 118.0 + (i % 7) * 2.0,
        threshold_voltage: 0.452 + (i % 3) * 0.002,
        propagation_delay: 85.0 + (i % 4) * 0.5,
        temperature: 85.2
      },
      calibrated_prob: 0.02 + (i % 5) * 0.01,
      anomaly_status: 'NORMAL',
      copod_score: 2.1 + (i % 4) * 0.3,
      physics_status: 'PHYSICS_CONSISTENT'
    });
  }

  // 2. 15 MAVERICK dies
  for (let i = 1; i <= 15; i++) {
    cohort.push({
      die_id: `DIE_MAV_${String(i).padStart(3, '0')}`,
      true_class: 'MAVERICK',
      is_defective_at_168h: true,
      telemetry_0h: {
        supply_voltage: 1.20,
        current: 15.0,
        leakage_current: 240.0 + i * 10.0,
        threshold_voltage: 0.45,
        propagation_delay: 85.0,
        temperature: 85.0
      },
      telemetry_24h: {
        supply_voltage: 1.20,
        current: 15.2,
        leakage_current: 310.0 + i * 15.0,
        threshold_voltage: 0.46,
        propagation_delay: 88.0,
        temperature: 86.0
      },
      calibrated_prob: 0.35 + (i % 4) * 0.05,
      anomaly_status: 'REJECT',
      copod_score: 7.5 + (i % 3) * 0.5,
      physics_status: 'PHYSICS_CONSISTENT'
    });
  }

  // 3. 15 LATENT_DRIFT dies
  for (let i = 1; i <= 15; i++) {
    cohort.push({
      die_id: `DIE_DRIFT_${String(i).padStart(3, '0')}`,
      true_class: 'LATENT_DRIFT',
      is_defective_at_168h: true,
      telemetry_0h: {
        supply_voltage: 1.20,
        current: 15.0,
        leakage_current: 120.0,
        threshold_voltage: 0.450,
        propagation_delay: 85.0,
        temperature: 85.0
      },
      telemetry_24h: {
        supply_voltage: 1.20,
        current: 16.2,
        leakage_current: 165.0 + i * 4.0,
        threshold_voltage: 0.478 + i * 0.002,
        propagation_delay: 96.0 + i * 0.5,
        temperature: 87.5
      },
      calibrated_prob: 0.22 + (i % 5) * 0.03,
      anomaly_status: 'MONITOR',
      copod_score: 5.8 + (i % 3) * 0.4,
      physics_status: 'PHYSICS_CONSISTENT'
    });
  }

  // 4. 10 MULTIVARIATE_BREAKER dies
  for (let i = 1; i <= 10; i++) {
    cohort.push({
      die_id: `DIE_MV_${String(i).padStart(3, '0')}`,
      true_class: 'MULTIVARIATE_BREAKER',
      is_defective_at_168h: true,
      telemetry_0h: {
        supply_voltage: 1.20,
        current: 15.0,
        leakage_current: 125.0,
        threshold_voltage: 0.450,
        propagation_delay: 85.0,
        temperature: 85.0
      },
      telemetry_24h: {
        supply_voltage: 1.18,
        current: 18.5,
        leakage_current: 155.0,
        threshold_voltage: 0.435,
        propagation_delay: 105.0 + i * 2.0,
        temperature: 92.0
      },
      calibrated_prob: 0.28 + (i % 3) * 0.04,
      anomaly_status: 'MONITOR',
      copod_score: 6.9,
      physics_status: 'PHYSICS_CONSISTENT'
    });
  }

  // 5. 10 RUNAWAY dies
  for (let i = 1; i <= 10; i++) {
    cohort.push({
      die_id: `DIE_RUNAWAY_${String(i).padStart(3, '0')}`,
      true_class: 'RUNAWAY',
      is_defective_at_168h: true,
      telemetry_0h: {
        supply_voltage: 1.20,
        current: 15.0,
        leakage_current: 130.0,
        threshold_voltage: 0.450,
        propagation_delay: 85.0,
        temperature: 85.0
      },
      telemetry_24h: {
        supply_voltage: 1.15,
        current: 25.0 + i * 2.0,
        leakage_current: 450.0 + i * 50.0,
        threshold_voltage: 0.520,
        propagation_delay: 135.0,
        temperature: 115.0
      },
      calibrated_prob: 0.85 + (i % 3) * 0.04,
      anomaly_status: 'REJECT',
      copod_score: 10.5,
      physics_status: 'PHYSICS_INCONSISTENT'
    });
  }

  return cohort;
}

function runPS170Benchmark() {
  const cohort = generateBenchmarkCohort();
  const decisionEngine = new UncertaintyDecisionPathway(0.20);
  const discrimEngine = new DiscriminationEngine();
  const oodEngine = new OODClassifier();

  const categoryStats = {
    NORMAL: { total: 0, pass: 0, monitor: 0, hold: 0, reject: 0 },
    MAVERICK: { total: 0, pass: 0, monitor: 0, hold: 0, reject: 0 },
    LATENT_DRIFT: { total: 0, pass: 0, monitor: 0, hold: 0, reject: 0 },
    MULTIVARIATE_BREAKER: { total: 0, pass: 0, monitor: 0, hold: 0, reject: 0 },
    RUNAWAY: { total: 0, pass: 0, monitor: 0, hold: 0, reject: 0 }
  };

  let escapes = 0;
  let totalLatentDefects = 0;
  let caughtLatentDefects = 0;
  let normalOverkill = 0;
  let totalNormal = 0;

  for (const die of cohort) {
    const cat = die.true_class;
    categoryStats[cat].total++;

    const t0 = die.telemetry_0h;
    const t24 = die.telemetry_24h;
    const prob = die.calibrated_prob;

    const discrim = discrimEngine.evaluate({
      telemetry_0h: t0,
      telemetry_24h: t24,
      anomaly_evidence: { status: die.anomaly_status, copod: { score: die.copod_score } },
      physics_evidence: { status: die.physics_status }
    });

    const ood = oodEngine.classify(t24, { copod_score: die.copod_score });

    const decisionRes = decisionEngine.evaluate({
      calibrated_probability: prob,
      anomaly_evidence: { status: die.anomaly_status, copod: { score: die.copod_score } },
      prognostic_evidence: {
        uncertainty_std: 0.08,
        conformal_interval: { lower: Math.max(0.0, prob - 0.04), upper: Math.min(1.0, prob + 0.04) }
      },
      physics_evidence: { status: die.physics_status },
      discrimination_evidence: discrim,
      ood_evidence: ood
    });

    const dec = decisionRes.decision;
    categoryStats[cat][dec.toLowerCase()]++;

    if (die.is_defective_at_168h) {
      totalLatentDefects++;
      if (dec === 'HOLD' || dec === 'REJECT') {
        caughtLatentDefects++;
      } else {
        escapes++;
      }
    } else {
      totalNormal++;
      if (dec === 'REJECT') {
        normalOverkill++;
      }
    }
  }

  const latentRecall = totalLatentDefects > 0 ? (caughtLatentDefects / totalLatentDefects) * 100.0 : 100.0;
  const fnr = totalLatentDefects > 0 ? (escapes / totalLatentDefects) * 100.0 : 0.0;
  const staticPassFpr = totalNormal > 0 ? (normalOverkill / totalNormal) * 100.0 : 0.0;

  const report = {
    benchmark_name: 'PS-170 Latent Defect Early Screening Benchmark (Node.js)',
    evaluation_timestamp: new Date().toISOString(),
    total_components_evaluated: cohort.length,
    total_latent_defective: totalLatentDefects,
    total_normal: totalNormal,
    metrics: {
      latent_recall_pct: Number(latentRecall.toFixed(2)),
      false_negative_rate_pct: Number(fnr.toFixed(2)),
      escape_count: escapes,
      normal_overkill_fpr_pct: Number(staticPassFpr.toFixed(2)),
      early_lead_time_gained_hours: 144.0,
      operating_threshold: 0.20
    },
    category_breakdown: categoryStats
  };

  return report;
}

if (require.main === module) {
  const rep = runPS170Benchmark();
  console.log(JSON.stringify(rep, null, 2));
}

module.exports = {
  runPS170Benchmark,
  generateBenchmarkCohort
};
