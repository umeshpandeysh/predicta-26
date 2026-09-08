// Global Admin Authentication & Modal Handlers
window.isAdminAuthenticated = (function() {
  try { return sessionStorage.getItem("predicta_admin_auth") === "true"; } catch(e) { return false; }
})();

window.openAdminLoginModal = function openAdminLoginModal() {
  const modal = document.getElementById("admin-login-modal");
  if (modal) {
    modal.style.display = "flex";
    const err = document.getElementById("modal-login-error");
    if (err) err.style.display = "none";
    const u = document.getElementById("modal-username");
    if (u) { u.value = ""; setTimeout(() => u.focus(), 50); }
    const p = document.getElementById("modal-password");
    if (p) p.value = "";
  }
};

window.closeAdminLoginModal = function closeAdminLoginModal() {
  const modal = document.getElementById("admin-login-modal");
  if (modal) modal.style.display = "none";
};

window.getNumericInput = function getNumericInput(id, fallback = null) {
  const el = document.getElementById(id);
  if (!el) return fallback;
  const val = el.value ? el.value.trim() : "";
  if (val === "") return fallback;
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
};

window.resetAdminQualificationWorkflow = function resetAdminQualificationWorkflow() {
  console.log("[PREDICTA ADMIN] Executing resetAdminQualificationWorkflow()...");

  // 1. Reset Application State
  window.currentPrediction = null;
  window.currentResult = null;
  window.lastApiResponse = null;

  // 2. Reset Form Fields explicitly (Text -> "", Numbers -> "0")
  const form = document.getElementById("form-admin-input");
  if (form) {
    form.reset();

    const textInputs = form.querySelectorAll('input[type="text"], input:not([type="number"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])');
    textInputs.forEach(input => { input.value = ""; });

    const numberInputs = form.querySelectorAll('input[type="number"]');
    numberInputs.forEach(input => { input.value = "0"; });

    const textIds = ["adm-in-comp-id", "adm-in-device-id", "adm-in-lot-id", "adm-in-wafer-id", "adm-in-equipment", "adm-in-type"];
    const numIds = ["adm-in-temp", "adm-in-voltage", "adm-in-freq", "adm-in-duration", "adm-in-iddq", "adm-in-leakage", "adm-in-tpd", "adm-in-power"];

    textIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    numIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "0";
    });
  }

  // 3. Reset Result UI View
  const emptyEl = document.getElementById("adm-in-result-empty");
  const contentEl = document.getElementById("adm-in-result-content");
  if (emptyEl) emptyEl.style.display = "block";
  if (contentEl) contentEl.style.display = "none";

  const resId = document.getElementById("adm-in-res-id");
  const resBadge = document.getElementById("adm-in-res-badge");
  const resProb = document.getElementById("adm-in-res-prob");
  const resDecision = document.getElementById("adm-in-res-decision");
  const resState = document.getElementById("adm-in-res-state");
  const resRationale = document.getElementById("adm-in-res-rationale");

  if (resId) resId.textContent = "";
  if (resBadge) { resBadge.textContent = ""; resBadge.className = "badge"; }
  if (resProb) { resProb.textContent = ""; resProb.style.color = ""; }
  if (resDecision) resDecision.textContent = "";
  if (resState) resState.textContent = "";
  if (resRationale) resRationale.textContent = "";

  // 4. Ensure navigation back to Admin Input page
  if (typeof window.switchPage === "function") {
    window.switchPage("page-admin-input");
  }

  // 5. Scroll into view and focus Component ID field
  setTimeout(() => {
    const compInput = document.getElementById("adm-in-comp-id");
    if (compInput) {
      compInput.scrollIntoView({ behavior: "smooth", block: "center" });
      compInput.focus();
    }
  }, 100);
};

window.startNewComponentAnalysis = window.resetAdminQualificationWorkflow;
window.clearAdminForm = window.resetAdminQualificationWorkflow;
window.resetAdminDataEntryForm = window.resetAdminQualificationWorkflow;
window.initAdminInputPortal = function initAdminInputPortal() {
  const form = document.getElementById("form-admin-input");
  if (!form || form._bound) return;
  form._bound = true;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btn-adm-in-submit");

    const compId = document.getElementById("adm-in-comp-id")?.value ? document.getElementById("adm-in-comp-id").value.trim() : "";
    const deviceId = document.getElementById("adm-in-device-id")?.value ? document.getElementById("adm-in-device-id").value.trim() : "";
    const lotId = document.getElementById("adm-in-lot-id")?.value ? document.getElementById("adm-in-lot-id").value.trim() : "";
    const waferId = document.getElementById("adm-in-wafer-id")?.value ? document.getElementById("adm-in-wafer-id").value.trim() : "";
    const equipmentId = document.getElementById("adm-in-equipment")?.value ? document.getElementById("adm-in-equipment").value.trim() : "";
    const compType = document.getElementById("adm-in-type")?.value ? document.getElementById("adm-in-type").value.trim() : "";

    const rawTemp = window.getNumericInput("adm-in-temp");
    const rawVolt = window.getNumericInput("adm-in-voltage");
    const rawFreq = window.getNumericInput("adm-in-freq");
    const rawDuration = window.getNumericInput("adm-in-duration");
    const rawIddq = window.getNumericInput("adm-in-iddq");
    const rawLeak = window.getNumericInput("adm-in-leakage");
    const rawTpd = window.getNumericInput("adm-in-tpd");
    const rawPow = window.getNumericInput("adm-in-power");

    // Validate: Do not silently substitute empty or zero inputs with fake telemetry
    const isMissingText = !compId || !lotId || !equipmentId;
    const isMissingNumbers = rawTemp === null || rawVolt === null || rawFreq === null || rawLeak === null || rawTpd === null || rawPow === null;
    const isZeroNonPhysical = rawVolt <= 0 || rawFreq <= 0 || rawTpd <= 0;

    if (isMissingText || isMissingNumbers || isZeroNonPhysical) {
      alert("Please enter valid qualification telemetry before running analysis.");
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = "⏳ Running XGBoost 150-Tree Inference..."; }

    // Physical telemetry bounded calculations without replacing zero or actual user inputs
    const temp = Math.min(175.0, Math.max(-40.0, rawTemp));
    const vSup = Math.min(3.3, Math.max(0.5, rawVolt));
    const freq = Math.min(10000.0, Math.max(10.0, rawFreq));
    const iLeak = Math.min(5000.0, Math.max(0.0, rawLeak));
    const tPd = Math.min(99.0, Math.max(0.01, rawTpd));
    const pDyn = Math.min(1000.0, Math.max(0.0, rawPow));
    const iddq = Math.min(500.0, Math.max(0.0, rawIddq !== null ? rawIddq : 0.0));

    const setupTime = Math.max(0.1, Number((1.2 * (tPd / 11.5)).toFixed(2)));
    const holdTime = Math.max(0.1, Number((0.8 * (11.5 / Math.max(1.0, tPd))).toFixed(2)));
    const timingMargin = Math.max(0.01, Number((2.0 * (11.5 / Math.max(1.0, tPd))).toFixed(2)));
    const vTh = Math.max(0.1, Number((0.45 - 0.0008 * (temp - 25.0)).toFixed(3)));
    const iCurrent = Math.max(1.0, Number((40.0 * (vSup / 1.2)).toFixed(2)));
    const Rchannel = Math.max(0.1, Number((12.0 * (1.2 / Math.max(0.5, vSup))).toFixed(2)));
    const vOut = Math.max(0.4, Number((vSup - 0.02).toFixed(3)));
    const pTot = Math.min(2000.0, Number((pDyn + (iddq * vSup / 1000.0)).toFixed(2)));

    const record = {
      test_id: `ADM-${compId}-${Date.now().toString().slice(-4)}`,
      lot_id: lotId,
      wafer_id: waferId || "WFR-2026-01",
      equipment_id: equipmentId,
      leakage_current: iLeak,
      temperature: temp,
      propagation_delay: tPd,
      dynamic_power: pDyn,
      supply_voltage: vSup,
      frequency: freq,
      iddq_standby: iddq,
      output_voltage: vOut,
      current: iCurrent,
      resistance: Rchannel,
      capacitance: 4.0,
      threshold_voltage: vTh,
      setup_time: setupTime,
      hold_time: holdTime,
      timing_margin: timingMargin,
      total_power: pTot,
      test_duration: rawDuration ? Math.max(1.0, rawDuration) : 12.0
    };

    try {
      console.log("[PREDICTA ML INFERENCE] Sending dynamic telemetry payload:", record);
      const result = await predictMeasurementRecord(record);
      console.log("[PREDICTA ML INFERENCE] Received live inference response:", result);

      updateQualificationResultUI(result, record);

      if (typeof addPredictionToHistory === "function") addPredictionToHistory(result);
      if (typeof refreshDashboardAnalytics === "function") refreshDashboardAnalytics();
    } catch (err) {
      alert(`Qualification Analysis Error: ${err.message || "Failed to execute inference"}`);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "▶ Run Qualification Analysis"; }
    }
  });

  const resetBtn = document.getElementById("btn-adm-analyze-another");
  if (resetBtn && !resetBtn._bound) {
    resetBtn._bound = true;
    resetBtn.addEventListener("click", () => window.resetAdminQualificationWorkflow());
  }
};

window.updateAdminAuthStateUI = function updateAdminAuthStateUI() {
  const container = document.getElementById("top-right-auth-container") || document.getElementById("btn-admin-login")?.parentNode;
  const navMenu = document.getElementById("topnav-menu");
  let extraNavBtn = document.getElementById("nav-admin-panel");

  if (window.isAdminAuthenticated) {
    if (container) {
      container.innerHTML = `
        <button id="btn-admin-panel" class="btn btn-primary" style="font-size:11px; font-weight:700; padding:6px 14px; background:#1976B8; border-color:#1976B8; color:#FFFFFF; cursor:pointer; display:inline-flex; align-items:center; gap:4px;" onclick="window.switchPage('page-admin-input')">
          🔑 Admin Panel
        </button>
        <button id="btn-admin-logout" class="btn btn-outline" style="font-size:11px; font-weight:700; padding:6px 12px; border-color:#FCA5A5; color:#DC2626; background:#FEF2F2; cursor:pointer; display:inline-flex; align-items:center; gap:4px;" onclick="window.logoutAdmin()">
          Logout
        </button>
      `;
    }
    if (navMenu && !extraNavBtn) {
      const btn = document.createElement("button");
      btn.id = "nav-admin-panel";
      btn.className = "nav-link";
      btn.setAttribute("data-page", "page-admin-input");
      btn.style.color = "#1976B8";
      btn.style.fontWeight = "700";
      btn.textContent = "Admin Panel";
      btn.onclick = () => window.switchPage("page-admin-input");
      navMenu.appendChild(btn);
    } else if (extraNavBtn) {
      extraNavBtn.style.display = "inline-block";
    }
  } else {
    if (container) {
      container.innerHTML = `
        <button id="btn-admin-login" class="btn-admin-header" onclick="window.openAdminLoginModal()" aria-label="Admin Login">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
          <span>Admin Login</span>
        </button>
      `;
    }
    if (extraNavBtn) {
      extraNavBtn.style.display = "none";
    }
  }
};

window.logoutAdmin = function logoutAdmin() {
  window.isAdminAuthenticated = false;
  try { sessionStorage.removeItem("predicta_admin_auth"); } catch(e){}
  window.updateAdminAuthStateUI();
  if (typeof window.switchPage === "function") window.switchPage("page-home");
};

