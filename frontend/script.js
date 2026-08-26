// AIPS Console Frontend Prototype Logic
document.addEventListener("DOMContentLoaded", () => {
  
  // ==========================================
  // 1. MOCK DATA GENERATOR LAYER
  // ==========================================
  const componentPool = [];
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
    
    // Save to pool
    componentPool.push({
      id,
      lot_id: LOT_ID,
      measurements: {
        h0: { iddq: iddq_0h, ileak: ileak_0h, tpd: tpd_0h },
        h24: { iddq: iddq_24h, ileak: ileak_24h, tpd: tpd_24h },
        h96: { iddq: iddq_96h, ileak: ileak_96h, tpd: tpd_96h },
        h168: { iddq: iddq_168h, ileak: ileak_168h, tpd: tpd_168h }
      },
      anomaly_score,
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

  // ==========================================
  // 2. NAVIGATION / ROUTER LAYER
  // ==========================================
  function switchPage(targetPageId, updateHash = true) {
    const navLinks = document.querySelectorAll(".nav-link");
    const pages = document.querySelectorAll(".page-view");
    
    // Update nav links state
    navLinks.forEach(link => {
      if (link.getAttribute("data-page") === targetPageId) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
    
    // Toggle page views
    pages.forEach(p => {
      if (p.id === targetPageId) {
        p.classList.add("active");
      } else {
        p.classList.remove("active");
      }
    });

    // Always scroll to top on navigation
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Update URL hash for browser refresh persistence
    if (updateHash && window.location.hash !== `#${targetPageId}`) {
      try {
        history.pushState(null, "", `#${targetPageId}`);
      } catch (e) {
        // Fallback for strict sandbox iframe environments
      }
    }

    // Close mobile dropdown if open
    const menu = document.getElementById("topnav-menu");
    if (menu) menu.classList.remove("mobile-open");

    // Trigger page-specific redraws
    if (targetPageId === "page-component") {
      renderLotTable();
    } else if (targetPageId === "page-anomaly") {
      renderAnomalyDistribution();
      initMLWorkstation();
    } else if (targetPageId === "page-decision") {
      renderDecisionEngineAudits();
    } else if (targetPageId === "page-reports") {
      refreshDashboardAnalytics();
    }
  }

  // Handle browser back/forward and initial page hash load
  window.addEventListener("popstate", () => {
    const hash = window.location.hash.replace("#", "");
    if (hash && document.getElementById(hash)) {
      switchPage(hash, false);
    } else {
      switchPage("page-home", false);
    }
  });

  const initialHash = window.location.hash.replace("#", "");
  if (initialHash && document.getElementById(initialHash)) {
    switchPage(initialHash, false);
  }

  // Bind top navigation links
  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = link.getAttribute("data-page");
      if (target) switchPage(target);
    });
  });

  // Mobile hamburger menu toggle
  const mobileToggleBtn = document.getElementById("mobile-menu-toggle");
  const topnavMenu = document.getElementById("topnav-menu");
  if (mobileToggleBtn && topnavMenu) {
    mobileToggleBtn.addEventListener("click", () => {
      topnavMenu.classList.toggle("mobile-open");
    });
  }

  // Brand home link
  const brandHomeLink = document.getElementById("brand-home-link");
  if (brandHomeLink) {
    brandHomeLink.addEventListener("click", () => switchPage("page-home"));
  }

  // Home CTA buttons
  const btnHomeStart = document.getElementById("btn-home-start-screening");
  if (btnHomeStart) {
    btnHomeStart.addEventListener("click", () => switchPage("page-anomaly"));
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
  
  function showComponentDetails(id) {
    switchPage("page-component");
    
    // Sync dropdown and update metrics
    if (componentSelector) {
      componentSelector.value = id;
    }
    updateComponentView(id);
  }
  
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
    
    // Update SHAP explainability bar graphs
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
    
    // Constants mapping to pixels
    const width = svg.clientWidth || 500;
    const height = 260;
    const padding = { top: 30, right: 60, bottom: 40, left: 60 };
    
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
    svg.appendChild(createSVGElement("line", { x1: padding.left, y1: padding.top, x2: width - padding.right, y2: padding.top, stroke: "rgba(255,255,255,0.05)", "stroke-width": 1 }));
    svg.appendChild(createSVGElement("line", { x1: padding.left, y1: height - padding.bottom, x2: width - padding.right, y2: height - padding.bottom, stroke: "rgba(255,255,255,0.1)", "stroke-width": 1 }));
    
    // X Axis Labels
    svg.appendChild(createSVGElement("text", { x: x0, y: height - 15, fill: "var(--text-secondary)", "font-size": "10", "text-anchor": "middle" }));
    svg.querySelector("text:last-child").textContent = "0h";
    svg.appendChild(createSVGElement("text", { x: x24, y: height - 15, fill: "var(--text-secondary)", "font-size": "10", "text-anchor": "middle" }));
    svg.querySelector("text:last-child").textContent = "24h";
    svg.appendChild(createSVGElement("text", { x: x96, y: height - 15, fill: "var(--text-secondary)", "font-size": "10", "text-anchor": "middle" }));
    svg.querySelector("text:last-child").textContent = "96h";
    svg.appendChild(createSVGElement("text", { x: x168, y: height - 15, fill: "var(--text-secondary)", "font-size": "10", "text-anchor": "middle" }));
    svg.querySelector("text:last-child").textContent = "168h";
    
    // Y Axis labels
    svg.appendChild(createSVGElement("text", { x: padding.left - 10, y: y0, fill: "var(--text-muted)", "font-size": "10", "text-anchor": "end" }));
    svg.querySelector("text:last-child").textContent = y0_val.toFixed(1);
    svg.appendChild(createSVGElement("text", { x: padding.left - 10, y: y24, fill: "var(--text-muted)", "font-size": "10", "text-anchor": "end" }));
    svg.querySelector("text:last-child").textContent = y24_val.toFixed(1);
    svg.appendChild(createSVGElement("text", { x: padding.left - 10, y: yLimit, fill: "var(--critical)", "font-size": "10", "text-anchor": "end", "font-weight": "600" }));
    svg.querySelector("text:last-child").textContent = limit.toFixed(1);
    
    // 2. Draw Safety Threshold Limit
    svg.appendChild(createSVGElement("line", { x1: padding.left, y1: yLimit, x2: width - padding.right, y2: yLimit, stroke: "var(--critical)", "stroke-width": 1.5, "stroke-dasharray": "3" }));
    svg.appendChild(createSVGElement("text", { x: width - padding.right + 5, y: yLimit + 3, fill: "var(--critical)", "font-size": "9", "font-weight": "600" }));
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
  
  // Initialize details page
  showComponentDetails("COMP-00042");

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
    
    const width = svg.clientWidth || 500;
    const height = 220;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    
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
    const container = document.getElementById("decision-flow-container");
    if (!container) return;
    
    const sampleComps = [
      componentPool.find(c => c.id === "COMP-00001"), // PASS
      componentPool.find(c => c.id === "COMP-00088"), // MONITOR
      componentPool.find(c => c.id === "COMP-00042"), // REJECT
      componentPool.find(c => c.id === "COMP-00105")  // REJECT
    ];
    
    container.innerHTML = sampleComps.map(c => {
      let isOutlier = c.anomaly_score > 8.5;
      let limitValue = c.measurements.h24.tpd > 135.1 || c.measurements.h24.iddq > 24.5;
      let driftExceeded = c.drift_slope.iddq > 0.098 || c.drift_slope.tpd > 0.011;
      
      return `
        <div style="border: 1px solid var(--glass-border); padding:16px; border-radius:8px; background-color:rgba(255,255,255,0.01);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span style="font-weight:600; color:var(--accent);">${c.id}</span>
            <span class="badge ${c.status.toLowerCase()}">${c.status}</span>
          </div>
          
          <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:12px; font-size:11px;">
            <div style="text-align:center; padding:8px; border-radius:4px; background-color:${isOutlier ? 'var(--critical-bg)' : 'rgba(255,255,255,0.02)'}; border:1px solid ${isOutlier ? 'var(--critical)' : 'var(--glass-border)'};">
              <div style="color:var(--text-secondary); margin-bottom:4px;">Module A (Outlier)</div>
              <strong>${c.anomaly_score.toFixed(2)}</strong><br>
              <span style="color:${isOutlier ? 'var(--critical)' : 'var(--success)'}; font-size:9px;">${isOutlier ? 'OUTLIER' : 'NORMAL'}</span>
            </div>
            
            <div style="text-align:center; padding:8px; border-radius:4px; background-color:${driftExceeded ? 'var(--critical-bg)' : 'rgba(255,255,255,0.02)'}; border:1px solid ${driftExceeded ? 'var(--critical)' : 'var(--glass-border)'};">
              <div style="color:var(--text-secondary); margin-bottom:4px;">Module B (Drift)</div>
              <strong>${(c.predicted_168h.iddq - c.measurements.h24.iddq).toFixed(2)} µA</strong><br>
              <span style="color:${driftExceeded ? 'var(--critical)' : 'var(--success)'}; font-size:9px;">${driftExceeded ? 'EXCEEDED' : 'STABLE'}</span>
            </div>
            
            <div style="text-align:center; padding:8px; border-radius:4px; background-color:${limitValue ? 'var(--critical-bg)' : 'rgba(255,255,255,0.02)'}; border:1px solid ${limitValue ? 'var(--critical)' : 'var(--glass-border)'};">
              <div style="color:var(--text-secondary); margin-bottom:4px;">Datasheet Bounds</div>
              <strong>Max limits</strong><br>
              <span style="color:${limitValue ? 'var(--critical)' : 'var(--success)'}; font-size:9px;">${limitValue ? 'VIOLATED' : 'PASSED'}</span>
            </div>
            
            <div style="text-align:center; padding:8px; border-radius:4px; background-color:${c.status === 'REJECT' ? 'var(--critical-bg)' : c.status === 'MONITOR' ? 'var(--warning-bg)' : 'var(--success-bg)'}; border:1px solid ${c.status === 'REJECT' ? 'var(--critical)' : c.status === 'MONITOR' ? 'var(--warning)' : 'var(--success)'}; display:flex; flex-direction:column; justify-content:center;">
              <div style="color:var(--text-secondary); margin-bottom:4px; font-weight:600;">Routing</div>
              <strong style="color:${c.status === 'REJECT' ? 'var(--critical)' : c.status === 'MONITOR' ? 'var(--warning)' : 'var(--success)'};">${c.status}</strong>
            </div>
          </div>
          <div style="margin-top:10px; font-size:12px; color:var(--text-secondary); line-height:1.4;">
            <strong>Reason:</strong> ${c.reason}
          </div>
        </div>
      `;
    }).join("");
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
  const sessionHistory = [];

  async function updateMLHealthStatus() {
    try {
      const health = await checkMLAPIHealth();
      const isOnline = health.status === "ok";
      const dotColor = isOnline ? "#10b981" : "#ff5e62";
      const statusText = isOnline ? "ML ENGINE: ONLINE" : "ML ENGINE: OFFLINE";
      const headerText = isOnline ? `ML ENGINE ONLINE | Threshold: 0.45` : `ML ENGINE OFFLINE (Local Mode Active)`;

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

      if (summary) {
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

    const isFail = result.prediction === "FAIL";
    if (statusBadge) {
      statusBadge.textContent = result.prediction;
      statusBadge.style.color = isFail ? "var(--critical)" : "var(--success)";
    }

    if (probVal) {
      probVal.textContent = `${(result.probability * 100).toFixed(1)}%`;
      probVal.style.color = isFail ? "var(--critical)" : "var(--success)";
    }

    if (riskLevel) {
      riskLevel.textContent = result.risk_level;
      if (result.risk_level === "CRITICAL") riskLevel.style.color = "var(--critical)";
      else if (result.risk_level === "HIGH") riskLevel.style.color = "#f97316";
      else if (result.risk_level === "MEDIUM") riskLevel.style.color = "var(--warning)";
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
      if (result.operational_decision === "SECONDARY_TEST") {
        opDecisionEl.textContent = "🟡 SECONDARY TEST REQUIRED";
        opDecisionEl.style.color = "#eab308";
      } else if (result.operational_decision === "FAIL") {
        opDecisionEl.textContent = "🔴 CRITICAL FAIL";
        opDecisionEl.style.color = "var(--critical)";
      } else {
        opDecisionEl.textContent = "🟢 PASS / MONITOR";
        opDecisionEl.style.color = "var(--success)";
      }
    }

    const decisionReasonEl = document.getElementById("res-decision-reason");
    if (decisionReasonEl) {
      decisionReasonEl.textContent = result.decision_reason || "Nominal parameter bounds.";
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

  function addPredictionToHistory(result) {
    sessionHistory.unshift({
      timestamp: new Date().toLocaleTimeString(),
      test_id: result.test_id || `TEST-${Math.floor(1000 + Math.random() * 9000)}`,
      equipment: result.equipment_id || "EQP-101",
      prediction: result.prediction,
      probability: result.probability,
      risk_level: result.risk_level
    });

    const tbody = document.getElementById("history-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";
    sessionHistory.slice(0, 10).forEach(h => {
      const tr = document.createElement("tr");
      const isFail = h.prediction === "FAIL";
      const predBadge = isFail ? `<span class="badge reject">FAIL</span>` : `<span class="badge pass">PASS</span>`;
      tr.innerHTML = `
        <td>${h.timestamp}</td>
        <td><strong>${h.test_id}</strong></td>
        <td>${h.equipment}</td>
        <td>${predBadge}</td>
        <td><strong>${(h.probability * 100).toFixed(1)}%</strong></td>
        <td><span class="badge" style="background-color:rgba(255,255,255,0.05);">${h.risk_level}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

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

  // Initial Health Status & Dashboard Analytics Refresh
  updateMLHealthStatus();
  refreshDashboardAnalytics();
  setInterval(refreshDashboardAnalytics, 30000);

  // Initial page renders
  renderOverviewHistograms();
  renderComponentCatalog();
});