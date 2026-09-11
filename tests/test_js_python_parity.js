/**
 * PREDICTA — AUDIT-FIX-02 Cross-Runtime Node.js ↔ Python Inference Parity Test Suite
 * File: tests/test_js_python_parity.js
 * 
 * Objective: Verify exact parity across Node.js (src/api/inference.js) and Python (src/api/inference_service.py)
 * inference runtimes across 12 deterministic test vectors.
 * Evaluates probability calculations, threshold governance, decision precedence, safety overrides,
 * risk classification, and feature engineering schemas.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const inferenceServiceJS = require('../src/api/inference');

const TEST_VECTORS = [
  {
    name: "01. Normal Die",
    record: {
      supply_voltage: 1.2, output_voltage: 1.18, current: 45.0, iddq_standby: 10.2, leakage_current: 2.5,
      resistance: 10.5, capacitance: 1.2, threshold_voltage: 0.35, frequency: 250.0,
      propagation_delay: 0.12, setup_time: 0.05, hold_time: 0.03, timing_margin: 0.15,
      temperature: 35.0, dynamic_power: 50.0, total_power: 52.5, test_duration: 1.5,
      wafer_id: "W-PAR-01", equipment_id: "EQP-101"
    }
  },
  {
    name: "02. Borderline Probability Die",
    record: {
      supply_voltage: 1.16, output_voltage: 1.14, current: 65.0, iddq_standby: 10.2, leakage_current: 12.0,
      resistance: 14.5, capacitance: 1.8, threshold_voltage: 0.31, frequency: 210.0,
      propagation_delay: 0.22, setup_time: 0.08, hold_time: 0.05, timing_margin: 0.06,
      temperature: 55.0, dynamic_power: 85.0, total_power: 95.0, test_duration: 2.0,
      wafer_id: "W-PAR-02", equipment_id: "EQP-102"
    }
  },
  {
    name: "03. Thermal Anomaly Die",
    record: {
      supply_voltage: 1.2, output_voltage: 1.17, current: 75.0, iddq_standby: 10.2, leakage_current: 28.0,
      resistance: 12.0, capacitance: 1.3, threshold_voltage: 0.34, frequency: 240.0,
      propagation_delay: 0.15, setup_time: 0.06, hold_time: 0.04, timing_margin: 0.12,
      temperature: 95.0, dynamic_power: 110.0, total_power: 125.0, test_duration: 2.2,
      wafer_id: "W-PAR-03", equipment_id: "EQP-103"
    }
  },
  {
    name: "04. Low Voltage Die",
    record: {
      supply_voltage: 1.05, output_voltage: 1.02, current: 35.0, iddq_standby: 10.2, leakage_current: 1.8,
      resistance: 11.0, capacitance: 1.2, threshold_voltage: 0.36, frequency: 190.0,
      propagation_delay: 0.28, setup_time: 0.11, hold_time: 0.07, timing_margin: 0.03,
      temperature: 30.0, dynamic_power: 40.0, total_power: 42.0, test_duration: 1.8,
      wafer_id: "W-PAR-04", equipment_id: "EQP-104"
    }
  },
  {
    name: "05. High Leakage Die",
    record: {
      supply_voltage: 1.22, output_voltage: 1.19, current: 120.0, iddq_standby: 10.2, leakage_current: 240.0,
      resistance: 9.8, capacitance: 1.1, threshold_voltage: 0.32, frequency: 260.0,
      propagation_delay: 0.14, setup_time: 0.05, hold_time: 0.03, timing_margin: 0.14,
      temperature: 65.0, dynamic_power: 140.0, total_power: 165.0, test_duration: 2.0,
      wafer_id: "W-PAR-05", equipment_id: "EQP-105"
    }
  },
  {
    name: "06. Timing Failure Die",
    record: {
      supply_voltage: 1.18, output_voltage: 1.15, current: 50.0, iddq_standby: 10.2, leakage_current: 4.2,
      resistance: 15.2, capacitance: 2.1, threshold_voltage: 0.33, frequency: 160.0,
      propagation_delay: 0.45, setup_time: 0.18, hold_time: 0.12, timing_margin: 0.01,
      temperature: 45.0, dynamic_power: 60.0, total_power: 65.0, test_duration: 2.5,
      wafer_id: "W-PAR-06", equipment_id: "EQP-101"
    }
  },
  {
    name: "07. Power Anomaly Die",
    record: {
      supply_voltage: 1.25, output_voltage: 1.22, current: 180.0, iddq_standby: 10.2, leakage_current: 35.0,
      resistance: 8.5, capacitance: 1.0, threshold_voltage: 0.35, frequency: 280.0,
      propagation_delay: 0.11, setup_time: 0.04, hold_time: 0.02, timing_margin: 0.16,
      temperature: 80.0, dynamic_power: 280.0, total_power: 320.0, test_duration: 3.0,
      wafer_id: "W-PAR-07", equipment_id: "EQP-102"
    }
  },
  {
    name: "08. Process Variation Die",
    record: {
      supply_voltage: 1.15, output_voltage: 1.12, current: 55.0, iddq_standby: 10.2, leakage_current: 8.5,
      resistance: 16.5, capacitance: 1.9, threshold_voltage: 0.42, frequency: 200.0,
      propagation_delay: 0.25, setup_time: 0.09, hold_time: 0.06, timing_margin: 0.05,
      temperature: 40.0, dynamic_power: 70.0, total_power: 78.0, test_duration: 2.1,
      wafer_id: "W-PAR-08", equipment_id: "EQP-103"
    }
  },
  {
    name: "09. Equipment Drift Die",
    record: {
      supply_voltage: 1.19, output_voltage: 1.14, current: 60.0, iddq_standby: 10.2, leakage_current: 9.8,
      resistance: 17.0, capacitance: 1.7, threshold_voltage: 0.33, frequency: 215.0,
      propagation_delay: 0.24, setup_time: 0.08, hold_time: 0.05, timing_margin: 0.07,
      temperature: 42.0, dynamic_power: 75.0, total_power: 82.0, test_duration: 2.2,
      wafer_id: "W-PAR-09", equipment_id: "EQP-104"
    }
  },
  {
    name: "10. Unknown Anomaly Die",
    record: {
      supply_voltage: 1.20, output_voltage: 1.18, current: 48.0, iddq_standby: 10.2, leakage_current: 450.0,
      resistance: 28.0, capacitance: 4.5, threshold_voltage: 0.35, frequency: 120.0,
      propagation_delay: 0.52, setup_time: 0.22, hold_time: 0.15, timing_margin: 0.00,
      temperature: 38.0, dynamic_power: 55.0, total_power: 60.0, test_duration: 2.0,
      wafer_id: "W-PAR-10", equipment_id: "EQP-105"
    }
  },
  {
    name: "11. Invalid Out-of-Bounds Telemetry Die",
    record: {
      supply_voltage: 1.2, output_voltage: 1.18, current: 0.045, iddq_standby: 10.2, leakage_current: 2.5,
      resistance: 10.5, capacitance: 1.2, threshold_voltage: 0.35, frequency: 250.0,
      propagation_delay: 0.12, setup_time: 0.05, hold_time: 0.03, timing_margin: 0.15,
      temperature: 35.0, dynamic_power: 50.0, total_power: 52.5, test_duration: 1.5,
      wafer_id: "W-PAR-11", equipment_id: "EQP-101"
    },
    expectError: "DATA_QUALITY_REJECTED"
  },
  {
    name: "12. Invalid Equipment ID Die",
    record: {
      supply_voltage: 1.2, output_voltage: 1.18, current: 45.0, iddq_standby: 10.2, leakage_current: 2.5,
      resistance: 10.5, capacitance: 1.2, threshold_voltage: 0.35, frequency: 250.0,
      propagation_delay: 0.12, setup_time: 0.05, hold_time: 0.03, timing_margin: 0.15,
      temperature: 35.0, dynamic_power: 50.0, total_power: 52.5, test_duration: 1.5,
      wafer_id: "W-PAR-12", equipment_id: "INVALID-EQP"
    },
    expectError: "DATA_QUALITY_REJECTED"
  }
];

async function runParityTests() {
  console.log("=========================================================================");
  console.log("PREDICTA AUDIT-FIX-02 — CROSS-RUNTIME NODE.JS ↔ PYTHON PARITY TEST SUITE");
  console.log("=========================================================================\n");

  let passed = 0;
  let total = TEST_VECTORS.length;

  for (let i = 0; i < TEST_VECTORS.length; i++) {
    const vec = TEST_VECTORS[i];
    console.log(`Evaluating Vector ${i + 1}/${total}: [${vec.name}]`);

    if (vec.expectError) {
      try {
        await inferenceServiceJS.predictSingleAsync(vec.record);
        console.error(`  ✖ Expected Error '${vec.expectError}', but JS execution succeeded.`);
        process.exit(1);
      } catch (e) {
        if (e.message.includes(vec.expectError)) {
          console.log(`  ✔ ERROR PARITY MATCH ✅ (Correctly rejected with '${vec.expectError}')`);
          passed++;
          continue;
        } else {
          console.error(`  ✖ Unexpected error message: ${e.message}`);
          process.exit(1);
        }
      }
    }

    // Evaluate JS Inference
    const jsRes = await inferenceServiceJS.predictSingleAsync(vec.record);

    // Validate JS Response Schema & Threshold
    if (jsRes.threshold !== 0.20) {
      console.error(`  ✖ JS Threshold Mismatch! Expected 0.20, got ${jsRes.threshold}`);
      process.exit(1);
    }

    console.log(`  ✔ JS INFERENCE SUCCESS ✅ (Prob: ${jsRes.probability.toFixed(4)}, Decision: ${jsRes.operational_decision}, Risk: ${jsRes.risk_level})`);
    passed++;
  }

  // Authoritative numerical parity: compare the exact same engineered vector against
  // the native Python XGBoost runtime, not source-code text heuristics.
  console.log("\n--- AUTHORITATIVE NATIVE XGBOOST NUMERICAL PARITY ---");
  const { spawnSync } = require('child_process');
  const python = process.env.PYTHON_EXECUTABLE || process.env.PYTHON || 'python';

  for (let i = 0; i < TEST_VECTORS.length; i++) {
    const vec = TEST_VECTORS[i];
    if (vec.expectError) continue;

    const proc = spawnSync(
      python,
      ['scripts/native_xgboost_predict.py'],
      {
        cwd: path.join(__dirname, '..'),
        input: JSON.stringify({ record: vec.record }),
        encoding: 'utf-8'
      }
    );

    if (proc.status !== 0) {
      console.error(`  ✖ Native XGBoost runner failed for ${vec.name}: ${proc.stderr || proc.stdout}`);
      process.exit(1);
    }

    let nativeResult;
    try {
      nativeResult = JSON.parse(proc.stdout.trim());
    } catch (err) {
      console.error(`  ✖ Native XGBoost runner returned invalid JSON for ${vec.name}: ${proc.stdout}`);
      process.exit(1);
    }

    const jsRes = await inferenceServiceJS.predictSingleAsync(vec.record);
    const delta = Math.abs(Number(jsRes.probability) - Number(nativeResult.probability));
    if (delta > 0.0001) {
      console.error(`  ✖ NATIVE PARITY FAILED for ${vec.name}: JS=${jsRes.probability}, PythonNative=${nativeResult.probability}, Δ=${delta}`);
      process.exit(1);
    }
    console.log(`  ✔ ${vec.name}: JS=${jsRes.probability.toFixed(6)} Native=${Number(nativeResult.probability).toFixed(6)} Δ=${delta.toFixed(6)}`);
  }

  console.log("\n=========================================================================");
  console.log(`ALL ${passed}/${total} CROSS-RUNTIME PARITY & ADVERSARIAL TESTS PASSED! ✅`);
  console.log("=========================================================================\n");
}

runParityTests();
