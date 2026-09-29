const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function verifyNavbar() {
  console.log('=== AUDITING ENHANCED DARK BLUE 3D NAVBAR IN CHROME ===');
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

  // 1. Audit Navbar Dimensions & Centering
  const navMetrics = await page.evaluate(() => {
    const topnav = document.querySelector('.topnav');
    const container = document.querySelector('.topnav-container');
    const brand = document.querySelector('.brand-section');
    const brandName = document.querySelector('.brand-name');
    const brandSub = document.querySelector('.brand-sub');
    const menu = document.querySelector('.topnav-menu');
    const activeLink = document.querySelector('.nav-link.active');
    const allLinks = [...document.querySelectorAll('.nav-link')];

    const contRect = container.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const brandRect = brand.getBoundingClientRect();

    const leftSpace = menuRect.left - contRect.left;
    const rightSpace = contRect.right - menuRect.right;
    const centeringDelta = Math.abs(leftSpace - rightSpace);

    return {
      navbarHeight: topnav.getBoundingClientRect().height,
      brandNameSize: window.getComputedStyle(brandName).fontSize,
      brandNameWeight: window.getComputedStyle(brandName).fontWeight,
      brandSubSize: window.getComputedStyle(brandSub).fontSize,
      brandSubColor: window.getComputedStyle(brandSub).color,
      navLinkSize: window.getComputedStyle(allLinks[0]).fontSize,
      activeLinkBg: window.getComputedStyle(activeLink).backgroundImage || window.getComputedStyle(activeLink).backgroundColor,
      activeLinkColor: window.getComputedStyle(activeLink).color,
      centeringDelta,
      containerWidth: contRect.width,
      menuWidth: menuRect.width
    };
  });

  console.log('Navbar Metrics:', navMetrics);

  // Capture navbar close-up screenshot
  const navbarElement = await page.$('.topnav');
  const navScreenshotPath = path.resolve('reports/navbar_dark_blue_3d.png');
  await navbarElement.screenshot({ path: navScreenshotPath });
  console.log('✔ Captured close-up navbar screenshot:', navScreenshotPath);

  // Capture full page screenshot
  const pageScreenshotPath = path.resolve('reports/navbar_page_home.png');
  await page.screenshot({ path: pageScreenshotPath });
  console.log('✔ Captured full home page screenshot:', pageScreenshotPath);

  // 2. Responsive Check
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
    if (overflow.hasOverflow) {
      throw new Error(`Overflow on viewport ${vp.name}`);
    }
  }

  // 3. Test Navigation Routing on dark navbar
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

  console.log('Console Errors:', consoleErrors.length);
  await browser.close();
  console.log('\n=== NAVBAR ENHANCEMENT AUDIT: 100% PASSED ===');
}

verifyNavbar().catch(err => {
  console.error('Navbar audit failed:', err);
  process.exit(1);
});
