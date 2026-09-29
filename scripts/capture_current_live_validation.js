const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.setCacheEnabled(false);

  console.log('Navigating to http://localhost:8000/#page-advanced ...');
  await page.goto('http://localhost:8000/#page-advanced', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));

  console.log('Switching to Tab 7: Validation & Evidence...');
  await page.evaluate(() => {
    if (typeof window.switchAdvancedTab === 'function') {
      window.switchAdvancedTab('adv-tab-validation');
    } else {
      const btn = document.querySelector('.adv-tab-btn[data-target="adv-tab-validation"]');
      if (btn) btn.click();
    }
  });

  await new Promise(r => setTimeout(r, 800));

  const outPath = path.join(__dirname, '../reports/current_live_validation_test.png');
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`Saved screenshot to: ${outPath}`);

  await browser.close();
})();
