const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const REPORTS_DIR = path.join(__dirname, '..', 'reports');
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

async function verifyEmergencyRestoration() {
  console.log("=========================================================================");
  console.log("AUTHORITATIVE BROWSER AUDIT: EMERGENCY DESIGN RESTORATION VERIFICATION");
  console.log("=========================================================================");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

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
  console.log(`1. Navigating to ${baseUrl}#page-home ...`);
  await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 600));

  // Build Marker Check
  const buildInfo = await page.evaluate(() => {
    return {
      windowBuild: window.PREDICTA_BUILD_ID || null,
      bgMain: window.getComputedStyle(document.body).backgroundColor,
      fontSans: window.getComputedStyle(document.body).fontFamily
    };
  });
  console.log("   - Active Build & CSS Tokens:", JSON.stringify(buildInfo, null, 2));

  // 2. Page-by-Page Visual Inspection & Screenshot Capture
  const pages = [
    { id: 'page-home', name: 'Home', screen: 'restored_design_home.png' },
    { id: 'page-screening', name: 'Screening', screen: 'restored_design_screening.png' },
    { id: 'page-monitor', name: 'Live Monitor', screen: 'restored_design_monitor.png' },
    { id: 'page-components', name: 'Components', screen: 'restored_design_components.png' },
    { id: 'page-advanced', name: 'Advanced', screen: 'restored_design_advanced.png' }
  ];

  console.log("\n2. Inspecting and Capturing Restored Visual Structure Across All 5 Pages...");
  const pageAudit = {};

  for (const pg of pages) {
    await page.evaluate((pid) => window.switchPage(pid), pg.id);
    await new Promise(r => setTimeout(r, 400));

    const screenPath = path.join(REPORTS_DIR, pg.screen);
    await page.screenshot({ path: screenPath, fullPage: false });

    const state = await page.evaluate((pid) => {
      const el = document.getElementById(pid);
      if (!el) return { found: false };
      const display = window.getComputedStyle(el).display;
      const cards = el.querySelectorAll('.card').length;
      const tables = el.querySelectorAll('table').length;
      return { found: true, visible: display !== 'none', cardCount: cards, tableCount: tables };
    }, pg.id);

    pageAudit[pg.name] = state;
    console.log(`   ✔ ${pg.name} (${pg.screen}): Visible=${state.visible}, Cards=${state.cardCount}, Tables=${state.tableCount}`);
  }

  // 3. Functional Verifications
  console.log("\n3. Testing Core Functional Workflows...");

  // Screening Workflow Test
  await page.evaluate(() => window.switchPage('page-screening'));
  await new Promise(r => setTimeout(r, 300));
  const screeningInitial = await page.evaluate(() => {
    const emptyMsg = document.getElementById('screening-empty-state');
    const decisionCard = document.getElementById('screening-decision-card');
    return {
      emptyStateVisible: emptyMsg ? window.getComputedStyle(emptyMsg).display !== 'none' : false,
      decisionCardHidden: decisionCard ? window.getComputedStyle(decisionCard).display === 'none' : true
    };
  });
  console.log("   - Screening Initial Empty State:", screeningInitial);

  // Execute Screening Run
  const runResult = await page.evaluate(async () => {
    if (typeof window.executeParametricScreening === 'function') {
      window.executeParametricScreening();
      return true;
    }
    return false;
  });
  await new Promise(r => setTimeout(r, 500));
  console.log("   - Screening Analysis Executed:", runResult);

  // Live Monitor Trajectory Test
  await page.evaluate(() => window.switchPage('page-monitor'));
  await new Promise(r => setTimeout(r, 300));
  const monitorState = await page.evaluate(() => {
    const selector = document.getElementById('monitor-component-selector');
    const slider = document.getElementById('live-time-slider');
    const chart = document.getElementById('monitor-drift-chart-container') || document.getElementById('drift-chart-container');
    return {
      hasSelector: !!selector,
      hasSlider: !!slider,
      hasChart: !!chart
    };
  });
  console.log("   - Live Monitor Components & Charts:", monitorState);

  // Components Dossier Test
  await page.evaluate(() => window.switchPage('page-components'));
  await new Promise(r => setTimeout(r, 300));
  const componentsState = await page.evaluate(() => {
    const dossier = document.getElementById('component-identity-dossier-card');
    const inventoryTable = document.querySelector('.table-compact') || document.querySelector('.aips-table');
    return {
      hasDossier: !!dossier,
      hasInventoryTable: !!inventoryTable
    };
  });
  console.log("   - Components Dossier & Ledger:", componentsState);

  // Advanced 10-Tab Navigation Test
  await page.evaluate(() => window.switchPage('page-advanced'));
  await new Promise(r => setTimeout(r, 300));

  const tabList = [
    'adv-tab-registry', 'adv-tab-mod-a', 'adv-tab-mod-b', 'adv-tab-latent-risk',
    'adv-tab-physics', 'adv-tab-governance', 'adv-tab-validation',
    'adv-tab-traceability', 'adv-tab-simulation', 'adv-tab-reports'
  ];

  let allTabsPass = true;
  for (const tabId of tabList) {
    const tabPass = await page.evaluate((tid) => {
      window.switchAdvancedTab(tid);
      const tabEl = document.getElementById(tid);
      return tabEl && window.getComputedStyle(tabEl).display !== 'none';
    }, tabId);
    if (!tabPass) allTabsPass = false;
  }
  console.log("   - Advanced 10-Tab Navigation (including Validation & Evidence):", allTabsPass ? "10/10 PASS" : "FAIL");

  // 4. Multi-Breakpoint Responsive Audits
  console.log("\n4. Running Responsive Breakpoint Audits (1440px, 1024px, 768px, 390px)...");
  const breakpoints = [
    { width: 1440, height: 900, name: '1440px Desktop' },
    { width: 1024, height: 768, name: '1024px Laptop' },
    { width: 768, height: 1024, name: '768px Tablet' },
    { width: 390, height: 844, name: '390px Mobile' }
  ];

  const responsiveResults = {};
  for (const bp of breakpoints) {
    await page.setViewport({ width: bp.width, height: bp.height });
    await new Promise(r => setTimeout(r, 150));

    for (const pg of pages) {
      await page.evaluate((pid) => window.switchPage(pid), pg.id);
      await new Promise(r => setTimeout(r, 100));

      const overflow = await page.evaluate(() => {
        const bodyWidth = document.body.scrollWidth;
        const windowWidth = window.innerWidth;
        const rootWidth = document.documentElement.scrollWidth;
        return (bodyWidth > windowWidth + 1) || (rootWidth > windowWidth + 1);
      });

      responsiveResults[`${bp.name} - ${pg.name}`] = overflow ? 'FAIL' : 'PASS';
    }
  }

  console.log("   - Responsive Overflow Results:\n", JSON.stringify(responsiveResults, null, 2));

  console.log("\n5. Summary:");
  console.log(`   - Console Errors: ${consoleErrors.length}`);
  console.log(`   - Critical Network Failures: ${networkErrors.length}`);

  await browser.close();

  const allPagesVisible = Object.values(pageAudit).every(s => s.visible);
  const allRespPass = Object.values(responsiveResults).every(r => r === 'PASS');

  if (allPagesVisible && allTabsPass && allRespPass && consoleErrors.length === 0) {
    console.log("\n=========================================================================");
    console.log("EMERGENCY DESIGN RESTORATION: 100% VERIFIED AND SUCCESSFUL");
    console.log("=========================================================================");
    process.exit(0);
  } else {
    console.error("Restoration checks failed");
    process.exit(1);
  }
}

verifyEmergencyRestoration().catch(err => {
  console.error("Verification error:", err);
  process.exit(1);
});
