# Predicta Final Prototype System Architecture Document

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Complete End-to-End System Architecture

```text
Automated Test Equipment (ATE Simulator | src/simulation/ate_simulator.js)
        │
        ▼ (Raw Telemetry Payload: Lot → Wafer → Die → Equipment → Telemetry)
Pre-Inference Data Quality Gate (src/ingestion/data_quality_gate.js)
        │
        ├─────────► DATA_QUALITY_REJECTED (HTTP 400 Bad Request)
        │
        ▼ (DATA_QUALITY_ACCEPTED)
Vercel Serverless Function API Handler (api/index.js | src/api/server.js)
        │
        ▼ (28 Feature Vector: 16 Raw Physical + 12 Engineered / OHE)
Frozen XGBoost Model V1 (ml/models/predicta_final_xgboost.json | T = 0.45)
        │
        ▼ (Failure Probability P)
3-Zone Operational Decision Engine (src/api/inference.js)
        │
        ├─────────► P < 0.35: PASS / MONITOR (LOW_RISK)
        ├─────────► 0.35 <= P < 0.65: SECONDARY TEST REQUIRED (REVIEW)
        └─────────► P >= 0.65: CRITICAL FAIL (CRITICAL_FAILURE)
        │
        ▼ (Operator Lifecycle Triage & Immutability Safeguards)
Supabase PostgreSQL Database (prediction_runs, prediction_indicators, dashboard_events)
        │
        ▼ (Unique Trace ID Correlation: PRED-2026-XXXXXXXX)
Live Operator Workstation UI (https://ceenew.vercel.app)
```
