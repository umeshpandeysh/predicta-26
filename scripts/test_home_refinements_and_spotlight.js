const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('=================================================================');
  console.log('PREDICTA — HOME HERO, SINGLE WAFER & SPOTLIGHT VERIFICATION');
  console.log('=================================================================');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.toString()));

  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  // 1. HOME HERO AUDIT
  console.log('\n--- 1. HOME HERO AUDIT ---');
  const heroMetrics = await page.evaluate(() => {
    const hero = document.querySelector('.hero-card');
    const heroRect = hero ? hero.getBoundingClientRect() : null;
    const windowHeight = window.innerHeight;
    const nextSection = document.querySelector('#page-home h2');
    const nextSectionRect = nextSection ? nextSection.getBoundingClientRect() : null;

    return {
      heroHeight: heroRect ? heroRect.height : null,
      heroTop: heroRect ? heroRect.top : null,
      heroBottom: heroRect ? heroRect.bottom : null,
      windowHeight,
      nextSectionTop: nextSectionRect ? nextSectionRect.top : null,
      nextSectionVisible: nextSectionRect ? nextSectionRect.top < windowHeight : false
    };
  });

  console.log('Hero Card Metrics:', heroMetrics);
  console.log(`Hero Height: ${heroMetrics.heroHeight.toFixed(1)}px (Viewport: ${heroMetrics.windowHeight}px)`);
  console.log(`Next section visible on first screen: ${heroMetrics.nextSectionVisible ? 'YES (Naturally balanced)' : 'NO'}`);

  // 2. SPOTLIGHT REMOVAL FROM HOME & PRESENCE IN ADVANCED
  console.log('\n--- 2. SPOTLIGHT RELOCATION AUDIT ---');
  const spotlightAudit = await page.evaluate(() => {
    const homeSpotlight = document.querySelector('#page-home .latent-escape-spotlight-wrapper, #page-home .latent-spotlight-card');
    const advSpotlight = document.querySelector('#page-advanced .latent-escape-spotlight-wrapper, #page-advanced .latent-spotlight-card');
    const advTabLatent = document.querySelector('#adv-tab-latent-risk .latent-spotlight-card');

    return {
      existsInHome: !!homeSpotlight,
      existsInAdvanced: !!advSpotlight,
      existsInLatentRiskTab: !!advTabLatent
    };
  });

  console.log('Spotlight Relocation Audit:', spotlightAudit);
  console.log(`Removed from Home: ${!spotlightAudit.existsInHome ? '✔ PASS' : '❌ FAIL'}`);
  console.log(`Present in Advanced Latent Risk: ${spotlightAudit.existsInLatentRiskTab ? '✔ PASS' : '❌ FAIL'}`);

  // 3. SINGLE WAFER VISUALIZATION & DYNAMIC SWITCHER AUDIT
  console.log('\n--- 3. SINGLE WAFER DYNAMIC LOT SWITCHER AUDIT ---');
  const waferAudit = await page.evaluate(() => {
    const waferSvgs = document.querySelectorAll('#page-home #home-single-wafer-svg, #page-home svg.hero-chip-svg-wrap');
    const allWafers = document.querySelectorAll('#page-home #home-single-wafer-svg-wrap svg');
    const selector = document.getElementById('home-wafer-lot-selector');
    const options = selector ? Array.from(selector.options).map(o => o.value) : [];

    return {
      singleWaferSvgCount: allWafers.length,
      selectorOptions: options,
      initialYield: document.getElementById('home-wafer-yield-val')?.textContent?.trim(),
      initialPass: document.getElementById('home-wafer-pass-count')?.textContent?.trim(),
      initialRej: document.getElementById('home-wafer-rej-count')?.textContent?.trim()
    };
  });

  console.log('Single Wafer Audit:', waferAudit);
  console.log(`Exactly ONE Wafer Diagram in Home: ${waferAudit.singleWaferSvgCount === 1 ? '✔ PASS' : '❌ FAIL'}`);
  console.log(`Total Lot Choices available: ${waferAudit.selectorOptions.length} (${waferAudit.selectorOptions.join(', ')})`);

  // Test switching lot to LOT-SYN-044
  console.log('\nTesting Lot Switch to LOT-SYN-044...');
  await page.evaluate(() => {
    window.updateHomeWaferDisplay('LOT-SYN-044');
  });
  await new Promise(r => setTimeout(r, 400));

  const switchedAudit = await page.evaluate(() => {
    return {
      title: document.getElementById('home-wafer-title')?.textContent?.trim(),
      selectorVal: document.getElementById('home-wafer-lot-selector')?.value,
      yieldVal: document.getElementById('home-wafer-yield-val')?.textContent?.trim(),
      passCount: document.getElementById('home-wafer-pass-count')?.textContent?.trim(),
      monCount: document.getElementById('home-wafer-mon-count')?.textContent?.trim(),
      rejCount: document.getElementById('home-wafer-rej-count')?.textContent?.trim(),
      activePill: document.querySelector('.home-lot-pill.active')?.textContent?.trim()
    };
  });
  console.log('Switched Wafer State (LOT-SYN-044):', switchedAudit);
  console.log(`Wafer Title: "${switchedAudit.title}", Yield: "${switchedAudit.yieldVal}", Rejects: "${switchedAudit.rejCount}", Active Pill: "${switchedAudit.activePill}"`);

  // 4. SCREENSHOT CAPTURE
  console.log('\n--- 4. CAPTURING UPDATED SCREENSHOTS ---');
  const reportsDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  // Home Screenshot
  const homePath = path.join(reportsDir, 'home_compact_hero_and_single_wafer.png');
  await page.screenshot({ path: homePath, fullPage: false });
  console.log(`Saved screenshot: ${homePath}`);

  // Advanced Latent Risk Subtab Screenshot
  await page.evaluate(() => {
    window.switchPage('page-advanced');
    window.switchAdvancedTab('adv-tab-latent-risk');
  });
  await new Promise(r => setTimeout(r, 500));
  const advPath = path.join(reportsDir, 'advanced_latent_risk_with_spotlight.png');
  await page.screenshot({ path: advPath, fullPage: false });
  console.log(`Saved screenshot: ${advPath}`);

  // 5. CONSOLE ERRORS
  console.log('\n--- 5. CONSOLE ERRORS ---');
  console.log(`Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log('Errors:', consoleErrors);
  } else {
    console.log('✔ 0 Console Errors!');
  }

  console.log('\n=================================================================');
  console.log('ALL VERIFICATIONS COMPLETED! 🚀');
  console.log('=================================================================');

  await browser.close();
})();
