const fs = require('fs');
const path = require('path');

// 1. Generate the Circular Wafer Dies SVG with Canonical 60x60 Coordinate System
const cx = 160, cy = 160, R = 136;
const cols = 16, rows = 16;
const dw = 14, dh = 13, gap = 3;
const totalW = cols * (dw + gap) - gap;
const totalH = rows * (dh + gap) - gap;
const x0 = cx - totalW / 2;
const y0 = cy - totalH / 2;

function getCoord(idx) {
  return String(Math.round(idx * 4)).padStart(2, '0');
}

const canonicalRejects = ['DIE-R20C20', 'DIE-R44C16', 'DIE-R32C32', 'DIE-R08C20', 'DIE-R20C44', 'DIE-R40C40'];
const canonicalMonitors = ['DIE-R12C28', 'DIE-R24C12', 'DIE-R28C24', 'DIE-R16C40', 'DIE-R40C24', 'DIE-R24C36'];

let diesSvg = [];
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const x = x0 + c * (dw + gap);
    const y = y0 + r * (dh + gap);
    const corners = [
      [x, y], [x + dw, y], [x, y + dh], [x + dw, y + dh]
    ];
    const inside = corners.every(([px, py]) => Math.hypot(px - cx, py - cy) <= R);
    if (inside) {
      const dieId = 'DIE-R' + getCoord(r) + 'C' + getCoord(c);
      let fill = '#BAE6FD', stroke = '#0284C7', p = (0.02 + ((r * 13 + c * 29) % 65) / 1000).toFixed(3), label = 'PASS';
      if (canonicalRejects.includes(dieId) || dieId === 'DIE-R20C20') {
        fill = '#DC2626'; stroke = '#991B1B'; p = dieId === 'DIE-R20C20' ? '0.941' : '0.985'; label = 'REJECT';
      } else if (canonicalMonitors.includes(dieId)) {
        fill = '#FDE68A'; stroke = '#D97706'; p = '0.312'; label = 'MONITOR';
      }
      diesSvg.push(`                <rect class="die-cell" x="${Math.round(x * 10) / 10}" y="${Math.round(y * 10) / 10}" width="${dw}" height="${dh}" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1" onclick="window.openReliabilityPassport('${dieId}')"><title>${dieId}: ${label} (P=${p})</title></rect>`);
    }
  }
}

const waferDiesContent = diesSvg.join('\n');

// 2. Read build_restored_frontend.js
const buildPath = path.join(__dirname, '..', 'build_restored_frontend.js');
let content = fs.readFileSync(buildPath, 'utf8');

const homeStartMarker = '<section id="page-home" class="page-view active">';
const homeEndMarker = '<!-- ========================================================================= -->\n      <!-- PAGE 2: SCREENING WORKSPACE';

const startIndex = content.indexOf(homeStartMarker);
const endIndex = content.indexOf(homeEndMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error("Marker not found!", { startIndex, endIndex });
  process.exit(1);
}

