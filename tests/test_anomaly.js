// Node.js automated unit checks for AIPS Module A anomaly detectors
const fs = require('fs');
const path = require('path');

console.log("Starting Module A mathematical detector unit tests...\n");

let failures = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
    failures++;
  }
}

// 1. ECDF function test
function getEcdfVal(val, sorted) {
  if (sorted.length === 0) return 0.5;
  let count = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] <= val) count++;
    else break;
  }
  const pct = count / sorted.length;
  return Math.max(1e-9, Math.min(1.0 - 1e-9, pct));
}

const mockSorted = [1.0, 1.2, 1.3, 1.5, 1.8, 2.0, 2.2, 2.5, 3.0, 5.0];
const pLow = getEcdfVal(1.0, mockSorted);
const pMid = getEcdfVal(1.8, mockSorted);
const pHigh = getEcdfVal(5.0, mockSorted);
const pOutlier = getEcdfVal(10.0, mockSorted);

assert(pLow === 0.1, `ECDF value for minimum is 0.1 (found ${pLow})`);
assert(pMid === 0.5, `ECDF value for median is 0.5 (found ${pMid})`);
assert(pHigh === 1.0 - 1e-9, `ECDF value for maximum is clipped (found ${pHigh})`);
assert(pOutlier === 1.0 - 1e-9, `ECDF value for extreme outlier is clipped (found ${pOutlier})`);

// 2. Robust MAD limit logic test
const mockLotVals = [10.0, 10.2, 10.4, 10.5, 10.6, 10.8, 11.0]; // Median = 10.5
// Absolute deviations: [0.5, 0.3, 0.1, 0, 0.1, 0.3, 0.5] -> sorted: [0, 0.1, 0.1, 0.3, 0.3, 0.5, 0.5] -> MAD = 0.3
// Robust sigma = 1.4826 * 0.3 = 0.44478

const sorted = [...mockLotVals].sort((a,b)=>a-b);
const median = sorted[Math.floor(sorted.length / 2)];
const mads = sorted.map(v => Math.abs(v - median)).sort((a,b)=>a-b);
const mad = mads[Math.floor(mads.length / 2)];
const sigma = 1.4826 * mad;

assert(median === 10.5, "MAD logic: Median is 10.5");
assert(Math.abs(mad - 0.3) < 1e-9, "MAD logic: MAD is 0.3");
assert(Math.abs(sigma - 0.44478) < 1e-5, `MAD logic: Robust sigma is 0.44478 (found ${sigma})`);

// Test Z-score mapping
const healthyVal = 10.6;
const outlierVal = 18.0;
const zHealthy = Math.abs(healthyVal - median) / sigma;
const zOutlier = Math.abs(outlierVal - median) / sigma;

assert(zHealthy < 1.0, `Healthy value has low Z-score: ${zHealthy.toFixed(2)}`);
assert(zOutlier > 15.0, `Outlier value has extremely high Z-score: ${zOutlier.toFixed(2)}`);
assert(zOutlier > 6.0, "Robust MAD rejects the outlier (>6.0 Z-score)");

console.log(`\nAnomaly tests completed. Failures: ${failures}`);

if (failures > 0) {
  process.exit(1);
} else {
  console.log("All Module A anomaly mathematical tests completed successfully!");
  process.exit(0);
}
