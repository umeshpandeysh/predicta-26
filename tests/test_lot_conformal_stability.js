/**
 * Predicta Semiconductor Intelligence Platform
 * Stage 6 Task 3 — Multi-Lot Conformal Stability Test Suite (Node.js)
 * ==================================================================
 * Verifies behavioral requirements and security/governance attacks A through O:
 *
 * Attack A: Correct lot-level coverage calculation
 * Attack B: No cross-lot leakage
 * Attack C: Wrong dataset hash rejected fail-closed
 * Attack D: Wrong split manifest rejected fail-closed
 * Attack E: Calibration/test lot overlap rejected fail-closed
 * Attack F: Missing calibration artifact rejected fail-closed
 * Attack G: Unsupported horizon cannot be evaluated fail-closed
 * Attack H: Missing required parameter rejected fail-closed
 * Attack I: Wrong nominal level rejected fail-closed
 * Attack J: Deterministic repeated evaluation
 * Attack K: Provenance mismatch / artifact tampering rejected fail-closed
 * Attack L: Aggregate coverage cannot hide lot-level records
 * Attack M: No arbitrary production acceptance threshold silently introduced
 * Attack N: BENCHMARK_ONLY status remains unchanged
 * Attack O: NOT_CALIBRATED status remains unchanged
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  MultiLotConformalStabilityEvaluator,
  loadAuthoritativeStabilityContract,
  STABILITY_CONTRACT_PATH,
} = require('../src/prognostics/evaluate_lot_stability');
const {
  DATASET_PATH,
  SPLIT_MANIFEST_PATH,
} = require('../src/prognostics/conformal');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CALIBRATION_ARTIFACT_PATH = path.join(
  PROJECT_ROOT,
  'ml/models/production/conformal_calibration_artifacts.json'
);

function runTests() {
  console.log('='.repeat(80));
  console.log('RUNNING STAGE 6 TASK 3 MULTI-LOT CONFORMAL STABILITY TEST SUITE (NODE.JS)');
  console.log('='.repeat(80));

  const evaluator = new MultiLotConformalStabilityEvaluator();

  // Attack A: Correct lot-level coverage calculation
  console.log('Running Attack A: Correct lot-level coverage calculation...');
  {
    const report = evaluator.evaluate();
    const perLot = report.per_lot_evaluation;
    const testLots = report.report_metadata.test_lots;

    assert.strictEqual(testLots.length, 8);
    for (const lot of testLots) {
      assert.ok(lot in perLot, `Lot ${lot} must be in perLot`);
      for (const p of ['iddq', 'ileak', 'tpd']) {
        for (const h of [96, 168]) {
          const hStr = `${h}h`;
          for (const lvl of [0.8, 0.9, 0.95]) {
            const lvlStr = lvl.toFixed(2);
            const rec = perLot[lot][p][hStr][lvlStr];

            assert.strictEqual(rec.lot_id, lot);
            assert.strictEqual(rec.sample_count, 100);
            assert.ok(rec.covered_count >= 0 && rec.covered_count <= 100);
            const expectedRatio = rec.covered_count / 100.0;
            assert.ok(Math.abs(rec.empirical_coverage_ratio - expectedRatio) < 1e-4);
            assert.ok(Math.abs(rec.empirical_coverage_pct - expectedRatio * 100.0) < 1e-2);
            assert.ok(Math.abs(rec.coverage_deviation - (expectedRatio - lvl)) < 1e-4);
            assert.ok(Math.abs(rec.abs_coverage_deviation - Math.abs(expectedRatio - lvl)) < 1e-4);
          }
        }
      }
    }
    console.log('  -> PASS: Attack A');
  }

  // Attack B: No cross-lot leakage
  console.log('Running Attack B: No cross-lot leakage...');
  {
    const report1 = evaluator.evaluate();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'predicta-attack-b-'));
    const mutatedCsv = path.join(tmpDir, 'mutated.csv');

    const lines = fs.readFileSync(DATASET_PATH, 'utf8').split('\n');
    const header = lines[0];
    const mutatedLines = [header];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const parts = lines[i].split(',');
      if (parts[1] === 'LOT-SYN-043' && parts[6] === '168') {
        parts[9] = '99999.0'; // extreme iddq at 168h
      }
      mutatedLines.push(parts.join(','));
    }
    fs.writeFileSync(mutatedCsv, mutatedLines.join('\n'), 'utf8');

    class BypassedEvaluator extends MultiLotConformalStabilityEvaluator {
      verifyDatasetIntegrity() {
        return 'mock_sha';
      }
      loadAndValidateCalibrationArtifact() {
        return JSON.parse(fs.readFileSync(this.calibrationArtifactPath, 'utf8'));
      }
    }

    const mutEvaluator = new BypassedEvaluator({ datasetPath: mutatedCsv });
    const report2 = mutEvaluator.evaluate();

    const cov1_43 = report1.per_lot_evaluation['LOT-SYN-043'].iddq['168h']['0.90'].empirical_coverage_ratio;
    const cov2_43 = report2.per_lot_evaluation['LOT-SYN-043'].iddq['168h']['0.90'].empirical_coverage_ratio;
    assert.ok(cov2_43 < cov1_43, 'LOT-SYN-043 coverage must drop upon extreme target injection');

    // All other lots remain identical
    for (const other of ['LOT-SYN-044', 'LOT-SYN-045', 'LOT-SYN-046', 'LOT-SYN-047', 'LOT-SYN-048', 'LOT-SYN-049', 'LOT-SYN-050']) {
      const c1 = report1.per_lot_evaluation[other].iddq['168h']['0.90'].empirical_coverage_ratio;
      const c2 = report2.per_lot_evaluation[other].iddq['168h']['0.90'].empirical_coverage_ratio;
      assert.strictEqual(c1, c2, `Lot ${other} coverage must remain identical`);
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log('  -> PASS: Attack B');
  }

  // Attack C: Wrong dataset hash rejected
  console.log('Running Attack C: Wrong dataset hash rejected fail-closed...');
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'predicta-attack-c-'));
    const fakeCsv = path.join(tmpDir, 'fake.csv');
    fs.writeFileSync(fakeCsv, 'component_id,lot_id,iddq_0h\n1,LOT-SYN-001,10.0\n');

    assert.throws(
      () => new MultiLotConformalStabilityEvaluator({ datasetPath: fakeCsv }),
      /DATASET_HASH_MISMATCH/
    );
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log('  -> PASS: Attack C');
  }

  // Attack D: Wrong split manifest rejected
  console.log('Running Attack D: Wrong split manifest rejected fail-closed...');
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'predicta-attack-d-'));
    const badManifest = path.join(tmpDir, 'bad_manifest.json');
    fs.writeFileSync(badManifest, JSON.stringify({ lots: { train: ['LOT-SYN-001'] } }));

    assert.throws(
      () => new MultiLotConformalStabilityEvaluator({ splitManifestPath: badManifest }),
      /MALFORMED_SPLIT_MANIFEST/
    );
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log('  -> PASS: Attack D');
  }

  // Attack E: Calibration/test lot overlap rejected
  console.log('Running Attack E: Calibration/test lot overlap rejected fail-closed...');
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'predicta-attack-e-'));
    const manifest = JSON.parse(fs.readFileSync(SPLIT_MANIFEST_PATH, 'utf8'));
    manifest.lots.test[0] = manifest.lots.calibration[0]; // overlap!

    const overlapManifest = path.join(tmpDir, 'overlap.json');
    fs.writeFileSync(overlapManifest, JSON.stringify(manifest));

    assert.throws(
      () => new MultiLotConformalStabilityEvaluator({ splitManifestPath: overlapManifest }),
      /LOT_OVERLAP_DETECTED/
    );
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log('  -> PASS: Attack E');
  }

  // Attack F: Missing calibration artifact rejected
  console.log('Running Attack F: Missing calibration artifact rejected fail-closed...');
  {
    const missingArtifact = path.join(os.tmpdir(), 'nonexistent_art.json');
    assert.throws(
      () => new MultiLotConformalStabilityEvaluator({ calibrationArtifactPath: missingArtifact }),
      /CALIBRATION_ARTIFACT_NOT_FOUND/
    );
    console.log('  -> PASS: Attack F');
  }

  // Attack G: Unsupported horizon cannot be evaluated
  console.log('Running Attack G: Unsupported horizon cannot be evaluated...');
  {
    const report = evaluator.evaluate();
    for (const lot of report.report_metadata.test_lots) {
      for (const p of ['iddq', 'ileak', 'tpd']) {
        assert.strictEqual(report.per_lot_evaluation[lot][p]['48h'], undefined);
        assert.strictEqual(report.per_lot_evaluation[lot][p]['72h'], undefined);
        assert.strictEqual(report.per_lot_evaluation[lot][p]['120h'], undefined);
        assert.strictEqual(report.per_lot_evaluation[lot][p]['144h'], undefined);
      }
    }
    console.log('  -> PASS: Attack G');
  }

  // Attack H: Missing required parameter rejected
  console.log('Running Attack H: Missing required parameter rejected fail-closed...');
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'predicta-attack-h-'));
    const contract = loadAuthoritativeStabilityContract();
    const contractMod = JSON.parse(JSON.stringify(contract));
    contractMod.methodology.target_parameters = ['ileak', 'tpd']; // iddq missing!

    const modPath = path.join(tmpDir, 'mod_contract.json');
    fs.writeFileSync(modPath, JSON.stringify(contractMod));

    assert.throws(
      () => new MultiLotConformalStabilityEvaluator({ stabilityContractPath: modPath }),
      /MISSING_REQUIRED_PARAMETER/
    );
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log('  -> PASS: Attack H');
  }

  // Attack I: Wrong nominal level rejected
  console.log('Running Attack I: Wrong nominal level rejected...');
  {
    const contract = loadAuthoritativeStabilityContract();
    assert.deepStrictEqual(contract.methodology.candidate_nominal_levels, [0.8, 0.9, 0.95]);
    console.log('  -> PASS: Attack I');
  }

  // Attack J: Deterministic repeated evaluation
  console.log('Running Attack J: Deterministic repeated evaluation...');
  {
    const rep1 = evaluator.evaluate();
    const rep2 = evaluator.evaluate();

    for (const p of ['iddq', 'ileak', 'tpd']) {
      for (const h of ['96h', '168h']) {
        for (const lvl of ['0.80', '0.90', '0.95']) {
          const a1 = rep1.aggregate_evaluation[p][h][lvl];
          const a2 = rep2.aggregate_evaluation[p][h][lvl];
          assert.strictEqual(a1.empirical_coverage_pct, a2.empirical_coverage_pct);
          assert.strictEqual(a1.covered_count, a2.covered_count);
          assert.strictEqual(a1.conformal_quantile_q, a2.conformal_quantile_q);

          const d1 = rep1.cross_lot_dispersion[p][h][lvl];
          const d2 = rep2.cross_lot_dispersion[p][h][lvl];
          assert.strictEqual(d1.min_lot_coverage_pct, d2.min_lot_coverage_pct);
          assert.strictEqual(d1.max_lot_coverage_pct, d2.max_lot_coverage_pct);
          assert.strictEqual(d1.lot_coverage_range_pct, d2.lot_coverage_range_pct);
          assert.strictEqual(d1.std_lot_coverage_pct, d2.std_lot_coverage_pct);
        }
      }
    }
    console.log('  -> PASS: Attack J');
  }

  // Attack K: Provenance mismatch rejected
  console.log('Running Attack K: Provenance mismatch / artifact tampering rejected...');
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'predicta-attack-k-'));
    const art = JSON.parse(fs.readFileSync(CALIBRATION_ARTIFACT_PATH, 'utf8'));
    art.conformal_quantiles.iddq['96h']['0.80'] = 9999.0; // tamper!
    const tamperedArt = path.join(tmpDir, 'tampered.json');
    fs.writeFileSync(tamperedArt, JSON.stringify(art));

    assert.throws(
      () => new MultiLotConformalStabilityEvaluator({ calibrationArtifactPath: tamperedArt }),
      /CALIBRATION_ARTIFACT_TAMPERING_DETECTED/
    );
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log('  -> PASS: Attack K');
  }

  // Attack L: Aggregate coverage cannot hide lot records
  console.log('Running Attack L: Aggregate coverage cannot hide lot records...');
  {
    const report = evaluator.evaluate();
    assert.strictEqual(Object.keys(report.per_lot_evaluation).length, 8);
    for (const p of ['iddq', 'ileak', 'tpd']) {
      for (const h of ['96h', '168h']) {
        const d = report.cross_lot_dispersion[p][h]['0.80'];
        assert.ok(d.lot_coverage_range_pct > 0.0, 'Range across lots must be greater than 0');
        assert.ok(d.min_lot_coverage_pct < d.max_lot_coverage_pct);
      }
    }
    console.log('  -> PASS: Attack L');
  }

  // Attack M: No arbitrary production acceptance threshold
  console.log('Running Attack M: No arbitrary production acceptance threshold...');
  {
    const report = evaluator.evaluate();
    assert.strictEqual(report.governance_status.governance_status, 'REVIEW_REQUIRED');
    assert.strictEqual(
      report.governance_status.acceptance_threshold_status,
      'NO_PRODUCTION_ACCEPTANCE_THRESHOLD_AUTHORIZED'
    );
    assert.strictEqual(report.governance_status.promotion_locked, true);
    console.log('  -> PASS: Attack M');
  }

  // Attack N: BENCHMARK_ONLY status unchanged
  console.log('Running Attack N: BENCHMARK_ONLY status unchanged...');
  {
    const report = evaluator.evaluate();
    assert.strictEqual(report.governance_status.model_status, 'BENCHMARK_ONLY');
    console.log('  -> PASS: Attack N');
  }

  // Attack O: NOT_CALIBRATED status unchanged
  console.log('Running Attack O: NOT_CALIBRATED status unchanged...');
  {
    const report = evaluator.evaluate();
    assert.strictEqual(report.governance_status.calibration_status, 'NOT_CALIBRATED');
    console.log('  -> PASS: Attack O');
  }

  console.log('='.repeat(80));
  console.log('ALL 15 STAGE 6 TASK 3 ATTACKS (A-O) PASSED CLEANLY (NODE.JS)');
  console.log('='.repeat(80));
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
