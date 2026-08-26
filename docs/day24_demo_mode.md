# Predicta Day 24 — SIH Demo Mode Scenario Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Controlled SIH Demo Scenarios

| Scenario Key | Test ID | Equipment | Expected ML Output | Expected Operational Decision |
| :--- | :--- | :--- | :--- | :--- |
| **`NORMAL`** | `DEMO-ATE-NORM-001` | EQP-101 | PASS ($P \approx 0.04$) | 🟢 `PASS / MONITOR` |
| **`HIGH_LEAKAGE`** | `DEMO-ATE-LEAK-001` | EQP-103 | FAIL ($P \approx 0.99$) | 🔴 `CRITICAL FAIL` |
| **`THERMAL_ANOMALY`** | `DEMO-ATE-THERM-001` | EQP-104 | FAIL ($P \approx 0.98$) | 🔴 `CRITICAL FAIL` |
| **`TIMING_FAILURE`** | `DEMO-ATE-TIME-001` | EQP-102 | FAIL ($P \approx 0.99$) | 🔴 `CRITICAL FAIL` |
| **`EQUIPMENT_DRIFT`** | `DEMO-ATE-DRIFT-001` | EQP-103 | FAIL ($P \approx 0.96$) | 🔴 `CRITICAL FAIL` |
| **`COMBINED_DEFECT`** | `DEMO-ATE-COMBO-001` | EQP-103 | FAIL ($P \approx 0.99$) | 🔴 `CRITICAL FAIL` |
| **`REVIEW_CASE`** | `DEMO-ATE-REV-001` | EQP-102 | FAIL ($P \approx 0.48$) | 🟡 `SECONDARY TEST REQUIRED` |
