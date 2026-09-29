const fs = require('fs');
const path = require('path');

console.log("=========================================================================");
console.log("APPLYING PREDICTA LIVE MONITOR + COMPONENTS UI/UX REFINEMENT");
console.log("=========================================================================");

// 1. Read build_restored_frontend.js
const builderPath = path.join(__dirname, '..', 'build_restored_frontend.js');
let builderCode = fs.readFileSync(builderPath, 'utf8');

// Identify page-monitor start and page-advanced start in build_restored_frontend.js
const pMonStart = builderCode.indexOf('<section id="page-monitor"');
const pAdvStart = builderCode.indexOf('<section id="page-advanced"');

if (pMonStart === -1 || pAdvStart === -1) {
  console.error("ERROR: Could not find page-monitor or page-advanced markers in build_restored_frontend.js");
  process.exit(1);
}

// Prepare the replacement content for page-monitor and page-components
const newMonitorAndComponents = `<!-- ========================================================================= -->
      <!-- PAGE 3: LIVE MONITOR (0h -> 168h Burn-in Temporal Workstation)            -->
      <!-- ========================================================================= -->
      <section id="page-monitor" class="page-view">
        <div id="page-overview" class="page-alias" style="display:none;"></div>

        <!-- Clean Prominent Header & Component Selector Card -->
        <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:18px 22px; border-radius:8px; margin-bottom:20px; box-shadow:var(--shadow-sm);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
            <div style="flex:1; min-width:300px;">
              <div class="technical-overline" style="font-size:11px; font-weight:700; color:#1976B8; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">TEMPORAL DEGRADATION SURVEILLANCE</div>
              <h2 style="font-size:20px; color:#123B63; font-weight:800; margin:0 0 4px 0;">Live Component Telemetry &amp; Degradation Monitor</h2>
              <p style="font-size:13px; color:#475569; margin:0;">Track real-time burn-in sensor drift across 0h to 168h with Gaussian Process Regression forecasting.</p>
            </div>
            <div style="display:flex; align-items:center; gap:12px; background:#F8FAFC; border:1px solid #CBD5E1; padding:10px 16px; border-radius:6px;">
              <label for="monitor-component-selector" style="font-size:12px; font-weight:700; color:#123B63; white-space:nowrap; text-transform:uppercase; letter-spacing:0.5px;">TARGET DIE:</label>
              <select id="monitor-component-selector" class="form-control" style="font-family:var(--font-mono); font-weight:700; font-size:13px; padding:6px 14px; border:1px solid #94A3B8; border-radius:4px; background:#FFFFFF; color:#0F172A; min-width:260px;" onchange="window.handleMonitorComponentChange(this.value)">
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
        </div>

        <!-- Temporal Burn-In Replay Controller (0h -> 168h) -->
        <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:18px; border-radius:8px; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:13px; font-weight:700; color:#123B63;">Qualification Hour:</span>
              <span id="live-current-hour-badge" style="font-family:var(--font-mono); font-size:16px; font-weight:800; color:#1976B8; background:#EAF4FB; padding:3px 10px; border-radius:4px; border:1px solid #BAE6FD;">24.0 h</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <button class="btn btn-outline btn-sm" id="btn-replay-step-back" onclick="window.stepReplay(-24)">◀ -24h</button>
              <button class="btn btn-primary btn-sm" id="btn-replay-play-pause" onclick="window.toggleReplayPlayback()">▶ Play Replay</button>
              <button class="btn btn-outline btn-sm" id="btn-replay-step-fwd" onclick="window.stepReplay(24)">+24h ▶</button>
              <button class="btn btn-outline btn-sm" id="btn-replay-reset" onclick="window.resetReplayTimeline()">Reset (0h)</button>
            </div>
          </div>
          <div style="padding:0 6px;">
            <input type="range" id="live-time-slider" min="0" max="168" step="24" value="24" style="width:100%; cursor:pointer;" oninput="window.handleTimelineSlider(this.value)">
            <div style="display:flex; justify-content:space-between; font-size:11px; font-family:var(--font-mono); color:#64748B; margin-top:4px;">
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

        <!-- Comparative Reliability Intelligence: Component vs Lot Trajectory Envelope -->
        <div class="comp-vs-lot-wrapper" id="live-component-vs-lot-chart-container" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:18px; border-radius:8px; margin-bottom:20px; box-shadow:var(--shadow-sm);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
            <div>
              <div style="font-size:10px; font-weight:700; color:#1976B8; text-transform:uppercase; letter-spacing:0.5px;">COMPARATIVE RELIABILITY INTELLIGENCE</div>
              <h3 style="font-size:16px; font-weight:800; color:#123B63; margin:0;" id="comp-vs-lot-title">Component vs. Lot Trajectory Envelope — IDDQ Standby</h3>
            </div>
            <!-- Metric Switcher Pills -->
            <div style="display:flex; gap:6px;">
              <button class="metric-pill-btn active" id="btn-metric-iddq" onclick="window.switchCompVsLotMetric('iddq')">IDDQ Standby</button>
              <button class="metric-pill-btn" id="btn-metric-leakage" onclick="window.switchCompVsLotMetric('leakage')">Gate Leakage</button>
              <button class="metric-pill-btn" id="btn-metric-tpd" onclick="window.switchCompVsLotMetric('tpd')">Propagation Delay</button>
              <button class="metric-pill-btn" id="btn-metric-temp" onclick="window.switchCompVsLotMetric('temperature')">Temperature</button>
            </div>
          </div>

          <!-- SVG Chart Area -->
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; padding:12px; position:relative; min-height:240px;" id="comp-vs-lot-svg-box">
            <!-- Rendered dynamically by script.js -->
          </div>

          <!-- Standardized Engineering Legend Bar -->
          <div class="engineering-legend-bar" style="margin-top:12px;">
            <span class="legend-item"><span class="legend-line-observed"></span> Observed (0h–24h)</span>
            <span class="legend-item"><span class="legend-line-forecast"></span> Forecast (24h–168h)</span>
            <span class="legend-item"><span class="legend-line-envelope"></span> Lot Envelope (5th–95th %)</span>
            <span class="legend-item"><span class="legend-line-limit"></span> Spec Limit</span>
            <span class="legend-item"><span class="legend-horizon-pin"></span> 168h Horizon</span>
            <span style="margin-left:auto; font-size:11px; color:#64748B; font-family:var(--font-mono);">
              Forecast Origin: 24h | Uncertainty: NOT_CALIBRATED (GPR 95% CI)
            </span>
          </div>
        </div>

        <!-- Benchmark Forecast Validation (Observed vs Predicted) -->
        <div class="card forecast-validation-card" id="live-forecast-validation-panel" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:18px; border-radius:8px; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #E2E8F0; padding-bottom:8px;">
            <div>
              <div style="font-size:10px; font-weight:700; color:#1976B8; text-transform:uppercase; letter-spacing:0.5px;">BENCHMARK FORECAST VALIDATION</div>
              <h3 style="font-size:15px; font-weight:800; color:#123B63; margin:0;">Forecast Validation — Observed vs. Predicted Accuracy</h3>
            </div>
            <span class="badge pass" id="fc-val-status-badge" style="font-size:11px; font-weight:700;">STATUS: BENCHMARK_VALIDATED (168h Ground Truth)</span>
          </div>

          <div class="forecast-val-grid">
            <div class="fc-val-metric">
              <span class="fc-val-label">Forecast Origin:</span>
              <strong class="fc-val-num">24.0 h</strong>
            </div>
            <div class="fc-val-metric">
              <span class="fc-val-label">Evaluation Horizon:</span>
              <strong class="fc-val-num" id="fc-val-horizon">168.0 h</strong>
            </div>
            <div class="fc-val-metric">
              <span class="fc-val-label">Observed Value:</span>
              <strong class="fc-val-num" id="fc-val-observed" style="color:#0284C7;">45.0 µA</strong>
            </div>
            <div class="fc-val-metric">
              <span class="fc-val-label">Predicted (GPR):</span>
              <strong class="fc-val-num" id="fc-val-predicted" style="color:#F97316;">44.2 µA</strong>
            </div>
            <div class="fc-val-metric">
              <span class="fc-val-label">Residual (Obs - Pred):</span>
              <strong class="fc-val-num" id="fc-val-residual" style="color:#059669;">+0.8 µA</strong>
            </div>
            <div class="fc-val-metric">
              <span class="fc-val-label">Absolute Error (MAE):</span>
              <strong class="fc-val-num" id="fc-val-mae" style="color:#059669;">0.80 µA</strong>
            </div>
          </div>

          <div id="fc-val-disclaimer" style="margin-top:12px; padding:10px 12px; background:#F8FAFC; border-radius:4px; border:1px solid #E2E8F0; font-size:11.5px; color:#475569;">
            <strong>Scientific Integrity Note:</strong> GPR trajectory generated from 24h baseline. Residual and error metrics calculated retrospectively against synthetic benchmark ground truth dataset. This benchmark evaluation does NOT constitute production calibration or external fab validation. Calibration: <code style="font-family:var(--font-mono); color:#0369A1;">NOT_CALIBRATED (BENCHMARK)</code>.
          </div>
        </div>

        <!-- 3 Synchronized Telemetry Charts -->
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; margin-bottom:24px;">
          <!-- Chart 1: IDDQ Current -->
          <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:16px; border-radius:8px;">
            <div style="font-size:13px; font-weight:700; color:#123B63; margin-bottom:4px;">IDDQ Standby Current (µA)</div>
            <div style="font-size:11px; color:#64748B; margin-bottom:10px;">Dynamic PAT Limit: 25.0 µA</div>
            <div id="chart-iddq-container" style="height:220px; width:100%;"></div>
          </div>

          <!-- Chart 2: Gate Leakage Current (GPR Forecast) -->
          <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:16px; border-radius:8px;">
            <div style="font-size:13px; font-weight:700; color:#123B63; margin-bottom:4px;">Gate Leakage Current (µA)</div>
            <div style="font-size:11px; color:#64748B; margin-bottom:10px;">168h GPR Trajectory + 95% Model Interval</div>
            <div id="chart-leakage-container" style="height:220px; width:100%;"></div>
          </div>

          <!-- Chart 3: Propagation Delay Tpd -->
          <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:16px; border-radius:8px;">
            <div style="font-size:13px; font-weight:700; color:#123B63; margin-bottom:4px;">Propagation Delay Tpd (ns)</div>
            <div style="font-size:11px; color:#64748B; margin-bottom:10px;">Timing Specification Limit: 16.0 ns</div>
            <div id="chart-tpd-container" style="height:220px; width:100%;"></div>
          </div>
        </div>

      </section>

      <!-- ========================================================================= -->
      <!-- PAGE 4: COMPONENTS INVENTORY & INVESTIGATION WORKSPACE                    -->
      <!-- ========================================================================= -->
      <section id="page-components" class="page-view">
        <div id="page-component" class="page-alias" style="display:none;"></div>

        <!-- Clean Compact Page Header -->
        <div class="page-header" style="margin-bottom:20px;">
          <div class="technical-overline" style="font-size:11px; font-weight:700; color:#1976B8; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">POPULATION SURVEILLANCE &amp; INVESTIGATION WORKSPACE</div>
          <h1 class="page-title" style="font-size:22px; color:#123B63; font-weight:700; margin:0 0 4px 0;">Component Parametric Analysis &amp; Investigation Workspace</h1>
          <p class="page-subtitle" style="font-size:13px; color:#475569; margin:0;">Detailed multi-channel reliability dossier, 12-stage provenance timeline, and population surveillance ledger.</p>
        </div>

        <!-- 1. COMPONENT IDENTITY DOSSIER (FIRST) -->
        <div class="card" id="component-identity-dossier-card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:20px; border-radius:8px; margin-bottom:20px; box-shadow:var(--shadow-sm);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px; border-bottom:1px solid #E2E8F0; padding-bottom:12px;">
            <div>
              <div style="font-size:10.5px; font-weight:700; color:#1976B8; text-transform:uppercase; letter-spacing:0.5px;">PRIMARY COMPONENT IDENTIFICATION</div>
              <h3 style="font-size:17px; font-weight:800; color:#123B63; margin:0;">Component Identity Dossier</h3>
            </div>
            <!-- Identity-only component dropdown -->
            <div style="display:flex; align-items:center; gap:10px; background:#F8FAFC; border:1px solid #CBD5E1; padding:8px 14px; border-radius:6px;">
              <label for="comp-investigation-selector" style="font-size:12px; font-weight:700; color:#123B63; text-transform:uppercase; letter-spacing:0.5px;">ACTIVE DIE:</label>
              <select id="comp-investigation-selector" class="form-control" style="font-family:var(--font-mono); font-weight:700; font-size:13px; padding:6px 14px; border:1px solid #94A3B8; border-radius:4px; background:#FFFFFF; color:#0F172A; min-width:260px;" onchange="window.handleComponentDossierChange(this.value)">
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

          <!-- Dossier Metadata Grid -->
          <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:16px; margin-bottom:8px;">
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:6px;">
              <span style="font-size:10.5px; font-weight:700; color:#64748B; text-transform:uppercase;">Die UID &amp; Wafer</span>
              <div style="margin-top:4px; font-size:14px; font-weight:700; color:#123B63; font-family:var(--font-mono);" id="dossier-uid">DIE-R20C20</div>
              <div style="font-size:11.5px; color:#64748B;" id="dossier-coord">R20 C20 (Center Die)</div>
            </div>
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:6px;">
              <span style="font-size:10.5px; font-weight:700; color:#64748B; text-transform:uppercase;">Lot &amp; Process Node</span>
              <div style="margin-top:4px; font-size:14px; font-weight:700; color:#123B63; font-family:var(--font-mono);" id="dossier-lot">LOT-SYN-048</div>
              <div style="font-size:11.5px; color:#64748B;" id="dossier-node">7nm FinFET (Automotive Grade)</div>
            </div>
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:6px;">
              <span style="font-size:10.5px; font-weight:700; color:#64748B; text-transform:uppercase;">Package &amp; Provenance</span>
              <div style="margin-top:4px; font-size:14px; font-weight:700; color:#123B63;" id="dossier-pkg">FCBGA-1156 (Flip-Chip)</div>
              <div style="font-size:10.5px; color:#0369A1; font-family:var(--font-mono);" id="dossier-hash">91bb598ae9115567...</div>
            </div>
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:6px;">
              <span style="font-size:10.5px; font-weight:700; color:#64748B; text-transform:uppercase;">Governed Status</span>
              <div style="margin-top:4px; display:flex; align-items:center; gap:8px;">
                <span class="badge reject" id="dossier-status" style="font-size:12px; font-weight:800; padding:4px 10px;">REJECT</span>
              </div>
              <div style="font-size:11px; color:#64748B; margin-top:3px;" id="dossier-timestamp">2026-09-28 14:22 UTC</div>
            </div>
          </div>
        </div>

        <!-- 2. LIVE STATUS / 6-CHANNEL TELEMETRY STREAM (SECOND) -->
        <div class="card" id="component-telemetry-stream-card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:18px; border-radius:8px; margin-bottom:20px; box-shadow:var(--shadow-sm);">
          <div style="font-size:10.5px; font-weight:700; color:#1976B8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">INSPECTION CHECKPOINT TELEMETRY (24h ORIGIN)</div>
          <h3 style="font-size:15px; font-weight:800; color:#123B63; margin:0 0 14px 0;">6-Channel Parametric Telemetry Stream</h3>

          <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:12px;">
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:6px;">
              <span style="font-size:10.5px; color:#64748B; font-weight:600; text-transform:uppercase;">Junction Temp</span>
              <div id="dossier-tel-temp" style="font-size:18px; font-weight:800; color:#DC2626; margin:4px 0;">85.0 °C</div>
              <span style="font-size:10.5px; color:#64748B;">Limit: 125.0 °C</span>
            </div>
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:6px;">
              <span style="font-size:10.5px; color:#64748B; font-weight:600; text-transform:uppercase;">Supply Vdd</span>
              <div id="dossier-tel-vdd" style="font-size:18px; font-weight:800; color:#123B63; margin:4px 0;">1.28 V</div>
              <span style="font-size:10.5px; color:#64748B;">Nominal: 1.20 V</span>
            </div>
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:6px;">
              <span style="font-size:10.5px; color:#64748B; font-weight:600; text-transform:uppercase;">Clock Freq</span>
              <div id="dossier-tel-freq" style="font-size:18px; font-weight:800; color:#123B63; margin:4px 0;">3.20 GHz</div>
              <span style="font-size:10.5px; color:#64748B;">Target: 3.20 GHz</span>
            </div>
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:6px;">
              <span style="font-size:10.5px; color:#64748B; font-weight:600; text-transform:uppercase;">IDDQ Standby</span>
              <div id="dossier-tel-iddq" style="font-size:18px; font-weight:800; color:#DC2626; margin:4px 0;">28.4 µA</div>
              <span style="font-size:10.5px; color:#64748B;">PAT Limit: 25.0 µA</span>
            </div>
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:6px;">
              <span style="font-size:10.5px; color:#64748B; font-weight:600; text-transform:uppercase;">Gate Leakage</span>
              <div id="dossier-tel-leak" style="font-size:18px; font-weight:800; color:#DC2626; margin:4px 0;">240.5 µA</div>
              <span style="font-size:10.5px; color:#64748B;">Spec Limit: 250.0 µA</span>
            </div>
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:6px;">
              <span style="font-size:10.5px; color:#64748B; font-weight:600; text-transform:uppercase;">Delay Tpd</span>
              <div id="dossier-tel-tpd" style="font-size:18px; font-weight:800; color:#123B63; margin:4px 0;">14.20 ns</div>
              <span style="font-size:10.5px; color:#64748B;">Limit: 16.00 ns</span>
            </div>
          </div>
        </div>

        <!-- 3. MULTI-CHANNEL RELIABILITY EVIDENCE (THIRD) -->
        <div class="card" id="component-reliability-evidence-card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:18px; border-radius:8px; margin-bottom:20px; box-shadow:var(--shadow-sm);">
          <div style="font-size:10.5px; font-weight:700; color:#1976B8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">MULTI-LAYER RELIABILITY INFERENCE</div>
          <h3 style="font-size:15px; font-weight:800; color:#123B63; margin:0 0 14px 0;">Governed Multi-Channel Reliability Evidence</h3>

          <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:14px;">
            <!-- Module A -->
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:14px; border-radius:6px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong style="font-size:12.5px; color:#123B63;">Module A: Spatial Outlier Screening</strong>
                <span class="badge reject" id="dossier-pat-badge" style="font-size:10.5px;">ANOMALOUS</span>
              </div>
              <div style="font-size:12px; color:#475569; display:flex; flex-direction:column; gap:4px;">
                <div>• PAT-MAD Outlier Score: <strong id="dossier-pat-val" style="color:#DC2626; font-family:var(--font-mono);">Z = 3.84</strong> (Threshold: 3.00)</div>
                <div>• COPOD Tail Probability: <strong id="dossier-copod-val" style="font-family:var(--font-mono);">q = 0.98</strong> (Threshold: 0.95)</div>
                <div>• Isolation Forest Score: <strong id="dossier-if-val" style="font-family:var(--font-mono);">s = 0.78</strong> (Threshold: 0.60)</div>
              </div>
            </div>

            <!-- Module B -->
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:14px; border-radius:6px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong style="font-size:12.5px; color:#123B63;">Module B: Prognostic Degradation (GPR)</strong>
                <span class="badge reject" id="dossier-gpr-badge" style="font-size:10.5px;">LIMIT BREACH</span>
              </div>
              <div style="font-size:12px; color:#475569; display:flex; flex-direction:column; gap:4px;">
                <div>• Projected 168h Drift: <strong id="dossier-proj-drift" style="color:#DC2626; font-family:var(--font-mono);">+58.5%</strong></div>
                <div>• Projected Delta: <strong id="dossier-delta-drift" style="font-family:var(--font-mono);">+16.6 µA IDDQ</strong></div>
                <div>• Earliest Limit Breach: <strong id="dossier-breach-horizon" style="color:#DC2626; font-family:var(--font-mono);">42.0h (IDDQ &gt; 25.0 µA)</strong></div>
              </div>
            </div>

            <!-- Latent Risk -->
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:14px; border-radius:6px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong style="font-size:12.5px; color:#123B63;">Supervised Latent Risk (XGBoost)</strong>
                <span class="badge reject" id="dossier-risk-tier" style="font-size:10.5px;">CRITICAL RISK</span>
              </div>
              <div style="font-size:12px; color:#475569; display:flex; flex-direction:column; gap:4px;">
                <div>• Failure Probability: <strong id="dossier-risk-prob" style="color:#DC2626; font-family:var(--font-mono);">0.884 (88.4%)</strong></div>
                <div>• Governed Operating Threshold: <strong style="font-family:var(--font-mono);">θ* = 0.20 (20.0%)</strong></div>
                <div>• Supervised Prediction: <strong id="dossier-risk-pred" style="color:#DC2626; font-family:var(--font-mono);">REJECT</strong></div>
              </div>
            </div>

            <!-- Physics Evidence -->
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:14px; border-radius:6px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong style="font-size:12.5px; color:#123B63;">Physics of Degradation</strong>
                <span class="badge pass" style="font-size:10.5px;">EVALUATED</span>
              </div>
              <div style="font-size:12px; color:#475569; display:flex; flex-direction:column; gap:4px;">
                <div>• Activation Energy Ea: <strong id="dossier-physics-ea" style="font-family:var(--font-mono);">0.70 eV</strong></div>
                <div>• Arrhenius / Eyring AF: <strong id="dossier-physics-af" style="font-family:var(--font-mono);">AF = 1.00</strong></div>
                <div>• Electromigration Ratio: <strong id="dossier-physics-em" style="font-family:var(--font-mono);">1.84</strong> | Thermal Margin: <strong id="dossier-physics-margin" style="font-family:var(--font-mono);">+40.0 °C</strong></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. TRACEABLE RELIABILITYCASE 12-STAGE TIMELINE (FOURTH) -->
        <div class="card" id="component-timeline-section" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:20px; border-radius:8px; margin-bottom:20px; box-shadow:var(--shadow-sm);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
            <div>
              <div style="font-size:10.5px; font-weight:700; color:#1976B8; text-transform:uppercase; letter-spacing:0.5px;">AUDITABLE DECISION PROVENANCE</div>
              <h3 style="font-size:16px; font-weight:800; color:#123B63; margin:0;">Traceable ReliabilityCase Lifecycle Timeline</h3>
            </div>
            <span style="font-size:11px; color:#64748B; font-family:var(--font-mono);">Click any stage chip to inspect cryptographic provenance</span>
          </div>

          <!-- 12-Stage Horizontal Stepper -->
          <div class="timeline-stepper-scroll" style="margin-bottom:14px;">
            <div class="timeline-step-chip active" id="comp-tstep-1" onclick="window.selectComponentTimelineStage(1)">
              <strong>01. 0h Ingestion</strong>
              <div style="font-size:9.5px; color:#64748B;">ATE Baseline</div>
            </div>
            <div class="timeline-step-chip" id="comp-tstep-2" onclick="window.selectComponentTimelineStage(2)">
              <strong>02. Quality Gate</strong>
              <div style="font-size:9.5px; color:#64748B;">16 Invariants</div>
            </div>
            <div class="timeline-step-chip" id="comp-tstep-3" onclick="window.selectComponentTimelineStage(3)">
              <strong>03. 24h Check</strong>
              <div style="font-size:9.5px; color:#64748B;">Burn-in Origin</div>
            </div>
            <div class="timeline-step-chip" id="comp-tstep-4" onclick="window.selectComponentTimelineStage(4)">
              <strong>04. Module A</strong>
              <div style="font-size:9.5px; color:#64748B;">Outlier Screening</div>
            </div>
            <div class="timeline-step-chip" id="comp-tstep-5" onclick="window.selectComponentTimelineStage(5)">
              <strong>05. Module B</strong>
              <div style="font-size:9.5px; color:#64748B;">Prognostic GPR</div>
            </div>
            <div class="timeline-step-chip" id="comp-tstep-6" onclick="window.selectComponentTimelineStage(6)">
              <strong>06. Latent Risk</strong>
              <div style="font-size:9.5px; color:#64748B;">Native XGBoost</div>
            </div>
            <div class="timeline-step-chip unavailable" id="comp-tstep-7" onclick="window.selectComponentTimelineStage(7)">
              <strong>07. 48h Horizon</strong>
              <div style="font-size:9.5px; color:#94A3B8;">No Data</div>
            </div>
            <div class="timeline-step-chip unavailable" id="comp-tstep-8" onclick="window.selectComponentTimelineStage(8)">
              <strong>08. 72h Horizon</strong>
              <div style="font-size:9.5px; color:#94A3B8;">No Data</div>
            </div>
            <div class="timeline-step-chip" id="comp-tstep-9" onclick="window.selectComponentTimelineStage(9)">
              <strong>09. 96h Check</strong>
              <div style="font-size:9.5px; color:#64748B;">Midpoint Check</div>
            </div>
            <div class="timeline-step-chip unavailable" id="comp-tstep-10" onclick="window.selectComponentTimelineStage(10)">
              <strong>10. 120/144h</strong>
              <div style="font-size:9.5px; color:#94A3B8;">No Data</div>
            </div>
            <div class="timeline-step-chip" id="comp-tstep-11" onclick="window.selectComponentTimelineStage(11)">
              <strong>11. 168h Horizon</strong>
              <div style="font-size:9.5px; color:#64748B;">Qualification End</div>
            </div>
            <div class="timeline-step-chip" id="comp-tstep-12" onclick="window.selectComponentTimelineStage(12)">
              <strong>12. Verdict</strong>
              <div style="font-size:9.5px; color:#64748B;">Passport Sign</div>
            </div>
          </div>

          <!-- Dynamic Stage Detail Drawer -->
          <div id="component-timeline-detail-drawer" style="background:#F8FAFC; border:1px solid #CBD5E1; border-radius:6px; padding:16px; font-size:12.5px; line-height:1.6; color:#334155;">
            <!-- Rendered dynamically by script.js -->
          </div>
        </div>

        <!-- 5. ACTIONS, QUALIFICATION EFFICIENCY & POPULATION LEDGER (FIFTH) -->
        <!-- Feature 6: Qualification Efficiency Opportunity -->
        <div class="qualification-efficiency-card" id="component-qualification-efficiency-panel" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:18px; border-radius:8px; margin-bottom:20px; box-shadow:var(--shadow-sm);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
            <div>
              <div style="font-size:10px; font-weight:700; color:#1976B8; text-transform:uppercase; letter-spacing:0.5px;">SCREENING THROUGHPUT ANALYSIS</div>
              <h3 style="font-size:15px; font-weight:800; color:#123B63; margin:0;">Qualification Efficiency Opportunity</h3>
            </div>
            <span class="badge" style="background:#FEF3C7; color:#B45309; font-size:10.5px; font-weight:700; border:1px solid #FDE68A;">
              BENCHMARK / ENGINEERING REVIEW ONLY
            </span>
          </div>

          <div class="efficiency-metrics-grid">
            <div class="eff-metric-card">
              <span class="eff-metric-label">Total Lot Units</span>
              <div class="eff-metric-val" id="eff-total-units">256</div>
              <span class="eff-metric-sub">Active Wafer Cohort</span>
            </div>
            <div class="eff-metric-card">
              <span class="eff-metric-label">Severe Anomalies</span>
              <div class="eff-metric-val" style="color:#DC2626;" id="eff-flagged-units">30</div>
              <span class="eff-metric-sub">11.7% Intercepted Early</span>
            </div>
            <div class="eff-metric-card">
              <span class="eff-metric-label">Nominal Qualified</span>
              <div class="eff-metric-val" style="color:#059669;" id="eff-nominal-units">179</div>
              <span class="eff-metric-sub">69.9% High-Confidence Pass</span>
            </div>
            <div class="eff-metric-card">
              <span class="eff-metric-label">Potential Early-Review</span>
              <div class="eff-metric-val" style="color:#1976B8;" id="eff-early-review">179 Units</div>
              <span class="eff-metric-sub">Candidate for Engineering Review</span>
            </div>
            <div class="eff-metric-card highlight">
              <span class="eff-metric-label">ATE Test-Time Opportunity</span>
              <div class="eff-metric-val" style="color:#1976B8;" id="eff-time-opp">~34.2%</div>
              <span class="eff-metric-sub">Estimated Screening Acceleration</span>
            </div>
          </div>

          <div style="margin-top:12px; padding:8px 12px; background:#F8FAFC; border-radius:4px; border:1px solid #E2E8F0; font-size:11px; color:#64748B;">
            <strong>Governance Disclaimer:</strong> Test-time efficiency estimates are based on synthetic benchmark data mode and algorithmic early-rejection bounds. This metric is provided for engineering exploration and <strong>does NOT constitute production burn-in reduction authorization</strong> without validated foundry qualification.
          </div>
        </div>

        <!-- Experiment 05: Dedicated Component Investigation Queue -->
        <div class="investigation-queue-container" id="component-investigation-queue-container">
          <div class="queue-summary-banner">
            <div>
              <div style="font-size:10px; font-weight:700; color:#DC2626; text-transform:uppercase; letter-spacing:0.5px;">ENGINEERING INVESTIGATION QUEUE</div>
              <h3 style="font-size:16px; font-weight:800; color:#123B63; margin:0;">High-Priority Flagged Units (REJECT / MONITOR / INSUFFICIENT)</h3>
            </div>
            <!-- Live Queue Filters -->
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <select id="queue-filter-status" style="font-size:11.5px; padding:5px 10px; border:1px solid #CBD5E1; border-radius:4px;" onchange="window.filterInvestigationQueue()">
                <option value="all">All Flagged States (77)</option>
                <option value="REJECT">REJECT Only (30)</option>
                <option value="MONITOR">MONITOR Only (47)</option>
                <option value="INSUFFICIENT">Insufficient Evidence</option>
              </select>
              <select id="queue-sort-by" style="font-size:11.5px; padding:5px 10px; border:1px solid #CBD5E1; border-radius:4px;" onchange="window.filterInvestigationQueue()">
                <option value="breach">Sort: Earliest Breach Horizon</option>
                <option value="risk">Sort: Highest Failure Risk</option>
                <option value="anomaly">Sort: Highest Anomaly Severity</option>
                <option value="uid">Sort: Component UID</option>
              </select>
            </div>
          </div>

          <!-- Queue Cards Grid -->
          <div class="queue-grid" id="investigation-queue-grid">
            \${queueCards}
          </div>
        </div>

        <!-- Filter and Search Bar -->
        <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:14px 16px; border-radius:6px; margin-bottom:18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <input type="text" id="component-search-input" placeholder="Search Component or Lot..." style="padding:6px 12px; font-size:12px; border:1px solid #CBD5E1; border-radius:4px; width:220px;" oninput="window.filterComponentsTable(this.value)">
              <select id="filter-risk-tier" style="padding:6px 10px; font-size:12px; border:1px solid #CBD5E1; border-radius:4px;" onchange="window.filterComponentsTable()">
                <option value="all">All Risk Tiers</option>
                <option value="CRITICAL">Critical (P ≥ 0.80)</option>
                <option value="HIGH">High (0.20 ≤ P &lt; 0.80)</option>
                <option value="NOMINAL">Nominal (P &lt; 0.20)</option>
              </select>
              <select id="filter-disposition" style="padding:6px 10px; font-size:12px; border:1px solid #CBD5E1; border-radius:4px;" onchange="window.filterComponentsTable()">
                <option value="all">All Dispositions</option>
                <option value="REJECT">REJECT</option>
                <option value="MONITOR">MONITOR</option>
                <option value="PASS">PASS</option>
              </select>
            </div>
            <div style="font-size:12px; color:#64748B; font-weight:600;" id="comp-count-summary">
              Showing 256 / 256 Active Components
            </div>
          </div>
        </div>

        <!-- 256-Row Components Inventory Table -->
        <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:18px; border-radius:8px; margin-bottom:24px;">
          <div style="overflow-x:auto; max-height:480px;">
            <table class="table-compact" style="width:100%; font-size:12px; border-collapse:collapse;" id="components-inventory-table">
              <thead>
                <tr style="border-bottom:2px solid #D8E5EF; text-align:left; color:#123B63; background:#F8FAFC;">
                  <th style="padding:10px 8px;">Component ID</th>
                  <th style="padding:10px 8px;">Lot ID</th>
                  <th style="padding:10px 8px;">Burn-in (h)</th>
                  <th style="padding:10px 8px;">IDDQ (µA)</th>
                  <th style="padding:10px 8px;">Leakage (µA)</th>
                  <th style="padding:10px 8px;">Tpd (ns)</th>
                  <th style="padding:10px 8px;">Risk Score</th>
                  <th style="padding:10px 8px;">Disposition</th>
                  <th style="padding:10px 8px; text-align:right;">Reliability Passport</th>
                </tr>
              </thead>
              <tbody id="lot-table-body">
                \${rows}
              </tbody>
            </table>
          </div>
        </div>

      </section>

      `;

builderCode = builderCode.substring(0, pMonStart) + newMonitorAndComponents + builderCode.substring(pAdvStart);

fs.writeFileSync(builderPath, builderCode, 'utf8');
console.log("✔ Successfully updated build_restored_frontend.js with clean Monitor and Components sections.");
