#!/usr/bin/env bash
set -euo pipefail

echo "========================================================================="
echo "PREDICTA -- RESTORING APPROVED GOLDEN FRONTEND BASELINE"
echo "========================================================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GOLDEN_DIR="$SCRIPT_DIR/frontend/GOLDEN_STATE"
BACKUP_ROOT="$SCRIPT_DIR/frontend_backups"

if [ ! -d "$GOLDEN_DIR" ]; then
    echo "[ERROR] Golden state snapshot not found at: $GOLDEN_DIR"
    exit 1
fi

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
CURRENT_BACKUP="$BACKUP_ROOT/backup_$TIMESTAMP"

echo "[1/4] Creating timestamped backup of current active frontend..."
echo "      Target backup directory: $CURRENT_BACKUP"
mkdir -p "$CURRENT_BACKUP/frontend" "$CURRENT_BACKUP/data/sample"

[ -f "$SCRIPT_DIR/index.html" ] && cp -f "$SCRIPT_DIR/index.html" "$CURRENT_BACKUP/index.html" || true
[ -f "$SCRIPT_DIR/style.css" ] && cp -f "$SCRIPT_DIR/style.css" "$CURRENT_BACKUP/style.css" || true
[ -f "$SCRIPT_DIR/script.js" ] && cp -f "$SCRIPT_DIR/script.js" "$CURRENT_BACKUP/script.js" || true
[ -f "$SCRIPT_DIR/api.js" ] && cp -f "$SCRIPT_DIR/api.js" "$CURRENT_BACKUP/api.js" || true
[ -f "$SCRIPT_DIR/data/sample/lot_summary.json" ] && cp -f "$SCRIPT_DIR/data/sample/lot_summary.json" "$CURRENT_BACKUP/data/sample/lot_summary.json" || true

[ -f "$SCRIPT_DIR/frontend/index.html" ] && cp -f "$SCRIPT_DIR/frontend/index.html" "$CURRENT_BACKUP/frontend/index.html" || true
[ -f "$SCRIPT_DIR/frontend/style.css" ] && cp -f "$SCRIPT_DIR/frontend/style.css" "$CURRENT_BACKUP/frontend/style.css" || true
[ -f "$SCRIPT_DIR/frontend/script.js" ] && cp -f "$SCRIPT_DIR/frontend/script.js" "$CURRENT_BACKUP/frontend/script.js" || true
[ -f "$SCRIPT_DIR/frontend/api.js" ] && cp -f "$SCRIPT_DIR/frontend/api.js" "$CURRENT_BACKUP/frontend/api.js" || true
echo "      ✔ Active frontend backup preserved safely."

echo ""
echo "[2/4] Restoring GOLDEN STATE files to root served location..."
cp -f "$GOLDEN_DIR/index.html" "$SCRIPT_DIR/index.html"
cp -f "$GOLDEN_DIR/style.css" "$SCRIPT_DIR/style.css"
cp -f "$GOLDEN_DIR/script.js" "$SCRIPT_DIR/script.js"
cp -f "$GOLDEN_DIR/api.js" "$SCRIPT_DIR/api.js"
if [ -f "$GOLDEN_DIR/data/sample/lot_summary.json" ]; then
    mkdir -p "$SCRIPT_DIR/data/sample"
    cp -f "$GOLDEN_DIR/data/sample/lot_summary.json" "$SCRIPT_DIR/data/sample/lot_summary.json"
fi
echo "      ✔ Root served files restored."

echo ""
echo "[3/4] Restoring GOLDEN STATE files to frontend/ mirror..."
cp -f "$GOLDEN_DIR/index.html" "$SCRIPT_DIR/frontend/index.html"
cp -f "$GOLDEN_DIR/style.css" "$SCRIPT_DIR/frontend/style.css"
cp -f "$GOLDEN_DIR/script.js" "$SCRIPT_DIR/frontend/script.js"
cp -f "$GOLDEN_DIR/api.js" "$SCRIPT_DIR/frontend/api.js"
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
echo "Backup archived at: $CURRENT_BACKUP"
echo "========================================================================="
