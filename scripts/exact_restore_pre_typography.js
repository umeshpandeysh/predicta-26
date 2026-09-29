const fs = require('fs');
const path = require('path');

console.log("=========================================================================");
console.log("PREDICTA — EXACT RESTORATION TO PRE-TYPOGRAPHY/COLOR STATE");
console.log("=========================================================================");

const rootDir = path.join(__dirname, '..');

// ── 1. RESTORE style.css DIRECTLY FROM style.base.css ─────────────────────────
const styleBasePath = path.join(rootDir, 'style.base.css');
const styleCssPath = path.join(rootDir, 'style.css');
const frontendStylePath = path.join(rootDir, 'frontend', 'style.css');

if (!fs.existsSync(styleBasePath)) {
  console.error("❌ style.base.css not found!");
  process.exit(1);
}

const originalStyle = fs.readFileSync(styleBasePath, 'utf8');
fs.writeFileSync(styleCssPath, originalStyle, 'utf8');
fs.writeFileSync(frontendStylePath, originalStyle, 'utf8');
console.log("✔ Restored style.css & frontend/style.css from style.base.css (1254 lines)");

// ── 2. RESTORE build_restored_frontend.js ────────────────────────────────────
const buildJsPath = path.join(rootDir, 'build_restored_frontend.js');
let buildJs = fs.readFileSync(buildJsPath, 'utf8');

