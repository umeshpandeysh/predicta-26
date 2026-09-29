const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function getLocalHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function fetchServed(urlPath) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:8000' + urlPath, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const hash = crypto.createHash('sha256').update(buf).digest('hex');
        resolve({
          statusCode: res.statusCode,
          contentType: res.headers['content-type'],
          contentLength: buf.length,
          hash: hash,
          sample: buf.toString('utf8').slice(0, 200)
        });
      });
    }).on('error', reject);
  });
}

async function verifyServedFiles() {
  console.log('=== PHASE 8: VERIFYING SERVED FILES VS LOCAL FILES ===\n');

  const files = [
    { url: '/', local: 'index.html' },
    { url: '/index.html', local: 'index.html' },
    { url: '/style.css', local: 'style.css' },
    { url: '/script.js', local: 'script.js' },
    { url: '/synth_script.js', local: 'synth_script.js' }
  ];

  let allMatch = true;

  for (const f of files) {
    const localHash = getLocalHash(f.local);
    const served = await fetchServed(f.url);
    const matches = localHash === served.hash;

    console.log(`URL: ${f.url}`);
    console.log(`  Local file: ${f.local}`);
    console.log(`  Local SHA256:  ${localHash}`);
    console.log(`  Served SHA256: ${served.hash}`);
    console.log(`  Status Code:   ${served.statusCode}`);
    console.log(`  Content-Type:  ${served.contentType}`);
    console.log(`  Byte match:    ${matches ? '✅ YES' : '❌ NO'}`);
    console.log('');

    if (!matches) {
      allMatch = false;
    }
  }

  console.log(`Overall File Match: ${allMatch ? '✅ 100% MATCH' : '❌ MISMATCH DETECTED'}`);
}

verifyServedFiles().catch(console.error);
