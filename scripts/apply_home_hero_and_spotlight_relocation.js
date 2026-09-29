const fs = require('fs');
const path = require('path');

console.log('=== APPLYING CONTROLLED FRONTEND CORRECTIONS ===');

// 1. UPDATE style.css and frontend/style.css
let styleCss = fs.readFileSync('style.css', 'utf8');

// Replace min-height: calc(100vh - 128px); with min-height: auto;
styleCss = styleCss.replace(/min-height:\s*calc\(100vh\s*-\s*128px\);/g, 'min-height: auto;');
// Ensure hero-card padding is compact and balanced
styleCss = styleCss.replace(/padding:\s*40px\s+36px;/g, 'padding: 32px 36px;');
styleCss = styleCss.replace(/margin-bottom:\s*28px;/g, 'margin-bottom: 24px;');

fs.writeFileSync('style.css', styleCss, 'utf8');
fs.writeFileSync('frontend/style.css', styleCss, 'utf8');
console.log('✔ Updated style.css and frontend/style.css (Hero height is now compact & balanced)');

// 2. READ index.html
let indexHtml = fs.readFileSync('index.html', 'utf8');

// Extract SVG data for the 8 wafers before modifying
const waferSvgs = {};
for (let w = 43; w <= 50; w++) {
  const marker = 'Wafer ' + w;
  const startIdx = indexHtml.indexOf(marker);
  if (startIdx !== -1) {
    const svgStart = indexHtml.indexOf('<svg', startIdx);
    const svgEnd = indexHtml.indexOf('</svg>', svgStart);
    const svg = indexHtml.substring(svgStart, svgEnd + 6);
    waferSvgs['LOT-SYN-0' + w] = {
      waferNum: w,
      svg: svg
    };
  }
}

// A. Update Single Wafer HTML in Home Page
// Find the 8-wafer spatial distribution matrix block and replace with SINGLE WAFER block
const waferSectionRegex = /<!-- 2-Column Wafer Spatial Health & Recent Qualification Activity Table -->[\s\S]*?<!-- 4\. LATENT ESCAPE SPOTLIGHT -->/;

