const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('=================================================================');
  console.log('PREDICTA — COMPREHENSIVE REFINEMENT AUDIT & BROWSER VERIFICATION');
  console.log('=================================================================');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => consoleErrors.push(err.toString()));

  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));

  // 1. NAVBAR ORDER AUDIT
  console.log('\n--- 1. NAVBAR ORDER AUDIT ---');
  const navItems = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('#topnav-menu .nav-link'));
    return links.map(l => ({
      text: l.textContent.trim(),
      page: l.getAttribute('data-page')
    }));
  });
  console.log('Rendered Navbar Order:', navItems);

  const expectedOrder = [
    { text: 'Home', page: 'page-home' },
    { text: 'Screening', page: 'page-screening' },
    { text: 'Components', page: 'page-components' },
    { text: 'Live Monitor', page: 'page-monitor' },
    { text: 'Advanced', page: 'page-advanced' }
  ];

  let orderCorrect = true;
  if (navItems.length !== expectedOrder.length) {
    orderCorrect = false;
  } else {
    for (let i = 0; i < expectedOrder.length; i++) {
      if (navItems[i].text !== expectedOrder[i].text || navItems[i].page !== expectedOrder[i].page) {
        orderCorrect = false;
        break;
      }
    }
  }
  console.log(`Navbar Order Test: ${orderCorrect ? '✔ PASS' : '❌ FAIL'}`);

  // 2. WORKSTATION ROUTING & CLEARANCE AUDIT
  console.log('\n--- 2. WORKSTATION ROUTING & CLEARANCE AUDIT ---');
  const pagesToTest = [
    { name: 'Home', pageId: 'page-home' },
    { name: 'Screening', pageId: 'page-screening' },
    { name: 'Components', pageId: 'page-components' },
    { name: 'Live Monitor', pageId: 'page-monitor' },
    { name: 'Advanced', pageId: 'page-advanced' }
  ];

  for (const pt of pagesToTest) {
    await page.evaluate(id => window.switchPage(id), pt.pageId);
    await new Promise(r => setTimeout(r, 400));

    const audit = await page.evaluate((pId) => {
      const activeLink = document.querySelector('#topnav-menu .nav-link.active');
      const activePage = document.querySelector('.page-view.active');
      const header = document.querySelector('.topnav');
      const headerBottom = header ? header.getBoundingClientRect().bottom : 64;

      const firstContent = activePage ? activePage.querySelector('h1, h2, h3, .hero-card, .card, .page-header, .tab-bar') : null;
      const contentTop = firstContent ? firstContent.getBoundingClientRect().top : 0;
      const clearance = contentTop - headerBottom;

      const hasHorizontalScroll = document.documentElement.scrollWidth > window.innerWidth;

      return {
        activeLinkText: activeLink ? activeLink.textContent.trim() : null,
        activePageId: activePage ? activePage.id : null,
        headerBottom,
        contentTop,
        clearance,
        hasHorizontalScroll
      };
    }, pt.pageId);

    console.log(`[${pt.name}] Active Link: "${audit.activeLinkText}", Active Section: "#${audit.activePageId}", Clearance: ${audit.clearance.toFixed(1)}px (Top: ${audit.contentTop.toFixed(1)}px, HeaderBottom: ${audit.headerBottom.toFixed(1)}px), H-Scroll: ${audit.hasHorizontalScroll ? 'OVERFLOW ❌' : 'CLEAN ✔'}`);
  }

  // 3. DECISION COMMAND PANEL AUDIT (SCREENING PAGE)
  console.log('\n--- 3. GOVERNED QUALIFICATION DECISION PANEL AUDIT ---');
  await page.evaluate(() => window.switchPage('page-screening'));
  await new Promise(r => setTimeout(r, 500));

  // Run PASS Test Case
  await page.select('#adm-in-comp-id', 'DIE-R15C15');
  await page.select('#adm-in-lot-id', 'LOT-SYN-043');
  await page.type('#adm-in-temp', '25.0');
  await page.type('#adm-in-voltage', '1.20');
  await page.type('#adm-in-freq', '2500');
  await page.type('#adm-in-duration', '24');
  await page.type('#adm-in-iddq', '10.7');
  await page.type('#adm-in-leakage', '111.7');
  await page.type('#adm-in-tpd', '10.98');
  await page.type('#adm-in-power', '45.0');
  await page.click('#btn-adm-in-submit');

  await page.waitForFunction(() => {
    const el = document.getElementById('adm-in-result-content');
    return el && window.getComputedStyle(el).display === 'block';
  }, { timeout: 10000 });

  const passDecisionAudit = await page.evaluate(() => {
    return {
      comp: document.getElementById('adm-in-res-comp')?.textContent?.trim(),
      lot: document.getElementById('adm-in-res-lot')?.textContent?.trim(),
      badge: document.getElementById('adm-in-res-badge')?.textContent?.trim(),
      subbadge: document.getElementById('adm-in-res-subbadge')?.textContent?.trim(),
      summary: document.getElementById('adm-in-res-summary')?.textContent?.trim(),
      primarySignal: document.getElementById('adm-in-res-primary-signal')?.textContent?.trim(),
      riskVal: document.getElementById('adm-in-res-risk-val')?.textContent?.trim(),
      gprVal: document.getElementById('adm-in-res-gpr-val')?.textContent?.trim(),
      action: document.getElementById('adm-in-res-action-text')?.textContent?.trim(),
      policy: document.getElementById('adm-in-res-policy-text')?.textContent?.trim(),
      popStat: document.getElementById('strip-pop-status')?.textContent?.trim(),
      tempStat: document.getElementById('strip-temp-status')?.textContent?.trim(),
      fcStat: document.getElementById('strip-fc-status')?.textContent?.trim(),
      riskStat: document.getElementById('strip-risk-status')?.textContent?.trim(),
      physStat: document.getElementById('strip-phys-status')?.textContent?.trim()
    };
  });
  console.log('PASS Decision Workspace State:', passDecisionAudit);

  // Run REJECT Test Case
  await page.select('#adm-in-comp-id', 'DIE-R20C20');
  await page.select('#adm-in-lot-id', 'LOT-SYN-044');
  await page.click('#btn-adm-in-submit');
  await new Promise(r => setTimeout(r, 600));

  const rejectDecisionAudit = await page.evaluate(() => {
    return {
      comp: document.getElementById('adm-in-res-comp')?.textContent?.trim(),
      lot: document.getElementById('adm-in-res-lot')?.textContent?.trim(),
      badge: document.getElementById('adm-in-res-badge')?.textContent?.trim(),
      subbadge: document.getElementById('adm-in-res-subbadge')?.textContent?.trim(),
      summary: document.getElementById('adm-in-res-summary')?.textContent?.trim(),
      primarySignal: document.getElementById('adm-in-res-primary-signal')?.textContent?.trim(),
      riskVal: document.getElementById('adm-in-res-risk-val')?.textContent?.trim(),
      action: document.getElementById('adm-in-res-action-text')?.textContent?.trim(),
      policy: document.getElementById('adm-in-res-policy-text')?.textContent?.trim(),
      popStat: document.getElementById('strip-pop-status')?.textContent?.trim(),
      riskStat: document.getElementById('strip-risk-status')?.textContent?.trim()
    };
  });
  console.log('REJECT Decision Workspace State:', rejectDecisionAudit);

  // 4. "BENCHMARK" WORD ABSENCE AUDIT ACROSS ALL DOM
  console.log('\n--- 4. "BENCHMARK" WORD ABSENCE AUDIT ---');
  const benchmarkAudit = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const matches = [];
    let node;
    while ((node = walker.nextNode())) {
      const txt = node.nodeValue || '';
      if (/benchmark/i.test(txt)) {
        const parent = node.parentElement;
        if (parent && parent.tagName !== 'SCRIPT' && parent.tagName !== 'STYLE') {
          matches.push({
            tag: parent.tagName,
            id: parent.id,
            className: parent.className,
            text: txt.trim()
          });
        }
      }
    }
    return matches;
  });

  console.log(`Visible "BENCHMARK" Occurrences Found: ${benchmarkAudit.length}`);
  if (benchmarkAudit.length > 0) {
    console.log('Matches:', benchmarkAudit);
  } else {
    console.log('✔ ZERO "BENCHMARK" occurrences found in user-facing UI!');
  }

  // 5. CAPTURE AUDIT SCREENSHOTS
  console.log('\n--- 5. CAPTURING AUDIT SCREENSHOTS ---');
  const reportsDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  for (const pt of pagesToTest) {
    await page.evaluate(id => window.switchPage(id), pt.pageId);
    await new Promise(r => setTimeout(r, 400));
    const ssPath = path.join(reportsDir, `verified_page_${pt.pageId}.png`);
    await page.screenshot({ path: ssPath, fullPage: false });
    console.log(`Saved screenshot: ${ssPath}`);
  }

  // Capture Decision Panel specifically
  await page.evaluate(() => window.switchPage('page-screening'));
  await new Promise(r => setTimeout(r, 400));
  const decElement = await page.$('.decision-command-panel');
  if (decElement) {
    const decPath = path.join(reportsDir, 'verified_decision_workspace.png');
    await decElement.screenshot({ path: decPath });
    console.log(`Saved screenshot: ${decPath}`);
  }

  // 6. CONSOLE ERRORS SUMMARY
  console.log('\n--- 6. CONSOLE ERRORS AUDIT ---');
  console.log(`Console Errors count: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log('Errors:', consoleErrors);
  } else {
    console.log('✔ 0 Console Errors!');
  }

  console.log('\n=================================================================');
  console.log('AUDIT COMPLETED SUCCESSFULLY! 🚀');
  console.log('=================================================================');

  await browser.close();
})();
