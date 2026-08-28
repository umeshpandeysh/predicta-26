# PREDICTA — SIH 2026 OFFICIAL 5-MINUTE JUDGE DEMONSTRATION SCRIPT

## Target Duration: 4 Minutes 45 Seconds (15 Seconds Buffer)

---

### Step 1: System Status & Live Production Verification (30 Seconds)
* **Action**: Open `https://ceenew.vercel.app` in browser. Click "System Status".
* **Narration**: *"Judges, PREDICTA is currently live in production on Vercel. We verify that model version `v2.0.0-SIH2026` is loaded, operating threshold is set to certified `0.20`, and all 7 subsystems are online."*

### Step 2: Healthy Process Die Probe (45 Seconds)
* **Action**: Enter nominal ATE measurement ($V_{	ext{sup}} = 1.20,	ext{V}, T = 27.5^circ	ext{C}, R = 12.1,Omega$). Click "Evaluate Telemetry".
* **Expected Result**: State = `NORMAL`, Action = `PASS`, Probability = `0.0075`.
* **Narration**: *"For a healthy die, PREDICTA computes a 0.75% failure probability and passes the component with HIGH confidence."*

### Step 3: Known Thermal Defect Probe & Physics Root Cause (1 Minute)
* **Action**: Input elevated temperature ($38.5^circ	ext{C}$) and high leakage current ($195,mu	ext{A}$). Click "Evaluate Telemetry".
* **Expected Result**: State = `HIGH_CONFIDENCE_DEFECT`, Action = `AUTOMATED_BINNING_REJECT`.
* **Narration**: *"Here, PREDICTA detects a critical failure. Crucially, it doesn't just return a score—the Physics Root-Cause Engine attributes the failure to thermal stress and gate-oxide leakage degradation."*

### Step 4: Zero-Day Unseen Anomaly Injection (1 Minute)
* **Action**: Input non-standard combination ($V_{	ext{th}} +35%$, $C +40%$). Click "Evaluate Telemetry".
* **Expected Result**: State = `UNKNOWN_ANOMALY`, Action = `ENGINEER_REVIEW_FAILURE_ANALYSIS`.
* **Narration**: *"When presented with a novel defect never seen during training, standard classifiers make false diagnoses. PREDICTA's unsupervised Open-Set Layer detects abnormal multi-dimensional variance and routes it to failure analysis."*

### Step 5: Temporal GPR Predictive Maintenance (1 Minute 30 Seconds)
* **Action**: Click "Equipment Health & Drift Forecast". Select `EQP-104`.
* **Expected Result**: State = `EARLY_WARNING`, Lead Time = `6.2 Wafers Advance Notice`.
* **Narration**: *"Finally, PREDICTA forecasts equipment health using Gaussian Process Regression. It predicts interconnect degradation 6 wafers before yield loss occurs, allowing proactive maintenance scheduling."*
