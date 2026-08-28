# Predicta Final Production 2026 Demonstration Guide & Runbook

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Golden Live Demonstration Steps

1. Open `https://ceenew.vercel.app`. Verify status header shows `ML ENGINE ONLINE`.
2. Click `✅ Load Nominal PASS`. Click `Run Semiconductor Analysis`. Observe 🟢 `PASS / MONITOR` ($P=4.2\%$).
3. Click `⚡ Load High-Leakage Failure`. Click `Run Analysis`. Observe 🔴 `CRITICAL FAIL` ($P=99.9\%$).
4. Load preset `REVIEW_CASE`. Click `Run Analysis`. Observe 🟡 `SECONDARY TEST REQUIRED` ($P=48.0\%$).
5. In Operator Triage panel, click `Request Secondary Test`. Status updates to `SECONDARY_TEST_PENDING`.
6. Click `Complete Secondary Test (PASS)`. Status updates to `CONFIRMED_PASS`.
7. Copy Trace ID `PRED-2026-XXXXXXXX` and look it up in History search.
8. Submit `temperature = 300`. Observe Data Quality Gate interception `DATA_QUALITY_REJECTED` (HTTP 400).
