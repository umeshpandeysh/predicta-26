# Predicta Day 28 — System Architecture Block-by-Block Technical Flow Explanation

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. System Block-by-Block Technical Flow Diagram

```text
ATE Telemetry / Simulator (Lot → Wafer → Die → Equipment → Telemetry)
        │
        ▼ (Raw Telemetry Payload)
Pre-Inference Data Quality Gate (src/ingestion/data_quality_gate.js)
        │
        ├─────────► DATA_QUALITY_REJECTED (HTTP 400 Bad Request)
        │
        ▼ (DATA_QUALITY_ACCEPTED)
Vercel Serverless Function API Handler (api/index.js | src/api/server.js)
        │
        ▼ (28 Feature Vector)
Frozen XGBoost Inference Engine (ml/models/predicta_final_xgboost.json | T = 0.45)
        │
        ▼ (Failure Probability P)
3-Zone Operational Decision Engine (src/api/inference.js line 232)
        │
        ├─────────► P < 0.35: PASS / MONITOR (LOW_RISK)
        ├─────────► 0.35 <= P < 0.65: SECONDARY TEST REQUIRED (REVIEW)
        └─────────► P >= 0.65: CRITICAL FAIL (CRITICAL_FAILURE)
        │
        ▼ (Operator Lifecycle & Immutability Safeguards)
Supabase PostgreSQL Database (prediction_runs, prediction_indicators, dashboard_events)
        │
        ▼ (Unique Trace ID Correlation: PRED-2026-XXXXXXXX)
Live Workstation Dashboard UI (https://ceenew.vercel.app)
```

---

## 2. Block-by-Block Subsystem Specifications

| Architecture Block | Input Payload | Output Payload | Primary Purpose | Failure Behavior / Resilience |
| :--- | :--- | :--- | :--- | :--- |
| **ATE Telemetry Stream** | Lot, Wafer, Die, Equipment ID, 16 raw parameters | Telemetry JSON Object | Simulates ATE test floor measurement acquisition | Generates timestamped telemetry with simulated sensor noise |
| **Data Quality Gate** | Telemetry JSON Object | `ACCEPTED` / `REJECTED` status | Validates physical boundaries, missing fields, numeric types | Rejects invalid telemetry with HTTP 400 Bad Request |
| **Vercel Serverless API** | HTTP POST Request | JSON Response | Microservice API route handler (`/api/predict`) | Sub-35ms serverless execution with CORS headers |
| **XGBoost ML Engine** | 28 Feature Vector | Failure Probability $P$ | Calculates defect risk probability ($0.0 \le P \le 1.0$) | Evaluated at frozen operating threshold $0.45$ |
| **3-Zone Decision Engine** | Probability $P$, Equipment ID | Operational Decision | Classifies risk into `PASS`, `SECONDARY_TEST`, or `FAIL` | Enforces mandatory review zone for borderline uncertainty |
| **Operator Triage** | Secondary test results | Updated lifecycle state | Allows human operators to clear false positives | Original ML prediction & probability remain 100% immutable |
| **Supabase PostgreSQL** | Prediction record | Persistent DB Row | Stores cloud audit logs and historical analytics | Gracefully falls back to local memory store if offline |
| **Live Workstation UI** | API JSON Data | Rendered HTML/CSS Cards | Provides operator dashboard and workstation controls | Displays `OFFLINE LOCAL MODE` banner if API unreachable |
