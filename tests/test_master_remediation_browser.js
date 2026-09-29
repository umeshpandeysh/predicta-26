/**
 * PREDICTA-26 Master Remediation Browser Test & Screenshot Suite
 * File: tests/test_master_remediation_browser.js
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

async function runMasterRemediationSuite() {
  console.log("=========================================================================");
  console.log("PREDICTA-26 — MASTER REMEDIATION BROWSER & SCREENSHOT VERIFICATION");
  console.log("=========================================================================\n");

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const execPath = fs.existsSync(edgePath) ? edgePath : (fs.existsSync(chromePath) ? chromePath : null);

  if (!execPath) {
    console.error("No Edge or Chrome executable found on standard paths.");
    process.exit(1);
  }

  const screenshotDir = path.join(__dirname, '../reports/screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  console.log("Launching browser:", execPath);
  const browser = await puppeteer.launch({
    executablePath: execPath,
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  const networkFailures = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('requestfailed', req => {
    networkFailures.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText || 'Unknown failure'}`);
  });

  console.log("1. Opening http://localhost:8000 ... ");
  await page.goto('http://localhost:8000', { waitUntil: 'networkidle0' });

  // Verify Build Marker in DOM
  const topStatusText = await page.$eval('.topnav-status', el => el.textContent);
  console.log(`   Topnav Status: "${topStatusText.trim()}"`);
  assert(topStatusText.includes('PREDICTA') && topStatusText.includes('θ* = 0.20'), "Topnav status verified");

  // 1. HOME Screenshot
  console.log("2. Capturing 01_home.png...");
  await page.screenshot({ path: path.join(screenshotDir, '01_home.png') });

  // 2. SCREENING CSV Mode
  console.log("3. Navigating to Screening (CSV mode)...");
  await page.click('button[data-page="page-screening"]');
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(screenshotDir, '03_screening_csv.png') });

  // 3. SCREENING Manual Mode & Form Execution
  console.log("4. Switching to Screening Manual Mode...");
  await page.click('#tab-screening-manual');
  await new Promise(r => setTimeout(r, 300));
  console.log("   Clicking 'Load Nominal Preset' & 'Run Qualification Analysis'...");
  await page.evaluate(() => {
    window.loadManualPreset('nominal');
    window.runParametricQualification();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(screenshotDir, '02_screening_manual.png') });

  // 4. LIVE MONITOR
  console.log("5. Navigating to Live Monitor...");
  await page.click('button[data-page="page-overview"]');
  await new Promise(r => setTimeout(r, 400));
  console.log("   Adjusting replay slider to 96h...");
  await page.evaluate(() => {
    const slider = document.getElementById('live-time-slider');
    if (slider) {
      slider.value = 96;
      window.handleTimelineSlider(96);
    }
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(screenshotDir, '04_live_monitor.png') });

  // 5. COMPONENTS
  console.log("6. Navigating to Components Inventory...");
  await page.click('button[data-page="page-component"]');
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(screenshotDir, '05_components.png') });

  // 6. RELIABILITY PASSPORT MODAL
  console.log("7. Opening Reliability Passport Modal for DIE-R20C20...");
  await page.evaluate(() => window.openReliabilityPassport('DIE-R20C20'));
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(screenshotDir, '06_reliability_passport.png') });
  console.log("   Closing Reliability Passport...");
  await page.evaluate(() => window.closeReliabilityPassport());
  await new Promise(r => setTimeout(r, 200));

  // 7. ADVANCED (9 Subtabs)
  console.log("8. Navigating to Advanced Technical Workstation...");
  await page.click('button[data-page="page-advanced"]');
  await new Promise(r => setTimeout(r, 400));

  // 7.1 Model Registry
  console.log("   Capturing 07_advanced_model_registry.png...");
  await page.evaluate(() => window.switchAdvancedTab('adv-tab-registry'));
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: path.join(screenshotDir, '07_advanced_model_registry.png') });

  // 7.2 Module A
  console.log("   Capturing 08_advanced_module_a.png...");
  await page.evaluate(() => window.switchAdvancedTab('adv-tab-mod-a'));
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: path.join(screenshotDir, '08_advanced_module_a.png') });

  // 7.3 Module B
  console.log("   Capturing 09_advanced_module_b.png...");
  await page.evaluate(() => window.switchAdvancedTab('adv-tab-mod-b'));
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: path.join(screenshotDir, '09_advanced_module_b.png') });

  // 7.4 Latent Risk
  console.log("   Capturing 10_advanced_latent_risk.png...");
  await page.evaluate(() => window.switchAdvancedTab('adv-tab-latent-risk'));
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: path.join(screenshotDir, '10_advanced_latent_risk.png') });

  // 7.5 Physics
  console.log("   Capturing 11_advanced_physics.png...");
  await page.evaluate(() => window.switchAdvancedTab('adv-tab-physics'));
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: path.join(screenshotDir, '11_advanced_physics.png') });

  // 7.6 Decision Governance
  console.log("   Capturing 12_advanced_decision_governance.png...");
  await page.evaluate(() => window.switchAdvancedTab('adv-tab-governance'));
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: path.join(screenshotDir, '12_advanced_decision_governance.png') });

  // 7.7 Traceability
  console.log("   Capturing 13_advanced_traceability.png...");
  await page.evaluate(() => window.switchAdvancedTab('adv-tab-traceability'));
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: path.join(screenshotDir, '13_advanced_traceability.png') });

  // 7.8 Simulation
  console.log("   Capturing 14_advanced_simulation.png...");
  await page.evaluate(() => {
    window.switchAdvancedTab('adv-tab-simulation');
    const slider = document.getElementById('sim-slider-temp');
    if (slider) {
      slider.value = 85;
      window.handleSimParamChange();
    }
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(screenshotDir, '14_advanced_simulation.png') });

  // 7.9 Reports
  console.log("   Capturing 15_advanced_reports.png...");
  await page.evaluate(() => window.switchAdvancedTab('adv-tab-reports'));
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: path.join(screenshotDir, '15_advanced_reports.png') });

  // Verify Total Judge Purge in DOM
  console.log("\n9. Auditing DOM for total absence of Judge Journey...");
  const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());
  const judgeMatches = bodyText.match(/judge journey|judge mode|judging|presentation journey/g) || [];
  console.log(`   Found ${judgeMatches.length} references to Judge Journey in DOM`);
  assert.strictEqual(judgeMatches.length, 0, "Judge Journey must have 0 occurrences in rendered DOM!");

  // Responsive Viewport Checks
  console.log("\n10. Testing Responsive Viewports (1440, 1024, 768, 390)...");
  for (const vp of [1440, 1024, 768, 390]) {
    await page.setViewport({ width: vp, height: 800 });
    await new Promise(r => setTimeout(r, 200));
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    console.log(`   Viewport ${vp}px: scrollWidth=${scrollWidth}, clientWidth=${clientWidth}`);
    assert(scrollWidth <= clientWidth + 2, `Horizontal overflow detected at ${vp}px! (scrollWidth: ${scrollWidth}, clientWidth: ${clientWidth})`);
  }

  console.log("\n11. Browser Diagnostics:");
  console.log(`   Console Errors: ${consoleErrors.length}`, consoleErrors);
  console.log(`   Network Failures: ${networkFailures.length}`, networkFailures);
  assert.strictEqual(consoleErrors.length, 0, "Console errors must be 0");
  assert.strictEqual(networkFailures.length, 0, "Network failures must be 0");

  await browser.close();

  console.log("\n=========================================================================");
  console.log("🏆 ALL 15 SCREENSHOTS CAPTURED & ALL BROWSER CHECKS PASSED (100% CLEAN)!");
  console.log("=========================================================================\n");
}

if (require.main === module) {
  runMasterRemediationSuite().catch(err => {
    console.error("FATAL ERROR IN BROWSER SUITE:", err);
    process.exit(1);
  });
}

module.exports = { runMasterRemediationSuite };
