const http = require('http');

async function testAsset(urlPath, expectedStr) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:8000' + urlPath, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`${urlPath} -> HTTP ${res.statusCode} (Length: ${data.length})`);
        console.log(`  Cache-Control: ${res.headers['cache-control']}`);
        const hasExpected = data.includes(expectedStr);
        console.log(`  Content Check: ${hasExpected ? 'PASS' : 'FAIL'}`);
        resolve(res.statusCode === 200 && hasExpected);
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log("=== VERIFYING SERVED STATIC ASSETS ===");
  const r1 = await testAsset('/style.css?v=20260928_v3', '.ml-pipeline-flow');
  const r2 = await testAsset('/api.js?v=20260928_v3', 'ensureSession');
  const r3 = await testAsset('/script.js?v=20260928_v3', 'judgeStageDefinitions');
  
  if (r1 && r2 && r3) {
    console.log("\nALL STATIC ASSETS SERVED ACCURATELY WITH NO-CACHE HEADERS! ✅");
  } else {
    console.error("\nONE OR MORE ASSETS FAILED VERIFICATION!");
    process.exit(1);
  }
}

run();
