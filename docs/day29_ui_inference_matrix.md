# Predicta Day 29 — UI Inference Execution Matrix

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Demo Scenario UI Inference Audit Matrix

| Scenario Key | Test ID | Equipment ID | Leakage ($\mu A$) | Temp ($^\circ C$) | Prop Delay ($ns$) | Probability | Threshold | Risk Level | Operational Decision | Trace ID Format |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **NORMAL** | `DEMO-ATE-NORM-001` | `EQP-101` | `110.0` | `26.0` | `11.5` | `4.2%` | `0.45` | `LOW_RISK` | `PASS` | `PRED-2026-XXXXXXXX` |
| **HIGH_LEAKAGE** | `DEMO-ATE-LEAK-001` | `EQP-103` | `198.5` | `36.5` | `14.8` | `99.9%` | `0.45` | `CRITICAL_FAILURE` | `CRITICAL_FAIL` | `PRED-2026-XXXXXXXX` |
| **THERMAL_ANOMALY** | `DEMO-ATE-THERM-001` | `EQP-104` | `175.0` | `42.0` | `13.9` | `97.8%` | `0.45` | `CRITICAL_FAILURE` | `CRITICAL_FAIL` | `PRED-2026-XXXXXXXX` |
| **TIMING_FAILURE** | `DEMO-ATE-TIME-001` | `EQP-102` | `125.0` | `28.5` | `15.6` | `96.4%` | `0.45` | `CRITICAL_FAILURE` | `CRITICAL_FAIL` | `PRED-2026-XXXXXXXX` |
| **EQUIPMENT_DRIFT** | `DEMO-ATE-DRIFT-001` | `EQP-103` | `188.0` | `38.0` | `14.2` | `99.5%` | `0.45` | `CRITICAL_FAILURE` | `CRITICAL_FAIL` | `PRED-2026-XXXXXXXX` |
| **COMBINED_DEFECT** | `DEMO-ATE-COMBO-001` | `EQP-103` | `215.0` | `44.5` | `16.2` | `99.9%` | `0.45` | `CRITICAL_FAILURE` | `CRITICAL_FAIL` | `PRED-2026-XXXXXXXX` |
| **REVIEW_CASE** | `DEMO-ATE-REV-001` | `EQP-102` | `162.0` | `31.5` | `13.4` | `48.0%` | `0.45` | `MODERATE_RISK` | `SECONDARY_TEST` | `PRED-2026-XXXXXXXX` |

---

## 2. Matrix Verification Summary

- **Frontend-Backend Contract Parity**: 100% agreement between UI form parameters, HTTP API payloads, XGBoost ML probabilities, and 3-zone decision classifications.
- **Zero Frontend Result Mocking**: All scenario executions perform real ML model inference through the backend pipeline.
