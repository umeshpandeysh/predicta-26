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

  await page.goto('http://localhost:8000/#page-home', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  const metrics = await page.evaluate(() => {
    const topnav = document.querySelector('.top-nav, header, nav, .navbar');
    const hero = document.querySelector('.hero-card');
    const title = document.querySelector('.hero-card .page-title');
    const overline = document.querySelector('.hero-card .technical-overline');
    const main = document.querySelector('.main-content, main, #main-content');

    const topnavRect = topnav.getBoundingClientRect();
    const heroRect = hero.getBoundingClientRect();
    const overlineRect = overline ? overline.getBoundingClientRect() : null;
    const titleRect = title ? title.getBoundingClientRect() : null;

    return {
      topnavHeight: topnavRect.height,
      topnavBottom: topnavRect.bottom,
      heroTop: heroRect.top,
      clearanceToHero: heroRect.top - topnavRect.bottom,
      overlineTop: overlineRect ? overlineRect.top : null,
      titleTop: titleRect ? titleRect.top : null,
      mainPaddingTop: main ? window.getComputedStyle(main).paddingTop : null
    };
  });

  console.log('Clearance Metrics:', metrics);

  const reportsDir = path.join(__dirname, '..', 'reports');
  await page.screenshot({ path: path.join(reportsDir, 'home_full_page.png') });
  console.log('Saved home_full_page.png');

  await browser.close();
})();
