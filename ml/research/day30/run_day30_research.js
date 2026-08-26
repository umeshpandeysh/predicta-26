/**
 * Predicta Day 30 — Scientific ML Validation & Research Candidate Suite
 * File: ml/research/day30/run_day30_research.js
 */

const fs = require('fs');
const path = require('path');
const inf = require('../../../src/api/inference');
const ateSim = require('../../../src/simulation/ate_simulator');

console.log("=========================================================================");
console.log("PREDICTA DAY 30 — SCIENTIFIC ML VALIDATION & RESEARCH SUITE");
console.log("=========================================================================\n");

// 1. 20 Immutable Golden Telemetry Cases (10 PASS, 10 FAIL)
const goldenCases = [
  // 10 PASS Cases
  { id: "GOLDEN-PASS-001", name: "Nominal Baseline PASS", leakage_current: 110.0, temperature: 25.0, propagation_delay: 11.2, expected: "PASS" },
  { id: "GOLDEN-PASS-002", name: "Low Voltage PASS", leakage_current: 105.0, temperature: 24.5, propagation_delay: 11.5, expected: "PASS" },
  { id: "GOLDEN-PASS-003", name: "Cool Temperature PASS", leakage_current: 98.0, temperature: 20.0, propagation_delay: 11.0, expected: "PASS" },
  { id: "GOLDEN-PASS-004", name: "High Margin PASS", leakage_current: 112.0, temperature: 26.5, propagation_delay: 11.4, expected: "PASS" },
  { id: "GOLDEN-PASS-005", name: "Fast Frequency PASS", leakage_current: 115.0, temperature: 27.0, propagation_delay: 10.8, expected: "PASS" },
  { id: "GOLDEN-PASS-006", name: "Low Resistance PASS", leakage_current: 108.0, temperature: 25.5, propagation_delay: 11.3, expected: "PASS" },
  { id: "GOLDEN-PASS-007", name: "Low Capacitance PASS", leakage_current: 102.0, temperature: 23.0, propagation_delay: 11.1, expected: "PASS" },
  { id: "GOLDEN-PASS-008", name: "Station Epsilon PASS", leakage_current: 114.0, temperature: 26.8, propagation_delay: 11.6, expected: "PASS" },
  { id: "GOLDEN-PASS-009", name: "Station Delta PASS", leakage_current: 106.0, temperature: 24.0, propagation_delay: 11.2, expected: "PASS" },
  { id: "GOLDEN-PASS-010", name: "Short Duration PASS", leakage_current: 110.0, temperature: 25.0, propagation_delay: 11.4, expected: "PASS" },

  // 10 FAIL Cases
  { id: "GOLDEN-FAIL-001", name: "High Leakage FAIL", leakage_current: 240.0, temperature: 36.0, propagation_delay: 14.5, expected: "FAIL" },
  { id: "GOLDEN-FAIL-002", name: "Thermal Spike FAIL", leakage_current: 185.0, temperature: 48.0, propagation_delay: 14.0, expected: "FAIL" },
  { id: "GOLDEN-FAIL-003", name: "Timing Violation FAIL", leakage_current: 130.0, temperature: 28.0, propagation_delay: 16.5, expected: "FAIL" },
  { id: "GOLDEN-FAIL-004", name: "Chamber Drift FAIL", leakage_current: 210.0, temperature: 40.0, propagation_delay: 15.0, expected: "FAIL" },
  { id: "GOLDEN-FAIL-005", name: "Combined Defect FAIL", leakage_current: 250.0, temperature: 52.0, propagation_delay: 17.0, expected: "FAIL" },
  { id: "GOLDEN-FAIL-006", name: "Extreme Power FAIL", leakage_current: 195.0, temperature: 44.0, propagation_delay: 14.8, expected: "FAIL" },
  { id: "GOLDEN-FAIL-007", name: "Voltage Drop FAIL", leakage_current: 220.0, temperature: 38.0, propagation_delay: 15.5, expected: "FAIL" },
  { id: "GOLDEN-FAIL-008", name: "Setup Time Violation FAIL", leakage_current: 175.0, temperature: 35.0, propagation_delay: 16.2, expected: "FAIL" },
  { id: "GOLDEN-FAIL-009", name: "Hold Time Degradation FAIL", leakage_current: 190.0, temperature: 37.0, propagation_delay: 15.8, expected: "FAIL" },
  { id: "GOLDEN-FAIL-010", name: "Station Gamma Drift FAIL", leakage_current: 230.0, temperature: 45.0, propagation_delay: 16.0, expected: "FAIL" }
];

console.log(`Evaluating ${goldenCases.length} Golden Telemetry Records...`);

const results = goldenCases.map(tc => {
  const payload = {
    test_id: tc.id, equipment_id: "EQP-101",
    supply_voltage: 1.20, output_voltage: 1.18, current: 44.0, leakage_current: tc.leakage_current,
    resistance: 12.5, capacitance: 4.2, threshold_voltage: 0.42, frequency: 2400.0,
    propagation_delay: tc.propagation_delay, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.0,
    temperature: tc.temperature, dynamic_power: 60.0, total_power: 70.0, test_duration: 12.0
  };
  const res = inf.predictSingle(payload);
  return { id: tc.id, name: tc.name, expected: tc.expected, predicted: res.prediction, probability: res.probability, decision: res.operational_decision };
});

console.table(results);

// Save research output artifacts
const outDir = path.join(__dirname, 'results');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, 'golden_records_eval.json'), JSON.stringify(results, null, 2));

console.log("\n=========================================================================");
console.log("DAY 30 SCIENTIFIC RESEARCH AUDIT EVALUATION COMPLETE! ✅");
console.log("=========================================================================\n");
