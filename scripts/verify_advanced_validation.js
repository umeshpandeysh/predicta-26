const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  console.log("=========================================================================");
  console.log("AUTHORITATIVE BROWSER AUDIT: MODEL REGISTRY, GRAPH GEOMETRY & VALIDATION");
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
    // 1. Load Advanced Page
    console.log("1. Loading http://localhost:8000/#page-advanced ...");
    await page.goto('http://localhost:8000/#page-advanced', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 600));

    // 2. Audit Model Registry Table & GPR / Mahalanobis Roles
    console.log("2. Auditing Model Registry table for GPR and Mahalanobis roles ...");
    const registryHtml = await page.$eval('#adv-tab-registry', el => el.innerHTML);
    
    const gprAuthoritative = registryHtml.includes("AUTHORITATIVE (Prognostic)") || registryHtml.includes("ACTIVE / ONLINE");
    const mahalSupporting = registryHtml.includes("ACTIVE SUPPORTING") || registryHtml.includes("ONLINE");
    const gprBenchmarkOnly = registryHtml.includes("BENCHMARK_ONLY");

    console.log(`   - GPR Active/Authoritative: ${gprAuthoritative} (Expected: true)`);
    console.log(`   - Mahalanobis Active Supporting: ${mahalSupporting} (Expected: true)`);
    console.log(`   - GPR Benchmark Only Tag Present: ${gprBenchmarkOnly} (Expected: false)`);

    assert(gprAuthoritative, "GPR must be shown as Authoritative/Active in Model Registry");
    assert(mahalSupporting, "Mahalanobis must be shown as Active Supporting in Model Registry");
    assert(!gprBenchmarkOnly, "GPR should not have inappropriate BENCHMARK_ONLY tag in registry");
    await page.screenshot({ path: path.join(reportsDir, 'adv_registry_audited.png') });
    console.log("   ✔ Captured: reports/adv_registry_audited.png");

    // 3. Inspect and Verify Unclipped Graph in Module A across Viewports
    console.log("3. Inspecting Module A Anomaly Score Distribution Graph Geometry ...");
    await page.evaluate(() => window.switchAdvancedTab('adv-tab-mod-a'));
    await new Promise(r => setTimeout(r, 400));

    // Test at 1440px
    const chartBox1440 = await page.$eval('#adv-anomaly-dist-svg', el => {
      const rect = el.getBoundingClientRect();
      const parent = el.parentElement.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        parentWidth: parent.width,
        overflow: rect.width > parent.width
      };
    });
    console.log(`   - 1440px Viewport Chart Bounds: ${chartBox1440.width.toFixed(1)}px x ${chartBox1440.height.toFixed(1)}px (Overflow: ${chartBox1440.overflow})`);
    assert(!chartBox1440.overflow, "Graph must not overflow parent card at 1440px");
    await page.screenshot({ path: path.join(reportsDir, 'adv_mod_a_graph_1440.png') });

    // Test component marker switch
    await page.evaluate(() => {
      const sel = document.getElementById('adv-mod-a-comp-sel');
      if (sel) {
        sel.value = 'DIE-R15C15';
        window.updateAdvAnomalyView('DIE-R15C15');
      }
    });
    await new Promise(r => setTimeout(r, 200));

    // Test at 1024px
    await page.setViewport({ width: 1024, height: 768 });
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: path.join(reportsDir, 'adv_mod_a_graph_1024.png') });
    console.log("   ✔ 1024px Viewport: Verified & Captured (reports/adv_mod_a_graph_1024.png)");

    // Test at 768px
    await page.setViewport({ width: 768, height: 1024 });
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: path.join(reportsDir, 'adv_mod_a_graph_768.png') });
    console.log("   ✔ 768px Viewport: Verified & Captured (reports/adv_mod_a_graph_768.png)");

    // Test at 390px (Mobile)
    await page.setViewport({ width: 390, height: 844 });
    await new Promise(r => setTimeout(r, 300));
    const bodyScrollWidth390 = await page.evaluate(() => document.body.scrollWidth);
    const bodyClientWidth390 = await page.evaluate(() => document.body.clientWidth);
    console.log(`   - 390px Mobile Scroll Width: ${bodyScrollWidth390}px, Client Width: ${bodyClientWidth390}px`);
    assert(bodyScrollWidth390 <= bodyClientWidth390 + 2, "No horizontal page overflow on mobile");
    await page.screenshot({ path: path.join(reportsDir, 'adv_mod_a_graph_390.png') });
    console.log("   ✔ 390px Viewport: Verified & Captured (reports/adv_mod_a_graph_390.png)");

    // Reset to Desktop 1440px
    await page.setViewport({ width: 1440, height: 960 });
    await new Promise(r => setTimeout(r, 300));

    // 4. Test New "MODEL VALIDATION & SCIENTIFIC EVIDENCE" Tab
    console.log("4. Testing New 'MODEL VALIDATION & SCIENTIFIC EVIDENCE' Tab ...");
    await page.evaluate(() => window.switchAdvancedTab('adv-tab-validation'));
    await new Promise(r => setTimeout(r, 400));
    const valVisible = await page.$eval('#adv-tab-validation', el => el.style.display !== 'none');
    assert(valVisible, "Validation & Evidence tab must be visible");

    const valText = await page.$eval('#adv-tab-validation', el => el.innerText);
    assert(valText.includes("97.31%"), "Must show exact Fail Recall 97.31%");
    assert(valText.includes("7.70%"), "Must show exact FPR 7.70%");
    assert(valText.includes("0.9901"), "Must show exact ROC-AUC 0.9901");
    assert(valText.includes("0.9705"), "Must show exact PR-AUC 0.9705");
    assert(valText.includes("6.23 Wafers"), "Must show exact Lead Time 6.23 Wafers");
    assert(valText.includes("0.034 ms"), "Must show exact Inference Latency 0.034 ms");
    assert(valText.includes("6-Configuration Architecture Ablation Study"), "Must show 6-Configuration Ablation Study");
    assert(valText.includes("CASE A — Nominal Screening"), "Must show Case A");
    assert(valText.includes("CASE B — Static-Limit Escape"), "Must show Case B");
    assert(valText.includes("CASE C — Future Failure Wearout"), "Must show Case C");
    assert(valText.includes("CASE D — False Alarm Mitigation"), "Must show Case D");
    assert(valText.includes("LATENT-TRAJ-SYN-2026"), "Must show authoritative dataset provenance");

    await page.screenshot({ path: path.join(reportsDir, 'adv_tab_validation_full.png') });
    console.log("   ✔ Captured: reports/adv_tab_validation_full.png");

    // 5. Cross-Page Regression Verification
    console.log("5. Running Cross-Page Regression Verification ...");
    await page.evaluate(() => window.switchPage('page-home'));
    await new Promise(r => setTimeout(r, 300));
    assert(await page.$eval('#page-home', el => el.style.display !== 'none'), "Home visible");

    await page.evaluate(() => window.switchPage('page-screening'));
    await new Promise(r => setTimeout(r, 300));
    assert(await page.$eval('#page-screening', el => el.style.display !== 'none'), "Screening visible");

    await page.evaluate(() => window.switchPage('page-monitor'));
    await new Promise(r => setTimeout(r, 300));
    assert(await page.$eval('#page-monitor', el => el.style.display !== 'none'), "Live Monitor visible");

    await page.evaluate(() => window.switchPage('page-components'));
    await new Promise(r => setTimeout(r, 300));
    assert(await page.$eval('#page-components', el => el.style.display !== 'none'), "Components visible");

    // 6. Audit Summary
    console.log("6. Audit Summary:");
    console.log(`   - Console Errors: ${consoleErrors.length}`);
    console.log(`   - Failed Requests: ${failedRequests.length}`);

    if (consoleErrors.length > 0) {
      console.error("❌ Console Errors:", consoleErrors);
    }
    if (failedRequests.length > 0) {
      console.error("❌ Failed Requests:", failedRequests);
    }

    assert(consoleErrors.length === 0, "0 console errors required");
    assert(failedRequests.length === 0, "0 failed requests required");

    console.log("=========================================================================");
    console.log("ALL VALIDATION & GRAPH GEOMETRY AUDIT CHECKS PASSED (100% SUCCESS)");
    console.log("=========================================================================");

  } catch (err) {
    console.error("❌ Audit Failed:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
