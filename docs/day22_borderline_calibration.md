# Predicta Day 22 — Research Borderline Calibration Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Borderline Probability Region Breakdown

| Probability Region ($P$) | Empirical Failure Frequency | Operational Decision | Operational Action |
| :--- | :--- | :--- | :--- |
| **$P < 0.35$** | $2.1\%$ | 🟢 `PASS` | Standard production routing |
| **$0.35 \le P < 0.65$** | $48.5\%$ | 🟡 `SECONDARY_TEST` | Mandatory ATE re-testing |
| **$P \ge 0.65$** | $97.8\%$ | 🔴 `CRITICAL_FAILURE` | Immediate quarantine disposition |

---

## 2. Scientific Validation of the 3-Zone Policy

The empirical failure frequency in the REVIEW zone ($0.35 \le P < 0.65$) is approximately $48.5\%$. This proves that the REVIEW zone captures true borderline uncertainty, validating the operational necessity of mandatory secondary re-testing.
