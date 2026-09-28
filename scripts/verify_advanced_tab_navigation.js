const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  console.log("=========================================================================");
  console.log("AUTHORITATIVE BROWSER AUDIT: ADVANCED WORKSTATION 10-TAB NAVIGATION");
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
    await page.setViewport({ width: 1440, height: 900 });

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

    console.log("1. Navigating to http://localhost:8000/#page-advanced ...");
    await page.goto('http://localhost:8000/#page-advanced', { waitUntil: 'networkidle0' });

    // Confirm Advanced page is visible
    const isAdvActive = await page.evaluate(() => {
      const adv = document.getElementById('page-advanced');
      return adv && adv.classList.contains('active') && getComputedStyle(adv).display !== 'none';
    });
    console.log(`   - Advanced page active: ${isAdvActive}`);
    if (!isAdvActive) throw new Error("Advanced page not active on initial load");

    const tabsToTest = [
      { num: 1, name: "Model Registry", target: "adv-tab-registry", selector: "adv-tab-registry" },
      { num: 2, name: "Module A", target: "adv-tab-mod-a", selector: "adv-tab-mod-a" },
      { num: 3, name: "Module B", target: "adv-tab-mod-b", selector: "adv-tab-mod-b" },
      { num: 4, name: "Latent Risk", target: "adv-tab-latent-risk", selector: "adv-tab-latent-risk" },
      { num: 5, name: "Physics", target: "adv-tab-physics", selector: "adv-tab-physics" },
      { num: 6, name: "Decision Governance", target: "adv-tab-governance", selector: "adv-tab-governance" },
      { num: 7, name: "Validation & Evidence", target: "adv-tab-validation", selector: "adv-tab-validation" },
      { num: 8, name: "Traceability", target: "adv-tab-traceability", selector: "adv-tab-traceability" },
      { num: 9, name: "Simulation", target: "adv-tab-simulation", selector: "adv-tab-simulation" },
      { num: 10, name: "Reports", target: "adv-tab-reports", selector: "adv-tab-reports" }
    ];

    console.log("\n2. Testing all 10 Advanced Workstation Tabs sequentially...");
    const tabResults = {};

    for (const tab of tabsToTest) {
      // Click the tab button
      await page.evaluate((target) => {
        const btn = document.querySelector(`.adv-tab-btn[data-target="${target}"]`);
        if (btn) btn.click();
        else throw new Error(`Button for ${target} not found`);
      }, tab.target);

      await new Promise(r => setTimeout(r, 100));

      const tabState = await page.evaluate((tabInfo) => {
        const pageAdv = document.getElementById('page-advanced');
        const isAdvVisible = pageAdv && pageAdv.classList.contains('active') && getComputedStyle(pageAdv).display !== 'none';
        const pageHome = document.getElementById('page-home');
        const isHomeHidden = !pageHome || !pageHome.classList.contains('active') || getComputedStyle(pageHome).display === 'none';

        const activePanel = document.getElementById(tabInfo.selector);
        const isPanelVisible = activePanel && getComputedStyle(activePanel).display === 'block';

        // Check other panels are hidden
        const otherPanels = document.querySelectorAll('.adv-subtab-content');
        let othersHidden = true;
        otherPanels.forEach(p => {
          if (p.id !== tabInfo.selector && getComputedStyle(p).display !== 'none') {
            othersHidden = false;
          }
        });

        // Check button active state
        const btn = document.querySelector(`.adv-tab-btn[data-target="${tabInfo.target}"]`);
        const isBtnActive = btn && btn.classList.contains('active');

        return {
          isAdvVisible,
          isHomeHidden,
          isPanelVisible,
          othersHidden,
          isBtnActive
        };
      }, tab);

      const pass = tabState.isAdvVisible && tabState.isHomeHidden && tabState.isPanelVisible && tabState.othersHidden && tabState.isBtnActive;
      tabResults[tab.name] = pass ? "PASS" : "FAIL";
      console.log(`   ${tab.num}. ${tab.name}: ${tabResults[tab.name]} (AdvVisible: ${tabState.isAdvVisible}, HomeHidden: ${tabState.isHomeHidden}, PanelVisible: ${tabState.isPanelVisible}, OthersHidden: ${tabState.othersHidden}, BtnActive: ${tabState.isBtnActive})`);
    }

    // Special check for Validation & Evidence content rendering
    console.log("\n3. Verifying Validation & Evidence content elements...");
    await page.evaluate(() => {
      document.querySelector('.adv-tab-btn[data-target="adv-tab-validation"]').click();
    });
    await new Promise(r => setTimeout(r, 100));

    const validationContent = await page.evaluate(() => {
      const panel = document.getElementById('adv-tab-validation');
      if (!panel) return null;
      return {
        textIncludesTitle: panel.textContent.includes('MODEL VALIDATION & SCIENTIFIC EVIDENCE'),
        textIncludesAblation: panel.textContent.includes('Ablation Study') || panel.textContent.includes('C1') || panel.textContent.includes('C6'),
        textIncludesCanonicalCases: panel.textContent.includes('Canonical Scientific Test Cases') || panel.textContent.includes('Case A') || panel.textContent.includes('Case D'),
        textIncludesMetrics: panel.textContent.includes('97.31%') && panel.textContent.includes('7.70%') && panel.textContent.includes('0.9901')
      };
    });
    console.log("   - Validation Tab Content Check:", validationContent);

    // 4. Test direct subtab routing
    console.log("\n4. Testing subtab routing via switchPage('adv-tab-validation')...");
    await page.evaluate(() => {
      window.switchPage('page-home');
    });
    let isHome = await page.evaluate(() => document.getElementById('page-home').classList.contains('active'));
    console.log(`   - Switched to Home: ${isHome}`);

    await page.evaluate(() => {
      window.switchPage('adv-tab-validation');
    });
    let isAdvWithVal = await page.evaluate(() => {
      const adv = document.getElementById('page-advanced');
      const val = document.getElementById('adv-tab-validation');
      return adv.classList.contains('active') && getComputedStyle(val).display === 'block';
    });
    console.log(`   - switchPage('adv-tab-validation') activated Advanced + Validation Tab: ${isAdvWithVal}`);

    // 5. Cross-page regression testing
    console.log("\n5. Running Top-Level Navigation Regression Checks...");
    const regressions = {};

    // Home
    await page.evaluate(() => {
      const link = document.querySelector('.nav-link[data-page="page-home"]');
      if (link) link.click();
      else window.switchPage('page-home');
    });
    regressions["Home"] = await page.evaluate(() => document.getElementById('page-home').classList.contains('active') && getComputedStyle(document.getElementById('page-home')).display !== 'none' ? "PASS" : "FAIL");

    // Screening
    await page.evaluate(() => {
      const link = document.querySelector('.nav-link[data-page="page-screening"]');
      if (link) link.click();
      else window.switchPage('page-screening');
    });
    regressions["Screening"] = await page.evaluate(() => document.getElementById('page-screening').classList.contains('active') && getComputedStyle(document.getElementById('page-screening')).display !== 'none' ? "PASS" : "FAIL");

    // Live Monitor
    await page.evaluate(() => {
      const link = document.querySelector('.nav-link[data-page="page-monitor"]');
      if (link) link.click();
      else window.switchPage('page-monitor');
    });
    regressions["Live Monitor"] = await page.evaluate(() => document.getElementById('page-monitor').classList.contains('active') && getComputedStyle(document.getElementById('page-monitor')).display !== 'none' ? "PASS" : "FAIL");

    // Components
    await page.evaluate(() => {
      const link = document.querySelector('.nav-link[data-page="page-components"]');
      if (link) link.click();
      else window.switchPage('page-components');
    });
    regressions["Components"] = await page.evaluate(() => document.getElementById('page-components').classList.contains('active') && getComputedStyle(document.getElementById('page-components')).display !== 'none' ? "PASS" : "FAIL");

    // Advanced
    await page.evaluate(() => {
      const link = document.querySelector('.nav-link[data-page="page-advanced"]');
      if (link) link.click();
      else window.switchPage('page-advanced');
    });
    regressions["Advanced"] = await page.evaluate(() => document.getElementById('page-advanced').classList.contains('active') && getComputedStyle(document.getElementById('page-advanced')).display !== 'none' ? "PASS" : "FAIL");

    console.log("   - Regression Results:", regressions);

    console.log("\n6. Summary:");
    console.log(`   - Console Errors: ${consoleErrors.length}`);
    console.log(`   - Critical Network Failures: ${failedRequests.length}`);

    await browser.close();

    const allTabsPass = Object.values(tabResults).every(v => v === "PASS");
    const allRegressionsPass = Object.values(regressions).every(v => v === "PASS");
    const contentPass = validationContent && validationContent.textIncludesTitle && validationContent.textIncludesMetrics;

    if (allTabsPass && allRegressionsPass && contentPass && consoleErrors.length === 0 && failedRequests.length === 0) {
      console.log("\n=========================================================================");
      console.log("ALL CHECKS PASSED: 10/10 ADVANCED TABS & ALL PAGES VERIFIED (100% SUCCESS)");
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
