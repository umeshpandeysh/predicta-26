# Predicta Day 27 — Production 2026 Live Demonstration Runbook

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  
Production URL: `https://ceenew.vercel.app`  

---

## 1. Step-by-Step 9-Step Golden Demo Sequence

| Step # | Action Description | Target UI Component | Expected Visual Result / Output | Judge Explanation Script |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Open Dashboard & Overview | Header & Banner | ML ENGINE ONLINE \| Threshold: 0.45 \| Model: XGBoost v2.0 | *"Predicta provides real-time ML-based defect screening and operational triage for semiconductor ICs."* |
| **2** | Run Nominal Test | Preset: Load Nominal PASS | Status: PASS (Prob: 4.2%) \| Decision: 🟢 `PASS / MONITOR` | *"Nominal telemetry falls within normal operational bounds; proceed with standard production routing."* |
| **3** | Run High Leakage Failure | Preset: Load High-Leakage | Status: FAIL (Prob: 99.9%) \| Decision: 🔴 `CRITICAL FAIL` | *"Excessive leakage current and thermal runaway trigger immediate quarantine disposition."* |
| **4** | Run Borderline Review Case | Scenario: REVIEW_CASE | Status: FAIL (Prob: 48.0%) \| Decision: 🟡 `SECONDARY TEST REQUIRED` | *"Uncertain probabilities (0.35 <= P < 0.65) route components to secondary ATE re-testing rather than forced PASS/FAIL."* |
| **5** | Trigger Secondary Test | Operator Triage Panel | Status changes to `SECONDARY_TEST_PENDING` | *"The operator requests secondary ATE re-testing, creating an immutable audit event."* |
| **6** | Complete Secondary Test | Operator Action: Pass | Status updates to `CONFIRMED_PASS` | *"Upon passing secondary re-test, the component is confirmed PASS while keeping the original ML prediction immutable."* |
| **7** | Trace ID Audit Lookup | History Table / Search | Displays trace ID `PRED-2026-XXXXXXXX` timeline | *"Every prediction generates a unique trace ID linking lot, wafer, die, telemetry, ML result, and operator actions."* |
| **8** | Test Data Quality Gate | Input `temperature = 300°C` | Interception: `DATA_QUALITY_REJECTED` (HTTP 400) | *"Our Data Quality Gate intercepts invalid or incomplete telemetry prior to ML model inference."* |
| **9** | Show System Status & Health | API Status Modal | System Status: API ONLINE \| ML Engine ONLINE | *"Predicta provides complete system observability with in-memory fallback for zero downtime."* |

---

## 2. Contingency & Fallback Procedures

- **If Internet / Vercel API Fails**: The UI workstation automatically activates in-browser fallback mode, displaying `⚠️ OFFLINE LOCAL MODE — PREDICTION GENERATED VIA IN-BROWSER FALLBACK PREDICTOR`.
- **If Supabase Database Fails**: The API gracefully falls back to local memory store without interrupting inference.
