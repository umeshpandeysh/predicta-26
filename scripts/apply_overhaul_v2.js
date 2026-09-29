const fs = require('fs');
const path = require('path');

console.log("=========================================================================");
console.log("APPLYING PREDICTA TYPOGRAPHY + COLOR SYSTEM OVERHAUL v2");
console.log("=========================================================================");

// ── 1. WRITE COMPLETE CANONICAL style.css ────────────────────────────────────
const styleCssPath = path.join(__dirname, '..', 'style.css');

const v2StyleSheet = `/* =========================================================================
   PREDICTA SEMICONDUCTOR WORKSTATION DESIGN SYSTEM — OVERHAUL v2
   Authoritative Global Stylesheet
   ========================================================================= */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');

:root {
  /* ── 1. GLOBAL COLOR PALETTE (SEMICONDUCTOR WORKSTATION v2) ────────── */
  --bg-main: #F3F8FC;                 /* Canvas background */
  --bg-page: #F3F8FC;
  --bg-topnav: #FFFFFF;
  --bg-card: #FFFFFF;                 /* White card surface */
  --bg-surface: #FFFFFF;
  --bg-surface-secondary: #EAF4FB;    /* Secondary surface */
  --bg-surface-subtle: #EAF4FB;
  --bg-card-hover: #E2F0FC;
  --bg-input: #FFFFFF;

  --blue-tint: #E2F0FC;               /* Soft blue tint */
  --strong-blue-tint: #D5EBFA;        /* Deep blue tint for envelopes */
  --pale-blue: #E2F0FC;

  /* Primary Interaction Blues */
  --primary-blue: #0878C9;           /* Rich Technical Blue */
  --primary-blue-dark: #075A98;      /* Hover / Active state */
  --bright-blue: #1496E5;            /* Secondary interactive highlight */
  --accent: #0878C9;
  --accent-hover: #075A98;
  --accent-light: #E2F0FC;

  /* Analytical & Technical Accents */
  --accent-cyan: #16A6C8;            /* Telemetry, Drift & Forecast */
  --accent-indigo: #5B5FC7;          /* Analytical models, Validation, ML */
  --accent-teal: #16A6C8;

  /* Text Hierarchy */
  --text-primary: #102F4F;           /* Deep dark engineering navy */
  --text-headings: #10385F;          /* Deep rich navy for titles */
  --text-secondary: #45657F;         /* Technical slate body */
  --text-muted: #70879A;             /* Subdued helper text */
  --text-inverse: #FFFFFF;

  /* Borders & Dividers */
  --border-color: #C9DCEB;           /* Crisp light blue-gray card border */
  --border-tech: #C9DCEB;
  --border-strong: #AFC9DC;          /* Distinct active/focus border */
  --divider-color: #C9DCEB;

  /* Governed Status Palette */
  --color-pass: #128A61;             /* PASS / Healthy green */
  --color-pass-surface: #E3F6ED;
  --color-pass-border: #A7DFC9;
  --success: #128A61;
  --success-bg: #E3F6ED;

  --color-warning: #C98512;          /* MONITOR / Warning amber */
  --color-warning-surface: #FFF3D8;
  --color-warning-border: #F0CA6B;
  --warning: #C98512;
  --warning-bg: #FFF3D8;

  --color-reject: #D83D45;           /* REJECT / Anomaly red */
  --color-reject-surface: #FDE7E8;
  --color-reject-border: #F2A6AA;
  --critical: #D83D45;
  --critical-bg: #FDE7E8;

  --color-insufficient: #687B8B;     /* Neutral data unavailable */
  --color-insufficient-surface: #EDF1F4;
  --color-insufficient-border: #C9DCEB;

  /* ── 2. CANONICAL TYPOGRAPHY STACKS ────────────────────────────────── */
  --font-headings: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-display: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  --font-mono: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;

  /* ── 3. ELEVATION & SHADOWS ─────────────────────────────────────────── */
  --shadow-sm: 0 2px 4px rgba(16, 47, 79, 0.04);
  --shadow-md: 0 3px 8px rgba(16, 47, 79, 0.07);
  --shadow-lg: 0 8px 18px rgba(16, 47, 79, 0.10);
}

/* ── RESET & BASE BOX SIZING ──────────────────────────────────────────────── */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  background-color: var(--bg-main) !important;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-x: hidden !important;
  max-width: 100vw !important;
  width: 100%;
  min-height: 100vh;
}

.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--bg-main);
}

/* ── GLOBAL HEADING SCALE (LOCKED CANONICAL SYSTEM) ────────────────────────── */
h1, .page-title, .hero-title {
  font-family: var(--font-headings) !important;
  font-size: 36px !important;
  font-weight: 700 !important;
  line-height: 1.15 !important;
  letter-spacing: -0.025em !important;
  color: var(--text-headings) !important;
  margin-bottom: 8px;
}

h2, .section-title {
  font-family: var(--font-headings) !important;
  font-size: 28px !important;
  font-weight: 700 !important;
  line-height: 1.2 !important;
  letter-spacing: -0.02em !important;
  color: var(--text-headings) !important;
  margin-bottom: 12px;
}

h3, .card-title, .card-header-title {
  font-family: var(--font-headings) !important;
  font-size: 20px !important;
  font-weight: 700 !important;
  line-height: 1.3 !important;
  letter-spacing: -0.012em !important;
  color: var(--text-headings) !important;
  margin-bottom: 10px;
}

h4 {
  font-family: var(--font-headings) !important;
  font-size: 17px !important;
  font-weight: 600 !important;
  line-height: 1.35 !important;
  color: var(--text-headings) !important;
}

/* ── BODY & SUPPORTING TEXT SCALE ─────────────────────────────────────────── */
p, .page-subtitle, .hero-subtitle {
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.page-subtitle, .hero-subtitle {
  font-size: 15px !important;
  line-height: 1.55 !important;
  color: var(--text-secondary) !important;
}

.secondary-text {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.small-text, .text-muted, .helper-text {
  font-size: 13px !important;
  line-height: 1.45 !important;
  color: var(--text-muted) !important;
}

/* ── TECHNICAL OVERLINES ──────────────────────────────────────────────────── */
.technical-overline, .stat-label, .overline, .dossier-label {
  font-family: var(--font-sans) !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  letter-spacing: 0.09em !important;
  text-transform: uppercase !important;
  color: var(--primary-blue) !important;
  display: block;
}

/* ── TECHNICAL MONOSPACE & IDENTIFIERS ────────────────────────────────────── */
code, pre, .font-mono, .mono, [data-mono="true"], td.mono-cell, .tech-val, .hash-val, .param-val {
  font-family: var(--font-mono) !important;
  font-feature-settings: "tnum" 1;
}

/* ── METRIC HIERARCHY ─────────────────────────────────────────────────────── */
.stat-value, .metric-large, .kpi-value, .dossier-big-metric {
  font-family: var(--font-mono) !important;
  font-size: 28px !important;
  font-weight: 700 !important;
  color: var(--text-primary) !important;
  line-height: 1.2 !important;
}

.metric-secondary, .metric-mid, .metric-val {
  font-family: var(--font-mono) !important;
  font-size: 18px !important;
  font-weight: 650 !important;
  color: var(--text-primary) !important;
  line-height: 1.3 !important;
}

.metric-label {
  font-family: var(--font-sans) !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  color: var(--text-secondary) !important;
}

/* ── TOP NAVIGATION ───────────────────────────────────────────────────────── */
.topnav {
  background-color: var(--bg-topnav);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 1000;
  box-shadow: var(--shadow-sm);
}

.topnav-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  position: relative;
}

.brand-section {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  z-index: 2;
  flex-shrink: 0;
}

.brand-name {
  font-family: var(--font-headings) !important;
  font-weight: 700 !important;
  font-size: 22px !important;
  letter-spacing: 0.5px !important;
  color: var(--text-primary) !important;
  line-height: 1.2 !important;
}

.brand-subtitle {
  font-family: var(--font-sans) !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  color: var(--text-muted) !important;
}

.topnav-menu {
  display: flex;
  align-items: center;
  gap: 8px;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.nav-link {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary);
  font-family: var(--font-sans) !important;
  font-size: 15px !important;
  font-weight: 500 !important;
  padding: 9px 18px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.nav-link:hover {
  color: var(--primary-blue);
  background-color: var(--bg-surface-secondary);
}

.nav-link.active {
  color: var(--primary-blue-dark) !important;
  background-color: var(--blue-tint) !important;
  border-color: var(--border-color) !important;
  border-bottom: 2px solid var(--primary-blue) !important;
  font-weight: 650 !important;
}

/* ── BUTTONS ──────────────────────────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  font-family: var(--font-sans) !important;
  font-size: 15px !important;
  font-weight: 650 !important;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
  white-space: nowrap;
}

.btn-primary {
  background-color: var(--primary-blue) !important;
  color: #FFFFFF !important;
  border-color: var(--primary-blue) !important;
  box-shadow: 0 2px 4px rgba(8, 120, 201, 0.25);
}

.btn-primary:hover {
  background-color: var(--primary-blue-dark) !important;
  border-color: var(--primary-blue-dark) !important;
}

.btn-outline, .btn-secondary {
  background-color: #FFFFFF !important;
  border: 1px solid var(--border-color) !important;
  color: var(--text-primary) !important;
  font-size: 14px !important;
  font-weight: 600 !important;
  padding: 9px 18px;
}

.btn-outline:hover, .btn-secondary:hover {
  background-color: var(--bg-surface-secondary) !important;
  border-color: var(--border-strong) !important;
  color: var(--primary-blue) !important;
}

.btn-sm {
  padding: 6px 14px !important;
  font-size: 13px !important;
  font-weight: 600 !important;
}

.btn:focus-visible {
  outline: 2px solid var(--primary-blue);
  outline-offset: 2px;
}

/* ── STATUS BADGES ────────────────────────────────────────────────────────── */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 4px;
  font-family: var(--font-mono) !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  letter-spacing: 0.02em;
  line-height: 1.4;
  white-space: nowrap;
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

/* ── FORMS & INPUTS ───────────────────────────────────────────────────────── */
label, .form-label {
  font-family: var(--font-sans) !important;
  font-size: 14px !important;
  font-weight: 600 !important;
  color: var(--text-primary) !important;
  margin-bottom: 7px;
  display: block;
}

.form-control, input, select, textarea {
  width: 100%;
  font-family: var(--font-sans) !important;
  font-size: 15px !important;
  font-weight: 500 !important;
  padding: 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: var(--bg-input) !important;
  color: var(--text-primary) !important;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  box-sizing: border-box;
}

.form-control:focus, input:focus, select:focus, textarea:focus {
  outline: none !important;
  border-color: var(--primary-blue) !important;
  box-shadow: 0 0 0 3px rgba(8, 120, 201, 0.18) !important;
}

::placeholder {
  font-size: 14px;
  color: var(--text-muted);
  font-weight: 400;
}

/* ── TABLES ───────────────────────────────────────────────────────────────── */
.table-container {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

table, .aips-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-sans);
  text-align: left;
}

th, .aips-table th {
  background-color: var(--bg-surface-secondary) !important;
  color: var(--text-secondary) !important;
  font-family: var(--font-sans) !important;
  font-size: 13px !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.06em !important;
  padding: 12px 16px !important;
  border-bottom: 1px solid var(--border-color) !important;
  white-space: nowrap;
}

td, .aips-table td {
  padding: 12px 16px !important;
  border-bottom: 1px solid var(--divider-color) !important;
  color: var(--text-primary) !important;
  font-size: 14px !important;
  white-space: nowrap;
}

tr:hover td, .aips-table tr:hover td {
  background-color: var(--bg-surface-secondary) !important;
}

/* ── CARDS & SURFACES ─────────────────────────────────────────────────────── */
.card {
  background-color: var(--bg-card) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: 8px;
  padding: 22px;
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}

.card:hover {
  border-color: var(--border-strong) !important;
  box-shadow: var(--shadow-md);
}

.hero-card {
  background-color: var(--bg-surface-secondary) !important;
  border: 1px solid var(--border-color) !important;
  border-left: 4px solid var(--primary-blue) !important;
  border-radius: 8px;
  padding: 32px 28px;
  margin-bottom: 24px;
  box-shadow: var(--shadow-sm);
}

/* ── ADVANCED SUBTABS BAR ─────────────────────────────────────────────────── */
.adv-tab-btn {
  font-family: var(--font-sans) !important;
  font-size: 13.5px !important;
  font-weight: 600 !important;
  padding: 8px 14px !important;
  border-radius: 6px !important;
  border: 1px solid var(--border-color) !important;
  background-color: #FFFFFF !important;
  color: var(--text-primary) !important;
  transition: all 0.15s ease;
}

.adv-tab-btn:hover {
  background-color: var(--blue-tint) !important;
  border-color: var(--border-strong) !important;
  color: var(--primary-blue) !important;
}

.adv-tab-btn.active {
  background-color: var(--blue-tint) !important;
  border-color: var(--primary-blue) !important;
  border-bottom: 2px solid var(--primary-blue) !important;
  color: var(--primary-blue-dark) !important;
  font-weight: 700 !important;
}

/* ── MAIN CONTENT CONTAINER & GRIDS ───────────────────────────────────────── */
.main-content {
  flex: 1;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  padding: 24px 20px 40px 20px;
}

.page-view {
  display: none;
}

.page-view.active {
  display: block;
}

/* Responsive Grids */
.grid-hero {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 28px;
  align-items: center;
}

.grid-kpi-4,
.kpi-summary-container {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 28px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.grid-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

.grid-three-col {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.grid-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.grid-3col {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}

.grid-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

/* Responsive Breakpoints */
@media (max-width: 992px) {
  .grid-three-col, .grid-two-col, .grid-hero {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 768px) {
  .topnav-menu {
    display: none;
    position: absolute;
    top: 64px;
    left: 0;
    right: 0;
    background-color: #ffffff;
    flex-direction: column;
    padding: 8px 16px;
    border-bottom: 1px solid var(--border-color);
    box-shadow: var(--shadow-md);
    z-index: 1000;
  }
  .topnav-menu.mobile-open {
    display: flex;
  }
  .nav-link {
    width: 100%;
    text-align: left;
    padding: 12px 16px;
    min-height: 44px;
  }
  .grid-kpi-4, .kpi-summary-container {
    grid-template-columns: 1fr !important;
  }
  *[style*="grid-template-columns"], .grid-hero, .grid-2col, .grid-3col, .grid-metrics, .grid-two-col, .grid-three-col {
    grid-template-columns: 1fr !important;
    gap: 12px !important;
  }
  .card-title {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 8px !important;
  }
}
`;

