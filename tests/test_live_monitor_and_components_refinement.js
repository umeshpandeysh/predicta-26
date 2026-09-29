const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=========================================================================');
console.log('VERIFYING PREDICTA LIVE MONITOR & COMPONENTS REFINEMENT SUITE');
console.log('=========================================================================');

// 1. Verify index.html & frontend/index.html
const rootHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const frontendHtml = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'index.html'), 'utf8');

assert.strictEqual(rootHtml, frontendHtml, 'Root index.html and frontend/index.html must be identical');

console.log('✔ HTML Synchronization Check passed.');

// 2. Verify Breadcrumbs removed from both pages
assert(!rootHtml.includes('PREDICTA</span> / <span class="active-crumb">Live Monitor'), 'Live Monitor breadcrumb must be removed');
assert(!rootHtml.includes('PREDICTA</span> / <span class="active-crumb">Components'), 'Components breadcrumb must be removed');
console.log('✔ Breadcrumb Removal Check passed (both Live Monitor and Components have zero breadcrumbs).');

// 3. Verify Identity-only options in selectors
assert(rootHtml.includes('<option value="DIE-R20C20">DIE-R20C20 — LOT-SYN-048</option>'), 'Monitor selector must have identity-only option');
assert(!rootHtml.includes('DIE-R20C20 (LOT-SYN-048) — REJECT'), 'Monitor selector must NOT contain REJECT label');
assert(!rootHtml.includes('DIE-R12C08 (LOT-SYN-045) — MONITOR'), 'Monitor selector must NOT contain MONITOR label');
assert(!rootHtml.includes('DIE-R08C19 (LOT-SYN-043) — PASS'), 'Monitor selector must NOT contain PASS label');
console.log('✔ Identity-Only Selector Options Check passed.');

// 4. Verify Components Hierarchy
const compStart = rootHtml.indexOf('id="page-components"');
const compEnd = rootHtml.indexOf('id="page-advanced"');
const compSection = rootHtml.substring(compStart, compEnd);

const idxDossier = compSection.indexOf('id="component-identity-dossier-card"');
const idxTelemetry = compSection.indexOf('id="component-telemetry-stream-card"');
const idxEvidence = compSection.indexOf('id="component-reliability-evidence-card"');
const idxTimeline = compSection.indexOf('id="component-timeline-section"');
const idxEfficiency = compSection.indexOf('id="component-qualification-efficiency-panel"');
const idxQueue = compSection.indexOf('id="component-investigation-queue-container"');
const idxTable = compSection.indexOf('id="components-inventory-table"');

assert(idxDossier !== -1, 'Component Identity Dossier card must exist');
assert(idxTelemetry !== -1, 'Component Telemetry Stream card must exist');
assert(idxEvidence !== -1, 'Component Reliability Evidence card must exist');
assert(idxTimeline !== -1, 'Component Timeline section must exist');
assert(idxEfficiency !== -1, 'Qualification Efficiency panel must exist');
assert(idxQueue !== -1, 'Investigation Queue container must exist');
assert(idxTable !== -1, 'Components Inventory Table must exist');

// Assert strict hierarchy ordering: Dossier (1st) -> Telemetry (2nd) -> Evidence (3rd) -> Timeline (4th) -> Efficiency/Queue/Table (5th)
assert(idxDossier < idxTelemetry, 'Hierarchy error: Dossier must appear before Telemetry');
assert(idxTelemetry < idxEvidence, 'Hierarchy error: Telemetry must appear before Evidence');
assert(idxEvidence < idxTimeline, 'Hierarchy error: Evidence must appear before Timeline');
assert(idxTimeline < idxEfficiency, 'Hierarchy error: Timeline must appear before Efficiency panel');
assert(idxEfficiency < idxQueue, 'Hierarchy error: Efficiency panel must appear before Investigation Queue');
assert(idxQueue < idxTable, 'Hierarchy error: Investigation Queue must appear before Inventory Table');

console.log('✔ Components Information Flow & Hierarchy Check passed (1: Dossier -> 2: Telemetry -> 3: Evidence -> 4: Timeline -> 5: Population Ledger).');

