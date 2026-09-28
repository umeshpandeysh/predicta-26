const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const reportsDir = path.join(__dirname, '..', 'reports');

(async () => {
  console.log('=== AUDITING HERO CHIP CENTERING & MOTION IN CHROME ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    console.log('1. Loading http://localhost:8000/#page-home ...');
    await page.goto('http://localhost:8000/#page-home', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 400));

    // 1. Audit Centering Geometry
    const centeringInfo = await page.evaluate(() => {
      const card = document.getElementById('hero-chip-3d-card');
      const container = document.querySelector('.hero-chip-illustration-container');
      const svg = document.getElementById('hero-chip-svg');
      
      const cardRect = card.getBoundingClientRect();
      const contRect = container.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();

      const leftGapInCard = svgRect.left - cardRect.left;
      const rightGapInCard = cardRect.right - svgRect.right;
      const leftGapInCont = svgRect.left - contRect.left;
      const rightGapInCont = contRect.right - svgRect.right;

      return {
        cardWidth: cardRect.width,
        svgWidth: svgRect.width,
        leftGapInCard,
        rightGapInCard,
        diffCard: Math.abs(leftGapInCard - rightGapInCard),
        leftGapInCont,
        rightGapInCont,
        diffCont: Math.abs(leftGapInCont - rightGapInCont)
      };
    });

    console.log('   Centering Geometry:', centeringInfo);
    assert(centeringInfo.diffCont < 2, `Chip must be horizontally centered in illustration container! Diff: ${centeringInfo.diffCont}`);
    assert(centeringInfo.diffCard < 2, `Chip must be horizontally centered in card! Diff: ${centeringInfo.diffCard}`);

    // 2. Capture Hero chip at t = 0
    const heroCardElement = await page.$('.hero-card');
    await heroCardElement.screenshot({ path: path.join(reportsDir, 'hero_chip_motion_t0.png') });
    console.log('   ✔ Captured: reports/hero_chip_motion_t0.png');

    // 3. Wait 2.5s (peak of 5s float) and capture t = 2.5s
    await new Promise(r => setTimeout(r, 2500));
    await heroCardElement.screenshot({ path: path.join(reportsDir, 'hero_chip_motion_t2_5.png') });
    console.log('   ✔ Captured: reports/hero_chip_motion_t2_5.png');

    // 4. Test reduced motion
    console.log('2. Testing prefers-reduced-motion ...');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await new Promise(r => setTimeout(r, 300));
    const animReduced = await page.evaluate(() => {
      const group = document.querySelector('.hero-chip-floating-group');
      const cs = window.getComputedStyle(group);
      return cs.animationName;
    });
    console.log('   Reduced motion animation-name:', animReduced);
    assert(animReduced === 'none', 'Animation must be disabled under prefers-reduced-motion: reduce');

    // 5. Test responsive viewports
    console.log('3. Testing Responsive Viewports...');
    for (const width of [1024, 768, 390]) {
      await page.setViewport({ width, height: 844 });
      await new Promise(r => setTimeout(r, 200));
      const resInfo = await page.evaluate(() => {
        const svg = document.getElementById('hero-chip-svg');
        const container = document.querySelector('.hero-chip-illustration-container');
        const rect = svg.getBoundingClientRect();
        const contRect = container.getBoundingClientRect();
        return {
          svgWidth: rect.width,
          overflow: rect.width > contRect.width,
          diff: Math.abs((rect.left - contRect.left) - (contRect.right - rect.right))
        };
      });
      console.log(`   - Viewport ${width}px: SVG width=${resInfo.svgWidth.toFixed(1)}px, overflow=${resInfo.overflow}, centerDiff=${resInfo.diff.toFixed(2)}px`);
      assert(!resInfo.overflow, `No SVG overflow at ${width}px`);
      assert(resInfo.diff < 2, `Remains centered at ${width}px`);
    }

    console.log('Summary:');
    console.log('   Console Errors:', consoleErrors.length);
    assert(consoleErrors.length === 0, 'No console errors allowed');
    console.log('=== HERO CHIP CENTERING & MOTION AUDIT 100% PASSED ===');

  } catch (err) {
    console.error('Audit failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
