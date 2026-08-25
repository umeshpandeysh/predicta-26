// Dependency-free Node.js automated test runner for AIPS Console
const fs = require('fs');
const path = require('path');

console.log("Starting AIPS Frontend automated tests...\n");

let failures = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
    failures++;
  }
}

// 1. File existence validation
const indexHtmlPath = path.join(__dirname, '../index.html');
const styleCssPath = path.join(__dirname, '../style.css');
const scriptJsPath = path.join(__dirname, '../script.js');

assert(fs.existsSync(indexHtmlPath), "index.html exists at root");
assert(fs.existsSync(styleCssPath), "style.css exists at root");
assert(fs.existsSync(scriptJsPath), "script.js exists at root");

// 2. Syntax validation
try {
  const scriptContent = fs.readFileSync(scriptJsPath, 'utf8');
  // Simple check that it evaluates as valid JS
  new Function(scriptContent);
  assert(true, "script.js evaluated successfully without syntax errors");
} catch (e) {
  assert(false, `script.js syntax verification failed: ${e.message}`);
}

// 3. HTML Node structure checks
const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
assert(htmlContent.includes('id="page-overview"'), "index.html contains Overview panel ID");
assert(htmlContent.includes('id="page-lot"'), "index.html contains Lot analysis panel ID");
assert(htmlContent.includes('id="page-component"'), "index.html contains Component analysis panel ID");
assert(htmlContent.includes('id="page-anomaly"'), "index.html contains Module A panel ID");
assert(htmlContent.includes('id="page-drift"'), "index.html contains Module B panel ID");
assert(htmlContent.includes('id="page-decision"'), "index.html contains Decision engine panel ID");
assert(htmlContent.includes('id="component-selector"'), "index.html contains component select dropdown");
assert(htmlContent.includes('id="trend-svg"'), "index.html contains trend line SVG tag");

// 4. Mock database validation
const jsContent = fs.readFileSync(scriptJsPath, 'utf8');
assert(jsContent.includes('componentPool'), "script.js initializes componentPool database");
assert(jsContent.includes('COMP-00042'), "script.js contains signature failure COMP-00042");
assert(jsContent.includes('COMP-00088'), "script.js contains signature outlier COMP-00088");
assert(jsContent.includes('COMP-00105'), "script.js contains signature outlier COMP-00105");

// 5. CSS classes validation
const cssContent = fs.readFileSync(styleCssPath, 'utf8');
assert(cssContent.includes('--bg-main: #0B0F19'), "style.css contains deep space background variable color");
assert(cssContent.includes('.app-container'), "style.css defines structural layout class");
assert(cssContent.includes('.timeline-node'), "style.css defines burn-in progress timeline visual nodes");

console.log(`\nTests completed. Failures: ${failures}`);

if (failures > 0) {
  process.exit(1);
} else {
  console.log("All frontend integrity checks passed successfully!");
  process.exit(0);
}
