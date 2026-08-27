/**
 * PREDICTA — Secret Scanner for Security Remediation Verification
 * File: scratch/scan_secrets_remediation.js
 */

const fs = require('fs');
const path = require('path');

const rootDir = 'C:\\Users\\UMESH PANDEY\\Downloads\\ceenew';
const dirsToScan = ['src', 'api', 'frontend', 'tests', 'scripts', 'docs'];

const secretRegexes = [
  { name: 'Hardcoded Supabase Service Role Secret', regex: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"]?ey[A-Za-z0-9_.-]{20,}/i },
  { name: 'Hardcoded Private JWT Secret Key', regex: /JWT_SECRET\s*=\s*['"]?ey[A-Za-z0-9_.-]{20,}/i },
  { name: 'Hardcoded Supabase Private Key', regex: /sbp_[a-zA-Z0-9]{20,}/i }
];

let suspiciousFound = 0;

function scanDir(dirPath) {
  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const item of items) {
    if (['node_modules', '.git', '.vercel'].includes(item.name)) continue;
    const full = path.join(dirPath, item.name);
    if (item.isDirectory()) {
      scanDir(full);
    } else if (item.isFile()) {
      if (item.name === '.env') {
        console.log(`[SUSPICIOUS] .env file committed at: ${path.relative(rootDir, full)}`);
        suspiciousFound++;
      } else {
        const ext = path.extname(item.name).toLowerCase();
        if (['.js', '.json', '.sql', '.html', '.md', '.yml', '.yaml'].includes(ext)) {
          const content = fs.readFileSync(full, 'utf8');
          for (const s of secretRegexes) {
            if (s.regex.test(content)) {
              console.log(`[SUSPICIOUS] Potential secret match (${s.name}) in file: ${path.relative(rootDir, full)}`);
              suspiciousFound++;
            }
          }
        }
      }
    }
  }
}

console.log("Scanning repository files for hardcoded secrets...\n");
for (const d of dirsToScan) {
  const p = path.join(rootDir, d);
  if (fs.existsSync(p)) {
    scanDir(p);
  }
}

console.log(`\nSecret Scan Complete: ${suspiciousFound} suspicious secrets found.`);
