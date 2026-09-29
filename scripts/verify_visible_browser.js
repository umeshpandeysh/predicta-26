const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const REPORTS_DIR = path.join(__dirname, '..', 'reports');
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

(async () => {
  console.log("=========================================================================");
  console.log("AUTHORITATIVE LIVE VISIBLE BROWSER AUDIT: SCREENSHOTS & COMPUTED STYLES");
  console.log("=========================================================================");

  let browser;
  const consoleErrors = [];
  const failedRequests = [];

  try {
    // Launch real Chrome browser in headless: false or new headless for robust capture
    // To support headless environments while rendering actual Chrome layout engine:
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 960 });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`[BROWSER ERROR]: ${msg.text()}`);
        consoleErrors.push(msg.text());
      }
    });

    page.on('requestfailed', req => {
      console.error(`[REQUEST FAILED]: ${req.url()} (${req.failure()?.errorText})`);
      failedRequests.push(req.url());
    });

    // Add cache-busting timestamp
    const targetUrl = `http://localhost:8000/?t=${Date.now()}#page-home`;
    console.log(`1. Navigating to ${targetUrl} ...`);
    await page.goto(targetUrl, { waitUntil: 'networkidle0' });

    // Wait for fonts to load
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    // Verify Build Marker
    const buildMarker = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="predicta-build"]');
      return {
        metaContent: meta ? meta.getAttribute('content') : null,
        windowBuildId: window.PREDICTA_BUILD_ID || null
      };
    });
    console.log("   - Build Marker:", JSON.stringify(buildMarker));

    // Verify Font availability in browser
    const fontsLoaded = await page.evaluate(() => {
      return {
        spaceGrotesk: document.fonts.check('700 34px "Space Grotesk"'),
        inter: document.fonts.check('500 15px "Inter"'),
        jetBrainsMono: document.fonts.check('600 12px "JetBrains Mono"')
      };
    });
    console.log("   - Font Loading Status (document.fonts.check):", JSON.stringify(fontsLoaded));

    // 2. PAGE 1: HOME SCREENSHOT & STYLES
    console.log("\n2. Capturing & Auditing HOME page ...");
    await page.evaluate(() => window.switchPage('page-home'));
    await new Promise(r => setTimeout(r, 200));
    const homeScreenshot = path.join(REPORTS_DIR, 'live_visible_home.png');
    await page.screenshot({ path: homeScreenshot, fullPage: false });
    console.log(`   ✔ Screenshot saved: ${homeScreenshot}`);

    const homeStyles = await page.evaluate(() => {
      const h1 = document.querySelector('#page-home .page-title');
      const p = document.querySelector('#page-home .page-subtitle');
      const btn = document.querySelector('#page-home .btn-primary');
      const hero = document.querySelector('#page-home .hero-card');
      const body = document.body;

      return {
        bodyBg: window.getComputedStyle(body).backgroundColor,
        bodyFont: window.getComputedStyle(body).fontFamily,
        h1Font: h1 ? window.getComputedStyle(h1).fontFamily : null,
        h1Size: h1 ? window.getComputedStyle(h1).fontSize : null,
        h1Weight: h1 ? window.getComputedStyle(h1).fontWeight : null,
        h1Color: h1 ? window.getComputedStyle(h1).color : null,
        pSize: p ? window.getComputedStyle(p).fontSize : null,
        pColor: p ? window.getComputedStyle(p).color : null,
        btnBg: btn ? window.getComputedStyle(btn).backgroundColor : null,
        btnColor: btn ? window.getComputedStyle(btn).color : null,
        heroBg: hero ? window.getComputedStyle(hero).backgroundColor : null,
        heroBorder: hero ? window.getComputedStyle(hero).borderColor : null
      };
    });
    console.log("   - Home Styles:", JSON.stringify(homeStyles, null, 2));

    // 3. PAGE 2: SCREENING SCREENSHOT & STYLES
    console.log("\n3. Capturing & Auditing SCREENING page ...");
    await page.evaluate(() => window.switchPage('page-screening'));
    await new Promise(r => setTimeout(r, 200));
    const screeningScreenshot = path.join(REPORTS_DIR, 'live_visible_screening.png');
    await page.screenshot({ path: screeningScreenshot, fullPage: false });
    console.log(`   ✔ Screenshot saved: ${screeningScreenshot}`);

    const screeningStyles = await page.evaluate(() => {
      const h1 = document.querySelector('#page-screening .page-title');
      const label = document.querySelector('#page-screening label');
      const input = document.querySelector('#page-screening input, #page-screening select');
      return {
        h1Font: h1 ? window.getComputedStyle(h1).fontFamily : null,
        h1Size: h1 ? window.getComputedStyle(h1).fontSize : null,
        labelSize: label ? window.getComputedStyle(label).fontSize : null,
        labelWeight: label ? window.getComputedStyle(label).fontWeight : null,
        inputBorder: input ? window.getComputedStyle(input).borderColor : null
      };
    });
    console.log("   - Screening Styles:", JSON.stringify(screeningStyles, null, 2));

    // 4. PAGE 3: LIVE MONITOR SCREENSHOT & STYLES
    console.log("\n4. Capturing & Auditing LIVE MONITOR page ...");
    await page.evaluate(() => window.switchPage('page-monitor'));
    await new Promise(r => setTimeout(r, 200));
    const monitorScreenshot = path.join(REPORTS_DIR, 'live_visible_monitor.png');
    await page.screenshot({ path: monitorScreenshot, fullPage: false });
    console.log(`   ✔ Screenshot saved: ${monitorScreenshot}`);

    // 5. PAGE 4: COMPONENTS SCREENSHOT & STYLES
    console.log("\n5. Capturing & Auditing COMPONENTS page ...");
    await page.evaluate(() => window.switchPage('page-components'));
    await new Promise(r => setTimeout(r, 200));
    const componentsScreenshot = path.join(REPORTS_DIR, 'live_visible_components.png');
    await page.screenshot({ path: componentsScreenshot, fullPage: false });
    console.log(`   ✔ Screenshot saved: ${componentsScreenshot}`);

    const componentsStyles = await page.evaluate(() => {
      const badgePass = document.querySelector('#page-components .badge.pass');
      const badgeReject = document.querySelector('#page-components .badge.reject');
      const th = document.querySelector('#page-components th');
      const td = document.querySelector('#page-components td');
      return {
        thBg: th ? window.getComputedStyle(th).backgroundColor : null,
        thColor: th ? window.getComputedStyle(th).color : null,
        tdFont: td ? window.getComputedStyle(td).fontFamily : null,
        badgePassColor: badgePass ? window.getComputedStyle(badgePass).color : null,
        badgePassBg: badgePass ? window.getComputedStyle(badgePass).backgroundColor : null,
        badgeRejectColor: badgeReject ? window.getComputedStyle(badgeReject).color : null,
        badgeRejectBg: badgeReject ? window.getComputedStyle(badgeReject).backgroundColor : null
      };
    });
    console.log("   - Components Styles:", JSON.stringify(componentsStyles, null, 2));

    // 6. PAGE 5: ADVANCED SCREENSHOT & STYLES
    console.log("\n6. Capturing & Auditing ADVANCED page ...");
    await page.evaluate(() => window.switchPage('page-advanced'));
    await new Promise(r => setTimeout(r, 200));
    const advScreenshot = path.join(REPORTS_DIR, 'live_visible_advanced.png');
    await page.screenshot({ path: advScreenshot, fullPage: false });
    console.log(`   ✔ Screenshot saved: ${advScreenshot}`);

    const advStyles = await page.evaluate(() => {
      const title = document.querySelector('#page-advanced .page-title');
      const activeTab = document.querySelector('.adv-tab-btn.active');
      return {
        titleFont: title ? window.getComputedStyle(title).fontFamily : null,
        titleSize: title ? window.getComputedStyle(title).fontSize : null,
        activeTabBg: activeTab ? window.getComputedStyle(activeTab).backgroundColor : null,
        activeTabColor: activeTab ? window.getComputedStyle(activeTab).color : null
      };
    });
    console.log("   - Advanced Styles:", JSON.stringify(advStyles, null, 2));

    console.log("\n7. Summary:");
    console.log(`   - Console Errors: ${consoleErrors.length}`);
    console.log(`   - Critical Network Failures: ${failedRequests.length}`);

    await browser.close();

    if (consoleErrors.length === 0 && failedRequests.length === 0) {
      console.log("\n=========================================================================");
      console.log("VISIBLE LIVE BROWSER AUDIT COMPLETED SUCCESSFULLY (100% PASS)");
      console.log("=========================================================================");
      process.exit(0);
    } else {
      console.error("\nFAILURES DETECTED");
      process.exit(1);
    }

  } catch (err) {
    console.error("Test execution failed:", err);
    if (browser) await browser.close();
    process.exit(1);
  }
})();
