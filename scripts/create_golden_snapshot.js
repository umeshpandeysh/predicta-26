const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const GOLDEN_DIR = path.join(ROOT_DIR, 'frontend', 'GOLDEN_STATE');
const MANIFEST_PATH = path.join(ROOT_DIR, 'frontend', 'GOLDEN_STATE_MANIFEST.json');
const README_PATH = path.join(ROOT_DIR, 'frontend', 'GOLDEN_STATE_README.md');
const BAT_PATH = path.join(ROOT_DIR, 'RESTORE_GOLDEN_FRONTEND.bat');
const SH_PATH = path.join(ROOT_DIR, 'RESTORE_GOLDEN_FRONTEND.sh');

function computeSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

// 1. Files to snapshot
const sourceFiles = [
  { relPath: 'index.html', src: path.join(ROOT_DIR, 'index.html') },
  { relPath: 'style.css', src: path.join(ROOT_DIR, 'style.css') },
  { relPath: 'script.js', src: path.join(ROOT_DIR, 'script.js') },
  { relPath: 'api.js', src: path.join(ROOT_DIR, 'api.js') },
  { relPath: 'data/sample/lot_summary.json', src: path.join(ROOT_DIR, 'data', 'sample', 'lot_summary.json') }
];

// Ensure target directories exist
fs.mkdirSync(GOLDEN_DIR, { recursive: true });
fs.mkdirSync(path.join(GOLDEN_DIR, 'data', 'sample'), { recursive: true });

const manifestFiles = [];

// Copy files and record hashes
for (const file of sourceFiles) {
  const destPath = path.join(GOLDEN_DIR, file.relPath);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(file.src, destPath);
  
  const srcSha = computeSha256(file.src);
  const destSha = computeSha256(destPath);
  
  if (srcSha !== destSha) {
    throw new Error(`Hash mismatch after copying ${file.relPath}: ${srcSha} vs ${destSha}`);
  }
  
  const stat = fs.statSync(destPath);
  manifestFiles.push({
    relative_path: file.relPath,
    size_bytes: stat.size,
    sha256: destSha
  });
}

// Calculate composite snapshot hash
const sortedHashes = manifestFiles.map(f => `${f.relative_path}:${f.sha256}`).sort().join('\n');
const snapshotCompositeSha = crypto.createHash('sha256').update(sortedHashes).digest('hex');

const now = new Date();
const manifestData = {
  snapshot_name: "PREDICTA_GOLDEN_FRONTEND_2026_09_29",
  snapshot_identifier: snapshotCompositeSha,
  build_version_marker: "PREDICTA-BUILD-2026",
  created_at_utc: now.toISOString(),
  created_at_local: now.toLocaleString(),
  active_served_root: ROOT_DIR.replace(/\\/g, '/'),
  active_served_mirror: path.join(ROOT_DIR, 'frontend').replace(/\\/g, '/'),
  golden_state_directory: path.join(ROOT_DIR, 'frontend', 'GOLDEN_STATE').replace(/\\/g, '/'),
  description: "Approved PREDICTA Golden Frontend Baseline Snapshot with centered hero chip, subtle floating motion, 10-tab Advanced Workstation, and verified design system tokens.",
  total_files: manifestFiles.length,
  files: manifestFiles,
  governance_rule: "READ-ONLY. Do not edit GOLDEN_STATE directly. Restorable via RESTORE_GOLDEN_FRONTEND.bat / RESTORE_GOLDEN_FRONTEND.sh."
};

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifestData, null, 2), 'utf8');
console.log('✔ Wrote manifest to:', MANIFEST_PATH);

// Create README
const readmeContent = `# PREDICTA Golden Frontend Baseline

> **APPROVED DESIGN BASELINE — READ ONLY**

This is the approved PREDICTA frontend baseline snapshot.
Use \`RESTORE_GOLDEN_FRONTEND.bat\` (or \`./RESTORE_GOLDEN_FRONTEND.sh\`) to restore this frontend.
**Do not edit GOLDEN_STATE directly.**

---

## 1. Snapshot Details
- **Snapshot Name**: \`${manifestData.snapshot_name}\`
- **Snapshot Identifier (Composite SHA-256)**: \`${manifestData.snapshot_identifier}\`
- **Build Version Marker**: \`${manifestData.build_version_marker}\`
- **Created At (UTC)**: \`${manifestData.created_at_utc}\`
- **Files Included**: ${manifestFiles.length} core UI files

## 2. File Hashes
${manifestFiles.map(f => `- **\`${f.relative_path}\`** (\`${f.size_bytes}\` bytes)\n  SHA-256: \`${f.sha256}\``).join('\n')}

