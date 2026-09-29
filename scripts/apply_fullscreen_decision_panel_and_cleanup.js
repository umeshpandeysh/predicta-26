const fs = require('fs');
const path = require('path');

console.log('=== PREDICTA REFINEMENT SCRIPT START ===');

// 1. UPDATE style.css and frontend/style.css
let styleCss = fs.readFileSync('style.css', 'utf8');

// Update max-widths to 1560px
styleCss = styleCss.replace(/max-width:\s*1400px;/g, 'max-width: 1560px;');
// Update topnav container padding
styleCss = styleCss.replace(/padding:\s*0\s+24px;/g, 'padding: 0 32px;');
// Update main-content padding
styleCss = styleCss.replace(/padding:\s*84px\s+20px\s+40px\s+20px;/g, 'padding: 84px 32px 48px 32px;');

// Ensure responsive rules for decision-command-panel and 5-channel grid
const customCssAdditions = `
/* Governed Qualification Decision Panel Workspace Refinement */
.decision-command-panel {
  background: #FFFFFF;
  border: 1px solid var(--border-tech);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(20, 74, 117, 0.06);
}

@media (max-width: 900px) {
  .decision-action-policy-grid {
    grid-template-columns: 1fr !important;
  }
  .decision-evidence-strip {
    grid-template-columns: repeat(2, 1fr) !important;
  }
  #adm-in-res-key-evidence {
    grid-template-columns: 1fr !important;
  }
}
@media (max-width: 600px) {
  .decision-evidence-strip {
    grid-template-columns: 1fr !important;
  }
}
`;

if (!styleCss.includes('decision-action-policy-grid')) {
  styleCss += '\n' + customCssAdditions;
}

fs.writeFileSync('style.css', styleCss, 'utf8');
fs.writeFileSync('frontend/style.css', styleCss, 'utf8');
console.log('✔ Updated style.css and frontend/style.css');

// 2. UPDATE index.html and frontend/index.html
let indexHtml = fs.readFileSync('index.html', 'utf8');

// A. Navbar Order: Home -> Screening -> Components -> Live Monitor -> Advanced
const navOldRegex = /<nav class="topnav-menu" id="topnav-menu">[\s\S]*?<\/nav>/;
const navNew = `<nav class="topnav-menu" id="topnav-menu">
          <button class="nav-link active" data-page="page-home" onclick="window.switchPage('page-home')">Home</button>
          <button class="nav-link" data-page="page-screening" onclick="window.switchPage('page-screening')">Screening</button>
          <button class="nav-link" data-page="page-components" onclick="window.switchPage('page-components')">Components</button>
          <button class="nav-link" data-page="page-monitor" onclick="window.switchPage('page-monitor')">Live Monitor</button>
          <button class="nav-link" data-page="page-advanced" onclick="window.switchPage('page-advanced')">Advanced</button>
        </nav>`;

if (navOldRegex.test(indexHtml)) {
  indexHtml = indexHtml.replace(navOldRegex, navNew);
  console.log('✔ Reordered topnav in index.html');
} else {
  console.error('❌ Could not find nav in index.html');
}

// B. Main container scale
indexHtml = indexHtml.replace('max-width:1400px; margin:0 auto; padding:84px 20px 40px 20px;', 'max-width:1560px; margin:0 auto; padding:84px 32px 48px 32px;');

// C. Decision Command Panel Workspace Redesign
const decisionPanelRegex = /<!-- SECTION 03 — GOVERNED QUALIFICATION DECISION \(DECISION COMMAND PANEL\) -->[\s\S]*?<!-- Hidden elements for test harness compatibility -->/;

