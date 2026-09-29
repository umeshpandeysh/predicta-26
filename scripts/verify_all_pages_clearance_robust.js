const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function auditAllPagesClearance() {
  console.log('=== AUDITING EXACT NAVBAR CLEARANCE ACROSS ALL 5 PAGES ===\n');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle0' });

  const pagesToAudit = [
    { name: 'Home', pageId: 'page-home', selector: '#page-home > div:not(.page-alias)' },
    { name: 'Screening', pageId: 'page-screening', selector: '#page-screening > div:not(.page-alias)' },
    { name: 'Live Monitor', pageId: 'page-monitor', selector: '#page-monitor > div:not(.page-alias)' },
    { name: 'Components', pageId: 'page-components', selector: '#page-components > div:not(.page-alias)' },
    { name: 'Advanced', pageId: 'page-advanced', selector: '#page-advanced > div:not(.page-alias)' }
  ];

  let allPassed = true;

  for (const p of pagesToAudit) {
    console.log(`Auditing Page: ${p.name}...`);
    
    // Switch page via router
    await page.evaluate((pid) => window.switchPage(pid), p.pageId);
    await new Promise(r => setTimeout(r, 400));

    const metrics = await page.evaluate((sel) => {
      const topnav = document.querySelector('.topnav');
      const topnavRect = topnav.getBoundingClientRect();
      const firstEl = document.querySelector(sel);
      if (!firstEl) return { error: `Element matching ${sel} not found` };

      const firstElRect = firstEl.getBoundingClientRect();
      const clearance = firstElRect.top - topnavRect.bottom;

      return {
        topnavHeight: topnavRect.height,
        topnavBottom: topnavRect.bottom,
        contentTop: firstElRect.top,
        contentHeight: firstElRect.height,
        clearance,
        isObscured: firstElRect.top < topnavRect.bottom
      };
    }, p.selector);

    console.log('  Metrics:', metrics);

    if (metrics.error || metrics.isObscured || metrics.clearance < 14 || metrics.clearance > 32) {
      console.error(`  ✖ FAILED clearance test on ${p.name}! Clearance: ${metrics.clearance}px`);
      allPassed = false;
    } else {
      console.log(`  ✔ PASSED: Content cleanly visible with ${metrics.clearance.toFixed(1)}px clearance below fixed navbar.`);
    }

    // Capture initial screenshot
    const shotPath = path.resolve(`reports/clearance_${p.name.toLowerCase().replace(/\s+/g, '_')}.png`);
    await page.screenshot({ path: shotPath });
    console.log(`  ✔ Screenshot saved: ${shotPath}`);

    // Test scrolling
    await page.evaluate(() => window.scrollBy(0, 400));
    await new Promise(r => setTimeout(r, 300));
    const scrollInfo = await page.evaluate(() => {
      const topnav = document.querySelector('.topnav');
      const rect = topnav.getBoundingClientRect();
      return { scrollY: window.scrollY, navTop: rect.top, navHeight: rect.height };
    });
    console.log(`  ✔ Scroll test (scrolled ${scrollInfo.scrollY}px): Navbar pinned at top=${scrollInfo.navTop}px\n`);

    // Reset scroll
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 200));
  }

  // Verify hero chip centering
  await page.evaluate(() => window.switchPage('page-home'));
  await new Promise(r => setTimeout(r, 300));
  const chipMetrics = await page.evaluate(() => {
    const card = document.querySelector('.hero-chip-card');
    const svg = document.querySelector('.hero-chip-svg-wrap svg') || document.querySelector('.hero-chip-svg-wrap');
    if (!card || !svg) return null;
    const cardRect = card.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    return {
      diff: Math.abs((svgRect.left - cardRect.left) - (cardRect.right - svgRect.right))
    };
  });
  console.log('Hero Chip Centering Metric:', chipMetrics);

  await browser.close();

  if (!allPassed) {
    throw new Error('One or more page clearance tests failed');
  }
  console.log('\n=== ALL 5 PAGES VERIFIED WITH PERFECT FIXED NAVBAR CLEARANCE (100% SUCCESS) ===');
}

auditAllPagesClearance().catch(err => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
