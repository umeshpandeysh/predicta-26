const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../frontend/index.html');
const cssPath = path.join(__dirname, '../frontend/style.css');

const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

console.log("=== MOBILE DOM & CSS INTEGRITY AUDIT ===");

// 1. Check for inline grid-template-columns
const inlineGridMatches = [...html.matchAll(/style="[^"]*grid-template-columns:[^"]*"/g)];
console.log(`\nFound ${inlineGridMatches.length} inline grid-template-columns in index.html:`);
inlineGridMatches.forEach((m, i) => {
  console.log(`  [${i+1}] ${m[0].substring(0, 80)}...`);
});

// 2. Verify global mobile override rule exists in style.css
const hasGlobalGridOverride = css.includes('*[style*="grid-template-columns"]');
console.log(`\nGlobal inline grid mobile override in CSS: ${hasGlobalGridOverride ? "✅ PRESENT" : "❌ MISSING"}`);

// 3. Verify min-width: 0 on cards & flex descendants
const hasMinWidthZero = css.includes('min-width: 0 !important;');
console.log(`Card min-width: 0 rule in CSS: ${hasMinWidthZero ? "✅ PRESENT" : "❌ MISSING"}`);

// 4. Verify table-container overflow-x: auto
const hasTableContainerOverflow = css.includes('.table-container') && css.includes('overflow-x: auto');
console.log(`Table container overflow-x: auto rule in CSS: ${hasTableContainerOverflow ? "✅ PRESENT" : "❌ MISSING"}`);

// 5. Verify chart-container responsive rules
const hasChartContainerOverflow = css.includes('.chart-container') && css.includes('overflow: hidden');
console.log(`Chart container overflow: hidden rule in CSS: ${hasChartContainerOverflow ? "✅ PRESENT" : "❌ MISSING"}`);

// 6. Check all sections in index.html
const pageIds = [
  "page-home", "page-component", "page-anomaly", 
  "page-drift", "page-decision", "page-datasets", "page-reports", "page-spatial"
];

console.log("\nChecking Section Wrappers & DOM IDs:");
pageIds.forEach(id => {
  const exists = html.includes(`id="${id}"`);
  console.log(`  Section #${id}: ${exists ? "✅ Present" : "❌ MISSING"}`);
});

console.log("\nAudit finished successfully.");
