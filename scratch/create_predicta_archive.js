/**
 * PREDICTA — Master Archive & Desktop Snapshot Copy Engine
 * File: scratch/create_predicta_archive.js
 */

const fs = require('fs');
const path = require('path');

const srcDir = 'C:\\Users\\UMESH PANDEY\\Downloads\\ceenew';
const localArchiveDir = path.join(srcDir, 'PREDICTA');
const userProfile = process.env.USERPROFILE || 'C:\\Users\\UMESH PANDEY';
const desktopArchiveDir = path.join(userProfile, 'Desktop', 'PREDICTA FINAL 1');

const excludeNames = new Set([
  '.git', '.vercel', 'node_modules', '.env', '.env.local', 'PREDICTA', 'PREDICTA FINAL 1'
]);

function copyRecursiveSync(src, dest, stats = { files: 0, dirs: 0 }) {
  const baseName = path.basename(src);
  if (excludeNames.has(baseName)) return stats;

  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
      stats.dirs++;
    }
    const items = fs.readdirSync(src);
    for (const item of items) {
      copyRecursiveSync(path.join(src, item), path.join(dest, item), stats);
    }
  } else if (stat.isFile()) {
    const parentDir = path.dirname(dest);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
    stats.files++;
  }
  return stats;
}

console.log("=========================================================================");
console.log("PREDICTA — MASTER ARCHIVE SNAPSHOT & DESKTOP COPY ENGINE");
console.log("=========================================================================\n");

// 1. Copy to local PREDICTA folder
console.log(`Copying project snapshot to local archive: ${localArchiveDir}`);
const localStats = copyRecursiveSync(srcDir, localArchiveDir);
console.log(` -> Local Archive Completed: ${localStats.files} files copied into ${localStats.dirs} directories.`);

// 2. Copy to Desktop PREDICTA FINAL 1 folder
console.log(`\nCopying project snapshot to Desktop: ${desktopArchiveDir}`);
const desktopStats = copyRecursiveSync(srcDir, desktopArchiveDir);
console.log(` -> Desktop Snapshot Completed: ${desktopStats.files} files copied into ${desktopStats.dirs} directories.`);

console.log("\n=========================================================================");
console.log("ARCHIVE & DESKTOP SNAPSHOT CREATION SUCCESSFUL! ✅");
console.log("=========================================================================\n");
