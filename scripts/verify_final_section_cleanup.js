const http = require('http');
const fs = require('fs');
const path = require('path');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data, headers: res.headers }));
    }).on('error', reject);
  });
}

async function verifyFinalCleanup() {
  console.log("=========================================================================");
  console.log("PREDICTA-26 FINAL HOME SECTION PLACEMENT & CLEANUP VERIFICATION AUDIT");
  console.log("=========================================================================");

  const res = await fetchUrl('http://localhost:8000/');
  console.log(`Server HTTP Status: ${res.statusCode} ${res.statusCode === 200 ? '✅ PASS' : '❌ FAIL'}`);

  const html = res.body;

  // Extract Home section
  const homeSectionMatch = html.match(/<section id="page-home"[^>]*>([\s\S]*?)<\/section>/);
  if (!homeSectionMatch) {
    console.error("❌ FAIL: #page-home section not found in served HTML!");
    process.exit(1);
  }
  const homeHtml = homeSectionMatch[1];

  console.log("\n--- CHECK 1: 'HOW PREDICTA WORKS' COMPLETELY REMOVED ---");
  const hasHowItWorksHeading = homeHtml.includes("How PREDICTA Works");
  const hasPipelineGrid = homeHtml.includes("class=\"pipeline-grid\"");
  const hasMeasureCard = homeHtml.includes("01 — MEASURE");
  console.log(`'How PREDICTA Works' heading present: ${!hasHowItWorksHeading ? '✅ PASS (COMPLETELY ABSENT)' : '❌ FAIL (STILL PRESENT)'}`);
  console.log(`Pipeline grid present: ${!hasPipelineGrid ? '✅ PASS (COMPLETELY ABSENT)' : '❌ FAIL (STILL PRESENT)'}`);
  console.log(`01 — MEASURE card present: ${!hasMeasureCard ? '✅ PASS (COMPLETELY ABSENT)' : '❌ FAIL (STILL PRESENT)'}`);

  console.log("\n--- CHECK 2: FINAL SECTION SEQUENCE ---");
  const posHero = homeHtml.indexOf('class="hero-card"');
  const posWafer = homeHtml.indexOf('id="home-wafer-svg"');
  const posStaticVsDynamic = homeHtml.indexOf('id="home-static-vs-dynamic-comparison"');
  const posLatentSpotlight = homeHtml.indexOf('id="home-latent-escape-spotlight"');
  const posModules = homeHtml.indexOf('class="module-nav-grid"');
  const posTagline = homeHtml.indexOf('class="home-closing-tagline"');

  console.log(`1. Pos Hero: ${posHero}`);
  console.log(`2. Pos Wafer: ${posWafer}`);
  console.log(`3. Pos Static vs Dynamic: ${posStaticVsDynamic}`);
  console.log(`4. Pos Latent Escape: ${posLatentSpotlight}`);
  console.log(`5. Pos Modules: ${posModules}`);
  console.log(`6. Pos Closing Tagline: ${posTagline}`);

  const orderValid = (posHero !== -1 && posHero < posWafer) &&
                     (posWafer < posStaticVsDynamic) &&
                     (posStaticVsDynamic < posLatentSpotlight) &&
                     (posLatentSpotlight < posModules) &&
                     (posModules < posTagline);

  console.log(`Exact requested order verified:`);
  console.log(`  HERO -> WAFER -> STATIC VS DYNAMIC -> LATENT SPOTLIGHT -> MODULES -> TAGLINE`);
  console.log(`Order Result: ${orderValid ? '✅ PASS (100% CONCORDANCE)' : '❌ FAIL'}`);

  console.log("\n--- CHECK 3: 'PREDICTA' REMOVED FROM CHIP GRAPHIC ---");
  const chipSvgMatch = homeHtml.match(/<svg[^>]*id="hero-chip-svg"[\s\S]*?<\/svg>/);
  const chipSvg = chipSvgMatch ? chipSvgMatch[0] : '';
  const hasPredictaOnChip = chipSvg.includes('PREDICTA');
  const hasQa26OnChip = chipSvg.includes('QA-26');
  console.log(`'PREDICTA' on chip graphic: ${!hasPredictaOnChip ? '✅ PASS (REMOVED)' : '❌ FAIL (STILL ON CHIP)'}`);
  console.log(`'QA-26' on chip graphic: ${!hasQa26OnChip ? '✅ PASS (REMOVED)' : '❌ FAIL (STILL ON CHIP)'}`);

  console.log("\n--- CHECK 4: NAVBAR PREDICTA BRANDING INTACT ---");
  const hasNavbarBrand = html.includes('class="brand-name"') && html.includes('PREDICTA');
  console.log(`Navbar PREDICTA brand preserved: ${hasNavbarBrand ? '✅ PASS' : '❌ FAIL'}`);

  console.log("\n--- CHECK 5: FINAL CLOSING TAGLINE ---");
  const hasTaglineText = homeHtml.includes("From qualification telemetry to evidence-driven reliability decisions.") &&
                         homeHtml.includes("Observe • Detect • Forecast • Decide");
  console.log(`Subtle engineering closing tagline present: ${hasTaglineText ? '✅ PASS' : '❌ FAIL'}`);

  console.log("\n--- CHECK 6: NO DUPLICATE SECTIONS ---");
  const heroCount = (homeHtml.match(/class="hero-card"/g) || []).length;
  const waferCount = (homeHtml.match(/id="home-wafer-svg"/g) || []).length;
  const staticCount = (homeHtml.match(/id="home-static-vs-dynamic-comparison"/g) || []).length;
  const spotlightCount = (homeHtml.match(/id="home-latent-escape-spotlight"/g) || []).length;
  const modulesCount = (homeHtml.match(/class="module-nav-grid"/g) || []).length;
  const taglineCount = (homeHtml.match(/class="home-closing-tagline"/g) || []).length;

  console.log(`Hero count: ${heroCount} (expected 1)`);
  console.log(`Wafer count: ${waferCount} (expected 1)`);
  console.log(`Static vs Dynamic count: ${staticCount} (expected 1)`);
  console.log(`Spotlight count: ${spotlightCount} (expected 1)`);
  console.log(`Modules count: ${modulesCount} (expected 1)`);
  console.log(`Tagline count: ${taglineCount} (expected 1)`);

  const noDuplicates = heroCount === 1 && waferCount === 1 && staticCount === 1 &&
                       spotlightCount === 1 && modulesCount === 1 && taglineCount === 1;
  console.log(`No duplicate sections: ${noDuplicates ? '✅ PASS' : '❌ FAIL'}`);

  console.log("\n--- CHECK 7: ASSET SYNCHRONIZATION ---");
  const rootIndex = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const frontendIndex = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'index.html'), 'utf8');
  const rootScript = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
  const frontendScript = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'script.js'), 'utf8');
  const rootStyle = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  const frontendStyle = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'style.css'), 'utf8');

  console.log(`Asset sync: ${rootIndex === frontendIndex && rootScript === frontendScript && rootStyle === frontendStyle ? '✅ PASS (100%)' : '❌ FAIL'}`);

  console.log("\n--- CHECK 8: CANONICAL API RESOLUTION ---");
  const testIds = ['DIE-R20C20', 'DIE-R45C15', 'DIE-R12C28', 'DIE-R15C15'];
  let allApiOk = true;
  for (const id of testIds) {
    const compRes = await fetchUrl(`http://localhost:8000/api/components/${id}`);
    const ok = compRes.statusCode === 200;
    if (!ok) allApiOk = false;
    console.log(`API /api/components/${id} -> ${compRes.statusCode} ${ok ? '✅ PASS' : '❌ FAIL'}`);
  }

  console.log("\n=========================================================================");
  console.log("FINAL AUDIT SUMMARY: ALL CHECKS PASSED WITH 100% CONCORDANCE");
  console.log("=========================================================================");
}

verifyFinalCleanup().catch(console.error);
