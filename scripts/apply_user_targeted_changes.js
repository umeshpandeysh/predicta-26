const fs = require('fs');
const path = require('path');

console.log('=== EXECUTING TARGETED REFINEMENTS ===');

// =========================================================================
// 1. RESTORE SCREENING PAGE FROM PRE_TYPOGRAPHY_GOLDEN_STATE
// =========================================================================
const goldenIndex = fs.readFileSync('PRE_TYPOGRAPHY_GOLDEN_STATE/index.html', 'utf8');
let updatedIndex = fs.readFileSync('index.html', 'utf8');

function extractSection(html, id) {
  const start = html.indexOf('<section id="' + id + '"');
  if (start === -1) return null;
  const end = html.indexOf('</section>', start) + 10;
  return html.substring(start, end);
}

const goldenScreening = extractSection(goldenIndex, 'page-screening');
if (!goldenScreening) {
  console.error('Could not extract golden screening section!');
  process.exit(1);
}

const curScreeningStart = updatedIndex.indexOf('<section id="page-screening"');
const curScreeningEnd = updatedIndex.indexOf('</section>', curScreeningStart) + 10;

updatedIndex = updatedIndex.substring(0, curScreeningStart) + goldenScreening + updatedIndex.substring(curScreeningEnd);
console.log('✔ 1. Screening page restored to exact saved GOLDEN_STATE.');

// =========================================================================
// 2. HOME PAGE — WAFER SECTION & 9-ROW QUALIFICATION FEED
// =========================================================================
const section2Start = updatedIndex.indexOf('<!-- 2-Column Wafer Spatial Health & Recent Qualification Activity Table -->');
const section2End = updatedIndex.indexOf('<!-- 4. TECHNICAL WORKSTATION MODULES -->', section2Start);

if (section2Start === -1 || section2End === -1) {
  console.error('Could not locate section 2 boundaries in index.html!', { section2Start, section2End });
  process.exit(1);
}

