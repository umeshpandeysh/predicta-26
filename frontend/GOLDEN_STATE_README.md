# PREDICTA Golden Frontend Baseline

> **APPROVED DESIGN BASELINE — READ ONLY**

This is the approved PREDICTA frontend baseline snapshot.
Use `RESTORE_GOLDEN_FRONTEND.bat` (or `./RESTORE_GOLDEN_FRONTEND.sh`) to restore this frontend.
**Do not edit GOLDEN_STATE directly.**

---

## 1. Snapshot Details
- **Snapshot Name**: `PREDICTA_GOLDEN_FRONTEND_2026_09_29`
- **Snapshot Identifier (Composite SHA-256)**: `b06d8e3873d122e454feee02b906f8d877d765965e09bc423e43744540dc4b83`
- **Build Version Marker**: `PREDICTA-BUILD-2026`
- **Created At (UTC)**: `2026-09-28T20:41:31.819Z`
- **Files Included**: 5 core UI files

## 2. File Hashes
- **`index.html`** (`501497` bytes)
  SHA-256: `403223d15695f1fce3a3c6cd774c90be66738bca43c482bffe2a1099e4c5d074`
- **`style.css`** (`38161` bytes)
  SHA-256: `adc24f5216b0625735b80a997daa0cb750f32abbd72b32964e4f35cb699d74c9`
- **`script.js`** (`364803` bytes)
  SHA-256: `ecd46d01182cf822be300d62a44dfb024b84d723e04110209c33c578def0be5a`
- **`api.js`** (`13602` bytes)
  SHA-256: `61bb86133b981b26e791f3252cc652d4161bece158bd68c6324a7a6b85666d93`
- **`data/sample/lot_summary.json`** (`301` bytes)
  SHA-256: `a890905489a88b22989facda72eec8fa332dad441cc4354fedab12c2de29cf6c`

---

## 3. Scope & Protection
- **Restored Scope**: Frontend UI layers only (`index.html`, `style.css`, `script.js`, `api.js`, UI sample fixtures).
- **Untouched Scope**: Backend APIs, ML models (`ml/`, `src/api/`, `src/prognostics/`), datasets, Python environments, and database storage are **NEVER** modified or overwritten by this restore snapshot.

---

## 4. How to Restore
In Windows Command Prompt or PowerShell at project root:
```cmd
RESTORE_GOLDEN_FRONTEND.bat
```

In Unix/macOS or Git Bash at project root:
```bash
chmod +x RESTORE_GOLDEN_FRONTEND.sh
./RESTORE_GOLDEN_FRONTEND.sh
```
