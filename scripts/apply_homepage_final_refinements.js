const fs = require('fs');

function generateWaferSvg(lotId, waferNum, yieldPct, statusCounts) {
  // 32 dies layout in a circle
  // statusCounts: { pass: N, mon: M, rej: R }
  const dies = [
    // Row 1 (y=26, 4 dies)
    { x: 50, y: 26 }, { x: 66, y: 26 }, { x: 82, y: 26 }, { x: 98, y: 26 },
    // Row 2 (y=42, 6 dies)
    { x: 34, y: 42 }, { x: 50, y: 42 }, { x: 66, y: 42 }, { x: 82, y: 42 }, { x: 98, y: 42 }, { x: 114, y: 42 },
    // Row 3 (y=58, 6 dies)
    { x: 34, y: 58 }, { x: 50, y: 58 }, { x: 66, y: 58 }, { x: 82, y: 58 }, { x: 98, y: 58 }, { x: 114, y: 58 },
    // Row 4 (y=74, 6 dies)
    { x: 34, y: 74 }, { x: 50, y: 74 }, { x: 66, y: 74 }, { x: 82, y: 74 }, { x: 98, y: 74 }, { x: 114, y: 74 },
    // Row 5 (y=90, 6 dies)
    { x: 34, y: 90 }, { x: 50, y: 90 }, { x: 66, y: 90 }, { x: 82, y: 90 }, { x: 98, y: 90 }, { x: 114, y: 90 },
    // Row 6 (y=106, 4 dies)
    { x: 50, y: 106 }, { x: 66, y: 106 }, { x: 82, y: 106 }, { x: 98, y: 106 }
  ];

  let rejCount = statusCounts.rej || 0;
  let monCount = statusCounts.mon || 0;

  // Specific positions for rejects and monitors for realistic spatial patterns
  const statusList = [];
  for (let i = 0; i < dies.length; i++) {
    if (rejCount > 0 && (i === 14 || i === 22 || i === 7)) {
      statusList.push('REJECT');
      rejCount--;
    } else if (monCount > 0 && (i === 9 || i === 19 || i === 27 || i === 4)) {
      statusList.push('MONITOR');
      monCount--;
    } else {
      statusList.push('PASS');
    }
  }

  // Handle any remaining rejects or monitors
  for (let i = 0; i < statusList.length; i++) {
    if (statusList[i] === 'PASS' && rejCount > 0) {
      statusList[i] = 'REJECT';
      rejCount--;
    } else if (statusList[i] === 'PASS' && monCount > 0) {
      statusList[i] = 'MONITOR';
      monCount--;
    }
  }

  let rectsHtml = '';
  dies.forEach((d, idx) => {
    const st = statusList[idx];
    let fill = '#BAE6FD';
    let stroke = '#0284C7';
    let prob = (0.02 + (idx * 0.003)).toFixed(3);
    if (st === 'REJECT') {
      fill = '#FECACA';
      stroke = '#991B1B';
      prob = '0.941';
    } else if (st === 'MONITOR') {
      fill = '#FDE68A';
      stroke = '#B45309';
      prob = '0.312';
    }
    const dieId = `DIE-W${waferNum}-R${Math.floor(idx/6)}C${idx%6}`;
    rectsHtml += `<rect class="die-cell" x="${d.x}" y="${d.y}" width="12" height="12" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1" onclick="window.openReliabilityPassport('${dieId}')"><title>${dieId}: ${st} (P=${prob})</title></rect>`;
  });

  return `
    <div style="background:#FFFFFF; border:1px solid #C8DEEE; border-radius:6px; padding:10px 8px; text-align:center; box-shadow:0 1px 3px rgba(20,74,117,0.04);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:12px; font-weight:700;">
        <span style="color:#144A75;">Wafer ${waferNum}</span>
        <span style="color:#166534; background:#F0FDF4; padding:1px 6px; border-radius:4px; border:1px solid #BBF7D0; font-size:11px;">${yieldPct}</span>
      </div>
      <div style="background:#F0F6FC; border:1px solid #C8DEEE; border-radius:4px; padding:6px; display:flex; justify-content:center;">
        <svg width="110" height="110" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="72" fill="#FFFFFF" stroke="#B8D5EB" stroke-width="1.5"/>
          <circle cx="80" cy="80" r="70" fill="#F0F6FC" stroke="#C8DEEE" stroke-width="0.8"/>
          <path d="M 76,8 A 4,4 0 0,0 84,8 Z" fill="#C8DEEE" stroke="#5687AD" stroke-width="0.8"/>
          ${rectsHtml}
        </svg>
      </div>
      <div style="font-size:11px; color:#5687AD; margin-top:4px; font-family:var(--font-mono);">${lotId}</div>
    </div>`;
}

