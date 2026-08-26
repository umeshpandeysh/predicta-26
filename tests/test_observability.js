/**
 * Predicta Day 18 — Production Observability & Performance Benchmark Test Suite
 * File: tests/test_observability.js
 */

const assert = require('assert');
const inf = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA DAY 18 — OBSERVABILITY & LATENCY BENCHMARK TEST SUITE");
console.log("=========================================================================\n");

const baseRecord = {
  test_id: "BENCH-RECORD-001",
  equipment_id: "EQP-101",
  supply_voltage: 1.20, output_voltage: 1.18, current: 40.0, leakage_current: 110.0,
  resistance: 12.0, capacitance: 4.0, threshold_voltage: 0.45, frequency: 2500.0,
  propagation_delay: 11.5, setup_time: 1.2, hold_time: 0.8, timing_margin: 2.2,
  temperature: 26.0, dynamic_power: 42.0, total_power: 52.0, test_duration: 12.0
};

// Latency benchmark for batch sizes: 10, 50, 100, 500, 1000
const batchSizes = [10, 50, 100, 500, 1000];

batchSizes.forEach(size => {
  const batch = Array(size).fill(baseRecord);
  const start = Date.now();
  const res = inf.predictBatch(batch);
  const duration = Date.now() - start;
  const avgPerItem = (duration / size).toFixed(3);
  
  assert.strictEqual(res.total, size, `Batch size ${size} total mismatch`);
  console.log(`✔ Benchmark N=${size.toString().padEnd(4)} | Total Latency: ${duration.toString().padEnd(4)} ms | Avg/Record: ${avgPerItem} ms`);
});

console.log("\n=========================================================================");
console.log("ALL DAY 18 OBSERVABILITY & LATENCY BENCHMARKS PASSED! ✅");
console.log("=========================================================================\n");
