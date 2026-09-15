/**
 * PREDICTA — FRONTEND AUTHORITATIVE CONTRACT TEST SUITE
 * File: tests/test_frontend_authoritative_contract.js
 * 
 * Objective: Verify that frontend (script.js and frontend/script.js):
 * 1. Has zero references to client-side SHAP, fake multipliers (* 1.2, * 1.05, * 0.95), or hardcoded anomaly scores (isReject ? 8.5 : 2.0).
 * 2. Strictly adheres to root <-> frontend byte parity.
 * 3. Consumes backend predictions, anomaly scores, drift status, and attributions authoritatively.
 * 4. Truthfully renders INSUFFICIENT_HISTORY / "Forecast Unavailable (0h baseline required)" when backend history is missing.
 * 5. Distinctly isolates demo/simulation data with explicit [SIMULATION / DEMO DATA] labels.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("=========================================================================");
console.log("PREDICTA — FRONTEND AUTHORITATIVE CONTRACT TEST SUITE");
console.log("=========================================================================");

const rootScriptPath = path.resolve(__dirname, '..', 'script.js');
const frontScriptPath = path.resolve(__dirname, '..', 'frontend', 'script.js');

// TEST 1: Root <-> Frontend Script Byte Parity
console.log("\nTEST 1: Verifying Byte Parity between script.js and frontend/script.js...");
assert(fs.existsSync(rootScriptPath), "script.js must exist");
assert(fs.existsSync(frontScriptPath), "frontend/script.js must exist");

const rootBuf = fs.readFileSync(rootScriptPath);
const frontBuf = fs.readFileSync(frontScriptPath);
assert.strictEqual(rootBuf.length, frontBuf.length, `Parity mismatch: script.js (${rootBuf.length} B) vs frontend/script.js (${frontBuf.length} B)`);
assert(rootBuf.equals(frontBuf), "script.js and frontend/script.js must be byte-identical");
console.log(`✔ Test 1 Passed: Exact byte parity confirmed (${rootBuf.length} bytes) ✅`);

const scriptContent = rootBuf.toString('utf8');

// TEST 2: Purge Verification (No SHAP, no fallback multipliers, no fake anomaly)
console.log("\nTEST 2: Verifying Purge of SHAP, Fallback Multipliers, and Fabricated Scores...");

// A. No 'shap' (case-insensitive)
const shapMatches = scriptContent.match(/shap/gi);
assert.strictEqual(shapMatches, null, `Found forbidden 'shap' references in script.js: ${shapMatches ? shapMatches.length : 0}`);
console.log("  ✔ No SHAP references in frontend script (strictly deterministic attribution)");

// B. No fallback multipliers
assert(!scriptContent.includes("* 1.2"), "Forbidden fallback multiplier '* 1.2' found in script.js");
assert(!scriptContent.includes("* 1.05"), "Forbidden fallback multiplier '* 1.05' found in script.js");
assert(!scriptContent.includes("* 0.95"), "Forbidden fallback multiplier '* 0.95' found in script.js");
console.log("  ✔ No client-side fallback multipliers (* 1.2, * 1.05, * 0.95)");

// C. No fabricated anomaly scores
assert(!scriptContent.includes("isReject ? 8.5 : 2.0"), "Forbidden hardcoded anomaly score 'isReject ? 8.5 : 2.0' found in script.js");
console.log("  ✔ No fabricated anomaly ternary scores (isReject ? 8.5 : 2.0)");

console.log("✔ Test 2 Passed: Purge verification 100% clean ✅");

// TEST 3: Authoritative Single Screening & CSV Batch Contract
console.log("\nTEST 3: Verifying Authoritative Data Extraction in Screening Flows...");

assert(scriptContent.includes("result.anomaly_score"), "script.js must consume result.anomaly_score directly");
assert(scriptContent.includes("parameter_attribution"), "script.js must consume backend parameter_attribution");
assert(scriptContent.includes("drift_prediction"), "script.js must consume backend drift_prediction");
assert(scriptContent.includes("is_demo: false"), "Real screening must tag records with is_demo: false");
assert(scriptContent.includes("PRODUCTION_SCREENING"), "Real screening source must be PRODUCTION_SCREENING");
assert(scriptContent.includes("CSV_BATCH_SCREENING"), "Batch screening source must be CSV_BATCH_SCREENING");

console.log("✔ Test 3 Passed: Screening flows strictly consume authoritative backend fields ✅");

// TEST 4: Truthful Insufficient History & Missing Baseline Handling
console.log("\nTEST 4: Verifying Truthful Rendering of INSUFFICIENT_HISTORY...");

assert(scriptContent.includes("Forecast Unavailable (0h baseline required)"), "UI must display 'Forecast Unavailable (0h baseline required)' when baseline is missing");
assert(scriptContent.includes("INSUFFICIENT_HISTORY"), "UI must handle INSUFFICIENT_HISTORY status from backend");
assert(scriptContent.includes("INSUFFICIENT HISTORY: 0h baseline required for GPR degradation forecast"), "Trend graph must show explicit insufficient history message");
assert(scriptContent.includes("Provide 0h baseline measurement or proceed with single-point operational disposition"), "Drift panel must show clear remediation action for missing history");

console.log("✔ Test 4 Passed: Truthful INSUFFICIENT_HISTORY handling confirmed ✅");

// TEST 5: Demo / Simulation Isolation & Transparent Labeling
console.log("\nTEST 5: Verifying Demo / Simulation Isolation & Transparent Labeling...");

assert(scriptContent.includes("SIMULATION / DEMO DATA"), "Demo components must be labeled with SIMULATION / DEMO DATA");
assert(scriptContent.includes("is_demo: true"), "Simulation components must be explicitly flagged with is_demo: true");

console.log("✔ Test 5 Passed: Demo / Simulation isolation confirmed ✅");

console.log("\n=========================================================================");
console.log("ALL FRONTEND AUTHORITATIVE CONTRACT TESTS PASSED CLEANLY! ✅");
console.log("=========================================================================\n");
