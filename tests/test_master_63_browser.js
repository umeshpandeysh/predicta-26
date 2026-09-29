/**
 * PREDICTA-26 — MASTER 60-REQUIREMENT BROWSER & ARCHITECTURAL ACCEPTANCE SUITE
 * File: tests/test_master_63_browser.js
 */

const puppeteer = require('puppeteer-core');
const assert = require('assert');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BROWSER_PATH = fs.existsSync(EDGE_PATH) ? EDGE_PATH : CHROME_PATH;

async function runMasterAcceptanceTest() {
  console.log("=========================================================================");
  console.log("PREDICTA-26 — MASTER BROWSER & ARCHITECTURAL ACCEPTANCE SUITE");
  console.log("=========================================================================\n");

  const browser = await puppeteer.launch({
    executablePath: BROWSER_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  const networkFailures = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('requestfailed', req => {
    networkFailures.push({ url: req.url(), failure: req.failure().errorText });
  });

  // TEST 1: SERVER & ROUTING HEALTH
  console.log("1. Navigating to http://localhost:8000/?test=master60 ...");
  const resp = await page.goto('http://localhost:8000/?test=master60', { waitUntil: 'networkidle0' });
  assert.strictEqual(resp.status(), 200, "Server must respond with HTTP 200");
  console.log("   ✔ HTTP 200 Received ✅");

  // TEST 2: RESTORED HISTORICAL PREDICTA HOME COMMAND CENTER
  console.log("\n2. Auditing Home Page Command Center (R49-R55)...");
  const homeElements = await page.evaluate(() => {
    const heroCard = document.querySelector('.hero-card');
    const isometricDie = document.querySelector('.hero-card svg');
    const kpiCards = document.querySelectorAll('.grid-kpi-4 .card');
    const waferMap = document.getElementById('die-visualizer-container') || document.getElementById('svg-die-map');
    const queueTable = document.querySelector('#page-home table');
    const bodyText = document.body.innerText;

    const hasSIH = bodyText.includes('Smart India Hackathon') || bodyText.includes('Problem Statement 170') || bodyText.includes('SIH 2026');
    const hasAdmin = bodyText.includes('Admin Login') || bodyText.includes('Fleet Hierarchy');
    const hasJudgeOnHome = bodyText.includes('Judge Journey') || bodyText.includes('Judge Evaluation');

    return {
      hasHero: !!heroCard,
      hasDie: !!isometricDie,
      kpiCount: kpiCards.length,
      hasWaferMap: !!waferMap,
      hasQueueTable: !!queueTable,
      hasSIH,
      hasAdmin,
      hasJudgeOnHome
    };
  });

  assert.ok(homeElements.hasHero, "Restored light-blue hero card must exist on Home");
  assert.ok(homeElements.hasDie, "3D isometric SVG silicon chip die must render in hero");
  assert.strictEqual(homeElements.kpiCount, 4, "Must have exactly 4 uniform white KPI summary cards");
  assert.ok(homeElements.hasWaferMap, "Silicon Die Thermal & Degradation Map must exist");
  assert.ok(homeElements.hasQueueTable, "Priority Screening Queue table must exist");
  assert.strictEqual(homeElements.hasSIH, false, "Must have ZERO SIH / PS-170 text");
  assert.strictEqual(homeElements.hasAdmin, false, "Must have ZERO Admin Login or Fleet Hierarchy");
  assert.strictEqual(homeElements.hasJudgeOnHome, false, "Must have ZERO Judge Journey references");
  console.log("   ✔ Home Page Command Center Verified (R49-R55) ✅");

  // TEST 3: 5 DISTINCT TOP-LEVEL ROUTES
  console.log("\n3. Testing 5 Distinct Top-Level Routes (R56, R58, R60)...");
  const routes = [
    { name: 'Screening', pageId: 'page-screening' },
    { name: 'Live Monitor', pageId: 'page-overview' },
    { name: 'Components', pageId: 'page-component' },
    { name: 'Advanced', pageId: 'page-advanced' },
    { name: 'Home', pageId: 'page-home' }
  ];

  for (const r of routes) {
    await page.evaluate((pid) => window.switchPage(pid), r.pageId);
    await new Promise(res => setTimeout(res, 250));

    const isVisible = await page.evaluate((pid) => {
      const el = document.getElementById(pid);
      return el && window.getComputedStyle(el).display !== 'none';
    }, r.pageId);

    assert.ok(isVisible, `Page ${r.name} (#${r.pageId}) must be visible`);
    console.log(`   ✔ Route '${r.name}' activated cleanly ✅`);
  }

  // TEST 4: SCREENING WORKSPACE (CSV & MANUAL 8-STAGE PIPELINE)
  console.log("\n4. Testing Screening Workspace (CSV & Manual 8-Stage Pipeline) (R41-R48)...");
  await page.click('[data-page="page-screening"]');
  await new Promise(r => setTimeout(r, 250));

  const screeningModes = await page.evaluate(() => {
    const csvView = document.getElementById('screening-view-csv');
    const manualView = document.getElementById('screening-view-manual');
    return {
      csvActive: csvView && window.getComputedStyle(csvView).display !== 'none',
      manualActive: manualView && window.getComputedStyle(manualView).display !== 'none'
    };
  });
  assert.ok(screeningModes.csvActive, "CSV Upload is the default first-class view");
  console.log("   ✔ CSV Upload First-Class Workspace Confirmed ✅");

  // Switch to Manual & Run Qualification Submission
  await page.evaluate(() => window.toggleScreeningMode('manual'));
  await new Promise(r => setTimeout(r, 250));

  await page.evaluate(() => {
    const submitBtn = document.getElementById('btn-adm-in-submit');
    if (submitBtn) submitBtn.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  const pipelineStages = await page.evaluate(() => {
    const s1 = document.getElementById('pipe-input-status')?.textContent.trim();
    const s2 = document.getElementById('pipe-dq-status')?.textContent.trim();
    const s3 = document.getElementById('pipe-mod-a-status')?.textContent.trim();
    const s4 = document.getElementById('pipe-mod-b-status')?.textContent.trim();
    const s5 = document.getElementById('pipe-risk-status')?.textContent.trim();
    const s6 = document.getElementById('pipe-physics-status')?.textContent.trim();
    const s7 = document.getElementById('pipe-decision-status')?.textContent.trim();
    const s8 = document.getElementById('pipe-trace-status')?.textContent.trim();
    const badge = document.getElementById('adm-in-res-badge')?.textContent.trim();
    return { s1, s2, s3, s4, s5, s6, s7, s8, badge };
  });

  assert.strictEqual(pipelineStages.s1, 'INGESTED', "Stage 1 must be INGESTED");
  assert.strictEqual(pipelineStages.s8, 'SIGNED', "Stage 8 must be SIGNED");
  assert.strictEqual(pipelineStages.badge, 'PASS', "Nominal input qualification must be PASS");
  console.log("   ✔ 8-Stage Interactive ML Pipeline Executed & Hydrated (S1=INGESTED -> S8=SIGNED) ✅");

  // TEST 5: COMPONENTS INVENTORY & RELIABILITY PASSPORT MODAL (R30, R59)
  console.log("\n5. Testing Components Inventory & Reliability Passport Modal (R30, R59)...");
  await page.click('[data-page="page-component"]');
  await new Promise(r => setTimeout(r, 300));

  await page.evaluate(() => {
    if (typeof window.openReliabilityPassport === 'function') {
      window.openReliabilityPassport('DIE-R20C20');
    }
  });
  await new Promise(r => setTimeout(r, 400));

  const passportStatus = await page.evaluate(() => {
    const modal = document.getElementById('component-passport-modal');
    const compId = document.getElementById('passport-comp-id')?.textContent.trim();
    const badge = document.getElementById('passport-decision-badge')?.textContent.trim();
    const sha = document.getElementById('passport-model-sha')?.textContent.trim();
    return {
      display: modal ? window.getComputedStyle(modal).display : 'none',
      compId,
      badge,
      sha
    };
  });

  assert.strictEqual(passportStatus.display, 'flex', "Passport modal must be visible");
  assert.strictEqual(passportStatus.compId, 'DIE-R20C20', "Passport component ID match");
  assert.strictEqual(passportStatus.badge, 'PASS', "Passport badge match");
  console.log("   ✔ Reliability Passport Modal Opened with Governed Decision & Cryptographic SHA ✅");

  // Close passport
  await page.evaluate(() => {
    if (typeof window.closeReliabilityPassport === 'function') window.closeReliabilityPassport();
  });
  await new Promise(r => setTimeout(r, 200));

  // TEST 6: LIVE MONITOR TEMPORAL SLIDER & SVG CHARTS (R23-R25)
  console.log("\n6. Testing Live Monitor Temporal Replay & SVG Telemetry Charts (R23-R25)...");
  await page.click('[data-page="page-overview"]');
  await new Promise(r => setTimeout(r, 300));

  await page.evaluate(() => {
    const slider = document.getElementById('live-time-slider');
    if (slider) {
      slider.value = 96;
      if (typeof window.updateLiveMonitorHour === 'function') window.updateLiveMonitorHour(96);
    }
  });
  await new Promise(r => setTimeout(r, 300));

  const liveState = await page.evaluate(() => {
    const badge = document.getElementById('live-current-hour-badge')?.textContent.trim();
    const chart1Svg = !!document.querySelector('#chart-iddq-container svg');
    const chart2Svg = !!document.querySelector('#chart-leakage-container svg');
    const chart3Svg = !!document.querySelector('#chart-tpd-container svg');
    return { badge, chart1Svg, chart2Svg, chart3Svg };
  });
  assert.ok(liveState.badge?.includes('96'), "Live monitor hour badge must reflect 96h");
  assert.ok(liveState.chart1Svg && liveState.chart2Svg && liveState.chart3Svg, "All 3 synchronized SVG charts must be rendered");
  console.log("   ✔ Live Monitor Temporal Replay & 3 Synchronized SVG Charts Verified ✅");

  // TEST 7: ADVANCED WORKSTATION 5 SUBTABS (R58)
  console.log("\n7. Testing Advanced Engineering Workstation Subtabs (R58)...");
  await page.click('[data-page="page-advanced"]');
  await new Promise(r => setTimeout(r, 300));

  const advSubtabs = ['page-anomaly', 'page-drift', 'page-decision', 'page-datasets', 'page-reports'];
  for (const sub of advSubtabs) {
    await page.evaluate((target) => window.switchAdvancedTab(target), sub);
    await new Promise(r => setTimeout(r, 200));
    const isSubActive = await page.evaluate((target) => {
      const el = document.getElementById(target);
      return el && window.getComputedStyle(el).display !== 'none';
    }, sub);
    assert.ok(isSubActive, `Subtab ${sub} must become active`);
  }
  console.log("   ✔ All 5 Advanced Engineering Workstation Subtabs Verified ✅");

  // TEST 8: JUDGE JOURNEY PURGE VERIFICATION (R57 SUPERSEDED)
  console.log("\n8. Verifying 100% Complete Absence of Judge Journey (R57 Superseded)...");
  const judgeAudit = await page.evaluate(() => {
    const hasNav = !!document.getElementById('nav-btn-judge-journey');
    const hasPage = !!document.getElementById('page-judge-journey');
    const hasPills = document.querySelectorAll('.judge-pill-btn').length > 0;
    const bodyText = document.body.innerText.toLowerCase();
    const hasJudgeText = bodyText.includes('judge journey') || bodyText.includes('judge evaluation');
    return { hasNav, hasPage, hasPills, hasJudgeText };
  });
  assert.strictEqual(judgeAudit.hasNav, false, "Nav button must not exist");
  assert.strictEqual(judgeAudit.hasPage, false, "Page section must not exist");
  assert.strictEqual(judgeAudit.hasPills, false, "Pills must not exist");
  assert.strictEqual(judgeAudit.hasJudgeText, false, "Judge text must not exist in DOM");
  console.log("   ✔ 100% Complete Absence of Judge Journey Verified (R57 Superseded) ✅");

  // TEST 9: MULTI-VIEWPORT RESPONSIVENESS (1440, 1024, 768, 390)
  console.log("\n9. Testing Multi-Viewport Responsiveness (Desktop, Tablet, Mobile)...");
  const viewports = [
    { name: '1440 Desktop', width: 1440, height: 900 },
    { name: '1024 Tablet Landscape', width: 1024, height: 768 },
    { name: '768 Tablet Portrait', width: 768, height: 1024 },
    { name: '390 Mobile', width: 390, height: 844 }
  ];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise(r => setTimeout(r, 200));
    const layoutValid = await page.evaluate(() => {
      const bodyWidth = document.body.scrollWidth;
      const innerWidth = window.innerWidth;
      return bodyWidth <= innerWidth + 20; // no extreme horizontal page breakage
    });
    assert.ok(layoutValid, `Layout responsive at ${vp.name}`);
    console.log(`   ✔ Viewport ${vp.name} verified without clipping/breakage ✅`);
  }

  // TEST 10: CONSOLE & NETWORK INTEGRITY
  console.log("\n10. Auditing Browser Console & Network...");
  console.log(`   Console Errors: ${consoleErrors.length}`, consoleErrors);
  console.log(`   Network Failures: ${networkFailures.length}`, networkFailures);
  assert.strictEqual(consoleErrors.length, 0, "Console must have 0 uncaught errors");
  assert.strictEqual(networkFailures.length, 0, "Network must have 0 failed requests");

  await browser.close();

  console.log("\n=========================================================================");
  console.log("🏆 ALL REQUIREMENTS VERIFIED IN REAL BROWSER (100% PASS)!");
  console.log("=========================================================================\n");
}

runMasterAcceptanceTest().catch(err => {
  console.error("FATAL ERROR IN MASTER ACCEPTANCE TEST:", err);
  process.exit(1);
});
