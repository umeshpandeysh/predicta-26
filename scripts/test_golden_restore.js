const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');

function computeSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

async function runRestoreTest() {
  console.log('=== RUNNING DETERMINISTIC GOLDEN RESTORE AUDIT ===');
  
  const manifestPath = path.resolve('frontend/GOLDEN_STATE_MANIFEST.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Manifest not found at ' + manifestPath);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const goldenDir = path.resolve('frontend/GOLDEN_STATE');
  const tempDir = path.resolve('temp_restore_test_sandbox');
  
  console.log('1. Setting up temporary sandbox directory:', tempDir);
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });
  
  // Create mock corrupted / dirty files in sandbox
  fs.writeFileSync(path.join(tempDir, 'index.html'), 'CORRUPTED FILE');
  fs.writeFileSync(path.join(tempDir, 'style.css'), '/* CORRUPTED */');
  
  console.log('2. Simulating restore procedure into sandbox...');
  for (const item of manifest.files) {
    const srcFile = path.join(goldenDir, item.relative_path);
    const destFile = path.join(tempDir, item.relative_path);
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.copyFileSync(srcFile, destFile);
  }
  
  console.log('3. Auditing bitwise SHA-256 integrity of restored sandbox...');
  let totalMatches = 0;
  for (const item of manifest.files) {
    const destFile = path.join(tempDir, item.relative_path);
    const actualSha = computeSha256(destFile);
    if (actualSha !== item.sha256) {
      throw new Error(`Integrity check FAILED for ${item.relative_path}: expected ${item.sha256}, got ${actualSha}`);
    }
    console.log(`   ✔ ${item.relative_path}: SHA256 MATCH (${actualSha.substring(0, 16)}...)`);
    totalMatches++;
  }
  
  console.log(`4. Verified all ${totalMatches}/${manifest.files.length} files bit-for-bit identical.`);
  
  // 5. Test serving sandbox via isolated HTTP server
  console.log('5. Testing sandbox serving on ephemeral port...');
  const server = http.createServer((req, res) => {
    let reqUrl = req.url.split('?')[0];
    if (reqUrl === '/' || reqUrl === '') reqUrl = '/index.html';
    const filePath = path.join(tempDir, reqUrl);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const mimeTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json'
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  
  await new Promise(resolve => server.listen(8765, resolve));
  console.log('   Sandbox test server listening on http://localhost:8765');
  
  // Fetch files from sandbox server
  async function fetchSandbox(urlPath) {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:8765${urlPath}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      }).on('error', reject);
    });
  }
  
  const resIndex = await fetchSandbox('/index.html');
  const resStyle = await fetchSandbox('/style.css');
  const resScript = await fetchSandbox('/script.js');
  const resApi = await fetchSandbox('/api.js');
  const resSample = await fetchSandbox('/data/sample/lot_summary.json');
  
  if (resIndex.status !== 200 || !resIndex.data.includes('PREDICTA-BUILD-2026')) {
    throw new Error('Sandbox index.html serving failed');
  }
  if (resStyle.status !== 200 || !resStyle.data.includes('hero-chip-floating-group')) {
    throw new Error('Sandbox style.css serving failed');
  }
  if (resScript.status !== 200 || resApi.status !== 200 || resSample.status !== 200) {
    throw new Error('Sandbox asset serving failed');
  }
  
  console.log('   ✔ Sandbox HTTP verification 100% successful.');
  
  await new Promise(resolve => server.close(resolve));
  console.log('   Sandbox test server closed.');
  
  // Cleanup sandbox
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('6. Cleaned up sandbox directory.');
  console.log('\n=== GOLDEN RESTORE AUDIT: 100% SUCCESS ===');
}

runRestoreTest().catch(err => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