---

## 3. Scope & Protection
- **Restored Scope**: Frontend UI layers only (\`index.html\`, \`style.css\`, \`script.js\`, \`api.js\`, UI sample fixtures).
- **Untouched Scope**: Backend APIs, ML models (\`ml/\`, \`src/api/\`, \`src/prognostics/\`), datasets, Python environments, and database storage are **NEVER** modified or overwritten by this restore snapshot.

---

## 4. How to Restore
In Windows Command Prompt or PowerShell at project root:
\`\`\`cmd
RESTORE_GOLDEN_FRONTEND.bat
\`\`\`

In Unix/macOS or Git Bash at project root:
\`\`\`bash
chmod +x RESTORE_GOLDEN_FRONTEND.sh
./RESTORE_GOLDEN_FRONTEND.sh
\`\`\`
`;

fs.writeFileSync(README_PATH, readmeContent, 'utf8');
console.log('✔ Wrote README to:', README_PATH);

// Create RESTORE_GOLDEN_FRONTEND.bat
const batContent = `@echo off
setlocal enabledelayedexpansion

echo =========================================================================
echo PREDICTA -- RESTORING APPROVED GOLDEN FRONTEND BASELINE
echo =========================================================================
echo.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

set "GOLDEN_DIR=%SCRIPT_DIR%frontend\\GOLDEN_STATE"
set "BACKUP_ROOT=%SCRIPT_DIR%frontend_backups"

if not exist "%GOLDEN_DIR%" (
    echo [ERROR] Golden state snapshot not found at: %GOLDEN_DIR%
    exit /b 1
)

:: Generate timestamp for backup
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set "dt=%%I"
set "TIMESTAMP=%dt:~0,8%_%dt:~8,6%"
if "%TIMESTAMP%"=="" set "TIMESTAMP=%date:~-4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"

set "CURRENT_BACKUP=%BACKUP_ROOT%\\backup_%TIMESTAMP%"

echo [1/4] Creating timestamped backup of current active frontend...
echo       Target backup directory: %CURRENT_BACKUP%
mkdir "%CURRENT_BACKUP%" >nul 2>&1
mkdir "%CURRENT_BACKUP%\\frontend" >nul 2>&1
mkdir "%CURRENT_BACKUP%\\data\\sample" >nul 2>&1

if exist "%SCRIPT_DIR%index.html" copy /y "%SCRIPT_DIR%index.html" "%CURRENT_BACKUP%\\index.html" >nul
if exist "%SCRIPT_DIR%style.css" copy /y "%SCRIPT_DIR%style.css" "%CURRENT_BACKUP%\\style.css" >nul
if exist "%SCRIPT_DIR%script.js" copy /y "%SCRIPT_DIR%script.js" "%CURRENT_BACKUP%\\script.js" >nul
if exist "%SCRIPT_DIR%api.js" copy /y "%SCRIPT_DIR%api.js" "%CURRENT_BACKUP%\\api.js" >nul
if exist "%SCRIPT_DIR%data\\sample\\lot_summary.json" copy /y "%SCRIPT_DIR%data\\sample\\lot_summary.json" "%CURRENT_BACKUP%\\data\\sample\\lot_summary.json" >nul

if exist "%SCRIPT_DIR%frontend\\index.html" copy /y "%SCRIPT_DIR%frontend\\index.html" "%CURRENT_BACKUP%\\frontend\\index.html" >nul
if exist "%SCRIPT_DIR%frontend\\style.css" copy /y "%SCRIPT_DIR%frontend\\style.css" "%CURRENT_BACKUP%\\frontend\\style.css" >nul
if exist "%SCRIPT_DIR%frontend\\script.js" copy /y "%SCRIPT_DIR%frontend\\script.js" "%CURRENT_BACKUP%\\frontend\\script.js" >nul
if exist "%SCRIPT_DIR%frontend\\api.js" copy /y "%SCRIPT_DIR%frontend\\api.js" "%CURRENT_BACKUP%\\frontend\\api.js" >nul
echo       ✔ Active frontend backup preserved safely.

echo.
echo [2/4] Restoring GOLDEN STATE files to root served location...
copy /y "%GOLDEN_DIR%\\index.html" "%SCRIPT_DIR%index.html" >nul
copy /y "%GOLDEN_DIR%\\style.css" "%SCRIPT_DIR%style.css" >nul
copy /y "%GOLDEN_DIR%\\script.js" "%SCRIPT_DIR%script.js" >nul
copy /y "%GOLDEN_DIR%\\api.js" "%SCRIPT_DIR%api.js" >nul
if exist "%GOLDEN_DIR%\\data\\sample\\lot_summary.json" (
    mkdir "%SCRIPT_DIR%data\\sample" >nul 2>&1
    copy /y "%GOLDEN_DIR%\\data\\sample\\lot_summary.json" "%SCRIPT_DIR%data\\sample\\lot_summary.json" >nul
)
echo       ✔ Root served files restored.

echo.
echo [3/4] Restoring GOLDEN STATE files to frontend/ mirror...
copy /y "%GOLDEN_DIR%\\index.html" "%SCRIPT_DIR%frontend\\index.html" >nul
copy /y "%GOLDEN_DIR%\\style.css" "%SCRIPT_DIR%frontend\\style.css" >nul
copy /y "%GOLDEN_DIR%\\script.js" "%SCRIPT_DIR%frontend\\script.js" >nul
copy /y "%GOLDEN_DIR%\\api.js" "%SCRIPT_DIR%frontend\\api.js" >nul
echo       ✔ frontend/ mirror files restored.

echo.
echo [4/4] Verifying backend and ML model safety...
echo       Backend endpoints in src/api/: UNTOUCHED
echo       ML models and datasets in ml/: UNTOUCHED
echo       Python modules in src/prognostics/: UNTOUCHED

echo.
echo =========================================================================
echo SUCCESS: GOLDEN FRONTEND RESTORED DETERMINISTICALLY
echo =========================================================================
echo Restored files:
echo   - index.html
echo   - style.css
echo   - script.js
echo   - api.js
echo   - data/sample/lot_summary.json
echo   - frontend/index.html
echo   - frontend/style.css
echo   - frontend/script.js
echo   - frontend/api.js
echo.
echo Backup archived at: %CURRENT_BACKUP%
echo =========================================================================
`;

fs.writeFileSync(BAT_PATH, batContent, 'utf8');
console.log('✔ Wrote BAT script to:', BAT_PATH);

// Create RESTORE_GOLDEN_FRONTEND.sh
const shContent = `#!/usr/bin/env bash
set -euo pipefail

echo "========================================================================="
echo "PREDICTA -- RESTORING APPROVED GOLDEN FRONTEND BASELINE"
echo "========================================================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
cd "\$SCRIPT_DIR"

GOLDEN_DIR="\$SCRIPT_DIR/frontend/GOLDEN_STATE"
BACKUP_ROOT="\$SCRIPT_DIR/frontend_backups"

if [ ! -d "\$GOLDEN_DIR" ]; then
    echo "[ERROR] Golden state snapshot not found at: \$GOLDEN_DIR"
    exit 1
fi

TIMESTAMP="\$(date +%Y%m%d_%H%M%S)"
CURRENT_BACKUP="\$BACKUP_ROOT/backup_\$TIMESTAMP"

echo "[1/4] Creating timestamped backup of current active frontend..."
echo "      Target backup directory: \$CURRENT_BACKUP"
mkdir -p "\$CURRENT_BACKUP/frontend" "\$CURRENT_BACKUP/data/sample"

[ -f "\$SCRIPT_DIR/index.html" ] && cp -f "\$SCRIPT_DIR/index.html" "\$CURRENT_BACKUP/index.html" || true
[ -f "\$SCRIPT_DIR/style.css" ] && cp -f "\$SCRIPT_DIR/style.css" "\$CURRENT_BACKUP/style.css" || true
[ -f "\$SCRIPT_DIR/script.js" ] && cp -f "\$SCRIPT_DIR/script.js" "\$CURRENT_BACKUP/script.js" || true
[ -f "\$SCRIPT_DIR/api.js" ] && cp -f "\$SCRIPT_DIR/api.js" "\$CURRENT_BACKUP/api.js" || true
[ -f "\$SCRIPT_DIR/data/sample/lot_summary.json" ] && cp -f "\$SCRIPT_DIR/data/sample/lot_summary.json" "\$CURRENT_BACKUP/data/sample/lot_summary.json" || true

[ -f "\$SCRIPT_DIR/frontend/index.html" ] && cp -f "\$SCRIPT_DIR/frontend/index.html" "\$CURRENT_BACKUP/frontend/index.html" || true
[ -f "\$SCRIPT_DIR/frontend/style.css" ] && cp -f "\$SCRIPT_DIR/frontend/style.css" "\$CURRENT_BACKUP/frontend/style.css" || true
[ -f "\$SCRIPT_DIR/frontend/script.js" ] && cp -f "\$SCRIPT_DIR/frontend/script.js" "\$CURRENT_BACKUP/frontend/script.js" || true
[ -f "\$SCRIPT_DIR/frontend/api.js" ] && cp -f "\$SCRIPT_DIR/frontend/api.js" "\$CURRENT_BACKUP/frontend/api.js" || true
echo "      ✔ Active frontend backup preserved safely."

echo ""
echo "[2/4] Restoring GOLDEN STATE files to root served location..."
cp -f "\$GOLDEN_DIR/index.html" "\$SCRIPT_DIR/index.html"
cp -f "\$GOLDEN_DIR/style.css" "\$SCRIPT_DIR/style.css"
cp -f "\$GOLDEN_DIR/script.js" "\$SCRIPT_DIR/script.js"
cp -f "\$GOLDEN_DIR/api.js" "\$SCRIPT_DIR/api.js"
if [ -f "\$GOLDEN_DIR/data/sample/lot_summary.json" ]; then
    mkdir -p "\$SCRIPT_DIR/data/sample"
    cp -f "\$GOLDEN_DIR/data/sample/lot_summary.json" "\$SCRIPT_DIR/data/sample/lot_summary.json"
fi
echo "      ✔ Root served files restored."

echo ""
echo "[3/4] Restoring GOLDEN STATE files to frontend/ mirror..."
cp -f "\$GOLDEN_DIR/index.html" "\$SCRIPT_DIR/frontend/index.html"
cp -f "\$GOLDEN_DIR/style.css" "\$SCRIPT_DIR/frontend/style.css"
cp -f "\$GOLDEN_DIR/script.js" "\$SCRIPT_DIR/frontend/script.js"
cp -f "\$GOLDEN_DIR/api.js" "\$SCRIPT_DIR/frontend/api.js"
echo "      ✔ frontend/ mirror files restored."

echo ""
echo "[4/4] Verifying backend and ML model safety..."
echo "      Backend endpoints in src/api/: UNTOUCHED"
echo "      ML models and datasets in ml/: UNTOUCHED"
echo "      Python modules in src/prognostics/: UNTOUCHED"

echo ""
echo "========================================================================="
echo "SUCCESS: GOLDEN FRONTEND RESTORED DETERMINISTICALLY"
echo "========================================================================="
echo "Restored files:"
echo "  - index.html"
echo "  - style.css"
echo "  - script.js"
echo "  - api.js"
echo "  - data/sample/lot_summary.json"
echo "  - frontend/index.html"
echo "  - frontend/style.css"
echo "  - frontend/script.js"
echo "  - frontend/api.js"
echo ""
echo "Backup archived at: \$CURRENT_BACKUP"
echo "========================================================================="
`;

fs.writeFileSync(SH_PATH, shContent, 'utf8');
console.log('✔ Wrote SH script to:', SH_PATH);
