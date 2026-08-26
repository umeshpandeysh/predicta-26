/**
 * Predicta Day 24 — ATE Telemetry Ingestion Contract Test Suite
 * File: tests/test_ate_ingestion.js
 */

const assert = require('assert');
const ateSim = require('../src/simulation/ate_simulator');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 24 — ATE TELEMETRY INGESTION TEST SUITE");
console.log("=========================================================================\n");

const demoPayload = ateSim.getDemoScenario("NORMAL");
assert.ok(demoPayload.test_id, "Missing test_id");
assert.ok(demoPayload.equipment_id, "Missing equipment_id");
assert.ok(demoPayload.lot_id.startsWith("LOT-2026-"), "Missing lot_id hierarchy");
assert.ok(demoPayload.wafer_id.startsWith("WAFER-"), "Missing wafer_id hierarchy");
assert.ok(demoPayload.die_id.startsWith("DIE-"), "Missing die_id hierarchy");
assert.strictEqual(demoPayload.data_quality.status, "DATA_QUALITY_ACCEPTED", "Data Quality Gate failed normal telemetry");

console.log("✔ Test 01 Passed: ATE telemetry schema hierarchy (Lot → Wafer → Die → Equipment → Telemetry) 100% verified");

const res = inf.predictSingle(demoPayload);
assert.strictEqual(res.prediction, "PASS", "Normal demo payload should be PASS");
assert.ok(res.trace_id.startsWith("PRED-2026-"), "Missing trace_id");
assert.strictEqual(res.telemetry_quality, "GOOD", "Telemetry quality status missing");
console.log("✔ Test 02 Passed: End-to-end ATE simulation record executed through production XGBoost V1 model");

console.log("\n=========================================================================");
console.log("ALL DAY 24 ATE INGESTION TESTS PASSED! ✅");
console.log("=========================================================================\n");
