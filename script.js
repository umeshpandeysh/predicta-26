// Predicta Console Frontend Prototype Logic
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
  // 2. NAVIGATION / ROUTER
  // ==========================================
  const navItems = document.querySelectorAll(".nav-item");
  const pages = document.querySelectorAll(".page-view");
  
  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      
      // Update sidebar nav style
      navItems.forEach(n => n.classList.remove("active"));
      item.classList.add("active");
      
      // Toggle visibility of pages
      const targetPageId = item.getAttribute("data-page");
      pages.forEach(p => {
        if (p.id === targetPageId) {
          p.classList.add("active");
        } else {
          p.classList.remove("active");
        }
      });
      
      // Trigger page-specific redraws
      if (targetPageId === "page-overview") {
        renderOverviewHistograms();
      } else if (targetPageId === "page-anomaly") {
        renderAnomalyDistribution();
      } else if (targetPageId === "page-decision") {
        renderDecisionEngineAudits();
      }
    });
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
    // Navigate to component view
    navItems.forEach(n => n.classList.remove("active"));
    const compNav = Array.from(navItems).find(n => n.getAttribute("data-page") === "page-component");
    if (compNav) compNav.classList.add("active");
    
    pages.forEach(p => {
      if (p.id === "page-component") p.classList.add("active");
      else p.classList.remove("active");
    });
    
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

  // Stage State Execution Controller Handlers
  const stageStateModA = document.getElementById("stage-state-select-mod-a");
  const stagePillModA = document.getElementById("stage-pill-mod-a");
  const btnRunModA = document.getElementById("btn-run-mod-a");

  if (stageStateModA && stagePillModA) {
    stageStateModA.addEventListener("change", () => {
      const state = stageStateModA.value;
      stagePillModA.className = `stage-pill ${state.toLowerCase()}`;
      stagePillModA.textContent = `STAGE: ${state}`;
    });
  }

  if (btnRunModA && stageStateModA && stagePillModA) {
    btnRunModA.addEventListener("click", () => {
      stageStateModA.value = "RUNNING";
      stagePillModA.className = "stage-pill running";
      stagePillModA.textContent = "STAGE: RUNNING";

      setTimeout(() => {
        stageStateModA.value = "COMPLETE";
        stagePillModA.className = "stage-pill complete";
        stagePillModA.textContent = "STAGE: COMPLETE";
        alert("Module A Preprocessing & Outlier Screening completed successfully!");
      }, 1200);
    });
  }

  // Module B 168h Forecast & Retraining Handlers
  const stageStateModB = document.getElementById("stage-state-select-mod-b");
  const stagePillModB = document.getElementById("stage-pill-mod-b");
  const btnRunModB = document.getElementById("btn-run-mod-b");
  const btnRetrain = document.getElementById("btn-trigger-retrain");

  if (stageStateModB && stagePillModB) {
    stageStateModB.addEventListener("change", () => {
      const state = stageStateModB.value;
      stagePillModB.className = `stage-pill ${state.toLowerCase()}`;
      stagePillModB.textContent = `STAGE: ${state}`;
    });
  }

  if (btnRunModB && stageStateModB && stagePillModB) {
    btnRunModB.addEventListener("click", () => {
      stageStateModB.value = "RUNNING";
      stagePillModB.className = "stage-pill running";
      stagePillModB.textContent = "STAGE: RUNNING";

      setTimeout(() => {
        stageStateModB.value = "COMPLETE";
        stagePillModB.className = "stage-pill complete";
        stagePillModB.textContent = "STAGE: COMPLETE";
        alert("Module B 168-Hour Energy & Load Forecast completed successfully!");
      }, 1200);
    });
  }

  if (btnRetrain) {
    btnRetrain.addEventListener("click", () => {
      alert("Model retraining triggered! Calibrating GPR kernel parameters using actual telemetry residuals (MAE: 0.24 µA, MAPE: 3.42%).");
    });
  }

  // Initial page renders
  renderOverviewHistograms();
  renderComponentCatalog();
});