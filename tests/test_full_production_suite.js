const puppeteer = require('puppeteer-core');
const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runMasterProductionSuite() {
  console.log("=========================================================================");
  console.log("PREDICTA-26 — MASTER PRODUCTION END-TO-END VERIFICATION SUITE");
  console.log("=========================================================================\n");

  // Step 1: File Mirror Parity
  console.log("--- 1. VERIFYING FILE MIRROR PARITY ---");
  ['index.html', 'style.css', 'script.js', 'api.js'].forEach(file => {
    const root = fs.readFileSync(file, 'utf8');
    const mirror = fs.readFileSync(path.join('frontend', file), 'utf8');
    assert.strictEqual(root, mirror, `${file} does not match frontend/${file}`);
    console.log(`✔ ${file} matches frontend/${file} exactly (${root.length} bytes)`);
  });

  // Step 2: HTTP API Endpoints Check
  console.log("\n--- 2. VERIFYING HTTP API ENDPOINTS ---");
  async function testHttp(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const opt = {
        hostname: 'localhost',
        port: 8000,
        path: path,
        method: method,
        headers: { 'Content-Type': 'application/json', ...headers }
      };
      const req = http.request(opt, res => {
        let d = '';
        res.on('data', chunk => d += chunk);
        res.on('end', () => {
          let parsed = null;
          try { parsed = JSON.parse(d); } catch (e) { parsed = d; }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      });
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  // Check /api/health
  const healthRes = await testHttp('GET', '/api/health');
  assert.strictEqual(healthRes.status, 200, "GET /api/health must return 200");
  assert.strictEqual(healthRes.body.threshold, 0.20, "Operating threshold must be 0.20");
  console.log("✔ GET /api/health OK (Status:", healthRes.body.status, "Threshold:", healthRes.body.threshold + ")");

  // Check /api/auth/session
  const sessionRes = await testHttp('GET', '/api/auth/session');
  assert.strictEqual(sessionRes.status, 200, "GET /api/auth/session must return 200");
  assert.ok(sessionRes.body.token, "Session token must be present");
  const token = sessionRes.body.token;
  console.log("✔ GET /api/auth/session OK (Token generated)");

  // Check /api/components
  const compsRes = await testHttp('GET', '/api/components');
  assert.strictEqual(compsRes.status, 200, "GET /api/components must return 200");
  assert.ok(compsRes.body.total > 0, "Components total must be > 0");
  console.log(`✔ GET /api/components OK (${compsRes.body.total} components)`);

  // Check /api/components/DIE-R20C20
  const singleCompRes = await testHttp('GET', '/api/components/DIE-R20C20');
  assert.strictEqual(singleCompRes.status, 200, "GET /api/components/DIE-R20C20 must return 200");
  console.log(`✔ GET /api/components/DIE-R20C20 OK (Disposition: ${singleCompRes.body.disposition})`);

  // Check /api/live-monitor/replay
  const replayRes = await testHttp('GET', '/api/live-monitor/replay?component_id=DIE-R20C20&lot_id=LOT-SYN-048');
  assert.strictEqual(replayRes.status, 200, "GET /api/live-monitor/replay must return 200");
  assert.ok(replayRes.body.frames && replayRes.body.frames.length > 0, "Replay frames must be present");
  console.log(`✔ GET /api/live-monitor/replay OK (${replayRes.body.frames.length} timeline frames)`);

  // Check /api/model/registry
  const modelRegRes = await testHttp('GET', '/api/model/registry');
  assert.strictEqual(modelRegRes.status, 200, "GET /api/model/registry must return 200");
  console.log("✔ GET /api/model/registry OK");

  // Check POST /api/predict (LIVE ML PIPELINE)
  const predictPayload = {
    test_id: "E2E-TEST-001",
    lot_id: "LOT-SYN-044",
    wafer_id: "W44",
    die_id: "DIE-R20C20",
    burn_in_hour: 24.0,
    supply_voltage: 1.35,
    output_voltage: 1.15,
    current: 48.0,
    leakage_current: 240.5,
    resistance: 15.2,
    capacitance: 5.8,
    threshold_voltage: 0.40,
    frequency: 2800.0,
    propagation_delay: 14.20,
    setup_time: 2.1,
    hold_time: 1.4,
    timing_margin: 1.1,
    temperature: 85.0,
    dynamic_power: 65.0,
    total_power: 78.5,
    test_duration: 24.0
  };
  const predictRes = await testHttp('POST', '/api/predict', predictPayload, { 'Authorization': `Bearer ${token}` });
  assert.strictEqual(predictRes.status, 200, "POST /api/predict must return 200");
  assert.strictEqual(predictRes.body.prediction, "FAIL", "Defective record must predict FAIL");
  assert.ok(predictRes.body.probability >= 0.20, "Probability must be >= 0.20");
  console.log(`✔ POST /api/predict OK (Prediction: ${predictRes.body.prediction}, Probability: ${predictRes.body.probability})`);

  // Check POST /api/upload/preview (CSV Preview)
  const csvText = "die_id,lot_id,wafer_id,burn_in_hour,supply_voltage,output_voltage,current,leakage_current,resistance,capacitance,threshold_voltage,frequency,propagation_delay,setup_time,hold_time,timing_margin,temperature,dynamic_power,total_power,test_duration\nDIE-01,LOT-01,W01,24,1.2,1.19,40,110,12,4,0.45,2500,12,1.5,1,3,27,45,52,10";
  const previewRes = await testHttp('POST', '/api/upload/preview', { csv_text: csvText });
  assert.strictEqual(previewRes.status, 200, "POST /api/upload/preview must return 200");
  assert.strictEqual(previewRes.body.total_rows, 1, "CSV row count must be 1");
  console.log("✔ POST /api/upload/preview OK (CSV preview validated)");

  // Check POST /api/reports/generate
  const reportRes = await testHttp('POST', '/api/reports/generate', { type: "QUALIFICATION_SUMMARY", id: "LOT-SYN-043" });
  assert.strictEqual(reportRes.status, 200, "POST /api/reports/generate must return 200");
  console.log("✔ POST /api/reports/generate OK");

  // Step 3: Headless Browser DOM and Interactive Workstations
  console.log("\n--- 3. VERIFYING HEADLESS BROWSER WORKSTATIONS & UI INTEGRITY ---");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1560, height: 1000 });

  const clientErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') clientErrors.push(msg.text()); });
  page.on('pageerror', err => clientErrors.push(err.toString()));

  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle0' });
  console.log("✔ Homepage loaded successfully in Chrome at 1560px");

  // Verify Navbar links
  const navTabs = await page.$$eval('.topnav-menu .nav-link', els => els.map(e => e.textContent.trim()));
  console.log("Topnav tabs order:", navTabs);
  assert.deepStrictEqual(navTabs, ['Home', 'Screening', 'Components', 'Live Monitor', 'Advanced']);
  console.log("✔ Topnav tabs order verified 100%");

  // Verify Home Page Single Wafer & Yield
  const waferTitle = await page.$eval('#home-wafer-title', el => el.textContent.trim());
  const waferYield = await page.$eval('#home-wafer-yield-val', el => el.textContent.trim());
  assert.ok(waferTitle.includes('Wafer 43'), "Initial wafer title must be Wafer 43");
  assert.strictEqual(waferYield, '96.9%', "Initial wafer yield must be 96.9%");
  console.log(`✔ Home Wafer display verified (${waferTitle}, Yield: ${waferYield})`);

  // Verify Screening Page & Governed Decision Command Panel
  await page.evaluate(() => window.switchPage('page-screening'));
  await new Promise(r => setTimeout(r, 300));
  await page.select('#adm-in-comp-id', 'DIE-R15C15');
  await page.select('#adm-in-lot-id', 'LOT-SYN-043');
  await page.type('#adm-in-temp', '25.0');
  await page.type('#adm-in-voltage', '1.20');
  await page.type('#adm-in-freq', '2500');
  await page.type('#adm-in-duration', '24');
  await page.type('#adm-in-iddq', '10.7');
  await page.type('#adm-in-leakage', '111.7');
  await page.type('#adm-in-tpd', '10.98');
  await page.type('#adm-in-power', '45.0');

  await page.click('#btn-adm-in-submit');
  await page.waitForFunction(() => {
    const el = document.getElementById('adm-in-result-content');
    return el && window.getComputedStyle(el).display === 'block';
  }, { timeout: 10000 });

  const screeningResult = await page.evaluate(() => ({
    comp: document.getElementById('adm-in-res-comp')?.textContent.trim(),
    badge: document.getElementById('adm-in-res-badge')?.textContent.trim(),
    action: document.getElementById('adm-in-res-action-text')?.textContent.trim()
  }));
  assert.strictEqual(screeningResult.badge, 'PASS');
  assert.strictEqual(screeningResult.comp, 'DIE-R15C15');
  console.log(`✔ Live Screening execution rendered cleanly in UI (Component: ${screeningResult.comp}, Decision: ${screeningResult.badge})`);

  // Verify Components Page
  await page.evaluate(() => window.switchPage('page-components'));
  await new Promise(r => setTimeout(r, 300));
  const queueCardsCount = await page.$$eval('.queue-card', els => els.length);
  assert.ok(queueCardsCount > 0, "Queue cards must exist");
  console.log(`✔ Components Page queue verified (${queueCardsCount} cards present)`);

  // Verify Live Monitor Page & moving chart
  await page.evaluate(() => window.switchPage('page-monitor'));
  await new Promise(r => setTimeout(r, 400));
  const hasChartSvg = await page.$eval('#comp-vs-lot-svg-box svg', el => !!el);
  assert.ok(hasChartSvg, "Live Monitor dynamic chart SVG must render");
  console.log("✔ Live Monitor dynamic comparative chart rendered successfully");

  // Verify Advanced Workstation Subtabs
  await page.evaluate(() => window.switchPage('page-advanced'));
  await new Promise(r => setTimeout(r, 300));
  const advSubtabs = await page.$$eval('.adv-subnav-btn', els => els.map(e => e.textContent.trim()));
  console.log(`✔ Advanced Workstation verified (${advSubtabs.length} subtabs present)`);

  // Viewport Overflow Check
  const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
  const windowInnerWidth = await page.evaluate(() => window.innerWidth);
  assert.ok(bodyScrollWidth <= windowInnerWidth + 5, `Horizontal overflow detected! scrollWidth: ${bodyScrollWidth}, innerWidth: ${windowInnerWidth}`);
  console.log("✔ Viewport horizontal clearance verified (Zero overflow)");

  // Console Errors Check
  console.log("Client Console Errors Count:", clientErrors.length);
  if (clientErrors.length > 0) {
    console.warn("Client console errors:", clientErrors);
  }
  assert.strictEqual(clientErrors.length, 0, "Zero client console errors required");
  console.log("✔ Client console is 100% clean");

  await browser.close();

  console.log("\n=========================================================================");
  console.log("🏆 ALL MASTER PRODUCTION SUITE TESTS PASSED 100% CLEANLY! ✅");
  console.log("=========================================================================");
}

runMasterProductionSuite().catch(err => {
  console.error("TEST SUITE ERROR:", err);
  process.exit(1);
});
