const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function verifyAllPages() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const pages = [
    { name: 'Home', hash: '#page-home', sel: '#page-home .hero-card' },
    { name: 'Screening', hash: '#page-screening', sel: '#page-screening .panel-primary, #page-screening .page-header, #page-screening > div' },
    { name: 'Live Monitor', hash: '#page-monitor', sel: '#page-monitor .page-header, #page-monitor > div' },
    { name: 'Components', hash: '#page-components', sel: '#page-components .page-header, #page-components > div' },
    { name: 'Advanced', hash: '#page-advanced', sel: '#page-advanced .page-header, #page-advanced > div' }
  ];

  console.log('=== CLEARANCE MEASUREMENTS (TOPNAV HEIGHT: 64px, PADDING-TOP: 84px) ===\n');

  for (const p of pages) {
    await page.goto(`http://localhost:8000/${p.hash}`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 400));

    const data = await page.evaluate((selector) => {
      const topnav = document.querySelector('.topnav');
      const el = document.querySelector(selector);
      const topnavRect = topnav.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      return {
        topnavHeight: topnavRect.height,
        topnavBottom: topnavRect.bottom,
        elTop: elRect.top,
        clearance: elRect.top - topnavRect.bottom,
        isCovered: elRect.top < topnavRect.bottom
      };
    }, p.sel);

    console.log(`Page: ${p.name}`);
    console.log(`  - Navbar Bottom: ${data.topnavBottom}px`);
    console.log(`  - Content Top:   ${data.elTop}px`);
    console.log(`  - Clearance:     ${data.clearance}px`);
    console.log(`  - Covered:       ${data.isCovered ? 'YES (OVERLAP ERROR)' : 'NO (CLEAR)'}`);
    console.log();

    const shot = path.resolve(`reports/clearance_${p.name.toLowerCase().replace(/\s+/g, '_')}.png`);
    await page.screenshot({ path: shot });
  }

  await browser.close();
}

verifyAllPages().catch(console.error);