const refinedHomePage = `<section id="page-home" class="page-view active">
        <!-- 1. Hero Card: Predictive Semiconductor Qualification Intelligence -->
        <div class="hero-card" style="background: #EAF4FB; border: 1px solid #D8E5EF; padding: 32px 28px; border-radius: 8px; margin-bottom: 24px; box-shadow: var(--shadow-sm);">
          <div class="grid-hero" style="display:grid; grid-template-columns: 1.2fr 0.8fr; gap:28px; align-items:center;">
            <!-- Hero Left Column: Text, Pillars & Primary Actions -->
            <div>
              <div class="technical-overline" style="font-size:11px; font-weight:700; color:#1976B8; text-transform:uppercase; letter-spacing:1px; display:block; margin-bottom:8px;">PREDICTA AI • SEMICONDUCTOR QUALITY ASSURANCE</div>
              <h1 class="page-title" style="font-size: 26px; color: #123B63; margin-bottom: 12px; font-weight: 700; line-height: 1.25;">Predictive Semiconductor<br>Qualification Intelligence</h1>
              <p class="page-subtitle" style="font-size: 13.5px; color: #475569; line-height: 1.6; margin-bottom: 18px;">
                Transforming qualification telemetry into explainable reliability evidence and actionable operational decisions before failure reaches production.
              </p>
              
              <!-- 3 Trust Pillars -->
              <div style="display:flex; gap:12px; flex-wrap:wrap; font-size:12px; font-weight:700; color:#123B63; margin-bottom:22px;">
                <span style="display:inline-flex; align-items:center; gap:5px; background:#FFFFFF; padding:4px 10px; border-radius:12px; border:1px solid #CBD5E1;">
                  <span style="color:#10B981;">✓</span> Explainable AI
                </span>
                <span style="display:inline-flex; align-items:center; gap:5px; background:#FFFFFF; padding:4px 10px; border-radius:12px; border:1px solid #CBD5E1;">
                  <span style="color:#10B981;">✓</span> Multi-Evidence Reliability
                </span>
                <span style="display:inline-flex; align-items:center; gap:5px; background:#FFFFFF; padding:4px 10px; border-radius:12px; border:1px solid #CBD5E1;">
                  <span style="color:#10B981;">✓</span> Actionable Decisions
                </span>
              </div>

              <div style="display:flex; gap:12px; flex-wrap:wrap;">
                <button class="btn btn-primary" id="btn-home-start-screening" onclick="window.switchPage('page-screening')" style="background:#1976B8; border-color:#1976B8; font-weight:600; padding:10px 22px; cursor:pointer;">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:16px;height:16px;margin-right:6px;display:inline-block;vertical-align:middle;">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                  </svg>
                  Run Screening
                </button>
                <button class="btn btn-outline" id="btn-home-view-components" onclick="window.switchPage('page-component')" style="border-color:#D8E5EF; color:#123B63; font-weight:600; padding:10px 22px; background:#FFFFFF; cursor:pointer;">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:16px;height:16px;margin-right:6px;display:inline-block;vertical-align:middle;">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 8.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                  </svg>
                  Components
                </button>
              </div>
            </div>

            <!-- Hero Right Column: 3D Isometric Die SVG Diagram & 3 Feature Callouts -->
            <div style="background:#FFFFFF; border:1px solid #D8E5EF; border-radius:6px; padding:18px; text-align:center; position:relative; box-shadow: var(--shadow-sm);">
              <svg width="220" height="135" viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin:0 auto 10px auto; display:block;">
                <defs>
                  <linearGradient id="chip-left-side" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#123B63" />
                    <stop offset="100%" stop-color="#0F2D4A" />
                  </linearGradient>
                  <linearGradient id="chip-right-side" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#0F2D4A" />
                    <stop offset="100%" stop-color="#0B1D3A" />
                  </linearGradient>
                  <linearGradient id="chip-top-substrate" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#1976B8" />
                    <stop offset="100%" stop-color="#123B63" />
                  </linearGradient>
                  <linearGradient id="die-top" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#F0F9FF" />
                    <stop offset="50%" stop-color="#E0F2FE" />
                    <stop offset="100%" stop-color="#BAE6FD" />
                  </linearGradient>
                  <linearGradient id="die-left" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#0284C7" />
                    <stop offset="100%" stop-color="#0369A1" />
                  </linearGradient>
                  <linearGradient id="die-right" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#0369A1" />
                    <stop offset="100%" stop-color="#075985" />
                  </linearGradient>
                  <linearGradient id="core-surface" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#38BDF8" />
                    <stop offset="100%" stop-color="#0284C7" />
                  </linearGradient>
                  <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.8" />
                    <stop offset="60%" stop-color="#0284C7" stop-opacity="0.3" />
                    <stop offset="100%" stop-color="#0369A1" stop-opacity="0" />
                  </radialGradient>
                  <linearGradient id="metal-pin" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#CBD5E1" />
                    <stop offset="50%" stop-color="#94A3B8" />
                    <stop offset="100%" stop-color="#64748B" />
                  </linearGradient>
                </defs>

                <!-- Ambient Drop Shadow -->
                <ellipse cx="120" cy="138" rx="80" ry="18" fill="#0F172A" opacity="0.12" />

                <!-- 3D Metallic Pins (Bottom Left) -->
                <path d="M 40,84 L 32,88 L 32,92 L 40,88 Z" fill="url(#metal-pin)" stroke="#475569" stroke-width="0.5" />
                <path d="M 52,91 L 44,95 L 44,99 L 52,95 Z" fill="url(#metal-pin)" stroke="#475569" stroke-width="0.5" />
                <path d="M 64,98 L 56,102 L 56,106 L 64,102 Z" fill="url(#metal-pin)" stroke="#475569" stroke-width="0.5" />
                <path d="M 76,105 L 68,109 L 68,113 L 76,109 Z" fill="url(#metal-pin)" stroke="#475569" stroke-width="0.5" />
                <path d="M 88,112 L 80,116 L 80,120 L 88,116 Z" fill="url(#metal-pin)" stroke="#475569" stroke-width="0.5" />

                <!-- 3D Metallic Pins (Bottom Right) -->
                <path d="M 152,112 L 160,116 L 160,120 L 152,116 Z" fill="url(#metal-pin)" stroke="#475569" stroke-width="0.5" />
                <path d="M 164,105 L 172,109 L 172,113 L 164,109 Z" fill="url(#metal-pin)" stroke="#475569" stroke-width="0.5" />
                <path d="M 176,98 L 184,102 L 184,106 L 176,102 Z" fill="url(#metal-pin)" stroke="#475569" stroke-width="0.5" />
                <path d="M 188,91 L 196,95 L 196,99 L 188,95 Z" fill="url(#metal-pin)" stroke="#475569" stroke-width="0.5" />
                <path d="M 200,84 L 208,88 L 208,92 L 200,88 Z" fill="url(#metal-pin)" stroke="#475569" stroke-width="0.5" />

                <!-- Substrate Base Package -->
                <polygon points="35,80 120,128 120,135 35,87" fill="url(#chip-left-side)" stroke="#0F2D4A" stroke-width="0.5" />
                <polygon points="120,128 205,80 205,87 120,135" fill="url(#chip-right-side)" stroke="#0B1D3A" stroke-width="0.5" />
                <polygon points="35,80 120,32 205,80 120,128" fill="url(#chip-top-substrate)" stroke="#123B63" stroke-width="1.5" />

                <!-- Substrate Circuit Traces -->
                <polyline points="60,66 100,89 120,77" stroke="#38BDF8" stroke-width="1" opacity="0.6" stroke-linecap="round" />
                <polyline points="180,66 140,89 120,77" stroke="#38BDF8" stroke-width="1" opacity="0.6" stroke-linecap="round" />
                <polyline points="75,102 105,85" stroke="#BAE6FD" stroke-width="1" opacity="0.5" stroke-linecap="round" />
                <polyline points="165,102 135,85" stroke="#BAE6FD" stroke-width="1" opacity="0.5" stroke-linecap="round" />

                <!-- Elevated Interposer / Die Layer -->
                <polygon points="65,77 120,108 120,114 65,83" fill="url(#die-left)" />
                <polygon points="120,108 175,77 175,83 120,114" fill="url(#die-right)" />
                <polygon points="65,77 120,46 175,77 120,108" fill="url(#die-top)" stroke="#0284C7" stroke-width="1.2" />

                <!-- Central Elevated Core -->
                <ellipse cx="120" cy="77" rx="36" ry="20" fill="url(#core-glow)" />
                <polygon points="88,74 120,92 120,96 88,78" fill="#0284C7" />
                <polygon points="120,92 152,74 152,78 120,96" fill="#0369A1" />
                <polygon points="88,74 120,56 152,74 120,92" fill="url(#core-surface)" stroke="#BAE6FD" stroke-width="1.5" />
                <polygon points="110,74 120,68 130,74 120,80" fill="#FFFFFF" opacity="0.9" />
                <ellipse cx="120" cy="74" rx="4" ry="2" fill="#38BDF8" />
              </svg>

              <!-- 3 Feature Callouts -->
              <div style="display:flex; flex-direction:column; gap:6px; text-align:left;">
                <div style="background:#F5F9FD; border:1px solid #D8E5EF; padding:6px 10px; border-radius:5px;">
                  <div style="font-size:11px; font-weight:700; color:#123B63; display:flex; align-items:center; gap:6px;">
                    <span style="width:6px; height:6px; border-radius:50%; background:#1976B8; display:inline-block;"></span> Detect Early
                  </div>
                  <div style="font-size:10.5px; color:#64748B; margin-top:2px;">Identify abnormal electrical behavior in screening.</div>
                </div>
                <div style="background:#F5F9FD; border:1px solid #D8E5EF; padding:6px 10px; border-radius:5px;">
                  <div style="font-size:11px; font-weight:700; color:#123B63; display:flex; align-items:center; gap:6px;">
                    <span style="width:6px; height:6px; border-radius:50%; background:#0F8B8D; display:inline-block;"></span> Predict Drift
                  </div>
                  <div style="font-size:10.5px; color:#64748B; margin-top:2px;">Forecast degradation trajectory up to 168 hours.</div>
                </div>
                <div style="background:#F5F9FD; border:1px solid #D8E5EF; padding:6px 10px; border-radius:5px;">
                  <div style="font-size:11px; font-weight:700; color:#123B63; display:flex; align-items:center; gap:6px;">
                    <span style="width:6px; height:6px; border-radius:50%; background:#123B63; display:inline-block;"></span> Governed Decision
                  </div>
                  <div style="font-size:10.5px; color:#64748B; margin-top:2px;">Fail-closed disposition (PASS, MONITOR, REJECT).</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Active Lot Status Summary (4 Clean Balanced White Cards) -->
        <h2 style="font-family:var(--font-display); font-size:15px; font-weight:700; color:#123B63; margin-bottom:12px;">Active Lot Status Summary</h2>
        <div class="grid-kpi-4" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:14px; margin-bottom:24px;">
          <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:16px; border-radius:6px; box-shadow:var(--shadow-sm);">
            <div style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase;">Total Monitored</div>
            <div style="font-family:var(--font-display); font-size:24px; font-weight:700; color:#123B63; margin:4px 0;">256 Units</div>
            <div style="font-size:11px; color:#059669; font-weight:600;">8 Active Test Lots (43–50)</div>
          </div>

          <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:16px; border-radius:6px; box-shadow:var(--shadow-sm);">
            <div style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase;">Quarantine Rate</div>
            <div style="font-family:var(--font-display); font-size:24px; font-weight:700; color:#DC2626; margin:4px 0;">11.7%</div>
            <div style="font-size:11px; color:#64748B;">30 Units Flagged for Rejection</div>
          </div>

          <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:16px; border-radius:6px; box-shadow:var(--shadow-sm);">
            <div style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase;">Monitor Review Rate</div>
            <div style="font-family:var(--font-display); font-size:24px; font-weight:700; color:#D97706; margin:4px 0;">18.4%</div>
            <div style="font-size:11px; color:#64748B;">47 Secondary QA Reviews</div>
          </div>

          <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:16px; border-radius:6px; box-shadow:var(--shadow-sm);">
            <div style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase;">Latent Interception</div>
            <div style="font-family:var(--font-display); font-size:24px; font-weight:700; color:#059669; margin:4px 0;">0.00% Escape</div>
            <div style="font-size:11px; color:#059669; font-weight:600;">Synthetic Benchmark Scenario (Fail-Closed)</div>
          </div>
        </div>

        <!-- 3. How PREDICTA Works (4-Stage Pipeline) -->
        <div style="margin-bottom:24px;">
          <div style="margin-bottom:12px;">
            <h2 style="font-family:var(--font-display); font-size:15px; font-weight:700; color:#123B63; margin:0;">How PREDICTA Works</h2>
            <p style="font-size:12px; color:#64748B; margin:2px 0 0 0;">End-to-end prognostic qualification architecture from sensor ingestion to fail-closed disposition.</p>
          </div>
          <div class="pipeline-grid">
            <div class="pipeline-card">
              <div>
                <span class="pipeline-step-badge">01 — MEASURE</span>
                <div style="font-size:14px; font-weight:700; color:#123B63; margin-bottom:6px;">Telemetry Ingestion</div>
                <p style="font-size:11.5px; color:#475569; line-height:1.5; margin:0;">Ingests 14 parametric sensor channels (IDDQ, leakage, delay, dynamic power) across 0h ATE and 24h burn-in checkpoints.</p>
              </div>
              <div style="margin-top:12px; font-size:10.5px; font-family:var(--font-mono); color:#1976B8; background:#F0F9FF; padding:4px 8px; border-radius:4px;">14 Channels • 24h Epoch</div>
            </div>

            <div class="pipeline-card">
              <div>
                <span class="pipeline-step-badge">02 — DETECT</span>
                <div style="font-size:14px; font-weight:700; color:#123B63; margin-bottom:6px;">Anomaly Ensemble</div>
                <p style="font-size:11.5px; color:#475569; line-height:1.5; margin:0;">Runs lot-relative Part Average Testing (PAT-MAD 3.5σ), COPOD extreme-value copula, and Isolation Forest for spatial outlier detection.</p>
              </div>
              <div style="margin-top:12px; font-size:10.5px; font-family:var(--font-mono); color:#0F8B8D; background:#F0FDF4; padding:4px 8px; border-radius:4px;">PAT-MAD + COPOD + IF</div>
            </div>

            <div class="pipeline-card">
              <div>
                <span class="pipeline-step-badge">03 — PREDICT</span>
                <div style="font-size:14px; font-weight:700; color:#123B63; margin-bottom:6px;">Degradation Forecast</div>
                <p style="font-size:11.5px; color:#475569; line-height:1.5; margin:0;">Gaussian Process Regression (GPR) projects 168h drift; supervised XGBoost (XGB-100) calculates latent failure probability P(fail) with 95% model intervals (uncalibrated).</p>
              </div>
              <div style="margin-top:12px; font-size:10.5px; font-family:var(--font-mono); color:#D97706; background:#FFFBEB; padding:4px 8px; border-radius:4px;">GPR 168h + XGB-100</div>
            </div>

            <div class="pipeline-card">
              <div>
                <span class="pipeline-step-badge">04 — DECIDE</span>
                <div style="font-size:14px; font-weight:700; color:#123B63; margin-bottom:6px;">Governed Disposition</div>
                <p style="font-size:11.5px; color:#475569; line-height:1.5; margin:0;">Multi-evidence risk engine synthesizes physical telemetry, anomaly scores, and drift predictions into fail-closed disposition (PASS, MONITOR, REJECT) at θ* = 0.20 threshold.</p>
              </div>
              <div style="margin-top:12px; font-size:10.5px; font-family:var(--font-mono); color:#059669; background:#ECFDF5; padding:4px 8px; border-radius:4px;">Fail-Closed • θ* = 0.20</div>
            </div>
          </div>
        </div>

        <!-- 4. Static vs Dynamic Screening Comparison -->
        <div id="home-static-vs-dynamic-comparison" style="margin-bottom:24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div>
              <h2 style="font-family:var(--font-display); font-size:15px; font-weight:700; color:#123B63; margin:0;">Static vs. Dynamic Reliability Screening Architecture</h2>
              <p style="font-size:12px; color:#64748B; margin:2px 0 0 0;">Why fixed-limit ATE tests fail to intercept latent degradation before mission deployment.</p>
            </div>
            <span class="badge" style="background:#EAF4FB; color:#1976B8; font-size:10px; font-weight:700;">ENGINEERING FOUNDATION</span>
          </div>

          <div class="static-vs-dynamic-grid">
            <!-- Left: Static Screening -->
            <div class="screening-pillar-card static">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div style="font-size:13px; font-weight:700; color:#475569;">Static ATE Screening (Conventional)</div>
                <span class="badge" style="background:#E2E8F0; color:#475569; font-size:10px;">SINGLE TIMESTEP</span>
              </div>
              <ul style="font-size:12px; color:#475569; line-height:1.6; margin-left:18px; margin-bottom:12px;">
                <li>Checks single-point sensor readings against broad datasheet spec bounds.</li>
                <li><strong>Blind to Lot Drift:</strong> An outlier within spec limits passes undetected.</li>
                <li><strong>Zero Temporal Context:</strong> Cannot measure d(I<sub>leak</sub>)/dt degradation kinetics.</li>
                <li><strong>Escape Mechanism:</strong> Latent oxide breakdown reaches operational assembly.</li>
              </ul>
              <div style="background:#FFFFFF; border:1px solid #CBD5E1; padding:8px 12px; border-radius:4px; font-size:11.5px; font-family:var(--font-mono); color:#DC2626;">
                Verdict: PASS at 0h → FAILS at 96h burn-in (Synthetic Benchmark Scenario)
              </div>
            </div>

            <!-- Right: Dynamic Screening -->
            <div class="screening-pillar-card dynamic">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div style="font-size:13px; font-weight:700; color:#1976B8;">PREDICTA Multi-Evidence Screening</div>
                <span class="badge pass" style="font-size:10px;">PROGNOSTIC FUSION</span>
              </div>
              <ul style="font-size:12px; color:#334155; line-height:1.6; margin-left:18px; margin-bottom:12px;">
                <li><strong>Lot-Relative Part Average Testing (PAT-MAD):</strong> Identifies spatial outliers.</li>
                <li><strong>Temporal Prognostics (GPR):</strong> Extrapolates 24h trajectory to 168h horizon.</li>
                <li><strong>Supervised Latent Risk:</strong> XGBoost classifier evaluated against θ* = 0.20.</li>
                <li><strong>Physics Acceleration:</strong> Arrhenius &amp; Black's EM validate wearout kinetics.</li>
              </ul>
              <div style="background:#FFFFFF; border:1px solid #BAE6FD; padding:8px 12px; border-radius:4px; font-size:11.5px; font-family:var(--font-mono); color:#059669;">
                Verdict: REJECT at 24h → Early Interception — Synthetic Benchmark Scenario
              </div>
            </div>
          </div>
        </div>

        <!-- 5. Latent Escape Spotlight ("WITHIN LIMITS / ABNORMAL BEHAVIOR") -->
        <div class="latent-escape-spotlight-wrapper" id="home-latent-escape-spotlight" style="margin-bottom:24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div>
              <div style="font-size:10px; font-weight:700; color:#DC2626; text-transform:uppercase; letter-spacing:1px;">LATENT ESCAPE SPOTLIGHT</div>
              <h3 style="font-family:var(--font-display); font-size:16px; font-weight:800; color:#123B63; margin:0;">Within Datasheet Limits — Abnormal Degradation Behavior</h3>
            </div>
            <span class="badge warning" style="font-size:10px; font-weight:700;">INTERCEPTED LATENT HAZARD</span>
          </div>

          <div class="latent-spotlight-card">
            <div class="spotlight-header-row">
              <div>
                <span style="font-size:11px; color:#64748B;">Target Die:</span>
                <strong style="font-size:14px; font-family:var(--font-mono); color:#123B63; margin-left:6px;" id="spotlight-die-id">DIE-R20C20</strong>
                <span style="font-size:11px; color:#64748B; margin-left:10px;">Lot:</span>
                <span style="font-size:12px; font-family:var(--font-mono); color:#334155; margin-left:4px;" id="spotlight-lot-id">LOT-SYN-044</span>
              </div>
              <button class="btn btn-sm btn-outline" onclick="window.openReliabilityPassport(document.getElementById('spotlight-die-id').textContent)" style="font-size:11px;">⚡ Open Forensic Passport</button>
            </div>

            <div class="spotlight-evidence-grid">
              <div class="spotlight-cell">
                <div class="spotlight-cell-label">1. Static Datasheet ATE</div>
                <div class="spotlight-cell-val" style="color:#059669;">PASS ✓</div>
                <div class="spotlight-cell-desc">All 14 parametric sensor channels satisfy fixed ±3σ specification limits.</div>
              </div>

              <div class="spotlight-cell warning-border">
                <div class="spotlight-cell-label">2. Lot-Relative Behavior</div>
                <div class="spotlight-cell-val" style="color:#D97706;" id="spotlight-mad-val">+4.2 MAD ⚠</div>
                <div class="spotlight-cell-desc">Spatial outlier relative to wafer lot distribution (COPOD q = 0.012).</div>
              </div>

              <div class="spotlight-cell warning-border">
                <div class="spotlight-cell-label">3. 24h Telemetry Drift</div>
                <div class="spotlight-cell-val" style="color:#D97706;" id="spotlight-drift-val">+31.2% Drift</div>
                <div class="spotlight-cell-desc">Excessive rate of change d(IDDQ)/dt observed between 0h and 24h burn-in.</div>
              </div>

              <div class="spotlight-cell critical-border">
                <div class="spotlight-cell-label">4. 168h GPR Forecast</div>
                <div class="spotlight-cell-val" style="color:#DC2626;" id="spotlight-breach-val">Limit Breach at 96h</div>
                <div class="spotlight-cell-desc">Projected IDDQ exceeds 25.0 µA spec limit with 95% model interval (uncalibrated).</div>
              </div>

              <div class="spotlight-cell decision-cell">
                <div class="spotlight-cell-label">5. Governed Decision</div>
                <div class="spotlight-cell-val" id="spotlight-decision-val"><span class="badge reject" style="font-size:12px;">REJECT / QUARANTINE</span></div>
                <div class="spotlight-cell-desc" id="spotlight-decision-desc">Fail-Closed Decision Policy Intercepts Latent Oxide Breakdown before deployment.</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 6. Technical Workstation Modules (6 Interactive Navigation Cards) -->
        <div style="margin-bottom:24px;">
          <div style="margin-bottom:12px;">
            <h2 style="font-family:var(--font-display); font-size:15px; font-weight:700; color:#123B63; margin:0;">Technical Workstation Modules</h2>
            <p style="font-size:12px; color:#64748B; margin:2px 0 0 0;">Access specialized semiconductor qualification, prognostics, and governance environments.</p>
          </div>
          <div class="module-nav-grid">
            <div class="module-nav-card" id="card-home-component" onclick="window.switchPage('page-component')">
              <div>
                <div class="card-title-row">
                  <div class="card-icon-box">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>
                    </svg>
                  </div>
                  <strong style="font-size:14px; color:#123B63;">Components Inventory</strong>
                  <span class="card-arrow">→</span>
                </div>
                <p style="font-size:11.5px; color:#64748B; line-height:1.5; margin:0;">Complete 256-die telemetry records, per-lot distributions, and interactive digital twins.</p>
              </div>
              <div style="margin-top:12px; font-size:10.5px; font-weight:600; color:#1976B8;">View Inventory &amp; Twins</div>
            </div>

            <div class="module-nav-card" id="card-home-module-a" onclick="window.switchPage('page-screening')">
              <div>
                <div class="card-title-row">
                  <div class="card-icon-box">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                    </svg>
                  </div>
                  <strong style="font-size:14px; color:#123B63;">Anomaly Detection</strong>
                  <span class="card-arrow">→</span>
                </div>
                <p style="font-size:11.5px; color:#64748B; line-height:1.5; margin:0;">Lot-relative PAT-MAD statistical outliers, COPOD copula scoring, and IF anomaly detection.</p>
              </div>
              <div style="margin-top:12px; font-size:10.5px; font-weight:600; color:#1976B8;">Inspect Outliers</div>
            </div>

            <div class="module-nav-card" id="card-home-module-b" onclick="window.switchPage('page-overview')">
              <div>
                <div class="card-title-row">
                  <div class="card-icon-box">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
                    </svg>
                  </div>
                  <strong style="font-size:14px; color:#123B63;">Degradation Forecast</strong>
                  <span class="card-arrow">→</span>
                </div>
                <p style="font-size:11.5px; color:#64748B; line-height:1.5; margin:0;">Gaussian Process 168h parameter drift extrapolation with 95% model intervals (uncalibrated).</p>
              </div>
              <div style="margin-top:12px; font-size:10.5px; font-weight:600; color:#1976B8;">Run GPR Forecast</div>
            </div>

            <div class="module-nav-card" id="card-home-decision" onclick="window.switchPage('page-advanced')">
              <div>
                <div class="card-title-row">
                  <div class="card-icon-box">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  </div>
                  <strong style="font-size:14px; color:#123B63;">Decision Governance</strong>
                  <span class="card-arrow">→</span>
                </div>
                <p style="font-size:11.5px; color:#64748B; line-height:1.5; margin:0;">Fail-closed disposition logic, threshold calibration, and human review override tracking.</p>
              </div>
              <div style="margin-top:12px; font-size:10.5px; font-weight:600; color:#1976B8;">Review Governance</div>
            </div>

            <div class="module-nav-card" id="card-home-datasets" onclick="window.switchPage('page-component')">
              <div>
                <div class="card-title-row">
                  <div class="card-icon-box">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                    </svg>
                  </div>
                  <strong style="font-size:14px; color:#123B63;">Benchmark Datasets</strong>
                  <span class="card-arrow">→</span>
                </div>
                <p style="font-size:11.5px; color:#64748B; line-height:1.5; margin:0;">Controlled qualification scenarios (LOT-SYN-043 to 050) with synthetic degradation ground truth.</p>
              </div>
              <div style="margin-top:12px; font-size:10.5px; font-weight:600; color:#1976B8;">Explore Telemetry Data</div>
            </div>

            <div class="module-nav-card" id="card-home-reports" onclick="window.switchPage('page-advanced')">
              <div>
                <div class="card-title-row">
                  <div class="card-icon-box">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                    </svg>
                  </div>
                  <strong style="font-size:14px; color:#123B63;">Audit &amp; Reports</strong>
                  <span class="card-arrow">→</span>
                </div>
                <p style="font-size:11.5px; color:#64748B; line-height:1.5; margin:0;">Comprehensive verification audit trails, model cards, and forensic qualification reports.</p>
              </div>
              <div style="margin-top:12px; font-size:10.5px; font-weight:600; color:#1976B8;">Generate Reports</div>
            </div>
          </div>
        </div>

        <!-- 7. Two Column Operational Layout (Wafer Map + Recent Activity) -->
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:24px;">
          <!-- Left: Wafer Spatial Distribution -->
          <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:18px; border-radius:8px; box-shadow:var(--shadow-sm);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div>
                <h3 style="font-family:var(--font-display); font-size:14px; font-weight:700; color:#123B63; margin:0;">Active Wafer Spatial Health</h3>
                <p style="font-size:11px; color:#64748B; margin:2px 0 0 0;">Benchmark Lot LOT-SYN-048 • Circular Silicon Wafer Spatial Distribution (Illustrative Benchmark Visualization)</p>
              </div>
              <span class="badge pass" style="font-size:10px;">YIELD: 88.3%</span>
            </div>
            <!-- Interactive 16x16 Circular Wafer Map -->
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; padding:12px; display:flex; justify-content:center;">
              <svg width="280" height="280" viewBox="0 0 320 320" id="home-wafer-svg">
                <!-- Wafer Outer Ring & Notch -->
                <circle cx="160" cy="160" r="146" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2"/>
                <circle cx="160" cy="160" r="144" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
                <path d="M 152,16 A 8,8 0 0,0 168,16 Z" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1"/>
                <!-- 16x16 Dies Clipped Inside Silicon Circle -->
${waferDiesContent}
              </svg>
            </div>
            <div style="display:flex; justify-content:center; gap:16px; font-size:11px; margin-top:10px; color:#475569;">
              <span><span style="display:inline-block; width:10px; height:10px; background:#BAE6FD; border:1px solid #0284C7; margin-right:4px;"></span> Nominal (PASS)</span>
              <span><span style="display:inline-block; width:10px; height:10px; background:#FDE68A; border:1px solid #D97706; margin-right:4px;"></span> Warning (MONITOR)</span>
              <span><span style="display:inline-block; width:10px; height:10px; background:#DC2626; border:1px solid #991B1B; margin-right:4px;"></span> Outlier (REJECT)</span>
            </div>
          </div>

          <!-- Right: Recent Qualification Activity Table -->
          <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:18px; border-radius:8px; box-shadow:var(--shadow-sm);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <h3 style="font-family:var(--font-display); font-size:14px; font-weight:700; color:#123B63; margin:0;">Recent Qualification Activity</h3>
              <button class="btn btn-outline" onclick="window.switchPage('page-component')" style="font-size:11px; padding:4px 10px;">View Full Inventory</button>
            </div>
            <table class="table-compact" style="width:100%; font-size:12px; border-collapse:collapse;">
              <thead>
                <tr style="border-bottom:1px solid #D8E5EF; text-align:left; color:#64748B;">
                  <th style="padding:6px 8px;">Die UID</th>
                  <th style="padding:6px 8px;">Lot ID</th>
                  <th style="padding:6px 8px;">Risk Score</th>
                  <th style="padding:6px 8px;">Disposition</th>
                  <th style="padding:6px 8px; text-align:right;">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom:1px solid #F1F5F9;">
                  <td style="padding:8px; font-weight:700; color:#123B63;">DIE-R20C20</td>
                  <td style="padding:8px; font-family:var(--font-mono); color:#475569;">LOT-SYN-044</td>
                  <td style="padding:8px; font-weight:700; color:#DC2626;">94.1%</td>
                  <td style="padding:8px;"><span class="badge reject" style="font-size:10px;">REJECT</span></td>
                  <td style="padding:8px; text-align:right;"><button class="btn btn-sm btn-outline" onclick="window.openReliabilityPassport('DIE-R20C20')" style="font-size:11px; padding:2px 8px;">Passport</button></td>
                </tr>
                <tr style="border-bottom:1px solid #F1F5F9;">
                  <td style="padding:8px; font-weight:700; color:#123B63;">DIE-R45C15</td>
                  <td style="padding:8px; font-family:var(--font-mono); color:#475569;">LOT-SYN-046</td>
                  <td style="padding:8px; font-weight:700; color:#DC2626;">99.5%</td>
                  <td style="padding:8px;"><span class="badge reject" style="font-size:10px;">REJECT</span></td>
                  <td style="padding:8px; text-align:right;"><button class="btn btn-sm btn-outline" onclick="window.openReliabilityPassport('DIE-R45C15')" style="font-size:11px; padding:2px 8px;">Passport</button></td>
                </tr>
                <tr style="border-bottom:1px solid #F1F5F9;">
                  <td style="padding:8px; font-weight:700; color:#123B63;">DIE-R12C28</td>
                  <td style="padding:8px; font-family:var(--font-mono); color:#475569;">LOT-SYN-046</td>
                  <td style="padding:8px; font-weight:700; color:#D97706;">31.2%</td>
                  <td style="padding:8px;"><span class="badge warning" style="font-size:10px;">MONITOR</span></td>
                  <td style="padding:8px; text-align:right;"><button class="btn btn-sm btn-outline" onclick="window.openReliabilityPassport('DIE-R12C28')" style="font-size:11px; padding:2px 8px;">Passport</button></td>
                </tr>
                <tr style="border-bottom:1px solid #F1F5F9;">
                  <td style="padding:8px; font-weight:700; color:#123B63;">DIE-R15C15</td>
                  <td style="padding:8px; font-family:var(--font-mono); color:#475569;">LOT-SYN-043</td>
                  <td style="padding:8px; font-weight:700; color:#059669;">8.9%</td>
                  <td style="padding:8px;"><span class="badge pass" style="font-size:10px;">PASS</span></td>
                  <td style="padding:8px; text-align:right;"><button class="btn btn-sm btn-outline" onclick="window.openReliabilityPassport('DIE-R15C15')" style="font-size:11px; padding:2px 8px;">Passport</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      `;

const newContent = content.slice(0, startIndex) + refinedHomePage + content.slice(endIndex);
fs.writeFileSync(buildPath, newContent, 'utf8');
console.log("✔ Successfully updated build_restored_frontend.js with credibility corrections!");
