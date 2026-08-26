/**
 * Predicta Day 21 — Research Data Generator V2 (Node.js Engine)
 * File: ml/research/day21/generate_v2.js
 * 
 * RESEARCH ONLY — DO NOT REPLACE PRODUCTION DATASET GENERATOR
 */

const fs = require('fs');
const path = require('path');

console.log("=========================================================================");
console.log("PREDICTA DAY 21 — GENERATING RESEARCH DATASET V2 (50,000 RECORDS)");
console.log("=========================================================================\n");

const EQUIPMENT_OFFSETS = {
  "EQP-101": { leakage_bias: 0.0, temp_bias: 0.0, delay_bias: 0.0 },
  "EQP-102": { leakage_bias: 3.5, temp_bias: 0.8, delay_bias: 0.15 },
  "EQP-103": { leakage_bias: 8.0, temp_bias: 2.5, delay_bias: 0.35 }, // Drifting chamber
  "EQP-104": { leakage_bias: -2.0, temp_bias: -0.5, delay_bias: -0.10 },
  "EQP-105": { leakage_bias: 4.0, temp_bias: 1.2, delay_bias: 0.20 }
};

const EQUIPMENT_IDS = ["EQP-101", "EQP-102", "EQP-103", "EQP-104", "EQP-105"];
const DEFECT_TYPES = ["HIGH_LEAKAGE", "LOW_VOLTAGE", "TIMING_FAILURE", "THERMAL_ANOMALY", "POWER_ANOMALY", "PROCESS_VARIATION", "EQUIPMENT_DRIFT"];

function gauss(mean, stdDev, minVal = null) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  let val = mean + stdDev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  if (minVal !== null && val < minVal) val = minVal;
  return val;
}

const numSamples = 50000;
const numNormal = Math.round(numSamples * 0.70); // 70% Normal, 30% Defect
const numDefects = numSamples - numNormal;

const assignments = Array(numNormal).fill("NORMAL");
for (let i = 0; i < numDefects; i++) {
  assignments.push(DEFECT_TYPES[i % DEFECT_TYPES.length]);
}

// Shuffle assignments
for (let i = assignments.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [assignments[i], assignments[j]] = [assignments[j], assignments[i]];
}

const records = [];

