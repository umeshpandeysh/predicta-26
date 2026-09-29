const fs = require('fs');
const path = require('path');

// 1. UPDATE INDEX.HTML
let html = fs.readFileSync('index.html', 'utf8');

const monitorStart = html.indexOf('<section id="page-monitor"');
const monitorEnd = html.indexOf('</section>', monitorStart) + 10;

if (monitorStart === -1 || monitorEnd === -1) {
  console.error('Could not find page-monitor section in index.html');
  process.exit(1);
}

const newMonitorHtml = `<section id="page-monitor" class="page-view">
        <div id="page-overview" class="page-alias" style="display:none;"></div>

        <!-- Clean Prominent Header & Replay Controller (Unified Horizontal Card) -->
        <div class="card" style="background:#FFFFFF; border:1px solid #D8EAF6; padding:18px 22px; border-radius:8px; margin-bottom:20px; box-shadow:var(--shadow-sm);">
          <div style="display:grid; grid-template-columns:1.05fr 1.2fr; gap:24px; align-items:center;">
            <!-- Left: Title & Target Die Selector -->
            <div>
              <div style="font-size:12px; font-weight:700; color:#1976B8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px;">LIVE SURVEILLANCE &amp; PROGNOSTICS</div>
              <h1 class="page-title" style="font-size:21px; color:#123B63; font-weight:700; margin:0 0 6px 0;">Live Component Telemetry &amp; Degradation Monitor</h1>
              <p class="page-subtitle" style="font-size:13px; color:#475569; margin:0 0 12px 0;">Track real-time burn-in sensor drift across 0h to 168h with Gaussian Process Regression forecasting.</p>
              
              <div style="display:flex; align-items:center; gap:10px; background:#F5F9FD; border:1px solid #CBD5E1; padding:8px 14px; border-radius:6px;">
                <label for="monitor-component-selector" style="font-size:12px; font-weight:700; color:#123B63; white-space:nowrap; text-transform:uppercase; letter-spacing:0.5px;">TARGET DIE:</label>
                <select id="monitor-component-selector" class="form-control" style="font-family:var(--font-mono); font-weight:700; font-size:13px; padding:6px 12px; border:1px solid #94A3B8; border-radius:4px; background:#FFFFFF; color:#0F172A; width:100%;" onchange="window.handleMonitorComponentChange(this.value)">
                  <option value="DIE-R20C20">DIE-R20C20 — LOT-SYN-048</option>
                  <option value="DIE-R05C12">DIE-R05C12 — LOT-SYN-044</option>
                  <option value="DIE-R12C08">DIE-R12C08 — LOT-SYN-045</option>
                  <option value="DIE-R15C15">DIE-R15C15 — LOT-SYN-043</option>
                  <option value="DIE-R02C14">DIE-R02C14 — LOT-SYN-046</option>
                  <option value="DIE-R08C08">DIE-R08C08 — LOT-SYN-047</option>
                  <option value="DIE-R16C04">DIE-R16C04 — LOT-SYN-049</option>
                  <option value="DIE-R09C11">DIE-R09C11 — LOT-SYN-050</option>
                  <option value="DIE-R05C05">DIE-R05C05 — LOT-SYN-043</option>
                  <option value="DIE-R00C00">DIE-R00C00 — LOT-SYN-043</option>
                </select>
              </div>
            </div>

            <!-- Right: Temporal Burn-In Replay Controller -->
            <div style="background:#F5F9FD; border:1px solid #D8EAF6; padding:14px 18px; border-radius:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:12.5px; font-weight:700; color:#123B63;">Qualification Hour:</span>
                  <span id="live-current-hour-badge" style="font-family:var(--font-mono); font-size:15px; font-weight:800; color:#1976B8; background:#FFFFFF; padding:3px 10px; border-radius:4px; border:1px solid #BAE6FD;">24.0 h</span>
                </div>
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                  <button class="btn btn-outline btn-sm" id="btn-replay-step-back" onclick="window.stepReplay(-24)" style="font-size:12px; padding:4px 10px;">◀ -24h</button>
                  <button class="btn btn-primary btn-sm" id="btn-replay-play-pause" onclick="window.toggleReplayPlayback()" style="font-size:12px; padding:4px 12px;">▶ Play Replay</button>
                  <button class="btn btn-outline btn-sm" id="btn-replay-step-fwd" onclick="window.stepReplay(24)" style="font-size:12px; padding:4px 10px;">+24h ▶</button>
                  <button class="btn btn-outline btn-sm" id="btn-replay-reset" onclick="window.resetReplayTimeline()" style="font-size:12px; padding:4px 10px;">Reset (0h)</button>
                </div>
              </div>
              <div style="padding:0 2px;">
                <input type="range" id="live-time-slider" min="0" max="168" step="24" value="24" style="width:100%; cursor:pointer;" oninput="window.handleTimelineSlider(this.value)">
                <div style="display:flex; justify-content:space-between; font-size:11.5px; font-family:var(--font-mono); color:#64748B; margin-top:4px;">
                  <span>0h (Pre-Screen)</span>
                  <span>24h (Initial)</span>
                  <span>48h</span>
                  <span>72h</span>
                  <span>96h (Midpoint)</span>
                  <span>120h</span>
                  <span>144h</span>
                  <span>168h (Full Life)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Comparative Reliability Intelligence: Component vs Lot Trajectory Envelope -->
        <div class="comp-vs-lot-wrapper" id="live-component-vs-lot-chart-container" style="background:#FFFFFF; border:1px solid #D8EAF6; padding:20px; border-radius:8px; margin-bottom:20px; box-shadow:var(--shadow-sm);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:12px;">
            <div>
              <div style="font-size:12px; font-weight:700; color:#1976B8; text-transform:uppercase; letter-spacing:0.5px;">COMPARATIVE RELIABILITY INTELLIGENCE</div>
              <h3 style="font-size:17px; font-weight:800; color:#123B63; margin:0;" id="comp-vs-lot-title">Component vs. Lot Trajectory Envelope — IDDQ Standby</h3>
            </div>
            <!-- Metric Switcher Pills -->
            <div style="display:flex; gap:8px;">
              <button class="metric-pill-btn active" id="btn-metric-iddq" onclick="window.switchCompVsLotMetric('iddq')" style="font-size:12.5px; padding:6px 14px;">IDDQ Standby</button>
              <button class="metric-pill-btn" id="btn-metric-leakage" onclick="window.switchCompVsLotMetric('leakage')" style="font-size:12.5px; padding:6px 14px;">Gate Leakage</button>
              <button class="metric-pill-btn" id="btn-metric-tpd" onclick="window.switchCompVsLotMetric('tpd')" style="font-size:12.5px; padding:6px 14px;">Propagation Delay</button>
              <button class="metric-pill-btn" id="btn-metric-temp" onclick="window.switchCompVsLotMetric('temperature')" style="font-size:12.5px; padding:6px 14px;">Temperature</button>
            </div>
          </div>

          <!-- SVG Chart Area -->
          <div style="background:#F5F9FD; border:1px solid #D8EAF6; border-radius:8px; padding:16px; position:relative; min-height:320px;" id="comp-vs-lot-svg-box">
            <!-- Rendered dynamically by script.js -->
          </div>

          <!-- Standardized Engineering Legend Bar -->
          <div class="engineering-legend-bar" style="margin-top:14px; display:flex; align-items:center; flex-wrap:wrap; gap:14px; font-size:12px;">
            <span class="legend-item"><span class="legend-line-observed"></span> Observed (0h–Current)</span>
            <span class="legend-item"><span class="legend-line-forecast"></span> Forecast (Current–168h)</span>
            <span class="legend-item"><span class="legend-line-envelope"></span> Lot Envelope (5th–95th %)</span>
            <span class="legend-item"><span class="legend-line-limit"></span> Spec Limit</span>
            <span class="legend-item"><span class="legend-horizon-pin"></span> Playback Cursor</span>
            <span style="margin-left:auto; font-size:12px; color:#64748B; font-family:var(--font-mono);">
              Dynamic Replay Active | Uncertainty: 95% Confidence Interval
            </span>
          </div>
        </div>

        <!-- Qualification Forecast Validation (Observed vs Predicted) -->
        <div class="card forecast-validation-card" id="live-forecast-validation-panel" style="background:#FFFFFF; border:1px solid #D8EAF6; padding:18px; border-radius:8px; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #D8EAF6; padding-bottom:8px;">
            <div>
              <div style="font-size:12px; font-weight:700; color:#1976B8; text-transform:uppercase; letter-spacing:0.5px;">QUALIFICATION FORECAST VALIDATION</div>
              <h3 style="font-size:16px; font-weight:800; color:#123B63; margin:0;">Forecast Validation — Observed vs. Predicted Accuracy</h3>
            </div>
            <span class="badge pass" id="fc-val-status-badge" style="font-size:12px; font-weight:700;">STATUS: VALIDATED (168h Ground Truth)</span>
          </div>

          <div class="forecast-val-grid">
            <div class="fc-val-metric">
              <span class="fc-val-label" style="font-size:12px;">Forecast Origin:</span>
              <strong class="fc-val-num" id="fc-val-origin" style="font-size:15px;">24.0 h</strong>
            </div>
            <div class="fc-val-metric">
              <span class="fc-val-label" style="font-size:12px;">Evaluation Horizon:</span>
              <strong class="fc-val-num" id="fc-val-horizon" style="font-size:15px;">168.0 h</strong>
            </div>
            <div class="fc-val-metric">
              <span class="fc-val-label" style="font-size:12px;">Observed Value:</span>
              <strong class="fc-val-num" id="fc-val-observed" style="color:#0284C7; font-size:15px;">45.0 µA</strong>
            </div>
            <div class="fc-val-metric">
              <span class="fc-val-label" style="font-size:12px;">Predicted (GPR):</span>
              <strong class="fc-val-num" id="fc-val-predicted" style="color:#F97316; font-size:15px;">44.2 µA</strong>
            </div>
            <div class="fc-val-metric">
              <span class="fc-val-label" style="font-size:12px;">Residual (Obs - Pred):</span>
              <strong class="fc-val-num" id="fc-val-residual" style="color: #166534; font-size:15px;">+0.8 µA</strong>
            </div>
            <div class="fc-val-metric">
              <span class="fc-val-label" style="font-size:12px;">Absolute Error (MAE):</span>
              <strong class="fc-val-num" id="fc-val-mae" style="color: #166534; font-size:15px;">0.80 µA</strong>
            </div>
          </div>

          <div id="fc-val-disclaimer" style="margin-top:12px; padding:10px 12px; background:#F5F9FD; border-radius:4px; border:1px solid #D8EAF6; font-size:12px; color:#475569;">
            <strong>Scientific Integrity Note:</strong> GPR trajectory generated from 24h baseline. Residual and error metrics calculated retrospectively against synthetic ground truth dataset. This qualification evaluation does NOT constitute production calibration or external fab validation. Calibration: <code style="font-family:var(--font-mono); color:#0369A1;">NOT_CALIBRATED (SYNTHETIC_SCENARIO)</code>.
          </div>
        </div>

        <!-- 3 Synchronized Telemetry Charts -->
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; margin-bottom:24px;">
          <!-- Chart 1: IDDQ Current -->
          <div class="card" style="background:#FFFFFF; border:1px solid #D8EAF6; padding:18px; border-radius:8px;">
            <div style="font-size:14px; font-weight:700; color:#123B63; margin-bottom:4px;">IDDQ Standby Current (µA)</div>
            <div style="font-size:12px; color:#64748B; margin-bottom:10px;">Dynamic PAT Limit: 25.0 µA</div>
            <div id="chart-iddq-container" style="height:240px; width:100%;"></div>
          </div>

          <!-- Chart 2: Gate Leakage Current (GPR Forecast) -->
          <div class="card" style="background:#FFFFFF; border:1px solid #D8EAF6; padding:18px; border-radius:8px;">
            <div style="font-size:14px; font-weight:700; color:#123B63; margin-bottom:4px;">Gate Leakage Current (µA)</div>
            <div style="font-size:12px; color:#64748B; margin-bottom:10px;">168h GPR Trajectory + 95% Model Interval</div>
            <div id="chart-leakage-container" style="height:240px; width:100%;"></div>
          </div>

          <!-- Chart 3: Propagation Delay Tpd -->
          <div class="card" style="background:#FFFFFF; border:1px solid #D8EAF6; padding:18px; border-radius:8px;">
            <div style="font-size:14px; font-weight:700; color:#123B63; margin-bottom:4px;">Propagation Delay Tpd (ns)</div>
            <div style="font-size:12px; color:#64748B; margin-bottom:10px;">Timing Specification Limit: 16.0 ns</div>
            <div id="chart-tpd-container" style="height:240px; width:100%;"></div>
          </div>
        </div>

      </section>`;

html = html.substring(0, monitorStart) + newMonitorHtml + html.substring(monitorEnd);

// Global font size increase in index.html
html = html.replace(/font-size:\s*8\.5px/g, 'font-size:11px');
html = html.replace(/font-size:\s*9px/g, 'font-size:11.5px');
html = html.replace(/font-size:\s*9\.5px/g, 'font-size:11.5px');
html = html.replace(/font-size:\s*10px/g, 'font-size:12px');
html = html.replace(/font-size:\s*10\.5px/g, 'font-size:12px');
html = html.replace(/font-size:\s*11px/g, 'font-size:12.5px');

fs.writeFileSync('index.html', html, 'utf8');
fs.writeFileSync('frontend/index.html', html, 'utf8');
console.log('index.html & frontend/index.html updated successfully.');
