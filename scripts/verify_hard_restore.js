const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '../reports/restored_screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runVerification() {
  console.log('================================================================');
  console.log('PHASE 10-15: REAL CHROME BROWSER HARD RESTORE VERIFICATION');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.setCacheEnabled(false);

  const consoleErrors = [];
  const networkFailures = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('requestfailed', req => {
    networkFailures.push({ url: req.url(), failure: req.failure()?.errorText });
  });

  // Navigate with cache-bypass query
  const testUrl = 'http://localhost:8000/?build=pre-typography-restore&t=' + Date.now();
  console.log(`Navigating to: ${testUrl}`);
  await page.goto(testUrl, { waitUntil: 'networkidle0' });

  // 1. Verify Temporary Diagnostic Marker
  const bodyMarker = await page.evaluate(() => {
    return document.body.getAttribute('data-predicta-design-state');
  });
  console.log(`Diagnostic Marker in DOM: "${bodyMarker}"`);
  console.log(`Marker Valid: ${bodyMarker === 'PRE-TYPOGRAPHY' ? '✅ YES' : '❌ NO'}\n`);

  // 2. Inspect Computed Styles of Core Elements
  const computed = await page.evaluate(() => {
    const getComp = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      return {
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        borderColor: cs.borderColor
      };
    };

    return {
      body: getComp('body'),
      h1: getComp('.hero-title') || getComp('h1'),
      h2: getComp('h2') || getComp('.section-title'),
      card: getComp('.hero-card') || getComp('.card'),
      button: getComp('.btn-primary') || getComp('.btn') || getComp('button'),
      nav: getComp('.topnav')
    };
  });

  console.log('--- COMPUTED STYLES VERIFICATION ---');
  console.log('Body:', JSON.stringify(computed.body, null, 2));
  console.log('Hero Title / H1:', JSON.stringify(computed.h1, null, 2));
  console.log('Card Container:', JSON.stringify(computed.card, null, 2));
  console.log('Primary Button:', JSON.stringify(computed.button, null, 2));
  console.log('Topnav:', JSON.stringify(computed.nav, null, 2));
  console.log('');

  // 3. Capture Screenshots and Verify Page Views
  const pages = [
    { id: 'page-home', name: 'Home' },
    { id: 'page-screening', name: 'Screening' },
    { id: 'page-monitor', name: 'Live Monitor' },
    { id: 'page-components', name: 'Components' },
    { id: 'page-advanced', name: 'Advanced' }
  ];

  const pageResults = {};

  for (const p of pages) {
    console.log(`Testing page: ${p.name} (#${p.id})...`);
    await page.evaluate((pageId) => {
      window.switchPage(pageId);
    }, p.id);

    await new Promise(r => setTimeout(r, 600));

    const isVisible = await page.evaluate((pageId) => {
      const el = document.getElementById(pageId);
      if (!el) return false;
      const cs = window.getComputedStyle(el);
      return cs.display !== 'none' && el.classList.contains('active');
    }, p.id);

    const screenPath = path.join(SCREENSHOT_DIR, `${p.id}.png`);
    await page.screenshot({ path: screenPath, fullPage: false });
    console.log(`  Visible: ${isVisible ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Screenshot saved: ${screenPath}`);
    pageResults[p.name] = isVisible;
  }

  // 4. Test Advanced Subtab 7: Validation & Evidence
  console.log('\n--- TESTING ADVANCED SUBTAB ROUTING (Tab 7: Validation & Evidence) ---');
  await page.evaluate(() => {
    window.switchPage('page-advanced');
  });
  await new Promise(r => setTimeout(r, 300));

  await page.evaluate(() => {
    if (typeof window.switchAdvTab === 'function') {
      window.switchAdvTab('adv-tab-validation');
    }
  });
  await new Promise(r => setTimeout(r, 500));

  const advSubtabStatus = await page.evaluate(() => {
    const advPage = document.getElementById('page-advanced');
    const valTab = document.getElementById('adv-tab-validation');
    const advPageActive = advPage && advPage.classList.contains('active') && window.getComputedStyle(advPage).display !== 'none';
    const valTabActive = valTab && (valTab.classList.contains('active') || window.getComputedStyle(valTab).display !== 'none');
    return {
      advPageActive,
      valTabActive,
      currentHash: window.location.hash
    };
  });

  const valScreenPath = path.join(SCREENSHOT_DIR, 'adv_tab_validation.png');
  await page.screenshot({ path: valScreenPath });
  console.log('Advanced Tab 7 Validation Result:', advSubtabStatus);
  console.log(`Validation Screenshot: ${valScreenPath}`);

  // 5. Test Screening Run Analysis Execution
  console.log('\n--- TESTING SCREENING WORKFLOW EXECUTION ---');
  await page.evaluate(() => {
    window.switchPage('page-screening');
  });
  await new Promise(r => setTimeout(r, 300));

  const runExecResult = await page.evaluate(async () => {
    const btn = document.getElementById('btn-run-screening');
    if (!btn) return { error: 'btn-run-screening not found' };
    btn.click();
    await new Promise(r => setTimeout(r, 1000));
    const resultBox = document.getElementById('screening-result-container') || document.querySelector('.screening-results') || document.querySelector('.disposition-card');
    return {
      clicked: true,
      hasResult: !!resultBox
    };
  });
  console.log('Screening Execution Result:', runExecResult);

  // 6. Test Responsive Layout on Multiple Viewports
  console.log('\n--- TESTING RESPONSIVE OVERFLOW ---');
  const viewports = [1440, 1024, 768, 390];
  const overflowResults = {};
  for (const w of viewports) {
    await page.setViewport({ width: w, height: 800 });
    await new Promise(r => setTimeout(r, 200));
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth - window.innerWidth;
    });
    console.log(`Viewport ${w}px overflow: ${overflow}px`);
    overflowResults[w] = overflow <= 0;
  }

  await browser.close();

  console.log('\n================================================================');
  console.log('VERIFICATION SUMMARY');
  console.log('================================================================');
  console.log('Console Errors:', consoleErrors.length);
  if (consoleErrors.length > 0) console.log(consoleErrors);
  console.log('Network Failures:', networkFailures.length);
  if (networkFailures.length > 0) console.log(networkFailures);
  console.log('Page Navigations:', pageResults);
  console.log('Advanced Validation Tab:', advSubtabStatus.advPageActive && advSubtabStatus.valTabActive ? 'PASS' : 'FAIL');
  console.log('Overflow Checks:', overflowResults);
  console.log('================================================================\n');
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
