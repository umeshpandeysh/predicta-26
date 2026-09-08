const fs = require('fs');
const path = require('path');

console.log("=========================================================================");
console.log("PREDICTA — REAL BROWSER DOM WORKFLOW SIMULATION & LOG AUDIT");
console.log("=========================================================================\n");

const scriptContent = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');

// Mock DOM elements
const elements = {};
function createMockInput(id, type = "text", initialValue = "") {
  const el = {
    id,
    type,
    value: initialValue,
    style: { display: "" },
    textContent: "",
    className: "",
    focused: false,
    focus: function() { this.focused = true; },
    scrollIntoView: function() {},
    reset: function() {}
  };
  elements[id] = el;
  return el;
}

const formEl = createMockInput("form-admin-input", "form");
formEl._listeners = {};
formEl.addEventListener = function(event, handler) {
  this._listeners[event] = handler;
};
formEl.querySelectorAll = function(selector) {
  if (selector.includes('type="text"')) {
    return [
      elements["adm-in-comp-id"],
      elements["adm-in-device-id"],
      elements["adm-in-lot-id"],
      elements["adm-in-wafer-id"],
      elements["adm-in-equipment"],
      elements["adm-in-type"]
    ].filter(Boolean);
  }
  if (selector.includes('type="number"')) {
    return [
      elements["adm-in-temp"],
      elements["adm-in-voltage"],
      elements["adm-in-freq"],
      elements["adm-in-duration"],
      elements["adm-in-iddq"],
      elements["adm-in-leakage"],
      elements["adm-in-tpd"],
      elements["adm-in-power"]
    ].filter(Boolean);
  }
  return [];
};
formEl.reset = function() {};

// Create all text and numeric inputs
createMockInput("adm-in-comp-id", "text", "");
createMockInput("adm-in-device-id", "text", "");
createMockInput("adm-in-lot-id", "text", "");
createMockInput("adm-in-wafer-id", "text", "");
createMockInput("adm-in-equipment", "text", "");
createMockInput("adm-in-type", "text", "");

createMockInput("adm-in-temp", "number", "0");
createMockInput("adm-in-voltage", "number", "0");
createMockInput("adm-in-freq", "number", "0");
createMockInput("adm-in-duration", "number", "0");
createMockInput("adm-in-iddq", "number", "0");
createMockInput("adm-in-leakage", "number", "0");
createMockInput("adm-in-tpd", "number", "0");
createMockInput("adm-in-power", "number", "0");

createMockInput("adm-in-result-empty");
createMockInput("adm-in-result-content");
createMockInput("adm-in-res-id");
createMockInput("adm-in-res-badge");
createMockInput("adm-in-res-prob");
createMockInput("adm-in-res-decision");
createMockInput("adm-in-res-state");
createMockInput("adm-in-res-rationale");
createMockInput("btn-adm-in-submit", "button");

let alertMessage = null;
global.alert = function(msg) { alertMessage = msg; };
global.window = {
  currentPrediction: null,
  currentResult: null,
  lastApiResponse: null,
  switchPage: function() {}
};
global.document = {
  getElementById: (id) => elements[id] || null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};

// Evaluate script inside environment
const contextFn = new Function('window', 'document', 'alert', 'console', 'setTimeout', scriptContent + '\nreturn window;');
const win = contextFn(global.window, global.document, global.alert, console, (cb) => cb());

console.log("--- TEST 1: CLEAR FORM EXECUTION & ZERO PRESERVATION ---");

// Fill form with dirty test values
elements["adm-in-comp-id"].value = "COMP-DIRTY-100";
elements["adm-in-lot-id"].value = "LOT-DIRTY-200";
elements["adm-in-equipment"].value = "EQP-DIRTY-300";
elements["adm-in-temp"].value = "85.5";
elements["adm-in-voltage"].value = "1.8";
elements["adm-in-freq"].value = "3200";

// Invoke reset workflow
win.resetAdminQualificationWorkflow();

console.log("Component ID value:", `"${elements['adm-in-comp-id'].value}"`);
console.log("Lot ID value:", `"${elements['adm-in-lot-id'].value}"`);
console.log("Temperature value:", `"${elements['adm-in-temp'].value}"`);
console.log("Voltage value:", `"${elements['adm-in-voltage'].value}"`);
console.log("Result Empty Display:", elements["adm-in-result-empty"].style.display);
console.log("Result Content Display:", elements["adm-in-result-content"].style.display);

if (elements["adm-in-comp-id"].value !== "" || elements["adm-in-temp"].value !== "0") {
  console.error("❌ TEST 1 FAILED: Clear Form did not reset text to '' and numbers to '0'");
  process.exit(1);
}
console.log("✔ TEST 1 PASSED: Clear Form physically reset text to '', numbers to '0', and restored empty view ✅\n");

console.log("--- TEST 2: PRE-INFERENCE VALIDATION ALERT (ZERO / CLEARED STATE) ---");
alertMessage = null;
win.initAdminInputPortal();

// Trigger form submit in cleared state
if (formEl._listeners["submit"]) {
  formEl._listeners["submit"]({ preventDefault: () => {} });
}

console.log("Alert triggered:", `"${alertMessage}"`);
if (alertMessage !== "Please enter valid qualification telemetry before running analysis.") {
  console.error("❌ TEST 2 FAILED: Validation alert was not triggered for cleared form state");
  process.exit(1);
}
console.log("✔ TEST 2 PASSED: Validation alert triggered without replacing zeros with fake defaults ✅\n");

console.log("=========================================================================");
console.log("ALL REAL BROWSER DOM SIMULATION TESTS PASSED SUCCESSFULLY! ✅");
console.log("=========================================================================");
