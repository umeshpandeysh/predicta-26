const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function runBrowserTest() {
  console.log("=========================================================================");
  console.log("PREDICTA-26 — REAL BROWSER (PUPPETEER-CORE) AUTOMATION & DOM AUDIT");
  console.log("=========================================================================\n");

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const execPath = fs.existsSync(edgePath) ? edgePath : (fs.existsSync(chromePath) ? chromePath : null);

  if (!execPath) {
    console.error("No Edge or Chrome executable found on standard paths.");
    return;
  }

  console.log("Launching browser:", execPath);
  const browser = await puppeteer.launch({
    executablePath: execPath,
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleLogs = [];
  const errors = [];
  const failedRequests = [];

  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  page.on('pageerror', err => {
    errors.push(err.message);
  });

  page.on('requestfailed', req => {
    failedRequests.push({ url: req.url(), failure: req.failure() });
  });

  console.log("Navigating to http://localhost:8000/?verify=20260928V4 ...");
  const response = await page.goto('http://localhost:8000/?verify=20260928V4', { waitUntil: 'networkidle0', timeout: 15000 });
  console.log("HTTP Response Status:", response.status());

  // Check 1: Build verification badge
  const badgeText = await page.evaluate(() => {
    const el = document.getElementById('build-verify-badge-nav') || document.getElementById('build-verify-badge-hud');
    return el ? el.textContent.trim() : null;
  });
  console.log("1. Build Verification Badge in DOM:", badgeText);

  // Check 2: Top Nav buttons
  const navTabs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.nav-link')).map(b => ({
      text: b.textContent.trim(),
      page: b.getAttribute('data-page'),
      active: b.classList.contains('active')
    }));
  });
  console.log("2. Top Nav Tabs found:", navTabs);

  // Check 3: Visible sections on initial load (Home)
  const homeVisible = await page.evaluate(() => {
    const el = document.getElementById('page-home');
    return el && window.getComputedStyle(el).display !== 'none';
  });
  console.log("3. Home page visible on startup:", homeVisible);

  // Check 4: Click 'Screening' tab and verify
  console.log("4. Clicking 'Screening' tab...");
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.nav-link')).find(b => b.getAttribute('data-page') === 'page-screening');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 400));

  const screeningVisible = await page.evaluate(() => {
    const el = document.getElementById('page-screening');
    const homeEl = document.getElementById('page-home');
    return {
      screeningDisplay: el ? window.getComputedStyle(el).display : 'null',
      homeDisplay: homeEl ? window.getComputedStyle(homeEl).display : 'null',
      hasCsvDropzone: !!document.getElementById('csv-upload-zone'),
      has8Stages: !!document.getElementById('pipe-input-status') && !!document.getElementById('pipe-trace-status')
    };
  });
  console.log("   Screening Page State after click:", screeningVisible);

  // Check 5: Click 'Live Monitor' tab
  console.log("5. Clicking 'Live Monitor' tab...");
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.nav-link')).find(b => b.getAttribute('data-page') === 'page-overview');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 400));

  const monitorVisible = await page.evaluate(() => {
    const el = document.getElementById('page-overview');
    return el ? window.getComputedStyle(el).display : 'null';
  });
  console.log("   Live Monitor Display:", monitorVisible);

  // Check 6: Click 'Components' tab
  console.log("6. Clicking 'Components' tab...");
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.nav-link')).find(b => b.getAttribute('data-page') === 'page-component');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 400));

  const componentVisible = await page.evaluate(() => {
    const el = document.getElementById('page-component');
    const rows = document.querySelectorAll('#lot-table-body tr');
    return {
      display: el ? window.getComputedStyle(el).display : 'null',
      rowCount: rows.length
    };
  });
  console.log("   Components Page State:", componentVisible);

  // Check 7: Open Reliability Passport
  console.log("7. Opening Reliability Passport Modal for DIE-R20C20...");
  await page.evaluate(() => {
    if (typeof window.openReliabilityPassport === 'function') {
      window.openReliabilityPassport('DIE-R20C20');
    }
  });
  await new Promise(r => setTimeout(r, 400));

  const passportModal = await page.evaluate(() => {
    const modal = document.getElementById('component-passport-modal');
    const compId = document.getElementById('passport-comp-id');
    const badge = document.getElementById('passport-decision-badge');
    return {
      display: modal ? window.getComputedStyle(modal).display : 'null',
      compId: compId ? compId.textContent.trim() : null,
      badge: badge ? badge.textContent.trim() : null
    };
  });
  console.log("   Passport Modal State:", passportModal);

  // Check 8: Click 'Judge Journey' tab
  console.log("8. Clicking 'Judge Journey' tab...");
  await page.evaluate(() => {
    if (typeof window.closeReliabilityPassport === 'function') window.closeReliabilityPassport();
    const btn = Array.from(document.querySelectorAll('.nav-link')).find(b => b.getAttribute('data-page') === 'page-judge-journey');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 400));

  const judgeVisible = await page.evaluate(() => {
    const el = document.getElementById('page-judge-journey');
    const title = document.getElementById('judge-stage-title');
    return {
      display: el ? window.getComputedStyle(el).display : 'null',
      stageTitle: title ? title.textContent.trim() : null
    };
  });
  console.log("   Judge Journey State:", judgeVisible);

  // Check 9: Click 'Advanced' tab
  console.log("9. Clicking 'Advanced' tab...");
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.nav-link')).find(b => b.getAttribute('data-page') === 'page-advanced');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 400));

  const advancedVisible = await page.evaluate(() => {
    const advEl = document.getElementById('page-advanced');
    const anomEl = document.getElementById('page-anomaly');
    return {
      advDisplay: advEl ? window.getComputedStyle(advEl).display : 'null',
      anomalySubtabDisplay: anomEl ? window.getComputedStyle(anomEl).display : 'null'
    };
  });
  console.log("   Advanced Workstation State:", advancedVisible);

  // Check 10: Run real qualification form submission
  console.log("10. Testing real form qualification submission...");
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.nav-link')).find(b => b.getAttribute('data-page') === 'page-screening');
    if (btn) btn.click();
    if (typeof window.toggleScreeningMode === 'function') window.toggleScreeningMode('manual');
  });
  await new Promise(r => setTimeout(r, 300));

  await page.evaluate(async () => {
    const form = document.getElementById('form-admin-input');
    if (form) {
      const submitBtn = document.getElementById('btn-adm-in-submit');
      if (submitBtn) submitBtn.click();
    }
  });
  await new Promise(r => setTimeout(r, 1200));

  const qualResult = await page.evaluate(() => {
    const card = document.getElementById('adm-in-res-card');
    const badge = document.getElementById('adm-in-res-badge');
    const prob = document.getElementById('adm-in-res-prob');
    const p1 = document.getElementById('pipe-input-status');
    const p8 = document.getElementById('pipe-trace-status');
    return {
      resultCardDisplay: card ? window.getComputedStyle(card).display : 'null',
      decisionBadge: badge ? badge.textContent.trim() : null,
      probability: prob ? prob.textContent.trim() : null,
      stage1Status: p1 ? p1.textContent.trim() : null,
      stage8Status: p8 ? p8.textContent.trim() : null
    };
  });
  console.log("   Qualification Submission Result:", qualResult);

  console.log("\n=========================================================================");
  console.log("BROWSER ERROR & NETWORK SUMMARY:");
  console.log("=========================================================================");
  console.log(`Page Errors: ${errors.length}`, errors);
  console.log(`Failed Requests: ${failedRequests.length}`, failedRequests);
  console.log(`Console Logs Captured: ${consoleLogs.length}`);

  await browser.close();

  const success = errors.length === 0 && failedRequests.length === 0 && badgeText !== null && qualResult.decisionBadge !== null;
  console.log("\nREAL BROWSER AUTOMATION RESULT:", success ? "100% PASS ✅" : "FAILED ❌");
  if (!success) process.exit(1);
}

runBrowserTest();
