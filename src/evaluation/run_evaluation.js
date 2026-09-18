/**
 * PREDICTA SIH 2026 — Canonical Evaluation Runner Bridge
 * File: src/evaluation/run_evaluation.js
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

const args = process.argv.slice(2);
const pyScript = path.join(__dirname, 'run_evaluation.py');

const res = spawnSync(pyExe, [pyScript, ...args], {
  cwd: path.join(__dirname, '..', '..'),
  encoding: 'utf-8',
  stdio: 'inherit'
});

if (res.status !== 0) {
  process.exit(res.status || 1);
}
