/**
 * PREDICTA — UNIT CONTRACT & BOUNDARY REGRESSION TEST SUITE
 * File: tests/test_unit_contract_boundary.js
 * 
 * Objective: Mathematically prove that identical 0h and 24h current values produce zero delta
 * across all parameters, and verify zero magnitude-based unit detection at numerical boundaries (e.g. 99, 100, 101, 110, 200).
 */

const assert = require('assert');
const inferenceService = require('../src/api/inference');

async function runUnitContractBoundaryTests() {
  console.log("=========================================================================");
  console.log("PREDICTA — UNIT CONTRACT & BOUNDARY REGRESSION TEST SUITE");
  console.log("=========================================================================\n");

  // TEST 1: Mandatory Zero-Delta Assertion for Identical 0h & 24h Telemetry
  console.log("Test 1: Testing Identical 0h & 24h Current Telemetry...");
  const baseRecord = {
    test_id: "TEST-UNIT-CONTRACT-001",
    lot_id: "LOT-2026-SAFE",
    equipment_id: "EQP-101",
    supply_voltage: 1.20,
    output_voltage: 1.18,
    current: 180.0,
    leakage_current: 110.0,
    iddq_standby: 10.2,
    resistance: 120.0,
    capacitance: 9.0,
    threshold_voltage: 0.40,
    frequency: 2200.0,
    propagation_delay: 11.0,
    setup_time: 1.5,
    hold_time: 0.5,
    timing_margin: 3.0,
    temperature: 25.0,
    dynamic_power: 45.0,
    total_power: 45.0,
    test_duration: 1.0,
    iddq_0h: 10.2,
    ileak_0h: 110.0,
    tpd_0h: 11.0
  };

  const res1 = await inferenceService.predictSingleAsync(baseRecord);
  const drift1 = res1.ml_details ? res1.ml_details.drift_prediction : inferenceService.evaluateGprDrift(baseRecord);

  const iddqDelta = drift1.iddq.value_24h - (baseRecord.iddq_0h * 200.0);
  const ileakDelta = drift1.ileak.value_24h - (baseRecord.ileak_0h * 2.7);
  const tpdDelta = drift1.tpd.value_24h - (baseRecord.tpd_0h * 17.5);

  console.log(`  IDDQ: 0h=${baseRecord.iddq_0h} µA, 24h=${baseRecord.iddq_standby} µA => Canonical Delta = ${iddqDelta}`);
  console.log(`  ILEAK: 0h=${baseRecord.ileak_0h} µA, 24h=${baseRecord.leakage_current} µA => Canonical Delta = ${ileakDelta}`);
  console.log(`  TPD: 0h=${baseRecord.tpd_0h} ns, 24h=${baseRecord.propagation_delay} ns => Canonical Delta = ${tpdDelta}`);

  assert(Math.abs(iddqDelta) < 1e-6, `IDDQ delta must be 0, got ${iddqDelta}`);
  assert(Math.abs(ileakDelta) < 1e-6, `ILEAK delta must be 0, got ${ileakDelta}`);
  assert(Math.abs(tpdDelta) < 1e-6, `TPD delta must be 0, got ${tpdDelta}`);
  console.log("✔ Test 1 Passed: Identical 0h and 24h values produce exact 0.0 canonical delta ✅\n");

  // TEST 2: Boundary Sweep across ileak_0h = [99, 100, 101, 110, 200]
  console.log("Test 2: Auditing Boundary Values across ileak_0h = [99, 100, 101, 110, 200]...");
  const testValues = [99.0, 100.0, 101.0, 110.0, 200.0];

  for (const val of testValues) {
    const boundaryRecord = {
      ...baseRecord,
      leakage_current: val,
      ileak_0h: val
    };

    const resB = await inferenceService.predictSingleAsync(boundaryRecord);
    const driftB = resB.ml_details ? resB.ml_details.drift_prediction : inferenceService.evaluateGprDrift(boundaryRecord);
    const calcDelta = driftB.ileak.value_24h - (val * 2.7);

    console.log(`  Value = ${val}: Canonical 24h = ${driftB.ileak.value_24h}, Canonical 0h = ${val * 2.7}, Delta = ${calcDelta}`);
    assert(Math.abs(calcDelta) < 1e-6, `Boundary test at ileak_0h = ${val} failed: Expected delta 0, got ${calcDelta}`);
  }

  console.log("✔ Test 2 Passed: Zero magnitude-based unit detection verified at boundary values (99, 100, 101, 110, 200) ✅\n");

  console.log("=========================================================================");
  console.log("ALL UNIT CONTRACT & BOUNDARY REGRESSION TESTS PASSED! ✅");
  console.log("=========================================================================\n");
}

runUnitContractBoundaryTests().catch(err => {
  console.error("❌ Unit Contract Boundary Test Failed:", err);
  process.exit(1);
});
