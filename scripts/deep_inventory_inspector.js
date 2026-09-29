const puppeteer = require('puppeteer-core');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runDeepInventory() {
  console.log("=========================================================================");
  console.log("PREDICTA-26 — DEEP FRONTEND INVENTORY & CAPABILITY AUDIT");
  console.log("=========================================================================");

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const inventory = {
    metadata: {
      timestamp: new Date().toISOString(),
      url: 'http://localhost:8000/',
      viewport: '1440x900'
    },
    navigation: {},
    pages: {},
    experimental_features: {},
    responsive: {}
  };

  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle0' });
  await sleep(500);

  // 1. Navigation Inspection
  const navLinks = await page.$$eval('#topnav-menu .nav-link', links => links.map(l => ({
    text: l.textContent.trim(),
    page: l.getAttribute('data-page')
  })));
  const topnavStatus = await page.$eval('.topnav-status', el => el.textContent.trim());
  const bodyText = await page.$eval('body', el => el.innerText);

  inventory.navigation = {
    links: navLinks,
    statusText: topnavStatus,
    judgeJourneyFound: bodyText.includes('Judge Journey') || bodyText.includes('Judge'),
    adminLoginFound: bodyText.includes('Admin Login') || bodyText.includes('Sign In'),
    problemStatementFound: bodyText.includes('Problem Statement'),
    sihMarketingFound: bodyText.includes('Smart India Hackathon') || bodyText.includes('SIH 2026')
  };

  console.log("1. Navigation:", inventory.navigation);

  // 2. Home Page
  const homeCards = await page.$$eval('#page-home .card', cards => cards.length);
  const homeWaferSvg = await page.$eval('#home-wafer-svg', el => !!el).catch(() => false);
  const staticVsDyn = await page.$eval('#home-static-vs-dynamic-comparison', el => ({
    present: true,
    title: el.querySelector('h2')?.textContent.trim(),
    pillars: Array.from(el.querySelectorAll('.screening-pillar-card')).map(p => ({
      title: p.querySelector('div')?.textContent.trim(),
      itemsCount: p.querySelectorAll('li').length
    }))
  })).catch(() => ({ present: false }));

  inventory.pages.home = {
    present: await page.$eval('#page-home', el => !!el),
    cardsCount: homeCards,
    waferSvg: homeWaferSvg,
    staticVsDynamic: staticVsDyn
  };
  console.log("2. Home Page:", inventory.pages.home);

  // 3. Screening Page & Why This Call
  await page.click('[data-page="page-screening"]');
  await sleep(300);

  const screeningCsvZone = await page.$eval('#csv-upload-zone', el => el.style.display !== 'none');
  await page.click('#tab-screening-manual');
  await sleep(200);
  const screeningManualForm = await page.$eval('#form-admin-input', el => ({
    present: true,
    inputsCount: el.querySelectorAll('input').length,
    compId: el.querySelector('#adm-in-comp-id')?.value,
    temp: el.querySelector('#adm-in-temp')?.value,
    voltage: el.querySelector('#adm-in-voltage')?.value,
    iddq: el.querySelector('#adm-in-iddq')?.value,
    leakage: el.querySelector('#adm-in-leakage')?.value
  }));

  // Trigger manual qualification
  await page.click('button[onclick*="loadManualPreset(\'nominal\')"]');
  await page.click('#btn-adm-in-submit');
  await sleep(1000);

  const whyThisCall = await page.$eval('#screening-why-this-call-panel', el => ({
    visible: el.style.display !== 'none',
    masterBadge: el.querySelector('#why-call-master-badge')?.textContent.trim(),
    categories: Array.from(el.querySelectorAll('.why-category-card')).map(c => ({
      title: c.querySelector('.why-card-title')?.textContent.trim(),
      badge: c.querySelector('.badge')?.textContent.trim()
    }))
  })).catch(() => ({ visible: false }));

  inventory.pages.screening = {
    csvDropzone: screeningCsvZone,
    manualForm: screeningManualForm,
    whyThisCall: whyThisCall
  };
  console.log("3. Screening Page:", inventory.pages.screening);

  // 4. Live Monitor Page & Component vs Lot
  await page.click('[data-page="page-overview"]');
  await sleep(300);

  const compVsLot = await page.$eval('#live-component-vs-lot-chart-container', el => ({
    present: true,
    title: el.querySelector('#comp-vs-lot-title')?.textContent.trim(),
    hasSvg: !!el.querySelector('#comp-vs-lot-svg-box svg'),
    legend: el.querySelector('.engineering-legend-bar')?.textContent.trim(),
    metrics: Array.from(el.querySelectorAll('.metric-pill-btn')).map(b => b.textContent.trim())
  }));

  inventory.pages.live_monitor = {
    compVsLot: compVsLot,
    timeSlider: await page.$eval('#live-time-slider', el => ({ min: el.min, max: el.max, step: el.step, val: el.value })),
    charts: await page.$$eval('#page-overview .card', cards => cards.length)
  };
  console.log("4. Live Monitor Page:", inventory.pages.live_monitor);

  // 5. Components Page & Investigation Queue
  await page.click('[data-page="page-component"]');
  await sleep(300);

  const queueCards = await page.$$eval('.queue-card', cards => cards.map(c => ({
    id: c.querySelector('div')?.children[0]?.children[0]?.textContent.trim(),
    disposition: c.querySelector('.badge')?.textContent.trim()
  })));

  const lotTableRows = await page.$$eval('#lot-table-body tr', rows => rows.length);

  inventory.pages.components = {
    investigationQueue: {
      count: queueCards.length,
      sampleCards: queueCards.slice(0, 4)
    },
    tableRowsCount: lotTableRows
  };
  console.log("5. Components Page:", inventory.pages.components);

  // 6. Reliability Passport Modal & Timeline
  await page.click('.queue-card.critical button');
  await sleep(300);

  const passportModal = await page.$eval('#component-passport-modal', el => ({
    visible: el.style.display !== 'none',
    compId: el.querySelector('#passport-comp-id')?.textContent.trim(),
    lotId: el.querySelector('#passport-lot-id')?.textContent.trim(),
    badge: el.querySelector('#passport-decision-badge')?.textContent.trim(),
    timelineChipsCount: el.querySelectorAll('.timeline-step-chip').length,
    timelineDrawer: el.querySelector('#passport-timeline-drawer')?.textContent.trim()
  }));

  // Select timeline stage 10 (168h)
  await page.click('#tstep-10');
  await sleep(200);
  passportModal.timelineStage10Text = await page.$eval('#passport-timeline-drawer', el => el.textContent.trim());

  await page.click('button[onclick*="closeReliabilityPassport"]');
  await sleep(200);

  inventory.passport_modal = passportModal;
  console.log("6. Reliability Passport Modal:", inventory.passport_modal);

  // 7. Advanced Page (9 Subtabs)
  await page.click('[data-page="page-advanced"]');
  await sleep(300);

  const subtabs = await page.$$eval('#advanced-tabs-bar button', btns => btns.map(b => ({
    target: b.getAttribute('data-target'),
    label: b.textContent.trim()
  })));

  // Subtab 6: Governance Agreement Matrix
  await page.evaluate(() => window.switchAdvancedTab('adv-tab-governance'));
  await sleep(200);
  const agreeTableRows = await page.$$eval('.agreement-matrix-table tbody tr', rows => rows.map(r => ({
    stream: r.children[0]?.textContent.trim(),
    method: r.children[1]?.textContent.trim(),
    status: r.children[2]?.textContent.trim(),
    precedence: r.children[5]?.textContent.trim()
  })));

  // Subtab 7: Evidence Graph
  await page.evaluate(() => window.switchAdvancedTab('adv-tab-traceability'));
  await sleep(200);
  const evidenceGraph = await page.$eval('#technical-evidence-graph-container', el => ({
    hasSvg: !!el.querySelector('#svg-evidence-graph'),
    interactiveNodesCount: el.querySelectorAll('.graph-interactive-node').length,
    inspectorTitle: el.querySelector('#graph-node-title')?.textContent.trim()
  }));

  // Subtab 8: What-If Simulator
  await page.evaluate(() => window.switchAdvancedTab('adv-tab-simulation'));
  await sleep(200);
  const whatIf = await page.$eval('#whatif-simulator-container', el => ({
    slidersCount: el.querySelectorAll('input[type="range"]').length,
    origProb: el.querySelector('#whatif-orig-prob')?.textContent.trim(),
    simProb: el.querySelector('#sim-res-prob')?.textContent.trim(),
    simBadge: el.querySelector('#sim-res-badge')?.textContent.trim(),
    deltaDisp: el.querySelector('#whatif-delta-disp')?.textContent.trim()
  }));

  // Test What-If Stress
  await page.click('button[onclick*="loadWhatIfStressScenario"]');
  await sleep(300);
  whatIf.afterStress = {
    simProb: await page.$eval('#sim-res-prob', el => el.textContent.trim()),
    simBadge: await page.$eval('#sim-res-badge', el => el.textContent.trim()),
    simAf: await page.$eval('#sim-res-af', el => el.textContent.trim()),
    deltaDisp: await page.$eval('#whatif-delta-disp', el => el.textContent.trim())
  };

  inventory.pages.advanced = {
    subtabs: subtabs,
    subtab6_agreementMatrix: agreeTableRows,
    subtab7_evidenceGraph: evidenceGraph,
    subtab8_whatIfSimulator: whatIf
  };
  console.log("7. Advanced Page Subtabs:", inventory.pages.advanced);

  // 8. Responsive Viewport Audits
  const viewports = [1440, 1024, 768, 390];
  for (const vp of viewports) {
    await page.setViewport({ width: vp, height: 800 });
    await sleep(200);
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientW = await page.evaluate(() => document.documentElement.clientWidth);
    inventory.responsive[vp] = {
      scrollWidth: scrollW,
      clientWidth: clientW,
      hasOverflow: scrollW > clientW
    };
  }

  console.log("8. Responsive Audits:", inventory.responsive);

  await browser.close();

  fs.writeFileSync('inventory_snapshot.json', JSON.stringify(inventory, null, 2), 'utf8');
  console.log("✔ Saved complete inventory snapshot to inventory_snapshot.json");
}

runDeepInventory().catch(err => {
  console.error("Audit error:", err);
  process.exit(1);
});