window.submitModalLogin = async function submitModalLogin() {
  const user = (document.getElementById("modal-username")?.value || "").trim();
  const pass = (document.getElementById("modal-password")?.value || "").trim();
  const err = document.getElementById("modal-login-error");
  const btn = document.getElementById("btn-modal-login-submit");

  if (!user || !pass) {
    if (err) {
      err.textContent = "Please enter both User ID and Password.";
      err.style.display = "block";
    }
    return false;
  }

  if (btn) { btn.disabled = true; btn.textContent = "Authenticating..."; }

  try {
    let authRes;
    if (typeof authenticateUser === "function") {
      authRes = await authenticateUser(user, pass);
    } else {
      const isValid = (user === "admin" || user === "admin@predicta.io" || user !== "") && pass === "sih26";
      authRes = { authenticated: isValid, success: isValid, message: isValid ? "OK" : "Invalid User ID or Password" };
    }

    if (authRes && (authRes.authenticated || authRes.success)) {
      window.isAdminAuthenticated = true;
      try { sessionStorage.setItem("predicta_admin_auth", "true"); } catch(e){}
      if (err) err.style.display = "none";
      window.closeAdminLoginModal();
      window.updateAdminAuthStateUI();
      if (typeof window.switchPage === "function") {
        window.switchPage("page-admin-input");
      } else if (typeof switchPage === "function") {
        switchPage("page-admin-input");
      }
    } else {
      if (err) {
        err.textContent = authRes.message || "Invalid User ID or Password. Access denied.";
        err.style.display = "block";
      }
    }
  } catch (e) {
    if (err) {
      err.textContent = "Authentication error. Please check credentials and try again.";
      err.style.display = "block";
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Sign In to Admin Dashboard"; }
  }
  return false;
};

// AIPS Console Frontend Prototype Logic
document.addEventListener("DOMContentLoaded", () => {
  
  // ==========================================
  // 1. MOCK DATA GENERATOR LAYER
  // ==========================================
  const componentPool = [];
  const sessionHistory = [];
  const LOT_ID = "LOT-2026-08-A17";
  
  // Seed random number generator
  let seed = 42;
  function random() {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }
  
  function randomNormal(mean, std) {
    let u = 0, v = 0;
    while(u === 0) u = random();
    while(v === 0) v = random();
    let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return num * std + mean;
  }
  
  // Generate 128 positions inside circular wafer lattice R <= 6.36
  const WAFER_GRID_POSITIONS = [];
  for (let y = 6; y >= -6; y--) {
    for (let x = -6; x <= 6; x++) {
      if (x * x + y * y <= 40.5) {
        WAFER_GRID_POSITIONS.push({ x, y });
      }
    }
  }

  // Generate programmatic components (128 total)
  for (let i = 1; i <= 128; i++) {
    const id = `COMP-${String(i).padStart(5, '0')}`;
    
    // Default normal values
    let iddq_0h = Math.abs(randomNormal(10.0, 1.2));
    let ileak_0h = Math.abs(randomNormal(1.4, 0.1));
    let tpd_0h = Math.abs(randomNormal(120.0, 4.0));
    
    // Normal BTI drift kinetics (t^0.2)
    let iddq_24h = iddq_0h + Math.pow(24, 0.2) * 0.4 + random() * 0.2;
    let ileak_24h = ileak_0h + Math.pow(24, 0.2) * 0.05 + random() * 0.02;
    let tpd_24h = tpd_0h + Math.pow(24, 0.2) * 0.15 + random() * 0.05;
    
    let iddq_96h = iddq_0h + Math.pow(96, 0.2) * 0.4 + random() * 0.3;
    let ileak_96h = ileak_0h + Math.pow(96, 0.2) * 0.05 + random() * 0.04;
    let tpd_96h = tpd_0h + Math.pow(96, 0.2) * 0.15 + random() * 0.1;
    
    let iddq_168h = iddq_0h + Math.pow(168, 0.2) * 0.4 + random() * 0.4;
    let ileak_168h = ileak_0h + Math.pow(168, 0.2) * 0.05 + random() * 0.05;
    let tpd_168h = tpd_0h + Math.pow(168, 0.2) * 0.15 + random() * 0.12;
    
    let anomaly_score = Math.abs(randomNormal(2.5, 1.0));
    let status = "PASS";
    let reason = "Normal degradation kinetics; parameters within lot statistical bounds.";
    let shap = { iddq: 0.25, ileak: 0.35, tpd: 0.40 };
    
    // Inject signature outliers/failures
    if (i === 42) {
      // COMP-00042: High current leakage anomaly + drift slope reject
      iddq_0h = 18.2;
      ileak_0h = 2.4;
      tpd_0h = 122.5;
      
      iddq_24h = 28.5; // Rapid drift
      ileak_24h = 3.6;
      tpd_24h = 123.8;
      
      iddq_96h = 42.1;
      ileak_96h = 4.8;
      tpd_96h = 124.9;
      
      iddq_168h = 56.4;
      ileak_168h = 6.2;
      tpd_168h = 125.8;
      
      anomaly_score = 12.45;
      status = "REJECT";
      reason = "Iddq current exhibits rapid non-linear drift. Predicted 168h value (56.4 µA) exceeds the configured lot limits, indicating a latent dielectric short.";
      shap = { iddq: 0.72, ileak: 0.21, tpd: 0.07 };
    } 
    else if (i === 88) {
      // COMP-00088: Minor outlier current but stable (MONITOR)
      iddq_0h = 15.5;
      ileak_0h = 1.95;
      tpd_0h = 119.8;
      
      iddq_24h = 16.8;
      ileak_24h = 2.05;
      tpd_24h = 120.2;
      
      iddq_96h = 17.9;
      ileak_96h = 2.15;
      tpd_96h = 120.6;
      
      iddq_168h = 18.5;
      ileak_168h = 2.22;
      tpd_168h = 121.0;
      
      anomaly_score = 6.85;
      status = "MONITOR";
      reason = "Quiescent current (Iddq) flagged as an outlier relative to lot median, but drift rate remains sub-linear and stable. Quarantined for validation.";
      shap = { iddq: 0.58, ileak: 0.32, tpd: 0.10 };
    } 
    else if (i === 105) {
      // COMP-00105: Delay outlier and timing failure (REJECT)
      iddq_0h = 9.8;
      ileak_0h = 1.42;
      tpd_0h = 128.5;
      
      iddq_24h = 10.9;
      ileak_24h = 1.48;
      tpd_24h = 132.8; // Significant delay shift
      
      iddq_96h = 12.1;
      ileak_96h = 1.55;
      tpd_96h = 138.4;
      
      iddq_168h = 13.0;
      ileak_168h = 1.61;
      tpd_168h = 142.5;
      
      anomaly_score = 9.12;
      status = "REJECT";
      reason = "Propagation delay drift slope exceeds lot-derived safety limits. Predicted 168h delay (142.5 ns) violates the maximum spacecraft timing specification.";
      shap = { iddq: 0.12, ileak: 0.08, tpd: 0.80 };
    } 
    else if (i === 11) {
      // Minor anomaly score outlier, but stable parameters (MONITOR)
      iddq_0h = 14.1;
      ileak_0h = 1.82;
      tpd_0h = 123.1;
      
      iddq_24h = 15.2;
      ileak_24h = 1.91;
      tpd_24h = 123.8;
      
      iddq_96h = 16.1;
      ileak_96h = 1.98;
      tpd_96h = 124.5;
      
      iddq_168h = 16.8;
      ileak_168h = 2.05;
      tpd_168h = 125.1;
      
      anomaly_score = 5.92;
      status = "MONITOR";
      reason = "Slight multi-parameter deviation. Static specs passed, but joint parameter offset flags lot-level anomaly thresholds.";
      shap = { iddq: 0.44, ileak: 0.38, tpd: 0.18 };
    }
    else if (i === 27) {
      // Step-breakdown model outlier (REJECT)
      iddq_0h = 10.2;
      ileak_0h = 1.45;
      tpd_0h = 119.5;
      
      iddq_24h = 15.2; // Leakage starts creeping
      ileak_24h = 2.02;
      tpd_24h = 120.4;
      
      iddq_96h = 32.5; // Breakdown step at 96h
      ileak_96h = 4.10;
      tpd_96h = 122.1;
      
      iddq_168h = 45.8;
      ileak_168h = 5.80;
      tpd_168h = 123.5;
      
      anomaly_score = 8.84;
      status = "REJECT";
      reason = "Gate oxide breakdown model triggered. Quiescent current shows abnormal exponential acceleration, indicating localized dielectric pinhole shorts.";
      shap = { iddq: 0.65, ileak: 0.25, tpd: 0.10 };
    }
    // HOTSPOT-02 Components in South-West (Q3): COMP-00055, COMP-00062, COMP-00071
    else if (i === 55) {
      // Thermal breakdown & high leakage failure (REJECT)
      iddq_0h = 16.2; ileak_0h = 2.1; tpd_0h = 124.0;
      iddq_24h = 24.8; ileak_24h = 3.2; tpd_24h = 126.1;
      anomaly_score = 8.25; status = "REJECT";
      reason = "Thermal breakdown & localized dielectric leakage short in South-West sector (Q3).";
      shap = { iddq: 0.68, ileak: 0.22, tpd: 0.10 };
    }
    else if (i === 62) {
      // Thermal anomaly (MONITOR)
      iddq_0h = 14.8; ileak_0h = 1.88; tpd_0h = 122.0;
      iddq_24h = 17.5; ileak_24h = 2.12; tpd_24h = 123.0;
      anomaly_score = 5.40; status = "MONITOR";
      reason = "Thermal creep in South-West sector (Q3). Standby current elevated above lot median.";
      shap = { iddq: 0.52, ileak: 0.35, tpd: 0.13 };
    }
    else if (i === 71) {
      // Dielectric leakage outlier (REJECT)
      iddq_0h = 15.8; ileak_0h = 2.05; tpd_0h = 123.5;
      iddq_24h = 23.2; ileak_24h = 2.95; tpd_24h = 125.2;
      anomaly_score = 7.90; status = "REJECT";
      reason = "Dielectric pinhole leakage failure in South-West sector (Q3).";
      shap = { iddq: 0.61, ileak: 0.29, tpd: 0.10 };
    }
    
    // Spatial die coordinates (128 positions mapped onto circular wafer lattice)
    let gridPos = WAFER_GRID_POSITIONS[i - 1] || { x: (i % 11) - 5, y: Math.floor(i / 11) - 5 };
    // Position anomaly components into 2 distinct spatial clusters:
    // Cluster 1 (HOTSPOT-01 in North-East Q1): COMP-00042, COMP-00088, COMP-00105, COMP-00027, COMP-00011
    if (i === 42) gridPos = { x: 4, y: 4 };
    else if (i === 88) gridPos = { x: 4, y: 3 };
    else if (i === 105) gridPos = { x: 5, y: 4 };
    else if (i === 27) gridPos = { x: 5, y: 3 };
    else if (i === 11) gridPos = { x: 3, y: 4 };
    // Cluster 2 (HOTSPOT-02 in South-West Q3): COMP-00055, COMP-00062, COMP-00071
    else if (i === 55) gridPos = { x: -4, y: -4 };
    else if (i === 62) gridPos = { x: -4, y: -3 };
    else if (i === 71) gridPos = { x: -3, y: -4 };

    // Save to pool for WFR-2026-08-01
    componentPool.push({
      id,
      lot_id: LOT_ID,
      wafer_id: "WFR-2026-08-01",
      die_x: gridPos.x,
      die_y: gridPos.y,
      measurements: {
        h0: { iddq: iddq_0h, ileak: ileak_0h, tpd: tpd_0h },
        h24: { iddq: iddq_24h, ileak: ileak_24h, tpd: tpd_24h },
        h96: { iddq: iddq_96h, ileak: ileak_96h, tpd: tpd_96h },
        h168: { iddq: iddq_168h, ileak: ileak_168h, tpd: tpd_168h }
      },
      anomaly_score,
      probability: status === "REJECT" ? (i === 42 ? 0.854 : 0.760) : (status === "MONITOR" ? 0.380 : 0.045),
      predicted_168h: {
        iddq: iddq_24h + Math.pow(144, 0.2) * 0.35 + (i===42 ? 22 : 0.5),
        tpd: tpd_24h + Math.pow(144, 0.2) * 0.12 + (i===105 ? 8 : 0.2)
      },
      drift_slope: {
        iddq: (iddq_24h - iddq_0h) / 24,
        tpd: (tpd_24h - tpd_0h) / 24
      },
      status,
      reason,
      shap
    });
  }

  // Generate Simulated Nominal Wafer (WFR-2026-08-02) with 128 dies
  for (let i = 1; i <= 128; i++) {
    const id = `COMP-N${String(i).padStart(5, '0')}`;
    const gridPos = WAFER_GRID_POSITIONS[i - 1] || { x: (i % 11) - 5, y: Math.floor(i / 11) - 5 };
    let status = "PASS";
    let score = Math.abs(randomNormal(1.8, 0.5));
    let reason = "Nominal manufacturing die. Parameters within baseline variance envelope.";
    let prob = 0.035;

    // Add a minor MONITOR cluster (4 dies near X: -2, Y: 4)
    if (gridPos.x === -2 && gridPos.y === 4) { status = "MONITOR"; score = 4.2; prob = 0.220; reason = "Minor localized current variance in North-West region."; }
    else if (gridPos.x === -2 && gridPos.y === 3) { status = "MONITOR"; score = 4.1; prob = 0.210; reason = "Minor localized current variance in North-West region."; }
    else if (gridPos.x === -3 && gridPos.y === 4) { status = "MONITOR"; score = 4.3; prob = 0.230; reason = "Minor localized current variance in North-West region."; }

    componentPool.push({
      id,
      lot_id: "LOT-2026-08-NOMINAL",
      wafer_id: "WFR-2026-08-02",
      die_x: gridPos.x,
      die_y: gridPos.y,
      measurements: {
        h0: { iddq: 10.1, ileak: 1.38, tpd: 119.5 },
        h24: { iddq: 10.8, ileak: 1.42, tpd: 120.1 },
        h96: { iddq: 11.5, ileak: 1.48, tpd: 120.8 },
        h168: { iddq: 12.0, ileak: 1.52, tpd: 121.3 }
      },
      anomaly_score: score,
      probability: prob,
      predicted_168h: { iddq: 12.0, tpd: 121.3 },
      drift_slope: { iddq: 0.029, tpd: 0.025 },
      status,
      reason,
      shap: { iddq: 0.33, ileak: 0.33, tpd: 0.34 }
    });
  }


  // ==========================================
  // 2. NAVIGATION / ROUTER LAYER
  // ==========================================
  const ROUTE_MAP = {
    "home": "page-home",
    "page-home": "page-home",
    "components": "page-component",
    "page-component": "page-component",
    "admin-input": "page-admin-input",
    "page-admin-input": "page-admin-input",
    "admin": "page-admin-input",
    "page-admin": "page-admin-input",
    "analyze": "page-admin-input",
    "page-analyze": "page-admin-input",
    "module-a": "page-anomaly",
    "page-anomaly": "page-anomaly",
    "module-b": "page-drift",
    "page-drift": "page-drift",
    "decision": "page-decision",
    "page-decision": "page-decision",
    "datasets": "page-datasets",
    "page-datasets": "page-datasets",
    "reports": "page-reports",
    "page-reports": "page-reports",
    "spatial": "page-spatial",
    "page-spatial": "page-spatial"
  };

  function resolveRoute(hash) {
    if (!hash || hash === "#" || hash === "#/") return "page-home";
    const clean = hash.replace(/^#\/?/, "").toLowerCase();
    let target = ROUTE_MAP[clean];
    if (!target) {
      const directEl = document.getElementById(clean);
      target = directEl ? clean : "page-home";
    }
    if ((target === "page-admin-input" || target === "page-admin" || target === "page-analyze") && !window.isAdminAuthenticated) {
      try {
        if (sessionStorage.getItem("predicta_admin_auth") === "true") {
          window.isAdminAuthenticated = true;
          window.updateAdminAuthStateUI();
          return "page-admin-input";
        }
      } catch(e){}
      window.openAdminLoginModal();
      return "page-home";
    }
    return target;
  }

  function switchPage(rawPageId, updateHash = true) {
    const targetPageId = resolveRoute(rawPageId);
    const navLinks = document.querySelectorAll(".nav-link, .nav-dropdown-item");
    const pages = document.querySelectorAll(".page-view");
    
    // Toggle page views
    pages.forEach(p => {
      if (p.id === targetPageId) {
        p.classList.add("active");
      } else {
        p.classList.remove("active");
      }
    });

    // Update nav links active state
    navLinks.forEach(link => {
      const pageAttr = link.getAttribute("data-page");
      if (pageAttr === targetPageId || ROUTE_MAP[pageAttr] === targetPageId) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });

    // Scroll reset to top AFTER page activation
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Update URL hash for browser persistence
    if (updateHash && window.location.hash !== `#${targetPageId}`) {
      try {
        history.pushState(null, "", `#${targetPageId}`);
      } catch (e) {
        // Fallback for strict sandbox iframe environments
      }
    }

    // Close mobile dropdown menu if open
    const menu = document.getElementById("topnav-menu");
    if (menu) menu.classList.remove("mobile-open");

    // Trigger page-specific redraws
    if (targetPageId === "page-component") {
      renderLotTable();
    } else if (targetPageId === "page-admin-input") {
      initAdminInputPortal();
    } else if (targetPageId === "page-anomaly") {
      renderAnomalyDistribution();
      initMLWorkstation();
    } else if (targetPageId === "page-drift") {
      initDriftPage();
    } else if (targetPageId === "page-decision") {
      renderDecisionEngineAudits();
    } else if (targetPageId === "page-reports") {
      refreshDashboardAnalytics();
    } else if (targetPageId === "page-spatial") {
      initSpatialView();
    } else if (targetPageId === "page-admin") {
      initAdminPage();
    }
  }
  window.switchPage = switchPage;

  // Handle browser back/forward and hash changes
  window.addEventListener("popstate", () => {
    switchPage(window.location.hash, false);
  });
  window.addEventListener("hashchange", () => {
    switchPage(window.location.hash, false);
  });

  // Initial startup routing execution: default to Home if no valid hash route is present
  switchPage(window.location.hash, false);

  // Bind top navigation links
  document.querySelectorAll(".nav-link, .nav-dropdown-item").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = link.getAttribute("data-page");
      if (target) switchPage(target);
    });
  });

  // Mobile hamburger menu toggle & click-outside / Escape key listeners
  const mobileToggleBtn = document.getElementById("mobile-menu-toggle");
  const topnavMenu = document.getElementById("topnav-menu");
  if (mobileToggleBtn && topnavMenu) {
    mobileToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      topnavMenu.classList.toggle("mobile-open");
    });
  }

  document.addEventListener("click", (e) => {
    const topnav = document.querySelector(".topnav");
    const menu = document.getElementById("topnav-menu");
    if (topnav && menu && menu.classList.contains("mobile-open")) {
      if (!topnav.contains(e.target)) {
        menu.classList.remove("mobile-open");
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const menu = document.getElementById("topnav-menu");
      if (menu) menu.classList.remove("mobile-open");
    }
  });

  // Brand home link
  const brandHomeLink = document.getElementById("brand-home-link");
  if (brandHomeLink) {
    brandHomeLink.addEventListener("click", () => switchPage("page-home"));
  }

  // Home CTA buttons
  const btnHomeStart = document.getElementById("btn-home-start-screening");
  if (btnHomeStart) {
    btnHomeStart.addEventListener("click", () => switchPage("page-admin-input"));
  }

  const btnHomeComponents = document.getElementById("btn-home-view-components");
  if (btnHomeComponents) {
    btnHomeComponents.addEventListener("click", () => switchPage("page-component"));
  }

  // Home Quick Module Cards
  const homeCardMap = {
    "card-home-component": "page-component",
    "card-home-module-a": "page-anomaly",
    "card-home-module-b": "page-drift",
    "card-home-decision": "page-decision",
    "card-home-datasets": "page-datasets",
    "card-home-reports": "page-reports"
  };
  Object.keys(homeCardMap).forEach(cardId => {
    const cardEl = document.getElementById(cardId);
    if (cardEl) {
      cardEl.addEventListener("click", () => switchPage(homeCardMap[cardId]));
    }
  });


  // ==========================================
  // 3. PAGE 1: OVERVIEW HISTOGRAM DRAWING
  // ==========================================
  function renderOverviewHistograms() {
    drawHistogram("dist-iddq", componentPool.map(c => c.measurements.h24.iddq), 10.2, 24.5, "µA");
    drawHistogram("dist-ileak", componentPool.map(c => c.measurements.h24.ileak), 1.45, 3.12, "µA");
    drawHistogram("dist-tpd", componentPool.map(c => c.measurements.h24.tpd), 120.4, 135.1, "ns");
  }
  
  function drawHistogram(containerId, values, median, threshold, unit) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    
    // Compute basic frequency bins
    const binCount = 18;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const binWidth = range / binCount;
    
    const bins = Array(binCount).fill(0);
    const binIsOutlier = Array(binCount).fill(false);
    
    values.forEach(val => {
      let idx = Math.floor((val - min) / binWidth);
      if (idx >= binCount) idx = binCount - 1;
      if (idx < 0) idx = 0;
      bins[idx]++;
      
      if (val > threshold) {
        binIsOutlier[idx] = true;
      }
    });
    
    const maxFreq = Math.max(...bins);
    
    // Draw histogram columns
    bins.forEach((freq, idx) => {
      const bar = document.createElement("div");
      const pct = (freq / maxFreq) * 100;
      
      bar.style.flex = "1";
      bar.style.height = `${Math.max(5, pct)}%`;
      
      if (binIsOutlier[idx]) {
        bar.style.backgroundColor = "rgba(255, 94, 98, 0.3)";
        bar.style.border = "1px solid var(--critical)";
      } else {
        bar.style.backgroundColor = "rgba(0, 242, 254, 0.15)";
        bar.style.border = "1px solid var(--accent)";
      }
      
      bar.style.borderRadius = "2px";
      bar.title = `Range: ${(min + idx*binWidth).toFixed(2)} - ${(min + (idx+1)*binWidth).toFixed(2)} ${unit} (${freq} components)`;
      
      container.appendChild(bar);
    });
  }

  // Populate overview critical anomalies table
  const anomaliesTableBody = document.getElementById("overview-anomalies-body");
  if (anomaliesTableBody) {
    const criticals = componentPool.filter(c => c.status === "REJECT" || c.status === "MONITOR").slice(0, 5);
    anomaliesTableBody.innerHTML = criticals.map(c => `
      <tr class="row-clickable" data-comp-id="${c.id}">
        <td><strong style="color:var(--accent);">${c.id}</strong></td>
        <td>${c.measurements.h24.iddq.toFixed(2)} µA</td>
        <td>${c.measurements.h24.ileak.toFixed(2)} µA</td>
        <td>${c.measurements.h24.tpd.toFixed(1)} ns</td>
        <td><span style="font-weight:600; color:${c.anomaly_score > 8.5 ? 'var(--critical)' : 'var(--warning)'};">${c.anomaly_score.toFixed(2)}</span></td>
        <td>+${((c.predicted_168h.iddq - c.measurements.h24.iddq)/c.measurements.h24.iddq * 100).toFixed(1)}%</td>
        <td><span class="badge ${c.status.toLowerCase()}">${c.status}</span></td>
      </tr>
    `).join("");
    
    // Add click listeners to rows to redirect to details page
    anomaliesTableBody.querySelectorAll("tr").forEach(row => {
      row.addEventListener("click", () => {
        const id = row.getAttribute("data-comp-id");
        showComponentDetails(id);
      });
    });
  }

  // ==========================================
  // 4. PAGE 2: LOT ANALYSIS & INDEX
  // ==========================================
  const lotTableBody = document.getElementById("lot-table-body");
  const lotSearch = document.getElementById("lot-search");
  const lotFilterStatus = document.getElementById("lot-filter-status");
  const lotFilterAnomaly = document.getElementById("lot-filter-anomaly");
  
  let currentSortCol = "id";
  let currentSortAsc = true;
  
  function renderLotTable() {
    if (!lotTableBody) return;
    
    let filtered = componentPool.filter(c => {
      const matchesSearch = c.id.toLowerCase().includes(lotSearch.value.toLowerCase());
      const matchesStatus = lotFilterStatus.value === "ALL" || c.status === lotFilterStatus.value;
      const matchesAnomaly = lotFilterAnomaly.value === "ALL" ||
        (lotFilterAnomaly.value === "OUTLIER" && c.anomaly_score > 5.0) ||
        (lotFilterAnomaly.value === "NORMAL" && c.anomaly_score <= 5.0);
      return matchesSearch && matchesStatus && matchesAnomaly;
    });
    
    // Sort
    filtered.sort((a, b) => {
      let valA, valB;
      if (currentSortCol === "id") { valA = a.id; valB = b.id; }
      else if (currentSortCol === "iddq") { valA = a.measurements.h24.iddq; valB = b.measurements.h24.iddq; }
      else if (currentSortCol === "ileak") { valA = a.measurements.h24.ileak; valB = b.measurements.h24.ileak; }
      else if (currentSortCol === "tpd") { valA = a.measurements.h24.tpd; valB = b.measurements.h24.tpd; }
      else if (currentSortCol === "score") { valA = a.anomaly_score; valB = b.anomaly_score; }
      else if (currentSortCol === "drift") { valA = (a.predicted_168h.iddq - a.measurements.h24.iddq); valB = (b.predicted_168h.iddq - b.measurements.h24.iddq); }
      else if (currentSortCol === "status") { valA = a.status; valB = b.status; }
      
      if (valA < valB) return currentSortAsc ? -1 : 1;
      if (valA > valB) return currentSortAsc ? 1 : -1;
      return 0;
    });
    
    lotTableBody.innerHTML = filtered.map(c => `
      <tr class="row-clickable" data-comp-id="${c.id}">
        <td><strong>${c.id}</strong></td>
        <td>${c.measurements.h24.iddq.toFixed(2)} µA</td>
        <td>${c.measurements.h24.ileak.toFixed(2)} µA</td>
        <td>${c.measurements.h24.tpd.toFixed(1)} ns</td>
        <td><span style="font-weight:600; color:${c.anomaly_score > 8.5 ? 'var(--critical)' : c.anomaly_score > 5.0 ? 'var(--warning)' : 'var(--text-secondary)'};">${c.anomaly_score.toFixed(2)}</span></td>
        <td>+${((c.predicted_168h.iddq - c.measurements.h24.iddq)/c.measurements.h24.iddq * 100).toFixed(1)}%</td>
        <td><span class="badge ${c.status.toLowerCase()}">${c.status}</span></td>
      </tr>
    `).join("");
    
    // Bind click routing
    lotTableBody.querySelectorAll("tr").forEach(row => {
      row.addEventListener("click", () => {
        const id = row.getAttribute("data-comp-id");
        showComponentDetails(id);
      });
    });
  }
  
  // Sort event handlers
  const sortColumnsMap = {
    "sort-id": "id", "sort-iddq": "iddq", "sort-ileak": "ileak", 
    "sort-tpd": "tpd", "sort-score": "score", "sort-drift": "drift", "sort-status": "status"
  };
  
  Object.keys(sortColumnsMap).forEach(elemId => {
    const el = document.getElementById(elemId);
    if (el) {
      el.addEventListener("click", () => {
        const col = sortColumnsMap[elemId];
        if (currentSortCol === col) {
          currentSortAsc = !currentSortAsc;
        } else {
          currentSortCol = col;
          currentSortAsc = true;
        }
        
        // Update header visual cues
        document.querySelectorAll(".aips-table th").forEach(th => th.style.color = "var(--text-secondary)");
        el.style.color = "var(--accent)";
        
        renderLotTable();
      });
    }
  });
  
  if (lotSearch) lotSearch.addEventListener("input", renderLotTable);
  if (lotFilterStatus) lotFilterStatus.addEventListener("change", renderLotTable);
  if (lotFilterAnomaly) lotFilterAnomaly.addEventListener("change", renderLotTable);
  
  renderLotTable();

  // ==========================================
  // 5. PAGE 3: COMPONENT DETAILED INSPECTOR
  // ==========================================
  const componentSelector = document.getElementById("component-selector");
  const graphParamSelect = document.getElementById("graph-parameter-select");
  
  // Populate dropdown selection list
  if (componentSelector) {
    componentSelector.innerHTML = componentPool.map(c => `
      <option value="${c.id}">${c.id} (${c.status})</option>
    `).join("");
    
    componentSelector.addEventListener("change", () => {
      updateComponentView(componentSelector.value);
    });
  }
  
  if (graphParamSelect) {
    graphParamSelect.addEventListener("change", () => {
      updateComponentView(componentSelector.value);
    });
  }
  
  function showComponentDetails(id, navigate = true) {
    if (navigate) {
      switchPage("page-component");
    }
    
    // Sync dropdown and update metrics
    if (componentSelector) {
      componentSelector.value = id;
    }
    updateComponentView(id);
  }
  
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (componentSelector && componentSelector.value) {
        updateComponentView(componentSelector.value);
      }
    }, 150);
  });
  
  function updateComponentView(id) {
    const comp = componentPool.find(c => c.id === id);
    if (!comp) return;
    
    // Update Decision Engine status indicators
    const dCard = document.getElementById("details-decision-card");
    const dBadge = document.getElementById("details-decision-badge-container");
    const dReason = document.getElementById("details-decision-reason");
    const dTimestamp = document.getElementById("details-timestamp");
    
    if (dCard && dBadge && dReason && dTimestamp) {
      dCard.className = `card decision-card ${comp.status.toLowerCase()}`;
      dBadge.innerHTML = `<span class="badge ${comp.status.toLowerCase()}" style="font-size:14px; padding:6px 16px;">${comp.status}</span>`;
      dReason.textContent = comp.reason;
      dTimestamp.textContent = new Date().toLocaleString();
    }
    
    // Ingest parameter coordinates and draw GPR graph
    const param = graphParamSelect.value;
    drawParamTrendGraph(comp, param);
    
    // Load prediction metrics panel
    const m24h = document.getElementById("pm-val-24h");
    const m168h = document.getElementById("pm-pred-168h");
    const mBounds = document.getElementById("pm-bounds-168h");
    const mDrift = document.getElementById("pm-drift-pct");
    const mSlope = document.getElementById("pm-drift-slope");
    const mLimit = document.getElementById("pm-slope-limit");
    
    const val24h = comp.measurements.h24[param];
    const val0h = comp.measurements.h0[param];
    let pred168h = comp.predicted_168h[param] || comp.measurements.h168[param];
    
    let unit = param === "tpd" ? "ns" : "µA";
    let limit = param === "iddq" ? 24.5 : param === "ileak" ? 3.12 : 135.1;
    let slope = (val24h - val0h) / 24;
    let limitSlope = param === "iddq" ? 0.098 : param === "ileak" ? 0.008 : 0.011;
    
    m24h.textContent = `${val24h.toFixed(2)} ${unit}`;
    m168h.textContent = `${pred168h.toFixed(2)} ${unit}`;
    mBounds.textContent = `[${(pred168h * 0.95).toFixed(2)} - ${(pred168h * 1.05).toFixed(2)}] ${unit}`;
    mDrift.textContent = `+${((pred168h - val24h)/val24h * 100).toFixed(1)}%`;
    mSlope.textContent = `${slope.toFixed(4)} ${unit}/hr`;
    mLimit.textContent = `${limitSlope.toFixed(4)} ${unit}/hr`;
    
    // Update Deterministic Engineering Feature Attribution bar graphs
    const shapContainer = document.getElementById("xai-bars-container");
    if (shapContainer) {
      shapContainer.innerHTML = `
        <div class="attr-row">
          <div class="attr-info">
            <span>Iddq Standby Current</span>
            <strong>${(comp.shap.iddq * 100).toFixed(0)}% contribution</strong>
          </div>
          <div class="attr-bar-container">
            <div class="attr-bar" style="width:${comp.shap.iddq * 100}%; background:linear-gradient(90deg, #3B82F6, var(--accent));"></div>
          </div>
        </div>
        <div class="attr-row">
          <div class="attr-info">
            <span>Gate Oxide Leakage</span>
            <strong>${(comp.shap.ileak * 100).toFixed(0)}% contribution</strong>
          </div>
          <div class="attr-bar-container">
            <div class="attr-bar" style="width:${comp.shap.ileak * 100}%; background:linear-gradient(90deg, #10B981, var(--accent));"></div>
          </div>
        </div>
        <div class="attr-row">
          <div class="attr-info">
            <span>Propagation Delay</span>
            <strong>${(comp.shap.tpd * 100).toFixed(0)}% contribution</strong>
          </div>
          <div class="attr-bar-container">
            <div class="attr-bar" style="width:${comp.shap.tpd * 100}%; background:linear-gradient(90deg, #F59E0B, var(--accent));"></div>
          </div>
        </div>
      `;
    }
  }
  
  function drawParamTrendGraph(comp, param) {
    const svg = document.getElementById("trend-svg");
    if (!svg) return;
    svg.innerHTML = "";
    
    // Determine effective container width
    const container = svg.parentElement;
    let containerWidth = container ? container.clientWidth : 0;
    if (containerWidth <= 0) {
      containerWidth = Math.min(window.innerWidth - 64, 480);
    }
    const width = Math.max(containerWidth, 240);
    const height = 240;
    
    // Set SVG attributes for 100% fluid responsiveness
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    
    const isMobile = width < 480;
    const padding = {
      top: 30,
      right: isMobile ? 36 : 50,
      bottom: 35,
      left: isMobile ? 42 : 55
    };
    
    const x0 = padding.left;
    const x24 = padding.left + (width - padding.left - padding.right) * (24 / 168);
    const x96 = padding.left + (width - padding.left - padding.right) * (96 / 168);
    const x168 = width - padding.right;
    
    // Ingest parameter coordinates
    const y0_val = comp.measurements.h0[param];
    const y24_val = comp.measurements.h24[param];
    const y96_val = comp.measurements.h96[param];
    const y168_val = comp.measurements.h168[param];
    const pred168_val = comp.predicted_168h[param] || y168_val;
    
    // Bounds mapping
    let limit = param === "iddq" ? 24.5 : param === "ileak" ? 3.12 : 135.1;
    let minVal = Math.min(y0_val, y24_val) * 0.8;
    let maxVal = Math.max(y168_val, pred168_val, limit) * 1.1;
    
    function getPercentY(val) {
      let ratio = (val - minVal) / (maxVal - minVal);
      return height - padding.bottom - ratio * (height - padding.top - padding.bottom);
    }
    
    const y0 = getPercentY(y0_val);
    const y24 = getPercentY(y24_val);
    const y96 = getPercentY(y96_val);
    const y168 = getPercentY(y168_val);
    const yPred168 = getPercentY(pred168_val);
    const yLimit = getPercentY(limit);
    
    // Namespace helper for SVGs
    function createSVGElement(tag, attrs) {
      const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
      for (let key in attrs) {
        el.setAttribute(key, attrs[key]);
      }
      return el;
    }
    
    // 1. Draw Grid Lines
    svg.appendChild(createSVGElement("line", { x1: padding.left, y1: padding.top, x2: width - padding.right, y2: padding.top, stroke: "rgba(18,59,99,0.08)", "stroke-width": 1 }));
    svg.appendChild(createSVGElement("line", { x1: padding.left, y1: height - padding.bottom, x2: width - padding.right, y2: height - padding.bottom, stroke: "rgba(18,59,99,0.12)", "stroke-width": 1 }));
    
    // X Axis Labels
    svg.appendChild(createSVGElement("text", { x: x0, y: height - 12, fill: "var(--text-secondary)", "font-size": "10", "text-anchor": "middle" }));
    svg.querySelector("text:last-child").textContent = "0h";
    svg.appendChild(createSVGElement("text", { x: x24, y: height - 12, fill: "var(--text-secondary)", "font-size": "10", "text-anchor": "middle" }));
    svg.querySelector("text:last-child").textContent = "24h";
    svg.appendChild(createSVGElement("text", { x: x96, y: height - 12, fill: "var(--text-secondary)", "font-size": "10", "text-anchor": "middle" }));
    svg.querySelector("text:last-child").textContent = "96h";
    svg.appendChild(createSVGElement("text", { x: x168, y: height - 12, fill: "var(--text-secondary)", "font-size": "10", "text-anchor": "middle" }));
    svg.querySelector("text:last-child").textContent = "168h";
    
    // Y Axis labels
    svg.appendChild(createSVGElement("text", { x: padding.left - 6, y: y0, fill: "var(--text-muted)", "font-size": "10", "text-anchor": "end" }));
    svg.querySelector("text:last-child").textContent = y0_val.toFixed(1);
    svg.appendChild(createSVGElement("text", { x: padding.left - 6, y: y24, fill: "var(--text-muted)", "font-size": "10", "text-anchor": "end" }));
    svg.querySelector("text:last-child").textContent = y24_val.toFixed(1);
    svg.appendChild(createSVGElement("text", { x: padding.left - 6, y: yLimit, fill: "var(--critical)", "font-size": "10", "text-anchor": "end", "font-weight": "600" }));
    svg.querySelector("text:last-child").textContent = limit.toFixed(1);
    
    // 2. Draw Safety Threshold Limit
    svg.appendChild(createSVGElement("line", { x1: padding.left, y1: yLimit, x2: width - padding.right, y2: yLimit, stroke: "var(--critical)", "stroke-width": 1.5, "stroke-dasharray": "3" }));
    svg.appendChild(createSVGElement("text", { x: width - 5, y: yLimit - 4, fill: "var(--critical)", "font-size": "9", "font-weight": "700", "text-anchor": "end" }));
    svg.querySelector("text:last-child").textContent = "Limit";
    
    // 3. Draw Observed Path (0h to 24h)
    svg.appendChild(createSVGElement("line", { x1: x0, y1: y0, x2: x24, y2: y24, stroke: "var(--success)", "stroke-width": 3 }));
    
    // 4. Draw GPR Predicted Path (24h to 168h)
    svg.appendChild(createSVGElement("path", {
      d: `M ${x24} ${y24} Q ${(x24+x168)/2} ${(y24+yPred168)/2 - 5} ${x168} ${yPred168}`,
      stroke: "var(--accent)", "stroke-width": 2, "stroke-dasharray": "4", fill: "none"
    }));
    
    // 5. Draw Confidence Shading Band
    const upperY = getPercentY(pred168_val * 1.05);
    const lowerY = getPercentY(pred168_val * 0.95);
    svg.appendChild(createSVGElement("path", {
      d: `M ${x24} ${y24} Q ${(x24+x168)/2} ${(y24+upperY)/2 - 5} ${x168} ${upperY} L ${x168} ${lowerY} Q ${(x24+x168)/2} ${(y24+lowerY)/2 + 5} ${x24} ${y24} Z`,
      fill: "rgba(0, 242, 254, 0.08)", stroke: "none"
    }));
    
    // 6. Draw Nodes
    // 0h
    svg.appendChild(createSVGElement("circle", { cx: x0, cy: y0, r: 6, fill: "var(--success)", stroke: "var(--bg-main)", "stroke-width": 1.5 }));
    // 24h
    svg.appendChild(createSVGElement("circle", { cx: x24, cy: y24, r: 6, fill: "var(--success)", stroke: "var(--bg-main)", "stroke-width": 1.5 }));
    // 96h (actual if available, otherwise just marker)
    svg.appendChild(createSVGElement("circle", { cx: x96, cy: y96, r: 4, fill: "var(--text-muted)", stroke: "var(--bg-main)", "stroke-width": 1 }));
    // 168h Predicted
    svg.appendChild(createSVGElement("circle", { cx: x168, cy: yPred168, r: 6, fill: "var(--accent)", stroke: "var(--bg-main)", "stroke-width": 1.5 }));
    
    // 7. Value Labels on Nodes
    svg.appendChild(createSVGElement("text", { x: x24, y: y24 - 10, fill: "var(--success)", "font-size": "10", "text-anchor": "middle", "font-weight": "600" }));
    svg.querySelector("text:last-child").textContent = y24_val.toFixed(2);
    
    svg.appendChild(createSVGElement("text", { x: x168, y: yPred168 - 10, fill: "var(--accent)", "font-size": "10", "text-anchor": "middle", "font-weight": "600" }));
    svg.querySelector("text:last-child").textContent = `${pred168_val.toFixed(2)} (pred)`;
  }
  
  // Initialize details page data without overriding initial page routing
  showComponentDetails("COMP-00042", false);

  // ==========================================
  // 6. PAGE 4: ANOMALY SCORING VISUALIZATION
  // ==========================================
  const methodSelect = document.getElementById("method-select-mod-a");
  const activeAlgoName = document.getElementById("active-algo-name");
  
  if (methodSelect) {
    methodSelect.addEventListener("change", () => {
      const val = methodSelect.value;
      if (val === "copod") {
        activeAlgoName.textContent = "COPOD";
      } else if (val === "mad") {
        activeAlgoName.textContent = "Median/MAD";
      } else {
        activeAlgoName.textContent = "Isolation Forest";
      }
      renderAnomalyDistribution();
    });
  }
  
  function renderAnomalyDistribution() {
    const svg = document.getElementById("anomaly-score-svg");
    if (!svg) return;
    svg.innerHTML = "";
    
    const container = svg.parentElement;
    let containerWidth = container ? container.clientWidth : 0;
    if (containerWidth <= 0) {
      containerWidth = Math.min(window.innerWidth - 64, 480);
    }
    const width = Math.max(containerWidth, 240);
    const height = 220;
    
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    
    const padding = { top: 20, right: 25, bottom: 30, left: 35 };
    
    // Draw background grid lines
    function createSVGElement(tag, attrs) {
      const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
      for (let key in attrs) {
        el.setAttribute(key, attrs[key]);
      }
      return el;
    }
    
    // Generate scores histograms
    const bins = Array(15).fill(0);
    componentPool.forEach(c => {
      let score = Math.min(14.9, c.anomaly_score);
      let idx = Math.floor(score);
      bins[idx]++;
    });
    
    const maxFreq = Math.max(...bins);
    const binWidth = (width - padding.left - padding.right) / bins.length;
    const cutOffScore = 8.5;
    
    // Draw histogram columns
    bins.forEach((freq, idx) => {
      const x = padding.left + idx * binWidth;
      const pct = freq / maxFreq;
      const h = pct * (height - padding.top - padding.bottom);
      const y = height - padding.bottom - h;
      
      const isOutlierBin = idx >= Math.floor(cutOffScore);
      
      svg.appendChild(createSVGElement("rect", {
        x: x + 2,
        y: y,
        width: binWidth - 4,
        height: Math.max(2, h),
        fill: isOutlierBin ? "rgba(255, 94, 98, 0.25)" : "rgba(0, 242, 254, 0.15)",
        stroke: isOutlierBin ? "var(--critical)" : "var(--accent)",
        "stroke-width": 1,
        rx: 2
      }));
    });
    
    // Draw Cut-off threshold line
    const xCut = padding.left + cutOffScore * binWidth;
    svg.appendChild(createSVGElement("line", { x1: xCut, y1: padding.top, x2: xCut, y2: height - padding.bottom, stroke: "var(--critical)", "stroke-width": 1.5, "stroke-dasharray": "3" }));
    svg.appendChild(createSVGElement("text", { x: xCut + 5, y: padding.top + 15, fill: "var(--critical)", "font-size": "9", "font-weight": "600" }));
    svg.querySelector("text:last-child").textContent = "Limit Cut-off (8.5)";
    
    // Y-Axis
    svg.appendChild(createSVGElement("line", { x1: padding.left, y1: padding.top, x2: padding.left, y2: height - padding.bottom, stroke: "rgba(255,255,255,0.1)" }));
    svg.appendChild(createSVGElement("text", { x: padding.left - 8, y: padding.top + 5, fill: "var(--text-muted)", "font-size": "9", "text-anchor": "end" }));
    svg.querySelector("text:last-child").textContent = maxFreq;
    svg.appendChild(createSVGElement("text", { x: padding.left - 8, y: height - padding.bottom, fill: "var(--text-muted)", "font-size": "9", "text-anchor": "end" }));
    svg.querySelector("text:last-child").textContent = "0";
    
    // X-Axis
    svg.appendChild(createSVGElement("line", { x1: padding.left, y1: height - padding.bottom, x2: width - padding.right, y2: height - padding.bottom, stroke: "rgba(255,255,255,0.1)" }));
    svg.appendChild(createSVGElement("text", { x: padding.left, y: height - 10, fill: "var(--text-muted)", "font-size": "9", "text-anchor": "middle" }));
    svg.querySelector("text:last-child").textContent = "0";
    svg.appendChild(createSVGElement("text", { x: xCut, y: height - 10, fill: "var(--critical)", "font-size": "9", "text-anchor": "middle", "font-weight": "600" }));
    svg.querySelector("text:last-child").textContent = "8.5";
    svg.appendChild(createSVGElement("text", { x: width - padding.right, y: height - 10, fill: "var(--text-muted)", "font-size": "9", "text-anchor": "middle" }));
    svg.querySelector("text:last-child").textContent = "15";
  }

  // ==========================================
  // 7. PAGE 6: DECISION ENGINE AUDIT LOGS
  // ==========================================
  function renderDecisionEngineAudits() {
    const tbody = document.getElementById("history-table-body");

    // Seed sessionHistory if empty
    if (sessionHistory.length === 0 && typeof componentPool !== "undefined" && componentPool.length > 0) {
      const seed = [
        componentPool.find(c => c.id === "COMP-00001"),
        componentPool.find(c => c.id === "COMP-00088"),
        componentPool.find(c => c.id === "COMP-00042"),
        componentPool.find(c => c.id === "COMP-00105")
      ].filter(Boolean);

      seed.forEach((c, idx) => {
        const isFail = c.status === "REJECT";
        const isMonitor = c.status === "MONITOR";
        sessionHistory.push({
          timestamp: new Date(Date.now() - (idx + 1) * 900000).toLocaleTimeString(),
          test_id: `TEST-${c.id.split("-")[1]}`,
          equipment: "EQP-101",
          prediction: isFail ? "FAIL" : (isMonitor ? "MONITOR" : "PASS"),
          probability: isFail ? 0.78 : (isMonitor ? 0.42 : 0.05),
          risk_level: isFail ? "CRITICAL" : (isMonitor ? "HIGH" : "LOW"),
          operational_decision: isFail ? "QUARANTINE" : (isMonitor ? "SECONDARY_TEST" : "PASS"),
          lifecycle_state: isFail ? "QUARANTINED" : (isMonitor ? "REVIEW_REQUIRED" : "CONFIRMED_PASS")
        });
      });
    }

    let rows = sessionHistory.slice(0, 20).map(h => ({
      timestamp: h.timestamp || new Date().toLocaleTimeString(),
      test_id: h.test_id,
      equipment: h.equipment || h.equipment_id || "EQP-101",
      prediction: h.prediction,
      probability: h.probability,
      risk_level: h.risk_level,
      operational_decision: h.operational_decision || (h.prediction === "FAIL" ? "QUARANTINE" : "PASS"),
      lifecycle_state: h.lifecycle_state || (h.prediction === "FAIL" ? "QUARANTINED" : "PREDICTED")
    }));

    if (tbody) {
      tbody.innerHTML = "";
      rows.forEach(h => {
        const tr = document.createElement("tr");
        const isFail = h.prediction === "FAIL" || h.prediction === "REJECT";
        const predBadge = isFail ? `<span class="badge reject">FAIL</span>` : `<span class="badge pass">PASS</span>`;
        const prob = typeof h.probability === "number" ? `${(h.probability * 100).toFixed(1)}%` : "N/A";
        const stateClass = h.lifecycle_state === "QUARANTINED" ? "reject" : h.lifecycle_state === "REVIEW_REQUIRED" ? "warning" : "pass";
        tr.innerHTML = `
          <td>${h.timestamp}</td>
          <td><strong>${h.test_id}</strong></td>
          <td>${h.equipment}</td>
          <td>${predBadge}</td>
          <td><strong>${prob}</strong></td>
          <td><span class="badge" style="background-color:rgba(255,255,255,0.05);">${h.operational_decision || 'N/A'}</span></td>
          <td><span class="badge ${stateClass}" style="font-size:9px;">${h.lifecycle_state || 'PREDICTED'}</span></td>
        `;
        tbody.appendChild(tr);
      });
    }

    // Update Decision Analytics Bar
    updateDecisionAnalyticsBar(sessionHistory);
  }

  function updateDecisionAnalyticsBar(rows) {
    if (!Array.isArray(rows)) return;
    const total = rows.length;
    const pass = rows.filter(r => r.operational_decision === "PASS" || r.operational_decision === "AUTO_PASS" || r.prediction === "PASS" || r.lifecycle_state === "CONFIRMED_PASS" || r.lifecycle_state === "PREDICTED").length;
    const review = rows.filter(r => r.lifecycle_state === "REVIEW_REQUIRED" || r.operational_decision === "SECONDARY_TEST" || r.prediction === "MONITOR").length;
    const quarantine = rows.filter(r => r.lifecycle_state === "QUARANTINED" || r.operational_decision === "QUARANTINE" || r.prediction === "FAIL" || r.prediction === "REJECT").length;

    const decTotal = document.getElementById("dec-total");
    const decPass = document.getElementById("dec-pass");
    const decReview = document.getElementById("dec-review");
    const decQuarantine = document.getElementById("dec-quarantine");

    if (decTotal) decTotal.textContent = total;
    if (decPass) decPass.textContent = pass;
    if (decReview) decReview.textContent = review;
    if (decQuarantine) decQuarantine.textContent = quarantine;
  }


  // ==========================================
  // 8. COMPONENT CATALOG & SEARCH ENGINE
  // ==========================================
  const componentCatalog = [
    {
      part_number: "SN74LVC1G04",
      manufacturer: "Texas Instruments",
      type: "Digital Logic",
      technology: "CMOS",
      package: "SOT-23",
      datasheet_url: "https://www.ti.com/lit/ds/symlink/sn74lvc1g04.pdf",
      supply_voltage: "1.65V to 5.5V",
      operating_temp: "-40C to 125C",
      leakage: "Ioff = 10 µA max",
      delay: "4.5 ns max at 1.8V",
      reliability: "JEDEC JESD78 Class II latch-up",
      qualification: "TI Reliability Reports active",
      moda: "Calibrates standby supply current limits",
      modb: "Calibrates sub-linear delay degradation kernels",
      relevance: "Calibration baseline for standard logic gates and timing anomalies."
    },
    {
      part_number: "IRF540N",
      manufacturer: "Infineon",
      type: "MOSFET",
      technology: "Silicon N-Channel",
      package: "TO-220",
      datasheet_url: "https://www.infineon.com/dgdl/irf540n.pdf",
      supply_voltage: "Vdss = 100V",
      operating_temp: "-55C to 175C",
      leakage: "Igss = 100 nA max",
      delay: "not_applicable",
      reliability: "HTOL / High Temperature Gate Bias",
      qualification: "HTGB, HTRB",
      moda: "Calibrates gate-leakage outlier models",
      modb: "Calibrates threshold shift under gate stress",
      relevance: "Calibrates power discrete transistor wear-out curves."
    },
    {
      part_number: "UT54ACS04",
      manufacturer: "CAES / Cobham",
      type: "Space Grade Logic",
      technology: "Rad-Hard CMOS",
      package: "Ceramic Flatpack",
      datasheet_url: "https://www.cobhamaes.com/datasheets/ut54acs04.pdf",
      supply_voltage: "4.5V to 5.5V",
      operating_temp: "-55C to 125C",
      leakage: "Ioz = 1 µA max",
      delay: "tpd = 6.5 ns max",
      reliability: "MIL-PRF-38535 Class V space qualification",
      qualification: "DLA QML Q and V certification",
      moda: "Models lot-level variance of Class V space lots",
      modb: "Calibrates timing margins under radiation/thermal aging",
      relevance: "Target logic standard representing actual space flight hardware."
    }
  ];

  const catalogTableBody = document.getElementById("catalog-table-body");
  const catalogSearchInput = document.getElementById("catalog-search");
  const catalogDetailCard = document.getElementById("catalog-detail-card");
  const catCloseBtn = document.getElementById("cat-close-btn");

  function renderComponentCatalog() {
    if (!catalogTableBody) return;
    
    const query = catalogSearchInput ? catalogSearchInput.value.toLowerCase() : "";
    
    const filtered = componentCatalog.filter(c => 
      c.part_number.toLowerCase().includes(query) ||
      c.manufacturer.toLowerCase().includes(query) ||
      c.type.toLowerCase().includes(query) ||
      c.relevance.toLowerCase().includes(query)
    );
    
    catalogTableBody.innerHTML = filtered.map(c => `
      <tr class="row-clickable" data-part="${c.part_number}">
        <td><strong style="color:var(--accent);">${c.part_number}</strong></td>
        <td>${c.manufacturer}</td>
        <td>${c.type}</td>
        <td>${c.supply_voltage}</td>
        <td>${c.leakage}</td>
        <td>${c.delay}</td>
        <td><span style="font-size:11px; color:var(--text-secondary);">${c.relevance}</span></td>
      </tr>
    `).join("");
    
    // Bind click events on rows
    catalogTableBody.querySelectorAll("tr").forEach(row => {
      row.addEventListener("click", () => {
        const part = row.getAttribute("data-part");
        showCatalogDetails(part);
      });
    });
  }

  function showCatalogDetails(partNumber) {
    const c = componentCatalog.find(item => item.part_number === partNumber);
    if (!c || !catalogDetailCard) return;
    
    document.getElementById("cat-part-number").textContent = `${c.part_number} Detailed Specifications`;
    document.getElementById("cat-manufacturer").textContent = c.manufacturer;
    document.getElementById("cat-type").textContent = c.type;
    document.getElementById("cat-technology").textContent = c.technology;
    document.getElementById("cat-package").textContent = c.package;
    document.getElementById("cat-temp").textContent = c.operating_temp;
    
    const urlLink = document.getElementById("cat-url");
    if (urlLink) {
      urlLink.href = c.datasheet_url;
      urlLink.textContent = c.datasheet_url;
    }
    
    document.getElementById("cat-reliability").textContent = c.reliability;
    document.getElementById("cat-qualification").textContent = c.qualification;
    document.getElementById("cat-moda").textContent = c.moda;
    document.getElementById("cat-modb").textContent = c.modb;
    
    catalogDetailCard.style.display = "block";
  }

  if (catalogSearchInput) {
    catalogSearchInput.addEventListener("input", renderComponentCatalog);
  }
  
  if (catCloseBtn && catalogDetailCard) {
    catCloseBtn.addEventListener("click", () => {
      catalogDetailCard.style.display = "none";
    });
  }
  
  const methodDesc = document.getElementById("method-desc-mod-a");
  
  if (methodSelect && methodDesc && activeAlgoName) {
    methodSelect.addEventListener("change", () => {
      const val = methodSelect.value;
      if (val === "iforest") {
        activeAlgoName.textContent = "Isolation Forest";
        methodDesc.innerHTML = "<strong>Isolation Forest:</strong> Ingests robust lot-relative Z-scores, constructing isolation trees to segregate anomalous multi-parameter components.";
      } else if (val === "mad") {
        activeAlgoName.textContent = "Robust MAD";
        methodDesc.innerHTML = "<strong>Robust MAD:</strong> AEC-Q001 statistical baseline that flags components exceeding Median +/- 6 * MAD limits per parameter.";
      } else if (val === "copod") {
        activeAlgoName.textContent = "COPOD";
        methodDesc.innerHTML = "<strong>COPOD:</strong> Computes empirical cumulative distribution functions (ECDFs) individually and evaluates joint tail probability density.";
      }
    });
  }

  // Fetch actual synthetic dataset metadata if available
  fetch("data/sample/lot_summary.json")
    .then(res => res.json())
    .then(summary => {
      const countEl = document.getElementById("syn-sample-count");
      const statusEl = document.getElementById("syn-status-badge");
      if (countEl && summary.components_count) {
        countEl.textContent = `${summary.components_count.toLocaleString()} Components (${summary.lots_count} Lots)`;
      }
      if (statusEl && summary.version) {
        statusEl.textContent = `Validated (${summary.version})`;
      }
    })
    .catch(err => {
      console.log("Could not load dynamic lot_summary.json metadata. Using local generator defaults.", err);
    });

  // ==========================================
  // DAY 11: PREDICTA ML INFERENCE WORKSTATION CONTROLLER
  // ==========================================

  async function updateMLHealthStatus() {
    try {
      const health = await checkMLAPIHealth();
      const isOnline = health.status === "ok";
      const dotColor = isOnline ? "#10b981" : "#ff5e62";
      const statusText = isOnline ? "SYSTEM ACTIVE" : "LOCAL MODE ACTIVE";
      const headerText = isOnline ? "SYSTEM ACTIVE" : "LOCAL MODE ACTIVE";

      const topnavText = document.getElementById("topnav-status-text");
      const sDot = document.getElementById("ml-sidebar-dot");
      const sText = document.getElementById("ml-sidebar-text");
      const hDot = document.getElementById("ml-header-dot");
      const hText = document.getElementById("ml-engine-status-text");

      if (topnavText) topnavText.textContent = headerText;
      if (sDot) sDot.style.backgroundColor = dotColor;
      if (sText) sText.textContent = statusText;
      if (hDot) hDot.style.backgroundColor = dotColor;
      if (hText) hText.textContent = headerText;
    } catch (err) {
      console.warn("Could not query ML health status:", err);
    }
  }

  async function refreshDashboardAnalytics() {
    try {
      const [summary, recent] = await Promise.all([
        fetchDashboardSummary(),
        fetchRecentPredictions()
      ]);

      if (summary && summary.total_runs > 0) {
        const totalEl = document.getElementById("kpi-total-tested");
        const passEl = document.getElementById("kpi-confirmed-pass");
        const failEl = document.getElementById("kpi-confirmed-fail");
        const rateEl = document.getElementById("kpi-fail-rate");
        const avgProbEl = document.getElementById("kpi-avg-probability");

        if (totalEl) totalEl.textContent = summary.total_runs;
        if (passEl) passEl.textContent = summary.pass_count;
        if (failEl) failEl.textContent = summary.fail_count;
        if (rateEl) rateEl.textContent = `${summary.fail_rate.toFixed(1)}%`;
        if (avgProbEl) avgProbEl.textContent = `${(summary.average_probability * 100).toFixed(1)}%`;
      } else {
        const pool = typeof componentPool !== "undefined" ? componentPool : [];
        const items = sessionHistory.length > 0 ? sessionHistory : pool.map(c => ({
          prediction: c.status === "REJECT" ? "FAIL" : "PASS",
          probability: c.status === "REJECT" ? 0.78 : (c.status === "MONITOR" ? 0.42 : 0.05)
        }));
        const totalRuns = items.length;
        const failCount = items.filter(i => i.prediction === "FAIL" || i.prediction === "REJECT").length;
        const passCount = totalRuns - failCount;
        const failRate = totalRuns > 0 ? (failCount / totalRuns) * 100 : 0;
        const sumProb = items.reduce((acc, i) => acc + (typeof i.probability === "number" ? i.probability : 0), 0);
        const avgProb = totalRuns > 0 ? (sumProb / totalRuns) * 100 : 0;

        const totalEl = document.getElementById("kpi-total-tested");
        const passEl = document.getElementById("kpi-confirmed-pass");
        const failEl = document.getElementById("kpi-confirmed-fail");
        const rateEl = document.getElementById("kpi-fail-rate");
        const avgProbEl = document.getElementById("kpi-avg-probability");

        if (totalEl) totalEl.textContent = totalRuns;
        if (passEl) passEl.textContent = passCount;
        if (failEl) failEl.textContent = failCount;
        if (rateEl) rateEl.textContent = `${failRate.toFixed(1)}%`;
        if (avgProbEl) avgProbEl.textContent = `${avgProb.toFixed(1)}%`;
      }

      if (Array.isArray(recent) && recent.length > 0) {
        const tbody = document.getElementById("history-table-body");
        if (tbody) {
          tbody.innerHTML = "";
          recent.slice(0, 10).forEach(h => {
            const tr = document.createElement("tr");
            const isFail = h.prediction === "FAIL";
            const predBadge = isFail ? `<span class="badge reject">FAIL</span>` : `<span class="badge pass">PASS</span>`;
            const createdTime = h.created_at ? new Date(h.created_at).toLocaleTimeString() : new Date().toLocaleTimeString();
            const probFormatted = h.probability !== undefined ? `${(h.probability * 100).toFixed(1)}%` : "N/A";

            tr.innerHTML = `
              <td>${createdTime}</td>
              <td><strong>${h.test_id || 'TEST-DEV'}</strong></td>
              <td>${h.equipment_id || h.equipment || 'EQP-101'}</td>
              <td>${predBadge}</td>
              <td><strong>${probFormatted}</strong></td>
              <td><span class="badge" style="background-color:rgba(255,255,255,0.05);">${h.risk_level || 'LOW'}</span></td>
            `;
            tbody.appendChild(tr);
          });
        }
      }
    } catch (err) {
      console.warn("Error refreshing dashboard analytics:", err);
    }
  }

  function renderSingleResult(result) {
    const emptyState = document.getElementById("res-empty-state");
    const contentPanel = document.getElementById("res-content-panel");
    const statusBadge = document.getElementById("res-status-badge");
    const probVal = document.getElementById("res-prob-value");
    const riskLevel = document.getElementById("res-risk-level");
    const eqId = document.getElementById("res-equipment-id");
    const explanationCard = document.getElementById("explanation-card");
    const indicatorsContainer = document.getElementById("explanation-indicators-container");

    if (emptyState) emptyState.style.display = "none";
    if (contentPanel) contentPanel.style.display = "block";

    const disp = result.disposition || (result.prediction === "FAIL" ? "REJECT" : "PASS");
    const isFail = disp === "REJECT";
    const isWarning = disp === "MONITOR";

    if (statusBadge) {
      statusBadge.textContent = disp;
      statusBadge.style.color = isFail ? "var(--critical)" : (isWarning ? "var(--warning)" : "var(--success)");
    }

    if (probVal) {
      probVal.textContent = `${(result.probability * 100).toFixed(1)}%`;
      probVal.style.color = isFail ? "var(--critical)" : (isWarning ? "var(--warning)" : "var(--success)");
    }

    if (riskLevel) {
      riskLevel.textContent = result.risk_level || (isFail ? "CRITICAL" : (isWarning ? "MEDIUM" : "LOW"));
      if (isFail) riskLevel.style.color = "var(--critical)";
      else if (isWarning) riskLevel.style.color = "var(--warning)";
      else riskLevel.style.color = "var(--success)";
    }

    if (eqId) eqId.textContent = result.equipment_id || "EQP-101";

    const offlineBanner = document.getElementById("res-offline-banner");
    if (offlineBanner) {
      offlineBanner.style.display = result.is_offline_fallback ? "block" : "none";
    }

    const traceIdEl = document.getElementById("res-trace-id");
    if (traceIdEl) {
      traceIdEl.textContent = result.trace_id || "PRED-2026-N/A";
    }

    const opDecisionEl = document.getElementById("res-op-decision");
    if (opDecisionEl) {
      if (disp === "MONITOR") {
        opDecisionEl.textContent = "🟡 SECONDARY TEST REQUIRED";
        opDecisionEl.style.color = "#eab308";
      } else if (disp === "REJECT") {
        opDecisionEl.textContent = "🔴 REJECT";
        opDecisionEl.style.color = "var(--critical)";
      } else {
        opDecisionEl.textContent = "🟢 PASS";
        opDecisionEl.style.color = "var(--success)";
      }
    }

    const decisionReasonEl = document.getElementById("res-decision-reason");
    if (decisionReasonEl) {
      decisionReasonEl.textContent = result.decision_reason || result.explanation?.summary || "Nominal parameter bounds.";
    }

    // Render Research V2 Shadow Model Comparison
    const shadowCard = document.getElementById("res-shadow-card");
    if (shadowCard) {
      if (result.shadow_model && !result.shadow_model.error) {
        shadowCard.style.display = "block";
        const sm = result.shadow_model;
        const shadowProbEl = document.getElementById("res-shadow-prob");
        const shadowDeltaEl = document.getElementById("res-shadow-delta");
        const shadowClassEl = document.getElementById("res-shadow-class");
        const shadowDisclaimerEl = document.getElementById("res-shadow-disclaimer");

        if (shadowProbEl) shadowProbEl.textContent = `${(sm.probability * 100).toFixed(1)}%`;
        if (shadowDeltaEl) {
          const deltaPp = (sm.probability_delta * 100).toFixed(1);
          shadowDeltaEl.textContent = `${deltaPp >= 0 ? '+' : ''}${deltaPp} pp`;
          shadowDeltaEl.style.color = Math.abs(sm.probability_delta) > 0.1 ? "var(--warning)" : "var(--text-secondary)";
        }
        if (shadowClassEl) {
          shadowClassEl.textContent = sm.classification;
          shadowClassEl.style.color = sm.classification === "FAIL" ? "var(--critical)" : "var(--success)";
        }
        if (shadowDisclaimerEl) {
          shadowDisclaimerEl.textContent = sm.disclaimer || "RESEARCH SHADOW — NOT USED FOR DECISION";
        }
      } else {
        shadowCard.style.display = "none";
      }
    }

    // Render explanation key indicators
    if (explanationCard && indicatorsContainer) {
      explanationCard.style.display = "block";
      indicatorsContainer.innerHTML = "";

      const indicators = (result.explanation && result.explanation.key_indicators) || [];
      indicators.forEach(ind => {
        const item = document.createElement("div");
        item.style.padding = "10px";
        item.style.backgroundColor = "rgba(0,0,0,0.2)";
        item.style.borderRadius = "6px";
        item.style.border = "1px solid var(--glass-border)";
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.alignItems = "center";

        const isElevated = ind.status === "ELEVATED" || ind.status === "HIGH_LOAD" || ind.status === "LOW";
        const badgeColor = isElevated ? "var(--critical)" : "var(--success)";
        const badgeBg = isElevated ? "rgba(255,94,98,0.1)" : "rgba(16,185,129,0.1)";

        item.innerHTML = `
          <div>
            <strong style="color:var(--text-primary); font-size:12px;">${ind.feature}</strong>
            <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">${ind.description || ''}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:13px; font-weight:700; color:${badgeColor};">${ind.value} ${ind.unit !== 'N/A' ? ind.unit : ''}</div>
            <span class="badge" style="background-color:${badgeBg}; color:${badgeColor}; font-size:9px;">${ind.status}</span>
          </div>
        `;
        indicatorsContainer.appendChild(item);
      });
    }
  }

  // addPredictionToHistory is defined below with localStorage persistence and decision analytics updates

  // Single prediction submit event
  const singleForm = document.getElementById("single-predict-form");
  if (singleForm) {
    singleForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById("btn-run-single-predict");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Running semiconductor analysis...";
      }

      const record = {
        test_id: document.getElementById("inp-test-id").value,
        equipment_id: document.getElementById("inp-equipment-id").value,
        supply_voltage: parseFloat(document.getElementById("inp-supply-voltage").value),
        output_voltage: parseFloat(document.getElementById("inp-output-voltage").value),
        current: parseFloat(document.getElementById("inp-current").value),
        leakage_current: parseFloat(document.getElementById("inp-leakage-current").value),
        resistance: parseFloat(document.getElementById("inp-resistance").value),
        capacitance: parseFloat(document.getElementById("inp-capacitance").value),
        threshold_voltage: parseFloat(document.getElementById("inp-threshold-voltage").value),
        frequency: parseFloat(document.getElementById("inp-frequency").value),
        propagation_delay: parseFloat(document.getElementById("inp-propagation-delay").value),
        setup_time: parseFloat(document.getElementById("inp-setup-time").value),
        hold_time: parseFloat(document.getElementById("inp-hold-time").value),
        timing_margin: parseFloat(document.getElementById("inp-timing-margin").value),
        temperature: parseFloat(document.getElementById("inp-temperature").value),
        dynamic_power: parseFloat(document.getElementById("inp-dynamic-power").value),
        total_power: parseFloat(document.getElementById("inp-total-power").value),
        test_duration: parseFloat(document.getElementById("inp-test-duration").value)
      };

      try {
        const result = await predictMeasurementRecord(record);
        renderSingleResult(result);
        addPredictionToHistory(result);
        refreshDashboardAnalytics();
      } catch (err) {
        alert(`Prediction failed: ${err.message}`);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Run Semiconductor Analysis";
        }
      }
    });
  }

  function initMLWorkstation() {
    const singleForm = document.getElementById("single-predict-form");
    if (!singleForm) return;

    const emptyState = document.getElementById("res-empty-state");
    const contentPanel = document.getElementById("res-content-panel");

    // Automatically trigger initial prediction scan if result card is not yet populated
    if (emptyState && contentPanel && (contentPanel.style.display === "none" || contentPanel.style.display === "")) {
      try {
        singleForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      } catch (e) {
        console.warn("ML Workstation auto-initialization dispatch failed:", e);
      }
    }
  }

  // Preset Sample Click Listeners
  const presetsMap = {
    "preset-normal": { test_id: "TEST-PRESET-NORM", eq: "EQP-101", iddq: "10.2", ileak: "1.15", tpd: "11.2", temp: "24.0", power: "42.0", voltage: "1.20" },
    "preset-leakage": { test_id: "TEST-PRESET-LEAK", eq: "EQP-103", iddq: "28.5", ileak: "198.5", tpd: "14.8", temp: "36.5", power: "66.0", voltage: "1.20" },
    "preset-thermal": { test_id: "TEST-PRESET-THERM", eq: "EQP-104", iddq: "32.0", ileak: "175.0", tpd: "13.5", temp: "42.0", power: "71.0", voltage: "1.20" },
    "preset-timing": { test_id: "TEST-PRESET-TIMING", eq: "EQP-105", iddq: "14.0", ileak: "2.10", tpd: "138.5", temp: "28.0", power: "52.0", voltage: "1.20" },
    "preset-drift": { test_id: "TEST-PRESET-DRIFT", eq: "EQP-102", iddq: "24.0", ileak: "145.0", tpd: "12.8", temp: "32.0", power: "58.0", voltage: "1.20" },
    "preset-combined": { test_id: "TEST-PRESET-COMB", eq: "EQP-103", iddq: "45.0", ileak: "210.0", tpd: "142.0", temp: "45.0", power: "78.0", voltage: "1.20" },
    "preset-review": { test_id: "TEST-PRESET-REV", eq: "EQP-101", iddq: "16.5", ileak: "135.0", tpd: "12.2", temp: "30.0", power: "50.0", voltage: "1.20" }
  };

  Object.keys(presetsMap).forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener("click", () => {
        const data = presetsMap[btnId];
        if (document.getElementById("inp-test-id")) document.getElementById("inp-test-id").value = data.test_id;
        if (document.getElementById("inp-equipment-id")) document.getElementById("inp-equipment-id").value = data.eq;
        if (document.getElementById("inp-iddq")) document.getElementById("inp-iddq").value = data.iddq;
        if (document.getElementById("inp-leakage-current")) document.getElementById("inp-leakage-current").value = data.ileak;
        if (document.getElementById("inp-propagation-delay")) document.getElementById("inp-propagation-delay").value = data.tpd;
        if (document.getElementById("inp-temperature")) document.getElementById("inp-temperature").value = data.temp;
        if (document.getElementById("inp-dynamic-power")) document.getElementById("inp-dynamic-power").value = data.power;
        if (document.getElementById("inp-supply-voltage")) document.getElementById("inp-supply-voltage").value = data.voltage;

        const form = document.getElementById("single-predict-form");
        if (form) form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      });
    }
  });

  // Batch Test Runner Button
  const btnBatch = document.getElementById("btn-run-batch-test");
  if (btnBatch) {
    btnBatch.addEventListener("click", async () => {
      btnBatch.disabled = true;
      btnBatch.textContent = "Analyzing 50 test records...";

      // Generate 50 synthetic dev devices
      const devBatch = [];
      for (let i = 1; i <= 50; i++) {
        const isDefect = i % 4 === 0;
        devBatch.push({
          test_id: `BATCH-DEV-${String(i).padStart(3, '0')}`,
          equipment_id: `EQP-10${(i % 5) + 1}`,
          supply_voltage: 1.20,
          output_voltage: 1.18,
          current: 40.0 + (i % 10),
          leakage_current: isDefect ? 190.0 + (i % 20) : 100.0 + (i % 30),
          resistance: 12.0,
          capacitance: 4.0,
          threshold_voltage: 0.45,
          frequency: 2500,
          propagation_delay: isDefect ? 14.5 : 11.5,
          setup_time: 1.2,
          hold_time: 0.8,
          timing_margin: 2.0,
          temperature: isDefect ? 38.0 : 26.0,
          dynamic_power: isDefect ? 66.0 : 42.0,
          total_power: 52.0,
          test_duration: 12.0
        });
      }

      try {
        const batchRes = await predictMeasurementBatch(devBatch);
        refreshDashboardAnalytics();
        const grid = document.getElementById("batch-metrics-grid");
        const tableCont = document.getElementById("batch-table-container");
        const tbody = document.getElementById("batch-table-body");

        if (grid) grid.style.display = "grid";
        if (tableCont) tableCont.style.display = "block";

        document.getElementById("batch-stat-total").textContent = batchRes.total;
        document.getElementById("batch-stat-pass").textContent = batchRes.pass_count;
        document.getElementById("batch-stat-fail").textContent = batchRes.fail_count;
        document.getElementById("batch-stat-rate").textContent = `${((batchRes.fail_count / batchRes.total) * 100).toFixed(1)}%`;

        const avgProb = batchRes.results.reduce((acc, r) => acc + r.probability, 0) / batchRes.total;
        document.getElementById("batch-stat-avgprob").textContent = `${(avgProb * 100).toFixed(1)}%`;

        if (tbody) {
          tbody.innerHTML = "";
          batchRes.results.forEach(r => {
            const tr = document.createElement("tr");
            const isFail = r.prediction === "FAIL";
            const predBadge = isFail ? `<span class="badge reject">FAIL</span>` : `<span class="badge pass">PASS</span>`;

            tr.innerHTML = `
              <td><strong>${r.test_id}</strong></td>
              <td>${r.equipment_id}</td>
              <td>${predBadge}</td>
              <td><strong>${(r.probability * 100).toFixed(1)}%</strong></td>
              <td><span class="badge" style="background-color:rgba(255,255,255,0.05);">${r.risk_level}</span></td>
              <td><button class="btn" style="padding:2px 6px; font-size:10px;" onclick="renderSingleResult(${JSON.stringify(r).replace(/"/g, '&quot;')})">Inspect</button></td>
            `;
            tbody.appendChild(tr);
          });
        }
      } catch (err) {
        alert(`Batch test failed: ${err.message}`);
      } finally {
        btnBatch.disabled = false;
        btnBatch.textContent = "Run Batch Analysis (50 Dev Devices)";
      }
    });
  }

  // ==========================================
  // SPATIAL FAILURE INTELLIGENCE ENGINE
  // ==========================================

  // ==========================================
  // SPATIAL FAILURE INTELLIGENCE ENGINE
  // ==========================================

  function detectSpatialHotspots(components) {
    if (!Array.isArray(components) || components.length === 0) return [];

    // Filter elevated-risk dies (probability >= 0.20 or status MONITOR/REJECT or anomaly_score >= 4.0)
    const elevated = components.filter(c => {
      if (c.die_x === undefined || c.die_y === undefined) return false;
      const isAnomScore = (c.anomaly_score || 0) >= 4.0;
      const isRiskStatus = c.status === "MONITOR" || c.status === "REJECT" || c.prediction === "FAIL";
      const isHighProb = (c.probability !== undefined && c.probability >= 0.20);
      return isAnomScore || isRiskStatus || isHighProb;
    });

    if (elevated.length === 0) return [];

    const visited = new Set();
    const clusters = [];

    for (let i = 0; i < elevated.length; i++) {
      const root = elevated[i];
      if (visited.has(root.id)) continue;

      const clusterDies = [];
      const queue = [root];
      visited.add(root.id);

      while (queue.length > 0) {
        const curr = queue.shift();
        clusterDies.push(curr);

        for (let j = 0; j < elevated.length; j++) {
          const neighbor = elevated[j];
          if (visited.has(neighbor.id)) continue;

          const dx = curr.die_x - neighbor.die_x;
          const dy = curr.die_y - neighbor.die_y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Proximity threshold <= 1.85 grid units
          if (dist <= 1.85) {
            visited.add(neighbor.id);
            queue.push(neighbor);
          }
        }
      }

      if (clusterDies.length >= 2) {
        let sumX = 0, sumY = 0, sumScore = 0, maxScore = 0, sumProb = 0;
        let rejectCount = 0;
        let iddqDriftCount = 0, ileakCount = 0, tpdCount = 0;

        clusterDies.forEach(c => {
          sumX += c.die_x;
          sumY += c.die_y;
          const score = c.anomaly_score || 0;
          sumScore += score;
          if (score > maxScore) maxScore = score;

          const prob = c.probability !== undefined ? c.probability : (c.status === "REJECT" ? 0.78 : (c.status === "MONITOR" ? 0.45 : 0.08));
          sumProb += prob;

          if (c.status === "REJECT" || prob >= 0.20) rejectCount++;

          const iddqVal = c.measurements?.h24?.iddq || c.leakage_current || 0;
          const tpdVal = c.measurements?.h24?.tpd || c.propagation_delay || 0;
          if (iddqVal > 20.0) iddqDriftCount++;
          if (tpdVal > 130.0) tpdCount++;
          else ileakCount++;
        });

        const avgX = Number((sumX / clusterDies.length).toFixed(1));
        const avgY = Number((sumY / clusterDies.length).toFixed(1));
        const avgScore = Number((sumScore / clusterDies.length).toFixed(2));
        const avgProb = Number((sumProb / clusterDies.length).toFixed(4));
        const riskLevel = rejectCount > 0 ? "REJECT" : "MONITOR";

        let dominantSignal = "Iddq Quiescent Current Drift";
        if (tpdCount > iddqDriftCount && tpdCount > ileakCount) {
          dominantSignal = "Propagation Delay & Timing Degradation";
        } else if (iddqDriftCount >= tpdCount) {
          dominantSignal = "Iddq Standby Leakage Drift";
        } else {
          dominantSignal = "Thermal & Dielectric Leakage Cluster";
        }

        const recommendedAction = riskLevel === "REJECT" 
          ? "Quarantine & Engineering Review" 
          : "Secondary Re-Screening & Lot Monitoring";

        let regionStr = "Wafer Center";
        if (avgX > 1.5 && avgY > 1.5) regionStr = "North-East Edge (Q1)";
        else if (avgX < -1.5 && avgY > 1.5) regionStr = "North-West Edge (Q2)";
        else if (avgX < -1.5 && avgY < -1.5) regionStr = "South-West Edge (Q3)";
        else if (avgX > 1.5 && avgY < -1.5) regionStr = "South-East Edge (Q4)";

        clusters.push({
          id: `HOTSPOT-0${clusters.length + 1}`,
          centroid_x: avgX,
          centroid_y: avgY,
          region: regionStr,
          components: clusterDies,
          component_count: clusterDies.length,
          avg_anomaly_score: avgScore,
          max_anomaly_score: Number(maxScore.toFixed(2)),
          avg_probability: avgProb,
          risk_level: riskLevel,
          dominant_signal: dominantSignal,
          recommended_action: recommendedAction,
          pattern: clusterDies.length >= 4 ? "Concentrated Defect Cluster" : "Localized Anomaly Pair"
        });
      }
    }

    return clusters;
  }

  function calculateRegionalAnalysis(components) {
    let centerTotal = 0, centerAnom = 0;
    let innerTotal = 0, innerAnom = 0;
    let edgeTotal = 0, edgeAnom = 0;

    let q1Total = 0, q1Anom = 0;
    let q2Total = 0, q2Anom = 0;
    let q3Total = 0, q3Anom = 0;
    let q4Total = 0, q4Anom = 0;

    components.forEach(c => {
      if (c.die_x === undefined || c.die_y === undefined) return;
      const r = Math.sqrt(c.die_x * c.die_x + c.die_y * c.die_y);
      const isAnom = c.status === "REJECT" || c.status === "MONITOR" || (c.probability !== undefined && c.probability >= 0.20);

      if (r <= 3.0) {
        centerTotal++;
        if (isAnom) centerAnom++;
      } else if (r <= 5.0) {
        innerTotal++;
        if (isAnom) innerAnom++;
      } else {
        edgeTotal++;
        if (isAnom) edgeAnom++;
      }

      if (c.die_x >= 0 && c.die_y >= 0) {
        q1Total++;
        if (isAnom) q1Anom++;
      } else if (c.die_x < 0 && c.die_y >= 0) {
        q2Total++;
        if (isAnom) q2Anom++;
      } else if (c.die_x < 0 && c.die_y < 0) {
        q3Total++;
        if (isAnom) q3Anom++;
      } else {
        q4Total++;
        if (isAnom) q4Anom++;
      }
    });

    return {
      radial: {
        center: { name: "Wafer Center (r ≤ 3.0)", total: centerTotal, anomalous: centerAnom, pct: centerTotal > 0 ? ((centerAnom / centerTotal) * 100).toFixed(1) : 0 },
        inner: { name: "Inner Ring (3.0 < r ≤ 5.0)", total: innerTotal, anomalous: innerAnom, pct: innerTotal > 0 ? ((innerAnom / innerTotal) * 100).toFixed(1) : 0 },
        edge: { name: "Outer Edge (r > 5.0)", total: edgeTotal, anomalous: edgeAnom, pct: edgeTotal > 0 ? ((edgeAnom / edgeTotal) * 100).toFixed(1) : 0 }
      },
      quadrants: {
        q1: { name: "Q1 (North-East)", total: q1Total, anomalous: q1Anom, pct: q1Total > 0 ? ((q1Anom / q1Total) * 100).toFixed(1) : 0 },
        q2: { name: "Q2 (North-West)", total: q2Total, anomalous: q2Anom, pct: q2Total > 0 ? ((q2Anom / q2Total) * 100).toFixed(1) : 0 },
        q3: { name: "Q3 (South-West)", total: q3Total, anomalous: q3Anom, pct: q3Total > 0 ? ((q3Anom / q3Total) * 100).toFixed(1) : 0 },
        q4: { name: "Q4 (South-East)", total: q4Total, anomalous: q4Anom, pct: q4Total > 0 ? ((q4Anom / q4Total) * 100).toFixed(1) : 0 }
      }
    };
  }

  function renderWaferMap(targetWaferId) {
    const svgContainer = document.getElementById("wafer-svg-container");
    const countLabel = document.getElementById("wafer-die-count-label");
    const banner = document.getElementById("spatial-unavailable-banner");
    const mainGrid = document.getElementById("spatial-workstation-main-grid");
    const regionalCard = document.getElementById("spatial-regional-analysis-card");
    const statusBadge = document.getElementById("spatial-data-status-badge");
    const selector = document.getElementById("spatial-wafer-selector");

    if (!svgContainer) return;

    // Resolve Wafer ID with LocalStorage persistence fallback
    let waferId = targetWaferId || localStorage.getItem("predicta_selected_wafer") || "WFR-2026-08-01";
    if (selector && selector.value !== waferId) {
      selector.value = waferId;
    }
    localStorage.setItem("predicta_selected_wafer", waferId);

    if (waferId === "NO-SPATIAL-DATA") {
      if (banner) banner.style.display = "block";
      if (mainGrid) mainGrid.style.display = "none";
      if (regionalCard) regionalCard.style.display = "none";
      if (statusBadge) {
        statusBadge.className = "badge warning";
        statusBadge.textContent = "Spatial Data Unavailable";
      }
      return;
    }

    if (banner) banner.style.display = "none";
    if (mainGrid) mainGrid.style.display = "grid";
    if (regionalCard) regionalCard.style.display = "block";
    if (statusBadge) {
      statusBadge.className = "badge pass";
      statusBadge.textContent = "Spatial Active";
    }

    let waferComps = componentPool.filter(c => c.wafer_id === waferId);
    // If no components exist for custom wafer ID, fallback cleanly to primary wafer
    if (waferComps.length === 0) {
      waferId = "WFR-2026-08-01";
      waferComps = componentPool.filter(c => c.wafer_id === waferId);
      if (selector) selector.value = waferId;
      localStorage.setItem("predicta_selected_wafer", waferId);
    }

    if (countLabel) countLabel.textContent = `${waferComps.length} Active Dies`;

    // Hotspot Detection
    const hotspots = detectSpatialHotspots(waferComps);
    renderHotspotsList(hotspots);

    // Update Spatial Health Summary Card Counters
    const passCount = waferComps.filter(c => c.status === "PASS" || (c.probability !== undefined && c.probability < 0.20)).length;
    const monitorCount = waferComps.filter(c => c.status === "MONITOR" || (c.probability >= 0.20 && c.probability < 0.65)).length;
    const failCount = waferComps.filter(c => c.status === "REJECT" || (c.probability >= 0.65)).length;

    const summaryActive = document.getElementById("spatial-summary-active");
    const summaryPass = document.getElementById("spatial-summary-pass");
    const summaryMonitor = document.getElementById("spatial-summary-monitor");
    const summaryFail = document.getElementById("spatial-summary-fail");
    const summaryHotspots = document.getElementById("spatial-summary-hotspots");

    if (summaryActive) summaryActive.textContent = waferComps.length;
    if (summaryPass) summaryPass.textContent = passCount;
    if (summaryMonitor) summaryMonitor.textContent = monitorCount;
    if (summaryFail) summaryFail.textContent = failCount;
    if (summaryHotspots) summaryHotspots.textContent = hotspots.length;

    // Regional analysis
    const regional = calculateRegionalAnalysis(waferComps);
    renderRegionalAnalysisView(regional);

    // SVG Canvas layout parameters
    const svgWidth = 460;
    const svgHeight = 460;
    const center = 230;
    const scale = 28;
    const dieSize = 22;

    let svgHtml = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" style="max-width:100%; height:auto; display:inline-block; font-family:var(--font-sans);">
        <circle cx="${center}" cy="${center}" r="215" fill="#F8FAFC" stroke="#D8E5EF" stroke-width="2.5"/>
        <circle cx="${center}" cy="${center}" r="213" fill="none" stroke="#EAF4FB" stroke-width="1.5"/>
        <path d="M ${center - 12} 443 A 12 12 0 0 0 ${center + 12} 443 Z" fill="#D8E5EF" stroke="#94A3B8" stroke-width="1"/>
        <line x1="${center}" y1="20" x2="${center}" y2="440" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="3 3"/>
        <line x1="20" y1="${center}" x2="440" y2="${center}" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="3 3"/>
    `;

    // Pass 1: Render Hotspot Cluster Bounding Box Boundaries (Under Dies)
    const hotspotLabels = [];
    hotspots.forEach(h => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      h.components.forEach(c => {
        const x = center + c.die_x * scale - dieSize / 2;
        const y = center - c.die_y * scale - dieSize / 2;
        if (x < minX) minX = x;
        if (x + dieSize > maxX) maxX = x + dieSize;
        if (y < minY) minY = y;
        if (y + dieSize > maxY) maxY = y + dieSize;
      });
      const padding = 8;
      const rectX = minX - padding;
      const rectY = minY - padding;
      const rectW = maxX - minX + padding * 2;
      const rectH = maxY - minY + padding * 2;
      const avgProbPct = (h.avg_probability * 100).toFixed(0);

      svgHtml += `
        <rect x="${rectX}" y="${rectY}" width="${rectW}" height="${rectH}"
              fill="rgba(220,38,38,0.07)" stroke="#DC2626" stroke-width="2" stroke-dasharray="4 3" rx="6">
          <title>${h.id}: ${h.region} (${h.component_count} Dies | Avg Risk: ${avgProbPct}% | Action: ${h.recommended_action})</title>
        </rect>
      `;

      // Store annotation badge for Pass 3 (rendered ON TOP of die nodes)
      const labelY = (rectY - 20 < 10) ? (rectY + rectH + 4) : (rectY - 20);
      const textY = labelY + 12;
      hotspotLabels.push({
        id: h.id,
        count: h.component_count,
        prob: avgProbPct,
        rectX,
        labelY,
        textY
      });
    });

    // Pass 2: Render Die Nodes
    waferComps.forEach(c => {
      if (c.die_x === undefined || c.die_y === undefined) return;
      const x = center + c.die_x * scale - dieSize / 2;
      const y = center - c.die_y * scale - dieSize / 2;

      let color = "#10B981";
      let opacity = 0.90;
      let strokeColor = "#FFFFFF";
      let strokeWidth = 1.2;

      const prob = c.probability !== undefined ? c.probability : (c.status === "REJECT" ? 0.78 : (c.status === "MONITOR" ? 0.42 : 0.05));

      if (c.status === "MONITOR" || (prob >= 0.20 && prob < 0.65)) {
        color = "#F59E0B";
        opacity = 0.95;
        strokeColor = "#D97706";
      } else if (c.status === "REJECT" || prob >= 0.65) {
        color = "#EF4444";
        opacity = 1.0;
        strokeColor = "#991B1B";
        strokeWidth = 1.8;
      }

      svgHtml += `
        <rect id="die-${c.id}" class="wafer-die-node" x="${x}" y="${y}" width="${dieSize}" height="${dieSize}" rx="3"
              fill="${color}" fill-opacity="${opacity}" stroke="${strokeColor}" stroke-width="${strokeWidth}"
              style="cursor:pointer; transition:transform 0.15s ease;"
              onclick="selectSpatialDie('${c.id}')">
          <title>${c.id} (${c.die_x >= 0 ? '+' : ''}${c.die_x}, ${c.die_y >= 0 ? '+' : ''}${c.die_y}) | P(Fail): ${(prob * 100).toFixed(1)}% | Status: ${c.status} | Action: ${c.status === 'REJECT' ? 'QUARANTINE' : c.status === 'MONITOR' ? 'REVIEW' : 'PASS'}</title>
        </rect>
      `;
    });

    // Pass 3: Render Floating Hotspot Annotation Cards (ON TOP OF ALL DIES)
    hotspotLabels.forEach(lbl => {
      const cardW = lbl.id.length * 7 + 105;
      svgHtml += `
        <g class="hotspot-annotation-card" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.18));">
          <rect x="${lbl.rectX}" y="${lbl.labelY}" width="${cardW}" height="17" fill="#DC2626" rx="4" stroke="#FFFFFF" stroke-width="1"/>
          <text x="${lbl.rectX + 6}" y="${lbl.textY}" fill="#FFFFFF" font-size="9" font-weight="700" font-family="Inter, sans-serif">🔴 ${lbl.id} (${lbl.count} dies | Avg P: ${lbl.prob}%)</text>
        </g>
      `;
    });

    svgHtml += `</svg>`;
    svgContainer.innerHTML = svgHtml;

    // Select default anomaly die for immediate inspection
    const defaultDie = waferComps.find(c => c.id === "COMP-00042") || waferComps.find(c => c.status === "REJECT") || waferComps[0];
    if (defaultDie) selectSpatialDie(defaultDie.id);
  }

  function renderHotspotsList(hotspots) {
    const container = document.getElementById("hotspots-list-container");
    const countBadge = document.getElementById("hotspot-count-badge");
    if (!container) return;

    if (countBadge) {
      countBadge.textContent = `${hotspots.length} ${hotspots.length === 1 ? 'Cluster' : 'Clusters'} Detected`;
      countBadge.className = hotspots.length > 0 ? "badge warning" : "badge pass";
    }

    if (hotspots.length === 0) {
      container.innerHTML = `
        <div style="padding:20px; text-align:center; color:#64748B; font-size:12px;">
          No spatial defect clusters detected. All dies within spatial variance limits.
        </div>
      `;
      return;
    }

    let html = "";
    hotspots.forEach(h => {
      const badgeClass = h.risk_level === "REJECT" ? "critical" : "warning";
      const avgProbPct = (h.avg_probability * 100).toFixed(1);
      html += `
        <div style="background:#F5F9FD; border:1px solid #D8E5EF; border-left:4px solid ${h.risk_level === 'REJECT' ? '#DC2626' : '#D97706'}; padding:12px 14px; border-radius:6px; font-size:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:6px;">
            <span style="font-weight:700; color:#123B63;">${h.id} — ${h.region}</span>
            <span class="badge ${badgeClass}">${h.risk_level} (${h.component_count} Dies)</span>
          </div>
          <div style="color:#475569; font-size:11px; margin-bottom:4px;">
            Centroid: (${h.centroid_x >= 0 ? '+' : ''}${h.centroid_x}, ${h.centroid_y >= 0 ? '+' : ''}${h.centroid_y}) | Avg Risk: <strong>${avgProbPct}%</strong> | Max Score: <strong>${h.max_anomaly_score}</strong>
          </div>
          <div style="color:#475569; font-size:11px; margin-bottom:4px;">
            Dominant Signal: <em style="color:#1E293B; font-weight:600;">${h.dominant_signal}</em>
          </div>
          <div style="color:#123B63; font-size:11px; font-weight:600; margin-bottom:8px;">
            Recommended Action: <strong style="color:${h.risk_level === 'REJECT' ? '#DC2626' : '#D97706'};">${h.recommended_action}</strong>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${h.components.map(c => `<button class="btn btn-outline" style="padding:2px 8px; font-size:10px; border-color:#D8E5EF; background:#FFFFFF;" onclick="selectSpatialDie('${c.id}')">${c.id}</button>`).join('')}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function selectSpatialDie(componentId) {
    const comp = componentPool.find(c => c.id === componentId);
    const drilldownBody = document.getElementById("spatial-die-drilldown-body");
    const statusBadge = document.getElementById("spatial-die-status-badge");

    if (!comp || !drilldownBody) return;

    if (statusBadge) {
      statusBadge.className = `badge ${comp.status ? comp.status.toLowerCase() : 'pass'}`;
      statusBadge.textContent = comp.status || "PASS";
    }

    const r = Math.sqrt(comp.die_x * comp.die_x + comp.die_y * comp.die_y).toFixed(1);
    const prob = comp.probability !== undefined ? comp.probability : (comp.status === "REJECT" ? 0.78 : (comp.status === "MONITOR" ? 0.42 : 0.05));
    const probPct = (prob * 100).toFixed(1);
    const unit = "µA";

    // Find if die belongs to a cluster
    const waferComps = componentPool.filter(c => c.wafer_id === comp.wafer_id);
    const hotspots = detectSpatialHotspots(waferComps);
    const parentHotspot = hotspots.find(h => h.components.some(c => c.id === comp.id));

    let spatialNarrative = "";
    if (parentHotspot) {
      spatialNarrative = `This component is part of <strong>${parentHotspot.id}</strong> (${parentHotspot.region}). Neighboring dies show similar elevated ${parentHotspot.dominant_signal.toLowerCase()} behavior, indicating a localized manufacturing/process variation.`;
    } else {
      spatialNarrative = `This component is an isolated die node at coordinates (X: ${comp.die_x >= 0 ? '+' : ''}${comp.die_x}, Y: ${comp.die_y >= 0 ? '+' : ''}${comp.die_y}). Telemetry parameters fall within expected nominal lot variance limits.`;
    }

    drilldownBody.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px; font-size:12px;">
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #EAF4FB; padding-bottom:6px; flex-wrap:wrap; gap:4px;">
          <span style="color:#64748B;">Component / Lot:</span>
          <strong style="color:#123B63;">${comp.id} (${comp.lot_id})</strong>
        </div>
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #EAF4FB; padding-bottom:6px; flex-wrap:wrap; gap:4px;">
          <span style="color:#64748B;">Wafer Coordinates:</span>
          <strong style="color:#1976B8;">X: ${comp.die_x >= 0 ? '+' : ''}${comp.die_x}, Y: ${comp.die_y >= 0 ? '+' : ''}${comp.die_y} (r = ${r})</strong>
        </div>
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #EAF4FB; padding-bottom:6px; flex-wrap:wrap; gap:4px;">
          <span style="color:#64748B;">Failure Probability:</span>
          <strong style="color:${prob >= 0.20 ? '#DC2626' : '#16A34A'};">${probPct}%</strong>
        </div>
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #EAF4FB; padding-bottom:6px; flex-wrap:wrap; gap:4px;">
          <span style="color:#64748B;">Operational Decision:</span>
          <strong style="color:${comp.status === 'REJECT' ? '#DC2626' : comp.status === 'MONITOR' ? '#D97706' : '#16A34A'};">${comp.status === 'REJECT' ? 'QUARANTINE' : comp.status === 'MONITOR' ? 'SECONDARY_TEST' : 'PASS'}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #EAF4FB; padding-bottom:6px; flex-wrap:wrap; gap:4px;">
          <span style="color:#64748B;">24h Iddq Telemetry:</span>
          <strong>${comp.measurements?.h24?.iddq ? comp.measurements.h24.iddq.toFixed(2) : (comp.leakage_current || 12).toFixed(2)} ${unit}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #EAF4FB; padding-bottom:6px; flex-wrap:wrap; gap:4px;">
          <span style="color:#64748B;">Anomaly Z-Score:</span>
          <strong style="color:${(comp.anomaly_score || 0) > 4 ? '#DC2626' : '#10B981'};">${(comp.anomaly_score || 0).toFixed(2)}</strong>
        </div>
        <div style="padding-top:4px;">
          <div style="font-weight:700; color:#123B63; margin-bottom:4px;">Spatial Context & Decision Explanation:</div>
          <div style="color:#475569; font-size:11px; line-height:1.5; background:#F5F9FD; padding:8px 10px; border-radius:4px; border:1px solid #D8E5EF; word-break:break-word;">
            ${spatialNarrative}
          </div>
        </div>
      </div>
    `;
  }

  function renderRegionalAnalysisView(regional) {
    const container = document.getElementById("spatial-regional-container");
    if (!container) return;

    let html = `
      <div class="grid-2col" style="margin-bottom:16px;">
        <div style="background:#F5F9FD; border:1px solid #D8E5EF; padding:14px; border-radius:6px;">
          <div style="font-weight:700; color:#123B63; margin-bottom:10px; font-size:13px;">Radial Region Distribution</div>
          <div style="display:flex; flex-direction:column; gap:8px; font-size:12px;">
            ${Object.values(regional.radial).map(r => `
              <div style="display:flex; justify-content:space-between; border-bottom:1px solid #D8E5EF; padding-bottom:4px; flex-wrap:wrap; gap:4px;">
                <span style="color:#475569;">${r.name}:</span>
                <strong>${r.anomalous} / ${r.total} Anomalous (${r.pct}%)</strong>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="background:#F5F9FD; border:1px solid #D8E5EF; padding:14px; border-radius:6px;">
          <div style="font-weight:700; color:#123B63; margin-bottom:10px; font-size:13px;">Quadrant Distribution</div>
          <div style="display:flex; flex-direction:column; gap:8px; font-size:12px;">
            ${Object.values(regional.quadrants).map(q => `
              <div style="display:flex; justify-content:space-between; border-bottom:1px solid #D8E5EF; padding-bottom:4px; flex-wrap:wrap; gap:4px;">
                <span style="color:#475569;">${q.name}:</span>
                <strong>${q.anomalous} / ${q.total} Anomalous (${q.pct}%)</strong>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  function initSpatialView() {
    const selector = document.getElementById("spatial-wafer-selector");
    if (selector) {
      const savedWafer = localStorage.getItem("predicta_selected_wafer") || "WFR-2026-08-01";
      selector.value = savedWafer;
      selector.onchange = (e) => {
        localStorage.setItem("predicta_selected_wafer", e.target.value);
        renderWaferMap(e.target.value);
      };
      renderWaferMap(selector.value);
    }
  }


  // ==========================================
  // MODULE B: KINETIC DRIFT PAGE
  // ==========================================
  function initDriftPage() {
    const paramSel = document.getElementById("drift-param-select");
    const compSel = document.getElementById("drift-component-select");
    if (!paramSel || !compSel) return;

    const drawDrift = () => drawDriftChart(paramSel.value, compSel.value);
    paramSel.onchange = drawDrift;
    compSel.onchange = drawDrift;
    drawDrift();
  }

  function drawDriftChart(param, compId) {
    const container = document.getElementById("drift-chart-container");
    if (!container) return;

    const PARAMS = {
      iddq:  { label: "Iddq Standby Current", unit: "µA", limit: 24.5, baseline: 10.2 },
      ileak: { label: "Gate Oxide Leakage", unit: "µA", limit: 3.12, baseline: 1.4 },
      tpd:   { label: "Propagation Delay", unit: "ns", limit: 135.1, baseline: 120.0 }
    };
    const p = PARAMS[param] || PARAMS.iddq;
    const times = [0, 24, 96, 168];

    // Get data source
    let dataVals;
    if (compId === "LOT_MEDIAN") {
      dataVals = times.map(t => {
        if (t === 0) return p.baseline;
        const vals = componentPool.map(c => c.measurements[`h${t}`]?.[param] || p.baseline);
        vals.sort((a, b) => a - b);
        return vals[Math.floor(vals.length / 2)];
      });
    } else {
      const comp = componentPool.find(c => c.id === compId);
      if (!comp) return;
      dataVals = [
        comp.measurements.h0[param],
        comp.measurements.h24[param],
        comp.measurements.h96[param],
        comp.measurements.h168[param]
      ];
    }

    // Power-law forecast: fit A from h0->h24, extrapolate to 168h
    const A = (dataVals[1] - dataVals[0]) / Math.pow(24, 0.2);
    const forecast168 = dataVals[0] + A * Math.pow(168, 0.2);

    const W = 640, H = 180;
    const pad = { top: 20, right: 65, bottom: 25, left: 55 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    const allVals = [...dataVals, forecast168, p.limit];
    const yMin = Math.min(...allVals) * 0.92;
    const yMax = Math.max(...allVals) * 1.08;

    const xScale = t => pad.left + (t / 168) * chartW;
    const yScale = v => pad.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

    const mkEl = (tag, attrs) => {
      const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
      Object.keys(attrs).forEach(k => el.setAttribute(k, attrs[k]));
      return el;
    };

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("style", "max-height:180px; width:100%; display:block;");

    // Grid lines
    [0, 0.25, 0.5, 0.75, 1].forEach(f => {
      const y = pad.top + f * chartH;
      svg.appendChild(mkEl("line", { x1: pad.left, y1: y, x2: W - pad.right, y2: y, stroke: "#E2E8F0", "stroke-width": "1", "stroke-dasharray": "3 3" }));
      const val = yMax - f * (yMax - yMin);
      const txt = mkEl("text", { x: pad.left - 6, y: y + 4, fill: "#64748B", "font-size": "9", "text-anchor": "end", "font-family": "Inter,sans-serif" });
      txt.textContent = val.toFixed(1);
      svg.appendChild(txt);
    });

    // X Axis labels
    times.forEach(t => {
      const x = xScale(t);
      svg.appendChild(mkEl("line", { x1: x, y1: pad.top, x2: x, y2: H - pad.bottom, stroke: "#E2E8F0", "stroke-width": "1", "stroke-dasharray": "2 4" }));
      const lbl = mkEl("text", { x: x, y: H - pad.bottom + 14, fill: "#64748B", "font-size": "10", "text-anchor": "middle", "font-family": "Inter,sans-serif" });
      lbl.textContent = `${t}h`;
      svg.appendChild(lbl);
    });

    // Drift limit horizontal line
    const yLimitPx = yScale(p.limit);
    svg.appendChild(mkEl("line", { x1: pad.left, y1: yLimitPx, x2: W - pad.right, y2: yLimitPx, stroke: "#DC2626", "stroke-width": "1.5", "stroke-dasharray": "5 3" }));
    const limitLbl = mkEl("text", { x: W - pad.right + 4, y: yLimitPx + 4, fill: "#DC2626", "font-size": "9", "font-family": "Inter,sans-serif" });
    limitLbl.textContent = "Limit";
    svg.appendChild(limitLbl);

    // Power-law forecast curve (dotted orange)
    const curvePts = [];
    for (let t = 24; t <= 168; t += 4) {
      curvePts.push(`${xScale(t).toFixed(1)},${yScale(dataVals[0] + A * Math.pow(t, 0.2)).toFixed(1)}`);
    }
    svg.appendChild(mkEl("polyline", { points: curvePts.join(" "), fill: "none", stroke: "#F59E0B", "stroke-width": "2", "stroke-dasharray": "6 3" }));

    // Measured data polyline (green)
    const measPts = times.map(t => {
      const idx = [0, 24, 96, 168].indexOf(t);
      return `${xScale(t).toFixed(1)},${yScale(dataVals[idx]).toFixed(1)}`;
    }).join(" ");
    svg.appendChild(mkEl("polyline", { points: measPts, fill: "none", stroke: "#10B981", "stroke-width": "2.5" }));

    // Data point circles
    times.forEach((t, i) => {
      svg.appendChild(mkEl("circle", { cx: xScale(t), cy: yScale(dataVals[i]), r: "5", fill: "#10B981", stroke: "#fff", "stroke-width": "1.5" }));
      const lbl = mkEl("text", { x: xScale(t), y: yScale(dataVals[i]) - 8, fill: "#10B981", "font-size": "9", "text-anchor": "middle", "font-weight": "600", "font-family": "Inter,sans-serif" });
      lbl.textContent = dataVals[i].toFixed(1);
      svg.appendChild(lbl);
    });

    // Forecast point at 168h
    svg.appendChild(mkEl("circle", { cx: xScale(168), cy: yScale(forecast168), r: "6", fill: "#F59E0B", stroke: "#fff", "stroke-width": "1.5" }));
    const fLbl = mkEl("text", { x: xScale(168) + 8, y: yScale(forecast168) + 4, fill: "#F59E0B", "font-size": "9", "font-weight": "700", "font-family": "Inter,sans-serif" });
    fLbl.textContent = `${forecast168.toFixed(2)} (pred)`;
    svg.appendChild(fLbl);

    // Axis title
    const axLbl = mkEl("text", { x: 14, y: pad.top + chartH / 2, fill: "#475569", "font-size": "10", "text-anchor": "middle", "transform": `rotate(-90, 14, ${pad.top + chartH / 2})`, "font-family": "Inter,sans-serif" });
    axLbl.textContent = `${p.label} (${p.unit})`;
    svg.appendChild(axLbl);

    container.innerHTML = "";
    container.appendChild(svg);

    // Update Forecast Cards
    updateDriftForecastCards(param, dataVals, forecast168, p);

    // Update Reliability Panel
    updateDriftReliabilityPanel(param, dataVals, forecast168, p, compId);
  }

  function updateDriftForecastCards(activeParam, dataVals, forecast168, p) {
    const PARAMS = {
      iddq:  { label: "Iddq", unit: "µA", limit: 24.5 },
      ileak: { label: "Ileak", unit: "µA", limit: 3.12 },
      tpd:   { label: "tpd", unit: "ns", limit: 135.1 }
    };

    ["iddq", "ileak", "tpd"].forEach(param => {
      let val, lim;
      if (param === activeParam) {
        val = forecast168;
        lim = p.limit;
      } else {
        // Use lot median for other params
        const pm = PARAMS[param];
        const vals168 = componentPool.map(c => c.measurements.h168?.[param] || 0);
        vals168.sort((a, b) => a - b);
        val = vals168[Math.floor(vals168.length / 2)] || 0;
        lim = pm.limit;
      }

      const pm = PARAMS[param];
      const pct = Math.min(100, (val / lim) * 100);
      const exceeded = val > lim;
      const warn = pct > 80;

      const valEl = document.getElementById(`drift-val-${param}`);
      const barEl = document.getElementById(`drift-bar-${param}`);
      const statusEl = document.getElementById(`drift-status-${param}`);
      const cardEl = document.getElementById(`drift-card-${param}`);

      if (valEl) { valEl.textContent = `${val.toFixed(2)} ${pm.unit}`; valEl.style.color = exceeded ? "#DC2626" : warn ? "#D97706" : "#1976B8"; }
      if (barEl) { barEl.style.width = `${pct}%`; barEl.style.background = exceeded ? "#DC2626" : warn ? "#F59E0B" : "#10B981"; }
      if (statusEl) {
        statusEl.textContent = exceeded ? "LIMIT EXCEEDED" : warn ? "APPROACHING LIMIT" : "WITHIN LIMIT";
        statusEl.className = `badge ${exceeded ? "reject" : warn ? "warning" : "pass"}`;
      }
      if (cardEl) {
        cardEl.className = `card stat-box${exceeded ? " reject" : warn ? " monitor" : ""}`;
      }
    });
  }

  function updateDriftReliabilityPanel(param, dataVals, forecast168, p, compId) {
    const panel = document.getElementById("drift-reliability-panel");
    if (!panel) return;

    const exceeded = forecast168 > p.limit;
    const driftPct = ((forecast168 - dataVals[0]) / dataVals[0] * 100).toFixed(1);
    const slope = ((dataVals[1] - dataVals[0]) / 24).toFixed(4);
    const status = exceeded ? "fail" : parseFloat(driftPct) > 30 ? "warn" : "ok";

    const recommendedActionText = exceeded ? "Quarantine Component & Perform Secondary Review" :
                           status === "warn" ? "Secondary QA Review Required" :
                           "Continue Standard Screening";

    panel.innerHTML = `
      <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:14px; border-radius:6px; margin-bottom:10px;">
        <div style="font-size:11px; font-weight:700; color:#0F172A; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">
          🤖 AI FORECAST INTERPRETATION
        </div>
        <div style="display:flex; flex-direction:column; gap:6px; font-size:11px; color:#334155; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="color:${exceeded ? '#DC2626' : '#10B981'}; font-weight:700;">${exceeded ? '✕' : '✓'}</span>
            <span>${exceeded ? 'Accelerated non-linear drift detected' : 'Drift is gradual and within kinetics model'}</span>
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="color:${exceeded ? '#DC2626' : '#10B981'}; font-weight:700;">${exceeded ? '✕' : '✓'}</span>
            <span>${exceeded ? '168h forecast exceeds maximum allowed limit' : 'No critical limit crossing predicted'}</span>
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="color:${exceeded ? '#DC2626' : '#10B981'}; font-weight:700;">${exceeded ? '✕' : '✓'}</span>
            <span>${exceeded ? 'Qualification criteria violated' : 'Component remains fully qualified'}</span>
          </div>
        </div>
        <div style="padding:8px 12px; background:#FFFFFF; border-radius:4px; border:1px solid #CBD5E1; font-size:11px;">
          <span style="font-size:10px; font-weight:700; color:#64748B; text-transform:uppercase; display:block; margin-bottom:2px;">RECOMMENDED ACTION</span>
          <strong style="color:${exceeded ? '#DC2626' : status === 'warn' ? '#D97706' : '#1976B8'};">${recommendedActionText}</strong>
        </div>
      </div>

      <div style="background:#FFFFFF; border:1px solid #E2E8F0; padding:12px; border-radius:6px;">
        <div style="font-size:11px; font-weight:700; color:#0F172A; margin-bottom:4px;">${compId === "LOT_MEDIAN" ? "Lot Median Baseline" : compId} — ${p.label}</div>
        <div style="font-size:11px; color:#475569;">168h Forecast: <strong>${forecast168.toFixed(2)} ${p.unit}</strong> (Limit: ${p.limit} ${p.unit})</div>
        <div style="font-size:11px; color:#64748B; margin-top:2px;">Calculated Drift: <strong>${driftPct}%</strong> | Rate: <strong>${slope} ${p.unit}/hr</strong></div>
      </div>
    `;
  }

  // ==========================================
  // PERSISTENCE: localStorage session backup
  // ==========================================
  const LS_KEY = "predicta_session_history";

  function persistSessionHistory() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(sessionHistory.slice(0, 50)));
    } catch (e) {
      console.warn("Could not persist session history:", e);
    }
  }

  function loadSessionHistory() {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach(h => { if (!sessionHistory.find(s => s.test_id === h.test_id)) sessionHistory.push(h); });
        }
      }
    } catch (e) {
      console.warn("Could not load persisted session history:", e);
    }
  }

  // Load on startup
  loadSessionHistory();

  // ==========================================
  // ADMIN PANEL
  // ==========================================
  const ADMIN_SESSION_KEY = "predicta_admin_session";
  const adminSubmissions = [];

  function initAdminPage() {
    const loginGate = document.getElementById("admin-login-gate");
    const dashboard = document.getElementById("admin-dashboard");
    const navAdminBtn = document.getElementById("nav-admin-btn");

    // Check if already logged in
    const session = (() => { try { return JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY)); } catch { return null; } })();

    if (session && session.role) {
      if (loginGate) loginGate.style.display = "none";
      if (dashboard) dashboard.style.display = "block";
      if (navAdminBtn) navAdminBtn.style.display = "inline-flex";
      const roleBadge = document.getElementById("admin-role-badge");
      if (roleBadge) roleBadge.textContent = session.role.toUpperCase();
    } else {
      if (loginGate) loginGate.style.display = "block";
      if (dashboard) dashboard.style.display = "none";
    }

    // Login button
    const loginBtn = document.getElementById("btn-admin-login");
    if (loginBtn && !loginBtn._bound) {
      loginBtn._bound = true;
      loginBtn.addEventListener("click", async () => {
        const email = document.getElementById("admin-login-email")?.value || "";
        const password = document.getElementById("admin-login-password")?.value || "";
        const errEl = document.getElementById("admin-login-error");

        // Demo credential check (frontend-only for portfolio demo)
        const DEMO_CREDS = { "admin@predicta.io": "sih26", "admin": "sih26", "operator@predicta.io": "sih26" };

        if ((DEMO_CREDS[email] && DEMO_CREDS[email] === password) || password === "sih26") {
          const sessionData = { email, role: email.includes("admin") ? "admin" : "operator", ts: Date.now() };
          localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(sessionData));
          if (navAdminBtn) navAdminBtn.style.display = "inline-flex";
          if (loginGate) loginGate.style.display = "none";
          if (dashboard) dashboard.style.display = "block";
          const roleBadge = document.getElementById("admin-role-badge");
          if (roleBadge) roleBadge.textContent = sessionData.role.toUpperCase();
          initAdminTabNav();
          initAdminComponentForm();
          initAdminCSVUpload();
          initAdminHealthTab();
        } else {
          // Try real API
          try {
            const res = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password })
            });
            if (res.ok) {
              const data = await res.json();
              const sessionData = { email, role: data.role || "operator", token: data.token, ts: Date.now() };
              localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(sessionData));
              if (navAdminBtn) navAdminBtn.style.display = "inline-flex";
              if (loginGate) loginGate.style.display = "none";
              if (dashboard) dashboard.style.display = "block";
              initAdminTabNav();
              initAdminComponentForm();
              initAdminCSVUpload();
              initAdminHealthTab();
            } else {
              if (errEl) { errEl.style.display = "block"; errEl.textContent = "Invalid credentials. Access denied."; }
            }
          } catch {
            if (errEl) { errEl.style.display = "block"; errEl.textContent = "Invalid credentials. Access denied."; }
          }
        }
      });
    }

    // Logout button
    const logoutBtn = document.getElementById("btn-admin-logout");
    if (logoutBtn && !logoutBtn._bound) {
      logoutBtn._bound = true;
      logoutBtn.addEventListener("click", () => {
        localStorage.removeItem(ADMIN_SESSION_KEY);
        if (navAdminBtn) navAdminBtn.style.display = "none";
        if (loginGate) loginGate.style.display = "block";
        if (dashboard) dashboard.style.display = "none";
      });
    }

    // If already logged in, init all sub-components
    if (session && session.role) {
      initAdminTabNav();
      initAdminComponentForm();
      initAdminCSVUpload();
      initAdminHealthTab();
    }
  }

  function initAdminTabNav() {
    document.querySelectorAll(".admin-tab-btn").forEach(btn => {
      if (btn._bound) return;
      btn._bound = true;
      btn.addEventListener("click", () => {
        const tabId = btn.getAttribute("data-tab");
        document.querySelectorAll(".admin-tab-panel").forEach(p => p.style.display = "none");
        document.querySelectorAll(".admin-tab-btn").forEach(b => {
          b.style.borderBottomColor = "transparent";
          b.style.color = "#64748B";
          b.classList.remove("active");
        });
        const panel = document.getElementById(tabId);
        if (panel) panel.style.display = "block";
        btn.style.borderBottomColor = "#1976B8";
        btn.style.color = "#1976B8";
        btn.classList.add("active");
        if (tabId === "tab-health") refreshAdminHealthStatus();
      });
    });
  }

  function initAdminComponentForm() {
    const form = document.getElementById("admin-component-form");
    if (!form || form._bound) return;
    form._bound = true;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("btn-admin-predict");
      if (btn) { btn.disabled = true; btn.textContent = "Running ML Screening..."; }

      const compId = document.getElementById("adm-comp-id")?.value || `COMP-${Date.now().toString().slice(-5)}`;
      const waferId = document.getElementById("adm-wafer-id")?.value.trim() || "WFR-2026-08-01";
      const rawX = document.getElementById("adm-die-x")?.value;
      const rawY = document.getElementById("adm-die-y")?.value;

      let hasSpatial = false;
      let dieX = undefined, dieY = undefined;

      // Coordinate Validation Logic (Requirement 3 & 4)
      if (rawX !== "" && rawY !== "" && rawX !== undefined && rawY !== undefined) {
        dieX = parseFloat(rawX);
        dieY = parseFloat(rawY);
        if (isNaN(dieX) || isNaN(dieY)) {
          alert("Coordinate Error: Die X and Die Y must be valid numerical values.");
          if (btn) { btn.disabled = false; btn.textContent = "▶ Run ML Screening"; }
          return;
        }
        if (Math.abs(dieX) > 6 || Math.abs(dieY) > 6 || (dieX * dieX + dieY * dieY > 40.5)) {
          alert(`Coordinate Error: Position (X: ${dieX}, Y: ${dieY}) is outside circular wafer lattice boundary (Radius <= 6.36).`);
          if (btn) { btn.disabled = false; btn.textContent = "▶ Run ML Screening"; }
          return;
        }
        hasSpatial = true;
      }

      const record = {
        test_id: `ADMIN-${compId}-${Date.now().toString().slice(-4)}`,
        equipment_id: document.getElementById("adm-equipment")?.value || "EQP-101",
        leakage_current: parseFloat(document.getElementById("adm-leakage")?.value) || 120,
        temperature: parseFloat(document.getElementById("adm-temp")?.value) || 25,
        propagation_delay: parseFloat(document.getElementById("adm-tpd")?.value) || 11.5,
        dynamic_power: parseFloat(document.getElementById("adm-power")?.value) || 42,
        supply_voltage: parseFloat(document.getElementById("adm-voltage")?.value) || 1.2,
        frequency: parseFloat(document.getElementById("adm-freq")?.value) || 2500,
        output_voltage: 1.18, current: 40, resistance: 12, capacitance: 4,
        threshold_voltage: 0.45, setup_time: 1.2, hold_time: 0.8,
        timing_margin: 2.0, total_power: 52, test_duration: 12
      };

      try {
        const result = await predictMeasurementRecord(record);

        // Show result
        const emptyEl = document.getElementById("admin-result-empty");
        const contentEl = document.getElementById("admin-result-content");
        if (emptyEl) emptyEl.style.display = "none";
        if (contentEl) contentEl.style.display = "block";

        const isFail = result.prediction === "FAIL";
        const badge = document.getElementById("adm-res-badge");
        if (badge) { badge.textContent = result.prediction; badge.className = `badge ${isFail ? "reject" : "pass"}`; badge.style.fontSize = "16px"; badge.style.padding = "10px 24px"; }
        const probEl = document.getElementById("adm-res-prob");
        if (probEl) { probEl.textContent = `${(result.probability * 100).toFixed(1)}%`; probEl.style.color = isFail ? "#DC2626" : "#1976B8"; }
        const tidEl = document.getElementById("adm-res-testid");
        if (tidEl) tidEl.textContent = result.test_id || record.test_id;
        const riskEl = document.getElementById("adm-res-risk");
        if (riskEl) riskEl.textContent = result.risk_level || "LOW";
        const decEl = document.getElementById("adm-res-decision");
        if (decEl) decEl.textContent = result.operational_decision || (isFail ? "QUARANTINE" : "PASS");
        const lcEl = document.getElementById("adm-res-lifecycle");
        if (lcEl) lcEl.textContent = result.lifecycle_state || (isFail ? "QUARANTINED" : "PREDICTED");
        const reasonEl = document.getElementById("adm-res-reason");
        if (reasonEl) reasonEl.textContent = result.decision_reason || "Analysis complete.";
        
        const spatialEl = document.getElementById("adm-res-spatial");
        if (spatialEl) {
          if (hasSpatial) {
            spatialEl.textContent = `✓ Registered on ${waferId} (X:${dieX}, Y:${dieY})`;
            spatialEl.style.color = "#16A34A";
          } else {
            spatialEl.textContent = "Spatial Status: Coordinates unavailable (Non-spatial test)";
            spatialEl.style.color = "#64748B";
          }
        }

        // If spatial metadata exists, safely merge into componentPool & wafer registry
        if (hasSpatial) {
          const existingDie = componentPool.find(c => c.wafer_id === waferId && c.die_x === dieX && c.die_y === dieY);
          if (existingDie) {
            existingDie.status = isFail ? "REJECT" : (result.probability >= 0.20 ? "MONITOR" : "PASS");
            existingDie.probability = result.probability;
            existingDie.anomaly_score = isFail ? 8.5 : 2.0;
            existingDie.reason = result.decision_reason;
          } else {
            componentPool.push({
              id: compId,
              lot_id: "LOT-ADMIN-ENTRY",
              wafer_id: waferId,
              die_x: dieX,
              die_y: dieY,
              measurements: {
                h0: { iddq: record.leakage_current * 0.8, ileak: 1.5, tpd: record.propagation_delay },
                h24: { iddq: record.leakage_current, ileak: 1.8, tpd: record.propagation_delay }
              },
              anomaly_score: isFail ? 8.5 : 2.0,
              probability: result.probability,
              predicted_168h: { iddq: record.leakage_current * 1.2, tpd: record.propagation_delay * 1.05 },
              drift_slope: { iddq: 0.1, tpd: 0.05 },
              status: isFail ? "REJECT" : (result.probability >= 0.20 ? "MONITOR" : "PASS"),
              reason: result.decision_reason,
              shap: { iddq: 0.5, ileak: 0.3, tpd: 0.2 }
            });
          }

          // Register Wafer in selector dropdown if not present
          const selector = document.getElementById("spatial-wafer-selector");
          if (selector) {
            let optExists = Array.from(selector.options).some(opt => opt.value === waferId);
            if (!optExists) {
              const newOpt = document.createElement("option");
              newOpt.value = waferId;
              newOpt.textContent = `${waferId} (Admin Upload Wafer)`;
              selector.appendChild(newOpt);
            }
            selector.value = waferId;
            localStorage.setItem("predicta_selected_wafer", waferId);
            renderWaferMap(waferId);
          }
        }

        // Add to submissions table
        adminSubmissions.unshift({ timestamp: new Date().toLocaleTimeString(), comp_id: compId, equipment: record.equipment_id, prediction: result.prediction, probability: result.probability, decision: result.operational_decision || (isFail ? "QUARANTINE" : "PASS") });
        renderAdminSubmissionsTable();

        // Also add to sessionHistory
        addPredictionToHistory(result);

      } catch (err) {
        alert(`ML Screening failed: ${err.message}`);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = "▶ Run ML Screening"; }
      }
    });
  }

  function renderAdminSubmissionsTable() {
    const tbody = document.getElementById("admin-submissions-body");
    if (!tbody) return;
    if (adminSubmissions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#64748B; font-size:12px;">No submissions yet this session.</td></tr>`;
      return;
    }
    tbody.innerHTML = adminSubmissions.slice(0, 10).map(s => {
      const isFail = s.prediction === "FAIL";
      return `<tr>
        <td>${s.timestamp}</td>
        <td><strong>${s.comp_id}</strong></td>
        <td>${s.equipment}</td>
        <td><span class="badge ${isFail ? "reject" : "pass"}">${s.prediction}</span></td>
        <td><strong>${(s.probability * 100).toFixed(1)}%</strong></td>
        <td>${s.decision}</td>
      </tr>`;
    }).join("");
  }

  function initAdminCSVUpload() {
    const zone = document.getElementById("csv-upload-zone");
    const fileInput = document.getElementById("csv-file-input");
    const browseBtn = document.getElementById("btn-csv-browse");
    const runBtn = document.getElementById("btn-csv-run");
    const clearBtn = document.getElementById("btn-csv-clear");
    if (!zone || !fileInput) return;
    if (zone._bound) return;
    zone._bound = true;

    let parsedRows = [];

    const handleFile = file => {
      if (!file || !file.name.endsWith(".csv")) { alert("Please select a .csv file."); return; }
      const reader = new FileReader();
      reader.onload = e => {
        const text = e.target.result;
        const lines = text.split("\n").filter(l => l.trim());
        if (lines.length < 2) { alert("CSV is empty or missing data rows."); return; }
        const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
        parsedRows = lines.slice(1, 501).map((line, idx) => {
          const vals = line.split(",");
          const row = {};
          headers.forEach((h, i) => row[h] = (vals[i] || "").trim());
          row._idx = idx + 1;
          row._valid = headers.includes("component_id") && !isNaN(parseFloat(row.leakage_current));
          return row;
        }).filter(r => r.component_id || r._valid);

        renderCSVPreview(parsedRows);
        if (runBtn) runBtn.style.display = "inline-flex";
        if (clearBtn) clearBtn.style.display = "inline-flex";
      };
      reader.readAsText(file);
    };

    zone.addEventListener("click", () => fileInput.click());
    zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("drag-over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
    zone.addEventListener("drop", e => { e.preventDefault(); zone.classList.remove("drag-over"); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
    fileInput.addEventListener("change", () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });
    if (browseBtn && !browseBtn._bound) { browseBtn._bound = true; browseBtn.addEventListener("click", () => fileInput.click()); }

    if (runBtn && !runBtn._bound) {
      runBtn._bound = true;
      runBtn.addEventListener("click", async () => {
        if (!parsedRows.length) return;
        runBtn.disabled = true;
        runBtn.textContent = `Running ML screening on ${parsedRows.length} records...`;

        const validRows = parsedRows.filter(r => r._valid !== false);
        const records = validRows.map(r => ({
          test_id: `CSV-${r.component_id || r._idx}`,
          equipment_id: r.equipment_id || "EQP-CSV",
          leakage_current: parseFloat(r.leakage_current) || 120,
          temperature: parseFloat(r.temperature) || 25,
          propagation_delay: parseFloat(r.propagation_delay) || 11.5,
          dynamic_power: parseFloat(r.dynamic_power) || 42,
          supply_voltage: parseFloat(r.supply_voltage) || 1.2,
          frequency: parseFloat(r.frequency) || 2500,
          output_voltage: 1.18, current: 40, resistance: 12, capacitance: 4,
          threshold_voltage: 0.45, setup_time: 1.2, hold_time: 0.8,
          timing_margin: 2.0, total_power: 52, test_duration: 12
        }));

        try {
          const batchRes = await predictMeasurementBatch(records);
          
          // Merge valid spatial rows into componentPool (Requirement 3 & 6)
          validRows.forEach((r, idx) => {
            const res = batchRes.results[idx];
            if (!res) return;
            const dx = parseFloat(r.die_x);
            const dy = parseFloat(r.die_y);
            const wId = (r.wafer_id || "WFR-CSV-BATCH").trim();
            if (!isNaN(dx) && !isNaN(dy) && Math.abs(dx) <= 6 && Math.abs(dy) <= 6 && (dx * dx + dy * dy <= 40.5)) {
              const isFail = res.prediction === "FAIL";
              componentPool.push({
                id: r.component_id || `COMP-CSV-${idx + 1}`,
                lot_id: r.lot_id || "LOT-CSV-UPLOAD",
                wafer_id: wId,
                die_x: dx,
                die_y: dy,
                measurements: {
                  h0: { iddq: (parseFloat(r.leakage_current) || 10) * 0.8, ileak: 1.5, tpd: parseFloat(r.propagation_delay) || 120 },
                  h24: { iddq: parseFloat(r.leakage_current) || 12, ileak: 1.8, tpd: parseFloat(r.propagation_delay) || 121 }
                },
                anomaly_score: isFail ? 8.5 : 2.0,
                probability: res.probability,
                predicted_168h: { iddq: (parseFloat(r.leakage_current) || 12) * 1.2, tpd: (parseFloat(r.propagation_delay) || 120) * 1.05 },
                drift_slope: { iddq: 0.1, tpd: 0.05 },
                status: isFail ? "REJECT" : (res.probability >= 0.20 ? "MONITOR" : "PASS"),
                reason: res.decision_reason || "CSV uploaded batch die measurement.",
                shap: { iddq: 0.5, ileak: 0.3, tpd: 0.2 }
              });

              // Register Wafer in selector dropdown
              const selector = document.getElementById("spatial-wafer-selector");
              if (selector) {
                let optExists = Array.from(selector.options).some(opt => opt.value === wId);
                if (!optExists) {
                  const newOpt = document.createElement("option");
                  newOpt.value = wId;
                  newOpt.textContent = `${wId} (CSV Upload Wafer)`;
                  selector.appendChild(newOpt);
                }
              }
            }
          });

          renderCSVBatchResults(batchRes, validRows);
          refreshDashboardAnalytics();
        } catch (err) {
          alert(`Batch screening failed: ${err.message}`);
        } finally {
          runBtn.disabled = false;
          runBtn.textContent = "▶ Run Batch Screening";
        }
      });
    }

    if (clearBtn && !clearBtn._bound) {
      clearBtn._bound = true;
      clearBtn.addEventListener("click", () => {
        parsedRows = [];
        fileInput.value = "";
        const valCard = document.getElementById("csv-validation-card");
        const resCard = document.getElementById("csv-results-card");
        if (valCard) valCard.style.display = "none";
        if (resCard) resCard.style.display = "none";
        if (runBtn) runBtn.style.display = "none";
        if (clearBtn) clearBtn.style.display = "none";
      });
    }
  }

  function renderCSVPreview(rows) {
    const card = document.getElementById("csv-validation-card");
    const tbody = document.getElementById("csv-preview-body");
    const stats = document.getElementById("csv-validation-stats");
    if (!card || !tbody) return;

    const valid = rows.filter(r => r._valid !== false).length;
    const invalid = rows.length - valid;
    if (stats) stats.textContent = `${rows.length} rows parsed | ${valid} valid | ${invalid} invalid`;

    tbody.innerHTML = rows.slice(0, 20).map(r => {
      const ok = r._valid !== false;
      return `<tr>
        <td>${r._idx}</td>
        <td><strong>${r.component_id || "—"}</strong></td>
        <td>${r.leakage_current || "—"}</td>
        <td>${r.temperature || "—"}</td>
        <td>${r.propagation_delay || "—"}</td>
        <td>${r.dynamic_power || "—"}</td>
        <td><span class="badge ${ok ? 'pass' : 'reject'}" style="font-size:9px;">${ok ? "✓ OK" : "✗ INVALID"}</span></td>
      </tr>`;
    }).join("");

    card.style.display = "block";
  }

  function renderCSVBatchResults(batchRes, rows) {
    const card = document.getElementById("csv-results-card");
    const summary = document.getElementById("csv-batch-summary");
    const tbody = document.getElementById("csv-results-body");
    if (!card || !tbody) return;

    if (summary) {
      summary.innerHTML = `
        <span>Total: <strong>${batchRes.total}</strong></span>
        <span style="color:#16A34A;">Pass: <strong>${batchRes.pass_count}</strong></span>
        <span style="color:#DC2626;">Fail: <strong>${batchRes.fail_count}</strong></span>
        <span>Fail Rate: <strong>${((batchRes.fail_count / batchRes.total) * 100).toFixed(1)}%</strong></span>
      `;
    }

    tbody.innerHTML = batchRes.results.map((r, i) => {
      const isFail = r.prediction === "FAIL";
      const compId = rows[i]?.component_id || `BATCH-${i + 1}`;
      return `<tr>
        <td><strong>${compId}</strong></td>
        <td><span class="badge ${isFail ? 'reject' : 'pass'}">${r.prediction}</span></td>
        <td><strong>${(r.probability * 100).toFixed(1)}%</strong></td>
        <td>${r.risk_level}</td>
        <td>${r.operational_decision || (isFail ? "QUARANTINE" : "PASS")}</td>
      </tr>`;
    }).join("");

    card.style.display = "block";
  }

  function initAdminHealthTab() {
    refreshAdminHealthStatus();
    const refreshBtn = document.getElementById("btn-admin-health-refresh");
    if (refreshBtn && !refreshBtn._bound) {
      refreshBtn._bound = true;
      refreshBtn.addEventListener("click", refreshAdminHealthStatus);
    }
  }

  async function refreshAdminHealthStatus() {
    const log = document.getElementById("admin-health-log");
    const apiStatus = document.getElementById("admin-api-status");
    const apiDetail = document.getElementById("admin-api-detail");
    const modelVer = document.getElementById("admin-model-version");
    const threshold = document.getElementById("admin-threshold");

    if (log) log.textContent = "[" + new Date().toLocaleTimeString() + "] Checking system status...\n";

    try {
      const health = await checkMLAPIHealth();
      const isOnline = health.status === "ok";
      if (apiStatus) { apiStatus.textContent = isOnline ? "ONLINE" : "OFFLINE"; apiStatus.style.color = isOnline ? "#16A34A" : "#DC2626"; }
      if (apiDetail) apiDetail.textContent = isOnline ? "All endpoints responding" : "Fallback mode active";
      if (modelVer) modelVer.textContent = health.version || "2.0_production";
      if (threshold) threshold.textContent = health.threshold ? health.threshold.toFixed(2) : "0.20";

      const logLines = [
        `[${new Date().toLocaleTimeString()}] API /health → ${isOnline ? "200 OK" : "OFFLINE"}`,
        `[${new Date().toLocaleTimeString()}] Model Version: ${health.version || "2.0_production"}`,
        `[${new Date().toLocaleTimeString()}] Operating Threshold: ${health.threshold ? health.threshold.toFixed(2) : "0.20"}`,
        `[${new Date().toLocaleTimeString()}] Mode: ${health.status === "ok" ? "PRODUCTION SERVERLESS" : "LOCAL FALLBACK"}`,
        `[${new Date().toLocaleTimeString()}] Session Records: ${sessionHistory.length}`,
        `[${new Date().toLocaleTimeString()}] Admin Submissions: ${adminSubmissions.length}`,
        `[${new Date().toLocaleTimeString()}] localStorage: ${localStorage.length} keys stored`,
      ];
      if (log) log.textContent = logLines.join("\n");
    } catch (err) {
      if (apiStatus) { apiStatus.textContent = "ERROR"; apiStatus.style.color = "#DC2626"; }
      if (log) log.textContent += `\n[${new Date().toLocaleTimeString()}] ERROR: ${err.message}`;
    }
  }

  // Enhanced addPredictionToHistory — persists to localStorage and updates decision analytics bar
  function addPredictionToHistory(result) {
    // Add lifecycle_state and operational_decision to session history entry
    sessionHistory.unshift({
      timestamp: new Date().toLocaleTimeString(),
      test_id: result.test_id || `TEST-${Math.floor(1000 + Math.random() * 9000)}`,
      equipment: result.equipment_id || "EQP-101",
      prediction: result.prediction,
      probability: result.probability,
      risk_level: result.risk_level,
      operational_decision: result.operational_decision || (result.prediction === "FAIL" ? "QUARANTINE" : "PASS"),
      lifecycle_state: result.lifecycle_state || (result.prediction === "FAIL" ? "QUARANTINED" : "PREDICTED")
    });

    persistSessionHistory();

    const tbody = document.getElementById("history-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";
    sessionHistory.slice(0, 10).forEach(h => {
      const tr = document.createElement("tr");
      const isFail = h.prediction === "FAIL";
      const predBadge = isFail ? `<span class="badge reject">FAIL</span>` : `<span class="badge pass">PASS</span>`;
      const stateClass = h.lifecycle_state === "QUARANTINED" ? "reject" : h.lifecycle_state === "REVIEW_REQUIRED" ? "warning" : "pass";
      tr.innerHTML = `
        <td>${h.timestamp}</td>
        <td><strong>${h.test_id}</strong></td>
        <td>${h.equipment}</td>
        <td>${predBadge}</td>
        <td><strong>${(h.probability * 100).toFixed(1)}%</strong></td>
        <td><span class="badge" style="background-color:rgba(255,255,255,0.05);">${h.operational_decision || 'PASS'}</span></td>
        <td><span class="badge ${stateClass}" style="font-size:9px;">${h.lifecycle_state || 'PREDICTED'}</span></td>
      `;
      tbody.appendChild(tr);
    });

    updateDecisionAnalyticsBar(sessionHistory.slice(0, 20));
  }

  // Update admin authentication UI on DOM ready
  window.updateAdminAuthStateUI();

  // Admin Data Input Portal Initializer
  function getNumericInput(id, fallback = null) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const val = el.value ? el.value.trim() : "";
    if (val === "") return fallback;
    const num = Number(val);
    return Number.isFinite(num) ? num : fallback;
  }

  function initAdminInputPortal() {
    const form = document.getElementById("form-admin-input");
    if (!form || form._bound) return;
    form._bound = true;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("btn-adm-in-submit");

      const compId = document.getElementById("adm-in-comp-id")?.value ? document.getElementById("adm-in-comp-id").value.trim() : "";
      const deviceId = document.getElementById("adm-in-device-id")?.value ? document.getElementById("adm-in-device-id").value.trim() : "";
      const lotId = document.getElementById("adm-in-lot-id")?.value ? document.getElementById("adm-in-lot-id").value.trim() : "";
      const waferId = document.getElementById("adm-in-wafer-id")?.value ? document.getElementById("adm-in-wafer-id").value.trim() : "";
      const equipmentId = document.getElementById("adm-in-equipment")?.value ? document.getElementById("adm-in-equipment").value.trim() : "";
      const compType = document.getElementById("adm-in-type")?.value ? document.getElementById("adm-in-type").value.trim() : "";

      const rawTemp = getNumericInput("adm-in-temp");
      const rawVolt = getNumericInput("adm-in-voltage");
      const rawFreq = getNumericInput("adm-in-freq");
      const rawDuration = getNumericInput("adm-in-duration");
      const rawIddq = getNumericInput("adm-in-iddq");
      const rawLeak = getNumericInput("adm-in-leakage");
      const rawTpd = getNumericInput("adm-in-tpd");
      const rawPow = getNumericInput("adm-in-power");

      // Validate: Do not silently substitute empty or zero inputs with fake telemetry
      const isMissingText = !compId || !lotId || !equipmentId;
      const isMissingNumbers = rawTemp === null || rawVolt === null || rawFreq === null || rawLeak === null || rawTpd === null || rawPow === null;
      const isZeroNonPhysical = rawVolt <= 0 || rawFreq <= 0 || rawTpd <= 0;

      if (isMissingText || isMissingNumbers || isZeroNonPhysical) {
        alert("Please enter valid qualification telemetry before running analysis.");
        return;
      }

      if (btn) { btn.disabled = true; btn.textContent = "Processing qualification telemetry... Running ML inference..."; }

      // Physical telemetry bounded calculations without replacing zero or actual user inputs
      const temp = Math.min(175.0, Math.max(-40.0, rawTemp));
      const vSup = Math.min(3.3, Math.max(0.5, rawVolt));
      const freq = Math.min(10000.0, Math.max(10.0, rawFreq));
      const iLeak = Math.min(5000.0, Math.max(0.0, rawLeak));
      const tPd = Math.min(99.0, Math.max(0.01, rawTpd));
      const pDyn = Math.min(1000.0, Math.max(0.0, rawPow));
      const iddq = Math.min(500.0, Math.max(0.0, rawIddq !== null ? rawIddq : 0.0));

      const setupTime = Math.max(0.1, Number((1.2 * (tPd / 11.5)).toFixed(2)));
      const holdTime = Math.max(0.1, Number((0.8 * (11.5 / Math.max(1.0, tPd))).toFixed(2)));
      const timingMargin = Math.max(0.01, Number((2.0 * (11.5 / Math.max(1.0, tPd))).toFixed(2)));
      const vTh = Math.max(0.1, Number((0.45 - 0.0008 * (temp - 25.0)).toFixed(3)));
      const iCurrent = Math.max(1.0, Number((40.0 * (vSup / 1.2)).toFixed(2)));
      const Rchannel = Math.max(0.1, Number((12.0 * (1.2 / Math.max(0.5, vSup))).toFixed(2)));
      const vOut = Math.max(0.4, Number((vSup - 0.02).toFixed(3)));
      const pTot = Math.min(2000.0, Number((pDyn + (iddq * vSup / 1000.0)).toFixed(2)));

      const record = {
        test_id: `ADM-${compId}-${Date.now().toString().slice(-4)}`,
        lot_id: lotId,
        wafer_id: waferId || "WFR-2026-01",
        equipment_id: equipmentId,
        leakage_current: iLeak,
        temperature: temp,
        propagation_delay: tPd,
        dynamic_power: pDyn,
        supply_voltage: vSup,
        frequency: freq,
        iddq_standby: iddq,
        output_voltage: vOut,
        current: iCurrent,
        resistance: Rchannel,
        capacitance: 4.0,
        threshold_voltage: vTh,
        setup_time: setupTime,
        hold_time: holdTime,
        timing_margin: timingMargin,
        total_power: pTot,
        test_duration: rawDuration ? Math.max(1.0, rawDuration) : 12.0
      };

      try {
        console.log("[PREDICTA ML INFERENCE] Sending dynamic telemetry payload:", record);
        const result = await predictMeasurementRecord(record);
        console.log("[PREDICTA ML INFERENCE] Received live inference response:", result);

        updateQualificationResultUI(result, record);

        addPredictionToHistory(result);
        refreshDashboardAnalytics();
      } catch (err) {
        alert(`Qualification Analysis Error: ${err.message || "Failed to execute inference"}`);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = "▶ Run Qualification Analysis"; }
      }
    });

    const resetBtn = document.getElementById("btn-adm-analyze-another");
    if (resetBtn && !resetBtn._bound) {
      resetBtn._bound = true;
      resetBtn.addEventListener("click", () => window.resetAdminQualificationWorkflow());
    }
  }

  function updateQualificationResultUI(result, record) {
    const emptyEl = document.getElementById("adm-in-result-empty");
    const contentEl = document.getElementById("adm-in-result-content");
    if (emptyEl) emptyEl.style.display = "none";
    if (contentEl) contentEl.style.display = "block";

    const compId = record.test_id || record.component_id || "COMP-00301";
    const lotId = record.lot_id || "LOT-2026-08-A17";
    const disp = result.disposition || (result.operational_decision === "REJECT" || result.operational_decision === "FAIL" || result.probability >= 0.65 ? "REJECT" : (result.operational_decision === "MONITOR" || result.operational_decision === "SECONDARY_TEST" || result.probability >= 0.20 ? "MONITOR" : "PASS"));

    // 1. Badge & Header
    const resBadge = document.getElementById("adm-in-res-badge");
    if (resBadge) {
      if (disp === "REJECT") {
        resBadge.textContent = "REJECT";
        resBadge.className = "badge reject";
        resBadge.style.background = "#FEE2E2";
        resBadge.style.color = "#DC2626";
      } else if (disp === "MONITOR") {
        resBadge.textContent = "MONITOR";
        resBadge.className = "badge warning";
        resBadge.style.background = "#FEF3C7";
        resBadge.style.color = "#D97706";
      } else {
        resBadge.textContent = "PASS";
        resBadge.className = "badge pass";
        resBadge.style.background = "#D1FAE5";
        resBadge.style.color = "#059669";
      }
    }

    const resId = document.getElementById("adm-in-res-id");
    if (resId) resId.textContent = `${compId} (${lotId})`;

    const resSummary = document.getElementById("adm-in-res-summary");
    if (resSummary) {
      if (disp === "REJECT") resSummary.textContent = "Critical reliability risk detected. Component rejected.";
      else if (disp === "MONITOR") resSummary.textContent = "Elevated risk or parameter drift detected. Secondary QA review required.";
      else resSummary.textContent = "Low predicted failure risk. All reliability evidence nominal.";
    }

    const actionMap = {
      "PROCEED_STANDARD_SCREENING": "Proceed to Standard Screening",
      "RECOMMEND_SECONDARY_QA_REVIEW": "Secondary QA Review Required",
      "QUARANTINE_REJECT_RECOMMENDATION": "Quarantine Component"
    };
    const rawAction = result.recommended_action || (disp === "REJECT" ? "QUARANTINE_REJECT_RECOMMENDATION" : (disp === "MONITOR" ? "RECOMMEND_SECONDARY_QA_REVIEW" : "PROCEED_STANDARD_SCREENING"));
    const resActionText = document.getElementById("adm-in-res-action-text");
    if (resActionText) {
      resActionText.textContent = `RECOMMENDED ACTION: ${actionMap[rawAction] || rawAction.replace(/_/g, " ")}`;
    }

    // Derive canonical statuses from backend result (with exact fallbacks if legacy)
    const mlRiskStatus = result.ml_risk_status || (result.probability >= 0.65 ? "HIGH" : (result.probability >= 0.20 ? "ELEVATED" : "LOW"));
    const rawAnomaly = result.anomaly_status || (result.ml_details?.anomaly_detection?.overall_status === "ANOMALOUS" ? "REJECT" : (result.ml_details?.anomaly_detection?.overall_status || "NORMAL"));
    const anomalyStatus = rawAnomaly === "ANOMALOUS" ? "REJECT" : rawAnomaly;
    const driftStatus = result.drift_status || "WITHIN";

    // 2. Key Evidence Cards
    // Card 1: ML Failure Risk
    const resProb = document.getElementById("adm-in-res-prob");
    if (resProb) {
      resProb.textContent = `${(result.probability * 100).toFixed(1)}%`;
      resProb.style.color = mlRiskStatus === "HIGH" ? "#DC2626" : (mlRiskStatus === "ELEVATED" ? "#D97706" : "#10B981");
    }
    const resProbLabel = document.getElementById("adm-in-res-prob-label");
    if (resProbLabel) {
      resProbLabel.textContent = `${mlRiskStatus} RISK`;
      resProbLabel.className = `badge ${mlRiskStatus === "HIGH" ? "reject" : (mlRiskStatus === "ELEVATED" ? "warning" : "pass")}`;
    }

    // Card 2: Anomaly Detection
    const resPat = document.getElementById("adm-in-res-pat");
    if (resPat) {
      resPat.textContent = anomalyStatus === "REJECT" ? "CRITICAL ANOMALY" : (anomalyStatus === "MONITOR" ? "ELEVATED ANOMALY" : "NORMAL");
      resPat.style.color = anomalyStatus === "REJECT" ? "#DC2626" : (anomalyStatus === "MONITOR" ? "#D97706" : "#0F172A");
    }
    const resPatSub = document.getElementById("adm-in-res-pat-sub");
    if (resPatSub) {
      resPatSub.textContent = anomalyStatus === "REJECT" ? "PAT / COPOD Flagged (Reject)" : (anomalyStatus === "MONITOR" ? "PAT / COPOD Warning (Monitor)" : "No abnormal behavior");
    }

    // Card 3: Drift Forecast
    const resDrift = document.getElementById("adm-in-res-drift");
    if (resDrift) {
      resDrift.textContent = driftStatus === "EXCEEDED" ? "EXCEEDS LIMITS" : (driftStatus === "WARNING" ? "DRIFT WARNING" : "WITHIN LIMITS");
      resDrift.style.color = driftStatus === "EXCEEDED" ? "#DC2626" : (driftStatus === "WARNING" ? "#D97706" : "#0F172A");
    }
    const resDriftSub = document.getElementById("adm-in-res-drift-sub");
    if (resDriftSub) {
      resDriftSub.textContent = driftStatus === "EXCEEDED" ? "Drift limit exceeded" : (driftStatus === "WARNING" ? "Drift warning threshold reached" : "Predicted shift: within bounds");
    }

    // 3. Reliability Decision Checklist
    const chkMlRisk = document.getElementById("chk-ml-risk");
    if (chkMlRisk) {
      if (mlRiskStatus === "HIGH") {
        chkMlRisk.innerHTML = `<span style="color:#DC2626;">❌ High Risk (P ≥ 0.65)</span>`;
      } else if (mlRiskStatus === "ELEVATED") {
        chkMlRisk.innerHTML = `<span style="color:#D97706;">⚠ Elevated Risk (P ≥ 0.20)</span>`;
      } else {
        chkMlRisk.innerHTML = `<span style="color:#10B981;">✓ Low Risk (P &lt; 0.20)</span>`;
      }
    }
    const chkAnomaly = document.getElementById("chk-anomaly");
    if (chkAnomaly) {
      if (anomalyStatus === "REJECT") {
        chkAnomaly.innerHTML = `<span style="color:#DC2626;">❌ Critical Anomaly (Reject)</span>`;
      } else if (anomalyStatus === "MONITOR") {
        chkAnomaly.innerHTML = `<span style="color:#D97706;">⚠ Anomaly Warning (Monitor)</span>`;
      } else {
        chkAnomaly.innerHTML = `<span style="color:#10B981;">✓ Normal Baseline</span>`;
      }
    }
    const chkDrift = document.getElementById("chk-drift");
    if (chkDrift) {
      if (driftStatus === "EXCEEDED") {
        chkDrift.innerHTML = `<span style="color:#DC2626;">❌ Exceeds Limit</span>`;
      } else if (driftStatus === "WARNING") {
        chkDrift.innerHTML = `<span style="color:#D97706;">⚠ Drift Warning</span>`;
      } else {
        chkDrift.innerHTML = `<span style="color:#10B981;">✓ Within Limits</span>`;
      }
    }
    const chkOverall = document.getElementById("chk-overall-badge");
    if (chkOverall) {
      if (disp === "REJECT") {
        chkOverall.textContent = "Critical Risk Detected";
        chkOverall.className = "badge reject";
      } else if (disp === "MONITOR") {
        chkOverall.textContent = "Review Needed";
        chkOverall.className = "badge warning";
      } else {
        chkOverall.textContent = "All Evidence Nominal";
        chkOverall.className = "badge pass";
      }
    }

    // 4. Rationale
    const resRationale = document.getElementById("adm-in-res-rationale");
    if (resRationale) {
      resRationale.textContent = result.decision_reason || result.explanation?.summary ||
        `Component ${compId} evaluated under ${record.temperature || 24}°C, ${record.supply_voltage || 1.2}V. Failure risk ${(result.probability * 100).toFixed(1)}% evaluated against operational threshold 0.20. Operational disposition: ${disp}.`;
    }

    // Also support old elements if present
    const resDecision = document.getElementById("adm-in-res-decision");
    if (resDecision) resDecision.textContent = disp;
    const resState = document.getElementById("adm-in-res-state");
    if (resState) resState.textContent = `Lifecycle: ${result.lifecycle_state || (disp === "REJECT" ? "QUARANTINED" : (disp === "MONITOR" ? "REVIEW_REQUIRED" : "PREDICTED"))}`;
    const techResProb = document.getElementById("tech-res-prob");
    if (techResProb) techResProb.textContent = `${(result.probability * 100).toFixed(1)}%`;
  }
  window.updateQualificationResultUI = updateQualificationResultUI;

  function resetAdminQualificationWorkflow() {
    console.log("[PREDICTA ADMIN] Executing resetAdminQualificationWorkflow()...");

    // 1. Reset Application State
    window.currentPrediction = null;
    window.currentResult = null;
    window.lastApiResponse = null;

    // 2. Reset Form Fields explicitly
    const form = document.getElementById("form-admin-input");
    if (form) {
      form.reset();

      const textInputs = form.querySelectorAll('input[type="text"], input:not([type="number"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])');
      textInputs.forEach(input => {
        input.value = "";
      });

      const numberInputs = form.querySelectorAll('input[type="number"]');
      numberInputs.forEach(input => {
        input.value = "0";
      });

      const textIds = ["adm-in-comp-id", "adm-in-device-id", "adm-in-lot-id", "adm-in-wafer-id", "adm-in-equipment", "adm-in-type"];
      const numIds = ["adm-in-temp", "adm-in-voltage", "adm-in-freq", "adm-in-duration", "adm-in-iddq", "adm-in-leakage", "adm-in-tpd", "adm-in-power"];

      textIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      numIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "0";
      });
    }

    // 3. Reset Result UI View
    const emptyEl = document.getElementById("adm-in-result-empty");
    const contentEl = document.getElementById("adm-in-result-content");
    if (emptyEl) emptyEl.style.display = "block";
    if (contentEl) contentEl.style.display = "none";

    const resId = document.getElementById("adm-in-res-id");
    const resBadge = document.getElementById("adm-in-res-badge");
    const resProb = document.getElementById("adm-in-res-prob");
    const resDecision = document.getElementById("adm-in-res-decision");
    const resState = document.getElementById("adm-in-res-state");
    const resRationale = document.getElementById("adm-in-res-rationale");

    if (resId) resId.textContent = "";
    if (resBadge) { resBadge.textContent = ""; resBadge.className = "badge"; }
    if (resProb) { resProb.textContent = ""; resProb.style.color = ""; }
    if (resDecision) resDecision.textContent = "";
    if (resState) resState.textContent = "";
    if (resRationale) resRationale.textContent = "";

    // 4. Ensure navigation back to Admin Input
    if (typeof window.switchPage === "function") {
      window.switchPage("page-admin-input");
    }

    // 5. Scroll into view and focus Component ID field
    setTimeout(() => {
      const compInput = document.getElementById("adm-in-comp-id");
      if (compInput) {
        compInput.scrollIntoView({ behavior: "smooth", block: "center" });
        compInput.focus();
      }
    }, 100);
  }

  // Global Event Delegation Listener on Document to survive dynamic rendering
  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!target) return;
    const clearBtn = target.closest("#btn-adm-clear-form, [data-action='clear-admin-form']");
    const analyzeAnotherBtn = target.closest("#btn-adm-analyze-another, [data-action='analyze-another-component']");

    if (clearBtn || analyzeAnotherBtn) {
      e.preventDefault();
      window.resetAdminQualificationWorkflow();
    }
  });

  // Global exports for inline button clicks and external script callers
  window.resetAdminQualificationWorkflow = resetAdminQualificationWorkflow;
  window.startNewComponentAnalysis = resetAdminQualificationWorkflow;
  window.clearAdminForm = resetAdminQualificationWorkflow;
  window.resetAdminDataEntryForm = resetAdminQualificationWorkflow;
  window.switchPage = switchPage;
  window.selectSpatialDie = selectSpatialDie;
  window.detectSpatialHotspots = detectSpatialHotspots;
  window.calculateRegionalAnalysis = calculateRegionalAnalysis;
  window.renderSingleResult = renderSingleResult;
  window.initAdminInputPortal = initAdminInputPortal;

  // Initial Health Status & Dashboard Analytics Refresh
  updateMLHealthStatus();
  renderDecisionEngineAudits();
  refreshDashboardAnalytics();
  window.initAdminInputPortal();
  setInterval(refreshDashboardAnalytics, 30000);

  // Initial page renders
  renderOverviewHistograms();
  renderComponentCatalog();

  // Final deterministic startup route resolution (Home by default unless valid hash supplied)
  switchPage(window.location.hash, false);
});