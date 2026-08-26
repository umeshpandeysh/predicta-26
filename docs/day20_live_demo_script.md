# Predicta SIH 2026 — Day 20 Five-Minute Live Demonstration Script

Target Duration: **5 to 7 Minutes**  
Production URL: `https://ceenew.vercel.app`  

---

## Live Demonstration Sequence

### STEP 1: Open Predicta Workstation UI (0:00 - 0:45)
- Open browser to `https://ceenew.vercel.app`.
- Highlight the industrial semiconductor workstation design system (dark mode, glassmorphism, telemetry input controls).

### STEP 2: Show System Status Health (0:45 - 1:15)
- Point to the **SYSTEM STATUS** panel in the workstation header.
- Confirm API: `ONLINE`, ML ENGINE: `ONLINE`, MODEL: `v2.0_production`, THRESHOLD: `0.45`.

### STEP 3: Single Prediction — Nominal PASS Scenario (1:15 - 2:15)
- Click **Load Nominal Pass Scenario**.
- Click **Analyze Telemetry**.
- Observe Result: Prediction = `PASS`, Probability = `29.9%`, Risk Level = `MEDIUM`, Operational Decision = 🟢 `PASS / MONITOR`.
- Note generated Trace ID (e.g. `PRED-2026-XXXXXXXX`).

### STEP 4: Single Prediction — High Leakage Failure Scenario (2:15 - 3:15)
- Click **Load High Leakage Scenario**.
- Click **Analyze Telemetry**.
- Observe Result: Prediction = `FAIL`, Probability = `99.9%`, Risk Level = `CRITICAL`, Operational Decision = 🔴 `CRITICAL FAIL`.
- Highlight key physical explanation indicators (`leakage_current` = 195.4 $\mu A$).

### STEP 5: Operational Review Zone & Secondary Testing (3:15 - 4:45)
- Click **Load Review Boundary Scenario**.
- Click **Analyze Telemetry**.
- Observe Result: Probability = `57.8%` ($0.35 \le P < 0.65$), Operational Decision = 🟡 `SECONDARY TEST REQUIRED`.
- Click **Request Secondary Test** ➔ Status updates to `SECONDARY_TEST_PENDING`.
- Enter Secondary Result = `PASS` ➔ Click **Complete Secondary Test**.
- Observe Result: Final Disposition = `CONFIRMED_PASS`.

### STEP 6: Audit History & Traceability (4:45 - 5:30)
- Expand the **Audit History Timeline**.
- Demonstrate step-by-step event reconstruction (`PREDICTION_CREATED` $\to$ `SECONDARY_TEST_REQUESTED` $\to$ `SECONDARY_TEST_COMPLETED` $\to$ `DISPOSITION_CONFIRMED`).

### STEP 7: Workstation Dashboard Analytics (5:30 - 6:00)
- Scroll to Dashboard Analytics.
- Point out real-time KPI totals (`Total Tested`, `Confirmed Pass`, `Confirmed Fail`, `Equipment Distribution`, `Risk Level Distribution`).
