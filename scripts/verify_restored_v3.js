const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runBrowserAudit() {
  console.log("=========================================================================");
  console.log("AUTHORITATIVE BROWSER AUDIT: RESTORED DESIGN + TYPOGRAPHY & COLOR v3");
  console.log("=========================================================================");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  const consoleErrors = [];
  const networkErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon.ico')) consoleErrors.push(text);
    }
  });

  page.on('response', resp => {
    if (resp.status() >= 400) {
      const url = resp.url();
      if (!url.includes('favicon.ico')) networkErrors.push({ url, status: resp.status() });
    }
  });

  const baseUrl = `http://localhost:8000/?v=${Date.now()}`;
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  console.log(`1. Navigating to ${baseUrl}#page-home ...`);
  await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 600));

  // Check Build ID and Font Links
  const buildInfo = await page.evaluate(() => {
    const metaMarker = document.querySelector('script')?.textContent || '';
    return {
      windowBuild: window.PREDICTA_BUILD_ID || null,
      spaceGrotesk: !!document.fonts.check('700 36px "Space Grotesk"'),
      inter: !!document.fonts.check('400 16px "Inter"'),
      jetBrainsMono: !!document.fonts.check('700 28px "JetBrains Mono"')
    };
  });
  console.log("   - Build Marker & Fonts:", JSON.stringify(buildInfo, null, 2));

  // Verify All 5 Pages
  const pages = [
    { id: 'page-home', name: 'Home', screen: 'restored_v3_home.png' },
    { id: 'page-screening', name: 'Screening', screen: 'restored_v3_screening.png' },
    { id: 'page-monitor', name: 'Live Monitor', screen: 'restored_v3_monitor.png' },
    { id: 'page-components', name: 'Components', screen: 'restored_v3_components.png' },
    { id: 'page-advanced', name: 'Advanced', screen: 'restored_v3_advanced.png' }
  ];

  const auditResults = {};

  console.log("\n2. Auditing Type Scale & Colors Across All 5 Pages...");

  for (const pg of pages) {
    await page.evaluate((pageId) => {
      window.switchPage(pageId);
    }, pg.id);
    await new Promise(r => setTimeout(r, 400));

    // Capture screenshot
    const screenshotPath = path.join(reportsDir, pg.screen);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    // Inspect Typography & Colors
    const metrics = await page.evaluate((pageId) => {
      const pageEl = document.getElementById(pageId);
      if (!pageEl) return { error: `Element #${pageId} not found` };

      const h1El = pageEl.querySelector('h1, .page-title, .hero-title');
      const h2El = pageEl.querySelector('h2, .section-title');
      const h3El = pageEl.querySelector('h3, .card-title');
      const bodyEl = document.body;
      const navActive = document.querySelector('.nav-link.active');
      const primaryBtn = pageEl.querySelector('.btn-primary') || document.querySelector('.btn-primary');
      const labelEl = pageEl.querySelector('label, .form-label');
      const badgeEl = pageEl.querySelector('.badge') || document.querySelector('.badge');
      const thEl = pageEl.querySelector('th');

      const getComp = (el) => el ? window.getComputedStyle(el) : null;

      const h1Style = getComp(h1El);
      const h2Style = getComp(h2El);
      const h3Style = getComp(h3El);
      const bodyStyle = getComp(bodyEl);
      const navActiveStyle = getComp(navActive);
      const btnStyle = getComp(primaryBtn);
      const labelStyle = getComp(labelEl);
      const badgeStyle = getComp(badgeEl);
      const thStyle = getComp(thEl);

      return {
        h1Size: h1Style ? h1Style.fontSize : null,
        h1Weight: h1Style ? h1Style.fontWeight : null,
        h1Font: h1Style ? h1Style.fontFamily : null,
        h1Color: h1Style ? h1Style.color : null,
        h2Size: h2Style ? h2Style.fontSize : null,
        h3Size: h3Style ? h3Style.fontSize : null,
        bodySize: bodyStyle ? bodyStyle.fontSize : null,
        bodyFont: bodyStyle ? bodyStyle.fontFamily : null,
        bodyBg: bodyStyle ? bodyStyle.backgroundColor : null,
        navActiveBg: navActiveStyle ? navActiveStyle.backgroundColor : null,
        navActiveColor: navActiveStyle ? navActiveStyle.color : null,
        btnBg: btnStyle ? btnStyle.backgroundColor : null,
        btnSize: btnStyle ? btnStyle.fontSize : null,
        labelSize: labelStyle ? labelStyle.fontSize : null,
        badgeFont: badgeStyle ? badgeStyle.fontFamily : null,
        thSize: thStyle ? thStyle.fontSize : null,
        thBg: thStyle ? thStyle.backgroundColor : null
      };
    }, pg.id);

    auditResults[pg.name] = metrics;
    console.log(`   ✔ ${pg.name} (Screenshot: ${pg.screen}): H1=${metrics.h1Size}, Body=${metrics.bodySize}, H1Color=${metrics.h1Color}`);
  }

  console.log("\n3. Type Scale Audit Results:\n", JSON.stringify(auditResults, null, 2));

  // Responsive Breakpoints Verification
  const breakpoints = [
    { width: 1440, height: 900, name: '1440px Desktop' },
    { width: 1024, height: 768, name: '1024px Laptop' },
    { width: 768, height: 1024, name: '768px Tablet' },
    { width: 390, height: 844, name: '390px Mobile' }
  ];

  console.log("\n4. Running Responsive Breakpoint Audits (1440px, 1024px, 768px, 390px)...");
  const responsiveResults = {};

  for (const bp of breakpoints) {
    await page.setViewport({ width: bp.width, height: bp.height, deviceScaleFactor: 1 });
    await new Promise(r => setTimeout(r, 200));

    for (const pg of pages) {
      await page.evaluate((pageId) => { window.switchPage(pageId); }, pg.id);
      await new Promise(r => setTimeout(r, 100));

      const overflow = await page.evaluate(() => {
        const bodyWidth = document.body.scrollWidth;
        const windowWidth = window.innerWidth;
        const rootWidth = document.documentElement.scrollWidth;
        return (bodyWidth > windowWidth + 1) || (rootWidth > windowWidth + 1);
      });

      responsiveResults[`${bp.name} - ${pg.name}`] = overflow ? 'FAIL (Horizontal Overflow)' : 'PASS';
    }
  }

  console.log("   - Responsive Overflow Results:\n", JSON.stringify(responsiveResults, null, 2));

  console.log("\n5. Summary:");
  console.log(`   - Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) console.log("     Errors:", consoleErrors);
  console.log(`   - Critical Network Failures: ${networkErrors.length}`);
  if (networkErrors.length > 0) console.log("     Failures:", networkErrors);

  await browser.close();

  const allH1Pass = Object.values(auditResults).every(r => r.h1Size === '36px');
  const allOverflowPass = Object.values(responsiveResults).every(r => r === 'PASS');

  if (allH1Pass && allOverflowPass && consoleErrors.length === 0) {
    console.log("\n=========================================================================");
    console.log("OVERHAUL v3 VERIFICATION PASSED (100% SUCCESS)");
    console.log("=========================================================================");
    process.exit(0);
  } else {
    console.error("\nCHECKS FAILED: All H1s must be 36px, overflow must be PASS, and no console errors.");
    process.exit(1);
  }
}

runBrowserAudit().catch(err => {
  console.error("Browser audit failed:", err);
  process.exit(1);
});
