const fs = require('fs');
const path = require('path');

console.log("=========================================================================");
console.log("PREDICTA — RESTORING LAST GOOD DESIGN & APPLYING CLEAN TYPOGRAPHY + COLOR");
console.log("=========================================================================");

// ── 1. GENERATE AUTHENTIC, COMPLETE style.css ─────────────────────────────────
const styleCssPath = path.join(__dirname, '..', 'style.css');

const restoredStyleCss = `/* =========================================================================
   PREDICTA SEMICONDUCTOR TEST WORKSTATION — INDUSTRIAL CLEAN STYLESHEET
   Authentic Layout Restored + Unified Modern Typography & Governed Color System
   ========================================================================= */

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');

:root {
  /* ── Canvas & Surfaces ─────────────────────────────────────────────── */
  --bg-main: #F3F8FC;                 /* Canvas background */
  --bg-page: #F3F8FC;
  --bg-topnav: #FFFFFF;               /* Navbar background */
  --bg-card: #FFFFFF;                 /* Clean white card surface */
  --bg-card-hover: #EAF4FB;
  --bg-surface: #FFFFFF;
  --bg-surface-secondary: #EAF4FB;    /* Soft blue surface */
  --bg-surface-subtle: #EAF4FB;
  --bg-input: #FFFFFF;
  
  --blue-tint: #EAF4FB;               /* Soft blue tint */
  --light-blue: #DCEFFC;              /* Light blue for envelopes/accents */
  --strong-blue-tint: #DCEFFC;
  --pale-blue: #EAF4FB;
  
  /* ── Primary Interaction Blues ──────────────────────────────────────── */
  --primary-blue: #0878C9;           /* Rich Technical Blue */
  --primary-blue-dark: #075A98;      /* Hover / Active state */
  --bright-blue: #1496E5;            /* Secondary interactive highlight */
  --accent: #0878C9;
  --accent-hover: #075A98;
  --accent-light: #EAF4FB;
  
  /* ── Analytical & Technical Accents ─────────────────────────────────── */
  --accent-cyan: #18A6C8;            /* Telemetry, Drift & Forecast */
  --accent-indigo: #5B61C7;          /* Analytical models, Validation, ML */
  --accent-teal: #18A6C8;
  
  /* ── Text Hierarchy ─────────────────────────────────────────────────── */
  --text-primary: #102F4F;           /* Deep dark engineering navy */
  --text-headings: #10385F;          /* Deep rich navy for titles */
  --text-secondary: #45657F;         /* Technical slate body */
  --text-muted: #72889A;             /* Subdued helper text */
  --text-inverse: #FFFFFF;
  
  /* ── Borders & Dividers ─────────────────────────────────────────────── */
  --border-tech: #C9DCEB;            /* Crisp light blue-gray card border */
  --border-color: #C9DCEB;
  --border-strong: #AFC7DA;          /* Distinct active/focus border */
  --divider-color: #C9DCEB;
  
  /* ── Governed Status Palette ────────────────────────────────────────── */
  --success: #159A68;                /* PASS / Healthy green */
  --success-bg: #E5F7EF;
  --color-pass: #159A68;
  --color-pass-surface: #E5F7EF;
  --color-pass-border: #A7DFC9;

  --warning: #C98A18;                /* MONITOR / Warning amber */
  --warning-bg: #FFF2D5;
  --color-warning: #C98A18;
  --color-warning-surface: #FFF2D5;
  --color-warning-border: #F0CA6B;

  --critical: #D8444B;               /* REJECT / Anomaly red */
  --critical-bg: #FDE8E9;
  --color-reject: #D8444B;
  --color-reject-surface: #FDE8E9;
  --color-reject-border: #F2A6AA;

  --color-insufficient: #687B8A;     /* Neutral data unavailable */
  --color-insufficient-surface: #EDF1F4;
  --color-insufficient-border: #C9DCEB;
  
  /* ── Canonical Typography Stacks ───────────────────────────────────── */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  --font-headings: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-display: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace;
  
  /* ── Elevation & Shadows ────────────────────────────────────────────── */
  --shadow-sm: 0 1px 3px 0 rgba(16, 47, 79, 0.04), 0 1px 2px 0 rgba(16, 47, 79, 0.02);
  --shadow-md: 0 3px 8px -1px rgba(16, 47, 79, 0.07), 0 2px 4px -1px rgba(16, 47, 79, 0.04);
  --shadow-lg: 0 8px 18px -2px rgba(16, 47, 79, 0.10);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  background-color: var(--bg-main);
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

/* App Container Layout */
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--bg-main);
}

/* ── TOP NAVIGATION BAR ───────────────────────────────────────────────────── */
.topnav {
  background-color: var(--bg-topnav);
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-tech);
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
  font-family: var(--font-headings);
  font-weight: 700;
  font-size: 22px;
  letter-spacing: 0.5px;
  color: var(--text-primary);
  line-height: 1.2;
}

.brand-subtitle {
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
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
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 500;
  padding: 8px 16px;
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
  color: var(--primary-blue-dark);
  background-color: var(--blue-tint);
  border-color: var(--border-tech);
  border-bottom: 2px solid var(--primary-blue);
  font-weight: 600;
}

.topnav-status {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--bg-surface-secondary);
  border: 1px solid var(--border-tech);
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--success);
}

.hamburger-btn {
  display: none;
  background: transparent;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  padding: 4px;
}

/* ── MAIN CONTENT AREA ────────────────────────────────────────────────────── */
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

/* Breadcrumb & Page Header */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.breadcrumb span.active-crumb {
  color: var(--accent);
  font-weight: 600;
}

.page-header {
  margin-bottom: 24px;
}

/* ── UNIFIED HEADING SCALE ────────────────────────────────────────────────── */
h1, .page-title, .hero-title {
  font-family: var(--font-headings);
  font-size: 36px;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.025em;
  color: var(--text-headings);
  margin-bottom: 8px;
}

h2, .section-title {
  font-family: var(--font-headings);
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--text-headings);
  margin-bottom: 12px;
}

h3, .card-title, .card-header-title {
  font-family: var(--font-headings);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.012em;
  color: var(--text-headings);
  margin-bottom: 10px;
}

h4 {
  font-family: var(--font-headings);
  font-size: 17px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-headings);
}

/* ── BODY & SUPPORTING TEXT SCALE ─────────────────────────────────────────── */
p {
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.page-subtitle, .hero-subtitle, .secondary-text {
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.small-text, .text-muted, .helper-text {
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.45;
  color: var(--text-muted);
}

/* ── TECHNICAL OVERLINES ──────────────────────────────────────────────────── */
.technical-overline, .stat-label, .overline, .dossier-label {
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--primary-blue);
  display: block;
}

/* ── TECHNICAL MONOSPACE & IDENTIFIERS ────────────────────────────────────── */
code, pre, .font-mono, .mono, [data-mono="true"], td.mono-cell, .tech-val, .hash-val, .param-val {
  font-family: var(--font-mono);
  font-feature-settings: "tnum" 1;
}

/* ── METRIC HIERARCHY ─────────────────────────────────────────────────────── */
.stat-value, .metric-large, .kpi-value, .dossier-big-metric {
  font-family: var(--font-mono);
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.metric-secondary, .metric-mid, .metric-val {
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 650;
  color: var(--text-primary);
  line-height: 1.3;
}

.metric-label {
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

/* ── CARD STYLING ─────────────────────────────────────────────────────────── */
.card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-tech);
  border-radius: 8px;
  padding: 20px;
  box-shadow: var(--shadow-sm);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.card:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}

.card-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Hero Section */
.hero-card {
  background-color: var(--bg-surface-secondary);
  border: 1px solid var(--border-tech);
  border-left: 4px solid var(--accent);
  border-radius: 8px;
  padding: 28px;
  margin-bottom: 24px;
  box-shadow: var(--shadow-sm);
}

/* Responsive Structural Helper Grids */
.grid-hero {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 32px;
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

.kpi-summary-container > .card {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.grid-workflow-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 28px;
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

.metric-row-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-tech);
  padding-bottom: 6px;
  gap: 8px;
  flex-wrap: wrap;
}

/* ── BUTTONS ──────────────────────────────────────────────────────────────── */
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
  background-color: var(--accent);
  color: #ffffff;
  border-color: var(--accent);
  box-shadow: 0 2px 4px rgba(8, 120, 201, 0.2);
}

.btn-primary:hover {
  background-color: var(--accent-hover);
  border-color: var(--accent-hover);
}

.btn-outline {
  background-color: #ffffff;
  border: 1px solid var(--border-tech);
  color: var(--text-primary);
  font-weight: 600;
}

.btn-outline:hover {
  background-color: var(--bg-card-hover);
  border-color: var(--border-strong);
  color: var(--primary-blue);
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
}

.btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Grid Layouts */
.grid-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
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

/* Stat Box */
.stat-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* ── STATUS BADGES ────────────────────────────────────────────────────────── */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
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

/* ── TABLES ───────────────────────────────────────────────────────────────── */
.table-container {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.aips-table, .table-compact {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-family: var(--font-sans);
  font-size: 14px;
}

.aips-table th, .table-compact th, th {
  background-color: var(--bg-surface-secondary);
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-tech);
  white-space: nowrap;
}

.aips-table td, .table-compact td, td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-tech);
  color: var(--text-primary);
  font-size: 14px;
  white-space: nowrap;
}

.aips-table tr:hover td, .table-compact tr:hover td {
  background-color: var(--bg-card-hover);
}

/* ── FORMS & INPUTS ───────────────────────────────────────────────────────── */
label, .form-label {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
  display: block;
}

.form-control, input, select, textarea {
  width: 100%;
  padding: 8px 12px;
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 500;
  border: 1px solid var(--border-tech);
  border-radius: 6px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  box-sizing: border-box;
}

.form-control:focus, input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--primary-blue);
  box-shadow: 0 0 0 3px rgba(8, 120, 201, 0.15);
}

::placeholder {
  font-size: 14px;
  color: var(--text-muted);
  font-weight: 400;
}

/* Card Controls & Filter Groups */
.card-controls-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.card-control-select {
  width: auto;
  min-width: 130px;
}

.filter-controls-group {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  width: 100%;
}

.filter-search-box {
  flex: 1;
  min-width: 180px;
}

.filter-select-box {
  width: 160px;
}

.catalog-search-box {
  width: 220px;
}

/* Timeline Track */
.timeline-track {
  display: flex;
  justify-content: space-between;
  position: relative;
  margin: 30px 0 10px 0;
}

.timeline-line {
  position: absolute;
  top: 10px;
  left: 0;
  right: 0;
  height: 3px;
  background-color: var(--border-tech);
  z-index: 1;
}

.timeline-progress {
  position: absolute;
  top: 10px;
  left: 0;
  width: 33%;
  height: 3px;
  background-color: var(--accent);
  z-index: 2;
}

.timeline-node {
  position: relative;
  z-index: 3;
  text-align: center;
  background-color: var(--bg-card);
  padding: 0 6px;
}

.timeline-node::before {
  content: '';
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: var(--bg-card);
  border: 3px solid var(--border-tech);
  margin: 0 auto 8px auto;
}

.timeline-node.passed::before {
  border-color: var(--success);
  background-color: var(--success);
}

.timeline-node.active::before {
  border-color: var(--accent);
  background-color: var(--accent);
}

.timeline-node-label {
  font-size: 12px;
  font-weight: 600;
}

.timeline-prediction-flag {
  position: absolute;
  top: -24px;
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--accent);
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

/* ==========================================================================
   ADVANCED WORKSTATION SUBTABS & CONTROLS
   ========================================================================== */
.adv-tab-btn {
  font-family: var(--font-sans);
  font-size: 13.5px;
  font-weight: 600;
  padding: 8px 14px;
  border-radius: 6px;
  border: 1px solid var(--border-tech);
  background-color: #FFFFFF;
  color: var(--text-primary);
  margin-bottom: -2px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s ease;
}

.adv-tab-btn:hover {
  background-color: var(--blue-tint);
  border-color: var(--border-strong);
  color: var(--primary-blue);
}

.adv-tab-btn.active {
  background-color: var(--blue-tint);
  border-color: var(--primary-blue);
  border-bottom: 2px solid var(--primary-blue);
  color: var(--primary-blue-dark);
  font-weight: 700;
}

.btn-report-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-report-action.primary {
  background: var(--primary-blue);
  border: 1px solid var(--primary-blue);
  color: #FFFFFF;
}

.btn-report-action.primary:hover {
  background: var(--primary-blue-dark);
  border-color: var(--primary-blue-dark);
}

.btn-report-action.outline {
  background: #FFFFFF;
  border: 1px solid var(--border-tech);
  color: var(--text-primary);
}

.btn-report-action.outline:hover {
  background: var(--bg-surface-secondary);
  border-color: var(--border-strong);
  color: var(--primary-blue);
}

/* ==========================================================================
   ADMIN PANEL, DRIFT & RELIABILITY PANEL
   ========================================================================== */
.admin-tab-panel {
  display: block;
}

.admin-tab-btn.active {
  border-bottom: 2px solid var(--accent);
  color: var(--accent);
}

.admin-tab-btn:hover {
  color: var(--accent);
}

#csv-upload-zone:hover,
#csv-upload-zone.drag-over {
  border-color: var(--accent);
  background: var(--accent-light);
}

#csv-upload-zone.drag-over {
  transform: scale(1.01);
}

#drift-chart-container svg {
  width: 100%;
  height: auto;
  display: block;
}

.drift-forecast-card.exceeded {
  border-left: 3px solid var(--critical);
}

.drift-forecast-card.warning {
  border-left: 3px solid var(--warning);
}

.reliability-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 6px;
  border: 1px solid var(--border-tech);
  background: #F3F8FC;
  flex-wrap: wrap;
  gap: 8px;
}

.reliability-row.ok {
  border-left: 4px solid var(--success);
}

.reliability-row.warn {
  border-left: 4px solid var(--warning);
  background: var(--warning-bg);
}

.reliability-row.fail {
  border-left: 4px solid var(--critical);
  background: var(--critical-bg);
}

/* Wafer Map Spatial Die Node Interaction */
.wafer-die-node:hover {
  transform: scale(1.25);
  stroke: var(--text-primary) !important;
  stroke-width: 2.2px !important;
  filter: drop-shadow(0 2px 4px rgba(16, 47, 79, 0.25));
}

/* 1. Screening Mode Selector */
.screening-mode-nav {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  background: #FFFFFF;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid var(--border-tech);
  box-shadow: var(--shadow-sm);
}

.screening-mode-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.screening-mode-btn:hover {
  background: var(--bg-card-hover);
  color: var(--primary-blue);
}

.screening-mode-btn.active {
  background: var(--bg-surface-secondary);
  border-color: var(--border-tech);
  color: var(--primary-blue);
  font-weight: 700;
}

/* 2. Drag & Drop CSV Dropzone */
.csv-dropzone {
  border: 2px dashed var(--border-strong);
  border-radius: 8px;
  padding: 36px 24px;
  text-align: center;
  background: var(--bg-card-hover);
  cursor: pointer;
  transition: all 0.2s ease;
}

.csv-dropzone:hover,
.csv-dropzone.drag-over {
  border-color: var(--primary-blue);
  background: var(--blue-tint);
}

.csv-dropzone.drag-over {
  transform: scale(1.01);
}

/* 3. 6-Stage Interactive ML Pipeline Visualizer */
.ml-pipeline-flow {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin: 16px 0;
}

@media (min-width: 1400px) {
  .ml-pipeline-flow {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 1024px) {
  .ml-pipeline-flow {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .ml-pipeline-flow {
    grid-template-columns: 1fr;
  }
}

.pipeline-stage-card {
  background: #FFFFFF;
  border: 1px solid var(--border-tech);
  border-radius: 8px;
  padding: 12px 14px;
  position: relative;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  cursor: pointer;
}

.pipeline-stage-card:hover {
  border-color: var(--primary-blue);
  box-shadow: 0 4px 14px rgba(8, 120, 201, 0.12);
  transform: translateY(-2px);
}

.pipeline-stage-card.expanded {
  border-color: var(--primary-blue);
  background: var(--blue-tint);
  box-shadow: 0 4px 16px rgba(8, 120, 201, 0.15);
}

.pipeline-stage-num {
  font-size: 11px;
  font-weight: 800;
  color: var(--primary-blue);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 2px;
}

.pipeline-stage-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.pipeline-stage-status {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
  margin-bottom: 6px;
}

.pipeline-stage-status.pass {
  background: var(--color-pass-surface);
  color: var(--color-pass);
}

.pipeline-stage-status.warn {
  background: var(--color-warning-surface);
  color: var(--color-warning);
}

.pipeline-stage-status.reject {
  background: var(--color-reject-surface);
  color: var(--color-reject);
}

.pipeline-stage-detail {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.pipeline-stage-expand {
  display: none;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--border-tech);
  font-size: 12px;
  color: var(--text-primary);
  line-height: 1.5;
}

.pipeline-stage-card.expanded .pipeline-stage-expand {
  display: block;
}

/* 4. Reliability Passport Modal */
.passport-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(16, 47, 79, 0.6);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.passport-modal-container {
  background: #FFFFFF;
  border-radius: 12px;
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-tech);
  display: flex;
  flex-direction: column;
}

.passport-modal-header {
  background: linear-gradient(135deg, #102F4F 0%, #10385F 50%, #0878C9 100%);
  color: #FFFFFF;
  padding: 20px 24px;
  border-radius: 11px 11px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.passport-modal-body {
  padding: 24px;
}

/* 5. Live Monitor Temporal Playback Bar */
.live-playback-console {
  background: #102F4F;
  color: #FFFFFF;
  padding: 16px 20px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 20px;
}

.timeline-slider-track {
  flex: 1;
  min-width: 240px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.timeline-range-input {
  flex: 1;
  accent-color: var(--bright-blue);
  cursor: pointer;
}

/* ── RESPONSIVE BREAKPOINT SYSTEM ─────────────────────────────────────────── */
@media (max-width: 1150px) {
  .topnav-status {
    display: none !important;
  }
  .topnav-container {
    padding: 0 16px;
  }
}

@media (max-width: 992px) {
  .grid-three-col {
    grid-template-columns: 1fr;
  }
  .grid-two-col {
    grid-template-columns: 1fr;
  }
  .hero-card > div {
    grid-template-columns: 1fr !important;
  }
  .workstation-grid {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 768px) {
  .hamburger-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
  }
  
  .topnav-menu {
    display: none;
    position: absolute;
    top: 68px;
    left: 0;
    right: 0;
    background-color: #ffffff;
    flex-direction: column;
    padding: 8px 16px;
    border-bottom: 1px solid var(--border-tech);
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
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--bg-surface-secondary);
  }

  .nav-link:last-child {
    border-bottom: none;
  }
  
  .topnav-status {
    display: none;
  }
  
  .main-content {
    padding: 16px 12px 30px 12px;
  }
  
  .grid-kpi-4,
  .kpi-summary-container {
    display: flex !important;
    flex-direction: column !important;
    grid-template-columns: 1fr !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    gap: 12px !important;
    box-sizing: border-box !important;
  }

  .grid-kpi-4 > .card,
  .kpi-summary-container > .card {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box !important;
    flex: 1 1 100% !important;
  }

  *[style*="grid-template-columns"],
  .grid-workflow-4,
  .grid-hero,
  .grid-modules-6,
  .grid-2col,
  .grid-3col,
  .grid-metrics,
  .grid-two-col,
  .grid-three-col,
  .workstation-grid {
    grid-template-columns: 1fr !important;
    gap: 12px !important;
  }

  .hero-card > div {
    grid-template-columns: 1fr !important;
    gap: 16px !important;
  }

  .grid-kpi-4 > .card, .card, .grid-two-col > div, .grid-three-col > div, .grid-metrics > div, .workstation-grid > div, .card-title, .page-view {
    min-width: 0 !important;
    max-width: 100% !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }

  .workflow-container {
    flex-direction: column !important;
  }
  .workflow-arrow {
    transform: rotate(90deg);
    margin: 4px auto !important;
  }

  .breadcrumb, .page-header, .page-title, .page-subtitle, h1, h2, h3, p, td, th {
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .table-container {
    width: 100% !important;
    max-width: 100% !important;
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch;
    display: block !important;
  }

  .aips-table, .table-compact {
    min-width: 440px;
    width: 100%;
  }

  .screening-mode-nav {
    flex-direction: column !important;
  }

  .card-controls-group,
  .filter-controls-group {
    flex-direction: column !important;
    align-items: stretch !important;
    width: 100% !important;
    gap: 8px !important;
  }

  #monitor-component-selector {
    min-width: 0 !important;
    width: 100% !important;
  }

  .card-control-select,
  .filter-search-box,
  .filter-select-box,
  .catalog-search-box {
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
  }

  .card-title {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 10px !important;
    width: 100% !important;
  }

  .card-title > div {
    width: 100% !important;
    flex-direction: column !important;
    gap: 8px !important;
  }

  .chart-container {
    width: 100% !important;
    max-width: 100% !important;
    overflow: hidden !important;
  }

  .chart-container svg {
    max-width: 100% !important;
  }
}

@media (max-width: 640px) {
  .brand-subtitle {
    display: none !important;
  }

  .card-title {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 10px !important;
  }

  .card-title > div {
    width: 100% !important;
    flex-wrap: wrap !important;
  }

  .card-title select, .card-title input {
    width: 100% !important;
    max-width: 100% !important;
  }
}

@media (max-width: 480px) {
  .main-content {
    padding: 12px 8px 24px 8px !important;
  }

  .card {
    padding: 14px 10px !important;
  }
  
  .hero-card {
    padding: 16px 12px !important;
  }
  
  .hero-title, h1, .page-title {
    font-size: 26px !important;
  }

  .hero-subtitle, .page-subtitle {
    font-size: 13px !important;
  }

  .btn {
    width: 100% !important;
    min-height: 44px;
    justify-content: center;
    box-sizing: border-box;
  }

  .chart-container {
    height: 220px !important;
  }

  .aips-table th, .aips-table td, .table-compact th, .table-compact td {
    padding: 8px 10px;
    font-size: 13px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
`;

