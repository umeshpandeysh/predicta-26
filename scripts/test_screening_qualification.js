const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  console.log('Testing Screening Qualification Workflow...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  await page.goto('http://localhost:8000/#page-screening', { waitUntil: 'networkidle0' });

  // 1. Select component & lot
  await page.select('#adm-in-comp-id', 'DIE-R20C20');
  await page.select('#adm-in-lot-id', 'LOT-SYN-044');

  // 2. Fill inputs
  await page.evaluate(() => {
    document.getElementById('adm-in-temp').value = '85.0';
    document.getElementById('adm-in-voltage').value = '1.35';
    document.getElementById('adm-in-freq').value = '2800';
    document.getElementById('adm-in-duration').value = '24';
    document.getElementById('adm-in-iddq').value = '28.4';
    document.getElementById('adm-in-leakage').value = '240.5';
    document.getElementById('adm-in-tpd').value = '14.20';
    document.getElementById('adm-in-power').value = '78.5';
  });

  // 3. Trigger runParametricQualification
  console.log('Triggering runParametricQualification()...');
  const res = await page.evaluate(async () => {
    await window.runParametricQualification();
    return {
      emptyDisplay: window.getComputedStyle(document.getElementById('adm-in-result-empty')).display,
      contentDisplay: window.getComputedStyle(document.getElementById('adm-in-result-content')).display,
      badgeText: document.getElementById('adm-in-res-badge')?.textContent,
      riskScore: document.getElementById('pillar-risk-score')?.textContent
    };
  });

  console.log('Screening Execution Result:', res);
  await browser.close();
})();
