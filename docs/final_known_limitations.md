# Predicta Final Known Limitations & System Boundaries

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. System Limitations & Boundary Disclosures

| Subsystem Component | Limitation Status | Scientific Rationale & Prototype Context |
| :--- | :--- | :--- |
| **High False Positive Rate** | $39.15\%$ on Benchmark | Operating at threshold $0.45$ prioritizes zero field escapes ($99.45\%$ recall). |
| **Simulated Telemetry** | Physics-Based Synthetic | Synthetic BSIM4 telemetry used due to non-disclosure of fab datasets. |
| **SECS/GEM Hardware Bus** | REST API Architecture | Physical fab SECS/GEM serial/TCP bus driver is simulated via REST API endpoints. |
| **Probability Calibration** | Risk Score | Probability outputs quantify relative screening risk rather than physical Bayesian confidence. |
