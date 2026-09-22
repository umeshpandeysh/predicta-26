/**
 * Portable Pytest Execution Wrapper
 * File: scripts/run_pytest.js
 * 
 * Dynamically resolves Python binary across cross-platform environments
 * (Windows, Linux, macOS) without relying on hardcoded personal paths.
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

let pythonBin = 'python';
for (const cand of candidatePythons) {
  try {
    const probe = spawnSync(cand, ['--version'], { encoding: 'utf-8' });
    if (probe.status === 0) {
      pythonBin = cand;
      break;
    }
  } catch (_) {}
}

const args = ['-m', 'pytest', ...process.argv.slice(2)];
const result = spawnSync(pythonBin, args, {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..')
});

process.exit(result.status !== null ? result.status : 1);
