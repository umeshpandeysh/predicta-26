const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function verifyLayoutIntegrity() {
  console.log('=== VERIFYING LAYOUT INTEGRITY AFTER FONT SIZE INCREASE ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  const viewports = [
    { name: 'Desktop (1440px)', width: 1440, height: 900 },
    { name: 'Tablet (1024px)', width: 1024, height: 768 },
    { name: 'Tablet Small (768px)', width: 768, height: 1024 },
    { name: 'Mobile (390px)', width: 390, height: 844 }
  ];

  const routes = ['#page-home', '#page-screening', '#page-monitor', '#page-components', '#page-advanced'];

  let totalErrors = 0;
  for (const vp of viewports) {
    console.log(`\nTesting Viewport: ${vp.name}...`);
    await page.setViewport({ width: vp.width, height: vp.height });

    for (const route of routes) {
      await page.goto(`http://localhost:8000/${route}`, { waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 400));

      // Check horizontal overflow
      const overflowInfo = await page.evaluate(() => {
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const bodyScrollWidth = document.body.scrollWidth;
        const maxScroll = Math.max(scrollWidth, bodyScrollWidth);
        const hasOverflow = maxScroll > docWidth + 1;
        return { docWidth, maxScroll, hasOverflow };
      });

      if (overflowInfo.hasOverflow) {
        console.error(`  ✖ OVERFLOW DETECTED on ${route} at ${vp.width}px: docWidth=${overflowInfo.docWidth}, scrollWidth=${overflowInfo.maxScroll}`);
        totalErrors++;
      } else {
        console.log(`  ✔ ${route} (width: ${vp.width}px): No overflow (doc: ${overflowInfo.docWidth}px, scroll: ${overflowInfo.maxScroll}px)`);
      }
    }
  }

  // Check Hero Chip Centering at 1440px
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:8000/#page-home', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));

  const chipMetrics = await page.evaluate(() => {
    const card = document.querySelector('.hero-chip-card');
    const svg = document.querySelector('.hero-chip-svg-wrap svg') || document.querySelector('.hero-chip-svg-wrap');
    if (!card || !svg) return null;
    const cardRect = card.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    return {
      cardWidth: cardRect.width,
      svgWidth: svgRect.width,
      leftGap: svgRect.left - cardRect.left,
      rightGap: cardRect.right - svgRect.right,
      diff: Math.abs((svgRect.left - cardRect.left) - (cardRect.right - svgRect.right))
    };
  });

  console.log('\nHero Chip Centering Metric:', chipMetrics);
  if (chipMetrics && chipMetrics.diff < 1.0) {
    console.log('✔ Hero chip remains perfectly centered.');
  } else {
    console.error('✖ Hero chip centering compromised!');
    totalErrors++;
  }

  // Capture updated screenshots of all pages
  for (const route of routes) {
    await page.goto(`http://localhost:8000/${route}`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 400));
    const filename = `reports/font_increased_${route.replace('#page-', '')}.png`;
    await page.screenshot({ path: path.resolve(filename) });
    console.log(`✔ Captured: ${filename}`);
  }

  await browser.close();

  console.log(`\n=== VERIFICATION FINISHED: ${totalErrors === 0 ? 'ALL CHECKS PASSED (0 ERRORS)' : `${totalErrors} ERRORS FOUND`} ===`);
  if (totalErrors > 0) process.exit(1);
}

verifyLayoutIntegrity().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
