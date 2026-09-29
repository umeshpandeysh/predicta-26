const fs = require('fs');
const path = require('path');

console.log("=== APPLYING GLOBAL TYPOGRAPHY & COLOR SYSTEM REDESIGN ===");

// 1. UPDATE style.css
const styleCssPath = path.join(__dirname, '..', 'style.css');
let styleCss = fs.readFileSync(styleCssPath, 'utf8');

// Replace font imports and :root tokens
const oldRootMatch = styleCss.slice(0, styleCss.indexOf('* {'));
const newRootAndBase = `/* PREDICTA — SEMICONDUCTOR ENGINEERING WORKSTATION DESIGN SYSTEM */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');

:root {
  /* ── 1. COLOR SYSTEM TOKENS ────────────────────────────────────────── */
  /* Page & Workspace Backgrounds */
  --bg-main: #F5F9FD;                  /* Light cool-blue workspace canvas */
  --bg-page: #F5F9FD;
  --bg-topnav: #FFFFFF;                /* Pristine white navbar */
  --bg-card: #FFFFFF;                  /* Clean white card surface */
  --bg-surface: #FFFFFF;
  --bg-surface-subtle: #F0F6FB;         /* Soft technical tint */
  --bg-card-hover: #F0F6FB;
  --bg-input: #FFFFFF;

  /* Text & Content Tokens */
  --text-primary: #12365B;            /* Deep engineering navy */
  --text-secondary: #4A6680;          /* Technical slate-blue */
  --text-muted: #71869A;              /* Subdued slate helper */
  --text-inverse: #FFFFFF;

  /* Primary Interaction Blues */
  --primary-blue: #1778C8;            /* Technical primary blue */
  --primary-blue-dark: #0F5FA8;       /* Primary blue hover / active */
  --accent: #1778C8;
  --accent-hover: #0F5FA8;
  --light-blue: #DCEEFF;              /* Soft blue badge / envelope */
  --pale-blue: #EDF6FD;               /* Subdued active surface */
  --accent-light: #EDF6FD;

  /* Secondary Technical & Analytical Accents */
  --accent-cyan: #1FA6C9;             /* Technical telemetry accent */
  --accent-indigo: #5B63C7;           /* Analytical / model distinction */
  --accent-teal: #1FA6C9;

  /* Borders & Dividers */
  --border-color: #D5E3EF;            /* Subtle card & panel border */
  --border-tech: #D5E3EF;
  --border-strong: #BFD4E5;           /* Distinct interactive border */
  --divider-color: #DCE7F0;           /* Table & list row divider */

  /* Governed Status Palette */
  --color-pass: #159A68;              /* PASS / Healthy green */
  --color-pass-surface: #E7F7EF;
  --color-pass-border: #B2E7D1;
  --success: #159A68;
  --success-bg: #E7F7EF;

  --color-warning: #C88716;           /* MONITOR / Warning amber */
  --color-warning-surface: #FFF4D9;
  --color-warning-border: #FCD34D;
  --warning: #C88716;
  --warning-bg: #FFF4D9;

  --color-reject: #D94A4A;            /* REJECT / Anomaly red */
  --color-reject-surface: #FDEAEA;
  --color-reject-border: #FCA5A5;
  --critical: #D94A4A;
  --critical-bg: #FDEAEA;

  --color-insufficient: #687B8D;      /* Neutral / Data unavailable */
  --color-insufficient-surface: #EEF2F5;
  --color-insufficient-border: #CBD5E1;

  /* ── 2. TYPOGRAPHY SYSTEM TOKENS ────────────────────────────────────── */
  --font-headings: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-display: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  --font-mono: 'JetBrains Mono', 'Cascadia Code', 'Source Code Pro', Menlo, Monaco, Consolas, monospace;

  /* ── 3. ELEVATION & SHADOWS ─────────────────────────────────────────── */
  --shadow-sm: 0 1px 3px rgba(18, 54, 91, 0.05);
  --shadow-md: 0 3px 8px rgba(18, 54, 91, 0.07);
  --shadow-lg: 0 8px 16px rgba(18, 54, 91, 0.09);
}

`;

styleCss = newRootAndBase + styleCss.slice(styleCss.indexOf('* {'));

