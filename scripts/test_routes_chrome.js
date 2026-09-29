const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1600 });

  const urls = [
    'http://localhost:8000/#page-screening',
    'http://localhost:8000/#screening',
    'http://localhost:8000/#/screening',
    'http://localhost:8000/'
  ];

  for (const u of urls) {
    console.log(`\n========================================`);
    console.log(`Testing URL: ${u}`);
    await page.goto(u, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    const activePage = await page.evaluate(() => {
      const active = document.querySelector('.page-view.active');
      return active ? { id: active.id, className: active.className } : null;
    });
    console.log('Active page view:', activePage);

    const hasTimeline = await page.evaluate(() => {
      const active = document.querySelector('.page-view.active');
      if (!active) return false;
      return active.innerText.includes('Traceable ReliabilityCase') || active.innerText.includes('AUDITABLE DECISION PROVENANCE');
    });
    const hasEfficiency = await page.evaluate(() => {
      const active = document.querySelector('.page-view.active');
      if (!active) return false;
      return active.innerText.includes('Qualification Efficiency Opportunity') || active.innerText.includes('SCREENING THROUGHPUT ANALYSIS');
    });

    console.log('Active page has Timeline:', hasTimeline);
    console.log('Active page has Efficiency:', hasEfficiency);
  }

  await browser.close();
})();