fs.writeFileSync(styleCssPath, restoredStyleCss, 'utf8');
console.log("✔ style.css written with complete restored structure, typography scale and color system");

// ── 2. STANDARDIZE build_restored_frontend.js ────────────────────────────────
const buildPath = path.join(__dirname, '..', 'build_restored_frontend.js');
let buildJs = fs.readFileSync(buildPath, 'utf8');

// Build Marker
buildJs = buildJs.replace(/const buildMarker = "[^"]*";/g, 'const buildMarker = "PREDICTA-RESTORED-DESIGN-V3";');
buildJs = buildJs.replace(/function generateRestoredHtml\(buildMarker = "[^"]*"\)/g, 'function generateRestoredHtml(buildMarker = "PREDICTA-RESTORED-DESIGN-V3")');

// Replace palette tokens with standard v3 palette
const hexMap = [
  // Primary Dark Navy
  [/#123B63/g, '#102F4F'],
  [/#12365B/g, '#102F4F'],
  // Secondary Slate
  [/#475569/g, '#45657F'],
  [/#4A6680/g, '#45657F'],
  // Muted Helper
  [/#64748B/g, '#72889A'],
  [/#70879A/g, '#72889A'],
  [/#71869A/g, '#72889A'],
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
  [/#DC2626/g, '#D8444B'],
  [/#D83D45/g, '#D8444B'],
  [/#D94A4A/g, '#D8444B'],
  [/#991B1B/g, '#D8444B'],
  [/#FDEAEA/g, '#FDE8E9'],
  [/#FEF2F2/g, '#FDE8E9'],
  [/#FEE2E2/g, '#FDE8E9'],
  [/#FDE7E8/g, '#FDE8E9'],
  [/#FCA5A5/g, '#F2A6AA'],
  // Status Amber / Warning / Monitor
  [/#D97706/g, '#C98A18'],
  [/#C98512/g, '#C98A18'],
  [/#C88716/g, '#C98A18'],
  [/#FFF4D9/g, '#FFF2D5'],
  [/#FEF3C7/g, '#FFF2D5'],
  [/#FFFBEB/g, '#FFF2D5'],
  [/#FFF3D8/g, '#FFF2D5'],
  [/#FCD34D/g, '#F0CA6B'],
  [/#FDE68A/g, '#F0CA6B'],
  // Status Green / Pass
  [/#059669/g, '#159A68'],
  [/#128A61/g, '#159A68'],
  [/#16A34A/g, '#159A68'],
  [/#10B981/g, '#159A68'],
  [/#E7F7EF/g, '#E5F7EF'],
  [/#F0FDF4/g, '#E5F7EF'],
  [/#E3F6ED/g, '#E5F7EF'],
  [/#BBF7D0/g, '#A7DFC9'],
  [/#B2E7D1/g, '#A7DFC9']
];

for (const [pattern, rep] of hexMap) {
  buildJs = buildJs.replace(pattern, rep);
}

// Page Titles normalization
buildJs = buildJs.replace(/class="page-title"[^>]*>([^<]*)<\/h1>/g, 'class="page-title" style="font-size:36px; color:#10385F; font-family:var(--font-headings); font-weight:700; line-height:1.15; letter-spacing:-0.025em; margin-bottom:8px;">$1</h1>');

// Clean duplicate styles if any accumulated
buildJs = buildJs.replace(/(font-size:28px; color:#10385F; font-family:var\(--font-headings\); font-weight:700; line-height:1.2; letter-spacing:-0.02em; margin-bottom:12px;\s*)+/g, 'font-size:28px; color:#10385F; font-family:var(--font-headings); font-weight:700; line-height:1.2; letter-spacing:-0.02em; margin-bottom:12px; ');

// Wrap home recent table in table-container if not wrapped
buildJs = buildJs.replace(/<table class="table-compact"/g, '<div class="table-container"><table class="table-compact"');
buildJs = buildJs.replace(/<\/table>\s*<\/div>\s*<\/div>\s*<!-- 3. STATIC/g, '</table></div></div></div><!-- 3. STATIC');

// Brand name styling
buildJs = buildJs.replace(/class="brand-name"[^>]*>PREDICTA<\/div>/g, 'class="brand-name" style="font-family:var(--font-headings); font-weight:700; font-size:22px; color:#102F4F; line-height:1.2; letter-spacing:0.5px;">PREDICTA</div>');

fs.writeFileSync(buildPath, buildJs, 'utf8');
console.log("✔ build_restored_frontend.js synchronized");

// ── 3. UPDATE synth_script.js CHART COLORS ───────────────────────────────────
const synthPath = path.join(__dirname, '..', 'synth_script.js');
let synthJs = fs.readFileSync(synthPath, 'utf8');

for (const [pattern, rep] of hexMap) {
  synthJs = synthJs.replace(pattern, rep);
}

// Exact semantic chart colors
synthJs = synthJs.replace(/#0284C7/g, '#0878C9'); // Observed
synthJs = synthJs.replace(/#1778C8/g, '#0878C9');
synthJs = synthJs.replace(/#BAE6FD/g, '#DCEFFC'); // Lot envelope
synthJs = synthJs.replace(/#D5EBFA/g, '#DCEFFC');
synthJs = synthJs.replace(/#DCEEFF/g, '#DCEFFC');
synthJs = synthJs.replace(/#7DD3FC/g, '#AFC7DA'); // Envelope border
synthJs = synthJs.replace(/#BFD4E5/g, '#AFC7DA');
synthJs = synthJs.replace(/#AFC9DC/g, '#AFC7DA');
synthJs = synthJs.replace(/#DC2626/g, '#D8444B'); // Spec limit
synthJs = synthJs.replace(/#D83D45/g, '#D8444B');
synthJs = synthJs.replace(/#D97706/g, '#C98A18'); // Amber warning
synthJs = synthJs.replace(/#C98512/g, '#C98A18');
synthJs = synthJs.replace(/#059669/g, '#159A68'); // Green pass
synthJs = synthJs.replace(/#128A61/g, '#159A68');

fs.writeFileSync(synthPath, synthJs, 'utf8');
console.log("✔ synth_script.js synchronized with chart semantic colors");
