# Predicta Day 33 — Failure & Fault Isolation Validation Report

> [!NOTE]
> **HISTORICAL / EXPERIMENTAL CONFIGURATION**
> This document records an earlier milestone experiment where an operating threshold of 0.45 was evaluated.
> This threshold is not used by the current production system.
> The current authoritative production ML operating threshold is **0.20**.

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Fault Isolation Matrix

| Failure Mode | Injected Fault Condition | System Recovery Behavior | Production Outcome |
| :--- | :--- | :--- | :--- |
| **Shadow V2 Exception** | Simulated error inside V2 shadow computation | Shadow payload returns `{ error, disclaimer }` | 🟢 Production V1 prediction succeeds completely. |
| **Supabase Cloud Outage** | Unreachable Supabase database endpoint | Transparent fallback to in-memory store | 🟢 Production ML inference & triage workflow succeeds. |
| **Data Quality Violation** | $temp = 300°C$ or missing mandatory field | Intercepted by Pre-Inference Data Quality Gate | 🟢 Returns HTTP 400 `DATA_QUALITY_REJECTED` prior to ML. |
| **Malformed JSON Payload**| Syntax error in POST body | Caught by API request validator | 🟢 Returns HTTP 400 structured error response. |
