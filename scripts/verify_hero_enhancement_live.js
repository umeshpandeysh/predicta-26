const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  console.log('=== PREDICTA: AUDITING HERO TITLE, CHIP SIZE & MOTION IN LIVE BROWSER ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Load Home Page
  await page.goto('http://localhost:8000/#page-home', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  // 2. Audit Title Size & Typography
  const titleMetrics = await page.evaluate(() => {
    const el = document.querySelector('.hero-card h1.page-title');
    if (!el) return null;
    const style = window.getComputedStyle(el);
    return {
      text: el.innerText.trim(),
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      color: style.color,
      fontFamily: style.fontFamily,
      rect: el.getBoundingClientRect()
    };
  });
  console.log('1. Hero Title Metrics:', titleMetrics);

  if (!titleMetrics || parseFloat(titleMetrics.fontSize) < 32) {
    console.error('❌ Hero title is not noticeably larger!');
    process.exit(1);
  }
  console.log('✔ PASSED: Hero title is prominent with font-size:', titleMetrics.fontSize);

  // 3. Audit Removed Text Below Chip
  const removedTextCheck = await page.evaluate(() => {
    const heroCard = document.querySelector('.hero-card');
    const fullText = heroCard ? heroCard.innerText : '';
    const hasDetectEarly = fullText.includes('Detect Early');
    const hasPredictDrift = fullText.includes('Predict Drift');
    const hasGovernedDecision = fullText.includes('Governed Decision');
    const hasForecastDegradation = fullText.includes('Forecast degradation trajectory');
    return {
      hasDetectEarly,
      hasPredictDrift,
      hasGovernedDecision,
      hasForecastDegradation
    };
  });
  console.log('2. Removed Text Check (should all be false):', removedTextCheck);

  if (removedTextCheck.hasDetectEarly || removedTextCheck.hasPredictDrift || removedTextCheck.hasGovernedDecision) {
    console.error('❌ Chip callout text was not fully removed!');
    process.exit(1);
  }
  console.log('✔ PASSED: Chip-side text (Detect Early, Predict Drift, Governed Decision) successfully removed.');

  // 4. Audit Chip Size & Centering
  const chipMetrics = await page.evaluate(() => {
    const chipContainer = document.querySelector('.hero-chip-card');
    const svg = document.querySelector('#hero-chip-svg');
    const cRect = chipContainer.getBoundingClientRect();
    const sRect = svg.getBoundingClientRect();
    const leftGap = sRect.left - cRect.left;
    const rightGap = cRect.right - sRect.right;
    return {
      svgWidth: sRect.width,
      svgHeight: sRect.height,
      containerWidth: cRect.width,
      leftGap,
      rightGap,
      diff: Math.abs(leftGap - rightGap)
    };
  });
  console.log('3. Chip Geometry & Dimensions:', chipMetrics);

  if (chipMetrics.svgWidth < 300) {
    console.error('❌ Chip is not noticeably larger (width < 300px on desktop)!');
    process.exit(1);
  }
  if (chipMetrics.diff > 2) {
    console.error('❌ Chip is not horizontally centered! Diff:', chipMetrics.diff);
    process.exit(1);
  }
  console.log('✔ PASSED: Chip is noticeably larger and perfectly centered.');

  // 5. Audit Background and Chip Animation
  const animationMetrics = await page.evaluate(() => {
    const heroCard = document.querySelector('.hero-card');
    const chipGroup = document.querySelector('.hero-chip-floating-group');
    const shadow = document.querySelector('.hero-chip-shadow');

    const heroCardStyle = window.getComputedStyle(heroCard);
    const chipGroupStyle = window.getComputedStyle(chipGroup);
    const shadowStyle = window.getComputedStyle(shadow);

    return {
      heroBgAnimation: heroCardStyle.animationName,
      heroBgDuration: heroCardStyle.animationDuration,
      chipAnimation: chipGroupStyle.animationName,
      chipDuration: chipGroupStyle.animationDuration,
      shadowAnimation: shadowStyle.animationName,
      shadowDuration: shadowStyle.animationDuration
    };
  });
  console.log('4. Animation Metrics:', animationMetrics);

  if (animationMetrics.heroBgAnimation === 'none' || animationMetrics.chipAnimation === 'none') {
    console.error('❌ Background or chip animations not active!');
    process.exit(1);
  }
  console.log('✔ PASSED: Hero background depth shift and floating chip motion active.');

  // 6. Test prefers-reduced-motion
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const reducedMotionMetrics = await page.evaluate(() => {
    const heroCard = document.querySelector('.hero-card');
    const chipGroup = document.querySelector('.hero-chip-floating-group');
    const heroCardStyle = window.getComputedStyle(heroCard);
    const chipGroupStyle = window.getComputedStyle(chipGroup);
    return {
      heroBgAnimation: heroCardStyle.animationName,
      chipAnimation: chipGroupStyle.animationName
    };
  });
  console.log('5. Reduced Motion Check:', reducedMotionMetrics);
  if (reducedMotionMetrics.chipAnimation !== 'none' || reducedMotionMetrics.heroBgAnimation !== 'none') {
    console.error('❌ prefers-reduced-motion did not disable animations!');
    process.exit(1);
  }
  console.log('✔ PASSED: prefers-reduced-motion correctly disables all animations.');

  // Reset media features
  await page.emulateMediaFeatures([]);

  // 7. Responsive Viewports & Overflow Test
  const viewports = [
    { width: 1440, height: 900, name: 'desktop_1440' },
    { width: 1024, height: 768, name: 'laptop_1024' },
    { width: 768, height: 1024, name: 'tablet_768' },
    { width: 390, height: 844, name: 'mobile_390' }
  ];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise(r => setTimeout(r, 400));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(`6. Viewport ${vp.width}x${vp.height} (${vp.name}): horizontal overflow = ${overflow}`);
    if (overflow) {
      console.error(`❌ Overflow detected on viewport ${vp.name}!`);
      process.exit(1);
    }
  }

  // 8. Capture Screenshot for Visual Verification
  await page.setViewport({ width: 1440, height: 900 });
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const heroCardElement = await page.$('.hero-card');
  if (heroCardElement) {
    await heroCardElement.screenshot({ path: path.join(reportsDir, 'enhanced_hero_live.png') });
    console.log('✔ Screenshot saved: reports/enhanced_hero_live.png');
  }

  await browser.close();
  console.log('\n=== HERO TITLE & CHIP ENHANCEMENT 100% VERIFIED ===');
})();
