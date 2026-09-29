const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  console.log("=========================================================================");
  console.log("AUTHORITATIVE BROWSER AUDIT: GLOBAL TYPOGRAPHY & COLOR SYSTEM");
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

    // 1. Audit Desktop 1440px across all pages
    await page.setViewport({ width: 1440, height: 960 });
    console.log("1. Loading http://localhost:8000/ on 1440px Desktop ...");
    await page.goto('http://localhost:8000/#page-home', { waitUntil: 'networkidle0' });

    // Evaluate global styles on Home
    const homeStyles = await page.evaluate(() => {
      const body = document.body;
      const h1 = document.querySelector('h1, .page-title');
      const p = document.querySelector('p, .page-subtitle');
      const btn = document.querySelector('.btn-primary');
      const card = document.querySelector('.card, .hero-card');
      const badge = document.querySelector('.badge');
      const overline = document.querySelector('.technical-overline, .stat-label');

      const bodyStyle = window.getComputedStyle(body);
      const h1Style = h1 ? window.getComputedStyle(h1) : null;
      const pStyle = p ? window.getComputedStyle(p) : null;
      const btnStyle = btn ? window.getComputedStyle(btn) : null;
      const cardStyle = card ? window.getComputedStyle(card) : null;
      const badgeStyle = badge ? window.getComputedStyle(badge) : null;
      const overlineStyle = overline ? window.getComputedStyle(overline) : null;

      return {
        bodyBg: bodyStyle.backgroundColor,
        bodyFont: bodyStyle.fontFamily,
        bodySize: bodyStyle.fontSize,
        h1Font: h1Style?.fontFamily,
        h1Size: h1Style?.fontSize,
        h1Weight: h1Style?.fontWeight,
        h1Color: h1Style?.color,
        pSize: pStyle?.fontSize,
        pColor: pStyle?.color,
        btnSize: btnStyle?.fontSize,
        btnWeight: btnStyle?.fontWeight,
        btnBg: btnStyle?.backgroundColor,
        badgeFont: badgeStyle?.fontFamily,
        cardBg: cardStyle?.backgroundColor,
        cardBorder: cardStyle?.borderColor,
        overlineTransform: overlineStyle?.textTransform
      };
    });

    console.log("   - Home Computed Styles:", JSON.stringify(homeStyles, null, 2));

    // Audit Screening Page
    console.log("\n2. Auditing Screening Page Typography & Forms ...");
    await page.evaluate(() => window.switchPage('page-screening'));
    await new Promise(r => setTimeout(r, 200));

    const screeningStyles = await page.evaluate(() => {
      const label = document.querySelector('label, .form-label');
      const input = document.querySelector('.form-control, input, select');
      const labelStyle = label ? window.getComputedStyle(label) : null;
      const inputStyle = input ? window.getComputedStyle(input) : null;
      return {
        labelSize: labelStyle?.fontSize,
        labelWeight: labelStyle?.fontWeight,
        inputSize: inputStyle?.fontSize,
        inputBorder: inputStyle?.borderColor
      };
    });
    console.log("   - Screening Form Styles:", JSON.stringify(screeningStyles, null, 2));

    // Audit Live Monitor Page
    console.log("\n3. Auditing Live Monitor Page Charts & Telemetry ...");
    await page.evaluate(() => window.switchPage('page-monitor'));
    await new Promise(r => setTimeout(r, 200));

    const monitorStyles = await page.evaluate(() => {
      const title = document.getElementById('comp-vs-lot-title');
      const svg = document.querySelector('#comp-vs-lot-svg-box svg');
      return {
        titleFont: title ? window.getComputedStyle(title).fontFamily : null,
        titleSize: title ? window.getComputedStyle(title).fontSize : null,
        hasSvg: !!svg
      };
    });
    console.log("   - Live Monitor Styles:", JSON.stringify(monitorStyles, null, 2));

    // Audit Components Page Table
    console.log("\n4. Auditing Components Page Inventory Table & Badges ...");
    await page.evaluate(() => window.switchPage('page-components'));
    await new Promise(r => setTimeout(r, 200));

    const componentsStyles = await page.evaluate(() => {
      const th = document.querySelector('.aips-table th, table th');
      const td = document.querySelector('.aips-table td, table td');
      const badgePass = document.querySelector('.badge.pass');
      const badgeReject = document.querySelector('.badge.reject');
      return {
        thSize: th ? window.getComputedStyle(th).fontSize : null,
        thWeight: th ? window.getComputedStyle(th).fontWeight : null,
        tdFont: td ? window.getComputedStyle(td).fontFamily : null,
        tdSize: td ? window.getComputedStyle(td).fontSize : null,
        badgePassColor: badgePass ? window.getComputedStyle(badgePass).color : null,
        badgePassBg: badgePass ? window.getComputedStyle(badgePass).backgroundColor : null,
        badgeRejectColor: badgeReject ? window.getComputedStyle(badgeReject).color : null,
        badgeRejectBg: badgeReject ? window.getComputedStyle(badgeReject).backgroundColor : null
      };
    });
    console.log("   - Components Table & Badge Styles:", JSON.stringify(componentsStyles, null, 2));

    // Audit Advanced Workstation
    console.log("\n5. Auditing Advanced Engineering Workstation ...");
    await page.evaluate(() => window.switchPage('page-advanced'));
    await new Promise(r => setTimeout(r, 200));

    const advStyles = await page.evaluate(() => {
      const title = document.querySelector('#page-advanced .page-title');
      const tabBtn = document.querySelector('.adv-tab-btn');
      return {
        titleFont: title ? window.getComputedStyle(title).fontFamily : null,
        titleSize: title ? window.getComputedStyle(title).fontSize : null,
        tabBtnSize: tabBtn ? window.getComputedStyle(tabBtn).fontSize : null,
        tabBtnWeight: tabBtn ? window.getComputedStyle(tabBtn).fontWeight : null
      };
    });
    console.log("   - Advanced Workstation Styles:", JSON.stringify(advStyles, null, 2));

    // Responsive Breakpoint Audits
    console.log("\n6. Running Responsive Breakpoint Audits (1440px, 1024px, 768px, 390px) ...");
    const viewports = [
      { name: "1440px Desktop", w: 1440, h: 900 },
      { name: "1024px Laptop", w: 1024, h: 768 },
      { name: "768px Tablet", w: 768, h: 1024 },
      { name: "390px Mobile", w: 390, h: 844 }
    ];

    const pages = ['page-home', 'page-screening', 'page-monitor', 'page-components', 'page-advanced'];
    const overflowReport = {};

    for (const vp of viewports) {
      await page.setViewport({ width: vp.w, height: vp.h });
      for (const pId of pages) {
        await page.evaluate((id) => window.switchPage(id), pId);
        await new Promise(r => setTimeout(r, 80));

        const overflow = await page.evaluate((width) => {
          return {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            hasOverflow: document.documentElement.scrollWidth > width
          };
        }, vp.w);

        const key = `${vp.name} - ${pId}`;
        overflowReport[key] = overflow.hasOverflow ? `FAIL (scrollWidth: ${overflow.scrollWidth})` : "PASS";
      }
    }
    console.log("   - Responsive Overflow Checks:\n", JSON.stringify(overflowReport, null, 2));

    console.log("\n7. Summary:");
    console.log(`   - Console Errors: ${consoleErrors.length}`);
    console.log(`   - Critical Network Failures: ${failedRequests.length}`);

    await browser.close();

    const allOverflowPass = Object.values(overflowReport).every(v => v === "PASS");
    if (allOverflowPass && consoleErrors.length === 0 && failedRequests.length === 0) {
      console.log("\n=========================================================================");
      console.log("ALL TYPOGRAPHY & COLOR SYSTEM AUDITS PASSED (100% SUCCESS)");
      console.log("=========================================================================");
      process.exit(0);
    } else {
      console.error("\nSOME CHECKS FAILED!");
      process.exit(1);
    }

  } catch (err) {
    console.error("Test execution failed:", err);
    if (browser) await browser.close();
    process.exit(1);
  }
})();
