/**
 * PREDICTA-26 — Comprehensive Frontend Dashboard & E2E Integration Audit
 * File: tests/test_dashboard_e2e_forensics.js
 */

const fs = require('fs');
const path = require('path');
const inferenceService = require('../src/api/inference');

console.log("=========================================================================");
console.log("PREDICTA-26 — DASHBOARD ↔ API ↔ ML END-TO-END FORENSIC VERIFICATION");
console.log("=========================================================================\n");

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');

// 1. Audit Forms
const formMatches = [...html.matchAll(/<form\s+[^>]*id=["']([^"']+)["']/gi)].map(m => m[1]);
console.log("1. FORMS IN index.html:", formMatches);

// 2. Audit all getElementById calls in script.js vs index.html
const jsIdMatches = [...new Set([...js.matchAll(/getElementById\(["']([^"']+)["']\)/g)].map(m => m[1]))];
const htmlIdMatches = new Set([...html.matchAll(/id=["']([^"']+)["']/gi)].map(m => m[1]));

const missingInHtml = jsIdMatches.filter(id => !htmlIdMatches.has(id));
console.log(`\n2. DOM ID AUDIT: Total JS IDs=${jsIdMatches.length}, Total HTML IDs=${htmlIdMatches.size}`);
console.log(`   Missing IDs in HTML (${missingInHtml.length}):`, missingInHtml);

// 3. Inspect Form Inputs for Each Form
formMatches.forEach(formId => {
  const formRegex = new RegExp(`<form\\s+[^>]*id=["']${formId}["'][\\s\\S]*?<\\/form>`, 'i');
  const match = html.match(formRegex);
  if (match) {
    const formHtml = match[0];
    const inputs = [...formHtml.matchAll(/<(?:input|select|textarea)\s+[^>]*id=["']([^"']+)["']/gi)].map(m => m[1]);
    console.log(`\n3. Form #${formId} inputs (${inputs.length}):`, inputs);
  }
});
