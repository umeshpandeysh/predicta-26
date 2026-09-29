const fs = require('fs');
const path = require('path');

console.log("=========================================================================");
console.log("PREDICTA — EMERGENCY RESTORATION TO LAST KNOWN GOOD DESIGN");
console.log("=========================================================================");

// ── 1. RESTORE style.css FROM style.base.css ─────────────────────────────────
const styleBasePath = path.join(__dirname, '..', 'style.base.css');
const styleCssPath = path.join(__dirname, '..', 'style.css');

if (!fs.existsSync(styleBasePath)) {
  console.error("❌ style.base.css not found!");
  process.exit(1);
}

const originalStyle = fs.readFileSync(styleBasePath, 'utf8');
fs.writeFileSync(styleCssPath, originalStyle, 'utf8');
console.log("✔ Restored style.css directly from style.base.css (Authentic 1254-line stylesheet)");

// ── 2. RESTORE build_restored_frontend.js ────────────────────────────────────
const buildPath = path.join(__dirname, '..', 'build_restored_frontend.js');
let buildJs = fs.readFileSync(buildPath, 'utf8');

// Reset Build Marker
buildJs = buildJs.replace(/const buildMarker = "[^"]*";/g, 'const buildMarker = "PREDICTA-BUILD-2026";');
buildJs = buildJs.replace(/function generateRestoredHtml\(buildMarker = "[^"]*"\)/g, 'function generateRestoredHtml(buildMarker = "PREDICTA-BUILD-2026")');

// Revert all hex overrides back to authentic original palette
const revertHexMap = [
  // Primary Dark Navy
  [/#102F4F/g, '#123B63'],
  [/#10385F/g, '#123B63'],
  // Secondary Slate
  [/#45657F/g, '#475569'],
  // Muted Helper
  [/#72889A/g, '#64748B'],
  [/#70879A/g, '#64748B'],
  // Primary Blue
  [/#0878C9/g, '#1976B8'],
  [/#075A98/g, '#125B91'],
  // Borders
  [/#C9DCEB/g, '#D8E5EF'],
  [/#AFC7DA/g, '#D8E5EF'],
  [/#AFC9DC/g, '#D8E5EF'],
  // Surfaces
  [/#F3F8FC/g, '#F5F9FD'],
  // Status Red / Reject
  [/#D8444B/g, '#DC2626'],
  [/#D83D45/g, '#DC2626'],
  [/#FDE8E9/g, '#FEF2F2'],
  [/#FDE7E8/g, '#FEF2F2'],
  [/#F2A6AA/g, '#FCA5A5'],
  // Status Amber / Warning / Monitor
  [/#C98A18/g, '#D97706'],
  [/#C98512/g, '#D97706'],
  [/#FFF2D5/g, '#FEF3C7'],
  [/#FFF3D8/g, '#FEF3C7'],
  [/#F0CA6B/g, '#FCD34D'],
  // Status Green / Pass
  [/#159A68/g, '#059669'],
  [/#128A61/g, '#059669'],
  [/#E5F7EF/g, '#ECFDF5'],
  [/#E3F6ED/g, '#ECFDF5'],
  [/#A7DFC9/g, '#BBF7D0'],
  // Fonts
  [/var\(--font-headings\)/g, 'var(--font-display)'],
  [/"Space Grotesk"/g, 'var(--font-display)']
];

for (const [pattern, rep] of revertHexMap) {
  buildJs = buildJs.replace(pattern, rep);
}

// Revert page titles back to original clean styling
buildJs = buildJs.replace(/<h1 class="page-title"[^>]*Predictive Semiconductor<br>Qualification Intelligence<\/h1>/g, '<h1 class="page-title" style="font-size: 26px; color: #123B63; margin-bottom: 12px; font-weight: 700; line-height: 1.25;">Predictive Semiconductor<br>Qualification Intelligence</h1>');
buildJs = buildJs.replace(/<h1 class="page-title"[^>]*Parametric Qualification Analysis<\/h1>/g, '<h1 class="page-title" style="font-size:22px; color:#123B63; font-weight:700; margin:0 0 4px 0;">Parametric Qualification Analysis</h1>');
buildJs = buildJs.replace(/<h1 class="page-title"[^>]*Live Component Telemetry &amp; Degradation Monitor<\/h1>/g, '<h1 class="page-title" style="font-size:22px; color:#123B63; font-weight:700; margin:0 0 4px 0;">Live Component Telemetry &amp; Degradation Monitor</h1>');
buildJs = buildJs.replace(/<h1 class="page-title"[^>]*Component Parametric Analysis &amp; Investigation Workspace<\/h1>/g, '<h1 class="page-title" style="font-size:22px; color:#123B63; font-weight:700; margin:0 0 4px 0;">Component Parametric Analysis &amp; Investigation Workspace</h1>');
buildJs = buildJs.replace(/<h1 class="page-title"[^>]*ADVANCED RELIABILITY WORKSTATION<\/h1>/g, '<h1 class="page-title" style="font-size:22px; color:#123B63; font-weight:700; margin:0 0 4px 0;">ADVANCED RELIABILITY WORKSTATION</h1>');

// Revert brand name
buildJs = buildJs.replace(/class="brand-name"[^>]*>PREDICTA<\/div>/g, 'class="brand-name" style="line-height:1.2;">PREDICTA</div>');

// Remove injected inline H2 overrides
buildJs = buildJs.replace(/style="font-size:28px; color:#123B63; font-family:var\(--font-display\); font-weight:700; line-height:1.2; letter-spacing:-0.02em; margin-bottom:12px;\s*/g, 'style="');

fs.writeFileSync(buildPath, buildJs, 'utf8');
console.log("✔ Restored build_restored_frontend.js back to authentic baseline markup");

// ── 3. RESTORE synth_script.js CHART & CONTROLLER COLORS ──────────────────────
const synthPath = path.join(__dirname, '..', 'synth_script.js');
let synthJs = fs.readFileSync(synthPath, 'utf8');

for (const [pattern, rep] of revertHexMap) {
  synthJs = synthJs.replace(pattern, rep);
}

// Chart series restoration
synthJs = synthJs.replace(/#0878C9/g, '#0284C7'); // Observed
synthJs = synthJs.replace(/#DCEFFC/g, '#BAE6FD'); // Lot envelope
synthJs = synthJs.replace(/#D5EBFA/g, '#BAE6FD');
synthJs = synthJs.replace(/#18A6C8/g, '#0F8B8D'); // Teal / forecast
synthJs = synthJs.replace(/#5B61C7/g, '#1976B8'); // Indigo -> primary blue

fs.writeFileSync(synthPath, synthJs, 'utf8');
console.log("✔ Restored synth_script.js back to authentic chart and controller tokens");
