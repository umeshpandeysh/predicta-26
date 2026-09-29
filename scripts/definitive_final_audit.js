const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

(async () => {
  console.log("Starting Definitive Final Frontend Capability Audit...");
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  const networkErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('requestfailed', req => {
    networkErrors.push(req.url() + ' - ' + req.failure().errorText);
  });

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle0' });

  const audit = {};

  // =========================================================================
  // Section A: Persistent Engineering Context Bar
  // =========================================================================
  const ctxBar = await page.$('#persistent-engineering-context-bar');
  const ctxBarData = await page.evaluate(() => {
    return {
      exists: document.getElementById('persistent-engineering-context-bar') !== null,
      die: document.getElementById('ctx-bar-die')?.innerText,
      lot: document.getElementById('ctx-bar-lot')?.innerText,
      checkpoint: document.getElementById('ctx-bar-checkpoint')?.innerText,
      horizon: document.getElementById('ctx-bar-horizon')?.innerText,
      provenance: document.getElementById('ctx-bar-provenance')?.innerText,
      model: document.getElementById('ctx-bar-model')?.innerText,
      calibration: document.getElementById('ctx-bar-calibration')?.innerText,
      decision: document.getElementById('ctx-bar-decision')?.innerText
    };
  });
  audit.sectionA = ctxBarData;

  // =========================================================================
  // Section B: Analysis Story Strip (Screening)
  // =========================================================================
  await page.click('[data-page="page-screening"]');
  await new Promise(r => setTimeout(r, 400));
  const storyStripData = await page.evaluate(() => {
    const el = document.getElementById('screening-analysis-story-strip');
    const steps = Array.from(document.querySelectorAll('.story-step-card')).map(s => s.innerText.replace(/\n+/g, ' | '));
    return {
      exists: el !== null,
      stepsCount: steps.length,
      steps: steps
    };
  });
  audit.sectionB = storyStripData;

  // =========================================================================
  // Section C: Latent Escape Spotlight (Home)
  // =========================================================================
  await page.click('[data-page="page-home"]');
  await new Promise(r => setTimeout(r, 400));
  const spotlightData = await page.evaluate(() => {
    const el = document.getElementById('home-latent-escape-spotlight');
    return {
      exists: el !== null,
      text: el?.innerText.replace(/\n+/g, ' | '),
      mad: document.getElementById('spotlight-mad-val')?.innerText,
      drift: document.getElementById('spotlight-drift-val')?.innerText,
      breach: document.getElementById('spotlight-breach-val')?.innerText,
      decision: document.getElementById('spotlight-decision-val')?.innerText
    };
  });
  audit.sectionC = spotlightData;

  // =========================================================================
  // Section D: Static Limit vs Dynamic Intelligence
  // =========================================================================
  const staticVsDynamicData = await page.evaluate(() => {
    const el = document.getElementById('home-quadrant-cards') || document.querySelector('.grid-static-dynamic') || document.querySelector('.quadrant-container');
    const cards = Array.from(document.querySelectorAll('.quadrant-card, .methodology-card')).map(c => c.innerText.replace(/\n+/g, ' | '));
    return {
      exists: el !== null || cards.length > 0,
      count: cards.length,
      sample: cards.slice(0, 2)
    };
  });
  audit.sectionD = staticVsDynamicData;

  // =========================================================================
  // Section E & F: Forecast Validation & Legend (Live Monitor)
  // =========================================================================
  await page.click('[data-page="page-overview"]');
  await new Promise(r => setTimeout(r, 400));
  const fcValData = await page.evaluate(() => {
    const el = document.getElementById('live-forecast-validation-panel');
    const badge = document.getElementById('fc-val-status-badge')?.innerText;
    const origin = document.querySelector('.fc-val-num')?.innerText;
    const horizon = document.getElementById('fc-val-horizon')?.innerText;
    const obs = document.getElementById('fc-val-observed')?.innerText;
    const pred = document.getElementById('fc-val-predicted')?.innerText;
    const res = document.getElementById('fc-val-residual')?.innerText;
    const mae = document.getElementById('fc-val-mae')?.innerText;
    const disc = document.getElementById('fc-val-disclaimer')?.innerText;
    return {
      exists: el !== null,
      badge, origin, horizon, obs, pred, res, mae, disc
    };
  });

  // Test 48h scrub
  await page.evaluate(() => window.handleTimelineSlider(48));
  await new Promise(r => setTimeout(r, 200));
  fcValData.badgeAt48 = await page.evaluate(() => document.getElementById('fc-val-status-badge')?.innerText);

  // Test 96h scrub
  await page.evaluate(() => window.handleTimelineSlider(96));
  await new Promise(r => setTimeout(r, 200));
  fcValData.badgeAt96 = await page.evaluate(() => document.getElementById('fc-val-status-badge')?.innerText);

  // Test 168h scrub
  await page.evaluate(() => window.handleTimelineSlider(168));
  await new Promise(r => setTimeout(r, 200));
  fcValData.badgeAt168 = await page.evaluate(() => document.getElementById('fc-val-status-badge')?.innerText);
  audit.sectionEF = fcValData;

  // =========================================================================
  // Section G: Data Acquisition Health (Screening)
  // =========================================================================
  await page.click('[data-page="page-screening"]');
  await new Promise(r => setTimeout(r, 400));
  const daqHealthData = await page.evaluate(() => {
    const el = document.getElementById('screening-data-acquisition-health');
    return {
      exists: el !== null,
      overall: document.getElementById('daq-overall-badge')?.innerText,
      schema: document.getElementById('daq-schema-val')?.innerText,
      missing: document.getElementById('daq-missing-val')?.innerText,
      range: document.getElementById('daq-range-val')?.innerText,
      clamp: document.getElementById('daq-clamp-val')?.innerText,
      inst: document.getElementById('daq-inst-val')?.innerText,
      cohort: document.getElementById('daq-cohort-val')?.innerText
    };
  });
  audit.sectionG = daqHealthData;

  // =========================================================================
  // Section H: Component Investigation Queue (Components)
  // =========================================================================
  await page.click('[data-page="page-component"]');
  await new Promise(r => setTimeout(r, 400));
  const queueData = await page.evaluate(() => {
    const queueEl = document.getElementById('component-investigation-queue-container');
    const rows = Array.from(document.querySelectorAll('#investigation-queue-table-body tr')).length;
    const filter = document.getElementById('queue-filter-status') !== null;
    return {
      exists: queueEl !== null,
      rowCount: rows,
      hasFilter: filter
    };
  });
  audit.sectionH = queueData;

  // =========================================================================
  // Section I & J: Component vs Lot Normality Lens & Visualization
  // =========================================================================
  const compVsLotData = await page.evaluate(() => {
    const chart = document.getElementById('chart-comp-vs-lot-container') || document.getElementById('chart-component-vs-lot');
    const table = document.getElementById('component-lot-stats-table') || document.querySelector('.component-lot-lens-table');
    return {
      chartExists: chart !== null,
      tableExists: table !== null
    };
  });
  audit.sectionIJ = compVsLotData;

  // =========================================================================
  // Section K & L: Why This Call & Model Agreement / Conflict
  // =========================================================================
  await page.click('[data-page="page-screening"]');
  await new Promise(r => setTimeout(r, 400));
  const whyCallData = await page.evaluate(() => {
    const panel = document.getElementById('screening-why-this-call-panel');
    const pop = document.getElementById('why-pop-badge')?.innerText;
    const fc = document.getElementById('why-fc-badge')?.innerText;
    const risk = document.getElementById('why-risk-badge')?.innerText;
    const phys = document.getElementById('why-phys-badge')?.innerText;
    const dec = document.getElementById('why-dec-badge')?.innerText;
    return {
      exists: panel !== null,
      pop, fc, risk, phys, dec
    };
  });
  audit.sectionKL = whyCallData;

  // =========================================================================
  // Section M & Q: Evidence Pathway View & Technical Evidence Graph (Advanced)
  // =========================================================================
  await page.click('[data-page="page-advanced"]');
  await new Promise(r => setTimeout(r, 400));
  const evidenceGraphData = await page.evaluate(() => {
    const graphContainer = document.getElementById('technical-evidence-graph-container') || document.getElementById('adv-tab-evidence-graph');
    const nodes = Array.from(document.querySelectorAll('.evidence-graph-node, .graph-node')).map(n => n.innerText.replace(/\n+/g, ' '));
    return {
      exists: graphContainer !== null,
      nodeCount: nodes.length,
      sampleNodes: nodes.slice(0, 4)
    };
  });
  audit.sectionMQ = evidenceGraphData;

  // =========================================================================
  // Section N & O: ReliabilityCase Timeline & Complete Passport
  // =========================================================================
  await page.evaluate(() => window.openReliabilityPassport('DIE-R20C20'));
  await new Promise(r => setTimeout(r, 300));
  const passportData = await page.evaluate(() => {
    const modal = document.getElementById('component-passport-modal');
    const compId = document.getElementById('passport-comp-id')?.innerText;
    const lotId = document.getElementById('passport-lot-id')?.innerText;
    const badge = document.getElementById('passport-decision-badge')?.innerText;
    const prob = document.getElementById('passport-prob-val')?.innerText;
    const timelineChips = Array.from(document.querySelectorAll('.timeline-chip, .pstep-chip')).length;
    return {
      modalOpen: modal && modal.style.display !== 'none',
      compId, lotId, badge, prob,
      timelineStagesCount: timelineChips
    };
  });
  await page.evaluate(() => window.closeReliabilityPassport());
  audit.sectionNO = passportData;

  // =========================================================================
  // Section P: What-If Analysis Simulator (Advanced)
  // =========================================================================
  const whatIfData = await page.evaluate(() => {
    const simPanel = document.getElementById('whatif-simulation-panel') || document.getElementById('adv-tab-simulation');
    const sliderVdd = document.getElementById('sim-slider-vdd');
    const sliderTemp = document.getElementById('sim-slider-temp');
    const origCaseStr = JSON.stringify(window.activeCanonicalCase || {});
    if (sliderTemp) sliderTemp.value = '105.0';
    if (typeof window.handleSimParamChange === 'function') window.handleSimParamChange();
    const simDisp = document.getElementById('sim-res-badge')?.innerText;
    const isImmutable = origCaseStr === JSON.stringify(window.activeCanonicalCase || {});
    return {
      exists: simPanel !== null,
      hasSliders: sliderVdd !== null && sliderTemp !== null,
      simulatedDisposition: simDisp,
      canonicalCaseImmutable: isImmutable
    };
  });
  audit.sectionP = whatIfData;

  // =========================================================================
  // Section T: Qualification Efficiency Opportunity (Components)
  // =========================================================================
  await page.click('[data-page="page-component"]');
  await new Promise(r => setTimeout(r, 400));
  const effOppData = await page.evaluate(() => {
    const el = document.getElementById('component-qualification-efficiency-panel');
    const total = document.getElementById('eff-total-units')?.innerText;
    const flagged = document.getElementById('eff-flagged-units')?.innerText;
    const nominal = document.getElementById('eff-nominal-units')?.innerText;
    const early = document.getElementById('eff-early-review')?.innerText;
    const timeOpp = document.getElementById('eff-time-opp')?.innerText;
    return {
      exists: el !== null,
      text: el?.innerText.replace(/\n+/g, ' | '),
      total, flagged, nominal, early, timeOpp
    };
  });
  audit.sectionT = effOppData;

  // =========================================================================
  // Section V: Prohibited Patterns Check
  // =========================================================================
  const prohibitedChecks = await page.evaluate(() => {
    const bodyHtml = document.body.innerHTML.toLowerCase();
    return {
      hasJudgeJourney: bodyHtml.includes('judge journey') || bodyHtml.includes('judge-journey'),
      hasGiantMarketingBanner: bodyHtml.includes('sih marketing') || bodyHtml.includes('hackathon pitch'),
      hasNeonCyberpunk: bodyHtml.includes('cyberpunk') || bodyHtml.includes('matrix-theme'),
      hasFakeConfidenceGauges: bodyHtml.includes('ai confidence: 99%') || bodyHtml.includes('ai confidence: 100%'),
      hasAsilDClaims: bodyHtml.includes('asil-d certified') || bodyHtml.includes('iso 26262 compliant') || bodyHtml.includes('iso 26262 certified'),
      hasSafeToEndBurnIn: bodyHtml.includes('safe to end burn-in')
    };
  });
  audit.sectionV = prohibitedChecks;

  // =========================================================================
  // Section W: Viewport Responsiveness
  // =========================================================================
  const viewports = [1440, 1024, 768, 390];
  const respResults = {};
  for (const w of viewports) {
    await page.setViewport({ width: w, height: 800 });
    let maxSw = 0;
    for (const p of ['page-home', 'page-screening', 'page-overview', 'page-component', 'page-advanced']) {
      await page.evaluate(pid => window.switchPage(pid), p);
      await new Promise(r => setTimeout(r, 100));
      const sw = await page.evaluate(() => document.body.scrollWidth);
      if (sw > maxSw) maxSw = sw;
    }
    respResults[w] = { maxScrollWidth: maxSw, hasOverflow: maxSw > w };
  }
  audit.sectionW = respResults;
  audit.errors = { consoleErrors, networkErrors };

  console.log("=== AUDIT RESULTS DUMP ===");
  console.log(JSON.stringify(audit, null, 2));

  fs.writeFileSync('definitive_audit_results.json', JSON.stringify(audit, null, 2), 'utf8');
  await browser.close();
})();
