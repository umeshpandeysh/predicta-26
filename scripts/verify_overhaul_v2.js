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
  console.log("AUTHORITATIVE BROWSER AUDIT: OVERHAUL v2 TYPOGRAPHY & COLOR SYSTEM");
  console.log("=========================================================================");

  let browser;
  const consoleErrors = [];
  const failedRequests = [];

  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
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

    const targetUrl = `http://localhost:8000/?v=${Date.now()}#page-home`;
    console.log(`1. Navigating to ${targetUrl} ...`);
    await page.goto(targetUrl, { waitUntil: 'networkidle0' });
    await page.evaluate(async () => { await document.fonts.ready; });

    // 1. Check Build Marker & Fonts
    const buildMarker = await page.evaluate(() => {
      return {
        meta: document.querySelector('meta[name="predicta-build"]')?.getAttribute('content'),
        windowBuild: window.PREDICTA_BUILD_ID,
        spaceGrotesk: document.fonts.check('700 36px "Space Grotesk"'),
        inter: document.fonts.check('500 16px "Inter"'),
        jetBrainsMono: document.fonts.check('700 28px "JetBrains Mono"')
      };
    });
    console.log("   - Build Marker & Fonts:", JSON.stringify(buildMarker, null, 2));

    const pages = [
      { id: 'page-home', name: 'Home', shot: 'overhaul_v2_home.png' },
      { id: 'page-screening', name: 'Screening', shot: 'overhaul_v2_screening.png' },
      { id: 'page-monitor', name: 'Live Monitor', shot: 'overhaul_v2_monitor.png' },
      { id: 'page-components', name: 'Components', shot: 'overhaul_v2_components.png' },
      { id: 'page-advanced', name: 'Advanced', shot: 'overhaul_v2_advanced.png' }
    ];

    const typeScaleAudit = {};

    console.log("\n2. Auditing Type Scale & Colors Across All 5 Pages...");
    for (const p of pages) {
      await page.evaluate((id) => window.switchPage(id), p.id);
      await new Promise(r => setTimeout(r, 200));

      const shotPath = path.join(REPORTS_DIR, p.shot);
      await page.screenshot({ path: shotPath, fullPage: false });

      const metrics = await page.evaluate((pageId) => {
        const pEl = document.getElementById(pageId);
        const h1 = pEl.querySelector('h1, .page-title');
        const h1Style = h1 ? window.getComputedStyle(h1) : null;
        const bodyStyle = window.getComputedStyle(document.body);
        const navLink = document.querySelector('.nav-link.active');
        const btn = pEl.querySelector('.btn-primary, .btn');
        const label = pEl.querySelector('label, .form-label');
        const badge = pEl.querySelector('.badge');
        const th = pEl.querySelector('th');
        const td = pEl.querySelector('td');

        return {
          h1Size: h1Style?.fontSize,
          h1Weight: h1Style?.fontWeight,
          h1Font: h1Style?.fontFamily,
          h1Color: h1Style?.color,
          bodySize: bodyStyle.fontSize,
          bodyFont: bodyStyle.fontFamily,
          bodyBg: bodyStyle.backgroundColor,
          navActiveBg: navLink ? window.getComputedStyle(navLink).backgroundColor : null,
          navActiveColor: navLink ? window.getComputedStyle(navLink).color : null,
          btnBg: btn ? window.getComputedStyle(btn).backgroundColor : null,
          btnSize: btn ? window.getComputedStyle(btn).fontSize : null,
          labelSize: label ? window.getComputedStyle(label).fontSize : null,
          badgeFont: badge ? window.getComputedStyle(badge).fontFamily : null,
          thSize: th ? window.getComputedStyle(th).fontSize : null,
          thBg: th ? window.getComputedStyle(th).backgroundColor : null
        };
      }, p.id);

      typeScaleAudit[p.name] = metrics;
      console.log(`   ✔ ${p.name} (Screenshot: ${p.shot}): H1=${metrics.h1Size}, Body=${metrics.bodySize}, H1Color=${metrics.h1Color}`);
    }

    console.log("\n3. Type Scale Audit Results:\n", JSON.stringify(typeScaleAudit, null, 2));

    // 4. Responsive Breakpoint Audits
    console.log("\n4. Running Responsive Breakpoint Audits (1440px, 1024px, 768px, 390px)...");
    const viewports = [
      { name: "1440px Desktop", w: 1440, h: 900 },
      { name: "1024px Laptop", w: 1024, h: 768 },
      { name: "768px Tablet", w: 768, h: 1024 },
      { name: "390px Mobile", w: 390, h: 844 }
    ];

    const overflowResults = {};
    for (const vp of viewports) {
      await page.setViewport({ width: vp.w, height: vp.h });
      for (const p of pages) {
        await page.evaluate((id) => window.switchPage(id), p.id);
        await new Promise(r => setTimeout(r, 60));

        const isOverflow = await page.evaluate((w) => {
          return document.documentElement.scrollWidth > w;
        }, vp.w);

        overflowResults[`${vp.name} - ${p.name}`] = isOverflow ? "FAIL" : "PASS";
      }
    }
    console.log("   - Responsive Overflow Results:\n", JSON.stringify(overflowResults, null, 2));

    console.log("\n5. Summary:");
    console.log(`   - Console Errors: ${consoleErrors.length}`);
    console.log(`   - Critical Network Failures: ${failedRequests.length}`);

    await browser.close();

    const allOverflowPass = Object.values(overflowResults).every(v => v === "PASS");
    const allH1Correct = Object.values(typeScaleAudit).every(v => v.h1Size === "36px");

    if (allOverflowPass && allH1Correct && consoleErrors.length === 0 && failedRequests.length === 0) {
      console.log("\n=========================================================================");
      console.log("OVERHAUL v2 VERIFICATION PASSED (100% SUCCESS)");
      console.log("=========================================================================");
      process.exit(0);
    } else {
      console.error("\nCHECKS FAILED: All H1s must be 36px and overflow must be PASS");
      process.exit(1);
    }

  } catch (err) {
    console.error("Test failed:", err);
    if (browser) await browser.close();
    process.exit(1);
  }
})();
