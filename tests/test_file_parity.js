/**
 * PREDICTA SIH 2026 — FILE PARITY REGRESSION TEST SUITE
 * File: tests/test_file_parity.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("=========================================================================");
console.log("PREDICTA SIH 2026 — ROOT ↔ FRONTEND FILE PARITY TEST SUITE");
console.log("=========================================================================\n");

const pairs = [
  { root: "index.html", frontend: "frontend/index.html" },
  { root: "script.js", frontend: "frontend/script.js" },
  { root: "api.js", frontend: "frontend/api.js" }
];

pairs.forEach(pair => {
  const rootPath = path.resolve(__dirname, '..', pair.root);
  const frontPath = path.resolve(__dirname, '..', pair.frontend);

  if (fs.existsSync(frontPath)) {
    const rootBuf = fs.readFileSync(rootPath);
    const frontBuf = fs.readFileSync(frontPath);

    assert.strictEqual(rootBuf.length, frontBuf.length, `PARITY ERROR: Length mismatch between ${pair.root} (${rootBuf.length} B) and ${pair.frontend} (${frontBuf.length} B)`);
    assert(rootBuf.equals(frontBuf), `PARITY ERROR: Byte content mismatch between ${pair.root} and ${pair.frontend}`);
    console.log(`✔ Byte Parity Verified: ${pair.root} ↔ ${pair.frontend} (${rootBuf.length} bytes)`);
  } else {
    console.log(`ℹ Notice: ${pair.frontend} does not exist; root file ${pair.root} is sole source of truth.`);
  }
});

console.log("\n=========================================================================");
console.log("ALL FILE PARITY TESTS PASSED SUCCESSFULLY! ✅");
console.log("=========================================================================\n");
