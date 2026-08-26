/**
 * Predicta Semiconductor Analytics — ATE Telemetry Simulator & Demo Mode Engine
 * File: src/simulation/ate_simulator.js
 * 
 * Simulates realistic semiconductor Automatic Test Equipment (ATE) telemetry streams,
 * chamber sensor noise, temperature drift, wafer/lot hierarchy, and SIH Demo Scenarios.
 */

const dataQualityGate = require('../ingestion/data_quality_gate');

const EQUIPMENT_SIM_PROFILES = {
  "EQP-101": { name: "ATE Station Alpha",   temp_bias: 0.0,  leak_bias: 1.0,  noise_std: 0.01 },
  "EQP-102": { name: "ATE Station Beta",    temp_bias: 1.0,  leak_bias: 1.04, noise_std: 0.02 },
  "EQP-103": { name: "ATE Station Gamma",   temp_bias: 2.5,  leak_bias: 1.08, noise_std: 0.03 }, // Chamber drift profile
  "EQP-104": { name: "ATE Station Delta",   temp_bias: -0.5, leak_bias: 0.98, noise_std: 0.01 },
  "EQP-105": { name: "ATE Station Epsilon", temp_bias: 1.2,  leak_bias: 1.03, noise_std: 0.02 }
};

const DEMO_SCENARIOS = {
  NORMAL: {
    test_id: "DEMO-ATE-NORM-001",
    equipment_id: "EQP-101",
    leakage_current: 110.0, temperature: 26.0, propagation_delay: 11.5,
    dynamic_power: 42.0, supply_voltage: 1.20, frequency: 2500.0
  },
  HIGH_LEAKAGE: {
    test_id: "DEMO-ATE-LEAK-001",
    equipment_id: "EQP-103",
    leakage_current: 198.5, temperature: 36.5, propagation_delay: 14.8,
    dynamic_power: 66.0, supply_voltage: 1.18, frequency: 2400.0
  },
  THERMAL_ANOMALY: {
    test_id: "DEMO-ATE-THERM-001",
    equipment_id: "EQP-104",
    leakage_current: 175.0, temperature: 42.0, propagation_delay: 13.9,
    dynamic_power: 71.0, supply_voltage: 1.19, frequency: 2450.0
  },
  TIMING_FAILURE: {
    test_id: "DEMO-ATE-TIME-001",
    equipment_id: "EQP-102",
    leakage_current: 125.0, temperature: 28.5, propagation_delay: 15.6,
    dynamic_power: 58.0, supply_voltage: 1.16, frequency: 2300.0
  },
  EQUIPMENT_DRIFT: {
    test_id: "DEMO-ATE-DRIFT-001",
    equipment_id: "EQP-103",
    leakage_current: 188.0, temperature: 38.0, propagation_delay: 14.2,
    dynamic_power: 64.0, supply_voltage: 1.17, frequency: 2380.0
  },
  COMBINED_DEFECT: {
    test_id: "DEMO-ATE-COMBO-001",
    equipment_id: "EQP-103",
    leakage_current: 215.0, temperature: 44.5, propagation_delay: 16.2,
    dynamic_power: 78.0, supply_voltage: 1.12, frequency: 2200.0
  },
  REVIEW_CASE: {
    test_id: "DEMO-ATE-REV-001",
    equipment_id: "EQP-102",
    leakage_current: 162.0, temperature: 31.5, propagation_delay: 13.4,
    dynamic_power: 56.0, supply_voltage: 1.18, frequency: 2420.0
  }
};

class ATESimulatorService {
  getDemoScenario(scenarioKey = "NORMAL") {
    const sc = DEMO_SCENARIOS[scenarioKey.toUpperCase()] || DEMO_SCENARIOS.NORMAL;
    const profile = EQUIPMENT_SIM_PROFILES[sc.equipment_id] || EQUIPMENT_SIM_PROFILES["EQP-101"];

    const lotId = `LOT-2026-${Math.floor(100 + Math.random() * 900)}`;
    const waferId = `WAFER-${Math.floor(1 + Math.random() * 25).toString().padStart(2, '0')}`;
    const dieId = `DIE-${Math.floor(1 + Math.random() * 50)}-${Math.floor(1 + Math.random() * 50)}`;

    const payload = {
      test_id: `${sc.test_id}-${Math.floor(100 + Math.random() * 900)}`,
      equipment_id: sc.equipment_id,
      lot_id: lotId,
      wafer_id: waferId,
      die_id: dieId,
      timestamp: new Date().toISOString(),
      source: "ATE_SIMULATOR",
      supply_voltage: sc.supply_voltage,
      output_voltage: Number((sc.supply_voltage - 0.02).toFixed(3)),
      current: 44.5,
      leakage_current: Number((sc.leakage_current * profile.leak_bias).toFixed(2)),
      resistance: 12.5,
      capacitance: 4.2,
      threshold_voltage: 0.42,
      frequency: sc.frequency,
      propagation_delay: sc.propagation_delay,
      setup_time: 1.20,
      hold_time: 0.80,
      timing_margin: Number((16.0 * (2500.0 / sc.frequency) - sc.propagation_delay - 1.20).toFixed(2)),
      temperature: Number((sc.temperature + profile.temp_bias).toFixed(2)),
      dynamic_power: sc.dynamic_power,
      total_power: Number((sc.dynamic_power + 7.5).toFixed(2)),
      test_duration: 12.0
    };

    const qualityResult = dataQualityGate.validateTelemetry(payload);
    payload.data_quality = qualityResult;
    return payload;
  }

  getEquipmentStatuses() {
    return Object.keys(EQUIPMENT_SIM_PROFILES).map(eqId => ({
      equipment_id: eqId,
      name: EQUIPMENT_SIM_PROFILES[eqId].name,
      connection_status: "SIMULATED_ONLINE",
      telemetry_quality: eqId === "EQP-103" ? "DEGRADED" : "GOOD",
      temp_bias: EQUIPMENT_SIM_PROFILES[eqId].temp_bias,
      leak_bias: EQUIPMENT_SIM_PROFILES[eqId].leak_bias,
      last_telemetry_timestamp: new Date().toISOString()
    }));
  }
}

module.exports = new ATESimulatorService();
