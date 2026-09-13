# PREDICTA-26 ? SIH Demonstration Guide & Runbook

---

## Objective
Demonstrate deterministic multi-model semiconductor test screening across four distinct operational cases on the interactive Workstation Dashboard (`http://localhost:8000`).

---

## Demo Preparation
1. Start the API server:
   ```bash
   node src/api/server.js
   ```
2. Open your browser to `http://localhost:8000`.
3. Ensure the top status bar displays **System Active** with **Native XGBoost 350-Tree Engine Active**.

---

## Four Mandatory Demonstration Cases

### Case 1: Healthy Silicon Die
- **Objective:** Demonstrate nominal qualification without unnecessary scrap.
- **Input Parameters:**
  - Supply Voltage: `1.20 V`
  - Output Voltage: `1.18 V`
  - Current: `44.0 mA`
  - Leakage Current: `145.0 ?A`
  - Temperature: `28.0 ?C`
  - Frequency: `2300.0 MHz`
  - Timing Margin: `2.9 ns`
- **Expected Outcome:**
  - Calibrated Failure Risk: `P < 0.05`
  - Statistical Anomaly Check: `Normal (Z < 3.0)`
  - 168h Degradation Forecast: `Within Limits`
  - Final Disposition: ?? **PASS**
  - Action: `PROCEED_STANDARD_SCREENING`

### Case 2: Borderline Silicon Die (Elevated Risk)
- **Objective:** Demonstrate cost-sensitive defect containment without premature die rejection.
- **Input Parameters:**
  - Supply Voltage: `1.18 V`
  - Leakage Current: `320.0 ?A` (elevated subthreshold leakage)
  - Timing Margin: `1.15 ns` (narrow timing margin)
  - Temperature: `42.0 ?C`
- **Expected Outcome:**
  - Calibrated Failure Risk: `0.20 <= P < 0.65`
  - Final Disposition: ?? **MONITOR**
  - Action: `SECONDARY_TEST` (Routed to secondary diagnostic probe)

### Case 3: Unknown / Open-Set Anomaly
- **Objective:** Show that unmodeled zero-day defects are caught by PAT/COPOD even when individual scalar parameters look acceptable.
- **Input Parameters:**
  - Supply Voltage: `1.20 V` (normal)
  - Operating Current: `45.0 mA` (normal)
  - Leakage Current: `160.0 ?A` (normal)
  - Standby Quiescent Current: `45.0 mA` (abnormal quiescent state)
- **Expected Outcome:**
  - XGBoost Probability: Moderate
  - PAT Anomaly Check: `REJECT (Z > 6.0)`
  - Final Disposition: ?? **QUARANTINE / REJECT**
  - Action: `QUARANTINE_REJECT_RECOMMENDATION`

### Case 4: Degrading Equipment / Silicon Die
- **Objective:** Demonstrate GPR predictive lead time catching parametric degradation before catastrophic failure.
- **Input Parameters:**
  - Operating Temperature: `85.0 ?C`
  - Threshold Voltage Shift: `0.38 V` (severe threshold degradation)
  - Propagation Delay: `16.8 ns`
- **Expected Outcome:**
  - GPR 168h Forecast: `EXCEEDED` (crosses upper tolerance boundary)
  - Final Disposition: ?? **REJECT**
  - Action: `QUARANTINE_REJECT_RECOMMENDATION` (Chamber recalibration alert)