const newDecisionPanelHtml = `<!-- SECTION 03 — GOVERNED QUALIFICATION DECISION (DECISION COMMAND PANEL) -->
              <div class="card decision-command-panel" id="adm-decision-command-panel" style="background:#FFFFFF; border:1px solid #C5DEF0; border-radius:8px; padding:24px 26px; margin-bottom:24px; box-shadow:0 2px 8px rgba(20,74,117,0.06);">
                
                <!-- 1. Header Workspace Bar: Overline, Component Identity & Authoritative Decision Badge -->
                <div class="decision-header-row" style="display:flex; justify-content:space-between; align-items:flex-start; gap:24px; flex-wrap:wrap; margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid #E2EFF9;">
                  
                  <!-- Left: Component Identity & Qualification Scope -->
                  <div style="flex:1; min-width:280px;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                      <span class="technical-overline" style="font-size:11px; font-weight:700; color:#1976B8; text-transform:uppercase; letter-spacing:1.2px;">
                        GOVERNED QUALIFICATION DECISION
                      </span>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:10px;">
                      <span id="adm-in-res-comp" style="font-size:26px; font-weight:800; color:#144A75; font-family:var(--font-mono); letter-spacing:-0.5px;">DIE-R15C15</span>
                      <span id="adm-in-res-lot" style="font-size:12.5px; font-weight:700; color:#144A75; background:#E8F2FA; border:1px solid #C5DEF0; padding:3px 12px; border-radius:4px; font-family:var(--font-mono);">LOT-SYN-043</span>
                      <!-- Retain #adm-in-res-id for test harness compatibility -->
                      <span id="adm-in-res-id" style="display:none;">DIE-R15C15 (LOT-SYN-043)</span>
                    </div>

                    <!-- Scope Context Tags -->
                    <div class="decision-context-line" style="display:flex; align-items:center; gap:8px; font-size:11.5px; color:#5687AD; flex-wrap:wrap;">
                      <span style="background:#F0F6FC; border:1px solid #D8EAF6; padding:3px 9px; border-radius:4px; font-weight:600; color:#2B618E;">
                        <span style="font-weight:700; color:#144A75;">24h</span> Decision Point
                      </span>
                      <span style="background:#F0F6FC; border:1px solid #D8EAF6; padding:3px 9px; border-radius:4px; font-weight:600; color:#2B618E;">
                        <span style="font-weight:700; color:#144A75;">168h</span> Forecast Horizon
                      </span>
                      <span style="background:#F0F6FC; border:1px solid #D8EAF6; padding:3px 9px; border-radius:4px; font-weight:600; color:#2B618E;">
                        Fail-Closed (<span style="font-weight:700; color:#144A75;">θ* = 0.20</span>)
                      </span>
                      <span class="badge" style="font-size:10px; font-weight:700; background:#F0F6FC; color:#5687AD; border:1px solid #D8EAF6; padding:3px 9px;">
                        SYNTHETIC SCENARIO
                      </span>
                    </div>
                  </div>

                  <!-- Right: Prominent Decision Status Block -->
                  <div class="decision-status-block" style="text-align:right; flex-shrink:0;">
                    <div id="adm-in-res-badge" class="badge pass" style="font-size:20px; font-weight:800; padding:10px 32px; letter-spacing:1.2px; border-radius:6px; display:inline-block; min-width:160px; text-align:center; background:#F0FDF4; color:#15803D; border:1px solid #BBF7D0; box-shadow:0 1px 3px rgba(21,128,61,0.1);">
                      PASS
                    </div>
                    <div id="adm-in-res-subbadge" style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#5687AD; margin-top:6px;">
                      GOVERNED DISPOSITION
                    </div>
                  </div>

                </div>

                <!-- 2. Decision Basis & Telemetry Synthesis Workspace -->
                <div class="decision-basis-container" style="background:#F0F6FC; border:1px solid #C5DEF0; border-radius:6px; padding:16px 18px; margin-bottom:18px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div style="font-size:10.5px; font-weight:700; color:#5687AD; text-transform:uppercase; letter-spacing:0.8px;">
                      DECISION BASIS &amp; TELEMETRY SYNTHESIS
                    </div>
                  </div>
                  <div id="adm-in-res-summary" style="font-size:14px; color:#144A75; font-weight:600; line-height:1.55; margin-bottom:12px;">
                    Low predicted failure risk. All reliability evidence nominal across independent channels.
                  </div>
                  
                  <!-- Key Technical Evidence Highlight Cards -->
                  <div id="adm-in-res-key-evidence" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; font-size:12px;">
                    <div style="background:#FFFFFF; border:1px solid #C5DEF0; padding:8px 12px; border-radius:5px;">
                      <div style="font-size:10px; font-weight:700; color:#5687AD; text-transform:uppercase; margin-bottom:2px;">Primary Signal</div>
                      <strong id="adm-in-res-primary-signal" style="color:#144A75; font-family:var(--font-mono); font-size:13px;">Z = 0.42 (PAT-MAD)</strong>
                    </div>
                    <div style="background:#FFFFFF; border:1px solid #C5DEF0; padding:8px 12px; border-radius:5px;">
                      <div style="font-size:10px; font-weight:700; color:#5687AD; text-transform:uppercase; margin-bottom:2px;">Latent Failure Risk</div>
                      <strong id="adm-in-res-risk-val" style="color:#144A75; font-family:var(--font-mono); font-size:13px;">P = 8.2%</strong>
                    </div>
                    <div style="background:#FFFFFF; border:1px solid #C5DEF0; padding:8px 12px; border-radius:5px;">
                      <div style="font-size:10px; font-weight:700; color:#5687AD; text-transform:uppercase; margin-bottom:2px;">168h GPR Forecast</div>
                      <strong id="adm-in-res-gpr-val" style="color:#144A75; font-family:var(--font-mono); font-size:13px;">12.6 µA</strong>
                    </div>
                  </div>
                </div>

                <!-- 3. Operational Action & Governing Policy Twin Modules -->
                <div class="decision-action-policy-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:18px;">
                  
                  <!-- Left Module: Operational Action -->
                  <div style="background:#FFFFFF; border:1px solid #C5DEF0; border-radius:6px; padding:14px 18px; border-left:4px solid #1E78B8;">
                    <div style="font-size:10px; font-weight:700; color:#5687AD; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:4px;">
                      OPERATIONAL RECOMMENDATION
                    </div>
                    <div id="adm-in-res-action-text" style="font-size:14.5px; font-weight:800; color:#1E78B8; letter-spacing:0.4px;">
                      PROCEED STANDARD SCREENING
                    </div>
                    <div id="adm-in-res-action-sub" style="font-size:12px; color:#5687AD; margin-top:4px; line-height:1.4;">
                      Authorizes component for standard manufacturing screening &amp; 168h baseline.
                    </div>
                  </div>

                  <!-- Right Module: Governing Policy -->
                  <div style="background:#FFFFFF; border:1px solid #C5DEF0; border-radius:6px; padding:14px 18px; border-left:4px solid #5687AD;">
                    <div style="font-size:10px; font-weight:700; color:#5687AD; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:4px;">
                      GOVERNING POLICY &amp; SAFETY GATE
                    </div>
                    <div id="adm-in-res-policy-text" style="font-size:13.5px; font-weight:800; color:#144A75; font-family:var(--font-mono);">
                      FAIL-CLOSED DISPOSITION (θ* = 0.20)
                    </div>
                    <div id="adm-in-res-policy-sub" style="font-size:12px; color:#5687AD; margin-top:4px; line-height:1.4;">
                      Threshold: θ*=0.20 | ISO 26262 / AEC-Q100 Fail-Closed Rule
                    </div>
                  </div>

                </div>

                <!-- 4. Multi-Channel Evidence State Workspace (5-Column Structured Grid) -->
                <div style="background:#F0F6FC; border:1px solid #C5DEF0; border-radius:6px; padding:14px 16px;">
                  <div style="font-size:10px; font-weight:700; color:#5687AD; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:10px;">
                    MULTI-CHANNEL EVIDENCE STATE
                  </div>
                  <div class="decision-evidence-strip" style="display:grid; grid-template-columns:repeat(5, 1fr); gap:10px; font-size:11.5px;">
                    <div style="background:#FFFFFF; border:1px solid #C5DEF0; border-radius:5px; padding:8px 10px; display:flex; flex-direction:column; gap:4px;">
                      <div style="color:#5687AD; font-size:10px; font-weight:600; text-transform:uppercase;">Population</div>
                      <div style="display:flex; align-items:center; gap:6px;">
                        <span id="strip-pop-dot" style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#15803D;"></span>
                        <strong id="strip-pop-status" style="font-size:11px; color:#144A75;">NOMINAL</strong>
                      </div>
                    </div>

                    <div style="background:#FFFFFF; border:1px solid #C5DEF0; border-radius:5px; padding:8px 10px; display:flex; flex-direction:column; gap:4px;">
                      <div style="color:#5687AD; font-size:10px; font-weight:600; text-transform:uppercase;">Temporal</div>
                      <div style="display:flex; align-items:center; gap:6px;">
                        <span id="strip-temp-dot" style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#15803D;"></span>
                        <strong id="strip-temp-status" style="font-size:11px; color:#144A75;">STABLE</strong>
                      </div>
                    </div>

                    <div style="background:#FFFFFF; border:1px solid #C5DEF0; border-radius:5px; padding:8px 10px; display:flex; flex-direction:column; gap:4px;">
                      <div style="color:#5687AD; font-size:10px; font-weight:600; text-transform:uppercase;">Forecast</div>
                      <div style="display:flex; align-items:center; gap:6px;">
                        <span id="strip-fc-dot" style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#15803D;"></span>
                        <strong id="strip-fc-status" style="font-size:11px; color:#144A75;">WITHIN LIMIT</strong>
                      </div>
                    </div>

                    <div style="background:#FFFFFF; border:1px solid #C5DEF0; border-radius:5px; padding:8px 10px; display:flex; flex-direction:column; gap:4px;">
                      <div style="color:#5687AD; font-size:10px; font-weight:600; text-transform:uppercase;">Latent Risk</div>
                      <div style="display:flex; align-items:center; gap:6px;">
                        <span id="strip-risk-dot" style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#15803D;"></span>
                        <strong id="strip-risk-status" style="font-size:11px; color:#144A75;">LOW RISK</strong>
                      </div>
                    </div>

                    <div style="background:#FFFFFF; border:1px solid #C5DEF0; border-radius:5px; padding:8px 10px; display:flex; flex-direction:column; gap:4px;">
                      <div style="color:#5687AD; font-size:10px; font-weight:600; text-transform:uppercase;">Physics</div>
                      <div style="display:flex; align-items:center; gap:6px;">
                        <span id="strip-phys-dot" style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#15803D;"></span>
                        <strong id="strip-phys-status" style="font-size:11px; color:#144A75;">VALIDATED</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Hidden elements for test harness compatibility -->`;

