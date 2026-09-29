const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const reportsDir = path.join(__dirname, '..', 'reports');

(async () => {
  console.log('=== AUDITING AND CAPTURING ALL 5 CORRECTED WORKSTATIONS ===');
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
    console.log('1. Auditing Home Page...');
    await page.goto('http://localhost:8000/#page-home', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 500));
    
    // Check nav geometry
    const navBounds = await page.evaluate(() => {
      const menu = document.getElementById('topnav-menu');
      const container = document.querySelector('.topnav-container');
      const rect = menu.getBoundingClientRect();
      const contRect = container.getBoundingClientRect();
      const leftSpace = rect.left - contRect.left;
      const rightSpace = contRect.right - rect.right;
      return { menuWidth: rect.width, leftSpace, rightSpace, diff: Math.abs(leftSpace - rightSpace) };
    });
    console.log('   Nav alignment geometry:', navBounds);
    await page.screenshot({ path: path.join(reportsDir, 'pass1_home_full.png'), fullPage: false });
    console.log('   ✔ Captured: reports/pass1_home_full.png');

    // 2. Screening
    console.log('2. Auditing Screening Page...');
    await page.evaluate(() => window.switchPage('page-screening'));
    await new Promise(r => setTimeout(r, 500));
    
    const screeningInfo = await page.evaluate(() => {
      const elManual = document.getElementById('screening-view-manual');
      const elInput = document.getElementById('screening-input-card');
      const elResult = document.getElementById('screening-result-panel');
      return {
        manualVisible: elManual ? window.getComputedStyle(elManual).display !== 'none' : false,
        manualHeight: elManual ? elManual.offsetHeight : 0,
        inputVisible: elInput ? window.getComputedStyle(elInput).display !== 'none' : false,
        resultVisible: elResult ? window.getComputedStyle(elResult).display !== 'none' : false
      };
    });
    console.log('   Screening elements status:', screeningInfo);
    assert(screeningInfo.manualVisible && screeningInfo.manualHeight > 200, "Screening manual console must be fully visible and rendered!");
    await page.screenshot({ path: path.join(reportsDir, 'pass1_screening_restored.png'), fullPage: true });
    console.log('   ✔ Captured: reports/pass1_screening_restored.png');

    // 3. Components & Investigation Queue
    console.log('3. Auditing Components Page & Investigation Queue...');
    await page.evaluate(() => window.switchPage('page-components'));
    await new Promise(r => setTimeout(r, 500));
    
    const queueInfo = await page.evaluate(() => {
      const queueContainer = document.getElementById('component-investigation-queue-container');
      const cards = document.querySelectorAll('.queue-card');
      return {
        queueContainerWidth: queueContainer ? queueContainer.offsetWidth : 0,
        queueContainerMaxW: queueContainer ? window.getComputedStyle(queueContainer).maxWidth : 0,
        cardCount: cards.length,
        firstCardHeight: cards[0] ? cards[0].offsetHeight : 0
      };
    });
    console.log('   Investigation Queue status:', queueInfo);
    await page.screenshot({ path: path.join(reportsDir, 'pass1_components_queue.png'), fullPage: true });
    console.log('   ✔ Captured: reports/pass1_components_queue.png');

    // 4. Live Monitor
    console.log('4. Auditing Live Monitor...');
    await page.evaluate(() => window.switchPage('page-monitor'));
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(reportsDir, 'pass1_live_monitor.png'), fullPage: false });
    console.log('   ✔ Captured: reports/pass1_live_monitor.png');

    // 5. Advanced & Validation Tab
    console.log('5. Auditing Advanced & Validation Tab...');
    await page.evaluate(() => window.switchPage('page-advanced'));
    await new Promise(r => setTimeout(r, 400));
    await page.evaluate(() => window.switchAdvancedTab('adv-tab-validation'));
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: path.join(reportsDir, 'pass1_advanced_validation.png'), fullPage: false });
    console.log('   ✔ Captured: reports/pass1_advanced_validation.png');

    console.log('Summary:');
    console.log('   Console Errors:', consoleErrors.length);
    console.log('   Failed Requests:', failedRequests.length);
    assert(consoleErrors.length === 0, "No console errors allowed");
    assert(failedRequests.length === 0, "No network failures allowed");
    console.log('=== ALL 5 WORKSTATION AUDITS PASSED WITH ZERO ERRORS ===');
  } catch (err) {
    console.error('Audit failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