const newSection2Html = `<!-- 2-Column Wafer Spatial Health & Recent Qualification Activity Table -->
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:24px; align-items:stretch;">
          <!-- Left: Single Prominent Interactive Wafer Spatial Distribution Card -->
          <div class="card" style="background:#FFFFFF; border:1px solid #C5DEF0; padding:20px 22px; border-radius:8px; box-shadow:var(--shadow-sm); display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                <div>
                  <div class="technical-overline" style="font-size:12px; font-weight:700; color:#1976B8; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:2px;">SPATIAL WAFER TELEMETRY</div>
                  <h3 style="font-family:var(--font-display); font-size:16px; font-weight:700; color:#144A75; margin:0;" id="home-wafer-title">Wafer 43 Spatial Health Map</h3>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <label for="home-wafer-lot-selector" style="font-size:12px; font-weight:700; color:#144A75;">Active Lot:</label>
                  <select id="home-wafer-lot-selector" class="form-control" style="width:auto; font-size:12.5px; font-weight:600; padding:5px 10px; color:#144A75; border:1px solid #C5DEF0; border-radius:5px; background:#FFFFFF; cursor:pointer;" onchange="window.updateHomeWaferDisplay(this.value)">
                    <option value="LOT-SYN-043" selected>LOT-SYN-043 (Wafer 43)</option>
                    <option value="LOT-SYN-044">LOT-SYN-044 (Wafer 44)</option>
                    <option value="LOT-SYN-045">LOT-SYN-045 (Wafer 45)</option>
                    <option value="LOT-SYN-046">LOT-SYN-046 (Wafer 46)</option>
                    <option value="LOT-SYN-047">LOT-SYN-047 (Wafer 47)</option>
                    <option value="LOT-SYN-048">LOT-SYN-048 (Wafer 48)</option>
                    <option value="LOT-SYN-049">LOT-SYN-049 (Wafer 49)</option>
                    <option value="LOT-SYN-050">LOT-SYN-050 (Wafer 50)</option>
                  </select>
                </div>
              </div>

              <!-- Single Wafer SVG Container (Visually Centered, No Sidebars/Counters) -->
              <div id="home-single-wafer-svg-wrap" style="display:flex; justify-content:center; align-items:center; padding:18px 0; min-height:280px;">
                <svg width="250" height="250" viewBox="0 0 160 160" id="home-single-wafer-svg" style="display:block; margin:0 auto;">
                  <circle cx="80" cy="80" r="72" fill="#FFFFFF" stroke="#B8D6ED" stroke-width="1.5"/>
                  <circle cx="80" cy="80" r="70" fill="#F0F6FC" stroke="#C5DEF0" stroke-width="0.8"/>
                  <path d="M 76,8 A 4,4 0 0,0 84,8 Z" fill="#C5DEF0" stroke="#5687AD" stroke-width="0.8"/>
                  <rect class="die-cell" x="50" y="26" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R00C00" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R00C00: PASS (2.1%)</title></rect>
                  <rect class="die-cell" x="66" y="26" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R00C01" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R00C01: PASS (1.9%)</title></rect>
                  <rect class="die-cell" x="82" y="26" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R00C02" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R00C02: PASS (2.4%)</title></rect>
                  <rect class="die-cell" x="98" y="26" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R00C03" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R00C03: PASS (1.8%)</title></rect>
                  <rect class="die-cell" x="38" y="42" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R01C00" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R01C00: PASS (2.2%)</title></rect>
                  <rect class="die-cell" x="54" y="42" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R01C01" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R01C01: PASS (1.7%)</title></rect>
                  <rect class="die-cell" x="70" y="42" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R01C02" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R01C02: PASS (2.0%)</title></rect>
                  <rect class="die-cell" x="86" y="42" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R01C03" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R01C03: PASS (2.3%)</title></rect>
                  <rect class="die-cell" x="102" y="42" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R01C04" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R01C04: PASS (1.9%)</title></rect>
                  <rect class="die-cell" x="30" y="58" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R02C00" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R02C00: PASS (2.5%)</title></rect>
                  <rect class="die-cell" x="46" y="58" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R02C01" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R02C01: PASS (2.1%)</title></rect>
                  <rect class="die-cell" x="62" y="58" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R02C02" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R02C02: PASS (1.8%)</title></rect>
                  <rect class="die-cell" x="78" y="58" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R02C03" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R02C03: PASS (2.0%)</title></rect>
                  <rect class="die-cell" x="94" y="58" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R02C04" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R02C04: PASS (1.9%)</title></rect>
                  <rect class="die-cell" x="110" y="58" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R02C05" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R02C05: PASS (2.2%)</title></rect>
                  <rect class="die-cell" x="26" y="74" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R03C00" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R03C00: PASS (2.0%)</title></rect>
                  <rect class="die-cell" x="42" y="74" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R03C01" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R03C01: PASS (1.6%)</title></rect>
                  <rect class="die-cell" x="58" y="74" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R03C02" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R03C02: PASS (1.9%)</title></rect>
                  <rect class="die-cell" x="74" y="74" width="12" height="12" rx="1.5" fill="#FDE68A" stroke="#B45309" stroke-width="0.9" data-comp="DIE-R15C15" onclick="window.openReliabilityPassport('DIE-R15C15')"><title>DIE-R15C15: MONITOR (18.4%)</title></rect>
                  <rect class="die-cell" x="90" y="74" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R03C04" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R03C04: PASS (2.4%)</title></rect>
                  <rect class="die-cell" x="106" y="74" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R03C05" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R03C05: PASS (2.1%)</title></rect>
                  <rect class="die-cell" x="122" y="74" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R03C06" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R03C06: PASS (2.3%)</title></rect>
                  <rect class="die-cell" x="30" y="90" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R04C00" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R04C00: PASS (2.0%)</title></rect>
                  <rect class="die-cell" x="46" y="90" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R04C01" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R04C01: PASS (2.1%)</title></rect>
                  <rect class="die-cell" x="62" y="90" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R04C02" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R04C02: PASS (1.8%)</title></rect>
                  <rect class="die-cell" x="78" y="90" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R04C03" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R04C03: PASS (2.2%)</title></rect>
                  <rect class="die-cell" x="94" y="90" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R04C04" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R04C04: PASS (1.7%)</title></rect>
                  <rect class="die-cell" x="110" y="90" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R04C05" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R04C05: PASS (2.0%)</title></rect>
                  <rect class="die-cell" x="38" y="106" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R05C00" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R05C00: PASS (2.2%)</title></rect>
                  <rect class="die-cell" x="54" y="106" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R05C01" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R05C01: PASS (1.9%)</title></rect>
                  <rect class="die-cell" x="70" y="106" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R05C02" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R05C02: PASS (2.3%)</title></rect>
                  <rect class="die-cell" x="86" y="106" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R05C03" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R05C03: PASS (2.1%)</title></rect>
                  <rect class="die-cell" x="102" y="106" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R05C04" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R05C04: PASS (1.8%)</title></rect>
                  <rect class="die-cell" x="50" y="122" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R06C00" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R06C00: PASS (2.0%)</title></rect>
                  <rect class="die-cell" x="66" y="122" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R06C01" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R06C01: PASS (2.2%)</title></rect>
                  <rect class="die-cell" x="82" y="122" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R06C02" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R06C02: PASS (1.9%)</title></rect>
                  <rect class="die-cell" x="98" y="122" width="12" height="12" rx="1.5" fill="#BBF7D0" stroke="#15803D" stroke-width="0.6" data-comp="DIE-R06C03" onclick="window.openReliabilityPassport('DIE-R00C00')"><title>DIE-R06C03: PASS (2.1%)</title></rect>
                </svg>
              </div>
            </div>

            <!-- Quick Lot Selector Chips (All 8 Lots) -->
            <div style="display:flex; gap:6px; flex-wrap:wrap; font-size:12px; margin-top:8px; justify-content:center;">
              <span style="font-size:12px; font-weight:700; color:#5687AD; margin-right:4px; align-self:center;">Lots:</span>
              <button class="btn btn-outline home-lot-pill active" onclick="window.updateHomeWaferDisplay('LOT-SYN-043')" id="lot-pill-043" style="padding:3px 8px; font-size:12px; font-family:var(--font-mono); font-weight:700; background:#FFFFFF; border:1px solid #1976B8; color:#1976B8;">W43</button>
              <button class="btn btn-outline home-lot-pill" onclick="window.updateHomeWaferDisplay('LOT-SYN-044')" id="lot-pill-044" style="padding:3px 8px; font-size:12px; font-family:var(--font-mono); font-weight:600; background:#FFFFFF; border:1px solid #C5DEF0; color:#2B618E;">W44</button>
              <button class="btn btn-outline home-lot-pill" onclick="window.updateHomeWaferDisplay('LOT-SYN-045')" id="lot-pill-045" style="padding:3px 8px; font-size:12px; font-family:var(--font-mono); font-weight:600; background:#FFFFFF; border:1px solid #C5DEF0; color:#2B618E;">W45</button>
              <button class="btn btn-outline home-lot-pill" onclick="window.updateHomeWaferDisplay('LOT-SYN-046')" id="lot-pill-046" style="padding:3px 8px; font-size:12px; font-family:var(--font-mono); font-weight:600; background:#FFFFFF; border:1px solid #C5DEF0; color:#2B618E;">W46</button>
              <button class="btn btn-outline home-lot-pill" onclick="window.updateHomeWaferDisplay('LOT-SYN-047')" id="lot-pill-047" style="padding:3px 8px; font-size:12px; font-family:var(--font-mono); font-weight:600; background:#FFFFFF; border:1px solid #C5DEF0; color:#2B618E;">W47</button>
              <button class="btn btn-outline home-lot-pill" onclick="window.updateHomeWaferDisplay('LOT-SYN-048')" id="lot-pill-048" style="padding:3px 8px; font-size:12px; font-family:var(--font-mono); font-weight:600; background:#FFFFFF; border:1px solid #C5DEF0; color:#2B618E;">W48</button>
              <button class="btn btn-outline home-lot-pill" onclick="window.updateHomeWaferDisplay('LOT-SYN-049')" id="lot-pill-049" style="padding:3px 8px; font-size:12px; font-family:var(--font-mono); font-weight:600; background:#FFFFFF; border:1px solid #C5DEF0; color:#2B618E;">W49</button>
              <button class="btn btn-outline home-lot-pill" onclick="window.updateHomeWaferDisplay('LOT-SYN-050')" id="lot-pill-050" style="padding:3px 8px; font-size:12px; font-family:var(--font-mono); font-weight:600; background:#FFFFFF; border:1px solid #C5DEF0; color:#2B618E;">W50</button>
            </div>
          </div>

          <!-- Right: Recent Qualification Activity Table (9 Balanced Rows) -->
          <div class="card" style="background:#FFFFFF; border:1px solid #C5DEF0; padding:20px 22px; border-radius:8px; box-shadow:var(--shadow-sm); display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <div>
                  <div class="technical-overline" style="font-size:12px; font-weight:700; color:#1976B8; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:2px;">QUALIFICATION FEED</div>
                  <h3 style="font-family:var(--font-display); font-size:16px; font-weight:700; color:#144A75; margin:0;">Recent Qualification Activity</h3>
                  <p style="font-size:12.5px; color:#5687AD; margin:2px 0 0 0;">Latest evaluated components across all active lots</p>
                </div>
                <button class="btn btn-sm btn-outline" onclick="window.switchPage('page-screening')" style="font-size:12px; font-weight:600; padding:4px 12px;">Go to Screening →</button>
              </div>
              <div class="table-container"><table class="table-compact" style="width:100%; font-size:12px; border-collapse:collapse;">
                <thead>
                  <tr style="border-bottom:1px solid #D8EAF6; text-align:left; color:#5687AD;">
                    <th style="padding:6px 8px;">Die UID</th>
                    <th style="padding:6px 8px;">Lot ID</th>
                    <th style="padding:6px 8px;">Risk Score</th>
                    <th style="padding:6px 8px;">Disposition</th>
                    <th style="padding:6px 8px; text-align:right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom:1px solid #F0F6FC;">
                    <td style="padding:6px 8px; font-weight:700; color:#144A75;">DIE-R20C20</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono); color:#2B618E;">LOT-SYN-044</td>
                    <td style="padding:6px 8px; font-weight:700; color: #991B1B;">94.1%</td>
                    <td style="padding:6px 8px;"><span class="badge reject" style="font-size:11.5px;">REJECT</span></td>
                    <td style="padding:6px 8px; text-align:right;"><button class="btn btn-sm btn-outline" onclick="window.openReliabilityPassport('DIE-R20C20')" style="font-size:11px; padding:2px 7px;">Passport</button></td>
                  </tr>
                  <tr style="border-bottom:1px solid #F0F6FC;">
                    <td style="padding:6px 8px; font-weight:700; color:#144A75;">DIE-R45C15</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono); color:#2B618E;">LOT-SYN-046</td>
                    <td style="padding:6px 8px; font-weight:700; color: #991B1B;">99.5%</td>
                    <td style="padding:6px 8px;"><span class="badge reject" style="font-size:11.5px;">REJECT</span></td>
                    <td style="padding:6px 8px; text-align:right;"><button class="btn btn-sm btn-outline" onclick="window.openReliabilityPassport('DIE-R45C15')" style="font-size:11px; padding:2px 7px;">Passport</button></td>
                  </tr>
                  <tr style="border-bottom:1px solid #F0F6FC;">
                    <td style="padding:6px 8px; font-weight:700; color:#144A75;">DIE-R12C28</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono); color:#2B618E;">LOT-SYN-046</td>
                    <td style="padding:6px 8px; font-weight:700; color: #92400E;">31.2%</td>
                    <td style="padding:6px 8px;"><span class="badge warning" style="font-size:11.5px;">MONITOR</span></td>
                    <td style="padding:6px 8px; text-align:right;"><button class="btn btn-sm btn-outline" onclick="window.openReliabilityPassport('DIE-R12C28')" style="font-size:11px; padding:2px 7px;">Passport</button></td>
                  </tr>
                  <tr style="border-bottom:1px solid #F0F6FC;">
                    <td style="padding:6px 8px; font-weight:700; color:#144A75;">DIE-R15C15</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono); color:#2B618E;">LOT-SYN-043</td>
                    <td style="padding:6px 8px; font-weight:700; color: #92400E;">18.4%</td>
                    <td style="padding:6px 8px;"><span class="badge warning" style="font-size:11.5px;">MONITOR</span></td>
                    <td style="padding:6px 8px; text-align:right;"><button class="btn btn-sm btn-outline" onclick="window.openReliabilityPassport('DIE-R15C15')" style="font-size:11px; padding:2px 7px;">Passport</button></td>
                  </tr>
                  <tr style="border-bottom:1px solid #F0F6FC;">
                    <td style="padding:6px 8px; font-weight:700; color:#144A75;">DIE-R05C05</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono); color:#2B618E;">LOT-SYN-043</td>
                    <td style="padding:6px 8px; font-weight:700; color: #92400E;">16.2%</td>
                    <td style="padding:6px 8px;"><span class="badge warning" style="font-size:11.5px;">MONITOR</span></td>
                    <td style="padding:6px 8px; text-align:right;"><button class="btn btn-sm btn-outline" onclick="window.openReliabilityPassport('DIE-R05C05')" style="font-size:11px; padding:2px 7px;">Passport</button></td>
                  </tr>
                  <tr style="border-bottom:1px solid #F0F6FC;">
                    <td style="padding:6px 8px; font-weight:700; color:#144A75;">DIE-R16C04</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono); color:#2B618E;">LOT-SYN-049</td>
                    <td style="padding:6px 8px; font-weight:700; color: #92400E;">18.9%</td>
                    <td style="padding:6px 8px;"><span class="badge warning" style="font-size:11.5px;">MONITOR</span></td>
                    <td style="padding:6px 8px; text-align:right;"><button class="btn btn-sm btn-outline" onclick="window.openReliabilityPassport('DIE-R16C04')" style="font-size:11px; padding:2px 7px;">Passport</button></td>
                  </tr>
                  <tr style="border-bottom:1px solid #F0F6FC;">
                    <td style="padding:6px 8px; font-weight:700; color:#144A75;">DIE-R00C00</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono); color:#2B618E;">LOT-SYN-043</td>
                    <td style="padding:6px 8px; font-weight:700; color: #166534;">2.1%</td>
                    <td style="padding:6px 8px;"><span class="badge pass" style="font-size:11.5px;">PASS</span></td>
                    <td style="padding:6px 8px; text-align:right;"><button class="btn btn-sm btn-outline" onclick="window.openReliabilityPassport('DIE-R00C00')" style="font-size:11px; padding:2px 7px;">Passport</button></td>
                  </tr>
                  <tr style="border-bottom:1px solid #F0F6FC;">
                    <td style="padding:6px 8px; font-weight:700; color:#144A75;">DIE-R25C10</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono); color:#2B618E;">LOT-SYN-044</td>
                    <td style="padding:6px 8px; font-weight:700; color: #166534;">1.8%</td>
                    <td style="padding:6px 8px;"><span class="badge pass" style="font-size:11.5px;">PASS</span></td>
                    <td style="padding:6px 8px; text-align:right;"><button class="btn btn-sm btn-outline" onclick="window.openReliabilityPassport('DIE-R25C10')" style="font-size:11px; padding:2px 7px;">Passport</button></td>
                  </tr>
                  <tr>
                    <td style="padding:6px 8px; font-weight:700; color:#144A75;">DIE-R30C30</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono); color:#2B618E;">LOT-SYN-045</td>
                    <td style="padding:6px 8px; font-weight:700; color: #166534;">3.4%</td>
                    <td style="padding:6px 8px;"><span class="badge pass" style="font-size:11.5px;">PASS</span></td>
                    <td style="padding:6px 8px; text-align:right;"><button class="btn btn-sm btn-outline" onclick="window.openReliabilityPassport('DIE-R30C30')" style="font-size:11px; padding:2px 7px;">Passport</button></td>
                  </tr>
                </tbody>
              </table></div>
            </div>
          </div>
        </div>\n\n        `;