function build8WafersHtml() {
  const wafers = [
    { num: 43, lot: 'LOT-SYN-043', yieldPct: '96.9%', rej: 0, mon: 1 },
    { num: 44, lot: 'LOT-SYN-044', yieldPct: '78.1%', rej: 3, mon: 4 },
    { num: 45, lot: 'LOT-SYN-045', yieldPct: '90.6%', rej: 1, mon: 2 },
    { num: 46, lot: 'LOT-SYN-046', yieldPct: '81.3%', rej: 2, mon: 4 },
    { num: 47, lot: 'LOT-SYN-047', yieldPct: '93.8%', rej: 1, mon: 1 },
    { num: 48, lot: 'LOT-SYN-048', yieldPct: '87.5%', rej: 2, mon: 2 },
    { num: 49, lot: 'LOT-SYN-049', yieldPct: '90.6%', rej: 1, mon: 2 },
    { num: 50, lot: 'LOT-SYN-050', yieldPct: '84.4%', rej: 2, mon: 3 }
  ];

  let gridHtml = '';
  wafers.forEach(w => {
    gridHtml += generateWaferSvg(w.lot, w.num, w.yieldPct, { rej: w.rej, mon: w.mon });
  });

  return `<!-- Left: 8-Wafer Spatial Distribution Matrix -->
          <div class="card" style="background:#FFFFFF; border:1px solid #C8DEEE; padding:18px; border-radius:8px; box-shadow:var(--shadow-sm);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div>
                <h3 style="font-family:var(--font-display); font-size:15px; font-weight:700; color:#144A75; margin:0;">Active Wafer Spatial Health (8 Benchmark Lots)</h3>
                <p style="font-size:13.5px; color:#5687AD; margin:2px 0 0 0;">Lots 43–50 (256 Monitored Dies) • Circular Silicon Wafer Spatial Distribution Matrix</p>
              </div>
              <span class="badge pass" style="font-size:13px; font-weight:700;">GLOBAL YIELD: 88.3%</span>
            </div>
            
            <!-- 8-Wafer Grid (4x2 on desktop, 2x4 on mobile) -->
            <div class="wafers-8-grid" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:12px;">
              ${gridHtml}
            </div>

            <!-- Legend & Interactive Hint -->
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#5687AD; padding:6px 8px; background:#F0F6FC; border-radius:4px; border:1px solid #C8DEEE;">
              <div style="display:flex; gap:12px; align-items:center;">
                <span><strong style="color:#0284C7;">■</strong> PASS (Nominal)</span>
                <span><strong style="color:#B45309;">■</strong> MONITOR (Drift)</span>
                <span><strong style="color:#991B1B;">■</strong> REJECT (Outlier)</span>
              </div>
              <span>Click any die to open Reliability Passport</span>
            </div>
          </div>`;
}

