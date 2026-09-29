const puppeteer = require('puppeteer-core');

(async () => {
  try {
    console.log("=== PREDICTA SCREENING DECISION COMMAND PANEL VERIFICATION ===\n");
    const browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.toString()));

    await page.goto('http://localhost:8000/', { waitUntil: 'networkidle0' });
    await page.evaluate(() => window.switchPage('page-screening'));
    await new Promise(r => setTimeout(r, 200));

    // TEST CASE 1: PASS RESULT (DIE-R15C15 / LOT-SYN-043)
    console.log("--- TEST CASE 1: PASS Result Verification ---");
    await page.select('#adm-in-comp-id', 'DIE-R15C15');
    await page.select('#adm-in-lot-id', 'LOT-SYN-043');
    await page.type('#adm-in-temp', '25.0');
    await page.type('#adm-in-voltage', '1.20');
    await page.type('#adm-in-freq', '2500');
    await page.type('#adm-in-duration', '24');
    await page.type('#adm-in-iddq', '10.7');
    await page.type('#adm-in-leakage', '111.7');
    await page.type('#adm-in-tpd', '10.98');
    await page.type('#adm-in-power', '45.0');

    await page.click('#btn-adm-in-submit');
    await page.waitForFunction(() => {
      const el = document.getElementById('adm-in-result-content');
      return el && window.getComputedStyle(el).display === 'block';
    }, { timeout: 10000 });

    const passData = await page.evaluate(() => {
      return {
        comp: document.getElementById('adm-in-res-comp')?.textContent,
        lot: document.getElementById('adm-in-res-lot')?.textContent,
        badge: document.getElementById('adm-in-res-badge')?.textContent.trim(),
        subbadge: document.getElementById('adm-in-res-subbadge')?.textContent.trim(),
        summary: document.getElementById('adm-in-res-summary')?.textContent.trim(),
        primarySignal: document.getElementById('adm-in-res-primary-signal')?.textContent.trim(),
        riskVal: document.getElementById('adm-in-res-risk-val')?.textContent.trim(),
        action: document.getElementById('adm-in-res-action-text')?.textContent.trim(),
        policy: document.getElementById('adm-in-res-policy-text')?.textContent.trim(),
        popStatus: document.getElementById('strip-pop-status')?.textContent.trim(),
        tempStatus: document.getElementById('strip-temp-status')?.textContent.trim(),
        fcStatus: document.getElementById('strip-fc-status')?.textContent.trim(),
        riskStatus: document.getElementById('strip-risk-status')?.textContent.trim(),
        physStatus: document.getElementById('strip-phys-status')?.textContent.trim()
      };
    });

    console.log("PASS Result Check:", JSON.stringify(passData, null, 2));
    if (passData.badge !== 'PASS' || !passData.comp.includes('DIE-R15C15') || !passData.lot.includes('LOT-SYN-043')) {
      throw new Error("Test Case 1 Failed: PASS state not rendered properly");
    }
    console.log("✔ TEST CASE 1 PASSED!\n");

    // Reset Form for Test Case 2
    await page.click('#btn-adm-analyze-another');
    await new Promise(r => setTimeout(r, 200));

    // TEST CASE 2: REJECT RESULT (DIE-R20C20 / LOT-SYN-044)
    console.log("--- TEST CASE 2: REJECT Result Verification ---");
    await page.select('#adm-in-comp-id', 'DIE-R20C20');
    await page.select('#adm-in-lot-id', 'LOT-SYN-044');
    await page.type('#adm-in-temp', '85.0');
    await page.type('#adm-in-voltage', '1.35');
    await page.type('#adm-in-freq', '2800');
    await page.type('#adm-in-duration', '24');
    await page.type('#adm-in-iddq', '28.4');
    await page.type('#adm-in-leakage', '240.5');
    await page.type('#adm-in-tpd', '14.20');
    await page.type('#adm-in-power', '78.5');

    await page.click('#btn-adm-in-submit');
    await page.waitForFunction(() => {
      const el = document.getElementById('adm-in-result-content');
      return el && window.getComputedStyle(el).display === 'block';
    }, { timeout: 10000 });

    const rejectData = await page.evaluate(() => {
      return {
        comp: document.getElementById('adm-in-res-comp')?.textContent,
        lot: document.getElementById('adm-in-res-lot')?.textContent,
        badge: document.getElementById('adm-in-res-badge')?.textContent.trim(),
        subbadge: document.getElementById('adm-in-res-subbadge')?.textContent.trim(),
        summary: document.getElementById('adm-in-res-summary')?.textContent.trim(),
        primarySignal: document.getElementById('adm-in-res-primary-signal')?.textContent.trim(),
        riskVal: document.getElementById('adm-in-res-risk-val')?.textContent.trim(),
        action: document.getElementById('adm-in-res-action-text')?.textContent.trim(),
        policy: document.getElementById('adm-in-res-policy-text')?.textContent.trim(),
        popStatus: document.getElementById('strip-pop-status')?.textContent.trim(),
        tempStatus: document.getElementById('strip-temp-status')?.textContent.trim(),
        fcStatus: document.getElementById('strip-fc-status')?.textContent.trim(),
        riskStatus: document.getElementById('strip-risk-status')?.textContent.trim(),
        physStatus: document.getElementById('strip-phys-status')?.textContent.trim()
      };
    });

    console.log("REJECT Result Check:", JSON.stringify(rejectData, null, 2));
    if (rejectData.badge !== 'REJECT' || !rejectData.comp.includes('DIE-R20C20') || !rejectData.lot.includes('LOT-SYN-044')) {
      throw new Error("Test Case 2 Failed: REJECT state not rendered properly");
    }
    console.log("✔ TEST CASE 2 PASSED!\n");

    // RESPONSIVE VIEWPORT CHECKS
    console.log("--- RESPONSIVE VIEWPORT CHECKS ---");
    for (const w of [1440, 1024, 768, 390]) {
      await page.setViewport({ width: w, height: 800 });
      await new Promise(r => setTimeout(r, 100));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      console.log(`Viewport ${w}px overflow:`, overflow ? "FAILED ❌" : "CLEAN ✔");
      if (overflow) throw new Error(`Overflow at ${w}px`);
    }

    console.log("\n--- CONSOLE ERRORS AUDIT ---");
    console.log("Console Errors:", errors.length, errors);
    if (errors.length > 0) throw new Error("Console errors found");

    console.log("\n=========================================================================");
    console.log("ALL GOVERNED DECISION COMMAND PANEL VERIFICATIONS PASSED! 🚀");
    console.log("=========================================================================");

    await browser.close();
  } catch (err) {
    console.error("VERIFICATION ERROR:", err);
    process.exit(1);
  }
})();