const singleWaferHtml = `<!-- 2-Column Wafer Spatial Health & Recent Qualification Activity Table -->
        <div style="display:grid; grid-template-columns: 1.05fr 0.95fr; gap:20px; margin-bottom:24px; align-items:start;">
          <!-- Left: Single Prominent Interactive Wafer Spatial Distribution Card -->
          <div class="card" style="background:#FFFFFF; border:1px solid #C5DEF0; padding:20px 22px; border-radius:8px; box-shadow:var(--shadow-sm);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; gap:12px; flex-wrap:wrap;">
              <div>
                <div class="technical-overline" style="font-size:10.5px; font-weight:700; color:#1976B8; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:3px;">SILICON WAFER SPATIAL TELEMETRY</div>
                <h3 style="font-family:var(--font-display); font-size:16px; font-weight:700; color:#144A75; margin:0;" id="home-wafer-title">Wafer 43 Spatial Health Map</h3>
                <p style="font-size:12.5px; color:#5687AD; margin:2px 0 0 0;">300mm Circular Silicon Wafer • 32 Monitored Die Locations</p>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <label for="home-wafer-lot-selector" style="font-size:11.5px; font-weight:700; color:#144A75;">Active Lot:</label>
                <select id="home-wafer-lot-selector" class="form-control" style="width:auto; font-size:12.5px; font-weight:600; padding:5px 10px; color:#144A75; border:1px solid #C5DEF0; border-radius:5px; background:#FFFFFF; cursor:pointer;" onchange="window.updateHomeWaferDisplay(this.value)">
                  <option value="LOT-SYN-043" selected>LOT-SYN-043 (Wafer 43 • 96.9% Yield)</option>
                  <option value="LOT-SYN-044">LOT-SYN-044 (Wafer 44 • 78.1% Yield)</option>
                  <option value="LOT-SYN-045">LOT-SYN-045 (Wafer 45 • 90.6% Yield)</option>
                  <option value="LOT-SYN-046">LOT-SYN-046 (Wafer 46 • 81.3% Yield)</option>
                  <option value="LOT-SYN-047">LOT-SYN-047 (Wafer 47 • 93.8% Yield)</option>
                  <option value="LOT-SYN-048">LOT-SYN-048 (Wafer 48 • 87.5% Yield)</option>
                  <option value="LOT-SYN-049">LOT-SYN-049 (Wafer 49 • 90.6% Yield)</option>
                  <option value="LOT-SYN-050">LOT-SYN-050 (Wafer 50 • 84.4% Yield)</option>
                </select>
              </div>
            </div>

            <!-- Single Wafer Graphic Container with Summary Stats -->
            <div style="display:grid; grid-template-columns: 240px 1fr; gap:18px; align-items:center; background:#F0F6FC; border:1px solid #C5DEF0; border-radius:6px; padding:14px 16px; margin-bottom:12px;">
              <!-- Single Wafer SVG -->
              <div id="home-single-wafer-svg-wrap" style="display:flex; justify-content:center; align-items:center;">
                <svg width="220" height="220" viewBox="0 0 160 160" id="home-single-wafer-svg">
                  <circle cx="80" cy="80" r="72" fill="#FFFFFF" stroke="#B8D6ED" stroke-width="1.5"/>
                  <circle cx="80" cy="80" r="70" fill="#F0F6FC" stroke="#C5DEF0" stroke-width="0.8"/>
                  <path d="M 76,8 A 4,4 0 0,0 84,8 Z" fill="#C5DEF0" stroke="#5687AD" stroke-width="0.8"/>
                  <rect class="die-cell" x="50" y="26" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R0C0')"><title>DIE-W43-R0C0: PASS (P=0.020)</title></rect><rect class="die-cell" x="66" y="26" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R0C1')"><title>DIE-W43-R0C1: PASS (P=0.023)</title></rect><rect class="die-cell" x="82" y="26" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R0C2')"><title>DIE-W43-R0C2: PASS (P=0.026)</title></rect><rect class="die-cell" x="98" y="26" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R0C3')"><title>DIE-W43-R0C3: PASS (P=0.029)</title></rect><rect class="die-cell" x="34" y="42" width="12" height="12" rx="2" fill="#FDE68A" stroke="#B45309" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R0C4')"><title>DIE-W43-R0C4: MONITOR (P=0.312)</title></rect><rect class="die-cell" x="50" y="42" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R0C5')"><title>DIE-W43-R0C5: PASS (P=0.035)</title></rect><rect class="die-cell" x="66" y="42" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R1C0')"><title>DIE-W43-R1C0: PASS (P=0.038)</title></rect><rect class="die-cell" x="82" y="42" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R1C1')"><title>DIE-W43-R1C1: PASS (P=0.041)</title></rect><rect class="die-cell" x="98" y="42" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R1C2')"><title>DIE-W43-R1C2: PASS (P=0.044)</title></rect><rect class="die-cell" x="114" y="42" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R1C3')"><title>DIE-W43-R1C3: PASS (P=0.047)</title></rect><rect class="die-cell" x="34" y="58" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R1C4')"><title>DIE-W43-R1C4: PASS (P=0.050)</title></rect><rect class="die-cell" x="50" y="58" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R1C5')"><title>DIE-W43-R1C5: PASS (P=0.053)</title></rect><rect class="die-cell" x="66" y="58" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R2C0')"><title>DIE-W43-R2C0: PASS (P=0.056)</title></rect><rect class="die-cell" x="82" y="58" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R2C1')"><title>DIE-W43-R2C1: PASS (P=0.059)</title></rect><rect class="die-cell" x="98" y="58" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R2C2')"><title>DIE-W43-R2C2: PASS (P=0.062)</title></rect><rect class="die-cell" x="114" y="58" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R2C3')"><title>DIE-W43-R2C3: PASS (P=0.065)</title></rect><rect class="die-cell" x="34" y="74" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R2C4')"><title>DIE-W43-R2C4: PASS (P=0.068)</title></rect><rect class="die-cell" x="50" y="74" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R2C5')"><title>DIE-W43-R2C5: PASS (P=0.071)</title></rect><rect class="die-cell" x="66" y="74" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R3C0')"><title>DIE-W43-R3C0: PASS (P=0.074)</title></rect><rect class="die-cell" x="82" y="74" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R3C1')"><title>DIE-W43-R3C1: PASS (P=0.077)</title></rect><rect class="die-cell" x="98" y="74" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R3C2')"><title>DIE-W43-R3C2: PASS (P=0.080)</title></rect><rect class="die-cell" x="114" y="74" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R3C3')"><title>DIE-W43-R3C3: PASS (P=0.083)</title></rect><rect class="die-cell" x="34" y="90" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R3C4')"><title>DIE-W43-R3C4: PASS (P=0.086)</title></rect><rect class="die-cell" x="50" y="90" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R3C5')"><title>DIE-W43-R3C5: PASS (P=0.089)</title></rect><rect class="die-cell" x="66" y="90" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R4C0')"><title>DIE-W43-R4C0: PASS (P=0.092)</title></rect><rect class="die-cell" x="82" y="90" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R4C1')"><title>DIE-W43-R4C1: PASS (P=0.095)</title></rect><rect class="die-cell" x="98" y="90" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R4C2')"><title>DIE-W43-R4C2: PASS (P=0.098)</title></rect><rect class="die-cell" x="114" y="90" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R4C3')"><title>DIE-W43-R4C3: PASS (P=0.101)</title></rect><rect class="die-cell" x="50" y="106" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R4C4')"><title>DIE-W43-R4C4: PASS (P=0.104)</title></rect><rect class="die-cell" x="66" y="106" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R4C5')"><title>DIE-W43-R4C5: PASS (P=0.107)</title></rect><rect class="die-cell" x="82" y="106" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R5C0')"><title>DIE-W43-R5C0: PASS (P=0.110)</title></rect><rect class="die-cell" x="98" y="106" width="12" height="12" rx="2" fill="#BAE6FD" stroke="#0284C7" stroke-width="1" onclick="window.openReliabilityPassport('DIE-W43-R5C1')"><title>DIE-W43-R5C1: PASS (P=0.113)</title></rect>
                </svg>
              </div>

              <!-- Wafer Diagnostics & Yield Stats -->
              <div style="display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:12px; font-weight:700; color:#144A75;">Wafer Yield</span>
                  <span id="home-wafer-yield-val" class="badge pass" style="font-size:13px; font-weight:800; padding:3px 10px;">96.9%</span>
                </div>
                
                <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin:4px 0;">
                  <div style="background:#FFFFFF; border:1px solid #BBF7D0; border-radius:5px; padding:6px 8px; text-align:center;">
                    <div style="font-size:9.5px; font-weight:700; color:#15803D; text-transform:uppercase;">PASS</div>
                    <div id="home-wafer-pass-count" style="font-size:15px; font-weight:800; color:#15803D;">31</div>
                  </div>
                  <div style="background:#FFFFFF; border:1px solid #FDE68A; border-radius:5px; padding:6px 8px; text-align:center;">
                    <div style="font-size:9.5px; font-weight:700; color:#92400E; text-transform:uppercase;">MONITOR</div>
                    <div id="home-wafer-mon-count" style="font-size:15px; font-weight:800; color:#92400E;">1</div>
                  </div>
                  <div style="background:#FFFFFF; border:1px solid #FECACA; border-radius:5px; padding:6px 8px; text-align:center;">
                    <div style="font-size:9.5px; font-weight:700; color:#991B1B; text-transform:uppercase;">REJECT</div>
                    <div id="home-wafer-rej-count" style="font-size:15px; font-weight:800; color:#991B1B;">0</div>
                  </div>
                </div>

                <div style="font-size:11.5px; color:#5687AD; line-height:1.4;">
                  Interactive die matrix: click any die to inspect its multi-layer reliability passport and telemetry drift.
                </div>
              </div>
            </div>

            <!-- Quick Lot Selector Chips (All 8 Lots: 4 original + 4 expanded) -->
            <div style="display:flex; gap:6px; flex-wrap:wrap; font-size:11px;">
              <span style="font-size:11px; font-weight:700; color:#5687AD; margin-right:4px; align-self:center;">Lots:</span>
              <button class="btn btn-outline home-lot-pill active" onclick="window.updateHomeWaferDisplay('LOT-SYN-043')" id="lot-pill-043" style="padding:3px 8px; font-size:11px; font-family:var(--font-mono); font-weight:700; background:#FFFFFF; border:1px solid #1976B8; color:#1976B8;">W43 (043)</button>
              <button class="btn btn-outline home-lot-pill" onclick="window.updateHomeWaferDisplay('LOT-SYN-044')" id="lot-pill-044" style="padding:3px 8px; font-size:11px; font-family:var(--font-mono); font-weight:600; background:#FFFFFF; border:1px solid #C5DEF0; color:#2B618E;">W44 (044)</button>
              <button class="btn btn-outline home-lot-pill" onclick="window.updateHomeWaferDisplay('LOT-SYN-045')" id="lot-pill-045" style="padding:3px 8px; font-size:11px; font-family:var(--font-mono); font-weight:600; background:#FFFFFF; border:1px solid #C5DEF0; color:#2B618E;">W45 (045)</button>
              <button class="btn btn-outline home-lot-pill" onclick="window.updateHomeWaferDisplay('LOT-SYN-046')" id="lot-pill-046" style="padding:3px 8px; font-size:11px; font-family:var(--font-mono); font-weight:600; background:#FFFFFF; border:1px solid #C5DEF0; color:#2B618E;">W46 (046)</button>
              <button class="btn btn-outline home-lot-pill" onclick="window.updateHomeWaferDisplay('LOT-SYN-047')" id="lot-pill-047" style="padding:3px 8px; font-size:11px; font-family:var(--font-mono); font-weight:600; background:#FFFFFF; border:1px solid #C5DEF0; color:#2B618E;">W47 (047)</button>
              <button class="btn btn-outline home-lot-pill" onclick="window.updateHomeWaferDisplay('LOT-SYN-048')" id="lot-pill-048" style="padding:3px 8px; font-size:11px; font-family:var(--font-mono); font-weight:600; background:#FFFFFF; border:1px solid #C5DEF0; color:#2B618E;">W48 (048)</button>
              <button class="btn btn-outline home-lot-pill" onclick="window.updateHomeWaferDisplay('LOT-SYN-049')" id="lot-pill-049" style="padding:3px 8px; font-size:11px; font-family:var(--font-mono); font-weight:600; background:#FFFFFF; border:1px solid #C5DEF0; color:#2B618E;">W49 (049)</button>
              <button class="btn btn-outline home-lot-pill" onclick="window.updateHomeWaferDisplay('LOT-SYN-050')" id="lot-pill-050" style="padding:3px 8px; font-size:11px; font-family:var(--font-mono); font-weight:600; background:#FFFFFF; border:1px solid #C5DEF0; color:#2B618E;">W50 (050)</button>
            </div>
          </div>

          <!-- Right: Recent Qualification Activity Table -->
          <div class="card" style="background:#FFFFFF; border:1px solid #C5DEF0; padding:20px 22px; border-radius:8px; box-shadow:var(--shadow-sm);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
              <div>
                <div class="technical-overline" style="font-size:10.5px; font-weight:700; color:#1976B8; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:3px;">QUALIFICATION FEED</div>
                <h3 style="font-family:var(--font-display); font-size:16px; font-weight:700; color:#144A75; margin:0;">Recent Qualification Activity</h3>
                <p style="font-size:12.5px; color:#5687AD; margin:2px 0 0 0;">Latest evaluated components across all active lots</p>
              </div>
              <button class="btn btn-sm btn-outline" onclick="window.switchPage('page-screening')" style="font-size:12px; font-weight:600; padding:4px 12px;">Go to Screening →</button>
            </div>
            <div class="table-container"><table class="table-compact" style="width:100%; font-size:12.5px; border-collapse:collapse;">
              <thead>
                <tr style="border-bottom:1px solid #D8EAF6; text-align:left; color:#5687AD;">
                  <th style="padding:8px 10px;">Die UID</th>
                  <th style="padding:8px 10px;">Lot ID</th>
                  <th style="padding:8px 10px;">Risk Score</th>
                  <th style="padding:8px 10px;">Disposition</th>
                  <th style="padding:8px 10px; text-align:right;">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom:1px solid #F0F6FC;">
                  <td style="padding:10px; font-weight:700; color:#144A75;">DIE-R20C20</td>
                  <td style="padding:10px; font-family:var(--font-mono); color:#2B618E;">LOT-SYN-044</td>
                  <td style="padding:10px; font-weight:700; color: #991B1B;">94.1%</td>
                  <td style="padding:10px;"><span class="badge reject" style="font-size:10.5px;">REJECT</span></td>
                  <td style="padding:10px; text-align:right;"><button class="btn btn-sm btn-outline" onclick="window.openReliabilityPassport('DIE-R20C20')" style="font-size:11.5px; padding:3px 10px;">Passport</button></td>
                </tr>
                <tr style="border-bottom:1px solid #F0F6FC;">
                  <td style="padding:10px; font-weight:700; color:#144A75;">DIE-R45C15</td>
                  <td style="padding:10px; font-family:var(--font-mono); color:#2B618E;">LOT-SYN-046</td>
                  <td style="padding:10px; font-weight:700; color: #991B1B;">99.5%</td>
                  <td style="padding:10px;"><span class="badge reject" style="font-size:10.5px;">REJECT</span></td>
                  <td style="padding:10px; text-align:right;"><button class="btn btn-sm btn-outline" onclick="window.openReliabilityPassport('DIE-R45C15')" style="font-size:11.5px; padding:3px 10px;">Passport</button></td>
                </tr>
                <tr style="border-bottom:1px solid #F0F6FC;">
                  <td style="padding:10px; font-weight:700; color:#144A75;">DIE-R12C28</td>
                  <td style="padding:10px; font-family:var(--font-mono); color:#2B618E;">LOT-SYN-046</td>
                  <td style="padding:10px; font-weight:700; color: #92400E;">31.2%</td>
                  <td style="padding:10px;"><span class="badge warning" style="font-size:10.5px;">MONITOR</span></td>
                  <td style="padding:10px; text-align:right;"><button class="btn btn-sm btn-outline" onclick="window.openReliabilityPassport('DIE-R12C28')" style="font-size:11.5px; padding:3px 10px;">Passport</button></td>
                </tr>
                <tr style="border-bottom:1px solid #F0F6FC;">
                  <td style="padding:10px; font-weight:700; color:#144A75;">DIE-R15C15</td>
                  <td style="padding:10px; font-family:var(--font-mono); color:#2B618E;">LOT-SYN-043</td>
                  <td style="padding:10px; font-weight:700; color: #15803D;">8.9%</td>
                  <td style="padding:10px;"><span class="badge pass" style="font-size:10.5px;">PASS</span></td>
                  <td style="padding:10px; text-align:right;"><button class="btn btn-sm btn-outline" onclick="window.openReliabilityPassport('DIE-R15C15')" style="font-size:11.5px; padding:3px 10px;">Passport</button></td>
                </tr>
              </tbody>
            </table></div>
          </div>
        </div>

        <!-- 4. TECHNICAL WORKSTATION MODULES -->`;

