const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle0' });

  const pages = ['page-home', 'page-screening', 'page-monitor'];

  for (const pg of pages) {
    await page.evaluate((id) => window.switchPage(id), pg);
    await new Promise(r => setTimeout(r, 200));

    const overflowingEls = await page.evaluate(() => {
      const docWidth = document.documentElement.clientWidth;
      const elements = Array.from(document.querySelectorAll('*'));
      const overflowing = [];

      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.right > docWidth + 1) {
          overflowing.push({
            tag: el.tagName,
            id: el.id,
            className: el.className,
            right: rect.right,
            width: rect.width,
            outerHTML: el.outerHTML.slice(0, 100)
          });
        }
      }
      return overflowing.slice(0, 10);
    });

    console.log(`\n=== Overflow on ${pg} ===`);
    console.log(overflowingEls);
  }

  await browser.close();
})();
