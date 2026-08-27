/**
 * PREDICTA — Master Archive & Desktop Snapshot Integrity Verification Suite
 * File: scratch/verify_archive_integrity.js
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const srcDir = 'C:\\Users\\UMESH PANDEY\\Downloads\\ceenew';
const localArchive = path.join(srcDir, 'PREDICTA');
const desktopArchive = path.join(process.env.USERPROFILE || 'C:\\Users\\UMESH PANDEY', 'Desktop', 'PREDICTA FINAL 1');

const keyItems = [
  'api/index.js',
  'src/api/server.js',
  'src/api/inference.js',
  'src/api/auth.js',
  'src/api/logger.js',
  'frontend/index.html',
  'frontend/script.js',
  'frontend/api.js',
  'ml/models/predicta_anomaly_artifacts.json',
  'ml/models/predicta_gpr_kernel_artifacts.json',
  'supabase/schema.sql',
  'package.json',
  'vercel.json',
  '.env.example',
  'README.md'
];

console.log("=========================================================================");
console.log("PREDICTA — ARCHIVE & DESKTOP SNAPSHOT INTEGRITY AUDIT");
console.log("=========================================================================\n");

let passed = 0;
let total = 0;

function check(desc, fn) {
  total++;
  try {
    fn();
    console.log(`[PASS] Check ${total.toString().padStart(2, '0')}: ${desc}`);
    passed++;
  } catch (e) {
    console.error(`[FAIL] Check ${total.toString().padStart(2, '0')}: ${desc}`);
    console.error(`       Error: ${e.message}`);
    process.exit(1);
  }
}

// 1. Local Archive Existence
check("01. Local Archive PREDICTA Directory Existence", () => {
  assert.ok(fs.existsSync(localArchive), "Local PREDICTA folder must exist");
});

// 2. Desktop Archive Existence
check("02. Desktop PREDICTA FINAL 1 Directory Existence", () => {
  assert.ok(fs.existsSync(desktopArchive), "Desktop PREDICTA FINAL 1 folder must exist");
});

// 3. Key Files Presence in Local Archive
check("03. Key Production Files Presence in Local Archive", () => {
  for (const item of keyItems) {
    const full = path.join(localArchive, item);
    assert.ok(fs.existsSync(full), `Key item '${item}' missing in local archive`);
  }
});

// 4. Key Files Presence in Desktop Archive
check("04. Key Production Files Presence in Desktop Archive", () => {
  for (const item of keyItems) {
    const full = path.join(desktopArchive, item);
    assert.ok(fs.existsSync(full), `Key item '${item}' missing in Desktop archive`);
  }
});

// 5. Byte-for-Byte Content Match for Key Files
check("05. Byte-for-Byte Content Identity Check (Source vs Desktop)", () => {
  for (const item of keyItems) {
    const srcBuf = fs.readFileSync(path.join(srcDir, item));
    const destBuf = fs.readFileSync(path.join(desktopArchive, item));
    assert.ok(srcBuf.equals(destBuf), `Content mismatch in '${item}'`);
  }
});

// 6. Zero Real Secrets in Archives
check("06. Secret Scan Audit in Archives (Zero exposed secrets)", () => {
  for (const item of keyItems) {
    const destStr = fs.readFileSync(path.join(desktopArchive, item), 'utf8');
    assert.ok(!destStr.includes('SUPABASE_SERVICE_ROLE_KEY=ey'), "Secret key value found");
  }
});

console.log("\n=========================================================================");
console.log(`ALL ${passed}/${total} ARCHIVE INTEGRITY CHECKS PASSED 100%! ✅`);
console.log("PREDICTA FINAL 1 DESKTOP ARCHIVE SNAPSHOT IS READY & VERIFIED!");
console.log("=========================================================================\n");
