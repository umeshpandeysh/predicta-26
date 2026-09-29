const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

(async () => {
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

  // 1. Audit Context Bar on Home
  const ctxBarExists = (await page.$('#persistent-engineering-context-bar')) !== null;
  const ctxBarModel = await page.evaluate(() => document.getElementById('ctx-bar-model')?.innerText);
  const ctxBarCal = await page.evaluate(() => document.getElementById('ctx-bar-calibration')?.innerText);
  const ctxBarProv = await page.evaluate(() => document.getElementById('ctx-bar-provenance')?.innerText);
  const ctxBarDie = await page.evaluate(() => document.getElementById('ctx-bar-die')?.innerText);
  const ctxBarLot = await page.evaluate(() => document.getElementById('ctx-bar-lot')?.innerText);
  const ctxBarDec = await page.evaluate(() => document.getElementById('ctx-bar-decision')?.innerText);
  const ctxBarCp = await page.evaluate(() => document.getElementById('ctx-bar-checkpoint')?.innerText);
  const ctxBarHor = await page.evaluate(() => document.getElementById('ctx-bar-horizon')?.innerText);

  // 2. Audit Latent Escape Spotlight on Home
  const spotlightExists = (await page.$('#home-latent-escape-spotlight')) !== null;
  const spotlightText = await page.evaluate(() => document.getElementById('home-latent-escape-spotlight')?.innerText);

  // 3. Navigate to Screening
  await page.click('[data-page="page-screening"]');
  await new Promise(r => setTimeout(r, 400));
  const ctxBarOnScreening = await page.evaluate(() => document.getElementById('ctx-bar-die')?.innerText);
  const storyStripExists = (await page.$('#screening-analysis-story-strip')) !== null;
  const storyStripText = await page.evaluate(() => document.getElementById('screening-analysis-story-strip')?.innerText);
  const daqHealthExists = (await page.$('#screening-data-acquisition-health')) !== null;
  const daqHealthText = await page.evaluate(() => document.getElementById('screening-data-acquisition-health')?.innerText);

  // Test Story Strip Interaction
  await page.evaluate(() => window.handleStoryStripClick('validation'));
  await new Promise(r => setTimeout(r, 200));

  // 4. Navigate to Live Monitor
  await page.click('[data-page="page-overview"]');
  await new Promise(r => setTimeout(r, 400));
  const ctxBarOnMonitor = await page.evaluate(() => document.getElementById('ctx-bar-die')?.innerText);
  const fcValExists = (await page.$('#live-forecast-validation-panel')) !== null;
  const fcValText = await page.evaluate(() => document.getElementById('live-forecast-validation-panel')?.innerText);

  // Test timeline scrubber at 24h, 48h, 96h, 168h
  await page.evaluate(() => window.handleTimelineSlider(48));
  await new Promise(r => setTimeout(r, 200));
  const fcVal48Badge = await page.evaluate(() => document.getElementById('fc-val-status-badge')?.innerText);

  await page.evaluate(() => window.handleTimelineSlider(96));
  await new Promise(r => setTimeout(r, 200));
  const fcVal96Badge = await page.evaluate(() => document.getElementById('fc-val-status-badge')?.innerText);

  await page.evaluate(() => window.handleTimelineSlider(168));
  await new Promise(r => setTimeout(r, 200));
  const fcVal168Badge = await page.evaluate(() => document.getElementById('fc-val-status-badge')?.innerText);

  // 5. Navigate to Components
  await page.click('[data-page="page-component"]');
  await new Promise(r => setTimeout(r, 400));
  const ctxBarOnComponents = await page.evaluate(() => document.getElementById('ctx-bar-die')?.innerText);
  const effOppExists = (await page.$('#component-qualification-efficiency-panel')) !== null;
  const effOppText = await page.evaluate(() => document.getElementById('component-qualification-efficiency-panel')?.innerText);

  // 6. Navigate to Advanced
  await page.click('[data-page="page-advanced"]');
  await new Promise(r => setTimeout(r, 400));
  const ctxBarOnAdvanced = await page.evaluate(() => document.getElementById('ctx-bar-die')?.innerText);

  // 7. Test Passport Modal Launch and Context Bar Sync
  await page.evaluate(() => window.openReliabilityPassport('DIE-R05C12'));
  await new Promise(r => setTimeout(r, 300));
  const modalVisible = await page.evaluate(() => {
    const m = document.getElementById('component-passport-modal');
    return m && m.style.display !== 'none';
  });
  const ctxBarAfterPassport = await page.evaluate(() => document.getElementById('ctx-bar-die')?.innerText);
  await page.evaluate(() => window.closeReliabilityPassport());

  // 8. What-If Simulation Sandbox Immutability
  const whatIfImm = await page.evaluate(() => {
    const orig = JSON.stringify(window.activeCanonicalCase || {});
    window.handleSimParamChange();
    return orig === JSON.stringify(window.activeCanonicalCase || {});
  });

  // 9. Viewport responsive check
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

  const auditReport = {
    features: {
      feature1: { 
        exists: ctxBarExists, 
        die: ctxBarDie, 
        lot: ctxBarLot, 
        checkpoint: ctxBarCp, 
        horizon: ctxBarHor, 
        model: ctxBarModel, 
        calibration: ctxBarCal, 
        provenance: ctxBarProv, 
        decision: ctxBarDec 
      },
      feature2: { exists: storyStripExists, sampleText: storyStripText.replace(/\n+/g, ' | ') },
      feature3: { exists: spotlightExists, sampleText: spotlightText.replace(/\n+/g, ' | ') },
      feature4: { exists: fcValExists, badge24_168: fcVal168Badge, badge48: fcVal48Badge, badge96: fcVal96Badge, sampleText: fcValText.replace(/\n+/g, ' | ') },
      feature5: { exists: daqHealthExists, sampleText: daqHealthText.replace(/\n+/g, ' | ') },
      feature6: { exists: effOppExists, sampleText: effOppText.replace(/\n+/g, ' | ') }
    },
    navigationPersistence: {
      onScreening: ctxBarOnScreening,
      onMonitor: ctxBarOnMonitor,
      onComponents: ctxBarOnComponents,
      onAdvanced: ctxBarOnAdvanced,
      afterPassport: ctxBarAfterPassport
    },
    passportModal: { opened: modalVisible },
    whatIfImmutability: whatIfImm,
    responsive: respResults,
    errors: { consoleErrors, networkErrors }
  };

  console.log(JSON.stringify(auditReport, null, 2));
  await browser.close();
})();