// Extract Latent Escape Spotlight HTML before replacing
const spotlightRegex = /<!-- 4\. LATENT ESCAPE SPOTLIGHT -->[\s\S]*?<!-- 5\. TECHNICAL WORKSTATION MODULES -->/;
const spotlightMatch = indexHtml.match(spotlightRegex);
let spotlightHtml = '';
if (spotlightMatch) {
  spotlightHtml = spotlightMatch[0].replace('<!-- 5. TECHNICAL WORKSTATION MODULES -->', '').trim();
  // Adjust ID if necessary or keep it clean
}

// Replace wafer section + spotlight from Home
const homeMiddleRegex = /<!-- 2-Column Wafer Spatial Health & Recent Qualification Activity Table -->[\s\S]*?<!-- 5\. TECHNICAL WORKSTATION MODULES -->/;

if (homeMiddleRegex.test(indexHtml)) {
  indexHtml = indexHtml.replace(homeMiddleRegex, singleWaferHtml);
  console.log('✔ Replaced 8-wafer matrix with Single Prominent Interactive Wafer & removed Spotlight from Home');
} else {
  console.error('❌ Could not match homeMiddleRegex');
}

// B. Add Latent Escape Spotlight to Advanced Subtab 4 (adv-tab-latent-risk)
if (spotlightHtml) {
  // Insert at top of adv-tab-latent-risk
  const advTabLatentRiskMarker = '<div id="adv-tab-latent-risk" class="adv-subtab-content" style="display:none;">';
  if (indexHtml.includes(advTabLatentRiskMarker)) {
    indexHtml = indexHtml.replace(
      advTabLatentRiskMarker,
      advTabLatentRiskMarker + '\n\n          ' + spotlightHtml + '\n'
    );
    console.log('✔ Inserted Latent Escape Spotlight into Advanced (adv-tab-latent-risk)');
  } else {
    console.error('❌ Could not find adv-tab-latent-risk marker in index.html');
  }
}