if (decisionPanelRegex.test(indexHtml)) {
  indexHtml = indexHtml.replace(decisionPanelRegex, newDecisionPanelHtml);
  console.log('✔ Replaced Decision Command Panel in index.html');
} else {
  console.error('❌ Could not match decision panel in index.html');
}

// D. Remove all occurrences of "BENCHMARK" in index.html
const benchmarkReplacements = [
  { from: 'Synthetic Benchmark Scenario (Fail-Closed)', to: 'Synthetic Qualification Scenario (Fail-Closed)' },
  { from: 'Active Wafer Spatial Health (8 Benchmark Lots)', to: 'Active Wafer Spatial Health (8 Qualification Lots)' },
  { from: 'SYNTHETIC BENCHMARK SCENARIO', to: 'SYNTHETIC QUALIFICATION SCENARIO' },
  { from: 'Benchmark Datasets', to: 'Qualification Datasets' },
  { from: '⚡ Load Benchmark Lot 048', to: '⚡ Load Synthetic Lot 048' },
  { from: 'SYNTHETIC BENCHMARK', to: 'SYNTHETIC SCENARIO' },
  { from: 'BENCHMARK FORECAST VALIDATION', to: 'QUALIFICATION FORECAST VALIDATION' },
  { from: 'STATUS: BENCHMARK_VALIDATED (168h Ground Truth)', to: 'STATUS: VALIDATED (168h Ground Truth)' },
  { from: 'against synthetic benchmark ground truth dataset. This benchmark evaluation does NOT constitute production calibration or external fab validation. Calibration: <code style="font-family:var(--font-mono); color:#0369A1;">NOT_CALIBRATED (BENCHMARK)</code>.', to: 'against synthetic ground truth dataset. This qualification evaluation does NOT constitute production calibration or external fab validation. Calibration: <code style="font-family:var(--font-mono); color:#0369A1;">NOT_CALIBRATED (SYNTHETIC_SCENARIO)</code>.' },
  { from: '● BENCHMARK_FROZEN', to: '● QUALIFICATION_FROZEN' },
  { from: 'Benchmark Log-Odds', to: 'Reference Log-Odds' },
  { from: 'Benchmark Validation: Predicted vs. Observed (Synthetic Evaluation Set)', to: 'Validation: Predicted vs. Observed (Synthetic Evaluation Set)' },
  { from: 'Observed Benchmark (µA)', to: 'Observed Value (µA)' },
  { from: 'Prognostic curves are synthetic benchmark indicators', to: 'Prognostic curves are synthetic validation indicators' },
  { from: 'Benchmark Log-Odds (Locked)', to: 'Reference Log-Odds (Locked)' },
  { from: 'Validated benchmark results, ablations and decision evidence', to: 'Validated qualification results, ablations and decision evidence' },
  { from: 'AUTHORITATIVE BENCHMARK', to: 'AUTHORITATIVE EVALUATION' },
  { from: 'Top Benchmark Accuracy & Operational Metrics', to: 'Top Accuracy & Operational Metrics' },
  { from: 'Validated Internal Benchmark (Zero Test Leakage)', to: 'Validated Internal Qualification (Zero Test Leakage)' },
  { from: 'Telemetry not recorded at 48h in benchmark dataset', to: 'Telemetry not recorded at 48h in synthetic dataset' },
  { from: 'Telemetry not recorded at 120h/144h in benchmark dataset', to: 'Telemetry not recorded at 120h/144h in synthetic dataset' }
];

