const http = require('http');
const assert = require('assert');

async function getPage() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:8000/?verify=20260928V4', (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function verifyAll() {
  console.log("=========================================================================");
  console.log("PREDICTA-26 — LIVE DOM & ROUTE CONTENT VERIFICATION");
  console.log("=========================================================================\n");

  const { status, body } = await getPage();
  assert.strictEqual(status, 200, "Root must return HTTP 200");

  let total = 0;
  let passed = 0;

  function check(name, fn) {
    total++;
    try {
      fn();
      console.log(`✔ Check ${total} Passed: ${name} ✅`);
      passed++;
    } catch (e) {
      console.error(`✖ Check ${total} FAILED: ${name}`);
      console.error(`  Error: ${e.message}`);
    }
  }

  // 1. Build Marker
  check("Diagnostic build marker is visible in DOM", () => {
    assert.ok(body.includes('BUILD-20260928-V4'));
    assert.ok(body.includes('id="build-verify-badge-nav"'));
  });

  // 2. Navigation Structure
  check("Top navigation contains 6 clean tabs", () => {
    assert.ok(body.includes('data-page="page-home"'));
    assert.ok(body.includes('data-page="page-screening"'));
    assert.ok(body.includes('data-page="page-overview"'));
    assert.ok(body.includes('data-page="page-component"'));
    assert.ok(body.includes('data-page="page-judge-journey"'));
    assert.ok(body.includes('data-page="page-advanced"'));
  });

  // 3. Purged Content
  check("Purged SIH marketing, Problem Statement 170, and Admin Login", () => {
    assert.ok(!body.includes('Smart India Hackathon 2026'));
    assert.ok(!body.includes('Problem Statement 170'));
    assert.ok(!body.includes('Admin Login'));
    assert.ok(!body.includes('form-admin-login'));
  });

  // 4. Homepage Command Center
  check("Homepage renders Reliability Command Center & KPI HUD", () => {
    assert.ok(body.includes('Semiconductor Reliability Command Center'));
    assert.ok(body.includes('Native XGBoost C-API'));
    assert.ok(body.includes('Silicon Die Architecture &amp; Thermal Hotspots') || body.includes('Silicon Die Architecture'));
    assert.ok(body.includes('Priority Component Screening Queue'));
  });

  // 5. Screening View
  check("Screening view renders CSV Dropzone, Feature Derivation Banner & 8-Stage Pipeline", () => {
    assert.ok(body.includes('id="page-screening"'));
    assert.ok(body.includes('id="csv-upload-zone"'));
    assert.ok(body.includes('Derivation Pipeline:'));
    assert.ok(body.includes('id="pipe-input-status"'));
    assert.ok(body.includes('id="pipe-dq-status"'));
    assert.ok(body.includes('id="pipe-mod-a-status"'));
    assert.ok(body.includes('id="pipe-mod-b-status"'));
    assert.ok(body.includes('id="pipe-risk-status"'));
    assert.ok(body.includes('id="pipe-physics-status"'));
    assert.ok(body.includes('id="pipe-decision-status"'));
    assert.ok(body.includes('id="pipe-trace-status"'));
  });

  // 6. Live Monitor View
  check("Live Monitor renders 168h timeline replay and parametric telemetry curves", () => {
    assert.ok(body.includes('id="page-overview"'));
    assert.ok(body.includes('Burn-In Telemetry &amp; Degradation Stream') || body.includes('Burn-In Telemetry'));
    assert.ok(body.includes('id="live-time-slider"'));
  });

  // 7. Components Matrix & Passport Modal
  check("Components matrix renders inventory table and Reliability Passport Modal", () => {
    assert.ok(body.includes('id="page-component"'));
    assert.ok(body.includes('id="component-passport-modal"'));
    assert.ok(body.includes('SEMICONDUCTOR RELIABILITY PASSPORT'));
    assert.ok(body.includes('inspectPassportInLiveMonitor'));
    assert.ok(body.includes('generateQualificationReportPDF'));
  });

  // 8. Judge Journey
  check("Judge Journey renders 8-stage qualification walkthrough", () => {
    assert.ok(body.includes('id="page-judge-journey"'));
    assert.ok(body.includes('01. Ingestion'));
    assert.ok(body.includes('08. Traceability Case'));
  });

  // 9. Advanced Engineering Workstation
  check("Advanced workstation renders deep parameter subnav", () => {
    assert.ok(body.includes('id="page-advanced"'));
    assert.ok(body.includes('Advanced Reliability Modules &amp; Governance') || body.includes('Advanced Reliability Modules'));
    assert.ok(body.includes('switchAdvancedTab'));
  });

  console.log("\n=========================================================================");
  console.log(`RESULTS: ${passed}/${total} DOM & ROUTE VERIFICATION CHECKS PASSED!`);
  console.log("=========================================================================\n");

  if (passed !== total) process.exit(1);
}

verifyAll();
