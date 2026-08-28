# PREDICTA — Production 2026 LIVE TECHNICAL_REVIEWER DEMONSTRATION SCRIPT

## Demonstration Flow (5 Minutes)

### Step 1: Health & System Status Inspection (30 Seconds)
- Open Dashboard at `https://ceenew.vercel.app`.
- Show live API Status: `GET /api/health` $ightarrow$ `HTTP 200 OK` (Model loaded, Threshold = 0.20).

### Step 2: Healthy Process Die Probe (1 Minute)
- Input nominal die telemetry (Supply = 1.20 V, Temp = 27.5°C, Resistance = 12.1 $Omega$).
- Output: `NORMAL` / `PASS` (Probability = 0.0075, Severity = LOW).

### Step 3: Known Thermal Anomaly Die Probe (1 Minute)
- Input thermal spike telemetry (Temp = 38.5°C, Leakage = 195.0 µA).
- Output: `HIGH_CONFIDENCE_DEFECT` / `AUTOMATED_BINNING_REJECT`
- Explanation: Physical Root Cause = `THERMAL_STRESS` & `LEAKAGE_DEGRADATION`.

### Step 4: Unknown Zero-Day Anomaly Injection (1 Minute)
- Input unseen nonlinear process surge (Threshold Volt +35%, Capacitance +40%).
- Output: `UNKNOWN_ANOMALY` / `ENGINEER_REVIEW_FAILURE_ANALYSIS` (No false label!).

### Step 5: Temporal GPR Equipment Maintenance Alert (1.5 Minutes)
- Show GPR forecast trajectory for `EQP-104`.
- Output: `EARLY_WARNING` / `MONITOR_EQUIPMENT_SCHEDULE_MAINTENANCE` (Lead Time = 6.2 Wafers Ahead).
