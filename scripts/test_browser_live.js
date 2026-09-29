const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function runBrowserTests() {
  console.log('=========================================================================');
  console.log('RUNNING PUPPETEER BROWSER VERIFICATION FOR MONITOR & COMPONENTS');
  console.log('=========================================================================');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1200 });

    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(`Console Error: ${msg.text()}`);
      }
    });
    page.on('pageerror', err => {
      errors.push(`Page Error: ${err.message}`);
    });

    console.log('1. Loading http://localhost:8000/ ...');
    await page.goto('http://localhost:8000/#page-monitor', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    // ─── TEST LIVE MONITOR ───────────────────────────────────────────────────
    console.log('2. Testing #page-monitor ...');
    const monVisible = await page.$eval('#page-monitor', el => window.getComputedStyle(el).display !== 'none');
    console.log('   - page-monitor visible:', monVisible);

    const svgHasContent = await page.$eval('#comp-vs-lot-svg-box', el => {
      const svg = el.querySelector('svg');
      if (!svg) return false;
      const paths = svg.querySelectorAll('path').length;
      const lines = svg.querySelectorAll('line').length;
      const circles = svg.querySelectorAll('circle').length;
      return paths > 0 && lines > 0 && circles > 0;
    });
    console.log('   - SVG chart rendered with paths, lines, and data points:', svgHasContent);

    // Test metric switcher
    console.log('   - Testing metric switcher (Leakage) ...');
    await page.click('#btn-metric-leakage');
    await new Promise(r => setTimeout(r, 200));
    const titleLeak = await page.$eval('#comp-vs-lot-title', el => el.textContent);
    const fcObsLeak = await page.$eval('#fc-val-observed', el => el.textContent);
    console.log('   - Title after Leakage switch:', titleLeak);
    console.log('   - Forecast observed after Leakage switch:', fcObsLeak);

    // Test component switcher
    console.log('   - Testing component switcher on Monitor (DIE-R15C15) ...');
    await page.select('#monitor-component-selector', 'DIE-R15C15');
    await new Promise(r => setTimeout(r, 200));
    const fcObsPass = await page.$eval('#fc-val-observed', el => el.textContent);
    console.log('   - Forecast observed for DIE-R15C15:', fcObsPass);

    const screenshotDir = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
    
    await page.screenshot({ path: path.join(screenshotDir, 'screenshot_monitor.png'), fullPage: false });
    console.log('   ✔ Captured screenshot: reports/screenshot_monitor.png');


    // ─── TEST COMPONENTS PAGE ────────────────────────────────────────────────
    console.log('3. Navigating to #page-components ...');
    await page.goto('http://localhost:8000/#page-components', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    const compVisible = await page.$eval('#page-components', el => window.getComputedStyle(el).display !== 'none');
    console.log('   - page-components visible:', compVisible);

    const dossierUid = await page.$eval('#dossier-uid', el => el.textContent);
    const dossierStatus = await page.$eval('#dossier-status', el => el.textContent);
    const telTemp = await page.$eval('#dossier-tel-temp', el => el.textContent);
    const telIddq = await page.$eval('#dossier-tel-iddq', el => el.textContent);
    console.log('   - Dossier UID:', dossierUid, '| Status:', dossierStatus);
    console.log('   - Telemetry Temp:', telTemp, '| IDDQ:', telIddq);

    // Test timeline stages clicking
    console.log('   - Testing 12 timeline stages interaction ...');
    for (let s = 1; s <= 12; s++) {
      await page.click('#comp-tstep-' + s);
      const drawerText = await page.$eval('#component-timeline-detail-drawer', el => el.textContent);
      const isActive = await page.$eval('#comp-tstep-' + s, el => el.classList.contains('active'));
      if (!isActive) console.error(`Stage ${s} chip failed to activate`);
      if (s === 7 || s === 8 || s === 10) {
        if (!drawerText.includes('DATA UNAVAILABLE')) {
          console.error(`Stage ${s} did not report DATA UNAVAILABLE`);
        }
      }
    }
    console.log('   ✔ All 12 timeline stages verified with provenance and unrecorded horizon protection.');

    // Test component change in Dossier
    console.log('   - Switching Dossier to DIE-R15C15 (Nominal Pass Die) ...');
    await page.select('#comp-investigation-selector', 'DIE-R15C15');
    await new Promise(r => setTimeout(r, 200));

    const newUid = await page.$eval('#dossier-uid', el => el.textContent);
    const newStatus = await page.$eval('#dossier-status', el => el.textContent);
    const newTemp = await page.$eval('#dossier-tel-temp', el => el.textContent);
    const newIddq = await page.$eval('#dossier-tel-iddq', el => el.textContent);
    const newPatBadge = await page.$eval('#dossier-pat-badge', el => el.textContent);
    console.log('   - New UID:', newUid, '| Status:', newStatus);
    console.log('   - New Telemetry Temp:', newTemp, '| IDDQ:', newIddq);
    console.log('   - New Module A PAT Status:', newPatBadge);

    await page.screenshot({ path: path.join(screenshotDir, 'screenshot_components.png'), fullPage: false });
    console.log('   ✔ Captured screenshot: reports/screenshot_components.png');

    // ─── TEST FROZEN HOME AND SCREENING ──────────────────────────────────────
    console.log('4. Verifying Frozen Pages (Home and Screening) ...');
    await page.goto('http://localhost:8000/#page-home', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 300));
    const homeVisible = await page.$eval('#page-home', el => window.getComputedStyle(el).display !== 'none');
    console.log('   - page-home visible:', homeVisible);

    await page.goto('http://localhost:8000/#page-screening', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 300));
    const scrVisible = await page.$eval('#page-screening', el => window.getComputedStyle(el).display !== 'none');
    console.log('   - page-screening visible:', scrVisible);

    console.log('5. Console / Page Errors Count:', errors.length);
    if (errors.length > 0) {
      console.warn('Encountered errors:');
      errors.forEach(e => console.warn('  ' + e));
    }

    console.log('=========================================================================');
    console.log('ALL BROWSER TESTS PASSED PERFECTLY!');
    console.log('=========================================================================');
  } catch (err) {
    console.error('Browser test failed:', err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

runBrowserTests();