// Update typography rules throughout style.css
const baseTypographyRules = `
/* ── GLOBAL TYPOGRAPHY & ELEMENT DEFAULTS ─────────────────────────────────── */
html, body {
  background-color: var(--bg-main);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-x: hidden !important;
  max-width: 100vw !important;
  width: 100%;
  min-height: 100vh;
}

h1, .page-title, .hero-title {
  font-family: var(--font-headings);
  font-size: 34px;
  font-weight: 700;
  line-height: 1.22;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  margin-bottom: 8px;
}

h2, .section-title {
  font-family: var(--font-headings);
  font-size: 26px;
  font-weight: 700;
  line-height: 1.28;
  color: var(--text-primary);
  letter-spacing: -0.015em;
  margin-bottom: 12px;
}

h3, .card-title {
  font-family: var(--font-headings);
  font-size: 19px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-primary);
  letter-spacing: -0.01em;
  margin-bottom: 10px;
}

h4 {
  font-family: var(--font-headings);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--text-primary);
}

p, .page-subtitle, .hero-subtitle {
  font-family: var(--font-sans);
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.page-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.55;
}

.technical-overline, .stat-label, .overline, .dossier-label {
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--primary-blue);
  display: block;
}

/* Technical Monospace Elements */
code, pre, .font-mono, .mono, [data-mono="true"], td.mono-cell, .tech-val, .hash-val, .param-val {
  font-family: var(--font-mono);
  font-feature-settings: "tnum" 1;
}

/* Metric Hierarchy */
.stat-value, .metric-large, .kpi-value {
  font-family: var(--font-mono);
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.metric-secondary, .metric-mid {
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 9px 18px;
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
  white-space: nowrap;
}

.btn-primary {
  background-color: var(--primary-blue);
  color: #FFFFFF;
  border-color: var(--primary-blue);
  box-shadow: 0 1px 2px rgba(23, 120, 200, 0.2);
}

.btn-primary:hover {
  background-color: var(--primary-blue-dark);
  border-color: var(--primary-blue-dark);
}

.btn-outline {
  background-color: #FFFFFF;
  border-color: var(--border-color);
  color: var(--text-primary);
}

.btn-outline:hover {
  background-color: var(--bg-surface-subtle);
  border-color: var(--border-strong);
  color: var(--primary-blue);
}

.btn-sm {
  padding: 5px 12px;
  font-size: 12.5px;
  font-weight: 600;
}

/* Status Badges */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.4;
  white-space: nowrap;
}

.badge.pass {
  background-color: var(--color-pass-surface);
  color: var(--color-pass);
  border: 1px solid var(--color-pass-border);
}

.badge.monitor, .badge.warning {
  background-color: var(--color-warning-surface);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-border);
}

.badge.reject, .badge.critical {
  background-color: var(--color-reject-surface);
  color: var(--color-reject);
  border: 1px solid var(--color-reject-border);
}

.badge.insufficient, .badge.info {
  background-color: var(--color-insufficient-surface);
  color: var(--color-insufficient);
  border: 1px solid var(--color-insufficient-border);
}

/* Navbar */
.topnav {
  background-color: var(--bg-topnav);
  border-bottom: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
}

.brand-name {
  font-family: var(--font-headings);
  font-weight: 700;
  font-size: 20px;
  letter-spacing: 0.5px;
  color: var(--text-primary);
}

.nav-link {
  font-family: var(--font-sans);
  font-size: 14.5px;
  font-weight: 500;
  color: var(--text-secondary);
  padding: 8px 16px;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.nav-link:hover {
  color: var(--primary-blue);
  background-color: var(--bg-surface-subtle);
}

.nav-link.active {
  color: var(--primary-blue-dark);
  background-color: var(--pale-blue);
  font-weight: 600;
}

/* Forms & Controls */
label, .form-label {
  font-family: var(--font-sans);
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
  display: block;
}

.form-control, input, select, textarea {
  font-family: var(--font-sans);
  font-size: 14px;
  padding: 9px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.form-control:focus, input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--primary-blue);
  box-shadow: 0 0 0 2px rgba(23, 120, 200, 0.15);
}

::placeholder {
  color: var(--text-muted);
  font-weight: 400;
}

/* Tables */
table, .aips-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-sans);
}

th, .aips-table th {
  background-color: var(--bg-surface-subtle);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 11px 14px;
  border-bottom: 1px solid var(--border-color);
}

td, .aips-table td {
  font-size: 13.5px;
  color: var(--text-primary);
  padding: 11px 14px;
  border-bottom: 1px solid var(--divider-color);
}

tr:hover td, .aips-table tr:hover td {
  background-color: var(--bg-surface-subtle);
}

/* Cards */
.card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 20px;
  box-shadow: var(--shadow-sm);
}

.hero-card {
  background-color: var(--bg-surface-subtle);
  border: 1px solid var(--border-color);
  border-left: 4px solid var(--primary-blue);
  border-radius: 8px;
  padding: 28px;
  box-shadow: var(--shadow-sm);
}
`;

