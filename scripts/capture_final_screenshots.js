const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.join(__dirname, '../reports/final_restored_screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

(async () => {
  console.log('Capturing Final Restored Screenshots in Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.setCacheEnabled(false);

  const pages = [
    { id: 'page-home', name: 'Home' },
    { id: 'page-screening', name: 'Screening' },
    { id: 'page-monitor', name: 'Live Monitor' },
    { id: 'page-components', name: 'Components' },
    { id: 'page-advanced', name: 'Advanced' }
  ];

  await page.goto('http://localhost:8000/?build=final-restore&t=' + Date.now(), { waitUntil: 'networkidle0' });

  for (const p of pages) {
    await page.evaluate((pid) => {
      window.switchPage(pid);
    }, p.id);
    await new Promise(r => setTimeout(r, 600));

    const shotPath = path.join(SCREENSHOT_DIR, `${p.id}.png`);
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`Saved screenshot for ${p.name}: ${shotPath}`);
  }

  await browser.close();
  console.log('All 5 page screenshots saved successfully.');
})();
