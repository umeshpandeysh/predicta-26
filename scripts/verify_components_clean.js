const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

(async () => {
  console.log('=========================================================================');
  console.log('AUTHORITATIVE BROWSER AUDIT: COMPONENTS CLEANUP VERIFICATION');
  console.log('=========================================================================');

  const reportDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1600 });

  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.toString()));
  page.on('requestfailed', req => failedRequests.push(req.url() + ' (' + req.failure().errorText + ')'));

  // 1. Initial Components Page
  console.log('1. Loading http://localhost:8000/#page-components (Initial State) ...');
  await page.goto('http://localhost:8000/#page-components', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  const compInitial = await page.evaluate(() => {
    const comp = document.getElementById('page-components');
    const timelineEl = document.getElementById('component-timeline-section');
    const effEl = document.getElementById('component-qualification-efficiency-panel');
    const dossier = document.getElementById('component-identity-dossier-card');
    const tel = document.getElementById('component-telemetry-stream-card');
    const ev = document.getElementById('component-reliability-evidence-card');
    const queue = document.getElementById('component-investigation-queue-container');
    const table = document.getElementById('components-inventory-table');

    return {
      hasTimelineText: comp ? (comp.innerText.includes('Traceable ReliabilityCase') || comp.innerText.includes('AUDITABLE DECISION PROVENANCE')) : false,
      hasEfficiencyText: comp ? (comp.innerText.includes('Qualification Efficiency Opportunity') || comp.innerText.includes('SCREENING THROUGHPUT ANALYSIS')) : false,
      hasEarlyReview: comp ? comp.innerText.includes('Potential Early-Review') : false,
      hasTotalLotUnits: comp ? comp.innerText.includes('Total Lot Units') : false,
      hasTimelineEl: !!timelineEl,
      hasEffEl: !!effEl,
      hasDossier: !!dossier,
      hasTelemetry: !!tel,
      hasEvidence: !!ev,
      hasQueue: !!queue,
      hasTable: !!table,
      uidText: document.getElementById('dossier-uid') ? document.getElementById('dossier-uid').innerText : '',
      statusText: document.getElementById('dossier-status') ? document.getElementById('dossier-status').innerText : ''
    };
  });

  console.log('   Components Initial State Check:');
  console.log('   - Timeline Text Present:', compInitial.hasTimelineText, '(Expected false)');
  console.log('   - Efficiency Text Present:', compInitial.hasEfficiencyText, '(Expected false)');
  console.log('   - Timeline Element Present:', compInitial.hasTimelineEl, '(Expected false)');
  console.log('   - Efficiency Element Present:', compInitial.hasEffEl, '(Expected false)');
  console.log('   - Dossier Card Present:', compInitial.hasDossier, '(Expected true)');
  console.log('   - Telemetry Stream Present:', compInitial.hasTelemetry, '(Expected true)');
  console.log('   - Reliability Evidence Present:', compInitial.hasEvidence, '(Expected true)');
  console.log('   - Investigation Queue Present:', compInitial.hasQueue, '(Expected true)');
  console.log('   - Inventory Table Present:', compInitial.hasTable, '(Expected true)');
  console.log('   - Dossier UID:', compInitial.uidText, '| Status:', compInitial.statusText);

  assert.strictEqual(compInitial.hasTimelineText, false, 'Timeline text must be absent from Components');
  assert.strictEqual(compInitial.hasEfficiencyText, false, 'Efficiency text must be absent from Components');
  assert.strictEqual(compInitial.hasTimelineEl, false, 'Timeline container must be absent from Components');
  assert.strictEqual(compInitial.hasEffEl, false, 'Efficiency container must be absent from Components');
  assert.strictEqual(compInitial.hasDossier, true, 'Dossier must be present');
  assert.strictEqual(compInitial.hasTelemetry, true, 'Telemetry stream must be present');
  assert.strictEqual(compInitial.hasEvidence, true, 'Evidence card must be present');
  assert.strictEqual(compInitial.hasQueue, true, 'Investigation queue must be present');
  assert.strictEqual(compInitial.hasTable, true, 'Inventory table must be present');

  await page.screenshot({ path: path.join(reportDir, 'components_clean_initial.png'), fullPage: true });
  console.log('   ✔ Captured: reports/components_clean_initial.png');

  // 2. Component Selection Switching Test (DIE-R15C15)
  console.log('2. Switching Dossier selector to DIE-R15C15 ...');
  await page.select('#comp-investigation-selector', 'DIE-R15C15');
  await new Promise(r => setTimeout(r, 300));

  const compSwitched = await page.evaluate(() => {
    const comp = document.getElementById('page-components');
    const timelineEl = document.getElementById('component-timeline-section');
    const effEl = document.getElementById('component-qualification-efficiency-panel');
    return {
      hasTimelineText: comp ? (comp.innerText.includes('Traceable ReliabilityCase') || comp.innerText.includes('AUDITABLE DECISION PROVENANCE')) : false,
      hasEfficiencyText: comp ? (comp.innerText.includes('Qualification Efficiency Opportunity') || comp.innerText.includes('SCREENING THROUGHPUT ANALYSIS')) : false,
      hasTimelineEl: !!timelineEl,
      hasEffEl: !!effEl,
      uidText: document.getElementById('dossier-uid') ? document.getElementById('dossier-uid').innerText : '',
      statusText: document.getElementById('dossier-status') ? document.getElementById('dossier-status').innerText : '',
      tempText: document.getElementById('dossier-tel-temp') ? document.getElementById('dossier-tel-temp').innerText : '',
      iddqText: document.getElementById('dossier-tel-iddq') ? document.getElementById('dossier-tel-iddq').innerText : ''
    };
  });

  console.log('   Switched Components State (DIE-R15C15):');
  console.log('   - Timeline Text Present:', compSwitched.hasTimelineText, '(Expected false)');
  console.log('   - Efficiency Text Present:', compSwitched.hasEfficiencyText, '(Expected false)');
  console.log('   - Dossier UID:', compSwitched.uidText, '| Status:', compSwitched.statusText);
  console.log('   - Telemetry Temp:', compSwitched.tempText, '| IDDQ:', compSwitched.iddqText);

  assert.strictEqual(compSwitched.hasTimelineText, false, 'Timeline must not reappear after component selection');
  assert.strictEqual(compSwitched.hasEfficiencyText, false, 'Efficiency must not reappear after component selection');
  assert.strictEqual(compSwitched.uidText, 'DIE-R15C15', 'UID must update to DIE-R15C15');
  assert.strictEqual(compSwitched.statusText, 'PASS', 'Status must update to PASS');

  await page.screenshot({ path: path.join(reportDir, 'components_clean_switched_R15C15.png'), fullPage: true });
  console.log('   ✔ Captured: reports/components_clean_switched_R15C15.png');

  // 3. Regression Check Across All Pages
  console.log('3. Running Regression Verification Across All Pages ...');

  // Home
  await page.goto('http://localhost:8000/#page-home', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 200));
  const homeOk = await page.$eval('#page-home', el => window.getComputedStyle(el).display !== 'none');
  console.log('   - Home Page Visible:', homeOk);
  assert.strictEqual(homeOk, true);

  // Screening
  await page.goto('http://localhost:8000/#page-screening', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 200));
  const scrOk = await page.$eval('#page-screening', el => window.getComputedStyle(el).display !== 'none');
  console.log('   - Screening Page Visible:', scrOk);
  assert.strictEqual(scrOk, true);

  // Live Monitor
  await page.goto('http://localhost:8000/#page-monitor', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 200));
  const monOk = await page.$eval('#page-monitor', el => window.getComputedStyle(el).display !== 'none');
  console.log('   - Live Monitor Page Visible:', monOk);
  assert.strictEqual(monOk, true);

  // Advanced
  await page.goto('http://localhost:8000/#page-advanced', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 200));
  const advOk = await page.$eval('#page-advanced', el => window.getComputedStyle(el).display !== 'none');
  console.log('   - Advanced Page Visible:', advOk);
  assert.strictEqual(advOk, true);

  console.log('4. Audit summary:');
  console.log('   Console errors:', consoleErrors.length);
  console.log('   Failed requests:', failedRequests.length);

  assert.strictEqual(consoleErrors.length, 0, 'Must have zero console errors');
  assert.strictEqual(failedRequests.length, 0, 'Must have zero failed requests');

  await browser.close();
  console.log('=========================================================================');
  console.log('ALL VERIFICATIONS PASSED PERFECTLY (100% SUCCESS)');
  console.log('=========================================================================');
})();
