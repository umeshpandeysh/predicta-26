const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');

const validExtensions = new Set([
  '.md', '.json', '.html', '.css', '.js', '.py', '.txt', '.yml', '.yaml', '.sql', '.sh'
]);

const ignoreDirs = new Set(['.git', 'node_modules', '.vercel', 'CyberShield-AI-SOC', 'sementic-search-main']);

const fileRenameMap = {
  'docs/FINAL_HOSTILE_TECHNICAL_AUDIT_V2.md': 'docs/FINAL_HOSTILE_TECHNICAL_AUDIT_V2.md',
  'docs/FINAL_HOSTILE_TECHNICAL_AUDIT.md': 'docs/FINAL_HOSTILE_TECHNICAL_AUDIT.md',
  'docs/FINAL_PRODUCTION_BACKEND_AUDIT.md': 'docs/FINAL_PRODUCTION_BACKEND_AUDIT.md',
  'docs/FINAL_PRODUCTION_CERTIFICATION.md': 'docs/FINAL_PRODUCTION_CERTIFICATION.md',
  'docs/FINAL_PRODUCTION_DASHBOARD_AUDIT.md': 'docs/FINAL_PRODUCTION_DASHBOARD_AUDIT.md',
  'docs/FINAL_PRODUCTION_DEPLOYMENT_CERTIFICATION.md': 'docs/FINAL_PRODUCTION_DEPLOYMENT_CERTIFICATION.md',
  'docs/FINAL_PRODUCTION_ML_AUDIT.md': 'docs/FINAL_PRODUCTION_ML_AUDIT.md',
  'docs/FINAL_PRODUCTION_RELEASE_CERTIFICATION.md': 'docs/FINAL_PRODUCTION_RELEASE_CERTIFICATION.md',
  'docs/FINAL_PRODUCTION_SYSTEM_ARCHITECTURE_AUDIT.md': 'docs/FINAL_PRODUCTION_SYSTEM_ARCHITECTURE_AUDIT.md',
  'docs/FINAL_PRODUCTION_SYSTEM_AUDIT.md': 'docs/FINAL_PRODUCTION_SYSTEM_AUDIT.md'
};

console.log('--- RENAMING FINAL SIH AUDIT FILENAMES ---');
for (const [oldRel, newRel] of Object.entries(fileRenameMap)) {
  const oldPath = path.join(rootDir, oldRel);
  const newPath = path.join(rootDir, newRel);

  if (fs.existsSync(oldPath)) {
    try {
      execSync(`git mv "${oldRel}" "${newRel}"`, { cwd: rootDir });
      console.log(`Git renamed: ${oldRel} -> ${newRel}`);
    } catch (e) {
      fs.renameSync(oldPath, newPath);
      console.log(`FS renamed: ${oldRel} -> ${newRel}`);
    }
  }
}

function scrubContent(content) {
  for (const [oldRel, newRel] of Object.entries(fileRenameMap)) {
    const oldBase = path.basename(oldRel);
    const newBase = path.basename(newRel);
    content = content.split(oldRel).join(newRel);
    content = content.split(oldBase).join(newBase);
  }

  return content;
}

let totalScanned = 0;
let totalModified = 0;

function traverse(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (!ignoreDirs.has(entry.name)) {
        traverse(fullPath);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (entry.name === 'predicta_xgboost_v2.json') continue;

      if (validExtensions.has(ext)) {
        totalScanned++;
        try {
          const original = fs.readFileSync(fullPath, 'utf-8');
          const scrubbed = scrubContent(original);
          if (original !== scrubbed) {
            fs.writeFileSync(fullPath, scrubbed, 'utf-8');
            totalModified++;
          }
        } catch (e) {
          console.error(`Error processing ${fullPath}:`, e.message);
        }
      }
    }
  }
}

traverse(rootDir);
console.log(`Completed renaming. Scanned ${totalScanned} files. Modified ${totalModified} files.`);
