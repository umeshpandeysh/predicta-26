# Predicta Day 28 — XGBoost Tree Architecture & Split Forensics Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Production Model Tree Architecture Summary

| Property Name | Property Value | Forensic Audit Evaluation |
| :--- | :--- | :--- |
| **Model Type** | `XGBClassifier` (v2.0_production) | Gradient boosted decision tree ensemble |
| **Total Estimator Count** | `500` trees | Deep ensemble structure |
| **Maximum Tree Depth** | `6` levels | Max 64 leaf nodes per tree |
| **Learning Rate** | `0.03` | Conservative learning rate |
| **Total Input Features** | `28` features | 16 raw physical + 12 engineered/OHE |

---

## 2. Top Feature Split Frequency & Importance Ranking

| Rank | Feature Name | Split Frequency | Gain Importance | Forensic Interpretation |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `leakage_current` | `28.4%` | `0.3412` | Dominates top-level splits across root nodes |
| **2** | `propagation_delay` | `19.2%` | `0.2145` | Primary timing defect split feature |
| **3** | `temperature` | `14.8%` | `0.1680` | Thermal anomaly split feature |
| **4** | `total_power` | `10.5%` | `0.1120` | Power anomaly split feature |
| **5** | `supply_voltage` | `7.1%` | `0.0650` | Low voltage droop split feature |
