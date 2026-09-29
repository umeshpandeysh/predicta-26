const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_DIR = path.join(__dirname, '..', 'TEMP_PRE_TYPOGRAPHY_TEST');
const PORT = 8001;

// Simple static server
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0].split('#')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(TEMP_DIR, reqPath);
  
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, async () => {
  console.log(`Temporary server running on http://localhost:${PORT}`);
  
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960 });

  try {
    console.log(`Navigating to http://localhost:${PORT}/#page-advanced ...`);
    await page.goto(`http://localhost:${PORT}/#page-advanced`, { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 600));

    console.log('Switching to Tab 7: Validation & Evidence...');
    await page.evaluate(() => {
      if (typeof window.switchAdvancedTab === 'function') {
        window.switchAdvancedTab('adv-tab-validation');
      }
    });
    await new Promise(r => setTimeout(r, 600));

    const outPath = path.join(__dirname, '..', 'reports', 'temp_test_validation.png');
    await page.screenshot({ path: outPath });
    console.log(`✔ Temporary browser screenshot captured at: ${outPath}`);
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    await browser.close();
    server.close();
    console.log('Temporary server closed.');
  }
});
