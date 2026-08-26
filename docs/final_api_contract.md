# Predicta Final API Endpoint Contract & Interface Specification

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. REST Endpoint Specifications

| Endpoint Route | HTTP Method | Request Payload | Response Payload | Status Codes |
| :--- | :--- | :--- | :--- | :--- |
| `/api/health` | `GET` | None | `{ status: "ok", threshold: 0.45 }` | 200 |
| `/api/system/status` | `GET` | None | `{ api: "ONLINE", ml_engine: "ONLINE", threshold: 0.45 }` | 200 |
| `/api/predict` | `POST` | Telemetry Record JSON | `{ prediction, probability, operational_decision, trace_id }` | 200, 400 |
| `/api/predict/batch` | `POST` | Array of Telemetry JSON | `{ total, pass_count, fail_count, predictions }` | 200, 400 |
| `/api/dashboard/summary` | `GET` | None | `{ total_runs, pass_count, fail_count, fail_rate }` | 200 |
| `/api/dashboard/recent` | `GET` | None | Array of recent prediction records | 200 |
| `/api/dashboard/equipment` | `GET` | None | Equipment breakdown statistics | 200 |
| `/api/dashboard/risk` | `GET` | None | Risk level distribution | 200 |
| `/api/prediction/detail` | `GET` | `?id=PRED-2026-XXXXXXXX` | Detailed prediction & indicator record | 200, 404 |
| `/api/ate/status` | `GET` | None | Equipment chamber status (`EQP-101`..`105`) | 200 |
| `/api/ate/simulate` | `POST` | `{ scenario: "NORMAL" }` | Simulated ATE telemetry & ML inference result | 200 |