updatedIndex = updatedIndex.substring(0, section2Start) + newSection2Html + updatedIndex.substring(section2End);
console.log('✔ 2. Home page wafer section and 9-row qualification feed updated cleanly.');

// =========================================================================
// 3. ENGINEERING INVESTIGATION QUEUE TYPOGRAPHY & COMPACT SPACING
// =========================================================================
const queueCardsStart = updatedIndex.indexOf('id="investigation-queue-grid"');
if (queueCardsStart !== -1) {
  const queueCardsHtml = `id="investigation-queue-grid">
            <div class="queue-card critical" data-status="REJECT" onclick="window.openReliabilityPassport('DIE-R20C20')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong class="queue-card-die-id">DIE-R20C20</strong>
                  <span class="queue-card-lot-badge">LOT-SYN-048</span>
                  <span class="queue-card-desc">High Anomaly + Prognostic Limit Exceeded</span>
                </div>
                <span class="badge reject queue-status-badge">REJECT</span>
              </div>
              <div class="queue-card-evidence-row">
                <div><span class="queue-metric-label">P(Failure):</span> <strong class="queue-metric-val" style="color:#991B1B;">99.9%</strong></div>
                <div><span class="queue-metric-label">Anomaly:</span> <strong class="queue-metric-val">0.94</strong></div>
                <div><span class="queue-metric-label">Breach:</span> <strong class="queue-metric-val">48.0h</strong></div>
                <div><span class="queue-metric-label">Evidence:</span> <strong class="queue-metric-val" style="color:#166534;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline queue-action-btn" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R20C20')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
            <div class="queue-card critical" data-status="REJECT" onclick="window.openReliabilityPassport('DIE-R05C12')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong class="queue-card-die-id">DIE-R05C12</strong>
                  <span class="queue-card-lot-badge">LOT-SYN-044</span>
                  <span class="queue-card-desc">Rapid Acceleration • Thermal Runaway</span>
                </div>
                <span class="badge reject queue-status-badge">REJECT</span>
              </div>
              <div class="queue-card-evidence-row">
                <div><span class="queue-metric-label">P(Failure):</span> <strong class="queue-metric-val" style="color:#991B1B;">94.1%</strong></div>
                <div><span class="queue-metric-label">Anomaly:</span> <strong class="queue-metric-val">0.88</strong></div>
                <div><span class="queue-metric-label">Breach:</span> <strong class="queue-metric-val">36.0h</strong></div>
                <div><span class="queue-metric-label">Evidence:</span> <strong class="queue-metric-val" style="color:#166534;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline queue-action-btn" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R05C12')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
            <div class="queue-card critical" data-status="REJECT" onclick="window.openReliabilityPassport('DIE-R45C15')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong class="queue-card-die-id">DIE-R45C15</strong>
                  <span class="queue-card-lot-badge">LOT-SYN-046</span>
                  <span class="queue-card-desc">Severe Gate Leakage • Die Edge Defect</span>
                </div>
                <span class="badge reject queue-status-badge">REJECT</span>
              </div>
              <div class="queue-card-evidence-row">
                <div><span class="queue-metric-label">P(Failure):</span> <strong class="queue-metric-val" style="color:#991B1B;">99.5%</strong></div>
                <div><span class="queue-metric-label">Anomaly:</span> <strong class="queue-metric-val">0.96</strong></div>
                <div><span class="queue-metric-label">Breach:</span> <strong class="queue-metric-val">24.0h</strong></div>
                <div><span class="queue-metric-label">Evidence:</span> <strong class="queue-metric-val" style="color:#166534;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline queue-action-btn" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R45C15')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
            <div class="queue-card critical" data-status="REJECT" onclick="window.openReliabilityPassport('DIE-R12C08')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong class="queue-card-die-id">DIE-R12C08</strong>
                  <span class="queue-card-lot-badge">LOT-SYN-045</span>
                  <span class="queue-card-desc">Prognostic IDDQ Breach at 96h</span>
                </div>
                <span class="badge reject queue-status-badge">REJECT</span>
              </div>
              <div class="queue-card-evidence-row">
                <div><span class="queue-metric-label">P(Failure):</span> <strong class="queue-metric-val" style="color:#991B1B;">88.4%</strong></div>
                <div><span class="queue-metric-label">Anomaly:</span> <strong class="queue-metric-val">0.82</strong></div>
                <div><span class="queue-metric-label">Breach:</span> <strong class="queue-metric-val">96.0h</strong></div>
                <div><span class="queue-metric-label">Evidence:</span> <strong class="queue-metric-val" style="color:#166534;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline queue-action-btn" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R12C08')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
            <div class="queue-card warning" data-status="MONITOR" onclick="window.openReliabilityPassport('DIE-R15C15')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong class="queue-card-die-id">DIE-R15C15</strong>
                  <span class="queue-card-lot-badge">LOT-SYN-043</span>
                  <span class="queue-card-desc">Sub-threshold Drift • Elevated Leakage Rate</span>
                </div>
                <span class="badge warning queue-status-badge">MONITOR</span>
              </div>
              <div class="queue-card-evidence-row">
                <div><span class="queue-metric-label">P(Failure):</span> <strong class="queue-metric-val" style="color:#92400E;">18.4%</strong></div>
                <div><span class="queue-metric-label">Anomaly:</span> <strong class="queue-metric-val">0.42</strong></div>
                <div><span class="queue-metric-label">Breach:</span> <strong class="queue-metric-val">120.0h</strong></div>
                <div><span class="queue-metric-label">Evidence:</span> <strong class="queue-metric-val" style="color:#166534;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline queue-action-btn" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R15C15')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
            <div class="queue-card warning" data-status="MONITOR" onclick="window.openReliabilityPassport('DIE-R02C14')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong class="queue-card-die-id">DIE-R02C14</strong>
                  <span class="queue-card-lot-badge">LOT-SYN-046</span>
                  <span class="queue-card-desc">Spatial Cluster Outlier • Neighbor Anomaly</span>
                </div>
                <span class="badge warning queue-status-badge">MONITOR</span>
              </div>
              <div class="queue-card-evidence-row">
                <div><span class="queue-metric-label">P(Failure):</span> <strong class="queue-metric-val" style="color:#92400E;">19.8%</strong></div>
                <div><span class="queue-metric-label">Anomaly:</span> <strong class="queue-metric-val">0.48</strong></div>
                <div><span class="queue-metric-label">Breach:</span> <strong class="queue-metric-val">144.0h</strong></div>
                <div><span class="queue-metric-label">Evidence:</span> <strong class="queue-metric-val" style="color:#166534;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline queue-action-btn" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R02C14')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
            <div class="queue-card warning" data-status="MONITOR" onclick="window.openReliabilityPassport('DIE-R08C08')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong class="queue-card-die-id">DIE-R08C08</strong>
                  <span class="queue-card-lot-badge">LOT-SYN-047</span>
                  <span class="queue-card-desc">Timing Degradation Margin Narrowing</span>
                </div>
                <span class="badge warning queue-status-badge">MONITOR</span>
              </div>
              <div class="queue-card-evidence-row">
                <div><span class="queue-metric-label">P(Failure):</span> <strong class="queue-metric-val" style="color:#92400E;">15.1%</strong></div>
                <div><span class="queue-metric-label">Anomaly:</span> <strong class="queue-metric-val">0.36</strong></div>
                <div><span class="queue-metric-label">Breach:</span> <strong class="queue-metric-val">&gt;168h</strong></div>
                <div><span class="queue-metric-label">Evidence:</span> <strong class="queue-metric-val" style="color:#166534;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline queue-action-btn" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R08C08')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
            <div class="queue-card warning" data-status="MONITOR" onclick="window.openReliabilityPassport('DIE-R12C28')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong class="queue-card-die-id">DIE-R12C28</strong>
                  <span class="queue-card-lot-badge">LOT-SYN-045</span>
                  <span class="queue-card-desc">Borderline PAT-MAD • Marginal Drift</span>
                </div>
                <span class="badge warning queue-status-badge">MONITOR</span>
              </div>
              <div class="queue-card-evidence-row">
                <div><span class="queue-metric-label">P(Failure):</span> <strong class="queue-metric-val" style="color:#92400E;">24.5%</strong></div>
                <div><span class="queue-metric-label">Anomaly:</span> <strong class="queue-metric-val">0.52</strong></div>
                <div><span class="queue-metric-label">Breach:</span> <strong class="queue-metric-val">108.0h</strong></div>
                <div><span class="queue-metric-label">Evidence:</span> <strong class="queue-metric-val" style="color:#166534;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline queue-action-btn" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R12C28')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
            <div class="queue-card warning" data-status="MONITOR" onclick="window.openReliabilityPassport('DIE-R05C05')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong class="queue-card-die-id">DIE-R05C05</strong>
                  <span class="queue-card-lot-badge">LOT-SYN-043</span>
                  <span class="queue-card-desc">PAT-MAD Elevated Z-Score</span>
                </div>
                <span class="badge warning queue-status-badge">MONITOR</span>
              </div>
              <div class="queue-card-evidence-row">
                <div><span class="queue-metric-label">P(Failure):</span> <strong class="queue-metric-val" style="color:#92400E;">16.2%</strong></div>
                <div><span class="queue-metric-label">Anomaly:</span> <strong class="queue-metric-val">0.38</strong></div>
                <div><span class="queue-metric-label">Breach:</span> <strong class="queue-metric-val">&gt;168h</strong></div>
                <div><span class="queue-metric-label">Evidence:</span> <strong class="queue-metric-val" style="color:#166534;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline queue-action-btn" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R05C05')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
            <div class="queue-card warning" data-status="MONITOR" onclick="window.openReliabilityPassport('DIE-R16C04')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong class="queue-card-die-id">DIE-R16C04</strong>
                  <span class="queue-card-lot-badge">LOT-SYN-049</span>
                  <span class="queue-card-desc">Voltage Headroom Sensor Drift</span>
                </div>
                <span class="badge warning queue-status-badge">MONITOR</span>
              </div>
              <div class="queue-card-evidence-row">
                <div><span class="queue-metric-label">P(Failure):</span> <strong class="queue-metric-val" style="color:#92400E;">18.9%</strong></div>
                <div><span class="queue-metric-label">Anomaly:</span> <strong class="queue-metric-val">0.45</strong></div>
                <div><span class="queue-metric-label">Breach:</span> <strong class="queue-metric-val">156.0h</strong></div>
                <div><span class="queue-metric-label">Evidence:</span> <strong class="queue-metric-val" style="color:#166534;">100%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline queue-action-btn" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R16C04')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
            <div class="queue-card" data-status="INSUFFICIENT" onclick="window.openReliabilityPassport('DIE-R09C11')">
              <div class="queue-card-header">
                <div class="queue-card-meta">
                  <strong class="queue-card-die-id">DIE-R09C11</strong>
                  <span class="queue-card-lot-badge">LOT-SYN-050</span>
                  <span class="queue-card-desc">Sensor Telemetry Dropout at 24h</span>
                </div>
                <span class="badge queue-status-badge" style="background:#F1F5F9; color:#475569; border:1px solid #CBD5E1;">INSUFFICIENT</span>
              </div>
              <div class="queue-card-evidence-row">
                <div><span class="queue-metric-label">P(Failure):</span> <strong class="queue-metric-val" style="color:#64748B;">N/A</strong></div>
                <div><span class="queue-metric-label">Anomaly:</span> <strong class="queue-metric-val">0.00</strong></div>
                <div><span class="queue-metric-label">Breach:</span> <strong class="queue-metric-val">N/A</strong></div>
                <div><span class="queue-metric-label">Evidence:</span> <strong class="queue-metric-val" style="color:#92400E;">20%</strong></div>
                <div style="text-align:right;">
                  <button class="btn btn-sm btn-outline queue-action-btn" onclick="event.stopPropagation(); window.openReliabilityPassport('DIE-R09C11')">⚡ Investigate Passport</button>
                </div>
              </div>
            </div>
          </div>`;

  const endPos = updatedIndex.indexOf('<!-- 256-Row Comprehensive Population Ledger Table -->', queueCardsStart);
  if (endPos !== -1) {
    const closingDivPos = updatedIndex.lastIndexOf('</div>', endPos);
    const beforeClosing = updatedIndex.lastIndexOf('</div>', closingDivPos - 1);
    updatedIndex = updatedIndex.substring(0, queueCardsStart) + queueCardsHtml + updatedIndex.substring(beforeClosing + 6);
    console.log('✔ 3. Queue cards HTML updated with semantic classes.');
  }
}