for (let i = 0; i < numSamples; i++) {
  const defect_type = assignments[i];
  const test_id = `RS-TST-${(i + 1).toString().padStart(6, '0')}`;
  const wafer_num = (i % 100) + 1;
  const wafer_id = `WFR-V2-${wafer_num.toString().padStart(3, '0')}`;
  const equipment_id = EQUIPMENT_IDS[Math.floor(Math.random() * EQUIPMENT_IDS.length)];
  const eq_bias = EQUIPMENT_OFFSETS[equipment_id];

  const severity = defect_type !== "NORMAL" ? 0.05 + Math.random() * 0.90 : 0.0;

  let supply_voltage = gauss(1.20, 0.015, 0.8);
  let threshold_voltage = gauss(0.45, 0.012, 0.2);
  let overdrive = Math.max(0.1, supply_voltage - threshold_voltage);
  let output_voltage = Math.max(0.1, supply_voltage - gauss(0.02, 0.005, 0.001));

  let base_freq = 2500.0 * Math.pow(overdrive / 0.75, 1.2);
  let frequency = gauss(base_freq, 35.0, 500.0);

  let base_delay = 12.50 * Math.pow(0.75 / overdrive, 1.1);
  let propagation_delay = gauss(base_delay, 0.30, 3.0) + eq_bias.delay_bias;
  let setup_time = gauss(0.85, 0.03, 0.1);
  let hold_time = gauss(0.42, 0.015, 0.05);

  let resistance = gauss(12.50, 0.40, 1.0);
  let capacitance = gauss(4.20, 0.12, 0.5);

  let temperature = 25.0 + gauss(2.5, 0.8, 0.0) + eq_bias.temp_bias;
  let thermal_leakage_factor = Math.exp((temperature - 25.0) / 35.0);
  let leakage_current = (gauss(115.0, 12.0, 10.0) + eq_bias.leakage_bias) * thermal_leakage_factor;

  let current = gauss(44.0, 1.5, 10.0) * (supply_voltage / 1.20);
  let dynamic_power = gauss(52.0, 2.5, 5.0) * Math.pow(supply_voltage / 1.20, 2);
  let test_duration = gauss(150.0, 4.0, 10.0);

  // Apply multi-measurement physical mutations
  if (defect_type === "HIGH_LEAKAGE") {
    leakage_current *= 1.0 + (severity * (0.35 + Math.random() * 0.75));
    current *= 1.0 + (severity * 0.10);
    temperature += severity * (4.0 + Math.random() * 8.0);
  } else if (defect_type === "LOW_VOLTAGE") {
    let drop = 1.0 - (severity * (0.06 + Math.random() * 0.09));
    supply_voltage *= drop;
    output_voltage *= drop;
    propagation_delay *= 1.0 + (severity * 0.12);
  } else if (defect_type === "TIMING_FAILURE") {
    propagation_delay *= 1.0 + (severity * (0.15 + Math.random() * 0.30));
    setup_time *= 1.0 + (severity * 0.20);
    frequency *= 1.0 - (severity * 0.08);
  } else if (defect_type === "THERMAL_ANOMALY") {
    temperature += severity * (8.0 + Math.random() * 20.0);
    leakage_current *= Math.exp((temperature - 25.0) / 45.0) * 0.4;
  } else if (defect_type === "POWER_ANOMALY") {
    dynamic_power *= 1.0 + (severity * (0.20 + Math.random() * 0.40));
    current *= 1.0 + (severity * 0.15);
  } else if (defect_type === "PROCESS_VARIATION") {
    threshold_voltage *= 1.0 + (severity * 0.15);
    resistance *= 1.0 + (severity * 0.14);
    propagation_delay *= 1.0 + (severity * 0.14);
  } else if (defect_type === "EQUIPMENT_DRIFT") {
    if (equipment_id === "EQP-103") {
      leakage_current *= 1.0 + (severity * 0.40);
      temperature += severity * 6.0;
      resistance *= 1.0 + (severity * 0.18);
    } else {
      resistance *= 1.0 + (severity * 0.10);
    }
  }

  const path_budget = Number((16.0 * (2500.0 / frequency)).toFixed(4));
  const timing_margin = Number((path_budget - (propagation_delay + setup_time)).toFixed(4));
  const static_power = Number((supply_voltage * leakage_current * 0.001).toFixed(5));
  const total_power = Number((dynamic_power + static_power + gauss(0.0, 0.05)).toFixed(5));
  const thermal_delta = Number((temperature - 25.0).toFixed(2));

  // Latent Specification Violation Target Label Assignment
  const is_fail = (
    propagation_delay > 14.0 ||
    leakage_current > 175.0 ||
    supply_voltage < 1.10 ||
    temperature > 38.0 ||
    timing_margin < 0.20
  ) ? 1 : 0;

  const result = is_fail ? "FAIL" : "PASS";

  records.push({
    test_id, wafer_id, equipment_id,
    supply_voltage: Number(supply_voltage.toFixed(4)),
    output_voltage: Number(output_voltage.toFixed(4)),
    current: Number(current.toFixed(4)),
    leakage_current: Number(leakage_current.toFixed(4)),
    resistance: Number(resistance.toFixed(4)),
    capacitance: Number(capacitance.toFixed(4)),
    threshold_voltage: Number(threshold_voltage.toFixed(4)),
    frequency: Number(frequency.toFixed(2)),
    propagation_delay: Number(propagation_delay.toFixed(4)),
    setup_time: Number(setup_time.toFixed(4)),
    hold_time: Number(hold_time.toFixed(4)),
    timing_margin,
    temperature: Number(temperature.toFixed(2)),
    thermal_delta,
    dynamic_power: Number(dynamic_power.toFixed(4)),
    static_power, total_power,
    test_duration: Number(test_duration.toFixed(2)),
    result, defect_type,
    severity: Number(severity.toFixed(4))
  });
}

// Convert to CSV
const headers = Object.keys(records[0]).join(',');
const trainLines = [headers];
const valLines = [headers];

records.forEach(r => {
  const line = Object.values(r).join(',');
  const waferNum = parseInt(r.wafer_id.split('-')[2], 10);
  if (waferNum <= 70) trainLines.push(line);
  else valLines.push(line);
});

const outDir = path.join(__dirname, 'data');
fs.mkdirSync(outDir, { recursive: true });

const trainPath = path.join(outDir, 'train_v2.csv');
const valPath = path.join(outDir, 'validation_v2.csv');

fs.writeFileSync(trainPath, trainLines.join('\n'));
fs.writeFileSync(valPath, valLines.join('\n'));

console.log(`✔ Research Datasets V2 written successfully!`);
console.log(`   • Train V2: ${trainLines.length - 1} rows ➔ ${trainPath}`);
console.log(`   • Val V2:   ${valLines.length - 1} rows ➔ ${valPath}`);
