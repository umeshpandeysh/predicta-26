const fs = require('fs');
const path = require('path');

console.log("=========================================================================");
console.log("PREDICTA — LIVE VERCEL END-TO-END WORKFLOW AUDIT & VERIFICATION");
console.log("=========================================================================\n");

async function runLiveVerification() {
  let total = 0;
  let passed = 0;

  function assert(cond, msg) {
    total++;
    if (cond) {
      console.log(`✔ Test ${total.toString().padStart(2, '0')} Passed: ${msg}`);
      passed++;
    } else {
      console.error(`✖ Test ${total.toString().padStart(2, '0')} FAILED: ${msg}`);
      process.exit(1);
    }
  }

  // 1. Fetch live Vercel HTML
  console.log("--- 1. AUDITING LIVE VERCEL DEPLOYMENT ROOT HTML ---");
  const htmlRes = await fetch('https://ceenew.vercel.app/');
  assert(htmlRes.status === 200, `Live website returned HTTP 200 OK (Status: ${htmlRes.status})`);
  
  const html = await htmlRes.text();
  assert(html.includes('id="btn-adm-clear-form"'), 'Live HTML contains #btn-adm-clear-form');
  assert(html.includes('id="btn-adm-analyze-another"'), 'Live HTML contains #btn-adm-analyze-another');

  // 2. Fetch live Vercel JavaScript
  console.log("\n--- 2. AUDITING LIVE VERCEL PRODUCTION SCRIPT.JS ---");
  const jsRes = await fetch('https://ceenew.vercel.app/script.js');
  assert(jsRes.status === 200, `Live script.js returned HTTP 200 OK (Status: ${jsRes.status})`);

  const js = await jsRes.text();
  assert(js.includes('function resetAdminQualificationWorkflow()'), 'Live script.js contains function resetAdminQualificationWorkflow()');
  assert(js.includes('window.resetAdminQualificationWorkflow = resetAdminQualificationWorkflow'), 'Live script.js exports window.resetAdminQualificationWorkflow');
  assert(js.includes('window.startNewComponentAnalysis = resetAdminQualificationWorkflow'), 'Live script.js exports window.startNewComponentAnalysis');
  assert(js.includes('window.clearAdminForm = resetAdminQualificationWorkflow'), 'Live script.js exports window.clearAdminForm');
  assert(js.includes('window.resetAdminDataEntryForm = resetAdminQualificationWorkflow'), 'Live script.js exports window.resetAdminDataEntryForm');
  assert(js.includes('document.addEventListener("click"'), 'Live script.js implements document click delegation');

  // 3. Test B: Live API Inference Request for Component A & Component B
  console.log("\n--- 3. VERIFYING DYNAMIC LIVE API ML INFERENCE PIPELINE (TEST B) ---");
  
  const compAPayload = {
    test_id: `ADM-COMP-LIVE-001-${Date.now()}`,
    lot_id: "LOT-LIVE-A",
    wafer_id: "WFR-LIVE-01",
    equipment_id: "EQP-101",
    temperature: 25.0,
    supply_voltage: 1.2,
    frequency: 2500.0,
    leakage_current: 120.0,
    propagation_delay: 11.5,
    dynamic_power: 42.0,
    iddq_standby: 14.2,
    output_voltage: 1.18,
    current: 40.0,
    resistance: 12.0,
    capacitance: 4.0,
    threshold_voltage: 0.45,
    setup_time: 1.2,
    hold_time: 0.8,
    timing_margin: 2.0,
    total_power: 42.17,
    test_duration: 12.0
  };

  const resA = await fetch('https://ceenew.vercel.app/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(compAPayload)
  });
  
  assert(resA.status === 200, `Live API returned 200 for Component A (Status: ${resA.status})`);
  const dataA = await resA.json();
  assert(typeof dataA.probability === 'number', `Component A returned valid P(Fail): ${(dataA.probability * 100).toFixed(1)}%`);

  const compBPayload = {
    test_id: `ADM-COMP-LIVE-002-${Date.now()}`,
    lot_id: "LOT-LIVE-B",
    wafer_id: "WFR-LIVE-02",
    equipment_id: "EQP-102",
    temperature: 95.0,
    supply_voltage: 1.05,
    frequency: 3200.0,
    leakage_current: 550.0,
    propagation_delay: 24.0,
    dynamic_power: 145.0,
    iddq_standby: 85.0,
    output_voltage: 1.03,
    current: 35.0,
    resistance: 13.7,
    capacitance: 4.0,
    threshold_voltage: 0.394,
    setup_time: 2.5,
    hold_time: 0.38,
    timing_margin: 0.96,
    total_power: 145.09,
    test_duration: 12.0
  };

  const resB = await fetch('https://ceenew.vercel.app/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(compBPayload)
  });

  assert(resB.status === 200, `Live API returned 200 for Component B (Status: ${resB.status})`);
  const dataB = await resB.json();
  assert(typeof dataB.probability === 'number', `Component B returned valid P(Fail): ${(dataB.probability * 100).toFixed(1)}%`);
  assert(dataA.probability !== dataB.probability, `Component B probability (${(dataB.probability * 100).toFixed(1)}%) differs dynamically from Component A (${(dataA.probability * 100).toFixed(1)}%)`);

  console.log("\n=========================================================================");
  console.log(`ALL ${passed}/${total} LIVE VERCEL VERIFICATION TESTS PASSED SUCCESSFULLY! ✅`);
  console.log("=========================================================================");
}

runLiveVerification().catch(err => {
  console.error("❌ Live verification script failed:", err);
  process.exit(1);
});
