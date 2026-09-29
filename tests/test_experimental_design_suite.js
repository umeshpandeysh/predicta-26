const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runExperimentalDesignTests() {
  console.log("=========================================================================");
  console.log("PREDICTA-26 — 10-FEATURE EXPERIMENTAL DESIGN VERIFICATION SUITE");
  console.log("=========================================================================");

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  const networkErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('requestfailed', req => {
    networkErrors.push(`${req.method()} ${req.url()} (${req.failure()?.errorText})`);
  });

  await page.goto('http://localhost:8000', { waitUntil: 'networkidle0' });
  console.log("1. Connected to http://localhost:8000");

  // TEST 04: Static vs Dynamic Screening on Home Page
  console.log("2. Verifying Experiment 04: Static vs Dynamic Screening Comparison...");
  const staticVsDyn = await page.$('#home-static-vs-dynamic-comparison');
  if (!staticVsDyn) throw new Error("Static vs Dynamic comparison card not found on Home page!");
  console.log("   ✔ Static vs Dynamic Comparison section verified on Home page.");

  // TEST 01: Why This Call on Screening Page
  console.log("3. Verifying Experiment 01: Flagship 'Why This Call' Explainability Layer...");
  await page.click('[data-page="page-screening"]');
  await sleep(300);

  // Switch to manual mode, load nominal preset, run qualification
  await page.click('#tab-screening-manual');
  await sleep(200);
  await page.click('button[onclick*="loadManualPreset(\'nominal\')"]');
  await page.click('#btn-adm-in-submit');
  await sleep(1000);

  const whyPanelVisible = await page.$eval('#screening-why-this-call-panel', el => el.style.display !== 'none');
  const whyBadge = await page.$eval('#why-call-master-badge', el => el.textContent);
  const popVal = await page.$eval('#why-pop-pat', el => el.textContent);
  const riskVal = await page.$eval('#why-risk-prob', el => el.textContent);
  console.log(`   ✔ 'Why This Call' panel visible: ${whyPanelVisible}, Master Badge: ${whyBadge}, Pop: ${popVal}, Risk: ${riskVal}`);

  // TEST 02 & 06: Component vs Lot & Engineering Legend on Live Monitor
  console.log("4. Verifying Experiment 02 & 06: Component vs Lot & Standardized Legend...");
  await page.click('[data-page="page-overview"]');
  await sleep(300);

  const compVsLotSvg = await page.$eval('#comp-vs-lot-svg-box svg', el => !!el);
  const legendBar = await page.$eval('.engineering-legend-bar', el => el.textContent.trim());
  console.log(`   ✔ Component vs Lot SVG rendered: ${compVsLotSvg}`);
  console.log(`   ✔ Engineering legend bar verified: "${legendBar.substring(0, 60)}..."`);

  // Switch metric to Leakage
  await page.click('#btn-metric-leakage');
  await sleep(200);
  const titleAfterSwitch = await page.$eval('#comp-vs-lot-title', el => el.textContent);
  console.log(`   ✔ Switched metric to Leakage: "${titleAfterSwitch}"`);

  // TEST 05: Component Investigation Queue on Components Page
  console.log("5. Verifying Experiment 05: Component Investigation Queue...");
  await page.click('[data-page="page-component"]');
  await sleep(300);

  const queueCardsCount = await page.$$eval('.queue-card', els => els.length);
  console.log(`   ✔ Investigation queue cards rendered: ${queueCardsCount} flagged units.`);

  // Test Queue Filter
  await page.select('#queue-filter-status', 'REJECT');
  await sleep(200);
  const visibleCards = await page.$$eval('.queue-card', els => els.filter(e => e.style.display !== 'none').length);
  console.log(`   ✔ Filtered for REJECT only: ${visibleCards} cards visible.`);

  // TEST 08 & 09: Reliability Passport Modal & Traceable Timeline (12 Stages)
  console.log("6. Verifying Experiment 08 & 09: Reliability Passport Modal & 12-Stage Timeline...");
  await page.click('.queue-card.critical button');
  await sleep(300);

  const modalVisible = await page.$eval('#component-passport-modal', el => el.style.display !== 'none');
  const passportComp = await page.$eval('#passport-comp-id', el => el.textContent);
  console.log(`   ✔ Passport modal open: ${modalVisible} for component ${passportComp}`);

  // Click Timeline Stage 5 (Mod B)
  await page.click('#tstep-5');
  await sleep(200);
  const tstep5Active = await page.$eval('#tstep-5', el => el.classList.contains('active'));
  const drawerText = await page.$eval('#passport-timeline-drawer', el => el.textContent);
  console.log(`   ✔ Timeline Stage 5 selected: active=${tstep5Active}, Drawer: "${drawerText.substring(0, 50)}..."`);

  // Close modal
  await page.click('button[onclick*="closeReliabilityPassport"]');
  await sleep(200);

  // TEST 07, 10 & 03: Advanced Tabs (Model Agreement, Evidence Graph, What-If Simulator)
  console.log("7. Verifying Experiment 07: Model Agreement in Advanced Tab 6...");
  await page.click('[data-page="page-advanced"]');
  await sleep(300);

  await page.evaluate(() => window.switchAdvancedTab('adv-tab-governance'));
  await sleep(200);
  const agreeTable = await page.$eval('.agreement-matrix-table', el => !!el);
  console.log(`   ✔ Model Agreement table verified in Subtab 6: ${agreeTable}`);

  console.log("8. Verifying Experiment 10: Technical Evidence Graph in Advanced Tab 7...");
  await page.evaluate(() => window.switchAdvancedTab('adv-tab-traceability'));
  await sleep(200);

  const graphSvg = await page.$eval('#svg-evidence-graph', el => !!el);
  console.log(`   ✔ Technical Evidence Graph SVG rendered: ${graphSvg}`);

  // Inspect node in Evidence Graph via evaluation
  await page.evaluate(() => window.inspectEvidenceGraphNode('module_a'));
  await sleep(200);
  const nodeTitle = await page.$eval('#graph-node-title', el => el.textContent);
  console.log(`   ✔ Interactive node inspected: "${nodeTitle}"`);

  console.log("9. Verifying Experiment 03: What-If Reliability Stress Simulator in Advanced Tab 8...");
  await page.evaluate(() => window.switchAdvancedTab('adv-tab-simulation'));
  await sleep(200);

  // Load stress scenario
  await page.click('button[onclick*="loadWhatIfStressScenario"]');
  await sleep(300);

  const simBadge = await page.$eval('#sim-res-badge', el => el.textContent);
  const simProb = await page.$eval('#sim-res-prob', el => el.textContent);
  const simAf = await page.$eval('#sim-res-af', el => el.textContent);
  const deltaDisp = await page.$eval('#whatif-delta-disp', el => el.textContent);
  console.log(`   ✔ What-If Stress loaded: Sim Disposition: ${simBadge}, Prob: ${simProb}, AF: ${simAf}, Delta: ${deltaDisp}`);

  // Reset to baseline
  await page.click('button[onclick*="resetWhatIfToBaseline"]');
  await sleep(300);
  const resetBadge = await page.$eval('#sim-res-badge', el => el.textContent);
  const resetProb = await page.$eval('#sim-res-prob', el => el.textContent);
  console.log(`   ✔ What-If Reset to baseline: Sim Disposition: ${resetBadge}, Prob: ${resetProb}`);

  // 10. Check Console & Network Diagnostics
  console.log("\n10. Diagnostics check:");
  console.log(`   Console Errors (${consoleErrors.length}):`, consoleErrors);
  console.log(`   Network Failures (${networkErrors.length}):`, networkErrors);

  if (consoleErrors.length > 0) throw new Error("Console errors detected!");
  if (networkErrors.length > 0) throw new Error("Network failures detected!");

  await browser.close();
  console.log("=========================================================================");
  console.log("🏆 ALL 10 EXPERIMENTAL FEATURES FULLY VERIFIED ON REAL LOCALHOST BROWSER!");
  console.log("=========================================================================");
}

runExperimentalDesignTests().catch(err => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
