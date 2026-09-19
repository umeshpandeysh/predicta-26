/**
 * Predicta Semiconductor Intelligence Platform — Anomaly Benchmark & Parity Tests (Node.js)
 * File: tests/test_anomaly_benchmark.js
 */

const fs = require('fs');
const path = require('path');
const { RobustMADDetectorJS } = require('../src/anomaly_detection/robust_mad');
const { COPODDetectorJS } = require('../src/anomaly_detection/copod');
const { IsolationForestDetectorJS, eulerHarmonicC } = require('../src/anomaly_detection/isolation_forest');
const { AnomalyFusionEngineJS } = require('../src/anomaly_detection/fusion');

console.log("Starting Stage 4 Dynamic Anomaly Benchmark Unit & Parity Tests...\n");

let failures = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
    failures++;
  }
}

// 1. Contract & Artifact Existence
const artifactPath = path.join(__dirname, '../ml/models/production/predicta_anomaly_v2_artifacts.json');
const contractPath = path.join(__dirname, '../ml/anomaly/anomaly_contract.json');
const reportJsonPath = path.join(__dirname, '../experiments/anomaly_evaluation/anomaly_benchmark_report.json');
const reportMdPath = path.join(__dirname, '../experiments/anomaly_evaluation/anomaly_benchmark_report.md');

assert(fs.existsSync(artifactPath), "Production V2 anomaly artifact exists (predicta_anomaly_v2_artifacts.json)");
assert(fs.existsSync(contractPath), "Authoritative anomaly contract exists (anomaly_contract.json)");
assert(fs.existsSync(reportJsonPath), "Benchmark JSON report exists (anomaly_benchmark_report.json)");
assert(fs.existsSync(reportMdPath), "Benchmark Markdown report exists (anomaly_benchmark_report.md)");

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
assert(artifact.contract_version === "2.0.0_authoritative", "V2 artifact contract_version is '2.0.0_authoritative'");
assert(artifact.threshold_optimization_metric === "F2_MAX_VALIDATION_ONLY", "Artifact records F2_MAX_VALIDATION_ONLY optimization metric");
assert(Array.isArray(artifact.canonical_feature_order) && artifact.canonical_feature_order.length === 3, "Canonical features contain exactly 3 dimensions");
assert(artifact.canonical_feature_order[0] === "iddq" && artifact.canonical_feature_order[1] === "ileak" && artifact.canonical_feature_order[2] === "tpd", "Canonical feature order is exactly [iddq, ileak, tpd]");
assert(artifact.isolation_forest && Array.isArray(artifact.isolation_forest.trees) && artifact.isolation_forest.trees.length === 100, "Isolation Forest contains 100 serialized trees");

// 2. Mathematical Parity & Tree Traversal Test
const isoDet = new IsolationForestDetectorJS(artifact.isolation_forest);
const testNormalSample = { iddq: 2140.0, ileak: 300.0, tpd: 192.0 };
const testAnomalousSample = { iddq: 4500.0, ileak: 850.0, tpd: 310.0 };

const resNormal = isoDet.scoreSingle(testNormalSample);
const resAnomaly = isoDet.scoreSingle(testAnomalousSample);

assert(resNormal.score < resAnomaly.score, `Isolation forest scores anomaly higher than normal: Normal=${resNormal.score}, Anomaly=${resAnomaly.score}`);
assert(resAnomaly.score > 0.60, `Extreme outlier produces high anomaly score: ${resAnomaly.score}`);
assert(typeof resAnomaly.anomaly_evidence === 'object', "Isolation forest produces feature-level anomaly evidence");

// 3. Schema & Feature Order Locking in Node.js
let missingThrew = false;
try {
  isoDet.scoreSingle({ iddq: 2100.0, ileak: 300.0 });
} catch (e) {
  missingThrew = true;
}
assert(missingThrew, "Isolation Forest rejects missing feature with explicit error");

let nonNumericThrew = false;
try {
  const madDetTemp = new RobustMADDetectorJS(artifact.robust_mad);
  madDetTemp.scoreSingle({ iddq: "invalid_string", ileak: 300.0, tpd: 190.0 });
} catch (e) {
  nonNumericThrew = true;
}
assert(nonNumericThrew, "Robust MAD rejects non-numeric value with explicit error");

// 4. Robust MAD Lot-Relative vs Fallback
const madDet = new RobustMADDetectorJS(artifact.robust_mad);
const resKnown = madDet.scoreSingle(testNormalSample, "LOT-SYN-001");
const resUnseen = madDet.scoreSingle(testNormalSample, "LOT-SYN-999");
const resMissing = madDet.scoreSingle(testNormalSample, null);

assert(resKnown.reference_source === "LOT_RELATIVE", `Known lot uses LOT_RELATIVE statistics (found: ${resKnown.reference_source})`);
assert(resUnseen.reference_source.includes("GLOBAL_FALLBACK"), `Unseen lot falls back to global baseline (found: ${resUnseen.reference_source})`);
assert(resMissing.reference_source === "GLOBAL_FALLBACK", `Missing lot falls back to global baseline (found: ${resMissing.reference_source})`);

// 5. Multi-Criteria Fusion Engine
const fusionEngine = new AnomalyFusionEngineJS({
  mad_parameters: artifact.robust_mad,
  copod_parameters: artifact.copod,
  isolation_forest_parameters: artifact.isolation_forest,
  weights: artifact.fusion.weights,
  normalization_scales: artifact.fusion.normalization_scales,
  fusion_threshold: artifact.fusion.fusion_threshold,
});

const fusionNorm = fusionEngine.evaluateComponent(testNormalSample, "LOT-SYN-001");
const fusionAnom = fusionEngine.evaluateComponent(testAnomalousSample, "LOT-SYN-001");

assert(fusionNorm.overall_status === "PASS", `Normal sample evaluated as PASS by fusion engine (found: ${fusionNorm.overall_status})`);
assert(fusionAnom.overall_status === "REJECT", `Anomalous sample evaluated as REJECT by fusion engine (found: ${fusionAnom.overall_status})`);
assert(fusionAnom.conservative_alarm === true, "Conservative alarm triggered for extreme anomaly");

// 6. BST Harmonic Math Test
assert(eulerHarmonicC(1) === 0.0, "BST c(1) is 0");
assert(eulerHarmonicC(2) === 1.0, "BST c(2) is 1");
const c256 = eulerHarmonicC(256);
assert(c256 > 9.0 && c256 < 11.0, `BST c(256) ≈ 10.24 (found: ${c256.toFixed(4)})`);

console.log(`\nTests completed with ${failures} failures.`);

if (failures > 0) {
  process.exit(1);
} else {
  console.log("All Stage 4 Dynamic Anomaly Benchmark tests passed successfully!");
  process.exit(0);
}