// Insert the updated base typography right after root
const afterRootIdx = styleCss.indexOf('/* App Container Layout */');
if (afterRootIdx !== -1) {
  styleCss = styleCss.substring(0, afterRootIdx) + baseTypographyRules + '\n' + styleCss.substring(afterRootIdx);
}

// Global search & replace of outdated hex values to the new design token values
const replacements = [
  ['#123B63', 'var(--text-primary)'],
  ['#475569', 'var(--text-secondary)'],
  ['#64748B', 'var(--text-muted)'],
  ['#1976B8', 'var(--primary-blue)'],
  ['#125B91', 'var(--primary-blue-dark)'],
  ['#D8E5EF', 'var(--border-color)'],
  ['#EAF4FB', 'var(--bg-surface-subtle)']
];

// Write updated style.css
fs.writeFileSync(styleCssPath, styleCss, 'utf8');
console.log("✔ Successfully updated style.css with global design system tokens.");

// 2. UPDATE build_restored_frontend.js
const buildPath = path.join(__dirname, '..', 'build_restored_frontend.js');
let buildJs = fs.readFileSync(buildPath, 'utf8');

// Ensure <head> contains Google Fonts link
const oldHead = `<title>PREDICTA — Semiconductor Predictive Screening Workstation</title>
  <script>window.PREDICTA_BUILD_ID = "\${buildMarker}";</script>
  <link rel="stylesheet" href="style.css?v=\${buildMarker}">`;

const newHead = `<title>PREDICTA — Semiconductor Predictive Screening Workstation</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <script>window.PREDICTA_BUILD_ID = "\${buildMarker}";</script>
  <link rel="stylesheet" href="style.css?v=\${buildMarker}">`;

if (buildJs.includes(oldHead)) {
  buildJs = buildJs.replace(oldHead, newHead);
  console.log("✔ Added Google Fonts <link> tags to build_restored_frontend.js <head>");
}

// Update Page Title and Heading sizes in build_restored_frontend.js
buildJs = buildJs.replace(/font-size:\s*28px;\s*color:\s*#123B63;/g, 'font-size:34px; color:#12365B; font-family:var(--font-headings);');
buildJs = buildJs.replace(/font-size:\s*24px;\s*color:\s*#123B63;/g, 'font-size:26px; color:#12365B; font-family:var(--font-headings);');
buildJs = buildJs.replace(/font-size:\s*22px;\s*color:\s*#123B63;/g, 'font-size:26px; color:#12365B; font-family:var(--font-headings);');
buildJs = buildJs.replace(/font-size:\s*18px;\s*color:\s*#123B63;/g, 'font-size:19px; color:#12365B; font-family:var(--font-headings);');

// Update brand name
buildJs = buildJs.replace(/font-family:var\(--font-display\);/g, 'font-family:var(--font-headings);');

// Update table row styling in generate256Rows
buildJs = buildJs.replace(
  `'<td style="padding:8px;font-weight:700;color:#123B63;">'`,
  `'<td style="padding:10px 12px;font-weight:700;font-family:var(--font-mono);color:#12365B;">'`
);
buildJs = buildJs.replace(
  `'<td style="padding:8px;font-family:var(--font-mono);color:#475569;">'`,
  `'<td style="padding:10px 12px;font-family:var(--font-mono);color:#4A6680;">'`
);

fs.writeFileSync(buildPath, buildJs, 'utf8');
console.log("✔ Successfully updated build_restored_frontend.js.");

// 3. UPDATE synth_script.js Chart Colors
const synthPath = path.join(__dirname, '..', 'synth_script.js');
let synthJs = fs.readFileSync(synthPath, 'utf8');

// Standardize chart colors in renderComponentVsLotChart
synthJs = synthJs.replace(/#0284C7/g, '#1778C8'); // Primary Blue for median
synthJs = synthJs.replace(/#BAE6FD/g, '#DCEEFF'); // Light Blue for envelope
synthJs = synthJs.replace(/#7DD3FC/g, '#BFD4E5'); // Border for envelope
synthJs = synthJs.replace(/#DC2626/g, '#D94A4A'); // Standardized Reject/Limit Red
synthJs = synthJs.replace(/#D97706/g, '#C88716'); // Standardized Warning/Monitor Amber
synthJs = synthJs.replace(/#059669/g, '#159A68'); // Standardized Pass Green

fs.writeFileSync(synthPath, synthJs, 'utf8');
console.log("✔ Successfully updated synth_script.js chart colors.");
