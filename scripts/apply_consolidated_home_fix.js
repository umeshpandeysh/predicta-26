const fs = require('fs');
const path = require('path');

console.log("=========================================================================");
console.log("APPLYING CONSOLIDATED PREDICTA-26 HOME PAGE REFINEMENT");
console.log("=========================================================================");

// 1. UPDATE style.css
const stylePath = path.join(__dirname, '..', 'style.css');
let styleContent = fs.readFileSync(stylePath, 'utf8');

// Update topnav-container height & centered menu
styleContent = styleContent.replace(
  /\.topnav-container\s*\{[\s\S]*?gap:\s*16px;\s*\}/,
  `.topnav-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  height: 66px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  position: relative;
}`
);

styleContent = styleContent.replace(
  /\.topnav-menu\s*\{[\s\S]*?gap:\s*4px;\s*\}/,
  `.topnav-menu {
  display: flex;
  align-items: center;
  gap: 6px;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}`
);

styleContent = styleContent.replace(
  /\.brand-section\s*\{[\s\S]*?cursor:\s*pointer;\s*\}/,
  `.brand-section {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  z-index: 2;
  flex-shrink: 0;
}`
);

styleContent = styleContent.replace(
  /\.brand-name\s*\{[\s\S]*?color:\s*#123B63;\s*\}/,
  `.brand-name {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 18px;
  letter-spacing: 0.5px;
  color: #123B63;
}`
);

styleContent = styleContent.replace(
  /\.nav-link\s*\{[\s\S]*?white-space:\s*nowrap;\s*\}/,
  `.nav-link {
  background: transparent;
  border: none;
  color: #475569;
  font-family: var(--font-sans);
  font-size: 13.5px;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}`
);

// Add 3D chip styles & flow step styles if not already present
if (!styleContent.includes('.hero-chip-card')) {
  styleContent += `
/* Hero 3D Chip Visualization Card */
.hero-chip-card {
  background: #FFFFFF;
  border: 1px solid #D8E5EF;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  position: relative;
  box-shadow: var(--shadow-sm);
  perspective: 900px;
  transition: transform 0.25s cubic-bezier(0.2, 0, 0.2, 1), box-shadow 0.25s ease;
  transform-style: preserve-3d;
}

.hero-chip-card:hover {
  box-shadow: 0 8px 24px rgba(18, 59, 99, 0.08);
}

.hero-chip-svg-wrap {
  margin: 0 auto 12px auto;
  display: block;
  filter: drop-shadow(0 6px 12px rgba(18, 59, 99, 0.1));
}

/* Static vs Dynamic Concrete Evidence Flow */
.flow-progression-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.flow-node {
  background: #FFFFFF;
  border: 1px solid #CBD5E1;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  font-family: var(--font-mono);
  font-weight: 600;
  color: #334155;
  white-space: nowrap;
}

.flow-node.highlight-pass {
  border-color: #059669;
  color: #059669;
  background: #F0FDF4;
}

.flow-node.highlight-warn {
  border-color: #D97706;
  color: #D97706;
  background: #FFFBEB;
}

.flow-node.highlight-crit {
  border-color: #DC2626;
  color: #DC2626;
  background: #FEF2F2;
}

.flow-arrow {
  color: #94A3B8;
  font-size: 11px;
  font-weight: bold;
}
`;
}

// Ensure responsive media query restores topnav-menu on mobile/tablet
if (styleContent.includes('@media (max-width: 860px)')) {
  styleContent = styleContent.replace(
    /@media \(max-width: 860px\)\s*\{[\s\S]*?\.topnav-menu\s*\{[\s\S]*?\}/,
    `@media (max-width: 860px) {
  .topnav-menu {
    position: fixed !important;
    left: 0 !important;
    transform: none !important;
  }`
  );
}

fs.writeFileSync(stylePath, styleContent, 'utf8');
console.log("✔ Successfully updated style.css");

// 2. GENERATE CIRCULAR WAFER DIES SVG (Canonical 60x60 Coordinate System)
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

// 3. GENERATE ULTRA-REALISTIC 3D CHIP SVG
const realistic3DChipSvg = `<svg width="240" height="150" viewBox="0 0 260 170" fill="none" xmlns="http://www.w3.org/2000/svg" class="hero-chip-svg-wrap" id="hero-chip-svg">
                <defs>
                  <!-- Package Base Gradients -->
                  <linearGradient id="pkg-top-sub" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#1E3A8A" />
                    <stop offset="45%" stop-color="#172554" />
                    <stop offset="100%" stop-color="#0F172A" />
                  </linearGradient>
                  <linearGradient id="pkg-left-side" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#0F172A" />
                    <stop offset="100%" stop-color="#020617" />
                  </linearGradient>
                  <linearGradient id="pkg-right-side" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#1E293B" />
                    <stop offset="100%" stop-color="#0F172A" />
                  </linearGradient>
                  
                  <!-- Die Mirror Silicon Gradient -->
                  <linearGradient id="die-silicon-face" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#E2E8F0" />
                    <stop offset="20%" stop-color="#BAE6FD" />
                    <stop offset="60%" stop-color="#0284C7" />
                    <stop offset="100%" stop-color="#0369A1" />
                  </linearGradient>
                  <linearGradient id="die-silicon-left" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#0369A1" />
                    <stop offset="100%" stop-color="#075985" />
                  </linearGradient>
                  <linearGradient id="die-silicon-right" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#075985" />
                    <stop offset="100%" stop-color="#0C4A6E" />
                  </linearGradient>

                  <!-- Core Active Prognostic Glow -->
                  <radialGradient id="core-quantum-glow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.95" />
                    <stop offset="40%" stop-color="#0284C7" stop-opacity="0.6" />
                    <stop offset="100%" stop-color="#0369A1" stop-opacity="0" />
                  </radialGradient>

                  <!-- Metallic Specular Pin Gradients -->
                  <linearGradient id="metal-solder-ball" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#F8FAFC" />
                    <stop offset="30%" stop-color="#CBD5E1" />
                    <stop offset="70%" stop-color="#64748B" />
                    <stop offset="100%" stop-color="#334155" />
                  </linearGradient>
                  <linearGradient id="gold-wire" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#FDE68A" />
                    <stop offset="50%" stop-color="#F59E0B" />
                    <stop offset="100%" stop-color="#B45309" />
                  </linearGradient>
                </defs>

                <!-- Soft Ambient Shadow -->
                <ellipse cx="130" cy="148" rx="96" ry="18" fill="#091428" opacity="0.18" />

                <!-- Metallic BGA Solder Balls (Bottom Left Perimeter) -->
                <g opacity="0.95">
                  <path d="M 44,92 L 34,97 L 34,102 L 44,97 Z" fill="url(#metal-solder-ball)" stroke="#334155" stroke-width="0.5" />
                  <path d="M 58,100 L 48,105 L 48,110 L 58,105 Z" fill="url(#metal-solder-ball)" stroke="#334155" stroke-width="0.5" />
                  <path d="M 72,108 L 62,113 L 62,118 L 72,113 Z" fill="url(#metal-solder-ball)" stroke="#334155" stroke-width="0.5" />
                  <path d="M 86,116 L 76,121 L 76,126 L 86,121 Z" fill="url(#metal-solder-ball)" stroke="#334155" stroke-width="0.5" />
                  <path d="M 100,124 L 90,129 L 90,134 L 100,129 Z" fill="url(#metal-solder-ball)" stroke="#334155" stroke-width="0.5" />

                  <!-- Metallic BGA Solder Balls (Bottom Right Perimeter) -->
                  <path d="M 160,124 L 170,129 L 170,134 L 160,129 Z" fill="url(#metal-solder-ball)" stroke="#334155" stroke-width="0.5" />
                  <path d="M 174,116 L 184,121 L 184,126 L 174,121 Z" fill="url(#metal-solder-ball)" stroke="#334155" stroke-width="0.5" />
                  <path d="M 188,108 L 198,113 L 198,118 L 188,113 Z" fill="url(#metal-solder-ball)" stroke="#334155" stroke-width="0.5" />
                  <path d="M 202,100 L 212,105 L 212,110 L 202,105 Z" fill="url(#metal-solder-ball)" stroke="#334155" stroke-width="0.5" />
                  <path d="M 216,92 L 226,97 L 226,102 L 216,97 Z" fill="url(#metal-solder-ball)" stroke="#334155" stroke-width="0.5" />
                </g>

                <!-- Multi-Layer Substrate Base Layer (Thick Organic Interposer) -->
                <polygon points="36,88 130,138 130,147 36,97" fill="url(#pkg-left-side)" stroke="#020617" stroke-width="0.8" />
                <polygon points="130,138 224,88 224,97 130,147" fill="url(#pkg-right-side)" stroke="#0F172A" stroke-width="0.8" />
                <polygon points="36,88 130,38 224,88 130,138" fill="url(#pkg-top-sub)" stroke="#1E3A8A" stroke-width="1.5" />

                <!-- Substrate High-Density Micro-Traces (Cyan/Sky-Blue Routing) -->
                <g opacity="0.65" stroke-linecap="round">
                  <polyline points="60,75 105,99 130,85" stroke="#38BDF8" stroke-width="1.2" />
                  <polyline points="200,75 155,99 130,85" stroke="#38BDF8" stroke-width="1.2" />
                  <polyline points="75,110 110,92" stroke="#7DD3FC" stroke-width="1" />
                  <polyline points="185,110 150,92" stroke="#7DD3FC" stroke-width="1" />
                  <circle cx="105" cy="99" r="1.8" fill="#38BDF8" />
                  <circle cx="155" cy="99" r="1.8" fill="#38BDF8" />
                </g>

                <!-- Beveled Cavity Step (Die Pad Step) -->
                <polygon points="68,85 130,118 192,85 130,52" fill="#0B1329" stroke="#1E293B" stroke-width="1" />

                <!-- Gold Wirebonds (Connecting Substrate Lead Fingers to Die Pads) -->
                <g stroke="url(#gold-wire)" stroke-width="1.2" fill="none" opacity="0.9">
                  <path d="M 64,83 Q 74,78 84,82" />
                  <path d="M 80,97 Q 88,90 96,93" />
                  <path d="M 196,83 Q 186,78 176,82" />
                  <path d="M 180,97 Q 172,90 164,93" />
                </g>

                <!-- Elevated Silicon Die Layer (Polished Specular Surface) -->
                <polygon points="76,83 130,112 130,118 76,89" fill="url(#die-silicon-left)" />
                <polygon points="130,112 184,83 184,89 130,118" fill="url(#die-silicon-right)" />
                <polygon points="76,83 130,54 184,83 130,112" fill="url(#die-silicon-face)" stroke="#38BDF8" stroke-width="1.4" />

                <!-- Silicon Active Core Glow & Prognostic Engine -->
                <ellipse cx="130" cy="83" rx="38" ry="20" fill="url(#core-quantum-glow)" />

                <!-- Central Integrated Micro-Core -->
                <polygon points="100,81 130,97 130,101 100,85" fill="#0369A1" />
                <polygon points="130,97 160,81 160,85 130,101" fill="#075985" />
                <polygon points="100,81 130,65 160,81 130,97" fill="#0284C7" stroke="#BAE6FD" stroke-width="1.2" />

                <!-- Precision Laser Etching Marking -->
                <g fill="#FFFFFF" opacity="0.92" style="font-family:'JetBrains Mono', monospace; font-size:7px; font-weight:700;">
                  <text x="114" y="80" transform="rotate(-15 114 80)">PREDICTA</text>
                  <text x="118" y="88" transform="rotate(-15 118 88)" fill="#BAE6FD" style="font-size:5.5px;">QA-26</text>
                </g>
                <circle cx="130" cy="74" rx="2.5" ry="1.5" fill="#38BDF8" />
              </svg>`;

// 4. ASSEMBLE REORDERED HOME PAGE HTML
const buildPath = path.join(__dirname, '..', 'build_restored_frontend.js');
let buildContent = fs.readFileSync(buildPath, 'utf8');

const homeStartMarker = '<section id="page-home" class="page-view active">';
const homeEndMarker = '<!-- ========================================================================= -->\n      <!-- PAGE 2: SCREENING WORKSPACE';

const startIndex = buildContent.indexOf(homeStartMarker);
const endIndex = buildContent.indexOf(homeEndMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error("Marker not found in build_restored_frontend.js!", { startIndex, endIndex });
  process.exit(1);
}

const reorderedHomePage = `<section id="page-home" class="page-view active">
        <!-- 1. Hero Card: Predictive Semiconductor Qualification Intelligence -->
        <div class="hero-card" style="background: #EAF4FB; border: 1px solid #D8E5EF; padding: 32px 28px; border-radius: 8px; margin-bottom: 24px; box-shadow: var(--shadow-sm);">
          <div class="grid-hero" style="display:grid; grid-template-columns: 1.2fr 0.8fr; gap:28px; align-items:center;">
            <!-- Hero Left Column: Text, Pillars & Primary Actions -->
            <div>
              <div class="technical-overline" style="font-size:11px; font-weight:700; color:#1976B8; text-transform:uppercase; letter-spacing:1px; display:block; margin-bottom:8px;">PREDICTA AI • SEMICONDUCTOR QUALITY ASSURANCE</div>
              <h1 class="page-title" style="font-size: 28px; color: #123B63; margin-bottom: 12px; font-weight: 700; line-height: 1.25;">Predictive Semiconductor<br>Qualification Intelligence</h1>
              <p class="page-subtitle" style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 18px;">
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

            <!-- Hero Right Column: Ultra-Realistic 3D Semiconductor BGA Package Card -->
            <div class="hero-chip-card" id="hero-chip-3d-card">
              ${realistic3DChipSvg}

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

        <!-- 3. SECTION MOVED UP: Active Wafer Spatial Health + Recent Activity -->
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
            <!-- Interactive Circular Wafer Map -->
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; padding:12px; display:flex; justify-content:center;">
              <svg width="280" height="280" viewBox="0 0 320 320" id="home-wafer-svg">
                <!-- Wafer Outer Ring & Notch -->
                <circle cx="160" cy="160" r="146" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2"/>
                <circle cx="160" cy="160" r="144" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1"/>
                <path d="M 152,16 A 8,8 0 0,0 168,16 Z" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1"/>
                <!-- Dies Clipped Inside Silicon Circle -->
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

        <!-- 4. PRIMARY FUNCTIONAL NAVIGATION: Technical Workstation Modules -->
        <div style="margin-bottom:24px;">
          <div style="margin-bottom:12px;">
            <h2 style="font-family:var(--font-display); font-size:15px; font-weight:700; color:#123B63; margin:0;">Technical Workstation Modules</h2>
            <p style="font-size:12px; color:#64748B; margin:2px 0 0 0;">Direct operational access to specialized qualification, prognostic, and governance environments.</p>
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
                <p style="font-size:11.5px; color:#64748B; line-height:1.5; margin:0;">Complete 256-die telemetry records, per-lot distributions, and digital twins.</p>
              </div>
              <div style="margin-top:12px; font-size:10.5px; font-weight:600; color:#1976B8;">Open Inventory →</div>
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
              <div style="margin-top:12px; font-size:10.5px; font-weight:600; color:#1976B8;">Inspect Outliers →</div>
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
              <div style="margin-top:12px; font-size:10.5px; font-weight:600; color:#1976B8;">Run Forecast →</div>
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
                <p style="font-size:11.5px; color:#64748B; line-height:1.5; margin:0;">Fail-closed disposition policy, threshold calibration (θ*=0.20), and human review tracking.</p>
              </div>
              <div style="margin-top:12px; font-size:10.5px; font-weight:600; color:#1976B8;">Review Governance →</div>
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
              <div style="margin-top:12px; font-size:10.5px; font-weight:600; color:#1976B8;">Explore Telemetry →</div>
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
                <p style="font-size:11.5px; color:#64748B; line-height:1.5; margin:0;">Comprehensive verification audit trails, model cards, and forensic qualification dossiers.</p>
              </div>
              <div style="margin-top:12px; font-size:10.5px; font-weight:600; color:#1976B8;">Generate Reports →</div>
            </div>
          </div>
        </div>

        <!-- 5. SECTION MOVED DOWN: How PREDICTA Works (Concise 5-10s Visual Flow) -->
        <div style="margin-bottom:24px;">
          <div style="margin-bottom:12px;">
            <h2 style="font-family:var(--font-display); font-size:15px; font-weight:700; color:#123B63; margin:0;">How PREDICTA Works</h2>
            <p style="font-size:12px; color:#64748B; margin:2px 0 0 0;">End-to-end prognostic qualification architecture from sensor ingestion to fail-closed disposition.</p>
          </div>
          <div class="pipeline-grid">
            <div class="pipeline-card">
              <div>
                <span class="pipeline-step-badge">01 — MEASURE</span>
                <div style="font-size:14px; font-weight:700; color:#123B63; margin-bottom:4px;">Telemetry Ingestion</div>
                <p style="font-size:11.5px; color:#475569; line-height:1.4; margin:0;">Ingests 14 parametric channels at 0h ATE &amp; 24h burn-in checkpoints.</p>
              </div>
              <div style="margin-top:10px; font-size:10.5px; font-family:var(--font-mono); color:#1976B8; background:#F0F9FF; padding:3px 8px; border-radius:4px; font-weight:600;">14 Channels • 24h Epoch</div>
            </div>

            <div class="pipeline-card">
              <div>
                <span class="pipeline-step-badge">02 — DETECT</span>
                <div style="font-size:14px; font-weight:700; color:#123B63; margin-bottom:4px;">Anomaly Ensemble</div>
                <p style="font-size:11.5px; color:#475569; line-height:1.4; margin:0;">Identifies lot-relative outliers via PAT-MAD (3.5σ), COPOD &amp; Isolation Forest.</p>
              </div>
              <div style="margin-top:10px; font-size:10.5px; font-family:var(--font-mono); color:#0F8B8D; background:#F0FDF4; padding:3px 8px; border-radius:4px; font-weight:600;">PAT-MAD + COPOD + IF</div>
            </div>

            <div class="pipeline-card">
              <div>
                <span class="pipeline-step-badge">03 — PREDICT</span>
                <div style="font-size:14px; font-weight:700; color:#123B63; margin-bottom:4px;">Degradation Forecast</div>
                <p style="font-size:11.5px; color:#475569; line-height:1.4; margin:0;">Projects 168h drift with GPR &amp; evaluates latent failure risk via XGB-100.</p>
              </div>
              <div style="margin-top:10px; font-size:10.5px; font-family:var(--font-mono); color:#D97706; background:#FFFBEB; padding:3px 8px; border-radius:4px; font-weight:600;">GPR 168h + XGB-100</div>
            </div>

            <div class="pipeline-card">
              <div>
                <span class="pipeline-step-badge">04 — DECIDE</span>
                <div style="font-size:14px; font-weight:700; color:#123B63; margin-bottom:4px;">Governed Disposition</div>
                <p style="font-size:11.5px; color:#475569; line-height:1.4; margin:0;">Synthesizes evidence into fail-closed disposition (PASS, MONITOR, REJECT) at θ* = 0.20.</p>
              </div>
              <div style="margin-top:10px; font-size:10.5px; font-family:var(--font-mono); color:#059669; background:#ECFDF5; padding:3px 8px; border-radius:4px; font-weight:600;">Fail-Closed • θ* = 0.20</div>
            </div>
          </div>
        </div>

        <!-- 6. CONCRETE EVIDENCE FLOW: Static vs Dynamic Reliability Screening -->
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
                <div style="font-size:13.5px; font-weight:700; color:#475569;">Static ATE Screening (Conventional)</div>
                <span class="badge" style="background:#E2E8F0; color:#475569; font-size:10px;">SINGLE TIMESTEP</span>
              </div>
              
              <!-- Concrete Visual Step Flow -->
              <div class="flow-progression-row">
                <span class="flow-node">Single 0h Check</span>
                <span class="flow-arrow">→</span>
                <span class="flow-node">Within ±3σ Bounds</span>
                <span class="flow-arrow">→</span>
                <span class="flow-node highlight-pass">Verdict: PASS (0h)</span>
                <span class="flow-arrow">→</span>
                <span class="flow-node highlight-crit">FAILS @ 96h (Escape)</span>
              </div>

              <ul style="font-size:11.5px; color:#475569; line-height:1.5; margin-left:18px; margin-bottom:8px;">
                <li>Checks single-point sensor readings against broad static datasheet bounds.</li>
                <li>Blind to lot distribution shift and rate of change d(I<sub>leak</sub>)/dt.</li>
              </ul>
            </div>

            <!-- Right: Dynamic Screening -->
            <div class="screening-pillar-card dynamic">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div style="font-size:13.5px; font-weight:700; color:#1976B8;">PREDICTA Multi-Evidence Screening</div>
                <span class="badge pass" style="font-size:10px;">PROGNOSTIC FUSION</span>
              </div>

              <!-- Concrete Visual Step Flow -->
              <div class="flow-progression-row">
                <span class="flow-node highlight-warn">Lot Outlier (+4.2 MAD)</span>
                <span class="flow-arrow">→</span>
                <span class="flow-node highlight-warn">24h Drift (+31.2%)</span>
                <span class="flow-arrow">→</span>
                <span class="flow-node highlight-crit">GPR Breach @ 96h</span>
                <span class="flow-arrow">→</span>
                <span class="flow-node highlight-crit">REJECT @ 24h</span>
              </div>

              <ul style="font-size:11.5px; color:#334155; line-height:1.5; margin-left:18px; margin-bottom:8px;">
                <li>Part Average Testing (PAT-MAD) detects spatial shift relative to wafer lot.</li>
                <li>Temporal GPR &amp; XGB-100 forecast future limit breach for early 24h interception.</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- 7. ACTUAL ENGINEERING CASE: Latent Escape Spotlight -->
        <div class="latent-escape-spotlight-wrapper" id="home-latent-escape-spotlight" style="margin-bottom:24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div>
              <div style="font-size:10px; font-weight:700; color:#DC2626; text-transform:uppercase; letter-spacing:1px;">LATENT ESCAPE SPOTLIGHT</div>
              <h3 style="font-family:var(--font-display); font-size:15px; font-weight:800; color:#123B63; margin:0;">Within Datasheet Limits — Abnormal Degradation Behavior</h3>
            </div>
            <span class="badge warning" style="font-size:10px; font-weight:700;">SYNTHETIC BENCHMARK SCENARIO</span>
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
                <div class="spotlight-cell-label">1. Static Test</div>
                <div class="spotlight-cell-val" style="color:#059669;">PASS ✓</div>
                <div class="spotlight-cell-desc">All 14 parametric channels within datasheet ±3σ limits.</div>
              </div>

              <div class="spotlight-cell warning-border">
                <div class="spotlight-cell-label">2. Lot Relative</div>
                <div class="spotlight-cell-val" style="color:#D97706;" id="spotlight-mad-val">+4.2 MAD ⚠</div>
                <div class="spotlight-cell-desc">Spatial outlier relative to lot distribution (COPOD q = 0.012).</div>
              </div>

              <div class="spotlight-cell warning-border">
                <div class="spotlight-cell-label">3. 24h Telemetry</div>
                <div class="spotlight-cell-val" style="color:#D97706;" id="spotlight-drift-val">+31.2% Drift ⚠</div>
                <div class="spotlight-cell-desc">Elevated rate of change d(IDDQ)/dt between 0h and 24h.</div>
              </div>

              <div class="spotlight-cell critical-border">
                <div class="spotlight-cell-label">4. 168h Forecast</div>
                <div class="spotlight-cell-val" style="color:#DC2626;" id="spotlight-breach-val">Limit Breach @ 96h</div>
                <div class="spotlight-cell-desc">GPR forecast with 95% model interval (uncalibrated).</div>
              </div>

              <div class="spotlight-cell decision-cell">
                <div class="spotlight-cell-label">5. Governed Decision</div>
                <div class="spotlight-cell-val" id="spotlight-decision-val"><span class="badge reject" style="font-size:12px;">REJECT / QUARANTINE</span></div>
                <div class="spotlight-cell-desc" id="spotlight-decision-desc">Fail-closed policy intercepts latent hazard at 24h.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      `;

const newBuildContent = buildContent.slice(0, startIndex) + reorderedHomePage + buildContent.slice(endIndex);
fs.writeFileSync(buildPath, newBuildContent, 'utf8');
console.log("✔ Successfully updated build_restored_frontend.js with reordered Home sections!");

// 5. UPDATE script.js TO ADD MOUSE TILT PARALLAX LISTENER
const scriptPath = path.join(__dirname, '..', 'script.js');
let scriptContent = fs.readFileSync(scriptPath, 'utf8');

const tiltScriptCode = `
  // Hero 3D Chip Parallax / Subtle Cursor Tilt Controller
  function initHeroChipTilt() {
    const chipCard = document.getElementById("hero-chip-3d-card");
    if (!chipCard) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    chipCard.addEventListener("mousemove", (e) => {
      const rect = chipCard.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      const rotateX = -(y / (rect.height / 2)) * 8; // max 8 deg
      const rotateY = (x / (rect.width / 2)) * 10; // max 10 deg
      chipCard.style.transform = \`perspective(900px) rotateX(\${rotateX.toFixed(2)}deg) rotateY(\${rotateY.toFixed(2)}deg) scale3d(1.015, 1.015, 1.015)\`;
    });

    chipCard.addEventListener("mouseleave", () => {
      chipCard.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
    });
  }
  window.initHeroChipTilt = initHeroChipTilt;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeroChipTilt);
  } else {
    initHeroChipTilt();
  }
`;

if (!scriptContent.includes('function initHeroChipTilt')) {
  scriptContent += tiltScriptCode;
  fs.writeFileSync(scriptPath, scriptContent, 'utf8');
  console.log("✔ Successfully attached 3D chip tilt listener to script.js");
}

console.log("=========================================================================");
console.log("HOME REFINEMENT UPDATE COMPLETE");
console.log("=========================================================================");