// 5. Verify 12-Stage Timeline Stepper Elements in HTML
for (let s = 1; s <= 12; s++) {
  assert(compSection.includes(`id="comp-tstep-${s}"`), `Timeline chip comp-tstep-${s} must exist in Components HTML`);
}
assert(compSection.includes('id="component-timeline-detail-drawer"'), 'component-timeline-detail-drawer must exist');
console.log('✔ 12-Stage Timeline Stepper markup Check passed.');

// 6. Verify Script Controller Implementations
const scriptCode = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

// Check canonical data dictionary
assert(scriptCode.includes('CANONICAL_COMPONENTS_DATA'), 'CANONICAL_COMPONENTS_DATA must be defined in script.js');

// Check controllers
assert(scriptCode.includes('window.renderComponentVsLotChart'), 'renderComponentVsLotChart must be defined');
assert(scriptCode.includes('window.switchCompVsLotMetric'), 'switchCompVsLotMetric must be defined');
assert(scriptCode.includes('window.handleMonitorComponentChange'), 'handleMonitorComponentChange must be defined');
assert(scriptCode.includes('window.handleComponentDossierChange'), 'handleComponentDossierChange must be defined');
assert(scriptCode.includes('window.selectComponentTimelineStage'), 'selectComponentTimelineStage must be defined');
assert(scriptCode.includes('window.filterInvestigationQueue'), 'filterInvestigationQueue must be defined');
assert(scriptCode.includes('window.filterComponentsTable'), 'filterComponentsTable must be defined');

console.log('✔ Script Controllers Check passed.');

// 7. Test Script Execution in Sandbox DOM
const domContext = {
  window: {},
  document: {
    addEventListener: () => {},
    querySelectorAll: () => [],
    getElementById: (id) => ({
      style: {},
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      setAttribute: () => {},
      getAttribute: () => '',
      textContent: '',
      innerHTML: ''
    })
  },
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
  console: console
};

// Evaluate the script in a mock environment to verify no syntax errors or execution crashes
try {
  const vm = require('vm');
  const context = vm.createContext(domContext);
  vm.runInContext(scriptCode, context);
  console.log('✔ Script VM Execution & Syntax Check passed.');
} catch (e) {
  console.error('VM Execution Error:', e);
  process.exit(1);
}

// 8. Test Data Accuracy for 10 Canonical Dies
const compData = domContext.window.CANONICAL_COMPONENTS_DATA;
assert(compData, 'CANONICAL_COMPONENTS_DATA must exist on window');
const requiredDies = [
  'DIE-R20C20', 'DIE-R05C12', 'DIE-R12C08', 'DIE-R15C15', 'DIE-R02C14',
  'DIE-R08C08', 'DIE-R16C04', 'DIE-R09C11', 'DIE-R05C05', 'DIE-R00C00'
];

requiredDies.forEach(dieId => {
  const d = compData[dieId];
  assert(d, `Die ${dieId} must exist in CANONICAL_COMPONENTS_DATA`);
  assert(d.lot, `Die ${dieId} must have lot`);
  assert(d.pkg, `Die ${dieId} must have pkg`);
  assert(d.telemetry, `Die ${dieId} must have telemetry`);
  assert(d.module_a, `Die ${dieId} must have module_a`);
  assert(d.module_b, `Die ${dieId} must have module_b`);
  assert(d.latent_risk, `Die ${dieId} must have latent_risk`);
  assert(d.physics, `Die ${dieId} must have physics`);
  assert(d.validation, `Die ${dieId} must have validation metrics`);
});
console.log(`✔ All ${requiredDies.length} canonical dies verified with complete multi-evidence datasets.`);

// 9. Verify Temporal Provenance for Unrecorded Stages
const testEl = { innerHTML: '', textContent: '', classList: { add: () => {}, remove: () => {} } };
const mockDoc = {
  getElementById: (id) => testEl,
  querySelectorAll: () => []
};
domContext.document = mockDoc;

[7, 8, 10].forEach(unrecordedStage => {
  domContext.window.selectComponentTimelineStage(unrecordedStage);
  assert(testEl.innerHTML.includes('DATA UNAVAILABLE'), `Stage ${unrecordedStage} must report DATA UNAVAILABLE`);
});
console.log('✔ Temporal Provenance Check passed (Stages 7, 8, 10 strictly report DATA UNAVAILABLE).');

console.log('=========================================================================');
console.log('ALL VERIFICATION CHECKS PASSED (100% SUCCESS)');
console.log('=========================================================================');
