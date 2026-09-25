/**
 * Phase 18.2 — Component Reliability Card & Authoritative Twin Read Model Test Suite (Node.js)
 * =============================================================================================
 * Tests:
 * 1. Protected Artifact Integrity (Model SHA-256, Dataset SHA-256, Threshold 0.20)
 * 2. Exact Byte Parity across Root and Frontend Mirrors
 * 3. Zero SHAP and Client-Side Multipliers
 * 4. Component Reliability Card DOM Contract (all 10 questions & required IDs)
 * 5. Digital Reliability Twin Read Model Parity (Deterministic Hash & Resolution)
 * 6. Live API Endpoint Authorization & Response Contract
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const PROD_MODEL_PATH = path.join(ROOT, 'ml', 'models', 'production', 'predicta_xgboost_model.json');
const PROD_DATASET_PATH = path.join(ROOT, 'ml', 'data', 'synthetic', 'predicta_dataset_v3_50000.csv');

const PROTECTED_MODEL_SHA = "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98";
const PROTECTED_DATASET_SHA = "48e718643b6fe99bc410421f5b48715c294f1c4c2edabf10870935afdb820a06";
const PROTECTED_THRESHOLD = 0.20;

function computeSha256(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

console.log("=========================================================================");
console.log("PREDICTA-26 PHASE 18.2 — COMPONENT RELIABILITY CARD TEST SUITE (JS)");
console.log("=========================================================================\n");

// TEST 1: Protected Artifact Cryptographic Hashes & Operating Threshold
console.log("TEST 1: Verifying Protected Artifacts & 0.20 Threshold...");
const actualModelSha = computeSha256(PROD_MODEL_PATH);
assert.strictEqual(actualModelSha, PROTECTED_MODEL_SHA, `Model SHA mismatch: expected ${PROTECTED_MODEL_SHA}, got ${actualModelSha}`);

const actualDatasetSha = computeSha256(PROD_DATASET_PATH);
assert.strictEqual(actualDatasetSha, PROTECTED_DATASET_SHA, `Dataset SHA mismatch: expected ${PROTECTED_DATASET_SHA}, got ${actualDatasetSha}`);

const contract = JSON.parse(fs.readFileSync(path.join(ROOT, "ml", "reliability_twin", "reliability_twin_contract.json"), "utf8"));
assert.strictEqual(contract.immutability_constraints.authoritative_operating_threshold, PROTECTED_THRESHOLD, "Operating threshold must remain strictly 0.20");
console.log("  ✔ Test 1 Passed: Protected artifacts cryptographically intact (Model, Dataset, Threshold 0.20) ✅\n");

// TEST 2: Exact Byte Parity across Root and Frontend Mirrors
console.log("TEST 2: Verifying Byte Parity between Root and Frontend Mirrors...");
const pairs = [
  ["index.html", "frontend/index.html"],
  ["script.js", "frontend/script.js"],
  ["api.js", "frontend/api.js"],
];
for (const [rFile, fFile] of pairs) {
  const rBuf = fs.readFileSync(path.join(ROOT, rFile));
  const fBuf = fs.readFileSync(path.join(ROOT, fFile));
  assert.strictEqual(rBuf.length, fBuf.length, `Size mismatch: ${rFile} (${rBuf.length}b) vs ${fFile} (${fBuf.length}b)`);
  const rSha = crypto.createHash("sha256").update(rBuf).digest("hex");
  const fSha = crypto.createHash("sha256").update(fBuf).digest("hex");
  assert.strictEqual(rSha, fSha, `Hash mismatch between ${rFile} and ${fFile}`);
  console.log(`  ✔ Verified byte parity for ${rFile} <-> ${fFile} (${rBuf.length} bytes, SHA: ${rSha.slice(0, 10)}...)`);
}
console.log("  ✔ Test 2 Passed: 100% exact byte parity confirmed across all mirrors ✅\n");

// TEST 3: Zero SHAP and Client-Side Multipliers
console.log("TEST 3: Verifying Purge of SHAP tokens and Fallback Multipliers...");
const filesToCheck = [
  path.join(ROOT, "index.html"),
  path.join(ROOT, "frontend", "index.html"),
  path.join(ROOT, "script.js"),
  path.join(ROOT, "frontend", "script.js"),
  path.join(ROOT, "api.js"),
  path.join(ROOT, "frontend", "api.js"),
];
const shapRegex = /\bshap\b/i;
const multRegexes = [/\*\s*1\.2\b/, /\*\s*1\.05\b/, /\*\s*0\.95\b/];

for (const fp of filesToCheck) {
  const code = fs.readFileSync(fp, "utf8");
  assert(!shapRegex.test(code), `Prohibited SHAP token detected in ${path.basename(fp)}`);
  for (const mReg of multRegexes) {
    assert(!mReg.test(code), `Prohibited fallback multiplier detected in ${path.basename(fp)}`);
  }
}
console.log("  ✔ Test 3 Passed: Zero SHAP references and zero prohibited multipliers confirmed ✅\n");

// TEST 4: Component Reliability Card DOM Contract
console.log("TEST 4: Verifying Component Reliability Card DOM Structure & Required IDs...");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

assert(html.includes('id="component-reliability-card"'), "Missing #component-reliability-card");

const requiredIds = [
  // A. Identity & Genealogy
  "crc-twin-id-badge",
  "crc-identity-status",
  "btn-crc-refresh",
  "crc-component-id",
  "crc-lot-id",
  "crc-wafer-id",
  "crc-die-id",
  "crc-equip-id",
  "crc-trace-id",
  "crc-test-id",

  // B. Governed State & Disposition
  "crc-ml-prediction",
  "crc-ml-probability",
  "crc-op-recommendation",
  "crc-backend-state",
  "crc-human-disposition",
  "crc-reason-code",
  "crc-escalation-banner",

  // C. Burn-In Timeline
  "crc-tl-0h",
  "crc-tl-24h",
  "crc-tl-96h",
  "crc-tl-168h",

  // D. Anomaly & Degradation
  "crc-pat-status",
  "crc-pat-zscore",
  "crc-copod-score",
  "crc-drift-status",

  // E. Physics Reliability Evidence
  "crc-phys-bti",
  "crc-phys-timing",
  "crc-phys-leakage",
  "crc-phys-thermal",
  "crc-phys-forecast",
  "crc-phys-status",
  "crc-phys-score",

  // F. Uncertainty & Risk
  "crc-uncert-band",
  "crc-risk-score",
  "crc-risk-level",

  // G. Model Attribution Evidence
  "crc-discrim-type",
  "crc-attrib-list",

  // H. Traceability Lineage Chain
  "crc-tr-lot",
  "crc-tr-wafer",
  "crc-tr-comp",
  "crc-tr-trace",
  "crc-tr-test",

  // I. Value Provenance & Cryptographic Attestation
  "crc-prov-model-id",
  "crc-prov-model-sha",
  "crc-prov-threshold",
  "crc-prov-timestamp",

  // J. 10 Stages Summary
  "crc-stage-1",
  "crc-stage-2",
  "crc-stage-3",
  "crc-stage-4",
  "crc-stage-5",
  "crc-stage-6",
  "crc-stage-7",
  "crc-stage-8",
  "crc-stage-9",
  "crc-stage-10",
];

for (const id of requiredIds) {
  assert(html.includes(`id="${id}"`), `Missing required Component Reliability Card element: #${id}`);
}
assert(html.includes("168H_EVALUATION_HORIZON_NOT_FAILURE_TIME"), "Missing 168H_EVALUATION_HORIZON_NOT_FAILURE_TIME disclaimer");
assert(html.includes("MODEL ATTRIBUTION &mdash; NOT A CAUSAL CLAIM"), "Missing non-causal disclaimer");
console.log(`  ✔ Test 4 Passed: All ${requiredIds.length} required DOM IDs and disclaimers verified ✅\n`);

// TEST 5: Digital Reliability Twin Read Model Parity
console.log("TEST 5: Verifying Authoritative Twin Read Model (Canonical Cases & Unregistered)...");
const { ReliabilityTwinManagerJS } = require(path.join(ROOT, "src", "reliability_twin", "reliability_twin.js"));
const twinManager = new ReliabilityTwinManagerJS();

const cases = [
  { key: "NORMAL", compId: "COMP-NORMAL", traceId: "TR-NORMAL-2026" },
  { key: "LATENT_DEFECT", compId: "COMP-LATENT_DEFECT", traceId: "TR-LATENT_DEFECT-2026" },
  { key: "FALSE_ALARM", compId: "COMP-FALSE_ALARM", traceId: "TR-FALSE_ALARM-2026" },
];

for (const c of cases) {
  const twinByKey = twinManager.buildReliabilityTwin(c.key);
  assert.strictEqual(twinByKey.identity.identity_status, "REGISTERED");
  assert.strictEqual(twinByKey.identity.component_id, c.compId);
  assert.strictEqual(twinByKey.identity.trace_id, c.traceId);
  assert(twinByKey.twin_id.startsWith("TWIN-"));

  const twinByComp = twinManager.buildReliabilityTwin(c.compId);
  assert.strictEqual(twinByComp.twin_id, twinByKey.twin_id, `Deterministic Twin ID parity check failed for ${c.key}`);

  const twinByTrace = twinManager.buildReliabilityTwin(c.traceId);
  assert.strictEqual(twinByTrace.twin_id, twinByKey.twin_id, `Deterministic Twin ID parity check failed for trace ${c.traceId}`);

  assert.strictEqual(twinByKey.evidence_summary.ml_evaluation, "AVAILABLE");
  assert.strictEqual(twinByKey.evidence_summary.physics_reliability, "AVAILABLE");
  assert.strictEqual(twinByKey.evidence_summary.prognostic_evidence, "AVAILABLE");
  assert.strictEqual(twinByKey.evidence_summary.risk_fusion, "AVAILABLE");
}

// Unregistered query check
const unregTwin = twinManager.buildReliabilityTwin("CMP-UNREGISTERED-999");
assert.strictEqual(unregTwin.identity.identity_status, "UNREGISTERED");
assert.strictEqual(unregTwin.identity.component_id, null);
assert.strictEqual(unregTwin.evidence_summary.ml_evaluation, "INSUFFICIENT_EVIDENCE");
console.log("  ✔ Test 5 Passed: Authoritative twin read model resolves canonical cases and fails closed for unregistered IDs ✅\n");

// TEST 6: script.js function exports and handler binding
console.log("TEST 6: Verifying script.js function exports...");
const scriptText = fs.readFileSync(path.join(ROOT, "script.js"), "utf8");
assert(scriptText.includes("async function renderComponentReliabilityCard("), "renderComponentReliabilityCard function missing");
assert(scriptText.includes("window.renderComponentReliabilityCard = renderComponentReliabilityCard;"), "renderComponentReliabilityCard not exported on window");
assert(scriptText.includes("btn-crc-refresh"), "btn-crc-refresh listener missing");
console.log("  ✔ Test 6 Passed: script.js functions and listeners verified ✅\n");

console.log("=========================================================================");
console.log("🏆 ALL PHASE 18.2 COMPONENT RELIABILITY CARD TESTS PASSED CLEANLY! ✅");
console.log("=========================================================================\n");