function updateIndexHtml(filePath) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, 'utf8');

  // 1. Extract the Static vs Dynamic Section
  const staticVsDynMatch = html.match(/<!-- 3\. STATIC VS\. DYNAMIC RELIABILITY SCREENING ARCHITECTURE -->[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*(?=<!-- 4\. LATENT ESCAPE SPOTLIGHT -->)/);
  let staticVsDynHtml = '';
  if (staticVsDynMatch) {
    staticVsDynHtml = staticVsDynMatch[0];
    // Remove it from Home page
    html = html.replace(staticVsDynMatch[0], '');
    console.log(`Extracted and removed Static vs Dynamic from Home in ${filePath}`);
  } else {
    console.warn(`Could not find Static vs Dynamic in Home in ${filePath}`);
  }

  // 2. Place Static vs Dynamic into Advanced (Subtab 1: Model Registry, below architecture table)
  if (staticVsDynHtml && !html.includes('id="adv-static-vs-dynamic-comparison"')) {
    // Format for Advanced subtab
    const advStaticVsDyn = `<!-- ARCHITECTURAL FOUNDATION: STATIC VS DYNAMIC SCREENING -->
          <div id="adv-static-vs-dynamic-comparison" style="margin-top:24px; margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div>
                <h3 style="font-family:var(--font-display); font-size:15px; font-weight:700; color:#144A75; margin:0;">Static vs. Dynamic Reliability Screening Architecture</h3>
                <p style="font-size:14.5px; color:#5687AD; margin:2px 0 0 0;">Why fixed-limit ATE tests fail to intercept latent degradation before mission deployment.</p>
              </div>
              <span class="badge" style="background:#E6F1FA; color:#1976B8; font-size:13px; font-weight:700;">ENGINEERING FOUNDATION</span>
            </div>

            <div class="static-vs-dynamic-grid">
              <!-- Left: Static Screening -->
              <div class="screening-pillar-card static">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                  <div style="font-size:15px; font-weight:700; color:#2D6491;">Static ATE Screening (Conventional)</div>
                  <span class="badge" style="background:#C8DEEE; color:#2D6491; font-size:12px;">SINGLE TIMESTEP</span>
                </div>
                
                <div class="flow-progression-row">
                  <span class="flow-node">Single 0h Check</span>
                  <span class="flow-arrow">→</span>
                  <span class="flow-node">Within ±3σ Bounds</span>
                  <span class="flow-arrow">→</span>
                  <span class="flow-node highlight-pass">Verdict: PASS (0h)</span>
                  <span class="flow-arrow">→</span>
                  <span class="flow-node highlight-crit">FAILS @ 96h (Escape)</span>
                </div>

                <ul style="font-size:14px; color:#2D6491; line-height:1.5; margin-left:18px; margin-bottom:8px;">
                  <li>Checks single-point sensor readings against broad static datasheet bounds.</li>
                  <li>Blind to lot distribution shift and rate of change d(I<sub>leak</sub>)/dt.</li>
                </ul>
              </div>

              <!-- Right: Dynamic Screening -->
              <div class="screening-pillar-card dynamic">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                  <div style="font-size:15px; font-weight:700; color:#1976B8;">PREDICTA Multi-Evidence Screening</div>
                  <span class="badge pass" style="font-size:12px;">PROGNOSTIC FUSION</span>
                </div>

                <div class="flow-progression-row">
                  <span class="flow-node highlight-warn">Lot Outlier (+4.2 MAD)</span>
                  <span class="flow-arrow">→</span>
                  <span class="flow-node highlight-warn">24h Drift (+31.2%)</span>
                  <span class="flow-arrow">→</span>
                  <span class="flow-node highlight-crit">GPR Breach @ 96h</span>
                  <span class="flow-arrow">→</span>
                  <span class="flow-node highlight-crit">REJECT @ 24h</span>
                </div>

                <ul style="font-size:14px; color:#1D5582; line-height:1.5; margin-left:18px; margin-bottom:8px;">
                  <li>Part Average Testing (PAT-MAD) detects spatial shift relative to wafer lot.</li>
                  <li>Temporal GPR &amp; XGB-100 forecast future limit breach for early 24h interception.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <!-- ── SUBTAB 2: MODULE A`;

    html = html.replace(
      /<\/div>\s*<!-- ── SUBTAB 2: MODULE A/,
      advStaticVsDyn
    );
    console.log(`Placed Static vs Dynamic into Advanced page in ${filePath}`);
  }

  // 3. Replace the Active Wafer Spatial Health section with the 8-Wafer Grid
  const waferSectionRegex = /<!-- Left: Wafer Spatial Distribution -->[\s\S]*?<\/svg>\s*<\/div>\s*<\/div>/;
  if (waferSectionRegex.test(html)) {
    html = html.replace(waferSectionRegex, build8WafersHtml());
    console.log(`Replaced Wafer Spatial Health with 8-Wafer matrix in ${filePath}`);
  } else {
    console.warn(`Could not match single wafer section in ${filePath}`);
  }

  // 4. Update the Closing Tagline on Home
  const taglineRegex = /<!-- 6\. FINAL ENGINEERING CLOSING TAGLINE -->[\s\S]*?<\/div>\s*<\/section>/;
  const newTaglineHtml = `<!-- 6\. FINAL ENGINEERING CLOSING TAGLINE -->
        <div class="home-closing-tagline" style="text-align:center; padding: 48px 20px 24px 20px; color:#5687AD;">
          <div style="font-family:var(--font-display); font-size:24px; font-weight:800; color:#144A75; letter-spacing:-0.3px; margin-bottom:8px;">
            Detect Earlier. Predict Degradation. Qualify with Evidence.
          </div>
          <div style="font-family:var(--font-mono); font-size:14px; font-weight:600; color:#5687AD; letter-spacing:1.5px; text-transform:uppercase;">
            PREDICTA SEMICONDUCTOR RELIABILITY PLATFORM • 168H PROGNOSTIC QUALIFICATION
          </div>
        </div>
      </section>`;

  html = html.replace(taglineRegex, newTaglineHtml);
  console.log(`Updated Closing Tagline in ${filePath}`);

  fs.writeFileSync(filePath, html, 'utf8');
}

function updateCssFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let css = fs.readFileSync(filePath, 'utf8');

  // Update .hero-card for full-viewport appearance below navbar
  const heroCardCss = `.hero-card {
  position: relative;
  overflow: hidden;
  min-height: calc(100vh - 128px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  background-color: var(--bg-surface);
  background: radial-gradient(circle at 75% 45%, rgba(186, 230, 253, 0.45) 0%, rgba(230, 241, 250, 0.75) 50%, #E6F1FA 100%),
              linear-gradient(135deg, #EBF4FB 0%, #E2EEF8 50%, #E8F3FA 100%);
  background-size: 140% 140%;
  border: 1px solid #C8DEEE;
  border-left: 4px solid var(--accent);
  border-radius: 8px;
  padding: 40px 36px;
  margin-bottom: 28px;
  box-shadow: var(--shadow-sm);
  animation: heroBgDepthShift 12s ease-in-out infinite alternate;
}`;

  css = css.replace(/\.hero-card\s*\{[\s\S]*?animation:\s*heroBgDepthShift[^;]+;\s*\}/, heroCardCss);

  // Add 8-wafer responsive rule
  if (!css.includes('.wafers-8-grid')) {
    css += `\n
@media (max-width: 900px) {
  .wafers-8-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}
@media (max-width: 480px) {
  .wafers-8-grid {
    grid-template-columns: 1fr !important;
  }
}
`;
  }

  fs.writeFileSync(filePath, css, 'utf8');
  console.log(`Updated CSS in ${filePath}`);
}

updateIndexHtml('index.html');
updateIndexHtml('frontend/index.html');
updateCssFile('style.css');
updateCssFile('frontend/style.css');
