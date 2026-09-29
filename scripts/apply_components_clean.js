const fs = require('fs');
const path = require('path');

console.log("=========================================================================");
console.log("REMOVING TIMELINE AND EFFICIENCY FROM COMPONENTS PAGE");
console.log("=========================================================================");

const builderPath = path.join(__dirname, '..', 'build_restored_frontend.js');
let builderCode = fs.readFileSync(builderPath, 'utf8');

const pCompStart = builderCode.indexOf('<section id="page-components"');
const pAdvStart = builderCode.indexOf('<section id="page-advanced"');

if (pCompStart === -1 || pAdvStart === -1) {
  console.error("ERROR: Could not find page-components or page-advanced markers in build_restored_frontend.js");
  process.exit(1);
}

const newComponentsSection = `<!-- ========================================================================= -->
      <!-- PAGE 4: COMPONENTS INVENTORY & INVESTIGATION WORKSPACE                    -->
      <!-- ========================================================================= -->
      <section id="page-components" class="page-view">
        <div id="page-component" class="page-alias" style="display:none;"></div>

        <!-- Clean Compact Page Header -->
        <div class="page-header" style="margin-bottom:20px;">
          <div class="technical-overline" style="font-size:11px; font-weight:700; color:#1976B8; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">POPULATION SURVEILLANCE &amp; INVESTIGATION WORKSPACE</div>
          <h1 class="page-title" style="font-size:22px; color:#123B63; font-weight:700; margin:0 0 4px 0;">Component Parametric Analysis &amp; Investigation Workspace</h1>
          <p class="page-subtitle" style="font-size:13px; color:#475569; margin:0;">Detailed multi-channel reliability dossier, real-time parametric telemetry, and population surveillance ledger.</p>
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

        <!-- 4. ACTIONS & POPULATION LEDGER (Dedicated Investigation Queue + 256-Row Table) -->
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

builderCode = builderCode.substring(0, pCompStart) + newComponentsSection + builderCode.substring(pAdvStart);

fs.writeFileSync(builderPath, builderCode, 'utf8');
console.log("✔ Successfully updated build_restored_frontend.js with clean Components section (Timeline and Efficiency removed).");
