/**
 * Predicta Day 18 — System Status & Health API Test Suite
 * File: tests/test_system_status.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 18 — SYSTEM STATUS & HEALTH TEST SUITE");
console.log("=========================================================================\n");

// 1. System Status API Structure Audit
const status = inf.getSystemStatus();
assert.strictEqual(status.api, "ONLINE", "1. API status not ONLINE");
assert.strictEqual(status.ml_engine, "ONLINE", "1. ML engine status not ONLINE");
assert.strictEqual(status.model_version, "2.0_production", "1. Model version mismatch");
assert.strictEqual(status.threshold, 0.45, "1. Operating threshold mutated");
assert.ok(typeof status.uptime_seconds === "number", "1. uptime_seconds missing/invalid");
console.log("✔ Test 01 Passed: System status returns ONLINE for API & ML engine with threshold 0.45");

// 2. Secret Exposure Protection Audit
const statusJson = JSON.stringify(status);
assert.strictEqual(statusJson.includes("SUPABASE_SECRET_KEY"), false, "2. Secret key exposed in system status!");
assert.strictEqual(statusJson.includes("service_role"), false, "2. Service role string exposed!");
console.log("✔ Test 02 Passed: Zero secret credentials exposed in system status API payload");

console.log("\n=========================================================================");
console.log("ALL DAY 18 SYSTEM STATUS TESTS PASSED SUCCESSFULLY! ✅");
console.log("=========================================================================\n");
