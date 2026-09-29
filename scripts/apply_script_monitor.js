const fs = require('fs');

// Read script.js
let js = fs.readFileSync('script.js', 'utf8');

// 1. REWRITE renderComponentVsLotChart
const chartFuncStart = js.indexOf('window.renderComponentVsLotChart = function');
const chartFuncEnd = js.indexOf('function generateDossierPassportHtml', chartFuncStart);

if (chartFuncStart === -1 || chartFuncEnd === -1) {
  console.error('Could not locate renderComponentVsLotChart boundaries in script.js', { chartFuncStart, chartFuncEnd });
  process.exit(1);
}

const newChartFunc = `window.renderComponentVsLotChart = function renderComponentVsLotChart(compId = 'DIE-R20C20', metric = null, currentHour = null) {
  const container = document.getElementById('comp-vs-lot-svg-box');
  if (!container) return;

  const selMetric = metric || window.currentCompVsLotMetric || 'iddq';
  window.currentCompVsLotMetric = selMetric;

  const selHour = (currentHour !== null && currentHour !== undefined) 
    ? parseFloat(currentHour) 
    : (window.monitorCurrentHour !== undefined ? parseFloat(window.monitorCurrentHour) : 24.0);
  window.monitorCurrentHour = selHour;

  const data = window.CANONICAL_COMPONENTS_DATA[compId] || window.CANONICAL_COMPONENTS_DATA['DIE-R20C20'];
  const isReject = data.disposition === 'REJECT';
  const isMonitor = data.disposition === 'MONITOR';

  const metricLabels = {
    iddq: 'IDDQ Standby',
    leakage: 'Gate Leakage',
    tpd: 'Propagation Delay',
    temperature: 'Temperature'
  };

  const titleEl = document.getElementById('comp-vs-lot-title');
  if (titleEl) {
    titleEl.textContent = 'Component ' + compId + ' vs. Lot Trajectory Envelope — ' + (metricLabels[selMetric] || 'IDDQ Standby');
  }

  // Update active pill button state
  ['iddq', 'leakage', 'tpd', 'temperature'].forEach(m => {
    const btn = document.getElementById('btn-metric-' + (m === 'temperature' ? 'temp' : m));
    if (btn) {
      if (m === selMetric) {
        btn.classList.add('active');
        btn.style.background = '#0284C7';
        btn.style.color = '#FFFFFF';
        btn.style.borderColor = '#0284C7';
        btn.style.fontWeight = '700';
      } else {
        btn.classList.remove('active');
        btn.style.background = '#F5F9FD';
        btn.style.color = '#123B63';
        btn.style.borderColor = '#CBD5E1';
        btn.style.fontWeight = '600';
      }
    }
  });

  // Comprehensive metric trajectory definitions across 0, 24, 48, 72, 96, 120, 144, 168 hours
  const allHours = [0, 24, 48, 72, 96, 120, 144, 168];

  const configs = {
    iddq: {
      unit: 'µA',
      limit: 25.0,
      yMin: 0,
      yMax: 55,
      yTicks: [0, 10, 20, 30, 40, 50],
      lotMedian: [10.2, 10.5, 10.8, 11.2, 11.5, 11.7, 12.0, 12.2],
      lotP5:     [8.5,  8.8,  9.0,  9.2,  9.4,  9.6,  9.8,  10.0],
      lotP95:    [12.0, 12.4, 12.9, 13.5, 14.0, 14.4, 14.8, 15.2],
      compTrajectory: isReject 
        ? [12.0, 16.5, 21.0, 26.5, 32.0, 37.5, 41.0, 45.0]
        : (isMonitor ? [10.5, 12.0, 13.8, 15.6, 17.5, 19.2, 20.8, 22.1] : [10.1, 10.3, 10.4, 10.6, 10.7, 10.9, 11.1, 11.4]),
      ciUpperOffset: isReject ? 6.5 : (isMonitor ? 3.4 : 1.6),
      ciLowerOffset: isReject ? 5.8 : (isMonitor ? 2.8 : 1.4)
    },
    leakage: {
      unit: 'µA',
      limit: 250.0,
      yMin: 50,
      yMax: 500,
      yTicks: [50, 150, 250, 350, 450],
      lotMedian: [105.0, 108.0, 111.0, 115.0, 118.0, 121.0, 124.0, 128.0],
      lotP5:     [92.0,  95.0,  97.0,  100.0, 102.0, 104.0, 106.0, 108.0],
      lotP95:    [120.0, 125.0, 129.0, 134.0, 138.0, 141.0, 145.0, 150.0],
      compTrajectory: isReject
        ? [115.0, 160.0, 210.0, 265.0, 315.0, 360.0, 395.0, 440.0]
        : (isMonitor ? [108.0, 122.0, 138.0, 155.0, 174.0, 192.0, 205.0, 215.0] : [105.0, 108.0, 110.0, 112.0, 115.0, 118.0, 121.0, 124.0]),
      ciUpperOffset: isReject ? 45.0 : (isMonitor ? 25.0 : 12.0),
      ciLowerOffset: isReject ? 40.0 : (isMonitor ? 20.0 : 10.0)
    },
    tpd: {
      unit: 'ns',
      limit: 16.0,
      yMin: 8.0,
      yMax: 20.0,
      yTicks: [8.0, 11.0, 14.0, 17.0, 20.0],
      lotMedian: [10.8, 10.9, 11.0, 11.1, 11.2, 11.3, 11.4, 11.5],
      lotP5:     [10.2, 10.3, 10.4, 10.5, 10.55, 10.6, 10.65, 10.7],
      lotP95:    [11.5, 11.7, 11.9, 12.0, 12.1, 12.2, 12.3, 12.4],
      compTrajectory: isReject
        ? [11.2, 12.0, 13.0, 14.1, 15.2, 16.2, 17.0, 17.5]
        : (isMonitor ? [10.9, 11.3, 11.8, 12.3, 12.8, 13.3, 13.8, 14.2] : [10.8, 10.9, 10.95, 11.0, 11.1, 11.2, 11.3, 11.5]),
      ciUpperOffset: isReject ? 1.3 : (isMonitor ? 0.9 : 0.4),
      ciLowerOffset: isReject ? 1.1 : (isMonitor ? 0.7 : 0.3)
    },
    temperature: {
      unit: '°C',
      limit: 100.0,
      yMin: 0,
      yMax: 140,
      yTicks: [0, 30, 60, 90, 120],
      lotMedian: [25.0, 25.5, 26.0, 26.5, 27.0, 27.5, 28.0, 28.5],
      lotP5:     [22.0, 22.5, 23.0, 23.5, 24.0, 24.5, 25.0, 25.5],
      lotP95:    [28.0, 28.8, 29.5, 30.0, 30.5, 31.0, 31.5, 32.0],
      compTrajectory: isReject
        ? [30.0, 45.0, 62.0, 78.0, 92.0, 104.0, 112.0, 118.0]
        : (isMonitor ? [26.0, 32.0, 38.0, 45.0, 52.0, 58.0, 64.0, 70.0] : [25.0, 25.2, 25.5, 25.8, 26.1, 26.4, 26.7, 27.0]),
      ciUpperOffset: isReject ? 10.0 : (isMonitor ? 6.0 : 2.5),
      ciLowerOffset: isReject ? 8.0 : (isMonitor ? 5.0 : 2.0)
    }
  };

  const cfg = configs[selMetric] || configs.iddq;

  // Calculate current value at currentHour
  const hourIdx = Math.min(allHours.length - 1, Math.max(0, Math.round(selHour / 24)));
  const currentVal = cfg.compTrajectory[hourIdx];
  const lotMedVal = cfg.lotMedian[hourIdx];
  const deltaFromMed = currentVal - lotMedVal;
  const pctFromMed = ((deltaFromMed / lotMedVal) * 100).toFixed(1);

  // Update validation panel
  const valObs = document.getElementById('fc-val-observed');
  const valPred = document.getElementById('fc-val-predicted');
  const valResid = document.getElementById('fc-val-residual');
  const valMae = document.getElementById('fc-val-mae');
  const valOrigin = document.getElementById('fc-val-origin');
  const valHorizon = document.getElementById('fc-val-horizon');

  if (valOrigin) valOrigin.textContent = '24.0 h';
  if (valHorizon) valHorizon.textContent = selHour.toFixed(1) + ' h';
  if (valObs) valObs.textContent = currentVal.toFixed(1) + ' ' + cfg.unit;
  if (valPred) {
    const predVal = hourIdx === 0 ? cfg.compTrajectory[0] : (cfg.compTrajectory[hourIdx] * 0.985);
    valPred.textContent = predVal.toFixed(1) + ' ' + cfg.unit;
  }
  if (valResid) {
    const sign = deltaFromMed >= 0 ? '+' : '';
    valResid.textContent = sign + deltaFromMed.toFixed(1) + ' ' + cfg.unit;
  }
  if (valMae) {
    valMae.textContent = (Math.abs(deltaFromMed) * 0.15 + 0.25).toFixed(2) + ' ' + cfg.unit;
  }

  // Dynamic SVG rendering
  const svgW = 1000;
  const svgH = 320;
  const padL = 70, padR = 40, padT = 30, padB = 45;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const getX = hr => padL + (hr / 168.0) * plotW;
  const getY = val => padT + plotH - ((val - cfg.yMin) / (cfg.yMax - cfg.yMin)) * plotH;

  // Background Grid Lines
  let gridSvg = '';
  // Horizontal grid lines
  cfg.yTicks.forEach(tick => {
    const y = getY(tick);
    gridSvg += \`<line x1="\${padL}" y1="\${y}" x2="\${padL + plotW}" y2="\${y}" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="3,3" />\`;
    gridSvg += \`<text x="\${padL - 10}" y="\${y + 4}" font-size="12" font-family="var(--font-mono)" font-weight="600" fill="#64748B" text-anchor="end">\${tick} \${cfg.unit}</text>\`;
  });

  // Vertical time grid lines
  allHours.forEach(hr => {
    const x = getX(hr);
    gridSvg += \`<line x1="\${x}" y1="\${padT}" x2="\${x}" y2="\${padT + plotH}" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="3,3" />\`;
    gridSvg += \`<text x="\${x}" y="\${padT + plotH + 20}" font-size="12" font-family="var(--font-mono)" font-weight="600" fill="#64748B" text-anchor="middle">\${hr}h</text>\`;
  });

  // Spec Limit Alarm Line
  const yLim = getY(cfg.limit);
  let specLimitSvg = '';
  if (yLim >= padT && yLim <= padT + plotH) {
    specLimitSvg = \`
      <rect x="\${padL}" y="\${padT}" width="\${plotW}" height="\${Math.max(0, yLim - padT)}" fill="#FEE2E2" fill-opacity="0.12" />
      <line x1="\${padL}" y1="\${yLim}" x2="\${padL + plotW}" y2="\${yLim}" stroke="#DC2626" stroke-width="2" stroke-dasharray="6,4" />
      <text x="\${padL + plotW - 10}" y="\${yLim - 7}" font-size="12" font-weight="800" font-family="var(--font-sans)" fill="#DC2626" text-anchor="end">SPEC ALARM LIMIT: \${cfg.limit} \${cfg.unit}</text>
    \`;
  }

  // 1. Lot Envelope Polygon (P5 -> P95)
  let topEnv = '', botEnv = '';
  for (let i = 0; i < allHours.length; i++) {
    const x = getX(allHours[i]);
    const yTop = getY(cfg.lotP95[i]);
    const yBot = getY(cfg.lotP5[i]);
    topEnv += (i === 0 ? \`M \${x} \${yTop}\` : \` L \${x} \${yTop}\`);
    botEnv = \` L \${x} \${yBot}\` + botEnv;
  }
  const lotEnvSvg = \`<path d="\${topEnv} \${botEnv} Z" fill="#BAE6FD" fill-opacity="0.32" stroke="#7DD3FC" stroke-width="1.5" stroke-dasharray="4,3"/>\`;

  // 2. Lot Median Line
  let medianPath = '';
  for (let i = 0; i < allHours.length; i++) {
    const x = getX(allHours[i]);
    const y = getY(cfg.lotMedian[i]);
    medianPath += (i === 0 ? \`M \${x} \${y}\` : \` L \${x} \${y}\`);
  }
  const lotMedianSvg = \`<path d="\${medianPath}" fill="none" stroke="#0284C7" stroke-width="2" stroke-dasharray="5,4"/>\`;

  // 3. Uncertainty CI Band (from currentHour forward to 168h)
  let ciSvg = '';
  const currentIdx = hourIdx;
  if (currentIdx < allHours.length - 1) {
    let ciTop = '', ciBot = '';
    for (let i = currentIdx; i < allHours.length; i++) {
      const x = getX(allHours[i]);
      const progressRatio = (i - currentIdx) / (allHours.length - 1 - currentIdx);
      const upperVal = cfg.compTrajectory[i] + cfg.ciUpperOffset * (0.5 + 0.8 * progressRatio);
      const lowerVal = cfg.compTrajectory[i] - cfg.ciLowerOffset * (0.5 + 0.8 * progressRatio);
      const yT = getY(upperVal);
      const yB = getY(lowerVal);
      ciTop += (i === currentIdx ? \`M \${x} \${yT}\` : \` L \${x} \${yT}\`);
      ciBot = \` L \${x} \${yB}\` + ciBot;
    }
    ciSvg = \`<path d="\${ciTop} \${ciBot} Z" fill="#FDE68A" fill-opacity="0.38" stroke="#F59E0B" stroke-width="1" stroke-dasharray="2,2"/>\`;
  }

  // 4. Component Trajectory Paths
  const compColor = isReject ? '#DC2626' : (isMonitor ? '#D97706' : '#166534');
  const compGlowColor = isReject ? 'rgba(220, 38, 38, 0.25)' : (isMonitor ? 'rgba(217, 119, 6, 0.25)' : 'rgba(22, 101, 52, 0.25)');

  // Observed portion (0h -> currentHour)
  let obsPath = '';
  let obsPointsSvg = '';
  for (let i = 0; i <= currentIdx; i++) {
    const x = getX(allHours[i]);
    const y = getY(cfg.compTrajectory[i]);
    obsPath += (i === 0 ? \`M \${x} \${y}\` : \` L \${x} \${y}\`);
    obsPointsSvg += \`
      <circle cx="\${x}" cy="\${y}" r="5" fill="\${compColor}" stroke="#FFFFFF" stroke-width="2">
        <title>\${allHours[i]}h: \${cfg.compTrajectory[i]} \${cfg.unit}</title>
      </circle>
    \`;
  }
  const obsLineSvg = obsPath ? \`<path d="\${obsPath}" fill="none" stroke="\${compColor}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>\` : '';

  // Forecast portion (currentHour -> 168h)
  let fcPath = '';
  let fcPointsSvg = '';
  if (currentIdx < allHours.length - 1) {
    for (let i = currentIdx; i < allHours.length; i++) {
      const x = getX(allHours[i]);
      const y = getY(cfg.compTrajectory[i]);
      fcPath += (i === currentIdx ? \`M \${x} \${y}\` : \` L \${x} \${y}\`);
      if (i > currentIdx) {
        fcPointsSvg += \`
          <circle cx="\${x}" cy="\${y}" r="4.5" fill="#FFFFFF" stroke="\${compColor}" stroke-width="2.5">
            <title>Forecast \${allHours[i]}h: \${cfg.compTrajectory[i]} \${cfg.unit}</title>
          </circle>
        \`;
      }
    }
  }
  const fcLineSvg = fcPath ? \`<path d="\${fcPath}" fill="none" stroke="\${compColor}" stroke-width="2.5" stroke-dasharray="6,4" stroke-linecap="round"/>\` : '';

  // 5. Active Vertical Scrubber Line at currentHour
  const cursorX = getX(selHour);
  const cursorY = getY(currentVal);

  const scrubberSvg = \`
    <!-- Vertical Cyan Scrubber Line -->
    <line x1="\${cursorX}" y1="\${padT}" x2="\${cursorX}" y2="\${padT + plotH}" stroke="#0284C7" stroke-width="2.5" />
    <polygon points="\${cursorX - 6},\${padT} \${cursorX + 6},\${padT} \${cursorX},\${padT + 10}" fill="#0284C7" />
    <polygon points="\${cursorX - 6},\${padT + plotH} \${cursorX + 6},\${padT + plotH} \${cursorX},\${padT + plotH - 10}" fill="#0284C7" />

    <!-- Pulsing Halo Cursor at Active Point -->
    <circle cx="\${cursorX}" cy="\${cursorY}" r="12" fill="\${compGlowColor}" stroke="\${compColor}" stroke-width="1.5" opacity="0.8">
      <animate attributeName="r" values="8;16;8" dur="2s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" />
    </circle>
    <circle cx="\${cursorX}" cy="\${cursorY}" r="6.5" fill="#FFFFFF" stroke="\${compColor}" stroke-width="3" />

    <!-- Live Readout Floating Tag -->
    <g transform="translate(\${Math.min(svgW - 220, Math.max(padL + 10, cursorX - 90))}, \${Math.max(padT + 8, cursorY - 48)})">
      <rect width="180" height="34" rx="5" fill="#123B63" fill-opacity="0.95" stroke="#BAE6FD" stroke-width="1" filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.15))" />
      <text x="90" y="16" font-size="11.5" font-family="var(--font-mono)" font-weight="700" fill="#FFFFFF" text-anchor="middle">
        \${selHour.toFixed(0)}h: \${currentVal.toFixed(1)} \${cfg.unit} (\${deltaFromMed >= 0 ? '+' : ''}\${pctFromMed}%)
      </text>
      <text x="90" y="28" font-size="10" font-family="var(--font-sans)" font-weight="600" fill="#93C5FD" text-anchor="middle">
        \${selHour <= 24 ? 'OBSERVED TELEMETRY' : 'GPR PREDICTED TRAJECTORY'}
      </text>
    </g>
  \`;

  // Assemble Complete SVG
  container.innerHTML = \`
    <svg width="100%" height="320" viewBox="0 0 \${svgW} \${svgH}" style="overflow:visible; display:block;">
      \${gridSvg}
      \${specLimitSvg}
      \${lotEnvSvg}
      \${lotMedianSvg}
      \${ciSvg}
      \${fcLineSvg}
      \${obsLineSvg}
      \${fcPointsSvg}
      \${obsPointsSvg}
      \${scrubberSvg}
    </svg>
  \`;
};

`;

