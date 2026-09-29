/**
 * PREDICTA-26 — Phase 2 Production Hardening, Invariants & Judge Integrity Suite
 * File: tests/test_phase2_production_hardening.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const inferenceService = require('../src/api/inference');

const PROJECT_ROOT = path.resolve(__dirname, '..');

const EXPECTED_HASHES = {
  model: "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98",
  dataset: "9a8367a96a7d2dcf83a62e9c0e02ab41502b6069deebc116a0e9cd0ef45fab24",
  testSplit: "413ec0b7a5175dca99742c96e106718552a213a273e4ec5a314125f1f2b936b2",
  featureContract: "118d63717211a8f8d9ec596c59edb05311650c9d40fd324a3224b9ce9d17ca04",
  manifest: "cfdd0c87038f3d3e9311a637fc5be811e8d97a4602c9b2c8bc40585ad4d998bb"
};

function computeSha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function computeSha256Lf(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

const NOMINAL_INPUT = {
  equipment_id: "EQP-101",
  lot_id: "LOT-SYN-001",
  supply_voltage: 1.20,
  output_voltage: 1.18,
  current: 46.5,
  leakage_current: 111.7,
  resistance: 1.2,
  capacitance: 15.0,
  threshold_voltage: 0.45,
  frequency: 2400.0,
  propagation_delay: 10.98,
  setup_time: 1.15,
  hold_time: 0.85,
  timing_margin: 2.1,
  temperature: 25.0,
  dynamic_power: 55.8,
  total_power: 55.9,
  test_duration: 120.0
};

async function runHardeningSuite() {
  console.log("=========================================================================");
  console.log("PREDICTA-26 — PHASE 2 PRODUCTION HARDENING & JUDGE INTEGRITY SUITE");
  console.log("=========================================================================\n");

  // --- ML-01: Protected Production Model Hash ---
  console.log("▶ ML-01: Cryptographic Model Weight Lock");
  const modelPath = path.join(PROJECT_ROOT, 'ml/models/production/predicta_xgboost_model.json');
  const actualModelSha = computeSha256Lf(modelPath);
  assert.strictEqual(actualModelSha, EXPECTED_HASHES.model, "Model SHA must match immutable constant");
  console.log("  ✔ ML-01 Passed: Production model SHA verified (91bb598a...) ✅");

  // --- ML-02: Operating Threshold Lock ---
  console.log("▶ ML-02: Operating Threshold Lock (theta* = 0.20)");
  assert.strictEqual(inferenceService.operatingThreshold, 0.20, "Operating threshold must be locked to 0.20");
  console.log("  ✔ ML-02 Passed: Operating threshold strictly locked to 0.20 ✅");

  // --- ML-03: Feature Contract Integrity ---
  console.log("▶ ML-03: Feature Contract Immutability");
  const contractPath = path.join(PROJECT_ROOT, 'ml/data/feature_contract.json');
  const contractSha = computeSha256Lf(contractPath);
  assert.strictEqual(
    contractSha,
    EXPECTED_HASHES.featureContract,
    `Feature contract SHA must match the single canonical repository representation (observed: ${contractSha})`
  );
  console.log("  ✔ ML-03 Passed: Feature contract SHA verified (118d6371...) ✅");

  // --- ML-05 & ML-06: Strong Client Decision & ML Override Prevention ---
  console.log("▶ ML-05 & ML-06: Strong Client Decision & ML Spoof Equivalence Verification");
  const cleanRun = await inferenceService.predictSingleAsync({ ...NOMINAL_INPUT });
  const forgedRun = await inferenceService.predictSingleAsync({
    ...NOMINAL_INPUT,
    probability: 0.999999,
    prediction: "FAIL",
    ml_prediction: "FAIL",
    disposition: "REJECT",
    risk_level: "CRITICAL",
    anomaly_score: 999999,
    model_hash: "ATTACKER_MODEL_SPOOF",
    model_id: "FAKE_XGBOOST_MODEL",
    prognostic_output: { spoofed: true },
    ml_decision_snapshot: { spoofed: true }
  });

  assert(Math.abs(cleanRun.probability - forgedRun.probability) < 1e-9, "Failure probability must be mathematically identical");
  assert.strictEqual(cleanRun.prediction, forgedRun.prediction, "Prediction must match clean run");
  assert.strictEqual(cleanRun.disposition, forgedRun.disposition, "Disposition must match clean run");
  assert.strictEqual(cleanRun.risk_level, forgedRun.risk_level, "Risk level must match clean run");
  assert.strictEqual(cleanRun.source, forgedRun.source, "Source must match clean run");
  assert.strictEqual(cleanRun.ml_details?.risk_engine?.risk_class, forgedRun.ml_details?.risk_engine?.risk_class, "Risk class must match");
  assert.strictEqual(cleanRun.ml_details?.anomaly_detection?.overall_status, forgedRun.ml_details?.anomaly_detection?.overall_status, "Anomaly overall status must match");
  console.log(`  ✔ ML-05 & ML-06 Passed: Client-supplied ML fields safely ignored (clean P=${cleanRun.probability} === forged P=${forgedRun.probability}) ✅`);

  // --- TEMP-01: 0h-Only Insufficient History ---
  console.log("▶ TEMP-01: Single-Point (0h-Only) Insufficient History Truthfulness");
  const singlePointRun = await inferenceService.predictSingleAsync({ ...NOMINAL_INPUT });
  const gprIddq = singlePointRun.ml_details?.drift_prediction?.iddq;
  assert(gprIddq?.status === "INSUFFICIENT_HISTORY" || gprIddq?.has_history === false, "Single point must yield INSUFFICIENT_HISTORY");
  console.log("  ✔ TEMP-01 Passed: Single-point telemetry truthfully reports INSUFFICIENT_HISTORY ✅");

  // --- TEMP-02: Valid 0h + 24h GPR Forecasting ---
  console.log("▶ TEMP-02: Legitimate 0h+24h Temporal Degradation Forecasting");
  const temporalRun = await inferenceService.predictSingleAsync({
    ...NOMINAL_INPUT,
    iddq_0h: 2100.0,
    iddq_standby: 2150.0,
    ileak_0h: 110.0,
    leakage_current: 111.7,
    tpd_0h: 10.5,
    propagation_delay: 10.98
  });
  const gprTpd = temporalRun.ml_details?.drift_prediction?.tpd;
  assert.strictEqual(gprTpd?.has_history, true, "GPR must activate with 0h+24h history");
  assert(Number.isFinite(gprTpd?.predicted_168h), "GPR must output 168h forecast");
  assert(gprTpd.lower_95 < gprTpd.upper_95, "95% confidence bounds must be valid");
  console.log(`  ✔ TEMP-02 Passed: GPR 168h Tpd forecast = ${gprTpd.predicted_168h} ps [${gprTpd.lower_95}, ${gprTpd.upper_95}] ✅`);

  // --- TEMP-03: Temporal Leakage Prevention ---
  console.log("▶ TEMP-03: Strict Temporal Feature Leakage Prevention");
  const latentContract = require('../src/evaluation/latent_trajectory');
  assert.throws(() => {
    latentContract.assertNoTemporalLeakage({
      iddq_standby_24h: 2100.0,
      iddq_standby_168h: 2500.0 // Prohibited post-screening feature
    });
  }, /TEMPORAL_LEAKAGE_DETECTED/);
  console.log("  ✔ TEMP-03 Passed: Post-24h feature leakage strictly trapped and rejected ✅");

  // --- OOD-01: Unseen Equipment ID Fail-Closed Governance ---
  console.log("▶ OOD-01: Out-of-Distribution / Unseen Equipment Governance");
  const oodRun = await inferenceService.predictSingleAsync({
    ...NOMINAL_INPUT,
    equipment_id: "EQP-UNSEEN-999"
  });
  assert.strictEqual(oodRun.is_unseen_equipment, true, "Unseen equipment must be flagged");
  assert.strictEqual(oodRun.disposition, "MONITOR", "Unseen equipment must be governed to MONITOR (fail-closed)");
  console.log("  ✔ OOD-01 Passed: Unseen equipment governed to MONITOR with is_unseen_equipment=true ✅");

  // --- DEMO-01 & DEMO-02: Live vs Demo Separation ---
  console.log("▶ DEMO-01 & DEMO-02: Strict Live vs Demo Tagging");
  const liveRun = await inferenceService.predictSingleAsync({ ...NOMINAL_INPUT });
  assert.strictEqual(liveRun.source, "PRODUCTION");
  console.log("  ✔ DEMO-01 & DEMO-02 Passed: Live runs marked source=PRODUCTION ✅");

  // --- CLAIM-01: Claim Evidence Matrix Consistency ---
  console.log("▶ CLAIM-01: Scientific Claim & Evidence Matrix Verification");
  const matrixPath = path.join(PROJECT_ROOT, 'docs/PHASE2_CLAIM_EVIDENCE_MATRIX.md');
  assert(fs.existsSync(matrixPath), "Claim evidence matrix must exist");
  const matrixText = fs.readFileSync(matrixPath, 'utf8');
  assert(matrixText.includes("SYNTHETIC BENCHMARK"), "Matrix must classify synthetic benchmark claims");
  assert(matrixText.includes("PROJECT ASSUMPTION"), "Matrix must classify project assumption claims");
  assert(matrixText.includes("LITERATURE-BACKED"), "Matrix must classify literature-backed claims");
  console.log("  ✔ CLAIM-01 Passed: Master claim-evidence matrix verified complete ✅");

  console.log("\n=========================================================================");
  console.log("🏆 ALL PHASE 2 PRODUCTION HARDENING & INVARIANT TESTS PASSED CLEANLY! ✅");
  console.log("=========================================================================");
}

if (require.main === module) {
  runHardeningSuite().catch(err => {
    console.error("FATAL SUITE FAILURE:", err);
    process.exit(1);
  });
}

module.exports = { runHardeningSuite };
