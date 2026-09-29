const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const reportsDir = path.join(__dirname, '..', 'reports');

(async () => {
  console.log('=== AUDITING REFINED COLOR SYSTEM ACROSS ALL 5 WORKSTATIONS ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const pagesToTest = [
    { id: 'page-home', name: 'Home', btnId: 'btn-nav-home' },
    { id: 'page-screening', name: 'Screening', btnId: 'btn-nav-screening' },
    { id: 'page-monitor', name: 'Live Monitor', btnId: 'btn-nav-monitor' },
    { id: 'page-components', name: 'Components', btnId: 'btn-nav-components' },
    { id: 'page-advanced', name: 'Advanced', btnId: 'btn-nav-advanced' }
  ];

  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  for (const p of pagesToTest) {
    console.log(`\nAuditing Workstation: ${p.name}...`);
    await page.evaluate((pid) => {
      window.switchPage(pid);
    }, p.id);
    await new Promise(r => setTimeout(r, 500));

    // Audit Badges & Status Colors on the page
    const pageColorAudit = await page.evaluate((pid) => {
      const section = document.getElementById(pid);
      if (!section) return { error: 'Section not found' };

      const badges = Array.from(section.querySelectorAll('.badge, [class*="badge"]')).map(b => {
        const style = window.getComputedStyle(b);
        return {
          text: b.innerText.trim(),
          color: style.color,
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor
        };
      });

      const topnav = document.querySelector('.topnav');
      const topnavStyle = window.getComputedStyle(topnav);

      const sectionStyle = window.getComputedStyle(section);

      return {
        badgeCount: badges.length,
        sampleBadges: badges.slice(0, 5),
        topnavBg: topnavStyle.backgroundColor,
        sectionBg: sectionStyle.backgroundColor
      };
    }, p.id);

    console.log(`  Metrics for ${p.name}:`, pageColorAudit);

    const shotPath = path.join(reportsDir, `refined_color_${p.id}.png`);
    await page.screenshot({ path: shotPath });
    console.log(`  ✔ Screenshot saved: ${shotPath}`);
  }

  await browser.close();
  console.log('\n=== COLOR SYSTEM AUDIT 100% COMPLETE ===');
})();
