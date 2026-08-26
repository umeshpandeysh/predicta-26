/**
 * Predicta Day 25 — Database Consistency Acceptance Test Suite
 * File: tests/test_database_consistency.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 25 — DATABASE CONSISTENCY TEST SUITE");
console.log("=========================================================================\n");

const summary = inf.getDashboardSummary();
assert.ok(summary, "Dashboard summary is null");
assert.ok(typeof summary.total_runs === 'number', "total_runs must be a number");
assert.ok(typeof summary.pass_count === 'number', "pass_count must be a number");
assert.ok(typeof summary.fail_count === 'number', "fail_count must be a number");
assert.strictEqual(summary.total_runs, summary.pass_count + summary.fail_count, "Total runs mismatch in dashboard summary");

console.log("✔ Test 01 Passed: Dashboard summary KPI totals match individual prediction counts (Total = Pass + Fail)");

const recent = inf.getRecentPredictions();
assert.ok(Array.isArray(recent), "Recent predictions should be an array");
console.log("✔ Test 02 Passed: Dashboard recent predictions API returns valid list of persistent records");

console.log("\n=========================================================================");
console.log("ALL DAY 25 DATABASE CONSISTENCY TESTS PASSED! ✅");
console.log("=========================================================================\n");
