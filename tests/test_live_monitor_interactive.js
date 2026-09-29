const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runTest() {
  console.log('=== STARTING LIVE MONITOR & FONT SIZE AUDIT ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1560, height: 1000 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Listen to console
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));

  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle2' });
  console.log('Page loaded successfully.');

  // 1. Navigate to Live Monitor
  console.log('Navigating to Live Monitor...');
  await page.click('button[data-page="page-monitor"]');
  await new Promise(r => setTimeout(r, 600));

  // Check monitor is visible
  const isMonitorVisible = await page.$eval('#page-monitor', el => window.getComputedStyle(el).display !== 'none');
  console.log('Is page-monitor visible:', isMonitorVisible);

  // 2. Check Horizontal Header & Replay Controller
  const headerLayout = await page.$eval('#page-monitor .card:first-child > div', el => {
    const style = window.getComputedStyle(el);
    return {
      display: style.display,
      gridTemplateColumns: style.gridTemplateColumns,
      width: el.clientWidth,
      height: el.clientHeight
    };
  });
  console.log('Header layout:', headerLayout);

  // 3. Check Initial SVG rendering in comp-vs-lot-svg-box
  const initialSvg = await page.$eval('#comp-vs-lot-svg-box', el => ({
    hasSvg: !!el.querySelector('svg'),
    innerHTMLPreview: el.innerHTML.substring(0, 150),
    height: el.clientHeight,
    width: el.clientWidth
  }));
  console.log('Initial comp-vs-lot SVG box:', initialSvg);

  // Take screenshot of initial 24h state
  await page.screenshot({ path: 'monitor_24h_state.png', fullPage: false });
  console.log('Saved monitor_24h_state.png');

  // 4. Test Step Replay forward (+24h -> 48h, 72h, 96h)
  console.log('Testing stepReplay +24h...');
  await page.click('#btn-replay-step-fwd');
  await new Promise(r => setTimeout(r, 300));

  let hourBadgeText = await page.$eval('#live-current-hour-badge', el => el.textContent);
  console.log('Hour badge after +24h:', hourBadgeText);

  await page.click('#btn-replay-step-fwd');
  await new Promise(r => setTimeout(r, 300));
  hourBadgeText = await page.$eval('#live-current-hour-badge', el => el.textContent);
  console.log('Hour badge after second +24h (72h):', hourBadgeText);

  await page.click('#btn-replay-step-fwd');
  await new Promise(r => setTimeout(r, 300));
  hourBadgeText = await page.$eval('#live-current-hour-badge', el => el.textContent);
  console.log('Hour badge at 96h:', hourBadgeText);

  // Take screenshot of 96h state
  await page.screenshot({ path: 'monitor_96h_state.png', fullPage: false });
  console.log('Saved monitor_96h_state.png');

  // 5. Test Metric Switcher (Gate Leakage)
  console.log('Testing metric switcher to Gate Leakage...');
  await page.click('#btn-metric-leakage');
  await new Promise(r => setTimeout(r, 400));

  let chartTitle = await page.$eval('#comp-vs-lot-title', el => el.textContent);
  console.log('Chart title after metric switch:', chartTitle);

  // Take screenshot of Gate Leakage
  await page.screenshot({ path: 'monitor_leakage_state.png', fullPage: false });
  console.log('Saved monitor_leakage_state.png');

  // 6. Test Play/Pause Replay Animation
  console.log('Testing Play/Pause replay animation...');
  await page.click('#btn-replay-play-pause');
  console.log('Started playback... waiting 1.5s');
  await new Promise(r => setTimeout(r, 1500));

  hourBadgeText = await page.$eval('#live-current-hour-badge', el => el.textContent);
  console.log('Hour badge during playback:', hourBadgeText);

  await page.click('#btn-replay-play-pause'); // Pause
  console.log('Paused playback.');

  // 7. Test Reset
  await page.click('#btn-replay-reset');
  await new Promise(r => setTimeout(r, 300));
  hourBadgeText = await page.$eval('#live-current-hour-badge', el => el.textContent);
  console.log('Hour badge after reset:', hourBadgeText);

  // 8. Audit small font sizes on the live rendered page
  const smallTextAudit = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    const tooSmall = [];
    allEls.forEach(el => {
      if (el.children.length === 0 && el.textContent.trim().length > 0) {
        const fs = parseFloat(window.getComputedStyle(el).fontSize);
        if (fs < 11.0 && !el.closest('script') && !el.closest('style')) {
          tooSmall.push({
            tag: el.tagName,
            text: el.textContent.trim().substring(0, 40),
            fontSize: fs + 'px'
          });
        }
      }
    });
    return tooSmall;
  });

  console.log('Text elements smaller than 11px count:', smallTextAudit.length);
  if (smallTextAudit.length > 0) {
    console.log('Sample elements smaller than 11px:', smallTextAudit.slice(0, 10));
  }

  // 9. Check other pages for font sizes and layout
  console.log('Checking Screening page...');
  await page.click('button[data-page="page-screening"]');
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'screening_page_audit.png', fullPage: false });

  console.log('Checking Components page...');
  await page.click('button[data-page="page-components"]');
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'components_page_audit.png', fullPage: false });

  console.log('Checking Home page...');
  await page.click('button[data-page="page-home"]');
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'home_page_audit.png', fullPage: false });

  await browser.close();
  console.log('=== AUDIT COMPLETE ===');
}

runTest().catch(err => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
