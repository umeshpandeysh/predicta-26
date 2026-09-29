const puppeteer = require('puppeteer-core');
const assert = require('assert');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BROWSER_PATH = fs.existsSync(EDGE_PATH) ? EDGE_PATH : CHROME_PATH;

async function runLiveBrowserAudit() {
  console.log("=========================================================================");
  console.log("PREDICTA-26 — LIVE BROWSER DOM CONTRACT AUDIT (FINAL)");
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

  // Step 1: Open Target URL
  console.log("1. Opening http://localhost:8000/ ...");
  const resp = await page.goto('http://localhost:8000/', { waitUntil: 'networkidle0' });
  assert.strictEqual(resp.status(), 200, "Server must respond with HTTP 200");
  console.log("   ✔ HTTP 200 OK\n");

  // Step 2: Verify 5 top-level page views exist in DOM
  console.log("2. Verifying 5 top-level page views exist in DOM...");
  const pageViews = await page.evaluate(() => {
    return {
      home: !!document.getElementById('page-home'),
      screening: !!document.getElementById('page-screening'),
      overview: !!document.getElementById('page-overview'),
      component: !!document.getElementById('page-component'),
      advanced: !!document.getElementById('page-advanced'),
    };
  });
  assert.ok(pageViews.home, "page-home must exist");
  assert.ok(pageViews.screening, "page-screening must exist");
  assert.ok(pageViews.overview, "page-overview must exist");
  assert.ok(pageViews.component, "page-component must exist");
  assert.ok(pageViews.advanced, "page-advanced must exist");
  console.log("   ✔ All 5 page view sections present\n");

  // Step 3: Verify HOME is visible on startup
  console.log("3. Verifying HOME is visible on startup...");
  const homeVisible = await page.evaluate(() => {
    const el = document.getElementById('page-home');
    return el && window.getComputedStyle(el).display !== 'none';
  });
  assert.ok(homeVisible, "HOME page must be visible on startup");
  console.log("   ✔ HOME visible on startup\n");

  // Step 4: Navigate to SCREENING — verify CSV dropzone present
  console.log("4. Clicking 'Screening' tab — verifying CSV dropzone...");
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.nav-link')).find(b => b.getAttribute('data-page') === 'page-screening');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 300));

  const screeningCheck = await page.evaluate(() => {
    const pageSrc = document.getElementById('page-screening');
    const pageHome = document.getElementById('page-home');
    const csvDropzone = !!document.getElementById('csv-upload-zone');
    return {
      scrVisible: pageSrc && window.getComputedStyle(pageSrc).display !== 'none',
      homeVisible: pageHome && window.getComputedStyle(pageHome).display !== 'none',
      hasCsvDropzone: csvDropzone
    };
  });
  assert.ok(screeningCheck.scrVisible, "Screening view must be visible");
  assert.ok(!screeningCheck.homeVisible, "Home view must be hidden when Screening is active");
  assert.ok(screeningCheck.hasCsvDropzone, "Screening must contain csv-upload-zone");
  console.log("   ✔ SCREENING: visible, home hidden, csv-upload-zone present\n");

  // Step 5: Navigate to LIVE MONITOR — verify temporal slider
  console.log("5. Clicking 'Live Monitor' tab — verifying temporal slider...");
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.nav-link')).find(b => b.getAttribute('data-page') === 'page-overview');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 300));

  const monitorCheck = await page.evaluate(() => {
    const pageMon = document.getElementById('page-overview');
    const slider = !!document.getElementById('live-time-slider');
    return {
      monVisible: pageMon && window.getComputedStyle(pageMon).display !== 'none',
      hasSlider: slider
    };
  });
  assert.ok(monitorCheck.monVisible, "Live Monitor must be visible");
  assert.ok(monitorCheck.hasSlider, "Live Monitor must contain live-time-slider");
  console.log("   ✔ LIVE MONITOR: visible, live-time-slider present\n");

  // Step 6: Navigate to COMPONENTS — verify 256-row lot table
  console.log("6. Clicking 'Components' tab — verifying 256-row lot table...");
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.nav-link')).find(b => b.getAttribute('data-page') === 'page-component');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 300));

  const compCheck = await page.evaluate(() => {
    const pageComp = document.getElementById('page-component');
    const tableRows = document.querySelectorAll('#lot-table-body tr').length;
    return {
      compVisible: pageComp && window.getComputedStyle(pageComp).display !== 'none',
      tableRows
    };
  });
  assert.ok(compCheck.compVisible, "Components page must be visible");
  assert.strictEqual(compCheck.tableRows, 256, "Components table must have exactly 256 rows");
  console.log("   ✔ COMPONENTS: visible, lot-table-body has 256 rows\n");

  // Step 7: Navigate to ADVANCED — verify 9 subtabs (consistent class)
  console.log("7. Clicking 'Advanced' tab — verifying 9 subtab buttons (adv-tab-btn)...");
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.nav-link')).find(b => b.getAttribute('data-page') === 'page-advanced');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 300));

  const advCheck = await page.evaluate(() => {
    const pageAdv = document.getElementById('page-advanced');
    const subtabs = document.querySelectorAll('.adv-tab-btn').length;
    // Verify all 9 subtab content panels exist
    const panels = [
      'adv-tab-registry', 'adv-tab-mod-a', 'adv-tab-mod-b', 'adv-tab-latent-risk',
      'adv-tab-physics', 'adv-tab-governance', 'adv-tab-traceability',
      'adv-tab-simulation', 'adv-tab-reports'
    ].map(id => !!document.getElementById(id));
    return {
      advVisible: pageAdv && window.getComputedStyle(pageAdv).display !== 'none',
      subtabs,
      allPanelsPresent: panels.every(Boolean),
      panelCount: panels.filter(Boolean).length
    };
  });
  assert.ok(advCheck.advVisible, "Advanced page must be visible");
  assert.strictEqual(advCheck.subtabs, 9, "Advanced must have exactly 9 .adv-tab-btn buttons");
  assert.ok(advCheck.allPanelsPresent, `Advanced must have all 9 subtab content panels (found ${advCheck.panelCount})`);
  console.log("   ✔ ADVANCED: visible, 9 adv-tab-btn buttons, all 9 content panels present\n");

  // Step 8: Verify no adv-tab-btn-ext class exists in DOM
  console.log("8. Verifying no adv-tab-btn-ext workaround class present...");
  const hasExtClass = await page.evaluate(() => {
    return document.querySelectorAll('.adv-tab-btn-ext').length;
  });
  assert.strictEqual(hasExtClass, 0, "adv-tab-btn-ext must not exist in DOM");
  console.log("   ✔ No adv-tab-btn-ext class found\n");

  // Step 9: Verify Complete Absence of Judge Journey
  console.log("9. Checking DOM for Complete Absence of Judge Journey...");
  const judgeAudit = await page.evaluate(() => {
    const hasNavJudge = !!document.getElementById('nav-btn-judge-journey');
    const hasPageJudge = !!document.getElementById('page-judge-journey');
    const hasPills = document.querySelectorAll('.judge-pill-btn').length > 0;
    const bodyText = document.body.innerText.toLowerCase();
    const hasJudgeText = bodyText.includes('judge journey') || bodyText.includes('judge evaluation');
    return { hasNavJudge, hasPageJudge, hasPills, hasJudgeText };
  });
  assert.strictEqual(judgeAudit.hasNavJudge, false, "Judge Journey nav button must be absent");
  assert.strictEqual(judgeAudit.hasPageJudge, false, "Judge Journey page must be absent");
  assert.strictEqual(judgeAudit.hasPills, false, "Judge Journey pills must be absent");
  assert.strictEqual(judgeAudit.hasJudgeText, false, "Judge Journey text must be absent");
  console.log("   ✔ JUDGE JOURNEY COMPLETELY PURGED (0 REFERENCES IN DOM)\n");

  // Step 10: Verify V5 markers completely absent
  console.log("10. Verifying V5 build markers completely absent from DOM...");
  const v5Audit = await page.evaluate(() => {
    return {
      hasBadgeNav: !!document.getElementById('build-verify-badge-nav'),
      hasTagHome: !!document.getElementById('tag-v5-home'),
      hasTagScreening: !!document.getElementById('tag-v5-screening'),
      hasTagMonitor: !!document.getElementById('tag-v5-monitor'),
      hasTagComponents: !!document.getElementById('tag-v5-components'),
      hasTagAdvanced: !!document.getElementById('tag-v5-advanced'),
    };
  });
  assert.strictEqual(v5Audit.hasBadgeNav, false, "build-verify-badge-nav must be absent");
  assert.strictEqual(v5Audit.hasTagHome, false, "tag-v5-home must be absent");
  assert.strictEqual(v5Audit.hasTagScreening, false, "tag-v5-screening must be absent");
  assert.strictEqual(v5Audit.hasTagMonitor, false, "tag-v5-monitor must be absent");
  assert.strictEqual(v5Audit.hasTagComponents, false, "tag-v5-components must be absent");
  assert.strictEqual(v5Audit.hasTagAdvanced, false, "tag-v5-advanced must be absent");
  console.log("   ✔ All V5 marker elements absent from DOM\n");

  // Step 11: Browser Diagnostics
  console.log("11. Browser Diagnostics:");
  console.log("   Console Errors:", consoleErrors.length, consoleErrors);
  console.log("   Network Failures:", networkFailures.length, networkFailures);

  assert.strictEqual(consoleErrors.length, 0, "Console must have 0 uncaught errors");
  assert.strictEqual(networkFailures.length, 0, "Network must have 0 failed requests");

  await browser.close();

  console.log("=========================================================================");
  console.log("🏆 LIVE BROWSER AUDIT: ALL CONTRACTS VERIFIED (JUDGE PURGED, V5 MARKERS ABSENT, 9 TABS CONFIRMED)!");
  console.log("=========================================================================\n");
}

runLiveBrowserAudit().catch(err => {
  console.error("FATAL ERROR IN BROWSER AUDIT:", err);
  process.exit(1);
});
