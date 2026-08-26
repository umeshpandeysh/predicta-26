/**
 * Predicta Day 22 — Research Data Generator V3 (Independent Cross-Generator Benchmark)
 * File: ml/research/day22/generate_v3.js
 * 
 * RESEARCH ONLY — DO NOT REPLACE PRODUCTION GENERATOR
 */

const fs = require('fs');
const path = require('path');

console.log("=========================================================================");
console.log("PREDICTA DAY 22 — GENERATING INDEPENDENT RESEARCH DATASET V3 (15,000 RECORDS)");
console.log("=========================================================================\n");

const EQUIPMENT_PROFILES = {
  "EQP-101": { leak_gain: 1.0, temp_shift: 0.0, delay_gain: 1.0 },
  "EQP-102": { leak_gain: 1.04, temp_shift: 1.0, delay_gain: 1.01 },
  "EQP-103": { leak_gain: 1.08, temp_shift: 2.2, delay_gain: 1.03 }, // Chamber drift
  "EQP-104": { leak_gain: 0.97, temp_shift: -0.8, delay_gain: 0.99 },
  "EQP-105": { leak_gain: 1.03, temp_shift: 1.1, delay_gain: 1.02 }
};

const EQUIPMENT_IDS = ["EQP-101", "EQP-102", "EQP-103", "EQP-104", "EQP-105"];
const DEFECT_CLASSES = [
  "NORMAL", "HIGH_LEAKAGE", "LOW_VOLTAGE", "TIMING_FAILURE",
  "THERMAL_ANOMALY", "POWER_ANOMALY", "PROCESS_VARIATION", "EQUIPMENT_DRIFT",
  "LEAKAGE_THERMAL_COMBO", "VOLTAGE_TIMING_COMBO"
];

function gauss(mean, stdDev, minVal = null) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  let val = mean + stdDev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  if (minVal !== null && val < minVal) val = minVal;
  return val;
}

const numSamples = 15000;
const records = [];

for (let i = 0; i < numSamples; i++) {
  const defect_type = DEFECT_CLASSES[i % DEFECT_CLASSES.length];
  const test_id = `V3-TST-${(i + 1).toString().padStart(6, '0')}`;
  const wafer_num = (i % 30) + 71;
  const wafer_id = `WFR-V3-${wafer_num.toString().padStart(3, '0')}`;
  const equipment_id = EQUIPMENT_IDS[Math.floor(Math.random() * EQUIPMENT_IDS.length)];
  const profile = EQUIPMENT_PROFILES[equipment_id];

  const severity = defect_type !== "NORMAL" ? 0.10 + Math.random() * 0.85 : 0.0;

  // Latent process corner variation (Wafer-level shift)
  const wafer_vth_shift = (wafer_num % 5 - 2) * 0.005;

  let supply_voltage = gauss(1.20, 0.018, 0.85);
  let threshold_voltage = gauss(0.45 + wafer_vth_shift, 0.014, 0.22);
  let overdrive = Math.max(0.1, supply_voltage - threshold_voltage);
  let output_voltage = Math.max(0.1, supply_voltage - gauss(0.022, 0.006, 0.001));

  let frequency = gauss(2500.0 * Math.pow(overdrive / 0.75, 1.15), 40.0, 500.0);
  let propagation_delay = (gauss(12.50 * Math.pow(0.75 / overdrive, 1.05), 0.35, 3.0) + Math.random() * 0.2) * profile.delay_gain;
  let setup_time = gauss(0.85, 0.035, 0.1);
  let hold_time = gauss(0.42, 0.018, 0.05);

  let resistance = gauss(12.50, 0.45, 1.0);
  let capacitance = gauss(4.20, 0.15, 0.5);

  let temperature = 25.0 + gauss(2.8, 0.9, 0.0) + profile.temp_shift;
  let leakage_current = gauss(118.0, 14.0, 10.0) * Math.exp((temperature - 25.0) / 36.0) * profile.leak_gain;

  let current = gauss(44.5, 1.8, 10.0) * (supply_voltage / 1.20);
  let dynamic_power = gauss(53.0, 2.8, 5.0) * Math.pow(supply_voltage / 1.20, 2);
  let test_duration = gauss(150.0, 5.0, 10.0);

  // Apply multi-measurement defect mutations (Independent V3 physics)
  if (defect_type === "HIGH_LEAKAGE") {
    leakage_current *= 1.0 + (severity * 0.80);
    temperature += severity * 6.0;
  } else if (defect_type === "LOW_VOLTAGE") {
    supply_voltage *= 1.0 - (severity * 0.12);
    propagation_delay *= 1.0 + (severity * 0.10);
  } else if (defect_type === "TIMING_FAILURE") {
    propagation_delay *= 1.0 + (severity * 0.35);
    setup_time *= 1.0 + (severity * 0.18);
  } else if (defect_type === "THERMAL_ANOMALY") {
    temperature += severity * 22.0;
    leakage_current *= 1.0 + (severity * 0.30);
  } else if (defect_type === "POWER_ANOMALY") {
    dynamic_power *= 1.0 + (severity * 0.45);
    current *= 1.0 + (severity * 0.12);
  } else if (defect_type === "PROCESS_VARIATION") {
    threshold_voltage *= 1.0 + (severity * 0.14);
    resistance *= 1.0 + (severity * 0.12);
  } else if (defect_type === "EQUIPMENT_DRIFT") {
    if (equipment_id === "EQP-103") {
      leakage_current *= 1.0 + (severity * 0.35);
      temperature += severity * 5.0;
    }
  } else if (defect_type === "LEAKAGE_THERMAL_COMBO") {
    leakage_current *= 1.0 + (severity * 0.60);
    temperature += severity * 15.0;
  } else if (defect_type === "VOLTAGE_TIMING_COMBO") {
    supply_voltage *= 1.0 - (severity * 0.10);
    propagation_delay *= 1.0 + (severity * 0.25);
  }

  const path_budget = Number((16.0 * (2500.0 / frequency)).toFixed(4));
  const timing_margin = Number((path_budget - (propagation_delay + setup_time)).toFixed(4));
  const static_power = Number((supply_voltage * leakage_current * 0.001).toFixed(5));
  const total_power = Number((dynamic_power + static_power + gauss(0.0, 0.06)).toFixed(5));
  const thermal_delta = Number((temperature - 25.0).toFixed(2));

  // Independent V3 Target Label Specification Violation
  const is_fail = (
    propagation_delay > 13.8 ||
    leakage_current > 170.0 ||
    supply_voltage < 1.11 ||
    temperature > 37.5 ||
    timing_margin < 0.25
  ) ? 1 : 0;

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
    result: is_fail ? "FAIL" : "PASS",
    defect_type,
    severity: Number(severity.toFixed(4))
  });
}

const headers = Object.keys(records[0]).join(',');
const valLines = [headers];
records.forEach(r => valLines.push(Object.values(r).join(',')));

const outPath = path.join(__dirname, 'data', 'validation_v3.csv');
fs.writeFileSync(outPath, valLines.join('\n'));

console.log(`✔ Independent Research Dataset V3 generated successfully! (${records.length} records ➔ ${outPath})\n`);
