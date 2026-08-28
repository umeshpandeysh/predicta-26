const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const validExtensions = new Set(['.md', '.json', '.html', '.css', '.js', '.py', '.txt', '.yml', '.yaml', '.sql', '.sh']);
const ignoreDirs = new Set(['.git', 'node_modules', '.vercel']);

const prohibitedRegex = /(SIH|PS170|PS-170|PS 170|Smart India|Problem Statement|ISRO|hackathon|judging|technical reviewer|finalist|submission|prize|award|competition-specific|competition cleanup|hackathon cleanup)/i;

let totalFilesScanned = 0;
let violationsFound = 0;
const violationsList = [];

function scanDir(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    // Check filename itself for prohibited terms
    if (prohibitedRegex.test(entry.name)) {
      violationsFound++;
      violationsList.push({ file: path.relative(rootDir, fullPath), line: 0, match: entry.name, content: '[FILENAME MATCH]' });
    }

    if (entry.isDirectory()) {
      if (!ignoreDirs.has(entry.name)) {
        scanDir(fullPath);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (entry.name === 'predicta_xgboost_v2.json') continue;

      if (validExtensions.has(ext)) {
        totalFilesScanned++;
        try {
          const lines = fs.readFileSync(fullPath, 'utf-8').split('\n');
          lines.forEach((line, idx) => {
            if (prohibitedRegex.test(line)) {
              violationsFound++;
              violationsList.push({ file: path.relative(rootDir, fullPath), line: idx + 1, match: line.match(prohibitedRegex)[0], content: line.trim() });
            }
          });
        } catch (e) {
          console.error(`Error reading ${fullPath}:`, e.message);
        }
      }
    }
  }
}

console.log('--- COMPREHENSIVE ZERO-PROHIBITED-TERM AUDIT ---');
scanDir(rootDir);
console.log(`Total Text Files Scanned: ${totalFilesScanned}`);
console.log(`Total Prohibited Term Violations: ${violationsFound}`);

if (violationsFound > 0) {
  console.log('\nViolations Breakdown:');
  violationsList.slice(0, 30).forEach(v => {
    console.log(`[${v.file}:${v.line}] Match: "${v.match}" -> Line: ${v.content}`);
  });
}
