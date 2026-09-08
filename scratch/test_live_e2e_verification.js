/**
 * PREDICTA Phase 18 — Live Production End-to-End Verification
 * File: scratch/test_live_e2e_verification.js
 */

const https = require('https');
const assert = require('assert');

const PROD_URL = "https://ceenew.vercel.app/api/predict";

console.log("=========================================================================");
console.log("PREDICTA SIH 2026 — LIVE PRODUCTION DEPLOYMENT E2E VERIFICATION");
console.log(`Target Domain: ${PROD_URL}`);
console.log("=========================================================================\n");

function postApi(url, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Cache-Control': 'no-cache'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, json: JSON.parse(body) });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Simulates UI DOM rendering according to updateQualificationResultUI logic
function renderUiState(result, record) {
  const compId = (record && (record.test_id || record.component_id)) || "COMP-00301";
  const lotId = (record && record.lot_id) || "LOT-2026-08-A17";

  const disp = result.disposition;
  const mlRiskStatus = result.ml_risk_status;
  const anomalyStatus = result.anomaly_status;
  const driftStatus = result.drift_status;
  const rawAction = result.recommended_action;

  const actionMap = {
    "PROCEED_STANDARD_SCREENING": "Proceed to Standard Screening",
    "RECOMMEND_SECONDARY_QA_REVIEW": "Secondary QA Review Required",
    "QUARANTINE_REJECT_RECOMMENDATION": "Quarantine Component"
  };

  return {
    ui_badge: disp,
    ui_probability: `${(result.probability * 100).toFixed(1)}%`,
    ui_ml_risk: `${mlRiskStatus} RISK`,
    ui_anomaly_card: anomalyStatus === "REJECT" ? "CRITICAL ANOMALY" : (anomalyStatus === "MONITOR" ? "ELEVATED ANOMALY" : "NORMAL"),
    ui_drift_card: driftStatus === "EXCEEDED" ? "EXCEEDS LIMITS" : (driftStatus === "WARNING" ? "DRIFT WARNING" : "WITHIN LIMITS"),
    ui_recommended_action: actionMap[rawAction] || rawAction.replace(/_/g, " "),
    ui_decision_reason: result.decision_reason
  };
}

async function verifyLiveProduction() {
  // CASE 1: SAFE
  const safeRecord = {
    test_id: "ADM-COMP-00301-1001",
    lot_id: "LOT-2026-SAFE-01",
    equipment_id: "EQP-101",
    iddq_standby: 10.2,
    leakage_current: 110.0,
    propagation_delay: 11.0,
    temperature: 25.0,
    supply_voltage: 1.20,
    frequency: 2500.0,
    dynamic_power: 40.0,
    threshold_voltage: 0.40,
    output_voltage: 1.18,
    current: 40.0,
    resistance: 12.0,
    capacitance: 4.0,
    setup_time: 1.15,
    hold_time: 0.80,
    timing_margin: 2.0,
    total_power: 40.01,
    test_duration: 12.0
  };

  console.log("Submitting Case 1 (SAFE) to Live Production Endpoint...");
  const res1 = await postApi(PROD_URL, safeRecord);
  const json1 = res1.json;
  const ui1 = renderUiState(json1, safeRecord);

  console.log("-------------------------------------------------------------------------");
  console.log("LIVE PRODUCTION VERIFICATION TABLE — CASE 1 (SAFE)");
  console.log("-------------------------------------------------------------------------");
  console.log(`Submitted Telemetry | IDDQ=10.2µA, Leak=110µA, Tpd=11ns, Vsup=1.2V, Temp=25°C`);
  console.log(`API Probability     | ${(json1.probability * 100).toFixed(1)}% (P = ${json1.probability})`);
  console.log(`API ML Risk Status  | ${json1.ml_risk_status}  -->  UI: ${ui1.ui_ml_risk}`);
  console.log(`API Anomaly Status  | ${json1.anomaly_status}  -->  UI: ${ui1.ui_anomaly_card}`);
  console.log(`API Drift Status    | ${json1.drift_status}  -->  UI: ${ui1.ui_drift_card}`);
  console.log(`API Disposition     | ${json1.disposition}  -->  UI Badge: ${ui1.ui_badge}`);
  console.log(`API Action          | ${json1.recommended_action}  -->  UI: ${ui1.ui_recommended_action}`);
  console.log(`API Rationale       | ${json1.decision_reason}`);
  console.log("-------------------------------------------------------------------------\n");

  assert.strictEqual(json1.disposition, "PASS", "Live production disposition MUST equal PASS");
  assert.strictEqual(json1.ml_risk_status, "LOW", "Live production ML risk status MUST equal LOW");
  assert.strictEqual(json1.anomaly_status, "NORMAL", "Live production anomaly status MUST equal NORMAL");
  assert.strictEqual(json1.drift_status, "WITHIN", "Live production drift status MUST equal WITHIN");
  assert.strictEqual(ui1.ui_badge, "PASS", "UI badge MUST render PASS");
  assert.strictEqual(ui1.ui_recommended_action, "Proceed to Standard Screening", "UI action MUST render Proceed to Standard Screening");

  // CASE 2: REVIEW
  const reviewRecord = { ...safeRecord, test_id: "ADM-COMP-00302-1002", temperature: 42.0 };
  console.log("Submitting Case 2 (REVIEW) to Live Production Endpoint...");
  const res2 = await postApi(PROD_URL, reviewRecord);
  const json2 = res2.json;
  const ui2 = renderUiState(json2, reviewRecord);
  assert.strictEqual(json2.disposition, "MONITOR", "Live production disposition MUST equal MONITOR");
  assert.strictEqual(json2.ml_risk_status, "ELEVATED", "Live production ML risk status MUST equal ELEVATED");

  // CASE 3: ANOMALY
  const anomalyRecord = { ...safeRecord, test_id: "ADM-COMP-00303-1003", iddq_standby: 250.0 };
  console.log("Submitting Case 3 (CRITICAL ANOMALY) to Live Production Endpoint...");
  const res3 = await postApi(PROD_URL, anomalyRecord);
  const json3 = res3.json;
  const ui3 = renderUiState(json3, anomalyRecord);
  assert.strictEqual(json3.disposition, "REJECT", "Live production disposition MUST equal REJECT");
  assert.strictEqual(json3.anomaly_status, "REJECT", "Live production anomaly status MUST equal REJECT");

  // CASE 4: DRIFT
  const driftRecord = { ...safeRecord, test_id: "ADM-COMP-00304-1004", propagation_delay: 85.0 };
  console.log("Submitting Case 4 (DRIFT FAILURE) to Live Production Endpoint...");
  const res4 = await postApi(PROD_URL, driftRecord);
  const json4 = res4.json;
  const ui4 = renderUiState(json4, driftRecord);
  assert.strictEqual(json4.disposition, "REJECT", "Live production disposition MUST equal REJECT");
  assert.strictEqual(json4.drift_status, "EXCEEDED", "Live production drift status MUST equal EXCEEDED");

  console.log("=========================================================================");
  console.log("LIVE PRODUCTION SITE END-TO-END VERIFICATION FULLY PASSED 100%! ✅");
  console.log("=========================================================================");
}

verifyLiveProduction().catch(err => {
  console.error("❌ Live Production Verification Failed:", err);
  process.exit(1);
});
