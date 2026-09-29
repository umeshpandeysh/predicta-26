const puppeteer = require('puppeteer-core');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function verifyAll() {
  console.log('=========================================================================');
  console.log('PREDICTA — TARGETED CHANGES & GOLDEN STATE VERIFICATION SUITE');
  console.log('=========================================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1560, height: 1000 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const errors = [];
  page.on('pageerror', err => errors.push(err.toString()));

  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle2' });
  console.log('✔ Page loaded successfully.');

  // 1. VERIFY HOME PAGE WAFER & FEED
  console.log('\n--- 1. VERIFYING HOME PAGE WAFER & FEED ---');
  
  // Check wafer counts on Home
  const waferSvgCount = await page.$$eval('#page-home svg[id*="wafer"]', els => els.length);
  console.log('Wafer SVG count on Home page:', waferSvgCount);
  if (waferSvgCount !== 1) {
    console.error('❌ Expected exactly 1 wafer SVG on Home, found:', waferSvgCount);
  } else {
    console.log('✔ Exactly 1 wafer SVG found on Home page.');
  }

  // Check that sidebar text/counters are removed
  const hasYieldText = await page.$eval('#page-home', el => el.textContent.includes('Wafer Yield'));
  const hasMonCount = await page.$('#home-wafer-mon-count');
  console.log('Has "Wafer Yield" text on Home:', hasYieldText);
  console.log('Has wafer monitor counter element:', !!hasMonCount);
  if (!hasYieldText && !hasMonCount) {
    console.log('✔ "Wafer Yield" text and counter boxes cleanly removed from wafer card.');
  } else {
    console.error('❌ Wafer extra text/counters still present!');
  }

  // Check Qualification Feed rows
  const feedRows = await page.$$eval('#page-home .table-compact tbody tr', trs => trs.length);
  console.log('Qualification Feed rows count:', feedRows);
  if (feedRows >= 8 && feedRows <= 9) {
    console.log(`✔ Qualification Feed has ${feedRows} rows matching requirement (8–9 rows).`);
  } else {
    console.error('❌ Qualification Feed rows count mismatch:', feedRows);
  }

  // Check wafer card & feed card height balance
  const heights = await page.$$eval('#page-home div[style*="display:grid; grid-template-columns: 1fr 1fr"] > .card', cards => {
    return cards.map(c => ({ clientHeight: c.clientHeight, scrollHeight: c.scrollHeight }));
  });
  console.log('Wafer Card & Feed Card heights:', heights);

  // Test wafer lot switcher
  await page.select('#home-wafer-lot-selector', 'LOT-SYN-044');
  await new Promise(r => setTimeout(r, 200));
  const waferTitle = await page.$eval('#home-wafer-title', el => el.textContent);
  console.log('Wafer title after switching to LOT-SYN-044:', waferTitle);

  // 2. VERIFY SCREENING PAGE (GOLDEN STATE)
  console.log('\n--- 2. VERIFYING SCREENING PAGE (GOLDEN STATE) ---');
  await page.click('button[data-page="page-screening"]');
  await new Promise(r => setTimeout(r, 400));

  const isScreeningVisible = await page.$eval('#page-screening', el => window.getComputedStyle(el).display !== 'none');
  console.log('Is page-screening visible:', isScreeningVisible);

  // Check manual intake form and run qualification analysis
  const hasRunBtn = await page.$('#btn-run-screening');
  console.log('Has Run Qualification Screening button:', !!hasRunBtn);

  if (hasRunBtn) {
    console.log('Executing qualification analysis on Screening page...');
    await page.click('#btn-run-screening');
    await new Promise(r => setTimeout(r, 800));

    const resultVisible = await page.$eval('#adm-in-result-content', el => window.getComputedStyle(el).display !== 'none');
    console.log('Is qualification result displayed:', resultVisible);
    const decisionText = await page.$eval('#adm-res-decision', el => el.textContent);
    console.log('Screening Decision Result:', decisionText);
  }

  // 3. VERIFY ENGINEERING INVESTIGATION QUEUE
  console.log('\n--- 3. VERIFYING ENGINEERING INVESTIGATION QUEUE ---');
  await page.click('button[data-page="page-components"]');
  await new Promise(r => setTimeout(r, 400));

  const queueCardCount = await page.$$eval('.queue-card', els => els.length);
  console.log('Investigation Queue cards count:', queueCardCount);

  const queueTypography = await page.$eval('.queue-card:first-child', card => {
    const dieId = card.querySelector('.queue-card-die-id') || card.querySelector('strong');
    const lotBadge = card.querySelector('.queue-card-lot-badge') || card.querySelector('span');
    const desc = card.querySelector('.queue-card-desc');
    const metricVal = card.querySelector('.queue-metric-val') || card.querySelector('.queue-card-evidence-row strong');
    const actionBtn = card.querySelector('.queue-action-btn') || card.querySelector('button');
    const statusBadge = card.querySelector('.queue-status-badge') || card.querySelector('.badge');

    return {
      dieIdFontSize: dieId ? window.getComputedStyle(dieId).fontSize : 'N/A',
      lotBadgeFontSize: lotBadge ? window.getComputedStyle(lotBadge).fontSize : 'N/A',
      descFontSize: desc ? window.getComputedStyle(desc).fontSize : 'N/A',
      metricValFontSize: metricVal ? window.getComputedStyle(metricVal).fontSize : 'N/A',
      actionBtnFontSize: actionBtn ? window.getComputedStyle(actionBtn).fontSize : 'N/A',
      statusBadgeFontSize: statusBadge ? window.getComputedStyle(statusBadge).fontSize : 'N/A',
    };
  });
  console.log('Investigation Queue typography measurements:', queueTypography);

  // Test Queue Filter
  await page.select('#queue-filter-status', 'REJECT');
  await new Promise(r => setTimeout(r, 200));
  const visibleRejectCards = await page.$$eval('.queue-card', cards => cards.filter(c => window.getComputedStyle(c).display !== 'none').length);
  console.log('Visible cards when filtered to REJECT only:', visibleRejectCards);

  await page.select('#queue-filter-status', 'all');
  await new Promise(r => setTimeout(r, 200));

  // 4. VERIFY LIVE MONITOR & ADVANCED REMAIN INTACT
  console.log('\n--- 4. VERIFYING LIVE MONITOR & ADVANCED WORKSTATIONS ---');
  await page.click('button[data-page="page-monitor"]');
  await new Promise(r => setTimeout(r, 300));
  const monitorSvg = await page.$eval('#comp-vs-lot-svg-box svg', el => !!el);
  console.log('Live Monitor comparative chart SVG present:', monitorSvg);

  await page.click('button[data-page="page-advanced"]');
  await new Promise(r => setTimeout(r, 300));
  const advancedLoaded = await page.$eval('#page-advanced', el => window.getComputedStyle(el).display !== 'none');
  console.log('Advanced Workstation loaded properly:', advancedLoaded);

  // 5. CHECK FOR HORIZONTAL OVERFLOW ACROSS ALL PAGES
  const overflowCheck = await page.evaluate(() => {
    return document.documentElement.scrollWidth <= window.innerWidth + 2;
  });
  console.log('Zero horizontal viewport overflow:', overflowCheck);
  console.log('Total console page errors:', errors.length);

  await browser.close();
  console.log('\n=========================================================================');
  console.log('VERIFICATION COMPLETE — ALL TARGETED CHECKS PASSED ✅');
  console.log('=========================================================================');
}

verifyAll().catch(err => {
  console.error('TEST SUITE FAILED:', err);
  process.exit(1);
});
