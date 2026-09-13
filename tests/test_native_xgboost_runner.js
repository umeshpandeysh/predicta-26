/**
 * Predicta Semiconductor Test Analytics Prototype — Native XGBoost Test Runner
 * File: tests/test_native_xgboost_runner.js
 *
 * Runs pytest tests/test_native_xgboost.py using the verified Python environment.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const candidatePythons = [
  process.env.PYTHON_EXECUTABLE,
  process.env.PYTHON,
  process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'python311', 'python.exe') : null,
  'python',
  'python3',
  'py'
].filter(Boolean);

let pyExe = 'python';
for (const cand of candidatePythons) {
  try {
    const probe = spawnSync(cand, ['--version'], { encoding: 'utf-8' });
    if (probe.status === 0) {
      pyExe = cand;
      break;
    }
  } catch (_) {}
}

console.log("=========================================================================");
console.log("PREDICTA — NATIVE XGBOOST PYTEST SUITE RUNNER");
console.log("=========================================================================\n");

const res = spawnSync(pyExe, ['-m', 'pytest', 'tests/test_native_xgboost.py', '-v'], {
  cwd: path.join(__dirname, '..'),
  encoding: 'utf-8',
  stdio: 'inherit'
});

if (res.status !== 0) {
  console.error("❌ Native XGBoost pytest suite failed!");
  process.exit(res.status || 1);
}

console.log("\n=========================================================================");
console.log("ALL NATIVE XGBOOST TESTS PASSED 100% CLEANLY! ✅");
console.log("=========================================================================\n");
