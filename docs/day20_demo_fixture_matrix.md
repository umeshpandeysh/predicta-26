# Predicta Production 2026 — Day 20 Demonstration Fixture Matrix

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## Controlled Development Fixtures Matrix

| Fixture File | Input Telemetry Intent | Expected ML Probability | Actual ML Prediction | Operational Decision |
| :--- | :--- | :--- | :--- | :--- |
| `nominal_pass.json` | Nominal degradation path ($v_{sup}=1.20V$, $i_{leak}=110\mu A$) | $P < 0.35$ | `PASS` | 🟢 `PASS / MONITOR` |
| `high_leakage.json` | Transistor gate oxide failure ($i_{leak}=198.5\mu A$) | $P \ge 0.65$ | `FAIL` | 🔴 `CRITICAL FAIL` |
| `thermal_anomaly.json` | Thermal excursion ($temp=42.5^\circ C$) | $P \ge 0.65$ | `FAIL` | 🔴 `CRITICAL FAIL` |
| `timing_failure.json` | Propagation delay violation ($t_{pd}=15.2ns$) | $P \ge 0.65$ | `FAIL` | 🔴 `CRITICAL FAIL` |
| `process_variation.json` | Wafer edge process variation drift | $0.35 \le P < 0.65$ | `FAIL` | 🟡 `SECONDARY TEST REQUIRED` |
| `equipment_drift.json` | Chamber sensor offset drift | $0.35 \le P < 0.65$ | `FAIL` | 🟡 `SECONDARY TEST REQUIRED` |
| `review_boundary.json` | Operational review boundary ($i_{leak}=125\mu A$) | $P = 0.5779$ | `FAIL` | 🟡 `SECONDARY TEST REQUIRED` |
