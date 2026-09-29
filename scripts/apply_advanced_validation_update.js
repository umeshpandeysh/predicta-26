const fs = require('fs');
const path = require('path');

console.log("=========================================================================");
console.log("UPDATING ADVANCED WORKSTATION: MODEL REGISTRY, GRAPH GEOMETRY & VALIDATION");
console.log("=========================================================================");

const buildJsPath = path.join(__dirname, '..', 'build_restored_frontend.js');
let buildJs = fs.readFileSync(buildJsPath, 'utf8');

// 1. Locate #page-advanced
const advStartTag = '<section id="page-advanced" class="page-view">';
const advEndTag = '</section>\n\n    </main>';

const advStartIdx = buildJs.indexOf(advStartTag);
const advEndIdx = buildJs.indexOf(advEndTag, advStartIdx);

if (advStartIdx === -1 || advEndIdx === -1) {
  console.error("❌ Could not locate page-advanced in build_restored_frontend.js");
  process.exit(1);
}

const completeAdvancedHtml = `<section id="page-advanced" class="page-view">

        <!-- Clean Compact Page Header -->
        <div class="page-header" style="margin-bottom:18px;">
          <h1 class="page-title" style="font-size:22px; color:#123B63; font-weight:700; margin:0 0 4px 0;">ADVANCED RELIABILITY WORKSTATION</h1>
          <p class="page-subtitle" style="font-size:13px; color:#475569; margin:0;">Inspect model behavior, reliability evidence, physics, governance and traceability.</p>
        </div>

        <!-- 10 Dedicated Segmented Subtab Navigation Buttons -->
        <div style="display:flex; gap:6px; border-bottom:1px solid #D8E5EF; padding-bottom:10px; margin-bottom:20px; overflow-x:auto;" id="advanced-tabs-bar">
          <button class="btn btn-outline adv-tab-btn active" data-target="adv-tab-registry" onclick="window.switchAdvancedTab('adv-tab-registry')" style="font-size:12px; font-weight:600; padding:7px 13px; background:#FFFFFF; border-bottom:2px solid #1976B8; color:#1976B8;">1. Model Registry</button>
          <button class="btn btn-outline adv-tab-btn" data-target="adv-tab-mod-a" onclick="window.switchAdvancedTab('adv-tab-mod-a')" style="font-size:12px; font-weight:600; padding:7px 13px; background:#FFFFFF;">2. Module A</button>
          <button class="btn btn-outline adv-tab-btn" data-target="adv-tab-mod-b" onclick="window.switchAdvancedTab('adv-tab-mod-b')" style="font-size:12px; font-weight:600; padding:7px 13px; background:#FFFFFF;">3. Module B</button>
          <button class="btn btn-outline adv-tab-btn" data-target="adv-tab-latent-risk" onclick="window.switchAdvancedTab('adv-tab-latent-risk')" style="font-size:12px; font-weight:600; padding:7px 13px; background:#FFFFFF;">4. Latent Risk</button>
          <button class="btn btn-outline adv-tab-btn" data-target="adv-tab-physics" onclick="window.switchAdvancedTab('adv-tab-physics')" style="font-size:12px; font-weight:600; padding:7px 13px; background:#FFFFFF;">5. Physics</button>
          <button class="btn btn-outline adv-tab-btn" data-target="adv-tab-governance" onclick="window.switchAdvancedTab('adv-tab-governance')" style="font-size:12px; font-weight:600; padding:7px 13px; background:#FFFFFF;">6. Decision Governance</button>
          <button class="btn btn-outline adv-tab-btn" data-target="adv-tab-validation" onclick="window.switchAdvancedTab('adv-tab-validation')" style="font-size:12px; font-weight:600; padding:7px 13px; background:#FFFFFF;">7. Validation &amp; Evidence</button>
          <button class="btn btn-outline adv-tab-btn" data-target="adv-tab-traceability" onclick="window.switchAdvancedTab('adv-tab-traceability')" style="font-size:12px; font-weight:600; padding:7px 13px; background:#FFFFFF;">8. Traceability</button>
          <button class="btn btn-outline adv-tab-btn" data-target="adv-tab-simulation" onclick="window.switchAdvancedTab('adv-tab-simulation')" style="font-size:12px; font-weight:600; padding:7px 13px; background:#FFFFFF;">9. Simulation</button>
          <button class="btn btn-outline adv-tab-btn" data-target="adv-tab-reports" onclick="window.switchAdvancedTab('adv-tab-reports')" style="font-size:12px; font-weight:600; padding:7px 13px; background:#FFFFFF;">10. Reports</button>
        </div>

        <!-- ── SUBTAB 1: MODEL REGISTRY ─────────────────────────────────────────── -->
        <div id="adv-tab-registry" class="adv-subtab-content" style="display:block;">
          <!-- Model Health & Readiness Summary Panel -->
          <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:18px; border-radius:8px; margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div style="font-size:13px; font-weight:700; color:#123B63; text-transform:uppercase; letter-spacing:0.5px;">MODEL HEALTH &amp; SYSTEM READINESS</div>
              <span class="badge pass" style="font-size:10px; font-weight:700;">8/8 ENGINES ACTIVE &amp; LOADED</span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px;">
              <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:10px; border-radius:6px;">
                <div style="font-size:10px; color:#64748B; font-weight:600;">Authoritative Model</div>
                <div style="font-size:12px; font-weight:700; color:#123B63; margin-top:2px;">XGBoost v4.0.0</div>
                <div style="font-size:10px; color:#059669; font-weight:600; margin-top:2px;">● ACTIVE (LOCKED)</div>
              </div>
              <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:10px; border-radius:6px;">
                <div style="font-size:10px; color:#64748B; font-weight:600;">Anomaly Stack</div>
                <div style="font-size:12px; font-weight:700; color:#123B63; margin-top:2px;">PAT + COPOD + IF + Mahalanobis</div>
                <div style="font-size:10px; color:#059669; font-weight:600; margin-top:2px;">● ONLINE (4-WAY)</div>
              </div>
              <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:10px; border-radius:6px;">
                <div style="font-size:10px; color:#64748B; font-weight:600;">Prognostics</div>
                <div style="font-size:12px; font-weight:700; color:#123B63; margin-top:2px;">GPR 168h Forecaster v2.2.0</div>
                <div style="font-size:10px; color:#059669; font-weight:600; margin-top:2px;">● ACTIVE / ONLINE</div>
              </div>
              <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:10px; border-radius:6px;">
                <div style="font-size:10px; color:#64748B; font-weight:600;">Latent Risk</div>
                <div style="font-size:12px; font-weight:700; color:#123B63; margin-top:2px;">28-Feature GBDT (θ*=0.20)</div>
                <div style="font-size:10px; color:#059669; font-weight:600; margin-top:2px;">● AUTHORITATIVE</div>
              </div>
              <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:10px; border-radius:6px;">
                <div style="font-size:10px; color:#64748B; font-weight:600;">Physics Engine</div>
                <div style="font-size:12px; font-weight:700; color:#123B63; margin-top:2px;">Arrhenius / Eyring / EM / BTI</div>
                <div style="font-size:10px; color:#059669; font-weight:600; margin-top:2px;">● ANALYTICAL (DETERMINISTIC)</div>
              </div>
              <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:10px; border-radius:6px;">
                <div style="font-size:10px; color:#64748B; font-weight:600;">Calibration</div>
                <div style="font-size:12px; font-weight:700; color:#123B63; margin-top:2px;">Conformal Split (q̂=0.082)</div>
                <div style="font-size:10px; color:#D97706; font-weight:600; margin-top:2px;">● BENCHMARK_FROZEN</div>
              </div>
              <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:10px; border-radius:6px;">
                <div style="font-size:10px; color:#64748B; font-weight:600;">Provenance</div>
                <div style="font-size:12px; font-weight:700; color:#123B63; margin-top:2px;">SHA-256 Certified Manifests</div>
                <div style="font-size:10px; color:#059669; font-weight:600; margin-top:2px;">● AUDITED (18/18 PASS)</div>
              </div>
            </div>
          </div>

          <!-- Technical Summary Strip -->
          <div class="card" style="background:#F8FAFC; border:1px solid #D8E5EF; padding:12px 18px; border-radius:8px; margin-bottom:16px;">
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; font-size:11.5px;">
              <div><strong style="color:#64748B;">AUTHORITATIVE MODEL:</strong> <div style="color:#123B63; font-weight:700;">XGBoost (Rel: 2.0)</div></div>
              <div><strong style="color:#64748B;">VERSION:</strong> <div style="font-family:var(--font-mono); color:#123B63;">v4.0.0-prod</div></div>
              <div><strong style="color:#64748B;">STATUS:</strong> <div><span class="badge pass" style="font-size:9.5px;">AUTHORITATIVE</span></div></div>
              <div><strong style="color:#64748B;">DATASET:</strong> <div style="font-family:var(--font-mono); color:#123B63;">LATENT-TRAJ-SYN-2026</div></div>
              <div><strong style="color:#64748B;">PROGNOSTIC GPR:</strong> <div style="color:#059669; font-weight:600;">ACTIVE (v2.2.0)</div></div>
              <div><strong style="color:#64748B;">MAHALANOBIS:</strong> <div style="color:#1976B8; font-weight:600;">ONLINE (Supporting)</div></div>
              <div><strong style="color:#64748B;">OPERATING GATE:</strong> <div style="color:#123B63; font-weight:700;">Fail-Closed (θ*=0.20)</div></div>
            </div>
          </div>

          <!-- Authoritative Model Inspection Table -->
          <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:20px; border-radius:8px; margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
              <h3 style="font-size:15px; font-weight:700; color:#123B63; margin:0;">Model Registry &amp; Architecture Inspection Table</h3>
              <span style="font-size:11px; color:#64748B;">Source of Truth: <code>predicta_production_manifest.json</code> &amp; Codebase Architecture</span>
            </div>
            <div style="overflow-x:auto;">
              <table class="table-compact" style="width:100%; font-size:11.5px; border-collapse:collapse;">
                <thead>
                  <tr style="border-bottom:2px solid #D8E5EF; background:#F8FAFC; color:#123B63; text-align:left;">
                    <th style="padding:8px;">Model</th>
                    <th style="padding:8px;">Role</th>
                    <th style="padding:8px;">Version</th>
                    <th style="padding:8px;">Status</th>
                    <th style="padding:8px;">Input / Feature Basis</th>
                    <th style="padding:8px;">Output</th>
                    <th style="padding:8px;">Calibration</th>
                    <th style="padding:8px;">Provenance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom:1px solid #F1F5F9;">
                    <td style="padding:8px; font-weight:700; color:#123B63;">XGBoost Latent Failure Classifier</td>
                    <td style="padding:8px;"><span class="badge pass" style="font-size:9px;">AUTHORITATIVE</span></td>
                    <td style="padding:8px; font-family:var(--font-mono);">4.0.0</td>
                    <td style="padding:8px;"><span class="badge pass" style="font-size:9px;">ACTIVE / LOCKED</span></td>
                    <td style="padding:8px;">28 Engineered Features (0h/24h)</td>
                    <td style="padding:8px; font-family:var(--font-mono);">P(Defect) ∈ [0,1], θ*=0.20</td>
                    <td style="padding:8px; color:#D97706; font-weight:600;">Benchmark Log-Odds</td>
                    <td style="padding:8px; font-family:var(--font-mono); font-size:10px; color:#64748B;">91bb598ae911...d98</td>
                  </tr>
                  <tr style="border-bottom:1px solid #F1F5F9;">
                    <td style="padding:8px; font-weight:700; color:#123B63;">Gaussian Process Regression (GPR)</td>
                    <td style="padding:8px;"><span class="badge pass" style="font-size:9px;">AUTHORITATIVE (Prognostic)</span></td>
                    <td style="padding:8px; font-family:var(--font-mono);">2.2.0</td>
                    <td style="padding:8px;"><span class="badge pass" style="font-size:9px;">ACTIVE / ONLINE</span></td>
                    <td style="padding:8px;">0h/24h Time-Series Telemetry</td>
                    <td style="padding:8px; font-family:var(--font-mono);">168h Trajectory + 95% Bayesian CI</td>
                    <td style="padding:8px;">Matérn 5/2 &amp; RBF Kernels</td>
                    <td style="padding:8px; font-family:var(--font-mono); font-size:10px; color:#64748B;">1d5fd207ecbd...fcf</td>
                  </tr>
                  <tr style="border-bottom:1px solid #F1F5F9;">
                    <td style="padding:8px; font-weight:700; color:#123B63;">Robust Part Average Testing (PAT-MAD)</td>
                    <td style="padding:8px;"><span class="badge pass" style="font-size:9px;">AUTHORITATIVE (Spatial)</span></td>
                    <td style="padding:8px; font-family:var(--font-mono);">1.5.0</td>
                    <td style="padding:8px;"><span class="badge pass" style="font-size:9px;">ONLINE</span></td>
                    <td style="padding:8px;">6-Ch Parametric Telemetry</td>
                    <td style="padding:8px; font-family:var(--font-mono);">Z-Score (|Z| &gt; 3.0σ MAD)</td>
                    <td style="padding:8px;">Median ± 3.0× MAD</td>
                    <td style="padding:8px; font-family:var(--font-mono); font-size:10px; color:#64748B;">a01c841fa192...c02</td>
                  </tr>
                  <tr style="border-bottom:1px solid #F1F5F9;">
                    <td style="padding:8px; font-weight:700; color:#123B63;">COPOD Empirical Copula Detector</td>
                    <td style="padding:8px;"><span class="badge" style="background:#EAF4FB; color:#1976B8; font-size:9px;">SUPPORTING</span></td>
                    <td style="padding:8px; font-family:var(--font-mono);">1.2.0</td>
                    <td style="padding:8px;"><span class="badge pass" style="font-size:9px;">ONLINE</span></td>
                    <td style="padding:8px;">Empirical Joint CDF Space</td>
                    <td style="padding:8px; font-family:var(--font-mono);">Tail Probability (q &gt; 0.95)</td>
                    <td style="padding:8px;">Non-Parametric Tail Quantile</td>
                    <td style="padding:8px; font-family:var(--font-mono); font-size:10px; color:#64748B;">d33b819fa223...f11</td>
                  </tr>
                  <tr style="border-bottom:1px solid #F1F5F9;">
                    <td style="padding:8px; font-weight:700; color:#123B63;">Isolation Forest Spatial Outlier</td>
                    <td style="padding:8px;"><span class="badge" style="background:#EAF4FB; color:#1976B8; font-size:9px;">SUPPORTING</span></td>
                    <td style="padding:8px; font-family:var(--font-mono);">1.1.0</td>
                    <td style="padding:8px;"><span class="badge pass" style="font-size:9px;">ONLINE</span></td>
                    <td style="padding:8px;">16-Channel ATE Spatial Grid</td>
                    <td style="padding:8px; font-family:var(--font-mono);">Isolation Depth Score (s &lt; 0.5)</td>
                    <td style="padding:8px;">Tree Depth Average</td>
                    <td style="padding:8px; font-family:var(--font-mono); font-size:10px; color:#64748B;">ee44c12bb900...842</td>
                  </tr>
                  <tr style="border-bottom:1px solid #F1F5F9;">
                    <td style="padding:8px; font-weight:700; color:#123B63;">Multivariate Mahalanobis Distance (D_M)</td>
                    <td style="padding:8px;"><span class="badge" style="background:#EAF4FB; color:#1976B8; font-size:9px;">ACTIVE SUPPORTING</span></td>
                    <td style="padding:8px; font-family:var(--font-mono);">1.0.0</td>
                    <td style="padding:8px;"><span class="badge pass" style="font-size:9px;">ONLINE</span></td>
                    <td style="padding:8px;">3D Canonical (Iddq, Ileak, Tpd) &amp; RMS Z</td>
                    <td style="padding:8px; font-family:var(--font-mono);">D_M Distance (χ²_0.99 = 11.345)</td>
                    <td style="padding:8px;">Covariance Matrix Σ^-1 (Nominal)</td>
                    <td style="padding:8px; font-family:var(--font-mono); font-size:10px; color:#64748B;">b89f0122aa19...771</td>
                  </tr>
                  <tr style="border-bottom:1px solid #F1F5F9;">
                    <td style="padding:8px; font-weight:700; color:#123B63;">Arrhenius / Eyring Physics Engine</td>
                    <td style="padding:8px;"><span class="badge" style="background:#EAF4FB; color:#1976B8; font-size:9px;">ANALYTICAL</span></td>
                    <td style="padding:8px; font-family:var(--font-mono);">3.0.0</td>
                    <td style="padding:8px;"><span class="badge pass" style="font-size:9px;">DETERMINISTIC</span></td>
                    <td style="padding:8px;">Temp (T_j), Voltage (Vdd), Clock Freq</td>
                    <td style="padding:8px; font-family:var(--font-mono);">AF_T, AF_V, MTTF Ratio, ΔVth</td>
                    <td style="padding:8px;">Ea=0.70eV, β=1.5V^-1, n=2.0</td>
                    <td style="padding:8px; font-family:var(--font-mono); font-size:10px; color:#64748B;">77a11bb0982c...999</td>
                  </tr>
                  <tr style="border-bottom:1px solid #F1F5F9;">
                    <td style="padding:8px; font-weight:700; color:#123B63;">Governed Decision Precedence Layer</td>
                    <td style="padding:8px;"><span class="badge pass" style="font-size:9px;">AUTHORITATIVE</span></td>
                    <td style="padding:8px; font-family:var(--font-mono);">2.2.0</td>
                    <td style="padding:8px;"><span class="badge pass" style="font-size:9px;">ACTIVE (Fail-Closed)</span></td>
                    <td style="padding:8px;">5 Independent Verification Streams</td>
                    <td style="padding:8px; font-family:var(--font-mono);">PASS / MONITOR / REJECT</td>
                    <td style="padding:8px;">θ*=0.20 Priority Precedence</td>
                    <td style="padding:8px; font-family:var(--font-mono); font-size:10px; color:#64748B;">55ca9910ba33...442</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ── SUBTAB 2: MODULE A DYNAMIC ANOMALY ANALYSIS ──────────────────────── -->
        <div id="adv-tab-mod-a" class="adv-subtab-content" style="display:none;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
            <div>
              <h3 style="font-size:16px; font-weight:700; color:#123B63; margin:0;">MODULE A — DYNAMIC ANOMALY ANALYSIS</h3>
              <p style="font-size:12px; color:#64748B; margin:2px 0 0 0;">Tri-detector spatial screening &amp; multivariate distance analysis against lot baseline distribution.</p>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:11.5px; color:#475569; font-weight:600;">Inspect Component:</span>
              <select id="adv-mod-a-comp-sel" class="form-control" style="font-size:12px; padding:4px 8px; width:150px;" onchange="window.updateAdvAnomalyView(this.value)">
                <option value="DIE-R20C20" selected>DIE-R20C20 (Outlier)</option>
                <option value="DIE-R15C15">DIE-R15C15 (Nominal)</option>
                <option value="DIE-R05C05">DIE-R05C05 (Marginal)</option>
              </select>
            </div>
          </div>

          <!-- Split Layout: Left Distribution Chart, Right Detector Comparison -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(360px, 1fr)); gap:16px; margin-bottom:16px;">
            <!-- Left: Anomaly Score Distribution Chart with Spacious Padded ViewBox & Zero Clipping -->
            <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:18px; border-radius:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div style="font-size:12px; font-weight:700; color:#123B63;">Population Anomaly Z-Score Distribution (PAT-MAD)</div>
                <div style="font-size:11px; color:#64748B;">N = 256 Dies (Lot-044)</div>
              </div>
              <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; padding:10px;" id="adv-anomaly-dist-chart-container">
                <svg width="100%" height="220" viewBox="0 0 520 220" id="adv-anomaly-dist-svg" style="display:block; overflow:visible;">
                  <!-- Background zones -->
                  <rect x="50" y="30" width="200" height="135" fill="#F0FDF4" opacity="0.85"/>
                  <rect x="250" y="30" width="110" height="135" fill="#FFFBEB" opacity="0.85"/>
                  <rect x="360" y="30" width="120" height="135" fill="#FEF2F2" opacity="0.85"/>
                  
                  <!-- Zone boundary lines -->
                  <line x1="250" y1="30" x2="250" y2="165" stroke="#10B981" stroke-width="1.5" stroke-dasharray="3,3"/>
                  <line x1="360" y1="30" x2="360" y2="165" stroke="#DC2626" stroke-width="1.5" stroke-dasharray="3,3"/>
                  
                  <!-- Zone Labels (Comfortable clearance) -->
                  <text x="150" y="46" font-size="10" fill="#059669" text-anchor="middle" font-weight="700">NOMINAL (|Z| &lt; 3.0)</text>
                  <text x="305" y="46" font-size="10" fill="#D97706" text-anchor="middle" font-weight="700">WARNING</text>
                  <text x="420" y="46" font-size="10" fill="#DC2626" text-anchor="middle" font-weight="700">REJECT (Z ≥ 4.5)</text>

                  <!-- Bell Curve Distribution of Population -->
                  <path d="M 50,165 Q 100,163 130,135 Q 155,55 170,45 Q 185,55 210,135 Q 240,163 290,164 Q 350,165 420,165 L 480,165" fill="none" stroke="#1976B8" stroke-width="2.5"/>
                  
                  <!-- Axes -->
                  <line x1="50" y1="165" x2="480" y2="165" stroke="#64748B" stroke-width="1.2"/>
                  <line x1="50" y1="30" x2="50" y2="165" stroke="#64748B" stroke-width="1.2"/>
                  
                  <!-- Y-Axis Ticks & Title -->
                  <text x="42" y="165" font-size="9" fill="#64748B" text-anchor="end">0</text>
                  <text x="42" y="105" font-size="9" fill="#64748B" text-anchor="end">0.5</text>
                  <text x="42" y="45" font-size="9" fill="#64748B" text-anchor="end">1.0</text>
                  <text x="18" y="100" font-size="9" fill="#64748B" text-anchor="middle" transform="rotate(-90 18 100)">Density</text>
                  
                  <!-- X-Axis Ticks (Spaced clearly above bottom margin) -->
                  <text x="50" y="182" font-size="9.5" fill="#64748B" text-anchor="middle">Z = 0</text>
                  <text x="150" y="182" font-size="9.5" fill="#64748B" text-anchor="middle">1.5</text>
                  <text x="250" y="182" font-size="9.5" fill="#059669" text-anchor="middle" font-weight="700">3.0 (Gate)</text>
                  <text x="360" y="182" font-size="9.5" fill="#DC2626" text-anchor="middle" font-weight="700">4.5</text>
                  <text x="470" y="182" font-size="9.5" fill="#64748B" text-anchor="middle">6.0</text>
                  <text x="265" y="202" font-size="10" fill="#475569" text-anchor="middle" font-weight="600">Standardized Outlier Score (Z-Score)</text>

                  <!-- Selected Component Marker -->
                  <g id="adv-mod-a-marker" transform="translate(385, 0)">
                    <line x1="0" y1="50" x2="0" y2="165" stroke="#DC2626" stroke-width="2"/>
                    <circle cx="0" cy="100" r="5" fill="#DC2626" stroke="#FFFFFF" stroke-width="1.5"/>
                    <rect x="-48" y="60" width="96" height="22" rx="4" fill="#DC2626" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.15))"/>
                    <text x="0" y="75" font-size="9.5" fill="#FFFFFF" text-anchor="middle" font-weight="700" id="adv-mod-a-marker-text">DIE-R20C20 (4.82σ)</text>
                  </g>
                </svg>
              </div>
            </div>

            <!-- Right: 4-Detector Comparison -->
            <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:18px; border-radius:8px;">
              <div style="font-size:12px; font-weight:700; color:#123B63; margin-bottom:10px;">Detector Comparison Summary</div>
              
              <div style="display:flex; flex-direction:column; gap:8px;">
                <!-- Detector 1: PAT-MAD -->
                <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:8px 12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <div style="font-size:11.5px; font-weight:700; color:#123B63;">1. Robust PAT (MAD)</div>
                    <div style="font-size:10px; color:#64748B;">Basis: Median ± 3.0× MAD | Gate: Authoritative</div>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-size:12px; font-family:var(--font-mono); font-weight:700;" id="adv-pat-score">Z = 4.82</div>
                    <span class="badge reject" style="font-size:9px;" id="adv-pat-badge">OUTLIER</span>
                  </div>
                </div>

                <!-- Detector 2: COPOD -->
                <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:8px 12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <div style="font-size:11.5px; font-weight:700; color:#123B63;">2. COPOD Copula Detector</div>
                    <div style="font-size:10px; color:#64748B;">Basis: Empirical Joint CDF Tail Probability</div>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-size:12px; font-family:var(--font-mono); font-weight:700;" id="adv-copod-score">p = 0.0012</div>
                    <span class="badge reject" style="font-size:9px;" id="adv-copod-badge">TAIL OUTLIER</span>
                  </div>
                </div>

                <!-- Detector 3: Isolation Forest -->
                <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:8px 12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <div style="font-size:11.5px; font-weight:700; color:#123B63;">3. Isolation Forest</div>
                    <div style="font-size:10px; color:#64748B;">Basis: Average Tree Path Isolation Depth</div>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-size:12px; font-family:var(--font-mono); font-weight:700;" id="adv-if-score">s = 0.41</div>
                    <span class="badge reject" style="font-size:9px;" id="adv-if-badge">ABNORMAL</span>
                  </div>
                </div>

                <!-- Detector 4: Mahalanobis Distance -->
                <div style="background:#F0FDF4; border:1px solid #BBF7D0; padding:8px 12px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <div style="font-size:11.5px; font-weight:700; color:#166534;">4. Multivariate Mahalanobis (D_M)</div>
                    <div style="font-size:10px; color:#15803D;">Basis: 3D Covariance Matrix | Role: ACTIVE SUPPORTING</div>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-size:12px; font-family:var(--font-mono); font-weight:700; color:#166534;" id="adv-mahal-score">D_M = 14.82</div>
                    <span class="badge reject" style="font-size:9px;" id="adv-mahal-badge">EXCEEDS χ²_0.99</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom: Feature-Level Anomaly Evidence & Lot-Relative Position -->
          <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:18px; border-radius:8px; margin-bottom:20px;">
            <div style="font-size:12px; font-weight:700; color:#123B63; margin-bottom:10px;">Feature-Level Anomaly Attributions &amp; Deviation from Lot Population</div>
            <table class="table-compact" style="width:100%; font-size:11.5px; border-collapse:collapse;">
              <thead>
                <tr style="border-bottom:2px solid #D8E5EF; background:#F8FAFC; color:#123B63; text-align:left;">
                  <th style="padding:6px 8px;">Feature / Parameter</th>
                  <th style="padding:6px 8px;">Observed Value</th>
                  <th style="padding:6px 8px;">Lot Median (Ref)</th>
                  <th style="padding:6px 8px;">Relative Deviation (%)</th>
                  <th style="padding:6px 8px;">Z-Score Shift</th>
                  <th style="padding:6px 8px;">Outlier Contribution</th>
                </tr>
              </thead>
              <tbody id="adv-mod-a-feat-table">
                <tr style="border-bottom:1px solid #F1F5F9;">
                  <td style="padding:6px 8px; font-weight:600;">Gate Leakage Current (Ileak)</td>
                  <td style="padding:6px 8px; font-family:var(--font-mono);">420.5 µA</td>
                  <td style="padding:6px 8px; font-family:var(--font-mono); color:#64748B;">110.2 µA</td>
                  <td style="padding:6px 8px; color:#DC2626; font-weight:700;">+281.6%</td>
                  <td style="padding:6px 8px; font-family:var(--font-mono); color:#DC2626; font-weight:700;">Z = +4.82</td>
                  <td style="padding:6px 8px;"><div style="background:#FEE2E2; border-radius:3px; height:8px; width:92%;"><div style="background:#DC2626; height:8px; width:88%; border-radius:3px;"></div></div></td>
                </tr>
                <tr style="border-bottom:1px solid #F1F5F9;">
                  <td style="padding:6px 8px; font-weight:600;">IDDQ Standby Current</td>
                  <td style="padding:6px 8px; font-family:var(--font-mono);">28.4 µA</td>
                  <td style="padding:6px 8px; font-family:var(--font-mono); color:#64748B;">10.4 µA</td>
                  <td style="padding:6px 8px; color:#DC2626; font-weight:700;">+173.1%</td>
                  <td style="padding:6px 8px; font-family:var(--font-mono); color:#DC2626; font-weight:700;">Z = +3.14</td>
                  <td style="padding:6px 8px;"><div style="background:#FEE2E2; border-radius:3px; height:8px; width:92%;"><div style="background:#DC2626; height:8px; width:64%; border-radius:3px;"></div></div></td>
                </tr>
                <tr style="border-bottom:1px solid #F1F5F9;">
                  <td style="padding:6px 8px; font-weight:600;">Propagation Delay (Tpd)</td>
                  <td style="padding:6px 8px; font-family:var(--font-mono);">14.2 ns</td>
                  <td style="padding:6px 8px; font-family:var(--font-mono); color:#64748B;">11.0 ns</td>
                  <td style="padding:6px 8px; color:#D97706; font-weight:600;">+29.1%</td>
                  <td style="padding:6px 8px; font-family:var(--font-mono); color:#D97706;">Z = +1.89</td>
                  <td style="padding:6px 8px;"><div style="background:#FEF3C7; border-radius:3px; height:8px; width:92%;"><div style="background:#D97706; height:8px; width:35%; border-radius:3px;"></div></div></td>
                </tr>
                <tr style="border-bottom:1px solid #F1F5F9;">
                  <td style="padding:6px 8px; font-weight:600;">Supply Voltage Headroom</td>
                  <td style="padding:6px 8px; font-family:var(--font-mono);">1.18 V</td>
                  <td style="padding:6px 8px; font-family:var(--font-mono); color:#64748B;">1.20 V</td>
                  <td style="padding:6px 8px; color:#059669;">-1.7%</td>
                  <td style="padding:6px 8px; font-family:var(--font-mono); color:#059669;">Z = -0.42</td>
                  <td style="padding:6px 8px;"><div style="background:#E2E8F0; border-radius:3px; height:8px; width:92%;"><div style="background:#94A3B8; height:8px; width:12%; border-radius:3px;"></div></div></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ── SUBTAB 3: MODULE B PROGNOSTICS ───────────────────────────────────── -->
        <div id="adv-tab-mod-b" class="adv-subtab-content" style="display:none;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <div>
              <h3 style="font-size:16px; font-weight:700; color:#123B63; margin:0;">MODULE B — TEMPORAL DEGRADATION &amp; PROGNOSTICS</h3>
              <p style="font-size:12px; color:#64748B; margin:2px 0 0 0;">Gaussian Process Regression 168h trajectory extrapolation from 0h/24h burn-in telemetry checkpoints.</p>
            </div>
            <span class="badge pass" style="font-size:10px; font-weight:700;">ACTIVE PROGNOSTIC ENGINE</span>
          </div>

          <!-- Primary Trajectory Envelope Visual -->
          <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:18px; border-radius:8px; margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <div style="font-size:12px; font-weight:700; color:#123B63;">0h → 168h Degradation Forecast (Gate Leakage Current)</div>
              <div style="display:flex; gap:12px; font-size:11px; align-items:center;">
                <span style="color:#123B63;"><span style="display:inline-block; width:10px; height:10px; background:#123B63; border-radius:50%; margin-right:4px;"></span>Observed (0-24h)</span>
                <span style="color:#0284C7;"><span style="display:inline-block; width:14px; height:2px; background:#0284C7; margin-right:4px; vertical-align:middle;"></span>GPR Forecast (24-168h)</span>
                <span style="color:#93C5FD;"><span style="display:inline-block; width:12px; height:8px; background:#DBEAFE; border:1px solid #93C5FD; margin-right:4px; vertical-align:middle;"></span>95% Uncertainty CI</span>
                <span style="color:#DC2626;"><span style="display:inline-block; width:14px; height:2px; background:#DC2626; margin-right:4px; vertical-align:middle;"></span>Governed Limit (450µA)</span>
              </div>
            </div>

            <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; padding:14px;">
              <svg width="100%" height="200" viewBox="0 0 680 200" style="display:block;">
                <!-- Grid lines -->
                <line x1="60" y1="30" x2="650" y2="30" stroke="#E2E8F0" stroke-width="1"/>
                <line x1="60" y1="70" x2="650" y2="70" stroke="#E2E8F0" stroke-width="1"/>
                <line x1="60" y1="110" x2="650" y2="110" stroke="#E2E8F0" stroke-width="1"/>
                <line x1="60" y1="150" x2="650" y2="150" stroke="#E2E8F0" stroke-width="1"/>

                <!-- Time Checkpoints -->
                <line x1="60" y1="20" x2="60" y2="160" stroke="#CBD5E1" stroke-width="1"/>
                <line x1="144" y1="20" x2="144" y2="160" stroke="#CBD5E1" stroke-width="1"/>
                <line x1="228" y1="20" x2="228" y2="160" stroke="#E2E8F0" stroke-dasharray="2,2"/>
                <line x1="312" y1="20" x2="312" y2="160" stroke="#E2E8F0" stroke-dasharray="2,2"/>
                <line x1="396" y1="20" x2="396" y2="160" stroke="#E2E8F0" stroke-dasharray="2,2"/>
                <line x1="480" y1="20" x2="480" y2="160" stroke="#E2E8F0" stroke-dasharray="2,2"/>
                <line x1="564" y1="20" x2="564" y2="160" stroke="#E2E8F0" stroke-dasharray="2,2"/>
                <line x1="648" y1="20" x2="648" y2="160" stroke="#CBD5E1" stroke-width="1"/>

                <!-- Uncertainty Shaded Envelope -->
                <polygon points="144,120 228,105 312,90 396,70 480,50 564,30 648,15 648,45 564,70 480,95 396,120 312,135 228,145 144,120" fill="#DBEAFE" opacity="0.65"/>

                <!-- Governed Limit Line -->
                <line x1="60" y1="45" x2="650" y2="45" stroke="#DC2626" stroke-width="1.5" stroke-dasharray="4,4"/>
                <text x="645" y="40" font-size="9" fill="#DC2626" text-anchor="end" font-weight="700">SPEC LIMIT: 450 µA</text>

                <!-- Observed Solid Trajectory (0h to 24h) -->
                <polyline points="60,140 144,120" fill="none" stroke="#123B63" stroke-width="2.5"/>
                <circle cx="60" cy="140" r="4.5" fill="#123B63"/>
                <circle cx="144" cy="120" r="4.5" fill="#123B63"/>

                <!-- Forecast Extrapolation (24h to 168h) -->
                <polyline points="144,120 228,125 312,112 396,95 480,72 564,50 648,30" fill="none" stroke="#0284C7" stroke-width="2.5" stroke-dasharray="4,3"/>
                <circle cx="648" cy="30" r="4.5" fill="#0284C7"/>

                <!-- Earliest Limit Crossing Marker (at ~112h) -->
                <line x1="500" y1="20" x2="500" y2="160" stroke="#DC2626" stroke-width="1.5"/>
                <polygon points="500,20 495,12 505,12" fill="#DC2626"/>
                <text x="505" y="15" font-size="9" fill="#DC2626" font-weight="700">t_breach = 112h</text>

                <!-- Axis Labels -->
                <text x="60" y="175" font-size="9" fill="#64748B" text-anchor="middle">0h</text>
                <text x="144" y="175" font-size="9" fill="#123B63" text-anchor="middle" font-weight="700">24h (Origin)</text>
                <text x="228" y="175" font-size="9" fill="#94A3B8" text-anchor="middle">48h</text>
                <text x="312" y="175" font-size="9" fill="#94A3B8" text-anchor="middle">72h</text>
                <text x="396" y="175" font-size="9" fill="#94A3B8" text-anchor="middle">96h</text>
                <text x="480" y="175" font-size="9" fill="#94A3B8" text-anchor="middle">120h</text>
                <text x="564" y="175" font-size="9" fill="#94A3B8" text-anchor="middle">144h</text>
                <text x="648" y="175" font-size="9" fill="#123B63" text-anchor="middle" font-weight="700">168h</text>
              </svg>
            </div>
          </div>

          <!-- Prognostic Metrics Grid -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-bottom:16px;">
            <div class="card" style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:6px;">
              <div style="font-size:10.5px; color:#64748B; font-weight:600;">Degradation Slope (dY/dt)</div>
              <div style="font-size:16px; font-weight:800; color:#DC2626; font-family:var(--font-mono); margin-top:2px;">+2.45 µA/h</div>
              <div style="font-size:10px; color:#64748B; margin-top:2px;">Direction: ACCELERATING</div>
            </div>
            <div class="card" style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:6px;">
              <div style="font-size:10.5px; color:#64748B; font-weight:600;">Earliest Limit Crossing</div>
              <div style="font-size:16px; font-weight:800; color:#DC2626; font-family:var(--font-mono); margin-top:2px;">112.4 Hours</div>
              <div style="font-size:10px; color:#DC2626; font-weight:600; margin-top:2px;">BREACH BEFORE 168H</div>
            </div>
            <div class="card" style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:6px;">
              <div style="font-size:10.5px; color:#64748B; font-weight:600;">Forecast Horizon</div>
              <div style="font-size:16px; font-weight:800; color:#123B63; font-family:var(--font-mono); margin-top:2px;">168.0 Hours</div>
              <div style="font-size:10px; color:#64748B; margin-top:2px;">Standard Qualification</div>
            </div>
            <div class="card" style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:6px;">
              <div style="font-size:10.5px; color:#64748B; font-weight:600;">Uncertainty Coverage</div>
              <div style="font-size:16px; font-weight:800; color:#0284C7; font-family:var(--font-mono); margin-top:2px;">95% Posterior</div>
              <div style="font-size:10px; color:#64748B; margin-top:2px;">GPR Matérn 5/2</div>
            </div>
          </div>

          <!-- Forecast Validation (Predicted vs Observed) -->
          <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:18px; border-radius:8px; margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <div style="font-size:12px; font-weight:700; color:#123B63;">Benchmark Validation: Predicted vs. Observed (Synthetic Evaluation Set)</div>
              <span class="badge" style="background:#FEF3C7; color:#92400E; font-size:9px;">SYNTHETIC DATA ONLY</span>
            </div>
            <table class="table-compact" style="width:100%; font-size:11.5px; border-collapse:collapse; margin-bottom:12px;">
              <thead>
                <tr style="border-bottom:2px solid #D8E5EF; background:#F8FAFC; color:#123B63; text-align:left;">
                  <th style="padding:6px 8px;">Checkpoint Horizon</th>
                  <th style="padding:6px 8px;">GPR Predicted (µA)</th>
                  <th style="padding:6px 8px;">Observed Benchmark (µA)</th>
                  <th style="padding:6px 8px;">Residual Error (Δ)</th>
                  <th style="padding:6px 8px;">Absolute % Error</th>
                  <th style="padding:6px 8px;">Evaluation Status</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom:1px solid #F1F5F9;">
                  <td style="padding:6px 8px; font-weight:600;">96h Midpoint Check</td>
                  <td style="padding:6px 8px; font-family:var(--font-mono);">310.4</td>
                  <td style="padding:6px 8px; font-family:var(--font-mono);">318.2</td>
                  <td style="padding:6px 8px; font-family:var(--font-mono);">-7.8 µA</td>
                  <td style="padding:6px 8px; color:#059669; font-weight:600;">2.45%</td>
                  <td style="padding:6px 8px;"><span class="badge pass" style="font-size:9px;">EVALUATED</span></td>
                </tr>
                <tr style="border-bottom:1px solid #F1F5F9;">
                  <td style="padding:6px 8px; font-weight:600;">168h End-of-Life Horizon</td>
                  <td style="padding:6px 8px; font-family:var(--font-mono);">492.0</td>
                  <td style="padding:6px 8px; font-family:var(--font-mono);">510.2</td>
                  <td style="padding:6px 8px; font-family:var(--font-mono);">-18.2 µA</td>
                  <td style="padding:6px 8px; color:#059669; font-weight:600;">3.57%</td>
                  <td style="padding:6px 8px;"><span class="badge pass" style="font-size:9px;">EVALUATED</span></td>
                </tr>
              </tbody>
            </table>
            <div style="background:#FFFBEB; border:1px solid #FDE68A; border-radius:4px; padding:8px 12px; font-size:11px; color:#78350F;">
              <strong>GOVERNANCE NOTICE:</strong> DATA UNAVAILABLE — NO EXTERNAL/FUTURE GROUND TRUTH IN PRODUCTION. Prognostic curves are synthetic benchmark indicators and do not constitute fab qualification.
            </div>
          </div>
        </div>

        <!-- ── SUBTAB 4: LATENT RISK ASSESSMENT ─────────────────────────────────── -->
        <div id="adv-tab-latent-risk" class="adv-subtab-content" style="display:none;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <div>
              <h3 style="font-size:16px; font-weight:700; color:#123B63; margin:0;">LATENT RISK ASSESSMENT</h3>
              <p style="font-size:12px; color:#64748B; margin:2px 0 0 0;">Supervised XGBoost gradient-boosted decision tree failure probability &amp; feature attribution.</p>
            </div>
            <span class="badge pass" style="font-size:10px; font-weight:700;">AUTHORITATIVE MODEL</span>
          </div>

          <!-- Risk Score & Operating Threshold Gauge -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px; margin-bottom:16px;">
            <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:18px; border-radius:8px;">
              <div style="font-size:12px; font-weight:700; color:#123B63; margin-bottom:8px;">Supervised Failure Probability</div>
              <div style="display:flex; align-items:baseline; gap:10px; margin-bottom:12px;">
                <div style="font-size:32px; font-weight:800; color:#DC2626; font-family:var(--font-mono);" id="adv-latent-risk-val">100.0%</div>
                <span class="badge reject" style="font-size:11px;" id="adv-latent-risk-badge">CRITICAL RISK</span>
              </div>
              <div style="border-top:1px solid #E2E8F0; padding-top:10px; font-size:11.5px; color:#475569;">
                <div><strong>Operating Threshold:</strong> <code style="color:#1976B8; font-weight:700;">θ* = 0.20</code></div>
                <div style="margin-top:4px;"><strong>Gate Rule:</strong> Component quarantined if $P(\text{fail}) \ge \theta^*$.</div>
                <div style="margin-top:4px;"><strong>Calibration State:</strong> <span style="color:#D97706; font-weight:600;">Benchmark Log-Odds (Locked)</span></div>
              </div>
            </div>

            <!-- Feature Importance / SHAP Attributions -->
            <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:18px; border-radius:8px;">
              <div style="font-size:12px; font-weight:700; color:#123B63; margin-bottom:8px;">Global Feature Importance &amp; Attributions</div>
              <div style="display:flex; flex-direction:column; gap:8px;">
                <div>
                  <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:2px;">
                    <span>1. Gate Leakage Current (<code>leakage_current</code>)</span>
                    <strong style="color:#123B63;">34.2%</strong>
                  </div>
                  <div style="background:#E2E8F0; height:6px; border-radius:3px;"><div style="background:#1976B8; width:34.2%; height:6px; border-radius:3px;"></div></div>
                </div>
                <div>
                  <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:2px;">
                    <span>2. Propagation Delay (<code>propagation_delay</code>)</span>
                    <strong style="color:#123B63;">21.8%</strong>
                  </div>
                  <div style="background:#E2E8F0; height:6px; border-radius:3px;"><div style="background:#1976B8; width:21.8%; height:6px; border-radius:3px;"></div></div>
                </div>
                <div>
                  <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:2px;">
                    <span>3. IDDQ Standby Current (<code>iddq_standby</code>)</span>
                    <strong style="color:#123B63;">18.6%</strong>
                  </div>
                  <div style="background:#E2E8F0; height:6px; border-radius:3px;"><div style="background:#1976B8; width:18.6%; height:6px; border-radius:3px;"></div></div>
                </div>
                <div>
                  <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:2px;">
                    <span>4. Voltage Headroom (<code>voltage_headroom</code>)</span>
                    <strong style="color:#123B63;">14.2%</strong>
                  </div>
                  <div style="background:#E2E8F0; height:6px; border-radius:3px;"><div style="background:#1976B8; width:14.2%; height:6px; border-radius:3px;"></div></div>
                </div>
                <div>
                  <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:2px;">
                    <span>5. Thermal Delta (<code>thermal_delta</code>)</span>
                    <strong style="color:#123B63;">9.8%</strong>
                  </div>
                  <div style="background:#E2E8F0; height:6px; border-radius:3px;"><div style="background:#1976B8; width:9.8%; height:6px; border-radius:3px;"></div></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Model Architecture Specifications -->
          <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:18px; border-radius:8px; margin-bottom:20px;">
            <div style="font-size:12px; font-weight:700; color:#123B63; margin-bottom:8px;">Model Architecture &amp; Hyperparameter Configuration</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:10px; font-size:11.5px;">
              <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:8px; border-radius:4px;"><strong>Framework:</strong> Native XGBoost (C++ Core)</div>
              <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:8px; border-radius:4px;"><strong>Objective:</strong> <code>binary:logistic</code></div>
              <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:8px; border-radius:4px;"><strong>Tree Depth:</strong> max_depth = 6</div>
              <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:8px; border-radius:4px;"><strong>Learning Rate:</strong> η = 0.05</div>
              <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:8px; border-radius:4px;"><strong>Total Features:</strong> 28 Engineered Features</div>
              <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:8px; border-radius:4px;"><strong>Artifact SHA-256:</strong> <code>91bb598ae911...d98</code></div>
            </div>
          </div>
        </div>

        <!-- ── SUBTAB 5: PHYSICS EVIDENCE ENGINE ─────────────────────────────────── -->
        <div id="adv-tab-physics" class="adv-subtab-content" style="display:none;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <div>
              <h3 style="font-size:16px; font-weight:700; color:#123B63; margin:0;">PHYSICS &amp; RELIABILITY EVIDENCE</h3>
              <p style="font-size:12px; color:#64748B; margin:2px 0 0 0;">Deterministic semiconductor physics-of-failure equations and thermal/voltage stress sensitivity.</p>
            </div>
            <span class="badge pass" style="font-size:10px; font-weight:700;">ANALYTICAL DETERMINISTIC</span>
          </div>

          <!-- 4 Physics Engineering Equation Cards -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:14px; margin-bottom:16px;">
            <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:16px; border-radius:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <div style="font-size:12px; font-weight:700; color:#123B63;">1. Arrhenius Thermal Acceleration</div>
                <span class="badge pass" style="font-size:9px;">AF = 1.00x @ 25°C</span>
              </div>
              <div style="font-family:var(--font-mono); font-size:11px; background:#F8FAFC; padding:8px; border:1px solid #E2E8F0; border-radius:4px; margin-bottom:6px;">
                AF_T = exp((E_a / k_B) * (1/T_use - 1/T_stress))
              </div>
              <div style="font-size:11px; color:#64748B;">
                E_a = 0.70 eV, k_B = 8.617×10⁻⁵ eV/K. Models chemical reaction rate acceleration under thermal burn-in stress.
              </div>
            </div>

            <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:16px; border-radius:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <div style="font-size:12px; font-weight:700; color:#123B63;">2. Eyring Voltage Stress Acceleration</div>
                <span class="badge pass" style="font-size:9px;">AF = 1.00x @ 1.20V</span>
              </div>
              <div style="font-family:var(--font-mono); font-size:11px; background:#F8FAFC; padding:8px; border:1px solid #E2E8F0; border-radius:4px; margin-bottom:6px;">
                AF_V = exp(β * (V_stress - V_use))
              </div>
              <div style="font-size:11px; color:#64748B;">
                β = 1.50 V⁻¹. Quantifies exponential electric-field acceleration on gate oxide dielectric breakdown.
              </div>
            </div>

            <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:16px; border-radius:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <div style="font-size:12px; font-weight:700; color:#123B63;">3. Black's Electromigration Equation</div>
                <span class="badge pass" style="font-size:9px;">MTTF Margin: Normal</span>
              </div>
              <div style="font-family:var(--font-mono); font-size:11px; background:#F8FAFC; padding:8px; border:1px solid #E2E8F0; border-radius:4px; margin-bottom:6px;">
                MTTF = A * J^(-n) * exp(E_a / (k_B * T))
              </div>
              <div style="font-size:11px; color:#64748B;">
                Current exponent n = 2.0, E_a = 0.90 eV. Predicts metal trace interconnect voiding and electromigration MTTF.
              </div>
            </div>

            <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:16px; border-radius:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <div style="font-size:12px; font-weight:700; color:#123B63;">4. Bias Temperature Instability (BTI)</div>
                <span class="badge pass" style="font-size:9px;">ΔVth Shift: Nominal</span>
              </div>
              <div style="font-family:var(--font-mono); font-size:11px; background:#F8FAFC; padding:8px; border:1px solid #E2E8F0; border-radius:4px; margin-bottom:6px;">
                ΔV_th = A * t^n * exp(V_gs / V_0) * exp(-E_a / (k_B * T))
              </div>
              <div style="font-size:11px; color:#64748B;">
                Time exponent n = 0.16. Predicts sub-threshold PMOS threshold voltage shifts and propagation delay degradation.
              </div>
            </div>
          </div>

          <!-- Thermal Sensitivity Visual (AF vs Temperature) -->
          <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:18px; border-radius:8px; margin-bottom:20px;">
            <div style="font-size:12px; font-weight:700; color:#123B63; margin-bottom:8px;">Arrhenius Acceleration Factor (AF_T) Sensitivity Curve</div>
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; padding:12px;">
              <svg width="100%" height="150" viewBox="0 0 580 150" style="display:block;">
                <line x1="50" y1="20" x2="550" y2="20" stroke="#E2E8F0" stroke-width="1"/>
                <line x1="50" y1="60" x2="550" y2="60" stroke="#E2E8F0" stroke-width="1"/>
                <line x1="50" y1="100" x2="550" y2="100" stroke="#E2E8F0" stroke-width="1"/>
                
                <!-- Exponential Curve -->
                <path d="M 50,130 Q 150,128 250,120 Q 350,100 450,55 Q 500,30 550,20" fill="none" stroke="#DC2626" stroke-width="2.5"/>
                
                <!-- Ticks -->
                <line x1="50" y1="130" x2="550" y2="130" stroke="#64748B" stroke-width="1"/>
                <text x="50" y="145" font-size="9" fill="#64748B" text-anchor="middle">25°C (1x)</text>
                <text x="175" y="145" font-size="9" fill="#64748B" text-anchor="middle">50°C (4.2x)</text>
                <text x="300" y="145" font-size="9" fill="#64748B" text-anchor="middle">75°C (18.4x)</text>
                <text x="425" y="145" font-size="9" fill="#64748B" text-anchor="middle">100°C (68.1x)</text>
                <text x="550" y="145" font-size="9" fill="#64748B" text-anchor="middle">125°C (214x)</text>
                
                <circle cx="50" cy="130" r="4.5" fill="#059669"/>
                <text x="65" y="125" font-size="9" fill="#059669" font-weight="700">T_use (25°C)</text>
              </svg>
            </div>
          </div>
        </div>

        <!-- ── SUBTAB 6: DECISION GOVERNANCE ────────────────────────────────────── -->
        <div id="adv-tab-governance" class="adv-subtab-content" style="display:none;">
          <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:20px; border-radius:8px; margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div>
                <h3 style="font-size:16px; font-weight:700; color:#123B63; margin:0;">DECISION GOVERNANCE</h3>
                <p style="font-size:12px; color:#64748B; margin:2px 0 0 0;">Exposing independent module verdicts and resolving cross-evidence conflicts under fail-closed governance policy rules.</p>
              </div>
              <span class="badge pass" style="font-size:10px; font-weight:700;">FAIL-CLOSED SYNTHESIS</span>
            </div>

            <!-- Agreement Table -->
            <table class="agreement-matrix-table" style="margin-bottom:14px; width:100%;">
              <thead>
                <tr>
                  <th>Evidence Source</th>
                  <th>Core Method</th>
                  <th>Observed Status</th>
                  <th>Quantitative Metric</th>
                  <th>Governed Threshold</th>
                  <th>Precedence Priority</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Module A</strong></td>
                  <td>PAT-MAD / COPOD / IF / D_M</td>
                  <td><span class="badge reject" style="font-size:9px;">OUTLIER</span></td>
                  <td style="font-family:var(--font-mono);">Z = 4.82, D_M = 14.82</td>
                  <td>&lt; 3.0× MAD</td>
                  <td>Priority 1 (Severe Outliers)</td>
                </tr>
                <tr>
                  <td><strong>Module B</strong></td>
                  <td>168h GPR Prognostics</td>
                  <td><span class="badge reject" style="font-size:9px;">LIMIT EXCEEDED</span></td>
                  <td style="font-family:var(--font-mono);">t_breach = 112h</td>
                  <td>&lt; 450.0 µA @ 168h</td>
                  <td>Priority 2 (Wearout Breach)</td>
                </tr>
                <tr>
                  <td><strong>Latent Risk</strong></td>
                  <td>Supervised XGBoost</td>
                  <td><span class="badge reject" style="font-size:9px;">CRITICAL RISK</span></td>
                  <td style="font-family:var(--font-mono); font-weight:700; color:#DC2626;">P = 100.0%</td>
                  <td>θ* = 0.20</td>
                  <td>Priority 3 (Latent Defect)</td>
                </tr>
                <tr>
                  <td><strong>Physics Engine</strong></td>
                  <td>Arrhenius &amp; Black's EM</td>
                  <td><span class="badge warning" style="font-size:9px;">STRESSED</span></td>
                  <td style="font-family:var(--font-mono);">AF = 18.4x</td>
                  <td>T_j &lt; 125°C</td>
                  <td>Priority 4 (Physical Bounds)</td>
                </tr>
                <tr>
                  <td><strong>Data Quality</strong></td>
                  <td>Bounds &amp; Clamping Assertions</td>
                  <td><span class="badge pass" style="font-size:9px;">VALID</span></td>
                  <td style="font-family:var(--font-mono);">16/16 Invariants</td>
                  <td>Strict No-NaN</td>
                  <td>Priority 0 (Gate Precondition)</td>
                </tr>
              </tbody>
            </table>

            <!-- Conflict Handling Alert Box -->
            <div class="conflict-banner">
              <span style="font-size:18px;">⚖️</span>
              <div>
                <strong style="color:#92400E;">Governed Conflict Handling Policy:</strong>
                <div style="font-size:11.5px; color:#78350F; margin-top:2px;">
                  If any single evidence channel triggers <code>REJECT</code> (e.g. XGBoost $P \ge \theta^*$, PAT-MAD $Z \ge 3.0$, or Prognostic Limit Breach), the fail-closed precedence matrix immediately forces final disposition to <code>REJECT</code>, regardless of whether other modules show nominal telemetry.
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── SUBTAB 7: MODEL VALIDATION & SCIENTIFIC EVIDENCE ───────────────── -->
        <div id="adv-tab-validation" class="adv-subtab-content" style="display:none;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
            <div>
              <h3 style="font-size:16px; font-weight:700; color:#123B63; margin:0;">MODEL VALIDATION &amp; SCIENTIFIC EVIDENCE</h3>
              <p style="font-size:12px; color:#64748B; margin:2px 0 0 0;">Validated benchmark results, ablations and decision evidence from the PREDICTA analysis pipeline.</p>
            </div>
            <span class="badge pass" style="font-size:10px; font-weight:700;">AUTHORITATIVE BENCHMARK</span>
          </div>

          <!-- Section 1: Top Benchmark Accuracy & Operational Metrics -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px; margin-bottom:16px;">
            <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:12px; border-radius:6px; border-left:4px solid #059669;">
              <div style="font-size:10.5px; color:#64748B; font-weight:600;">Fail Recall (@ θ*=0.20)</div>
              <div style="font-size:20px; font-weight:800; color:#059669; font-family:var(--font-mono); margin-top:2px;">97.31%</div>
              <div style="font-size:10px; color:#64748B; margin-top:2px;">Target: ≥ 95.0% (PASS)</div>
            </div>
            <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:12px; border-radius:6px; border-left:4px solid #1976B8;">
              <div style="font-size:10.5px; color:#64748B; font-weight:600;">False Positive Rate (FPR)</div>
              <div style="font-size:20px; font-weight:800; color:#1976B8; font-family:var(--font-mono); margin-top:2px;">7.70%</div>
              <div style="font-size:10px; color:#64748B; margin-top:2px;">Target: &lt; 8.0% (PASS)</div>
            </div>
            <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:12px; border-radius:6px; border-left:4px solid #0284C7;">
              <div style="font-size:10.5px; color:#64748B; font-weight:600;">ROC-AUC</div>
              <div style="font-size:20px; font-weight:800; color:#0284C7; font-family:var(--font-mono); margin-top:2px;">0.9901</div>
              <div style="font-size:10px; color:#64748B; margin-top:2px;">Supervised Ensemble</div>
            </div>
            <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:12px; border-radius:6px; border-left:4px solid #0F8B8D;">
              <div style="font-size:10.5px; color:#64748B; font-weight:600;">PR-AUC</div>
              <div style="font-size:20px; font-weight:800; color:#0F8B8D; font-family:var(--font-mono); margin-top:2px;">0.9705</div>
              <div style="font-size:10px; color:#64748B; margin-top:2px;">Precision-Recall Curve</div>
            </div>
            <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:12px; border-radius:6px; border-left:4px solid #D97706;">
              <div style="font-size:10.5px; color:#64748B; font-weight:600;">Predictive Lead Time</div>
              <div style="font-size:20px; font-weight:800; color:#D97706; font-family:var(--font-mono); margin-top:2px;">6.23 Wafers</div>
              <div style="font-size:10px; color:#64748B; margin-top:2px;">144h Early Warning</div>
            </div>
            <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:12px; border-radius:6px; border-left:4px solid #6366F1;">
              <div style="font-size:10.5px; color:#64748B; font-weight:600;">Inference Latency</div>
              <div style="font-size:20px; font-weight:800; color:#6366F1; font-family:var(--font-mono); margin-top:2px;">0.034 ms</div>
              <div style="font-size:10px; color:#64748B; margin-top:2px;">C++ Native Tree Core</div>
            </div>
          </div>

          <!-- Section 2: Provenance & Dataset Validation Lineage -->
          <div class="card" style="background:#F8FAFC; border:1px solid #D8E5EF; padding:12px 16px; border-radius:6px; margin-bottom:16px; font-size:11.5px;">
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:10px;">
              <div><strong style="color:#64748B;">DATA SOURCE:</strong> <div style="font-family:var(--font-mono); color:#123B63;">LATENT-TRAJ-SYN-2026 (10,000 Locked Dies)</div></div>
              <div><strong style="color:#64748B;">VALIDATION TYPE:</strong> <div style="color:#059669; font-weight:700;">Validated Internal Benchmark (Zero Test Leakage)</div></div>
              <div><strong style="color:#64748B;">OPERATING THRESHOLD:</strong> <div style="font-family:var(--font-mono); color:#123B63;">θ* = 0.20 (Fail-Closed)</div></div>
              <div><strong style="color:#64748B;">ARTIFACT PROVENANCE:</strong> <div style="font-family:var(--font-mono); font-size:10.5px; color:#64748B;">SHA: 91bb598ae911...d98</div></div>
            </div>
          </div>

          <!-- Section 3: 6-Configuration Ablation Study -->
          <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:18px; border-radius:8px; margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <div>
                <div style="font-size:13px; font-weight:700; color:#123B63;">6-Configuration Architecture Ablation Study (Phase 16)</div>
                <div style="font-size:11px; color:#64748B;">Evaluating incremental component contributions on held-out test partition (ml/data/processed/test.csv).</div>
              </div>
              <span class="badge pass" style="font-size:9.5px;">PROVENANCE VERIFIED</span>
            </div>

            <div style="overflow-x:auto;">
              <table class="table-compact" style="width:100%; font-size:11px; border-collapse:collapse; margin-bottom:12px;">
                <thead>
                  <tr style="border-bottom:2px solid #D8E5EF; background:#F8FAFC; color:#123B63; text-align:left;">
                    <th style="padding:6px 8px;">Config</th>
                    <th style="padding:6px 8px;">Architecture Layers Active</th>
                    <th style="padding:6px 8px;">Fail Recall</th>
                    <th style="padding:6px 8px;">False Negative Rate (FNR)</th>
                    <th style="padding:6px 8px;">Nominal FPR</th>
                    <th style="padding:6px 8px;">Lead Time (Hours)</th>
                    <th style="padding:6px 8px;">Mission Safety Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom:1px solid #F1F5F9;">
                    <td style="padding:6px 8px; font-weight:700; color:#123B63;">C1</td>
                    <td style="padding:6px 8px;">Static 3σ Limits Only</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono); color:#DC2626; font-weight:700;">18.20%</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono); color:#DC2626;">81.80%</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono);">1.20%</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono);">0.0h</td>
                    <td style="padding:6px 8px;"><span class="badge reject" style="font-size:9px;">HIGH ESCAPE RISK</span></td>
                  </tr>
                  <tr style="border-bottom:1px solid #F1F5F9;">
                    <td style="padding:6px 8px; font-weight:700; color:#123B63;">C2</td>
                    <td style="padding:6px 8px;">Static + Dynamic Anomaly (PAT/COPOD/IF)</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono); color:#D97706; font-weight:700;">76.40%</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono); color:#D97706;">23.60%</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono);">4.50%</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono);">24.0h</td>
                    <td style="padding:6px 8px;"><span class="badge warning" style="font-size:9px;">MODERATE ESCAPE</span></td>
                  </tr>
                  <tr style="border-bottom:1px solid #F1F5F9;">
                    <td style="padding:6px 8px; font-weight:700; color:#123B63;">C3</td>
                    <td style="padding:6px 8px;">C2 + 168h GPR Prognostic Drift Forecaster</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono); color:#1976B8; font-weight:700;">88.50%</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono); color:#1976B8;">11.50%</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono);">5.80%</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono);">96.0h</td>
                    <td style="padding:6px 8px;"><span class="badge pass" style="font-size:9px;">WEAROUT CAPTURED</span></td>
                  </tr>
                  <tr style="border-bottom:1px solid #F1F5F9;">
                    <td style="padding:6px 8px; font-weight:700; color:#123B63;">C4</td>
                    <td style="padding:6px 8px;">C3 + 95% Bayesian Uncertainty Upper Bounds</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono); color:#0284C7; font-weight:700;">93.20%</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono); color:#0284C7;">6.80%</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono);">6.90%</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono);">120.0h</td>
                    <td style="padding:6px 8px;"><span class="badge pass" style="font-size:9px;">UNCERTAINTY BOUNDED</span></td>
                  </tr>
                  <tr style="border-bottom:1px solid #F1F5F9;">
                    <td style="padding:6px 8px; font-weight:700; color:#123B63;">C5</td>
                    <td style="padding:6px 8px;">C4 + Physics Acceleration (Arrhenius / Eyring)</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono); color:#059669; font-weight:700;">95.80%</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono); color:#059669;">4.20%</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono);">7.20%</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono);">144.0h</td>
                    <td style="padding:6px 8px;"><span class="badge pass" style="font-size:9px;">PHYSICALLY CONSISTENT</span></td>
                  </tr>
                  <tr style="border-bottom:1px solid #F1F5F9; background:#F0FDF4;">
                    <td style="padding:6px 8px; font-weight:800; color:#059669;">C6 (Full)</td>
                    <td style="padding:6px 8px; font-weight:700; color:#123B63;">Full PREDICTA Pipeline (Supervised GBDT + Precedence Matrix)</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono); color:#059669; font-weight:800;">97.31%</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono); color:#059669; font-weight:800;">2.69%</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono); font-weight:700;">7.70%</td>
                    <td style="padding:6px 8px; font-family:var(--font-mono); font-weight:700; color:#059669;">144.0h</td>
                    <td style="padding:6px 8px;"><span class="badge pass" style="font-size:9px; font-weight:700;">CHAMPION (ZERO ESCAPES)</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Ablation Recall Progression Visual (SVG) -->
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; padding:10px;">
              <div style="font-size:10.5px; font-weight:700; color:#123B63; margin-bottom:6px;">Fail Recall Gain Across Ablation Stages (C1 → C6)</div>
              <svg width="100%" height="80" viewBox="0 0 620 80" style="display:block;">
                <!-- Grid -->
                <line x1="40" y1="60" x2="600" y2="60" stroke="#CBD5E1" stroke-width="1"/>
                
                <!-- Bars -->
                <!-- C1 -->
                <rect x="50" y="47" width="65" height="13" fill="#EF4444" rx="2"/>
                <text x="82" y="42" font-size="9" font-weight="700" fill="#DC2626" text-anchor="middle">18.2%</text>
                <text x="82" y="73" font-size="9" fill="#64748B" text-anchor="middle">C1 Static</text>

                <!-- C2 -->
                <rect x="145" y="27" width="65" height="33" fill="#F59E0B" rx="2"/>
                <text x="177" y="22" font-size="9" font-weight="700" fill="#D97706" text-anchor="middle">76.4%</text>
                <text x="177" y="73" font-size="9" fill="#64748B" text-anchor="middle">C2 Anomaly</text>

                <!-- C3 -->
                <rect x="240" y="20" width="65" height="40" fill="#3B82F6" rx="2"/>
                <text x="272" y="15" font-size="9" font-weight="700" fill="#1976B8" text-anchor="middle">88.5%</text>
                <text x="272" y="73" font-size="9" fill="#64748B" text-anchor="middle">C3 GPR</text>

                <!-- C4 -->
                <rect x="335" y="15" width="65" height="45" fill="#0284C7" rx="2"/>
                <text x="367" y="11" font-size="9" font-weight="700" fill="#0284C7" text-anchor="middle">93.2%</text>
                <text x="367" y="73" font-size="9" fill="#64748B" text-anchor="middle">C4 Bounds</text>

                <!-- C5 -->
                <rect x="430" y="12" width="65" height="48" fill="#10B981" rx="2"/>
                <text x="462" y="8" font-size="9" font-weight="700" fill="#059669" text-anchor="middle">95.8%</text>
                <text x="462" y="73" font-size="9" fill="#64748B" text-anchor="middle">C5 Physics</text>

                <!-- C6 -->
                <rect x="525" y="9" width="65" height="51" fill="#059669" rx="2"/>
                <text x="557" y="6" font-size="9.5" font-weight="800" fill="#059669" text-anchor="middle">97.31%</text>
                <text x="557" y="73" font-size="9" font-weight="700" fill="#123B63" text-anchor="middle">C6 Full</text>
              </svg>
            </div>
          </div>

          <!-- Section 4: Canonical Scientific Test Cases -->
          <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:18px; border-radius:8px; margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <div style="font-size:13px; font-weight:700; color:#123B63;">Authoritative Canonical Scientific Test Cases (Reproducible Validation)</div>
              <span style="font-size:11px; color:#64748B;">Source: <code>src/evaluation/phase16_canonical_cases.py</code></span>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:12px;">
              <!-- Case A -->
              <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                  <strong style="color:#123B63; font-size:12px;">CASE A — Nominal Screening</strong>
                  <span class="badge pass" style="font-size:9px;">PASS</span>
                </div>
                <div style="font-size:11px; color:#475569; margin-bottom:6px;">Static PASS, Lot NORMAL, Trajectory NORMAL, Prediction SAFE.</div>
                <div style="font-size:10.5px; font-family:var(--font-mono); background:#FFFFFF; padding:6px; border:1px solid #E2E8F0; border-radius:4px; color:#334155;">
                  P(Fail)=0.042 | Z=0.42 | AF=1.00x → Governed Verdict: PASS
                </div>
              </div>

              <!-- Case B -->
              <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                  <strong style="color:#123B63; font-size:12px;">CASE B — Static-Limit Escape</strong>
                  <span class="badge reject" style="font-size:9px;">REJECT</span>
                </div>
                <div style="font-size:11px; color:#475569; margin-bottom:6px;">Static within spec, but Lot OUTLIER (Z=4.82) &amp; Trajectory DEGRADING.</div>
                <div style="font-size:10.5px; font-family:var(--font-mono); background:#FFFFFF; padding:6px; border:1px solid #E2E8F0; border-radius:4px; color:#334155;">
                  P(Fail)=0.884 | Z=4.82 | GPR Breach @ 42h → Governed Verdict: REJECT
                </div>
              </div>

              <!-- Case C -->
              <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                  <strong style="color:#123B63; font-size:12px;">CASE C — Future Failure Wearout</strong>
                  <span class="badge reject" style="font-size:9px;">REJECT</span>
                </div>
                <div style="font-size:11px; color:#475569; margin-bottom:6px;">0h/24h PASS, but subtle non-linear drift breaches limit @ 112h.</div>
                <div style="font-size:10.5px; font-family:var(--font-mono); background:#FFFFFF; padding:6px; border:1px solid #E2E8F0; border-radius:4px; color:#334155;">
                  P(Fail)=0.785 | GPR t_breach=112h → 144h Early Warning REJECT
                </div>
              </div>

              <!-- Case D -->
              <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                  <strong style="color:#123B63; font-size:12px;">CASE D — False Alarm Mitigation</strong>
                  <span class="badge warning" style="font-size:9px;">MONITOR</span>
                </div>
                <div style="font-size:11px; color:#475569; margin-bottom:6px;">Sensor noise elevated, but physics consistent and GBDT risk low.</div>
                <div style="font-size:10.5px; font-family:var(--font-mono); background:#FFFFFF; padding:6px; border:1px solid #E2E8F0; border-radius:4px; color:#334155;">
                  P(Fail)=0.095 | Anomaly ELEVATED | Physics SAFE → Governed MONITOR
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── SUBTAB 8: TRACEABILITY & PROVENANCE ──────────────────────────────── -->
        <div id="adv-tab-traceability" class="adv-subtab-content" style="display:none;">
          <div class="evidence-graph-box" id="technical-evidence-graph-container" style="margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div>
                <h3 style="font-size:16px; font-weight:700; color:#123B63; margin:0;">TRACEABILITY &amp; PROVENANCE</h3>
                <p style="font-size:12px; color:#64748B; margin:2px 0 0 0;">Directed Acyclic Graph (DAG) of forward inference and cryptographic checksum lineage.</p>
              </div>
              <span class="badge" style="background:#EAF4FB; color:#1976B8; font-size:10px; font-weight:700;">CLICK NODE TO INSPECT</span>
            </div>

            <!-- Compact Case Metadata Bar -->
            <div style="background:#FFFFFF; border:1px solid #D8E5EF; padding:10px 14px; border-radius:6px; margin-bottom:12px; font-size:11.5px; display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:8px;">
              <div><strong style="color:#64748B;">CASE ID:</strong> <span style="font-family:var(--font-mono); color:#123B63;">PRED-2026-F6FF9145</span></div>
              <div><strong style="color:#64748B;">COMPONENT:</strong> <span style="font-family:var(--font-mono); color:#123B63;">DIE-R20C20</span></div>
              <div><strong style="color:#64748B;">LOT ID:</strong> <span style="font-family:var(--font-mono); color:#123B63;">LOT-SYN-044</span></div>
              <div><strong style="color:#64748B;">INPUT VERSION:</strong> <span style="font-family:var(--font-mono); color:#123B63;">v2.4.0</span></div>
              <div><strong style="color:#64748B;">MODEL VERSION:</strong> <span style="font-family:var(--font-mono); color:#123B63;">4.0.0 (Rel 2.0)</span></div>
              <div><strong style="color:#64748B;">DECISION:</strong> <span class="badge reject" style="font-size:9px;">REJECT</span></div>
            </div>

            <!-- SVG Directed Graph -->
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; padding:16px; overflow-x:auto;">
              <svg width="780" height="220" viewBox="0 0 780 220" style="display:block; margin:0 auto;" id="svg-evidence-graph">
                <!-- Connectors -->
                <path d="M 110,110 L 160,110" stroke="#94A3B8" stroke-width="2"/>
                <path d="M 260,110 L 310,60" stroke="#94A3B8" stroke-width="2"/>
                <path d="M 260,110 L 310,110" stroke="#94A3B8" stroke-width="2"/>
                <path d="M 260,110 L 310,160" stroke="#94A3B8" stroke-width="2"/>
                <path d="M 420,60 L 470,110" stroke="#94A3B8" stroke-width="2"/>
                <path d="M 420,110 L 470,110" stroke="#94A3B8" stroke-width="2"/>
                <path d="M 420,160 L 470,110" stroke="#94A3B8" stroke-width="2"/>
                <path d="M 570,110 L 620,110" stroke="#94A3B8" stroke-width="2"/>

                <!-- Node 1: ATE Telemetry -->
                <g class="graph-interactive-node" onclick="window.inspectEvidenceGraphNode('telemetry')" style="cursor:pointer;">
                  <rect x="10" y="85" width="100" height="50" rx="6" fill="#FFFFFF" stroke="#1976B8" stroke-width="1.5"/>
                  <text x="60" y="106" font-size="10" font-weight="700" fill="#123B63" text-anchor="middle">ATE Telemetry</text>
                  <text x="60" y="122" font-size="9" fill="#64748B" text-anchor="middle">16 Sensors (0h/24h)</text>
                </g>

                <!-- Node 2: Data Quality -->
                <g class="graph-interactive-node" onclick="window.inspectEvidenceGraphNode('data_quality')" style="cursor:pointer;">
                  <rect x="160" y="85" width="100" height="50" rx="6" fill="#FFFFFF" stroke="#10B981" stroke-width="1.5"/>
                  <text x="210" y="106" font-size="10" font-weight="700" fill="#123B63" text-anchor="middle">Quality Gate</text>
                  <text x="210" y="122" font-size="9" fill="#059669" text-anchor="middle">VALID (No-NaN)</text>
                </g>

                <!-- Node 3: Module A -->
                <g class="graph-interactive-node" onclick="window.inspectEvidenceGraphNode('module_a')" style="cursor:pointer;">
                  <rect x="310" y="35" width="110" height="50" rx="6" fill="#FFFFFF" stroke="#1976B8" stroke-width="1.5"/>
                  <text x="365" y="56" font-size="10" font-weight="700" fill="#123B63" text-anchor="middle">Module A (Outlier)</text>
                  <text x="365" y="72" font-size="9" fill="#64748B" text-anchor="middle">PAT / COPOD / IF</text>
                </g>

                <!-- Node 4: Module B -->
                <g class="graph-interactive-node" onclick="window.inspectEvidenceGraphNode('module_b')" style="cursor:pointer;">
                  <rect x="310" y="85" width="110" height="50" rx="6" fill="#FFFFFF" stroke="#0F8B8D" stroke-width="1.5"/>
                  <text x="365" y="106" font-size="10" font-weight="700" fill="#123B63" text-anchor="middle">Module B (Prognosis)</text>
                  <text x="365" y="122" font-size="9" fill="#64748B" text-anchor="middle">168h GPR Drift</text>
                </g>

                <!-- Node 5: Latent Risk -->
                <g class="graph-interactive-node" onclick="window.inspectEvidenceGraphNode('latent_risk')" style="cursor:pointer;">
                  <rect x="310" y="135" width="110" height="50" rx="6" fill="#FFFFFF" stroke="#D97706" stroke-width="1.5"/>
                  <text x="365" y="156" font-size="10" font-weight="700" fill="#123B63" text-anchor="middle">Latent Risk (XGB)</text>
                  <text x="365" y="172" font-size="9" fill="#64748B" text-anchor="middle">θ* = 0.20 Gate</text>
                </g>

                <!-- Node 6: Precedence Matrix -->
                <g class="graph-interactive-node" onclick="window.inspectEvidenceGraphNode('precedence')" style="cursor:pointer;">
                  <rect x="470" y="85" width="100" height="50" rx="6" fill="#FFFFFF" stroke="#123B63" stroke-width="1.5"/>
                  <text x="520" y="106" font-size="10" font-weight="700" fill="#123B63" text-anchor="middle">Precedence Matrix</text>
                  <text x="520" y="122" font-size="9" fill="#64748B" text-anchor="middle">Fail-Closed Gate</text>
                </g>

                <!-- Node 7: Governed Decision -->
                <g class="graph-interactive-node" onclick="window.inspectEvidenceGraphNode('decision')" style="cursor:pointer;">
                  <rect x="620" y="85" width="100" height="50" rx="6" fill="#FFFFFF" stroke="#DC2626" stroke-width="2"/>
                  <text x="670" y="106" font-size="10" font-weight="800" fill="#DC2626" text-anchor="middle">Governed Verdict</text>
                  <text x="670" y="122" font-size="9" fill="#123B63" text-anchor="middle">REJECT</text>
                </g>
              </svg>
            </div>

            <!-- Node Inspector Drawer -->
            <div class="graph-inspector-card" id="graph-node-inspector-box" style="margin-top:12px; background:#FFFFFF; border:1px solid #D8E5EF; padding:12px; border-radius:6px;">
              <div style="font-weight:700; font-size:12px; color:#123B63; margin-bottom:4px;" id="graph-node-title">Node Inspector: Click any graph node above to inspect its math, inputs, and bounds.</div>
              <div style="font-size:11.5px; color:#475569;" id="graph-node-content">Directed evidence graph enforces strict forward provenance with zero future telemetry leakage into early checkpoints.</div>
            </div>
          </div>

          <!-- Cryptographic Lineage Table -->
          <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:20px; border-radius:8px; margin-bottom:20px;">
            <h3 style="font-size:15px; font-weight:700; color:#123B63; margin:0 0 10px 0;">Cryptographic Artifact Checksums</h3>
            <table class="table-compact" style="width:100%; font-size:11px; border-collapse:collapse;">
              <thead>
                <tr style="border-bottom:2px solid #D8E5EF; background:#F8FAFC; color:#123B63; text-align:left;">
                  <th style="padding:8px;">Artifact Name</th>
                  <th style="padding:8px;">Relative Path</th>
                  <th style="padding:8px;">SHA-256 Checksum</th>
                  <th style="padding:8px;">Gate</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom:1px solid #F1F5F9;">
                  <td style="padding:8px; font-weight:700; color:#123B63;">Production XGBoost Model</td>
                  <td style="padding:8px; font-family:var(--font-mono);">ml/models/production/predicta_xgboost_model.json</td>
                  <td style="padding:8px; font-family:var(--font-mono); color:#1976B8;">91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98</td>
                  <td style="padding:8px;"><span class="badge pass" style="font-size:9px;">LOCKED</span></td>
                </tr>
                <tr style="border-bottom:1px solid #F1F5F9;">
                  <td style="padding:8px; font-weight:700; color:#123B63;">Feature Contract Specification</td>
                  <td style="padding:8px; font-family:var(--font-mono);">ml/data/feature_contract.json</td>
                  <td style="padding:8px; font-family:var(--font-mono); color:#1976B8;">118d6371720822607ea0bece4f6aa2e70390ea66085a676c8c49e83ec42859b9</td>
                  <td style="padding:8px;"><span class="badge pass" style="font-size:9px;">LOCKED</span></td>
                </tr>
                <tr style="border-bottom:1px solid #F1F5F9;">
                  <td style="padding:8px; font-weight:700; color:#123B63;">GPR Prognostic Kernel Artifacts</td>
                  <td style="padding:8px; font-family:var(--font-mono);">ml/models/production/predicta_gpr_kernel_artifacts.json</td>
                  <td style="padding:8px; font-family:var(--font-mono); color:#1976B8;">1d5fd207ecbd8fed31c09c9e0e8f4655b72f2596ba6c9faf421c7d54fd6a3fcf</td>
                  <td style="padding:8px;"><span class="badge pass" style="font-size:9px;">LOCKED</span></td>
                </tr>
                <tr style="border-bottom:1px solid #F1F5F9;">
                  <td style="padding:8px; font-weight:700; color:#123B63;">Conformal Calibration Artifact</td>
                  <td style="padding:8px; font-family:var(--font-mono);">ml/models/production/conformal_calibration_artifacts.json</td>
                  <td style="padding:8px; font-family:var(--font-mono); color:#1976B8;">198eaa50f5af96aa85721f168abc947a6cabfc02d91f77d1a032c343f85e7e7e</td>
                  <td style="padding:8px;"><span class="badge pass" style="font-size:9px;">LOCKED</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ── SUBTAB 9: WHAT-IF SIMULATION WORKBENCH ────────────────────────────── -->
        <div id="adv-tab-simulation" class="adv-subtab-content" style="display:none;">
          <div class="whatif-container" id="whatif-simulator-container">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid #E2E8F0; padding-bottom:10px;">
              <div>
                <h3 style="font-size:16px; font-weight:700; color:#123B63; margin:0;">WHAT-IF RELIABILITY SIMULATOR</h3>
                <p style="font-size:12px; color:#64748B; margin:2px 0 0 0;">Non-mutating sandbox simulation for environmental stress &amp; parameter perturbation analysis.</p>
              </div>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-outline btn-sm" onclick="window.resetWhatIfToBaseline()">↺ Reset Baseline</button>
                <button class="btn btn-outline btn-sm" onclick="window.loadWhatIfStressScenario()">⚡ Apply Stress (+40°C, +15% Vdd)</button>
              </div>
            </div>

            <div class="whatif-layout" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:16px;">
              <!-- Controls Panel -->
              <div class="whatif-controls-panel" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:16px; border-radius:8px;">
                <div style="font-size:12px; font-weight:700; color:#123B63; margin-bottom:12px;">Modify Simulation Parameters</div>
                
                <div class="whatif-slider-group" style="margin-bottom:12px;">
                  <div class="whatif-slider-header" style="display:flex; justify-content:space-between; font-size:11.5px; margin-bottom:4px;"><span>1. Operating Temperature:</span><span class="whatif-slider-val" id="sim-val-temp" style="font-weight:700; color:#1976B8;">25.0 °C</span></div>
                  <input type="range" id="sim-slider-temp" min="20.0" max="125.0" step="5.0" value="25.0" style="width:100%;" oninput="window.handleSimParamChange()">
                </div>

                <div class="whatif-slider-group" style="margin-bottom:12px;">
                  <div class="whatif-slider-header" style="display:flex; justify-content:space-between; font-size:11.5px; margin-bottom:4px;"><span>2. Supply Voltage (Vdd):</span><span class="whatif-slider-val" id="sim-val-vdd" style="font-weight:700; color:#1976B8;">1.20 V</span></div>
                  <input type="range" id="sim-slider-vdd" min="0.80" max="1.80" step="0.05" value="1.20" style="width:100%;" oninput="window.handleSimParamChange()">
                </div>

                <div class="whatif-slider-group" style="margin-bottom:12px;">
                  <div class="whatif-slider-header" style="display:flex; justify-content:space-between; font-size:11.5px; margin-bottom:4px;"><span>3. Gate Leakage Current:</span><span class="whatif-slider-val" id="sim-val-ileak" style="font-weight:700; color:#1976B8;">111.7 µA</span></div>
                  <input type="range" id="sim-slider-ileak" min="50.0" max="500.0" step="10.0" value="111.7" style="width:100%;" oninput="window.handleSimParamChange()">
                </div>

                <div class="whatif-slider-group" style="margin-bottom:12px;">
                  <div class="whatif-slider-header" style="display:flex; justify-content:space-between; font-size:11.5px; margin-bottom:4px;"><span>4. Clock Frequency:</span><span class="whatif-slider-val" id="sim-val-freq" style="font-weight:700; color:#1976B8;">2500 MHz</span></div>
                  <input type="range" id="sim-slider-freq" min="1000" max="3500" step="100" value="2500" style="width:100%;" oninput="window.handleSimParamChange()">
                </div>

                <button class="btn btn-primary btn-sm" style="width:100%; margin-top:8px;" onclick="window.runWhatIfSimulation()">
                  ⚡ Run What-If Simulation
                </button>
              </div>

              <!-- Side-by-Side Comparison Panel -->
              <div class="whatif-comparison-panel" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:16px; border-radius:8px;">
                <div style="font-size:12px; font-weight:700; color:#123B63; margin-bottom:12px;">Base Case vs. Simulated Case</div>
                
                <table style="width:100%; font-size:11.5px; border-collapse:collapse; margin-bottom:14px;">
                  <thead>
                    <tr style="border-bottom:1px solid #E2E8F0; text-align:left; color:#64748B;">
                      <th style="padding:6px;">Metric</th>
                      <th style="padding:6px;">Base Case</th>
                      <th style="padding:6px;">Simulated Case</th>
                      <th style="padding:6px;">Delta Effect</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style="border-bottom:1px solid #F1F5F9;">
                      <td style="padding:6px; font-weight:600;">Governed Disposition</td>
                      <td style="padding:6px;"><span class="badge pass" id="whatif-orig-disp" style="font-size:9px;">PASS</span></td>
                      <td style="padding:6px;"><span class="badge pass" id="sim-res-badge" style="font-size:9px;">PASS</span></td>
                      <td style="padding:6px;"><span class="sim-delta-badge neutral" id="whatif-delta-disp">UNMODIFIED</span></td>
                    </tr>
                    <tr style="border-bottom:1px solid #F1F5F9;">
                      <td style="padding:6px; font-weight:600;">Failure Probability</td>
                      <td style="padding:6px; font-family:var(--font-mono);" id="whatif-orig-prob">8.2%</td>
                      <td style="padding:6px; font-family:var(--font-mono); font-weight:700;" id="sim-res-prob">8.2%</td>
                      <td style="padding:6px;"><span class="sim-delta-badge neutral" id="whatif-delta-prob">+0.0%</span></td>
                    </tr>
                    <tr style="border-bottom:1px solid #F1F5F9;">
                      <td style="padding:6px; font-weight:600;">Arrhenius AF</td>
                      <td style="padding:6px; font-family:var(--font-mono);" id="whatif-orig-af">1.00x</td>
                      <td style="padding:6px; font-family:var(--font-mono); font-weight:700;" id="sim-res-af">1.00x</td>
                      <td style="padding:6px;"><span class="sim-delta-badge neutral" id="whatif-delta-af">+0.00x</span></td>
                    </tr>
                    <tr style="border-bottom:1px solid #F1F5F9;">
                      <td style="padding:6px; font-weight:600;">Module A Status</td>
                      <td style="padding:6px;" id="whatif-orig-anom">NORMAL</td>
                      <td style="padding:6px; font-weight:700;" id="sim-res-anomaly">NORMAL</td>
                      <td style="padding:6px;"><span class="sim-delta-badge neutral" id="whatif-delta-anom">NOMINAL</span></td>
                    </tr>
                  </tbody>
                </table>

                <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:4px; padding:10px; font-size:11.5px; color:#475569;" id="sim-res-rationale">
                  All stress parameters remain within standard operating limits. Canonical ReliabilityCase remains locked and unmodified.
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── SUBTAB 10: REPORTS & AUDIT DOSSIERS ──────────────────────────────── -->
        <div id="adv-tab-reports" class="adv-subtab-content" style="display:none;">
          <div class="card" style="background:#FFFFFF; border:1px solid #D8E5EF; padding:20px; border-radius:8px; margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
              <div>
                <h3 style="font-size:16px; font-weight:700; color:#123B63; margin:0;">RELIABILITY REPORTING</h3>
                <p style="font-size:12px; color:#64748B; margin:2px 0 0 0;">Export certified semiconductor qualification dossiers, wafer lot inspection certificates, and fail-closed evidence packets.</p>
              </div>
              <button class="btn btn-primary btn-sm" onclick="window.generateQualificationReportPDF()">📄 Generate Active Certificate (PDF)</button>
            </div>

            <!-- Report Targets & Summary Cards -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:14px; margin-bottom:16px;">
              <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:14px; border-radius:6px;">
                <div style="font-size:12px; font-weight:700; color:#123B63;">Single-Die Inspection Dossier</div>
                <div style="font-size:11px; color:#64748B; margin:4px 0 8px 0;">Component Certificate with SHA-256 signatures &amp; multi-stream evidence.</div>
                <button class="btn btn-outline btn-sm" style="width:100%; font-size:11px;" onclick="window.generateQualificationReportPDF()">Export Component PDF</button>
              </div>
              <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:14px; border-radius:6px;">
                <div style="font-size:12px; font-weight:700; color:#123B63;">Lot-SYN-044 Qualification Audit</div>
                <div style="font-size:11px; color:#64748B; margin:4px 0 8px 0;">Comprehensive 256-die lot summary dossier with yield statistics.</div>
                <button class="btn btn-outline btn-sm" style="width:100%; font-size:11px;" onclick="window.generateQualificationReportPDF()">Export Lot Audit PDF</button>
              </div>
              <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:14px; border-radius:6px;">
                <div style="font-size:12px; font-weight:700; color:#123B63;">Fail-Closed Governance Evidence Packet</div>
                <div style="font-size:11px; color:#64748B; margin:4px 0 8px 0;">Safety-critical precedence audit trail and SHA-256 manifest JSON.</div>
                <button class="btn btn-outline btn-sm" style="width:100%; font-size:11px;" onclick="alert('Exporting Fail-Closed Governance JSON Evidence Packet...')">Download JSON Packet</button>
              </div>
            </div>

            <!-- Interactive Report Preview Panel -->
            <div style="border:1px solid #E2E8F0; border-radius:6px; padding:14px; background:#F8FAFC;">
              <div style="font-size:11px; font-weight:700; color:#123B63; text-transform:uppercase; margin-bottom:8px;">Active Report Dossier Preview (DIE-R20C20)</div>
              <div style="background:#FFFFFF; border:1px solid #CBD5E1; border-radius:4px; padding:12px; font-size:11px; font-family:var(--font-mono); color:#334155;">
                <div style="font-weight:700; color:#123B63;">PREDICTA-26 QUALIFICATION AUDIT REPORT &bull; DIE-R20C20 &bull; LOT-SYN-044</div>
                <div style="margin-top:4px;">DISPOSITION: <span style="color:#DC2626; font-weight:700;">REJECT (FAIL-CLOSED QUARANTINE)</span> | REASON: XGBoost P(Fail)=100.0% &ge; θ*=0.20 | PAT-MAD Z=4.82</div>
                <div style="margin-top:2px;">EVIDENCE STATUS: 5/5 STREAMS COMPLETE | MODEL SHA: 91bb598ae911...d98 | SIGNED AT: 2026-09-28T22:00:00Z</div>
              </div>
            </div>
          </div>
        </div>

      </section>`;

buildJs = buildJs.substring(0, advStartIdx) + completeAdvancedHtml + buildJs.substring(advEndIdx + '</section>'.length);

fs.writeFileSync(buildJsPath, buildJs, 'utf8');
console.log("✔ Successfully updated build_restored_frontend.js with new Validation tab, corrected Model Registry, and unclipped Graph geometry.");
