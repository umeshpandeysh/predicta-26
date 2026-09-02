# Predicta Day 28 — Adversarial Stress Testing & Disproval Audit Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Adversarial Scenario Stress Test Results

| Case # | Scenario Description | Input Features | Predicted Prob | Model Output | Operational Triage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Case 1** | High Temp, Normal Timing | $temp=65°C$, $t_{pd}=11.5ns$ | `84.2%` | `FAIL` | 🔴 `CRITICAL FAIL` |
| **Case 2** | High Delay, Normal Temp | $t_{pd}=22.0ns$, $temp=26°C$ | `99.1%` | `FAIL` | 🔴 `CRITICAL FAIL` |
| **Case 3** | High Leakage, Normal Power | $i_{leak}=250\mu A$, $p_{dyn}=42mW$ | `99.9%` | `FAIL` | 🔴 `CRITICAL FAIL` |
| **Case 4** | High Power, Normal Leakage | $p_{dyn}=120mW$, $i_{leak}=110\mu A$ | `94.5%` | `FAIL` | 🔴 `CRITICAL FAIL` |
| **Case 5** | Multiple Moderate Abnormalities | $temp=38°C$, $i_{leak}=160\mu A$ | `48.0%` | `FAIL` | 🟡 `SECONDARY TEST REQUIRED` |
| **Case 6** | Extreme Plausible Combination | $v_{sup}=1.05V$, $temp=75°C$ | `99.9%` | `FAIL` | 🔴 `CRITICAL FAIL` |
| **Case 7** | Equipment Drift (EQP-103) | $EQP-103$, $temp=28.5°C$ | `96.1%` | `FAIL` | 🔴 `CRITICAL FAIL` |
| **Case 8** | Defect without Drift (EQP-101) | $EQP-101$, $i_{leak}=220\mu A$ | `99.8%` | `FAIL` | 🔴 `CRITICAL FAIL` |
| **Case 9** | Combined Timing + Thermal | $temp=55°C$, $t_{pd}=19.5ns$ | `99.9%` | `FAIL` | 🔴 `CRITICAL FAIL` |
| **Case 10**| Borderline Specification | $i_{leak}=160\mu A$, $temp=31°C$ | `48.0%` | `FAIL` | 🟡 `SECONDARY TEST REQUIRED` |