js = js.substring(0, chartFuncStart) + newChartFunc + js.substring(chartFuncEnd);

// 2. REWRITE TIMELINE HANDLERS AND SYNCHRONIZATION
const timelineStart = js.indexOf('// 5. Live Monitor Replay & Plotly Charts');
const timelineEnd = js.indexOf('function renderMonitorSvgChart');

if (timelineStart === -1 || timelineEnd === -1) {
  console.error('Could not locate timeline handlers boundaries in script.js', { timelineStart, timelineEnd });
  process.exit(1);
}

const newTimelineCode = `// 5. Live Monitor Replay & Telemetry Charts
window.monitorCurrentHour = 24.0;
window.monitorReplayInterval = null;

window.handleMonitorComponentChange = function(compId) {
  window.currentActiveComponentId = compId;
  const lot = window.CANONICAL_COMPONENTS_MAP && window.CANONICAL_COMPONENTS_MAP[compId] ? window.CANONICAL_COMPONENTS_MAP[compId].lot : '';
  if (lot) window.currentActiveLotId = lot;

  window.renderComponentVsLotChart(compId, window.currentCompVsLotMetric, window.monitorCurrentHour);
  window.renderMonitorCharts(compId, window.monitorCurrentHour);
};

window.switchCompVsLotMetric = function(metric) {
  window.currentCompVsLotMetric = metric;
  window.renderComponentVsLotChart(window.currentActiveComponentId, metric, window.monitorCurrentHour);
};

window.handleTimelineSlider = function(val) {
  window.monitorCurrentHour = parseFloat(val);
  const hourBadge = document.getElementById('live-current-hour-badge');
  const hourDisplay = document.getElementById('current-hour-display');
  const sliderLive = document.getElementById('live-time-slider');
  const sliderOld = document.getElementById('timeline-slider');

  if (hourBadge) hourBadge.textContent = window.monitorCurrentHour.toFixed(1) + ' h';
  if (hourDisplay) hourDisplay.textContent = window.monitorCurrentHour.toFixed(1) + ' h';
  if (sliderLive && sliderLive.value != window.monitorCurrentHour) sliderLive.value = window.monitorCurrentHour;
  if (sliderOld && sliderOld.value != window.monitorCurrentHour) sliderOld.value = window.monitorCurrentHour;

  window.renderComponentVsLotChart(window.currentActiveComponentId, window.currentCompVsLotMetric, window.monitorCurrentHour);
  window.renderMonitorCharts(window.currentActiveComponentId, window.monitorCurrentHour);
};

window.stepReplay = function(delta) {
  let newHour = window.monitorCurrentHour + delta;
  if (newHour < 0) newHour = 0;
  if (newHour > 168) newHour = 168;
  window.handleTimelineSlider(newHour);
};

window.toggleReplayPlayback = function() {
  const btn = document.getElementById('btn-replay-play-pause');
  if (window.monitorReplayInterval) {
    clearInterval(window.monitorReplayInterval);
    window.monitorReplayInterval = null;
    if (btn) btn.textContent = '▶ Play Replay';
  } else {
    if (btn) btn.textContent = '⏸ Pause Replay';
    const intervalMs = 600;
    window.monitorReplayInterval = setInterval(() => {
      if (window.monitorCurrentHour >= 168) {
        window.handleTimelineSlider(0);
      } else {
        window.stepReplay(24);
      }
    }, intervalMs);
  }
};

window.resetReplayTimeline = function() {
  if (window.monitorReplayInterval) {
    clearInterval(window.monitorReplayInterval);
    window.monitorReplayInterval = null;
    const btn = document.getElementById('btn-replay-play-pause');
    if (btn) btn.textContent = '▶ Play Replay';
  }
  window.handleTimelineSlider(0);
};

window.resetReplay = window.resetReplayTimeline;

window.renderMonitorCharts = function(compId, currentHour) {
  const isHighRisk = (compId || '').includes('20C20') || (compId || '').includes('05C12');
  const hours = [0, 24, 48, 72, 96, 120, 144, 168];

  // Telemetry curves
  const iddqData = isHighRisk 
    ? [12.0, 16.5, 21.0, 26.5, 32.0, 37.5, 41.0, 45.0]
    : [10.2, 10.5, 10.6, 10.8, 10.9, 11.0, 11.1, 11.2];

  const leakData = isHighRisk
    ? [115.0, 160.0, 210.0, 265.0, 315.0, 360.0, 395.0, 440.0]
    : [108.0, 110.2, 111.5, 112.8, 114.0, 115.2, 116.5, 117.8];

  const tpdData = isHighRisk
    ? [11.2, 12.0, 13.0, 14.1, 15.2, 16.2, 17.0, 17.5]
    : [10.8, 10.92, 10.95, 10.98, 11.01, 11.04, 11.06, 11.08];

  const observedIdx = Math.min(hours.length, Math.floor(currentHour / 24) + 1);

  renderMonitorSvgChart('chart-iddq-container', hours, observedIdx, iddqData, 25.0, 0, 50, isHighRisk ? '#DC2626' : '#166534', 'PAT LIMIT 25µA', currentHour, 'µA');
  renderMonitorSvgChart('chart-leakage-container', hours, observedIdx, leakData, 250.0, 50, 480, isHighRisk ? '#DC2626' : '#166534', 'SPEC 250µA', currentHour, 'µA');
  renderMonitorSvgChart('chart-tpd-container', hours, observedIdx, tpdData, 16.0, 8.0, 20.0, isHighRisk ? '#DC2626' : '#166534', 'TIMING LIMIT 16ns', currentHour, 'ns');
};

`;

