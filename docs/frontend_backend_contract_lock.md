# Predicta Frontend-Backend Contract Lock Document

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Authoritative API Endpoint Contracts Consumed by Frontend

| Endpoint Route | Method | Consuming Frontend Function | Request Schema | Response Contract Schema |
| :--- | :--- | :--- | :--- | :--- |
| `/api/health` | `GET` | `checkBackendHealth()` | None | `{ status: "ok", threshold: 0.45, timestamp }` |
| `/api/system/status` | `GET` | `fetchSystemStatus()` | None | `{ api: "ONLINE", ml_engine: "ONLINE", threshold: 0.45, model_version }` |
| `/api/predict` | `POST` | `submitInferenceForm()` | 16 Raw Physical Telemetry Parameters JSON | `{ prediction, probability, threshold, risk_level, operational_decision, trace_id }` |
| `/api/predict/batch` | `POST` | `submitBatchForm()` | Array of Telemetry JSON Objects | `{ total, pass_count, fail_count, review_count, predictions }` |
| `/api/dashboard/summary` | `GET` | `loadDashboardData()` | None | `{ total_runs, pass_count, fail_count, fail_rate, avg_probability }` |
| `/api/dashboard/recent` | `GET` | `loadRecentHistory()` | None | Array of recent persistent prediction records |
| `/api/dashboard/equipment` | `GET` | `loadEquipmentStats()`| None | Object mapping equipment IDs (`EQP-101`..`105`) to test counts |
| `/api/dashboard/risk` | `GET` | `loadRiskStats()` | None | `{ LOW, MODERATE, CRITICAL }` counts |
| `/api/prediction/detail` | `GET` | `viewTraceDetail()` | `?id=PRED-2026-XXXXXXXX` | Detailed prediction & indicator JSON record |
| `/api/ate/status` | `GET` | `loadATEStatus()` | None | Equipment chamber status object |
| `/api/ate/simulate` | `POST` | `runDemoScenario()` | `{ scenario: "NORMAL" }` | Simulated ATE telemetry & ML inference result |
