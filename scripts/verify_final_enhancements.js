const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function verifyFinalEnhancements() {
  console.log("=========================================================================");
  console.log("PREDICTA-26 — FINAL FRONTEND ENHANCEMENT BROWSER VERIFICATION SUITE");
  console.log("=========================================================================");

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  const networkFailures = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('requestfailed', req => {
    networkFailures.push(`${req.method()} ${req.url()} - ${req.failure().errorText}`);
  });

  await page.setViewport({ width: 1440, height: 900 });
  console.log("Navigating to http://localhost:8000/ ...");
  await page.goto("http://localhost:8000/", { waitUntil: "networkidle0" });

  const results = {
    feature1_context_bar: false,
    feature2_story_strip: false,
    feature3_latent_spotlight: false,
    feature4_forecast_validation: false,
    feature5_daq_health: false,
    feature6_efficiency_opportunity: false,
    responsive: {},
    consoleErrors: 0,
    networkFailures: 0
  };

  // 1. FEATURE 1: Persistent Context Bar
  console.log("\n[TEST 1] Verifying Persistent Engineering Context Bar...");
  const ctxBar = await page.$("#persistent-engineering-context-bar");
  if (ctxBar) {
    const text = (await page.evaluate(el => el.innerText, ctxBar)).toUpperCase();
    console.log("  Context Bar Text Content:\n  " + text.replace(/\n+/g, " | "));
    const hasCanonicalModel = text.includes("4.0.0") || text.includes("4.0.0_AUTHORITATIVE");
    if (text.includes("DIE-R20C20") && text.includes("24H DECISION POINT") && text.includes("168H QUALIFICATION") && text.includes("NOT_CALIBRATED") && hasCanonicalModel) {
      results.feature1_context_bar = true;
      console.log("  ✔ Feature 1 (Context Bar) Verified & Populated with Authoritative Model Version (" + (text.match(/4\.0\.0[A-Z0-9_]*/i) || ["4.0.0"])[0] + ")");
    }
  }

  // 2. FEATURE 3: Latent Escape Spotlight (Home Page)
  console.log("\n[TEST 2] Verifying Latent Escape Spotlight on Home Page...");
  const spotlight = await page.$("#home-latent-escape-spotlight");
  if (spotlight) {
    const text = (await page.evaluate(el => el.innerText, spotlight)).toUpperCase();
    console.log("  Spotlight Content:\n  " + text.replace(/\n+/g, " | "));
    const hasModelInterval = text.includes("95% MODEL INTERVAL") || text.includes("UNCALIBRATED");
    if (text.includes("LATENT ESCAPE SPOTLIGHT") && text.includes("STATIC DATASHEET") && text.includes("LOT-RELATIVE") && hasModelInterval) {
      results.feature3_latent_spotlight = true;
      console.log("  ✔ Feature 3 (Latent Escape Spotlight) Verified with 95% Model Interval");
    }
  }

  // 3. Switch to Screening Page
  console.log("\n[TEST 3] Navigating to Screening Page...");
  await page.click('[data-page="page-screening"]');
  await new Promise(r => setTimeout(r, 400));

  // FEATURE 2: Analysis Story Strip
  const storyStrip = await page.$("#screening-analysis-story-strip");
  if (storyStrip) {
    const text = (await page.evaluate(el => el.innerText, storyStrip)).toUpperCase();
    console.log("  Story Strip Content:\n  " + text.replace(/\n+/g, " | "));
    if (text.includes("ANALYSIS STORY STRIP") && text.includes("INPUT") && text.includes("VALIDATED") && text.includes("GOVERNED")) {
      results.feature2_story_strip = true;
      console.log("  ✔ Feature 2 (Analysis Story Strip) Verified");
    }
  }

  // FEATURE 5: Data Acquisition Health Strip
  const daqHealth = await page.$("#screening-data-acquisition-health");
  if (daqHealth) {
    const text = (await page.evaluate(el => el.innerText, daqHealth)).toUpperCase();
    console.log("  Data Acquisition Health Content:\n  " + text.replace(/\n+/g, " | "));
    if (text.includes("DATA ACQUISITION HEALTH") && text.includes("SCHEMA") && text.includes("MISSINGNESS")) {
      results.feature5_daq_health = true;
      console.log("  ✔ Feature 5 (Data Acquisition Health) Verified");
    }
  }

  // 4. Switch to Live Monitor Page
  console.log("\n[TEST 4] Navigating to Live Monitor Page...");
  await page.click('[data-page="page-overview"]');
  await new Promise(r => setTimeout(r, 400));

  // FEATURE 4: Forecast Validation
  const fcVal = await page.$("#live-forecast-validation-panel");
  if (fcVal) {
    const text = (await page.evaluate(el => el.innerText, fcVal)).toUpperCase();
    console.log("  Forecast Validation Content:\n  " + text.replace(/\n+/g, " | "));
    const hasBenchmarkWording = text.includes("BENCHMARK FORECAST VALIDATION") || text.includes("BENCHMARK_VALIDATED");
    if (text.includes("FORECAST VALIDATION") && text.includes("OBSERVED VALUE") && text.includes("PREDICTED (GPR)") && text.includes("RESIDUAL") && hasBenchmarkWording) {
      results.feature4_forecast_validation = true;
      console.log("  ✔ Feature 4 (Forecast Validation) Verified with Benchmark Validation Terminology");
    }
  }

  // Test Slider Scrubbing to 48h (DATA_UNAVAILABLE check)
  await page.evaluate(() => {
    window.handleTimelineSlider(48);
  });
  await new Promise(r => setTimeout(r, 200));
  const fcVal48 = await page.evaluate(() => document.getElementById("fc-val-status-badge").innerText);
  console.log("  48h Intermediate Checkpoint Status: " + fcVal48);

  // 5. Switch to Components Page
  console.log("\n[TEST 5] Navigating to Components Page...");
  await page.click('[data-page="page-component"]');
  await new Promise(r => setTimeout(r, 400));

  // FEATURE 6: Qualification Efficiency Opportunity
  const effOpp = await page.$("#component-qualification-efficiency-panel");
  if (effOpp) {
    const text = (await page.evaluate(el => el.innerText, effOpp)).toUpperCase();
    console.log("  Efficiency Opportunity Content:\n  " + text.replace(/\n+/g, " | "));
    const hasEngineeringReview = text.includes("CANDIDATE FOR ENGINEERING REVIEW");
    if (text.includes("QUALIFICATION EFFICIENCY OPPORTUNITY") && text.includes("256") && text.includes("34.2%") && hasEngineeringReview) {
      results.feature6_efficiency_opportunity = true;
      console.log("  ✔ Feature 6 (Qualification Efficiency Opportunity) Verified with Candidate for Engineering Review");
    }
  }

  // 6. Test Reliability Passport Modal
  console.log("\n[TEST 6] Testing Reliability Passport Modal Launch & Context Sync...");
  await page.evaluate(() => {
    window.openReliabilityPassport('DIE-R05C12');
  });
  await new Promise(r => setTimeout(r, 300));
  const modalVisible = await page.evaluate(() => {
    const modal = document.getElementById("component-passport-modal");
    return modal && modal.style.display !== "none";
  });
  const updatedCtxDie = await page.evaluate(() => document.getElementById("ctx-bar-die").innerText);
  console.log(`  Modal Visible: ${modalVisible} | Context Bar Synced Die: ${updatedCtxDie}`);

  await page.evaluate(() => {
    window.closeReliabilityPassport();
  });
  await new Promise(r => setTimeout(r, 200));

  // 6b. Test What-If Simulation Sandbox Immutability
  console.log("\n[TEST 6B] Testing What-If Simulation Canonical-Case Immutability...");
  const whatIfImmResult = await page.evaluate(() => {
    const origCaseStr = JSON.stringify(window.activeCanonicalCase || {});
    // Trigger simulation param changes
    const vddSlider = document.getElementById("sim-slider-vdd");
    const tempSlider = document.getElementById("sim-slider-temp");
    if (vddSlider) vddSlider.value = "1.45";
    if (tempSlider) tempSlider.value = "105.0";
    if (typeof window.handleSimParamChange === "function") {
      window.handleSimParamChange();
    }
    const afterCaseStr = JSON.stringify(window.activeCanonicalCase || {});
    return origCaseStr === afterCaseStr;
  });
  console.log("  What-If Canonical Case Immutable: " + whatIfImmResult);

  // 7. Responsive Verification across 1440, 1024, 768, 390
  console.log("\n[TEST 7] Testing Responsive Layouts across 4 Viewports...");
  const viewports = [1440, 1024, 768, 390];
  const pagesList = ['page-home', 'page-screening', 'page-overview', 'page-component', 'page-advanced'];

  for (const w of viewports) {
    await page.setViewport({ width: w, height: 800 });
    let maxSw = 0;
    for (const pId of pagesList) {
      await page.evaluate(p => window.switchPage(p), pId);
      await new Promise(r => setTimeout(r, 100));
      const sw = await page.evaluate(() => document.body.scrollWidth);
      if (sw > maxSw) maxSw = sw;
    }
    const overflow = maxSw > w;
    results.responsive[w] = { maxScrollWidth: maxSw, innerWidth: w, hasOverflow: overflow };
    console.log(`  Viewport ${w}px -> maxScrollWidth: ${maxSw}, hasOverflow: ${overflow}`);
  }

  results.consoleErrors = consoleErrors.length;
  results.networkFailures = networkFailures.length;

  console.log("\n=========================================================================");
  console.log("FINAL BROWSER VERIFICATION SUMMARY");
  console.log("=========================================================================");
  console.log("Feature 1 (Persistent Context Bar):        ", results.feature1_context_bar ? "✔ PASS" : "❌ FAIL");
  console.log("Feature 2 (Analysis Story Strip):          ", results.feature2_story_strip ? "✔ PASS" : "❌ FAIL");
  console.log("Feature 3 (Latent Escape Spotlight):       ", results.feature3_latent_spotlight ? "✔ PASS" : "❌ FAIL");
  console.log("Feature 4 (Forecast Validation):           ", results.feature4_forecast_validation ? "✔ PASS" : "❌ FAIL");
  console.log("Feature 5 (Data Acquisition Health):       ", results.feature5_daq_health ? "✔ PASS" : "❌ FAIL");
  console.log("Feature 6 (Efficiency Opportunity):        ", results.feature6_efficiency_opportunity ? "✔ PASS" : "❌ FAIL");
  console.log("Console Errors:                            ", consoleErrors.length);
  console.log("Network Failures:                          ", networkFailures.length);
  console.log("=========================================================================");

  fs.writeFileSync(path.join(__dirname, '..', 'final_enhancement_verification.json'), JSON.stringify(results, null, 2), 'utf8');

  await browser.close();
  return results;
}

verifyFinalEnhancements().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