// Build Marker
buildJs = buildJs.replace(/const buildMarker = "[^"]*";/g, 'const buildMarker = "PREDICTA-BUILD-2026";');
buildJs = buildJs.replace(/function generateRestoredHtml\(buildMarker = "[^"]*"\)/g, 'function generateRestoredHtml(buildMarker = "PREDICTA-BUILD-2026")');

// Revert all color hexes to original authentic pre-experiment palette
const exactHexMap = [
  // Primary Dark Navy
  [/#102F4F/g, '#123B63'],
  [/#10385F/g, '#123B63'],
  [/#12365B/g, '#123B63'],
  // Secondary Slate
  [/#45657F/g, '#475569'],
  [/#4A6680/g, '#475569'],
  // Muted Helper
  [/#72889A/g, '#64748B'],
  [/#70879A/g, '#64748B'],
  [/#71869A/g, '#64748B'],
  // Primary Blue
  [/#0878C9/g, '#1976B8'],
  [/#1778C8/g, '#1976B8'],
  [/#075A98/g, '#125B91'],
  [/#0F5FA8/g, '#125B91'],
  // Borders
  [/#C9DCEB/g, '#D8E5EF'],
  [/#D5E3EF/g, '#D8E5EF'],
  [/#AFC7DA/g, '#D8E5EF'],
  [/#AFC9DC/g, '#D8E5EF'],
  // Surfaces
  [/#F3F8FC/g, '#F5F9FD'],
  [/#F0F6FB/g, '#EAF4FB'],
  // Status Red / Reject
  [/#D8444B/g, '#DC2626'],
  [/#D83D45/g, '#D8444B'],
  [/#D94A4A/g, '#DC2626'],
  [/#FDE8E9/g, '#FEF2F2'],
  [/#FDE7E8/g, '#FEF2F2'],
  [/#FDEAEA/g, '#FEF2F2'],
  [/#F2A6AA/g, '#FCA5A5'],
  // Status Amber / Warning / Monitor
  [/#C98A18/g, '#D97706'],
  [/#C98512/g, '#D97706'],
  [/#C88716/g, '#D97706'],
  [/#FFF2D5/g, '#FEF3C7'],
  [/#FFF3D8/g, '#FEF3C7'],
  [/#FFF4D9/g, '#FEF3C7'],
  [/#F0CA6B/g, '#FCD34D'],
  // Status Green / Pass
  [/#159A68/g, '#059669'],
  [/#128A61/g, '#059669'],
  [/#16A34A/g, '#059669'],
  [/#E5F7EF/g, '#ECFDF5'],
  [/#E3F6ED/g, '#ECFDF5'],
  [/#E7F7EF/g, '#ECFDF5'],
  [/#A7DFC9/g, '#BBF7D0'],
  [/#B2E7D1/g, '#BBF7D0'],
  // Fonts
  [/var\(--font-headings\)/g, 'var(--font-display)'],
  [/"Space Grotesk"/g, 'var(--font-display)']
];

for (const [pattern, rep] of exactHexMap) {
  buildJs = buildJs.replace(pattern, rep);
}

// Clean any injected inline font-sizes/line-heights on page titles
buildJs = buildJs.replace(/<h1 class="page-title"[^>]*>Predictive Semiconductor<br>Qualification Intelligence<\/h1>/g, '<h1 class="page-title" style="font-size: 26px; color: #123B63; margin-bottom: 12px; font-weight: 700; line-height: 1.25;">Predictive Semiconductor<br>Qualification Intelligence</h1>');
buildJs = buildJs.replace(/<h1 class="page-title"[^>]*>Parametric Qualification Analysis<\/h1>/g, '<h1 class="page-title" style="font-size:22px; color:#123B63; font-weight:700; margin:0 0 4px 0;">Parametric Qualification Analysis</h1>');
buildJs = buildJs.replace(/<h1 class="page-title"[^>]*>Live Component Telemetry &amp; Degradation Monitor<\/h1>/g, '<h1 class="page-title" style="font-size:22px; color:#123B63; font-weight:700; margin:0 0 4px 0;">Live Component Telemetry &amp; Degradation Monitor</h1>');
buildJs = buildJs.replace(/<h1 class="page-title"[^>]*>Component Parametric Analysis &amp; Investigation Workspace<\/h1>/g, '<h1 class="page-title" style="font-size:22px; color:#123B63; font-weight:700; margin:0 0 4px 0;">Component Parametric Analysis &amp; Investigation Workspace</h1>');
buildJs = buildJs.replace(/<h1 class="page-title"[^>]*>ADVANCED RELIABILITY WORKSTATION<\/h1>/g, '<h1 class="page-title" style="font-size:22px; color:#123B63; font-weight:700; margin:0 0 4px 0;">ADVANCED RELIABILITY WORKSTATION</h1>');

// Clean duplicate styles
buildJs = buildJs.replace(/style="font-size:28px; color:#123B63; font-family:var\(--font-display\); font-weight:700; line-height:1.2; letter-spacing:-0.02em; margin-bottom:12px;\s*/g, 'style="');
buildJs = buildJs.replace(/style="font-size:28px; color:#123B63;\s*/g, 'style="');

// Revert brand name
buildJs = buildJs.replace(/class="brand-name"[^>]*>PREDICTA<\/div>/g, 'class="brand-name" style="line-height:1.2;">PREDICTA</div>');

fs.writeFileSync(buildJsPath, buildJs, 'utf8');
console.log("✔ Restored build_restored_frontend.js to authentic pre-experiment state");

// ── 3. RESTORE synth_script.js CHART & CONTROLLER PALETTE ─────────────────────
const synthPath = path.join(rootDir, 'synth_script.js');
let synthJs = fs.readFileSync(synthPath, 'utf8');

for (const [pattern, rep] of exactHexMap) {
  synthJs = synthJs.replace(pattern, rep);
}

synthJs = synthJs.replace(/#0878C9/g, '#0284C7');
synthJs = synthJs.replace(/#1778C8/g, '#0284C7');
synthJs = synthJs.replace(/#DCEFFC/g, '#BAE6FD');
synthJs = synthJs.replace(/#D5EBFA/g, '#BAE6FD');
synthJs = synthJs.replace(/#DCEEFF/g, '#BAE6FD');
synthJs = synthJs.replace(/#7DD3FC/g, '#BAE6FD');
synthJs = synthJs.replace(/#18A6C8/g, '#0F8B8D');
synthJs = synthJs.replace(/#1FA6C9/g, '#0F8B8D');
synthJs = synthJs.replace(/#5B61C7/g, '#1976B8');
synthJs = synthJs.replace(/#5B63C7/g, '#1976B8');

fs.writeFileSync(synthPath, synthJs, 'utf8');
console.log("✔ Restored synth_script.js chart and controller tokens");

// ── 4. REGENERATE ROOT & FRONTEND ASSETS ──────────────────────────────────────
const generateRestored = require(buildJsPath);
// Run build_restored_frontend.js
const { execSync } = require('child_process');
const buildOutput = execSync('node build_restored_frontend.js', { cwd: rootDir, encoding: 'utf8' });
console.log(buildOutput);
