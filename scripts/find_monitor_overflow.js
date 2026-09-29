const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function findOverflowElement() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('http://localhost:8000/#page-monitor', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));

  const overflowElements = await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const elements = document.querySelectorAll('#page-monitor *');
    const culprits = [];
    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      if (rect.right > docWidth) {
        culprits.push({
          tag: el.tagName,
          id: el.id,
          className: el.className,
          text: el.innerText ? el.innerText.substring(0, 40) : '',
          rectRight: rect.right,
          overflowBy: rect.right - docWidth,
          fontSize: window.getComputedStyle(el).fontSize,
          inlineStyle: el.getAttribute('style') || ''
        });
      }
    }
    return culprits;
  });

  console.log('=== OVERFLOW CULPRITS ON #page-monitor (390px) ===');
  console.log(overflowElements.slice(0, 10));
  await browser.close();
}

findOverflowElement();