benchmarkReplacements.forEach(({ from, to }) => {
  if (indexHtml.includes(from)) {
    indexHtml = indexHtml.split(from).join(to);
    console.log(`✔ Replaced "${from}" -> "${to}" in index.html`);
  }
});

// Any remaining "benchmark" in HTML comments or text
indexHtml = indexHtml.replace(/<!-- Benchmark/g, '<!-- Qualification');

fs.writeFileSync('index.html', indexHtml, 'utf8');
fs.writeFileSync('frontend/index.html', indexHtml, 'utf8');
console.log('✔ Updated index.html and frontend/index.html');

// 3. UPDATE script.js and frontend/script.js
let scriptJs = fs.readFileSync('script.js', 'utf8');

// Replace visible benchmark strings in script.js
scriptJs = scriptJs.replace(/if \(statusProv\) statusProv\.textContent = "SYNTHETIC BENCHMARK";/g, 'if (statusProv) statusProv.textContent = "SYNTHETIC SCENARIO";');
scriptJs = scriptJs.replace(/loaded from benchmark /g, 'loaded from synthetic ');
scriptJs = scriptJs.replace(/synthetic benchmark protocol/g, 'synthetic qualification protocol');

// Also update decision badge styling in script.js to match light blue system
scriptJs = scriptJs.replace(
  /resBadge\.style\.background = isReject \? "#FDE7E8" : \(isMonitor \? "#FFFBEB" : "#D1FAE5"\);/g,
  'resBadge.style.background = isReject ? "#FEF2F2" : (isMonitor ? "#FFFBEB" : "#F0FDF4");'
);
scriptJs = scriptJs.replace(
  /resBadge\.style\.color = isReject \? "#991B1B" : \(isMonitor \? "#92400E" : "#166534"\);/g,
  'resBadge.style.color = isReject ? "#991B1B" : (isMonitor ? "#92400E" : "#15803D");'
);
scriptJs = scriptJs.replace(
  /resBadge\.style\.border = isReject \? "1px solid #FECACA" : \(isMonitor \? "1px solid #FDE68A" : "1px solid #A7F3D0"\);/g,
  'resBadge.style.border = isReject ? "1px solid #FECACA" : (isMonitor ? "1px solid #FDE68A" : "1px solid #BBF7D0");'
);

