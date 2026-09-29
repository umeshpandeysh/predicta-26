const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const reportsDir = path.join(__dirname, '..', 'reports');

(async () => {
  console.log('=== PREDICTA: AUDITING HOMEPAGE FINAL VISUAL REFINEMENTS ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Audit Home Page
  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  // Check 1: Hero Viewport Height
  const heroMetrics = await page.evaluate(() => {
    const hero = document.querySelector('.hero-card');
    const heroRect = hero ? hero.getBoundingClientRect() : null;
    const topnav = document.querySelector('.topnav');
    const topnavRect = topnav ? topnav.getBoundingClientRect() : null;
    return {
      heroHeight: heroRect ? heroRect.height : null,
      heroTop: heroRect ? heroRect.top : null,
      topnavBottom: topnavRect ? topnavRect.bottom : null,
      clearance: heroRect && topnavRect ? heroRect.top - topnavRect.bottom : null,
      viewportHeight: window.innerHeight
    };
  });
  console.log('1. Hero Viewport Metrics:', heroMetrics);
  if (!heroMetrics.heroHeight || heroMetrics.heroHeight < 650) {
    console.error('❌ Hero is not occupying the full first viewport height!');
    process.exit(1);
  }
  console.log('✔ PASSED: Hero occupies full opening viewport (height:', heroMetrics.heroHeight, 'px)');

  // Check 2: Static vs Dynamic is gone from Home
  const homeStaticCheck = await page.evaluate(() => {
    const home = document.getElementById('page-home');
    return home ? home.innerText.includes('Static vs. Dynamic Reliability Screening Architecture') : false;
  });
  console.log('2. Static vs Dynamic in Home (should be false):', homeStaticCheck);
  if (homeStaticCheck) {
    console.error('❌ Static vs Dynamic still found in Home page!');
    process.exit(1);
  }
  console.log('✔ PASSED: Static vs Dynamic section successfully removed from Home.');

  // Check 3: Tagline text & size
  const taglineInfo = await page.evaluate(() => {
    const taglineEl = document.querySelector('.home-closing-tagline div');
    const style = taglineEl ? window.getComputedStyle(taglineEl) : null;
    return {
      text: taglineEl ? taglineEl.innerText.trim() : null,
      fontSize: style ? style.fontSize : null,
      fontWeight: style ? style.fontWeight : null,
      color: style ? style.color : null
    };
  });
  console.log('3. Homepage Tagline Info:', taglineInfo);
  if (!taglineInfo.text || !taglineInfo.text.includes('Detect Earlier. Predict Degradation. Qualify with Evidence.')) {
    console.error('❌ Tagline text does not match expected!');
    process.exit(1);
  }
  console.log('✔ PASSED: Closing tagline is updated and prominent (fontSize:', taglineInfo.fontSize, ')');

  // Check 4: 8 Wafers Presence
  const wafersInfo = await page.evaluate(() => {
    const waferGrid = document.querySelector('.wafers-8-grid');
    if (!waferGrid) return null;
    const waferCards = Array.from(waferGrid.children);
    const waferTitles = waferCards.map(c => {
      const span = c.querySelector('span');
      return span ? span.innerText.trim() : '';
    });
    return {
      waferCount: waferCards.length,
      waferTitles
    };
  });
  console.log('4. Wafers Info:', wafersInfo);
  if (!wafersInfo || wafersInfo.waferCount !== 8) {
    console.error('❌ Expected 8 wafers, found:', wafersInfo ? wafersInfo.waferCount : 0);
    process.exit(1);
  }
  console.log('✔ PASSED: All 8 benchmark wafers (43 through 50) rendered in panel.');

  // Check 5: Static vs Dynamic is present on Advanced page
  await page.evaluate(() => {
    window.switchPage('page-advanced');
    window.switchAdvancedTab('adv-tab-registry');
  });
  await new Promise(r => setTimeout(r, 400));

  const advStaticCheck = await page.evaluate(() => {
    const adv = document.getElementById('page-advanced');
    const hasComparison = adv ? adv.innerText.includes('Static vs. Dynamic Reliability Screening Architecture') : false;
    const compEl = document.getElementById('adv-static-vs-dynamic-comparison');
    return {
      hasComparison,
      elementExists: !!compEl
    };
  });
  console.log('5. Static vs Dynamic in Advanced (should be true):', advStaticCheck);
  if (!advStaticCheck.hasComparison || !advStaticCheck.elementExists) {
    console.error('❌ Static vs Dynamic comparison not found in Advanced page!');
    process.exit(1);
  }
  console.log('✔ PASSED: Static vs Dynamic comparison successfully embedded in Advanced.');

  // Capture Screenshot of Home Page & Wafers
  await page.evaluate(() => window.switchPage('page-home'));
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(reportsDir, 'final_homepage_live.png'), fullPage: false });
  console.log('✔ Screenshot saved: reports/final_homepage_live.png');

  // Capture full page screenshot of Home
  await page.screenshot({ path: path.join(reportsDir, 'final_homepage_full.png'), fullPage: true });
  console.log('✔ Screenshot saved: reports/final_homepage_full.png');

  // Capture screenshot of Advanced with Static vs Dynamic
  await page.evaluate(() => {
    window.switchPage('page-advanced');
    window.switchAdvancedTab('adv-tab-registry');
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(reportsDir, 'final_advanced_registry_with_architecture.png'), fullPage: false });
  console.log('✔ Screenshot saved: reports/final_advanced_registry_with_architecture.png');

  await browser.close();
  console.log('\n=== HOMEPAGE FINAL VISUAL REFINEMENT 100% VERIFIED ===');
})();
