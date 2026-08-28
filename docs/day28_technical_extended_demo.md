# Predicta Day 28 — Extended 5–7 Minute Interactive Demo Walkthrough

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Interactive Demonstration Guide

| Step # | Screen / UI Component | Action to Perform | Presenter Spoken Words | What NOT to Click / Say |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Main Workstation (`/`) | Open `https://ceenew.vercel.app` | *"This is Predicta's live ML Workstation, powered by a frozen XGBoost model running on Vercel."* | Do NOT say "connected to physical fab ATE". |
| **2** | Nominal Telemetry | Click `✅ Load Nominal PASS` | *"Notice all 16 physical parameters fill in. Clicking Run Semiconductor Analysis outputs PASS (P = 4.2%)."* | Do NOT click blank form fields. |
| **3** | High Leakage Failure | Click `⚡ Load High-Leakage Failure` | *"This loads high leakage current (198.5 µA). Predicta predicts P = 99.9%, outputting CRITICAL FAIL."* | Do NOT edit values to 0. |
| **4** | Review Case Triage | Select `REVIEW_CASE` | *"P = 48.0% falls in our review zone (0.35 <= P < 0.65), triggering SECONDARY TEST REQUIRED."* | Do NOT skip operator secondary test steps. |
| **5** | Operator Workflow | Click `Request Secondary Test` | *"The status transitions to SECONDARY_TEST_PENDING with complete trace ID audit correlation."* | Do NOT attempt to alter original prediction. |
| **6** | Secondary Test Pass | Click `Complete Secondary Test` | *"Passing the secondary test updates disposition to CONFIRMED_PASS while keeping ML logs read-only."* | Do NOT click cancel. |
| **7** | Traceability | Copy Trace ID `PRED-2026-XXXXXXXX` | *"Every action is stored in Supabase PostgreSQL and viewable in our history table."* | Do NOT refresh during network submit. |
| **8** | Data Quality Interception| Enter `temperature = 300` | *"Our Data Quality Gate intercepts impossible measurements prior to ML inference, displaying HTTP 400."* | Do NOT enter valid data in chaos test. |
| **9** | Live Dashboard | Navigate to `/` Summary | *"The dashboard analytics update instantly, reflecting total tests, pass/fail counts, and equipment stats."* | Do NOT confuse local memory fallback with DB. |