// Write updated index.html & frontend/index.html
fs.writeFileSync('index.html', updatedIndex, 'utf8');
fs.writeFileSync('frontend/index.html', updatedIndex, 'utf8');
console.log('✔ index.html & frontend/index.html written successfully.');

// =========================================================================
// 4. UPDATE style.css FOR QUEUE TYPOGRAPHY & COMPACT DENSE SPACING
// =========================================================================
let css = fs.readFileSync('style.css', 'utf8');

const queueCssStart = css.indexOf('.queue-summary-banner');
const queueCssEnd = css.indexOf('/* ─── LATENT ESCAPE SPOTLIGHT ─── */', queueCssStart);

if (queueCssStart !== -1 && queueCssEnd !== -1) {
  const newQueueCss = `.queue-summary-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 8px;
}

.queue-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.queue-card {
  background: #FFFFFF;
  border: 1px solid #D8E5EF;
  border-radius: 6px;
  padding: 10px 14px;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
}

.queue-card:hover {
  border-color: #1976B8;
  background: #FDFEFE;
  box-shadow: 0 2px 6px rgba(18, 59, 99, 0.05);
}

.queue-card.critical {
  border-left: 4px solid #991B1B;
}

.queue-card.warning {
  border-left: 4px solid #92400E;
}

.queue-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.queue-card-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.queue-card-die-id {
  font-size: 15px;
  font-weight: 800;
  font-family: var(--font-mono);
  color: #123B63;
}

.queue-card-lot-badge {
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: #1E293B;
  background: #EAF4FB;
  border: 1px solid #BAE6FD;
  padding: 2px 8px;
  border-radius: 4px;
}

.queue-card-desc {
  font-size: 13.5px;
  color: #334155;
  font-weight: 600;
}

.queue-status-badge {
  font-size: 13px;
  font-weight: 800;
  padding: 3px 10px;
}

.queue-card-evidence-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr) auto;
  gap: 10px;
  align-items: center;
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13.5px;
}

.queue-metric-label {
  color: #64748B;
  font-size: 13px;
  font-weight: 600;
  margin-right: 4px;
}

.queue-metric-val {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 700;
  color: #123B63;
}

.queue-action-btn {
  font-size: 13px;
  font-weight: 700;
  padding: 4px 12px;
}

@media (max-width: 1024px) {
  .queue-card-evidence-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .queue-card-evidence-row {
    grid-template-columns: 1fr;
  }
}

`;

  css = css.substring(0, queueCssStart) + newQueueCss + css.substring(queueCssEnd);
  fs.writeFileSync('style.css', css, 'utf8');
  fs.writeFileSync('frontend/style.css', css, 'utf8');
  console.log('✔ 4. style.css & frontend/style.css updated for Investigation Queue typography and tight spacing.');
}

console.log('=== ALL TARGETED CHANGES APPLIED SUCCESSFULLY ===');
