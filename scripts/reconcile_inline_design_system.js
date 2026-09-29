const fs = require('fs');
const path = require('path');

console.log("=== COMPREHENSIVE RECONCILIATION OF INLINE DESIGN TOKENS ===");

const buildJsPath = path.join(__dirname, '..', 'build_restored_frontend.js');
let buildJs = fs.readFileSync(buildJsPath, 'utf8');

// 1. Update Build Marker Constant
buildJs = buildJs.replace(/function generateRestoredHtml\(buildMarker = "[^"]*"\)/g, 'function generateRestoredHtml(buildMarker = "PREDICTA-BUILD-TYPOGRAPHY-COLOR-PHASE1")');

// 2. Ensure meta tag and script build marker are in <head>
const oldHead = `<title>PREDICTA — Semiconductor Predictive Screening Workstation</title>`;
const newHead = `<title>PREDICTA — Semiconductor Predictive Screening Workstation</title>
  <meta name="predicta-build" content="\${buildMarker}">
  <meta name="predicta-design-version" content="phase1-typography-color">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">`;

if (!buildJs.includes('meta name="predicta-build"')) {
  buildJs = buildJs.replace(oldHead, newHead);
}

// 3. Systematic Hex Color Replacement across all markup in build_restored_frontend.js
const colorReplacements = [
  // Primary Text & Navy
  [/#123B63/g, '#12365B'],
  // Secondary Slate
  [/#475569/g, '#4A6680'],
  // Muted Helper
  [/#64748B/g, '#71869A'],
  // Primary Blue
  [/#1976B8/g, '#1778C8'],
  [/#125B91/g, '#0F5FA8'],
  // Borders
  [/#D8E5EF/g, '#D5E3EF'],
  // Surfaces
  [/#EAF4FB/g, '#F0F6FB'],
  // Status Colors
  [/#DC2626/g, '#D94A4A'],
  [/#D97706/g, '#C88716'],
  [/#059669/g, '#159A68'],
  [/#16A34A/g, '#159A68'],
  [/#10B981/g, '#159A68'],
  // Status Surfaces
  [/#FEF2F2/g, '#FDEAEA'],
  [/#FEE2E2/g, '#FDEAEA'],
  [/#FEF3C7/g, '#FFF4D9'],
  [/#FFFBEB/g, '#FFF4D9'],
  [/#F0FDF4/g, '#E7F7EF'],
  [/#BBF7D0/g, '#E7F7EF']
];

for (const [fromRegex, toVal] of colorReplacements) {
  buildJs = buildJs.replace(fromRegex, toVal);
}

// 4. Update Headings in page templates
buildJs = buildJs.replace(/class="page-title"[^>]*>([^<]*)<\/h1>/g, (match, titleContent) => {
  return `class="page-title" style="font-size:34px; color:#12365B; font-family:var(--font-headings); font-weight:700; line-height:1.22; margin-bottom:8px;">${titleContent}</h1>`;
});

// Update brand name
buildJs = buildJs.replace(/class="brand-name"[^>]*>PREDICTA<\/div>/g, 'class="brand-name" style="font-family:var(--font-headings); font-weight:700; font-size:20px; color:#12365B; line-height:1.2;">PREDICTA</div>');

fs.writeFileSync(buildJsPath, buildJs, 'utf8');
console.log("✔ Successfully updated build_restored_frontend.js with unified design tokens");

// 5. Update style.css
const stylePath = path.join(__dirname, '..', 'style.css');
let styleCss = fs.readFileSync(stylePath, 'utf8');

// Replace any lingering old hex codes in style.css
for (const [fromRegex, toVal] of colorReplacements) {
  styleCss = styleCss.replace(fromRegex, toVal);
}

// Add important high-specificity typography enforcement rules
const typographyEnforcement = `
/* ── WORKSTATION TYPOGRAPHY ENFORCEMENT ────────────────────────────────────── */
body, body * {
  --font-primary-headings: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-primary-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  --font-primary-mono: 'JetBrains Mono', 'Cascadia Code', 'Source Code Pro', Menlo, Monaco, Consolas, monospace;
}

h1, .page-title, .hero-title, .modal-title {
  font-family: var(--font-primary-headings) !important;
  color: var(--text-primary) !important;
}

h2, .section-title, .card-header-title {
  font-family: var(--font-primary-headings) !important;
  color: var(--text-primary) !important;
}

h3, .card-title {
  font-family: var(--font-primary-headings) !important;
  color: var(--text-primary) !important;
}

.brand-name {
  font-family: var(--font-primary-headings) !important;
  color: var(--text-primary) !important;
  font-weight: 700 !important;
}

.nav-link {
  font-family: var(--font-primary-body) !important;
  font-size: 14.5px !important;
}

.nav-link.active {
  background-color: var(--pale-blue) !important;
  color: var(--primary-blue-dark) !important;
}

.technical-overline, .stat-label, .overline, .dossier-label {
  font-family: var(--font-primary-body) !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  letter-spacing: 0.08em !important;
  text-transform: uppercase !important;
  color: var(--primary-blue) !important;
}

.badge {
  font-family: var(--font-primary-mono) !important;
  font-size: 11.5px !important;
  font-weight: 600 !important;
}

.badge.pass {
  background-color: var(--color-pass-surface) !important;
  color: var(--color-pass) !important;
  border: 1px solid var(--color-pass-border) !important;
}

.badge.monitor, .badge.warning {
  background-color: var(--color-warning-surface) !important;
  color: var(--color-warning) !important;
  border: 1px solid var(--color-warning-border) !important;
}

.badge.reject, .badge.critical {
  background-color: var(--color-reject-surface) !important;
  color: var(--color-reject) !important;
  border: 1px solid var(--color-reject-border) !important;
}

.badge.insufficient, .badge.info {
  background-color: var(--color-insufficient-surface) !important;
  color: var(--color-insufficient) !important;
  border: 1px solid var(--color-insufficient-border) !important;
}

.stat-value, .metric-large, .kpi-value, [data-metric-mono="true"], td.mono-cell {
  font-family: var(--font-primary-mono) !important;
}

.btn {
  font-family: var(--font-primary-body) !important;
  font-size: 14px !important;
  font-weight: 600 !important;
}

.btn-primary {
  background-color: var(--primary-blue) !important;
  border-color: var(--primary-blue) !important;
  color: #FFFFFF !important;
}

.btn-primary:hover {
  background-color: var(--primary-blue-dark) !important;
  border-color: var(--primary-blue-dark) !important;
}

.btn-outline {
  background-color: #FFFFFF !important;
  border-color: var(--border-color) !important;
  color: var(--text-primary) !important;
}

.btn-outline:hover {
  background-color: var(--bg-surface-subtle) !important;
  border-color: var(--border-strong) !important;
  color: var(--primary-blue) !important;
}

label, .form-label {
  font-family: var(--font-primary-body) !important;
  font-size: 13.5px !important;
  font-weight: 600 !important;
  color: var(--text-primary) !important;
}

.form-control, input, select, textarea {
  font-family: var(--font-primary-body) !important;
  font-size: 14px !important;
  border-color: var(--border-color) !important;
  color: var(--text-primary) !important;
}

.form-control:focus, input:focus, select:focus, textarea:focus {
  border-color: var(--primary-blue) !important;
  box-shadow: 0 0 0 2px rgba(23, 120, 200, 0.15) !important;
}

table th, .aips-table th {
  background-color: var(--bg-surface-subtle) !important;
  color: var(--text-secondary) !important;
  font-family: var(--font-primary-body) !important;
  font-size: 12px !important;
  font-weight: 700 !important;
}

table td, .aips-table td {
  color: var(--text-primary) !important;
  font-size: 13.5px !important;
  border-bottom: 1px solid var(--divider-color) !important;
}

.card {
  background-color: #FFFFFF !important;
  border-color: var(--border-color) !important;
}

.hero-card {
  background-color: var(--bg-surface-subtle) !important;
  border-color: var(--border-color) !important;
  border-left: 4px solid var(--primary-blue) !important;
}
`;

if (!styleCss.includes('WORKSTATION TYPOGRAPHY ENFORCEMENT')) {
  styleCss += '\n' + typographyEnforcement;
}

fs.writeFileSync(stylePath, styleCss, 'utf8');
console.log("✔ Successfully updated style.css with typography enforcement rules");
