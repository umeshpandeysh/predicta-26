const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const path = require('path');

function getFileSha(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function getServedSha(urlPath) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:8000' + urlPath, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const hash = crypto.createHash('sha256').update(buf).digest('hex');
        resolve({ status: res.statusCode, length: buf.length, hash, content: buf.toString('utf8') });
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log("=========================================================================");
  console.log("PREDICTA-26 — LOCALHOST SERVED VS FILESYSTEM INTEGRITY CHECK");
  console.log("=========================================================================\n");

  const files = [
    { name: 'index.html', rel: 'index.html', url: '/' },
    { name: 'style.css', rel: 'style.css', url: '/style.css' },
    { name: 'script.js', rel: 'script.js', url: '/script.js' },
    { name: 'api.js', rel: 'api.js', url: '/api.js' }
  ];

  for (const f of files) {
    const absPath = path.resolve(__dirname, '..', f.rel);
    const fsHash = getFileSha(absPath);
    const served = await getServedSha(f.url);
    const match = fsHash === served.hash;

    console.log(`FILE: ${f.name}`);
    console.log(`  Absolute Path:   ${absPath}`);
    console.log(`  Filesystem SHA:  ${fsHash}`);
    console.log(`  Served SHA:      ${served.hash}`);
    console.log(`  Served Status:   HTTP ${served.status} (${served.length} bytes)`);
    console.log(`  MATCH:           ${match ? 'YES ✅' : 'NO ❌'}`);
    console.log();
  }
}

main();
