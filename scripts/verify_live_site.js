const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  console.log('=== VERIFYING LIVE SITE AT http://localhost:8000/ ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960 });

  const consoleErrors = [];
  const failedRequests = [];

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('requestfailed', req => {
    failedRequests.push({ url: req.url(), failure: req.failure() ? req.failure().errorText : 'Unknown' });
  });

  try {
    // 1. Home
    console.log('1. Checking Home...');
    await page.goto('http://localhost:8000/#page-home', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 400));
    const homeVisible = await page.$eval('#page-home', el => el.style.display !== 'none');
    console.log('   Home visible:', homeVisible);

    // 2. Screening
    console.log('2. Checking Screening...');
    await page.evaluate(() => window.switchPage('page-screening'));
    await new Promise(r => setTimeout(r, 300));
    const screeningVisible = await page.$eval('#page-screening', el => el.style.display !== 'none');
    console.log('   Screening visible:', screeningVisible);

    // 3. Live Monitor
    console.log('3. Checking Live Monitor...');
    await page.evaluate(() => window.switchPage('page-monitor'));
    await new Promise(r => setTimeout(r, 300));
    const monitorVisible = await page.$eval('#page-monitor', el => el.style.display !== 'none');
    console.log('   Live Monitor visible:', monitorVisible);

    // 4. Components
    console.log('4. Checking Components...');
    await page.evaluate(() => window.switchPage('page-components'));
    await new Promise(r => setTimeout(r, 300));
    const compVisible = await page.$eval('#page-components', el => el.style.display !== 'none');
    console.log('   Components visible:', compVisible);

    // 5. Advanced & Validation & Evidence
    console.log('5. Checking Advanced & Validation Tab...');
    await page.evaluate(() => window.switchPage('page-advanced'));
    await new Promise(r => setTimeout(r, 300));
    await page.evaluate(() => window.switchAdvancedTab('adv-tab-validation'));
    await new Promise(r => setTimeout(r, 500));
    const advVisible = await page.$eval('#page-advanced', el => el.style.display !== 'none');
    const valVisible = await page.$eval('#adv-tab-validation', el => el.style.display !== 'none');
    console.log('   Advanced visible:', advVisible, '| Validation Tab visible:', valVisible);

    const outPath = path.join(__dirname, '..', 'reports', 'live_confirmed_validation.png');
    await page.screenshot({ path: outPath });
    console.log('   ✔ Screenshot saved to:', outPath);

    console.log('Summary:');
    console.log('   Console errors:', consoleErrors.length);
    console.log('   Failed requests:', failedRequests.length);

    assert(homeVisible && screeningVisible && monitorVisible && compVisible && advVisible && valVisible);
    assert(consoleErrors.length === 0);
    assert(failedRequests.length === 0);
    console.log('=== ALL LIVE SITE CHECKS PASSED ===');
  } catch (err) {
    console.error('Check failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
