/**
 * Predicta Day 24 — Equipment Simulation Test Suite
 * File: tests/test_equipment_simulation.js
 */

const assert = require('assert');
const ateSim = require('../src/simulation/ate_simulator');

console.log("=========================================================================");
console.log("PREDICTA DAY 24 — EQUIPMENT SIMULATION TEST SUITE");
console.log("=========================================================================\n");

const eqStatuses = ateSim.getEquipmentStatuses();
assert.strictEqual(eqStatuses.length, 5, "Expected 5 simulated equipment profiles");

eqStatuses.forEach(eq => {
  assert.ok(eq.equipment_id.startsWith("EQP-10"), "Invalid equipment ID");
  assert.strictEqual(eq.connection_status, "SIMULATED_ONLINE");
});

console.log("✔ Test 01 Passed: Simulated 5 ATE equipment chambers (EQP-101 .. EQP-105)");

const eq103 = eqStatuses.find(e => e.equipment_id === "EQP-103");
assert.strictEqual(eq103.telemetry_quality, "DEGRADED", "EQP-103 should exhibit chamber drift degradation");
console.log("✔ Test 02 Passed: Equipment EQP-103 chamber drift degradation telemetry status verified");

console.log("\n=========================================================================");
console.log("ALL DAY 24 EQUIPMENT SIMULATION TESTS PASSED! ✅");
console.log("=========================================================================\n");
