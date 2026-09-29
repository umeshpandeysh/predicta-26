const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  console.log("=========================================================================");
  console.log("AUTHORITATIVE BROWSER AUDIT: PREDICTA ADVANCED WORKSTATION REDESIGN");
  console.log("=========================================================================");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960 });

  const consoleErrors = [];
  const failedRequests = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('requestfailed', req => {
    failedRequests.push({ url: req.url(), failure: req.failure() ? req.failure().errorText : 'Unknown' });
  });

  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  try {
    // 1. Load http://localhost:8000/#page-advanced
    console.log("1. Loading http://localhost:8000/#page-advanced ...");
    await page.goto('http://localhost:8000/#page-advanced', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 600));

    // Check Part A Headings Removals across all 4 pages
    console.log("2. Checking Part A Heading Removals across all pages ...");
    const bodyText = await page.evaluate(() => document.body.innerText);
    const bodyHtml = await page.evaluate(() => document.body.innerHTML);

    const scrOverlinePresent = bodyText.includes("PARAMETRIC QUALIFICATION WORKFLOW");
    const monOverlinePresent = bodyText.includes("TEMPORAL DEGRADATION SURVEILLANCE");
    const compOverlinePresent = bodyText.includes("POPULATION SURVEILLANCE & INVESTIGATION WORKSPACE");
    const advBreadcrumbPresent = bodyHtml.includes("Advanced Engineering Workstation");
    const advOverlinePresent = bodyText.includes("TECHNICAL DEEP-DIVE WORKSTATION");

    console.log(`   - Screening Overline Present: ${scrOverlinePresent} (Expected: false)`);
    console.log(`   - Live Monitor Overline Present: ${monOverlinePresent} (Expected: false)`);
    console.log(`   - Components Overline Present: ${compOverlinePresent} (Expected: false)`);
    console.log(`   - Advanced Breadcrumb Present: ${advBreadcrumbPresent} (Expected: false)`);
    console.log(`   - Advanced Overline Present: ${advOverlinePresent} (Expected: false)`);

    assert(!scrOverlinePresent, "Screening overline must be completely removed");
    assert(!monOverlinePresent, "Live Monitor overline must be completely removed");
    assert(!compOverlinePresent, "Components overline must be completely removed");
    assert(!advBreadcrumbPresent, "Advanced breadcrumb must be completely removed");
    assert(!advOverlinePresent, "Advanced overline must be completely removed");

    // 3. Verify Advanced Header and Default Tab (Model Registry)
    console.log("3. Verifying Advanced Page Header & Model Registry (Tab 1) ...");
    const advTitle = await page.$eval('#page-advanced .page-title', el => el.textContent.trim());
    const advSubtitle = await page.$eval('#page-advanced .page-subtitle', el => el.textContent.trim());
    console.log(`   - Advanced Title: "${advTitle}"`);
    console.log(`   - Advanced Subtitle: "${advSubtitle}"`);
    assert(advTitle === "ADVANCED RELIABILITY WORKSTATION", "Title must be ADVANCED RELIABILITY WORKSTATION");

    // Check Model Registry contents
    const registryVisible = await page.$eval('#adv-tab-registry', el => el.style.display !== 'none');
    assert(registryVisible, "Model Registry tab must be visible by default");
    await page.screenshot({ path: path.join(reportsDir, 'adv_tab1_registry.png') });
    console.log("   ✔ Captured: reports/adv_tab1_registry.png");

    // 4. Test Tab 2: Module A Anomaly
    console.log("4. Testing Tab 2: Module A Dynamic Anomaly Analysis ...");
    await page.evaluate(() => window.switchAdvancedTab('adv-tab-mod-a'));
    await new Promise(r => setTimeout(r, 400));
    const modAVisible = await page.$eval('#adv-tab-mod-a', el => el.style.display !== 'none');
    const mahalText = await page.$eval('#adv-tab-mod-a', el => el.innerText);
    assert(modAVisible, "Module A tab must be visible");
    assert(mahalText.includes("Mahalanobis Distance"), "Mahalanobis Distance must be present in Module A");
    assert(mahalText.includes("BENCHMARK"), "Mahalanobis Distance must be labeled BENCHMARK");
    
    // Switch component selector in Module A
    await page.evaluate(() => {
      const sel = document.getElementById('adv-mod-a-comp-sel');
      if (sel) {
        sel.value = 'DIE-R15C15';
        window.updateAdvAnomalyView('DIE-R15C15');
      }
    });
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: path.join(reportsDir, 'adv_tab2_module_a.png') });
    console.log("   ✔ Captured: reports/adv_tab2_module_a.png");

    // 5. Test Tab 3: Module B Prognostics
    console.log("5. Testing Tab 3: Module B Temporal Degradation & Prognostics ...");
    await page.evaluate(() => window.switchAdvancedTab('adv-tab-mod-b'));
    await new Promise(r => setTimeout(r, 400));
    const modBVisible = await page.$eval('#adv-tab-mod-b', el => el.style.display !== 'none');
    assert(modBVisible, "Module B tab must be visible");
    await page.screenshot({ path: path.join(reportsDir, 'adv_tab3_module_b.png') });
    console.log("   ✔ Captured: reports/adv_tab3_module_b.png");

    // 6. Test Tab 4: Latent Risk
    console.log("6. Testing Tab 4: Latent Risk Assessment ...");
    await page.evaluate(() => window.switchAdvancedTab('adv-tab-latent-risk'));
    await new Promise(r => setTimeout(r, 400));
    const latentVisible = await page.$eval('#adv-tab-latent-risk', el => el.style.display !== 'none');
    assert(latentVisible, "Latent Risk tab must be visible");
    await page.screenshot({ path: path.join(reportsDir, 'adv_tab4_latent_risk.png') });
    console.log("   ✔ Captured: reports/adv_tab4_latent_risk.png");

    // 7. Test Tab 5: Physics
    console.log("7. Testing Tab 5: Physics & Reliability Evidence ...");
    await page.evaluate(() => window.switchAdvancedTab('adv-tab-physics'));
    await new Promise(r => setTimeout(r, 400));
    const physicsVisible = await page.$eval('#adv-tab-physics', el => el.style.display !== 'none');
    assert(physicsVisible, "Physics tab must be visible");
    await page.screenshot({ path: path.join(reportsDir, 'adv_tab5_physics.png') });
    console.log("   ✔ Captured: reports/adv_tab5_physics.png");

    // 8. Test Tab 6: Decision Governance
    console.log("8. Testing Tab 6: Decision Governance ...");
    await page.evaluate(() => window.switchAdvancedTab('adv-tab-governance'));
    await new Promise(r => setTimeout(r, 400));
    const govVisible = await page.$eval('#adv-tab-governance', el => el.style.display !== 'none');
    assert(govVisible, "Governance tab must be visible");
    await page.screenshot({ path: path.join(reportsDir, 'adv_tab6_governance.png') });
    console.log("   ✔ Captured: reports/adv_tab6_governance.png");

    // 9. Test Tab 7: Traceability & DAG
    console.log("9. Testing Tab 7: Traceability & Provenance DAG ...");
    await page.evaluate(() => window.switchAdvancedTab('adv-tab-traceability'));
    await new Promise(r => setTimeout(r, 400));
    const traceVisible = await page.$eval('#adv-tab-traceability', el => el.style.display !== 'none');
    assert(traceVisible, "Traceability tab must be visible");
    // Click DAG node
    await page.evaluate(() => window.inspectEvidenceGraphNode('latent_risk'));
    await new Promise(r => setTimeout(r, 200));
    const nodeText = await page.$eval('#graph-node-title', el => el.textContent);
    assert(nodeText.includes("Latent Risk"), "DAG Node inspector must update on click");
    await page.screenshot({ path: path.join(reportsDir, 'adv_tab7_traceability.png') });
    console.log("   ✔ Captured: reports/adv_tab7_traceability.png");

    // 10. Test Tab 8: Simulation
    console.log("10. Testing Tab 8: What-If Reliability Simulator ...");
    await page.evaluate(() => window.switchAdvancedTab('adv-tab-simulation'));
    await new Promise(r => setTimeout(r, 400));
    const simVisible = await page.$eval('#adv-tab-simulation', el => el.style.display !== 'none');
    assert(simVisible, "Simulation tab must be visible");
    // Adjust slider and trigger simulation
    await page.evaluate(() => {
      const slider = document.getElementById('sim-slider-temp');
      if (slider) {
        slider.value = 85.0;
        window.handleSimParamChange();
      }
    });
    await new Promise(r => setTimeout(r, 200));
    const simAf = await page.$eval('#sim-res-af', el => el.textContent);
    console.log(`   - Live What-If Simulated Arrhenius AF @ 85°C: ${simAf}`);
    await page.screenshot({ path: path.join(reportsDir, 'adv_tab8_simulation.png') });
    console.log("   ✔ Captured: reports/adv_tab8_simulation.png");

    // 11. Test Tab 9: Reports
    console.log("11. Testing Tab 9: Reliability Reporting ...");
    await page.evaluate(() => window.switchAdvancedTab('adv-tab-reports'));
    await new Promise(r => setTimeout(r, 400));
    const repVisible = await page.$eval('#adv-tab-reports', el => el.style.display !== 'none');
    assert(repVisible, "Reports tab must be visible");
    await page.screenshot({ path: path.join(reportsDir, 'adv_tab9_reports.png') });
    console.log("   ✔ Captured: reports/adv_tab9_reports.png");

    // 12. Full Cross-Page Regression Verification
    console.log("12. Running Full Regression Verification Across All 5 Pages ...");
    await page.evaluate(() => window.switchPage('page-home'));
    await new Promise(r => setTimeout(r, 400));
    const homeVis = await page.$eval('#page-home', el => el.style.display !== 'none');
    assert(homeVis, "Home page must be visible");

    await page.evaluate(() => window.switchPage('page-screening'));
    await new Promise(r => setTimeout(r, 400));
    const scrVis = await page.$eval('#page-screening', el => el.style.display !== 'none');
    assert(scrVis, "Screening page must be visible");

    await page.evaluate(() => window.switchPage('page-monitor'));
    await new Promise(r => setTimeout(r, 400));
    const monVis = await page.$eval('#page-monitor', el => el.style.display !== 'none');
    assert(monVis, "Live Monitor page must be visible");

    await page.evaluate(() => window.switchPage('page-components'));
    await new Promise(r => setTimeout(r, 400));
    const compVis = await page.$eval('#page-components', el => el.style.display !== 'none');
    assert(compVis, "Components page must be visible");

    // 13. Audit summary
    console.log("13. Audit Summary:");
    console.log(`   - Console Errors: ${consoleErrors.length}`);
    console.log(`   - Failed Requests: ${failedRequests.length}`);

    if (consoleErrors.length > 0) {
      console.error("❌ Console Errors Detected:", consoleErrors);
    }
    if (failedRequests.length > 0) {
      console.error("❌ Failed Requests Detected:", failedRequests);
    }

    assert(consoleErrors.length === 0, "There should be 0 console errors");
    assert(failedRequests.length === 0, "There should be 0 failed requests");

    console.log("=========================================================================");
    console.log("ALL ADVANCED WORKSTATION REDESIGN TESTS PASSED PERFECTLY (100% SUCCESS)");
    console.log("=========================================================================");

  } catch (err) {
    console.error("❌ Verification Failed:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
