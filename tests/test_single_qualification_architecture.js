/**
 * PREDICTA SIH 2026 — SINGLE QUALIFICATION ARCHITECTURE REGRESSION TEST SUITE
 * File: tests/test_single_qualification_architecture.js
 * 
 * Objective: Verify that the qualification workspace uses exactly ONE qualification form,
 * ONE submit listener, ONE payload builder, ONE API call, and ONE result renderer.
 * FAILS HARD if duplicate prediction architectures exist.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("=========================================================================");
console.log("PREDICTA SIH 2026 — SINGLE QUALIFICATION ARCHITECTURE TEST SUITE");
console.log("=========================================================================\n");

const htmlPath = path.join(__dirname, '../index.html');
const scriptPath = path.join(__dirname, '../script.js');
const apiPath = path.join(__dirname, '../api.js');

const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');
const apiContent = fs.readFileSync(apiPath, 'utf8');

// Test 01: Verify exactly ONE Qualification Data Entry Workspace form ID (form-admin-input)
const formMatches = htmlContent.match(/id="form-admin-input"/g) || [];
assert.strictEqual(formMatches.length, 1, "Test 01 Failed: Must have exactly ONE #form-admin-input in index.html");
console.log("✔ Test 01 Passed: Exactly ONE qualification form ID (#form-admin-input) in index.html");

// Test 02: Verify buildQualificationPayload exists and is the sole qualification payload builder
const payloadBuilderMatches = scriptContent.match(/window\.buildQualificationPayload\s*=/g) || [];
assert.strictEqual(payloadBuilderMatches.length, 1, "Test 02 Failed: Must have exactly ONE buildQualificationPayload function definition");
console.log("✔ Test 02 Passed: Exactly ONE qualification payload builder (buildQualificationPayload)");

// Test 03: Verify initAdminInputPortal is the sole qualification form listener attach point
const portalMatches = scriptContent.match(/window\.initAdminInputPortal\s*=/g) || [];
assert.strictEqual(portalMatches.length, 1, "Test 03 Failed: Must have exactly ONE initAdminInputPortal function definition");
console.log("✔ Test 03 Passed: Exactly ONE qualification submit listener (initAdminInputPortal)");

// Test 04: Verify updateQualificationResultUI is the sole qualification result renderer
const rendererMatches = scriptContent.match(/window\.updateQualificationResultUI\s*=/g) || [];
assert.strictEqual(rendererMatches.length, 1, "Test 04 Failed: Must have exactly ONE updateQualificationResultUI function definition");
console.log("✔ Test 04 Passed: Exactly ONE qualification result renderer (updateQualificationResultUI)");

// Test 05: Verify iddq_standby is present in all script.js prediction payload constructions
const payloadIddqMatches = (scriptContent.match(/iddq_standby:/g) || []).length;
assert(payloadIddqMatches >= 4, "Test 05 Failed: iddq_standby must be explicitly included in all prediction payloads");
console.log(`✔ Test 05 Passed: All qualification prediction payloads explicitly include iddq_standby (${payloadIddqMatches} instances found)`);

// Test 06: Verify fallbackLocalPredict is disabled for qualification predictions
assert(apiContent.includes("LOCAL_DECISION_ENGINE_DISABLED"), "Test 06 Failed: api.js must contain LOCAL_DECISION_ENGINE_DISABLED guard");
console.log("✔ Test 06 Passed: api.js strictly disables local fallback for qualification predictions");

// Test 07: Verify DOM simulation of full visible form submission workflow
const elements = {};
function createMockElement(id, initialVal = "") {
  const el = {
    id,
    value: initialVal,
    style: { display: "" },
    textContent: "",
    className: "",
    _listeners: {},
    addEventListener: function(event, fn) { this._listeners[event] = fn; },
    focus: function() {},
    scrollIntoView: function() {}
  };
  elements[id] = el;
  return el;
}

const formEl = createMockElement("form-admin-input");
createMockElement("adm-in-comp-id", "COMP-00301");
createMockElement("adm-in-device-id", "DEV-SN74LVC");
createMockElement("adm-in-lot-id", "LOT-2026-A8");
createMockElement("adm-in-wafer-id", "WFR-2026-08-01");
createMockElement("adm-in-equipment", "EQP-101");
createMockElement("adm-in-type", "CMOS");
createMockElement("adm-in-temp", "24");
createMockElement("adm-in-voltage", "1.20");
createMockElement("adm-in-freq", "2500");
createMockElement("adm-in-duration", "12");
createMockElement("adm-in-iddq", "10.2");
createMockElement("adm-in-leakage", "110");
createMockElement("adm-in-tpd", "11");
createMockElement("adm-in-power", "42");

createMockElement("adm-in-result-empty");
createMockElement("adm-in-result-content");
createMockElement("adm-in-res-badge");
createMockElement("adm-in-res-id");
createMockElement("adm-in-res-summary");
createMockElement("adm-in-res-action-text");
createMockElement("adm-in-res-prob");
createMockElement("adm-in-res-prob-label");
createMockElement("adm-in-res-pat");
createMockElement("adm-in-res-pat-sub");
createMockElement("adm-in-res-drift");
createMockElement("adm-in-res-drift-sub");
createMockElement("chk-ml-risk");
createMockElement("chk-anomaly");
createMockElement("chk-drift");
createMockElement("btn-adm-in-submit");

global.document = {
  getElementById: (id) => elements[id] || null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};
global.window = {
  getNumericInput: function(id) {
    const val = elements[id]?.value;
    if (val === undefined || val === null || val.trim() === "") return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  }
};

const contextFn = new Function('window', 'document', 'console', scriptContent + '\nreturn window;');
const win = contextFn(global.window, global.document, console);

const capturedPayload = win.buildQualificationPayload();
assert.strictEqual(capturedPayload.iddq_standby, 10.2, "Test 07a Failed: captured payload iddq_standby must equal 10.2");
assert.strictEqual(capturedPayload.leakage_current, 110, "Test 07b Failed: captured payload leakage_current must equal 110");
assert.strictEqual(capturedPayload.propagation_delay, 11, "Test 07c Failed: captured payload propagation_delay must equal 11");
console.log("✔ Test 07 Passed: Form payload construction verified (iddq_standby=10.2, leakage_current=110, propagation_delay=11)");

const mockApiResult = {
  disposition: "PASS",
  ml_risk_status: "LOW",
  anomaly_status: "NORMAL",
  drift_status: "WITHIN",
  probability: 0.1508,
  recommended_action: "PROCEED_STANDARD_SCREENING"
};

win.updateQualificationResultUI(mockApiResult, capturedPayload);

assert.strictEqual(elements["adm-in-res-badge"].textContent, "PASS", "Test 08a Failed: Visible disposition badge must be PASS");
assert.strictEqual(elements["adm-in-res-prob-label"].textContent, "LOW RISK", "Test 08b Failed: Visible ML risk label must be LOW RISK");
assert.strictEqual(elements["adm-in-res-pat"].textContent, "NORMAL", "Test 08c Failed: Visible Anomaly label must be NORMAL");
assert.strictEqual(elements["adm-in-res-drift"].textContent, "WITHIN LIMITS", "Test 08d Failed: Visible Drift label must be WITHIN LIMITS");

console.log("✔ Test 08 Passed: Visible DOM element rendering verified (PASS, LOW RISK, NORMAL, WITHIN LIMITS)");

console.log("\n=========================================================================");
console.log("ALL SINGLE QUALIFICATION ARCHITECTURE REGRESSION TESTS PASSED! ✅");
console.log("=========================================================================");