js = js.substring(0, timelineStart) + newTimelineCode + js.substring(timelineEnd);

// 3. REWRITE renderMonitorSvgChart
const svgChartStart = js.indexOf('function renderMonitorSvgChart');
const svgChartEnd = js.indexOf('// Run Initial Setup on Load', svgChartStart) !== -1 
  ? js.indexOf('// Run Initial Setup on Load', svgChartStart)
  : js.indexOf('// PREDICTA Boot Initialization', svgChartStart);

if (svgChartStart !== -1) {
  const nextSectionIndex = js.indexOf('// =========================================================================', svgChartStart + 50);
  const replaceEnd = nextSectionIndex !== -1 ? nextSectionIndex : (svgChartStart + 1500);

  const newSvgChartCode = `function renderMonitorSvgChart(containerId, hours, obsIdx, data, limitVal, yMin, yMax, color, limitLabel, currentHour = 24, unit = '') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const w = container.clientWidth || 360;
  const h = 240;
  const padL = 45, padR = 20, padT = 20, padB = 35;
  const plotW = Math.max(200, w - padL - padR);
  const plotH = h - padT - padB;

  const getX = (val) => padL + (val / 168.0) * plotW;
  const getY = (val) => padT + plotH - ((val - yMin) / (yMax - yMin)) * plotH;

  // Build observed path
  let obsPath = "";
  for (let i = 0; i < obsIdx; i++) {
    const x = getX(hours[i]);
    const y = getY(data[i]);
    obsPath += (i === 0 ? \`M \${x} \${y}\` : \` L \${x} \${y}\`);
  }

  // Build projected path
  let fullPath = "";
  for (let i = 0; i < hours.length; i++) {
    const x = getX(hours[i]);
    const y = getY(data[i]);
    fullPath += (i === 0 ? \`M \${x} \${y}\` : \` L \${x} \${y}\`);
  }

  // Build confidence band for leakage
  let bandSvg = "";
  if (containerId.includes("leakage")) {
    let topPath = "", botPath = "";
    for (let i = 0; i < hours.length; i++) {
      const x = getX(hours[i]);
      const yT = getY(data[i] * 1.08 + (i * 2));
      const yB = getY(data[i] * 0.92 - (i * 2));
      topPath += (i === 0 ? \`M \${x} \${yT}\` : \` L \${x} \${yT}\`);
      botPath = \` L \${x} \${yB}\` + botPath;
    }
    bandSvg = \`<path d="\${topPath} \${botPath} Z" fill="#BAE6FD" fill-opacity="0.30" stroke="none" />\`;
  }

  const yLimit = getY(limitVal);
  const limitSvg = (limitVal >= yMin && limitVal <= yMax)
    ? \`<line x1="\${padL}" y1="\${yLimit}" x2="\${padL + plotW}" y2="\${yLimit}" stroke="#DC2626" stroke-width="1.5" stroke-dasharray="4,3" />
       <text x="\${padL + plotW - 5}" y="\${yLimit - 4}" font-size="11" font-weight="700" fill="#DC2626" text-anchor="end">\${limitLabel}</text>\`
    : "";

  // Observed points
  let pointsSvg = "";
  for (let i = 0; i < obsIdx; i++) {
    const x = getX(hours[i]);
    const y = getY(data[i]);
    pointsSvg += \`<circle cx="\${x}" cy="\${y}" r="4" fill="\${color}" stroke="#FFFFFF" stroke-width="1.5" />\`;
  }

  // Vertical Scrubber Line
  const scrubX = getX(currentHour);
  const scrubberLineSvg = \`
    <line x1="\${scrubX}" y1="\${padT}" x2="\${scrubX}" y2="\${padT + plotH}" stroke="#0284C7" stroke-width="1.5" stroke-dasharray="2,2" />
  \`;

  container.innerHTML = \`
    <svg width="100%" height="\${h}" viewBox="0 0 \${w} \${h}" style="overflow:visible;">
      <!-- Grid -->
      <line x1="\${padL}" y1="\${padT}" x2="\${padL}" y2="\${padT + plotH}" stroke="#CBD5E1" stroke-width="1" />
      <line x1="\${padL}" y1="\${padT + plotH}" x2="\${padL + plotW}" y2="\${padT + plotH}" stroke="#CBD5E1" stroke-width="1" />
      <line x1="\${padL}" y1="\${padT + plotH/2}" x2="\${padL + plotW}" y2="\${padT + plotH/2}" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="2,2" />
      
      <!-- Axis labels -->
      <text x="\${padL - 8}" y="\${padT + 4}" font-size="11.5" font-family="var(--font-mono)" fill="#64748B" text-anchor="end">\${yMax}</text>
      <text x="\${padL - 8}" y="\${padT + plotH + 4}" font-size="11.5" font-family="var(--font-mono)" fill="#64748B" text-anchor="end">\${yMin}</text>
      <text x="\${padL}" y="\${padT + plotH + 18}" font-size="11.5" font-family="var(--font-mono)" fill="#64748B" text-anchor="middle">0h</text>
      <text x="\${padL + plotW/2}" y="\${padT + plotH + 18}" font-size="11.5" font-family="var(--font-mono)" fill="#64748B" text-anchor="middle">96h</text>
      <text x="\${padL + plotW}" y="\${padT + plotH + 18}" font-size="11.5" font-family="var(--font-mono)" fill="#64748B" text-anchor="middle">168h</text>

      \${bandSvg}
      \${limitSvg}
      \${scrubberLineSvg}
      <!-- Projected line (dashed) -->
      <path d="\${fullPath}" fill="none" stroke="\${color}" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.6" />
      <!-- Observed line (solid) -->
      <path d="\${obsPath}" fill="none" stroke="\${color}" stroke-width="2.5" />
      \${pointsSvg}
    </svg>
  \`;
}
`;

  js = js.substring(0, svgChartStart) + newSvgChartCode + '\n\n' + js.substring(replaceEnd);
}

fs.writeFileSync('script.js', js, 'utf8');
fs.writeFileSync('frontend/script.js', js, 'utf8');
console.log('script.js & frontend/script.js updated successfully.');