// Dot colors in script.js
scriptJs = scriptJs.replace(/statPop\.style\.color = isReject \? "#991B1B" : \(isMonitor \? "#92400E" : "#102F4F"\);/g, 'statPop.style.color = isReject ? "#991B1B" : (isMonitor ? "#92400E" : "#144A75");');
scriptJs = scriptJs.replace(/statTemp\.style\.color = isReject \? "#991B1B" : \(isMonitor \? "#92400E" : "#102F4F"\);/g, 'statTemp.style.color = isReject ? "#991B1B" : (isMonitor ? "#92400E" : "#144A75");');
scriptJs = scriptJs.replace(/statFc\.style\.color = isReject \? "#991B1B" : \(isMonitor \? "#92400E" : "#102F4F"\);/g, 'statFc.style.color = isReject ? "#991B1B" : (isMonitor ? "#92400E" : "#144A75");');
scriptJs = scriptJs.replace(/statRisk\.style\.color = isReject \? "#991B1B" : \(isMonitor \? "#92400E" : "#102F4F"\);/g, 'statRisk.style.color = isReject ? "#991B1B" : (isMonitor ? "#92400E" : "#144A75");');
scriptJs = scriptJs.replace(/statPhys\.style\.color = \(afTemp > 3\.0 \|\| isReject\) \? "#991B1B" : "#102F4F";/g, 'statPhys.style.color = (afTemp > 3.0 || isReject) ? "#991B1B" : "#144A75";');

fs.writeFileSync('script.js', scriptJs, 'utf8');
fs.writeFileSync('frontend/script.js', scriptJs, 'utf8');
console.log('✔ Updated script.js and frontend/script.js');

console.log('=== PREDICTA REFINEMENT SCRIPT COMPLETED ===');