fs.writeFileSync('index.html', indexHtml, 'utf8');
fs.writeFileSync('frontend/index.html', indexHtml, 'utf8');
console.log('✔ Saved updated index.html & frontend/index.html');

// 3. UPDATE script.js with window.updateHomeWaferDisplay
let scriptJs = fs.readFileSync('script.js', 'utf8');

const waferScriptAddition = `
// =========================================================================
// HOME SINGLE WAFER DYNAMIC UPDATE LOGIC
// =========================================================================
window.HOME_WAFER_DATA = {
  'LOT-SYN-043': { waferNum: 43, yield: '96.9%', pass: 31, mon: 1, rej: 0 },
  'LOT-SYN-044': { waferNum: 44, yield: '78.1%', pass: 25, mon: 3, rej: 4 },
  'LOT-SYN-045': { waferNum: 45, yield: '90.6%', pass: 29, mon: 2, rej: 1 },
  'LOT-SYN-046': { waferNum: 46, yield: '81.3%', pass: 26, mon: 3, rej: 3 },
  'LOT-SYN-047': { waferNum: 47, yield: '93.8%', pass: 30, mon: 1, rej: 1 },
  'LOT-SYN-048': { waferNum: 48, yield: '87.5%', pass: 28, mon: 2, rej: 2 },
  'LOT-SYN-049': { waferNum: 49, yield: '90.6%', pass: 29, mon: 1, rej: 2 },
  'LOT-SYN-050': { waferNum: 50, yield: '84.4%', pass: 27, mon: 2, rej: 3 }
};

window.updateHomeWaferDisplay = function(lotId) {
  const data = window.HOME_WAFER_DATA[lotId] || window.HOME_WAFER_DATA['LOT-SYN-043'];
  const wNum = data.waferNum;

  // Update title
  const titleEl = document.getElementById('home-wafer-title');
  if (titleEl) titleEl.textContent = 'Wafer ' + wNum + ' Spatial Health Map';

  // Update selector
  const sel = document.getElementById('home-wafer-lot-selector');
  if (sel && sel.value !== lotId) sel.value = lotId;

  // Update yield & counts
  const yieldEl = document.getElementById('home-wafer-yield-val');
  if (yieldEl) yieldEl.textContent = data.yield;

  const passEl = document.getElementById('home-wafer-pass-count');
  if (passEl) passEl.textContent = data.pass;

  const monEl = document.getElementById('home-wafer-mon-count');
  if (monEl) monEl.textContent = data.mon;

  const rejEl = document.getElementById('home-wafer-rej-count');
  if (rejEl) rejEl.textContent = data.rej;

  // Update quick lot pills active state
  for (let w = 43; w <= 50; w++) {
    const pill = document.getElementById('lot-pill-0' + w);
    if (pill) {
      if ('LOT-SYN-0' + w === lotId) {
        pill.classList.add('active');
        pill.style.borderColor = '#1976B8';
        pill.style.color = '#1976B8';
        pill.style.fontWeight = '700';
      } else {
        pill.classList.remove('active');
        pill.style.borderColor = '#C5DEF0';
        pill.style.color = '#2B618E';
        pill.style.fontWeight = '600';
      }
    }
  }

  // Update SVG dies
  const svgWrap = document.getElementById('home-single-wafer-svg-wrap');
  if (svgWrap && window.HOME_WAFER_SVGS && window.HOME_WAFER_SVGS[lotId]) {
    svgWrap.innerHTML = window.HOME_WAFER_SVGS[lotId];
  }
};
`;

// Also attach the 8 raw SVG strings to window.HOME_WAFER_SVGS
const svgsDict = JSON.stringify(Object.fromEntries(
  Object.entries(waferSvgs).map(([k, v]) => [k, v.svg.replace('width="100" height="100"', 'width="220" height="220" id="home-single-wafer-svg"')])
));

const completeWaferScript = `\nwindow.HOME_WAFER_SVGS = ${svgsDict};\n` + waferScriptAddition;

if (!scriptJs.includes('window.updateHomeWaferDisplay')) {
  scriptJs += '\n' + completeWaferScript;
  fs.writeFileSync('script.js', scriptJs, 'utf8');
  fs.writeFileSync('frontend/script.js', scriptJs, 'utf8');
  console.log('✔ Added window.updateHomeWaferDisplay to script.js and frontend/script.js');
}

console.log('=== CONTROLLED FRONTEND CORRECTIONS COMPLETED ===');