fs.writeFileSync(styleCssPath, v2StyleSheet, 'utf8');
console.log("✔ Successfully generated authoritative style.css with v2 design tokens and typography scale");

// ── 2. RECONCILE build_restored_frontend.js ──────────────────────────────────
const buildPath = path.join(__dirname, '..', 'build_restored_frontend.js');
let buildJs = fs.readFileSync(buildPath, 'utf8');

// Update Build Marker
buildJs = buildJs.replace(/const buildMarker = "[^"]*";/g, 'const buildMarker = "PREDICTA-BUILD-OVERHAUL-V2";');
buildJs = buildJs.replace(/function generateRestoredHtml\(buildMarker = "[^"]*"\)/g, 'function generateRestoredHtml(buildMarker = "PREDICTA-BUILD-OVERHAUL-V2")');

// Replace all outdated hex codes in build_restored_frontend.js with v2 palette
const hexMap = [
  // Primary Dark Navy
  [/#123B63/g, '#102F4F'],
  [/#12365B/g, '#102F4F'],
  // Secondary Slate
  [/#475569/g, '#45657F'],
  [/#4A6680/g, '#45657F'],
  // Muted Helper
  [/#64748B/g, '#70879A'],
  [/#71869A/g, '#70879A'],
  // Primary Blue
  [/#1976B8/g, '#0878C9'],
  [/#1778C8/g, '#0878C9'],
  [/#125B91/g, '#075A98'],
  [/#0F5FA8/g, '#075A98'],
  // Borders
  [/#D8E5EF/g, '#C9DCEB'],
  [/#D5E3EF/g, '#C9DCEB'],
  [/#E2E8F0/g, '#C9DCEB'],
  // Surfaces
  [/#EAF4FB/g, '#EAF4FB'],
  [/#F0F6FB/g, '#EAF4FB'],
  [/#F8FAFC/g, '#F3F8FC'],
  // Status Red / Reject
  [/#DC2626/g, '#D83D45'],
  [/#D94A4A/g, '#D83D45'],
  [/#991B1B/g, '#D83D45'],
  [/#FDEAEA/g, '#FDE7E8'],
  [/#FEF2F2/g, '#FDE7E8'],
  [/#FEE2E2/g, '#FDE7E8'],
  [/#FCA5A5/g, '#F2A6AA'],
  // Status Amber / Warning / Monitor
  [/#D97706/g, '#C98512'],
  [/#C88716/g, '#C98512'],
  [/#FFF4D9/g, '#FFF3D8'],
  [/#FEF3C7/g, '#FFF3D8'],
  [/#FFFBEB/g, '#FFF3D8'],
  [/#FCD34D/g, '#F0CA6B'],
  [/#FDE68A/g, '#F0CA6B'],
  // Status Green / Pass
  [/#059669/g, '#128A61'],
  [/#159A68/g, '#128A61'],
  [/#16A34A/g, '#128A61'],
  [/#10B981/g, '#128A61'],
  [/#E7F7EF/g, '#E3F6ED'],
  [/#F0FDF4/g, '#E3F6ED'],
  [/#BBF7D0/g, '#A7DFC9'],
  [/#B2E7D1/g, '#A7DFC9']
];

for (const [pattern, rep] of hexMap) {
  buildJs = buildJs.replace(pattern, rep);
}

// Normalize all page titles to 36px, font-family: var(--font-headings), font-weight: 700, letter-spacing: -0.025em, color: #10385F
buildJs = buildJs.replace(/class="page-title"[^>]*>([^<]*)<\/h1>/g, 'class="page-title" style="font-size:36px; color:#10385F; font-family:var(--font-headings); font-weight:700; line-height:1.15; letter-spacing:-0.025em; margin-bottom:8px;">$1</h1>');

// Normalize all section titles (h2)
buildJs = buildJs.replace(/<h2([^>]*)style="([^"]*)"([^>]*)>/g, (m, p1, style, p2) => {
  return `<h2${p1}style="font-size:28px; color:#10385F; font-family:var(--font-headings); font-weight:700; line-height:1.2; letter-spacing:-0.02em; margin-bottom:12px; ${style}"${p2}>`;
});

// Update brand name
buildJs = buildJs.replace(/class="brand-name"[^>]*>PREDICTA<\/div>/g, 'class="brand-name" style="font-family:var(--font-headings); font-weight:700; font-size:22px; color:#102F4F; line-height:1.2; letter-spacing:0.5px;">PREDICTA</div>');

fs.writeFileSync(buildPath, buildJs, 'utf8');
console.log("✔ Successfully updated build_restored_frontend.js with v2 palette and locked type scale");

// ── 3. UPDATE synth_script.js CHART AND CONTROLLER COLORS ────────────────────
const synthPath = path.join(__dirname, '..', 'synth_script.js');
let synthJs = fs.readFileSync(synthPath, 'utf8');

for (const [pattern, rep] of hexMap) {
  synthJs = synthJs.replace(pattern, rep);
}

// Chart series standardization in synth_script.js
synthJs = synthJs.replace(/#0284C7/g, '#0878C9'); // Observed/median
synthJs = synthJs.replace(/#1778C8/g, '#0878C9');
synthJs = synthJs.replace(/#BAE6FD/g, '#D5EBFA'); // Lot envelope
synthJs = synthJs.replace(/#DCEEFF/g, '#D5EBFA');
synthJs = synthJs.replace(/#7DD3FC/g, '#AFC9DC'); // Envelope border
synthJs = synthJs.replace(/#BFD4E5/g, '#AFC9DC');
synthJs = synthJs.replace(/#DC2626/g, '#D83D45'); // Spec limit
synthJs = synthJs.replace(/#D94A4A/g, '#D83D45');
synthJs = synthJs.replace(/#D97706/g, '#C98512'); // Amber warning
synthJs = synthJs.replace(/#C88716/g, '#C98512');
synthJs = synthJs.replace(/#059669/g, '#128A61'); // Green pass
synthJs = synthJs.replace(/#159A68/g, '#128A61');

fs.writeFileSync(synthPath, synthJs, 'utf8');
console.log("✔ Successfully updated synth_script.js with v2 chart and badge tokens");
