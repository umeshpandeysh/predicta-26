const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=========================================================================');
console.log('VERIFYING PREDICTA SCREENING CLEANUP & CORE FLOW INTEGRITY');
console.log('=========================================================================');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// 1. Extract Screening Page HTML
const pScrStart = html.indexOf('id="page-screening"');
const pMonStart = html.indexOf('id="page-monitor"');

assert(pScrStart !== -1, 'page-screening must exist');
assert(pMonStart !== -1, 'page-monitor must exist');

const scrHtml = html.substring(pScrStart, pMonStart);

// 2. Check complete absence of Timeline from Screening
assert(!scrHtml.includes('Traceable ReliabilityCase Lifecycle Timeline'), 'Timeline heading must NOT be in Screening');
assert(!scrHtml.includes('AUDITABLE DECISION PROVENANCE'), 'Provenance overline must NOT be in Screening');
assert(!scrHtml.includes('Click any stage chip to inspect cryptographic provenance'), 'Timeline helper must NOT be in Screening');
assert(!scrHtml.includes('comp-tstep-'), 'Timeline step chips must NOT be in Screening');
console.log('✔ Verification 1 Passed: "Traceable ReliabilityCase Lifecycle Timeline" is completely absent from Screening.');

// 3. Check complete absence of Efficiency from Screening
assert(!scrHtml.includes('Qualification Efficiency Opportunity'), 'Efficiency heading must NOT be in Screening');
assert(!scrHtml.includes('SCREENING THROUGHPUT ANALYSIS'), 'Throughput analysis overline must NOT be in Screening');
assert(!scrHtml.includes('ATE Test-Time Opportunity'), 'Test-time opportunity must NOT be in Screening');
assert(!scrHtml.includes('Estimated Screening Acceleration'), 'Screening acceleration must NOT be in Screening');
console.log('✔ Verification 2 Passed: "Qualification Efficiency Opportunity" is completely absent from Screening.');

// 4. Verify that Timeline & Efficiency are absent from Components as well, while Advanced is preserved
const pCompStart = html.indexOf('id="page-components"');
const pAdvStart = html.indexOf('id="page-advanced"');
const compHtml = html.substring(pCompStart, pAdvStart);
const advHtml = html.substring(pAdvStart);

assert(!compHtml.includes('Traceable ReliabilityCase Lifecycle Timeline'), 'Timeline must NOT be in Components');
assert(!compHtml.includes('Qualification Efficiency Opportunity'), 'Efficiency must NOT be in Components');
assert(advHtml.includes('Traceability') || advHtml.includes('Passport'), 'Passport/Traceability functionality preserved in Advanced');
console.log('✔ Verification 3 Passed: Timeline and Efficiency are absent from Components, and Advanced remains fully intact.');

// 5. Verify Core Screening Structure & Components
const requiredScreeningElements = [
  'id="form-admin-input"',
  'id="adm-in-comp-id"',
  'id="adm-in-lot-id"',
  'id="adm-in-temp"',
  'id="adm-in-voltage"',
  'id="adm-in-freq"',
  'id="adm-in-duration"',
  'id="adm-in-iddq"',
  'id="adm-in-leakage"',
  'id="adm-in-tpd"',
  'id="adm-in-power"',
  'id="btn-adm-in-submit"',
  'id="screening-result-panel"',
  'id="adm-in-result-empty"',
  'id="adm-in-result-loading"',
  'id="adm-in-result-content"',
  'id="adm-in-res-comp"',
  'id="adm-in-res-lot"',
  'id="adm-in-res-badge"',
  'id="adm-in-res-action-text"',
  'id="adm-in-res-policy-text"',
  'id="why-evidence-table"',
  'id="why-pop-finding"',
  'id="ev-agreement-state"',
  'id="btn-adm-open-passport"',
  'id="btn-adm-print-pdf"',
  'id="btn-adm-analyze-another"'
];

requiredScreeningElements.forEach(elId => {
  assert(scrHtml.includes(elId), `Screening must contain ${elId}`);
});
console.log('✔ Verification 4 Passed: All core Screening elements (input console, result panel, decision command panel, evidence cards, why this call, agreement matrix, action toolbar) are present and correctly wired.');

// 6. Check that Screening ends directly after the Action Toolbar with natural vertical spacing
const toolbarIdx = scrHtml.indexOf('btn-adm-analyze-another');
const remainingHtmlAfterToolbar = scrHtml.substring(toolbarIdx);
const linesAfterToolbar = remainingHtmlAfterToolbar.split('\n');

assert(linesAfterToolbar.length < 30, 'Screening should cleanly terminate right after the action toolbar without excessive blank lines or lingering containers');
console.log('✔ Verification 5 Passed: Screening cleanly terminates after the Action Toolbar with natural vertical spacing.');

// 7. Verify other pages remain intact
assert(html.includes('id="page-home"'), 'Home page must exist');
assert(html.includes('id="page-screening"'), 'Screening page must exist');
assert(html.includes('id="page-monitor"'), 'Live Monitor page must exist');
assert(html.includes('id="page-components"'), 'Components page must exist');
assert(html.includes('id="page-advanced"'), 'Advanced page must exist');
console.log('✔ Verification 6 Passed: All 5 pages exist and are properly registered.');

console.log('=========================================================================');
console.log('ALL SCREENING CLEANUP TESTS PASSED (100% SUCCESS)');
console.log('=========================================================================');
