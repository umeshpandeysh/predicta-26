/**
 * Predicta Phase 11 — Duplicate HTML ID Auditor Test
 * File: tests/test_duplicate_ids.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("[TEST] Auditing index.html for duplicate HTML element IDs...");

const htmlPath = path.join(__dirname, '../index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

const idRegex = /\bid=["']([^"']+)["']/g;
const idCounts = {};
let match;

while ((match = idRegex.exec(htmlContent)) !== null) {
  const id = match[1];
  idCounts[id] = (idCounts[id] || 0) + 1;
}

const duplicates = Object.entries(idCounts).filter(([id, count]) => count > 1);

if (duplicates.length > 0) {
  console.error("❌ Duplicate HTML IDs found in index.html:", duplicates);
} else {
  console.log("✅ Zero duplicate HTML IDs found in index.html. Total unique IDs:", Object.keys(idCounts).length);
}

assert.strictEqual(duplicates.length, 0, `Found ${duplicates.length} duplicate HTML IDs in index.html: ${JSON.stringify(duplicates)}`);
console.log("[PASS] Duplicate HTML ID Audit Passed!");
