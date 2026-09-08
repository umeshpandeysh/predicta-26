const fs = require('fs');
const path = require('path');

console.log("=========================================================================");
console.log("PREDICTA - ADMIN FORM RESET & ANALYZE ANOTHER COMPONENT CONTRACT TEST SUITE");
console.log("=========================================================================\n");

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`✔ Test ${totalTests.toString().padStart(2, '0')} Passed: ${message}`);
    passedTests++;
  } else {
    console.error(`✖ Test ${totalTests.toString().padStart(2, '0')} FAILED: ${message}`);
    process.exit(1);
  }
}

// 1. Static HTML Audit
const htmlPath = path.join(__dirname, '../frontend/index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

assert(htmlContent.includes('id="btn-adm-clear-form"'), 'HTML contains Clear Form button ID btn-adm-clear-form');
assert(htmlContent.includes('id="btn-adm-analyze-another"'), 'HTML contains Analyze Another Component button ID btn-adm-analyze-another');

// 2. JavaScript Code Audit
const scriptPath = path.join(__dirname, '../frontend/script.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf-8');

assert(scriptContent.includes('function resetAdminQualificationWorkflow()'), 'frontend/script.js defines function resetAdminQualificationWorkflow()');
assert(scriptContent.includes("window.resetAdminQualificationWorkflow = resetAdminQualificationWorkflow"), 'frontend/script.js exports window.resetAdminQualificationWorkflow');
assert(scriptContent.includes("window.startNewComponentAnalysis = resetAdminQualificationWorkflow"), 'frontend/script.js exports window.startNewComponentAnalysis');
assert(scriptContent.includes("window.clearAdminForm = resetAdminQualificationWorkflow"), 'frontend/script.js exports window.clearAdminForm');
assert(scriptContent.includes("window.resetAdminDataEntryForm = resetAdminQualificationWorkflow"), 'frontend/script.js exports window.resetAdminDataEntryForm');
assert(scriptContent.includes('document.addEventListener("click"'), 'frontend/script.js implements global document click delegation');
assert(scriptContent.includes('target.closest("#btn-adm-clear-form'), 'Click delegate targets #btn-adm-clear-form');
assert(scriptContent.includes('target.closest("#btn-adm-analyze-another'), 'Click delegate targets #btn-adm-analyze-another');

// 3. Functional Execution Simulation in Mock DOM
const elements = {};
function createMockElement(id, type = "div", initialValue = "") {
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

const formEl = createMockElement("form-admin-input", "form");
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

createMockElement("adm-in-comp-id", "input", "COMP-DIRTY");
createMockElement("adm-in-device-id", "input", "DEV-DIRTY");
createMockElement("adm-in-lot-id", "input", "LOT-DIRTY");
createMockElement("adm-in-wafer-id", "input", "WFR-DIRTY");
createMockElement("adm-in-equipment", "input", "EQP-DIRTY");
createMockElement("adm-in-type", "input", "TYPE-DIRTY");

createMockElement("adm-in-temp", "input", "95.5");
createMockElement("adm-in-voltage", "input", "1.9");
createMockElement("adm-in-freq", "input", "3200");
createMockElement("adm-in-duration", "input", "24");
createMockElement("adm-in-iddq", "input", "50");
createMockElement("adm-in-leakage", "input", "300");
createMockElement("adm-in-tpd", "input", "22");
createMockElement("adm-in-power", "input", "150");

createMockElement("adm-in-result-empty");
createMockElement("adm-in-result-content");
createMockElement("adm-in-res-id");
createMockElement("adm-in-res-badge");
createMockElement("adm-in-res-prob");
createMockElement("adm-in-res-decision");
createMockElement("adm-in-res-state");
createMockElement("adm-in-res-rationale");

global.window = {
  currentPrediction: { test: 123 },
  currentResult: { test: 456 },
  lastApiResponse: { test: 789 }
};

global.document = {
  getElementById: (id) => elements[id] || null,
  addEventListener: () => {}
};

// Evaluate the resetAdminQualificationWorkflow logic function
const funcMatch = scriptContent.match(/function resetAdminQualificationWorkflow\(\) \{([\s\S]*?)\n  \}/);
assert(funcMatch !== null, "Successfully extracted resetAdminQualificationWorkflow function body");

const fn = new Function('window', 'document', 'console', 'setTimeout', funcMatch[1]);
fn(global.window, global.document, console, (cb) => cb());

assert(global.window.currentPrediction === null, "window.currentPrediction reset to null");
assert(global.window.currentResult === null, "window.currentResult reset to null");
assert(global.window.lastApiResponse === null, "window.lastApiResponse reset to null");

assert(elements["adm-in-result-empty"].style.display === "block", "adm-in-result-empty display set to 'block'");
assert(elements["adm-in-result-content"].style.display === "none", "adm-in-result-content display set to 'none'");

assert(elements["adm-in-comp-id"].value === "", "Component ID reset to empty string ''");
assert(elements["adm-in-lot-id"].value === "", "Lot ID reset to empty string ''");
assert(elements["adm-in-wafer-id"].value === "", "Wafer ID reset to empty string ''");
assert(elements["adm-in-equipment"].value === "", "Equipment ID reset to empty string ''");

assert(elements["adm-in-temp"].value === "0", "Temperature reset to '0'");
assert(elements["adm-in-voltage"].value === "0", "Voltage reset to '0'");
assert(elements["adm-in-freq"].value === "0", "Frequency reset to '0'");
assert(elements["adm-in-leakage"].value === "0", "Leakage Current reset to '0'");

console.log("\n=========================================================================");
console.log(`ALL ${totalTests}/${totalTests} RESET & ANALYZE ANOTHER COMPONENT TESTS PASSED! ✅`);
console.log("=========================================================================");
