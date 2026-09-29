const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function verifyBlueNavbar() {
  console.log('=== AUDITING CLEAN PROFESSIONAL BLUE FIXED NAVBAR IN CHROME ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('http://localhost:8000/#page-home', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));

  // 1. Audit Navbar Metrics
  const navMetrics = await page.evaluate(() => {
    const topnav = document.querySelector('.topnav');
    const container = document.querySelector('.topnav-container');
    const brandName = document.querySelector('.brand-name');
    const brandSub = document.querySelector('.brand-sub');
    const activeLink = document.querySelector('.nav-link.active');
    const allLinks = [...document.querySelectorAll('.nav-link')];

    const contRect = container.getBoundingClientRect();
    const menuRect = document.querySelector('.topnav-menu').getBoundingClientRect();
    const leftSpace = menuRect.left - contRect.left;
    const rightSpace = contRect.right - menuRect.right;
    const centeringDelta = Math.abs(leftSpace - rightSpace);

    return {
      position: window.getComputedStyle(topnav).position,
      top: window.getComputedStyle(topnav).top,
      zIndex: window.getComputedStyle(topnav).zIndex,
      navbarHeight: topnav.getBoundingClientRect().height,
      brandNameSize: window.getComputedStyle(brandName).fontSize,
      brandNameWeight: window.getComputedStyle(brandName).fontWeight,
      brandNameColor: window.getComputedStyle(brandName).color,
      brandSubSize: window.getComputedStyle(brandSub).fontSize,
      navLinkSize: window.getComputedStyle(allLinks[0]).fontSize,
      activeLinkBg: window.getComputedStyle(activeLink).backgroundColor,
      activeLinkColor: window.getComputedStyle(activeLink).color,
      centeringDelta
    };
  });

  console.log('Navbar Metrics:', navMetrics);

  // Capture close-up screenshot
  const navbarElement = await page.$('.topnav');
  const navScreenshotPath = path.resolve('reports/navbar_clean_blue_fixed.png');
  await navbarElement.screenshot({ path: navScreenshotPath });
  console.log('✔ Captured navbar close-up screenshot:', navScreenshotPath);

  // Capture full un-scrolled page
  const homeScreenshotPath = path.resolve('reports/page_home_blue_navbar.png');
  await page.screenshot({ path: homeScreenshotPath });
  console.log('✔ Captured full home screenshot:', homeScreenshotPath);

  // 2. Test Sticky/Fixed Scrolling
  console.log('\nTesting scrolling behavior...');
  await page.evaluate(() => window.scrollBy(0, 600));
  await new Promise(r => setTimeout(r, 400));

  const scrollMetrics = await page.evaluate(() => {
    const topnav = document.querySelector('.topnav');
    const rect = topnav.getBoundingClientRect();
    return {
      scrollY: window.scrollY,
      navTop: rect.top,
      navVisible: rect.height > 0 && rect.top === 0
    };
  });

  console.log('Scroll Metrics:', scrollMetrics);
  if (scrollMetrics.scrollY < 500 || !scrollMetrics.navVisible) {
    throw new Error('Fixed/Sticky navbar scroll test FAILED');
  }

  const scrolledScreenshotPath = path.resolve('reports/page_home_blue_navbar_scrolled.png');
  await page.screenshot({ path: scrolledScreenshotPath });
  console.log('✔ Captured scrolled page screenshot:', scrolledScreenshotPath);

  // Scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 300));

  // 3. Responsive Check
  const viewports = [
    { name: 'Tablet (1024px)', width: 1024, height: 768 },
    { name: 'Tablet Small (768px)', width: 768, height: 1024 },
    { name: 'Mobile (390px)', width: 390, height: 844 }
  ];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise(r => setTimeout(r, 300));
    const overflow = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const scrollW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      return { docW, scrollW, hasOverflow: scrollW > docW + 1 };
    });
    console.log(`  - Viewport ${vp.name}: hasOverflow=${overflow.hasOverflow} (doc: ${overflow.docW}px, scroll: ${overflow.scrollW}px)`);
    if (overflow.hasOverflow) throw new Error(`Overflow detected on viewport ${vp.name}`);
  }

  // 4. Test Navigation Routing on blue navbar
  const pagesToTest = ['page-screening', 'page-monitor', 'page-components', 'page-advanced', 'page-home'];
  for (const p of pagesToTest) {
    await page.evaluate((targetPage) => {
      window.switchPage(targetPage);
    }, p);
    await new Promise(r => setTimeout(r, 300));
    const isTargetVisible = await page.evaluate((targetPage) => {
      const el = document.getElementById(targetPage);
      return el && !el.classList.contains('hidden') && el.style.display !== 'none';
    }, p);
    console.log(`  - Switched to #${p}: Active=${isTargetVisible}`);
    if (!isTargetVisible) throw new Error(`Failed to switch to ${p}`);
  }

  console.log('\nConsole Errors:', consoleErrors.length);
  await browser.close();
  console.log('\n=== BLUE FIXED NAVBAR AUDIT 100% PASSED ===');
}

verifyBlueNavbar().catch(err => {
  console.error('Navbar audit failed:', err);
  process.exit(1);
});
