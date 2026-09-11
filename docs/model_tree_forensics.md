# Predicta — Fast Histogram GBDT Tree Architecture & Split Forensics Report

Version: `2.0_production`  
Operating Threshold: `0.20` (AUTHORITATIVE LOCKED THRESHOLD)  

---

## 1. Production Model Tree Architecture Summary

| Property Name | Property Value | Forensic Audit Evaluation |
| :--- | :--- | :--- |
| **Model Type** | `FastHistogramGBDT` (`2.0_production`) | Fast Histogram Gradient Boosted Decision Tree ensemble |
| **Total Estimator Count** | `500` decision trees | Deep ensemble structure |
| **Maximum Tree Depth** | `5` levels | Fast histogram quantile split optimization |
| **Learning Rate** | `0.03` | Conservative boosting rate ($\eta = 0.03$) |
| **Class Imbalance Handling** | $\text{scale\_pos\_weight} = 6.6923$ | Programmatically derived from $N=50,000$ dataset (6,500 FAIL / 43,500 PASS) |
| **Baseline Prior Logit** | $z_0 = -1.9010$ | Programmatically derived prior logit $\ln(6500/43500)$ |
| **Total Input Features** | `28` features | Locked 28-feature contract (16 raw + 7 engineered + 5 equipment OHE) |

---

## 2. Top Feature Split Frequency & Importance Ranking

| Rank | Feature Name | Split Frequency | Gain Importance | Forensic Interpretation |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `leakage_current` | `28.4%` | `0.3412` | Dominates top-level splits across root nodes |
| **2** | `propagation_delay` | `19.2%` | `0.2145` | Primary timing defect split feature |
| **3** | `temperature` | `14.8%` | `0.1680` | Thermal anomaly split feature |
| **4** | `total_power` | `10.5%` | `0.1120` | Power anomaly split feature |
| **5** | `supply_voltage` | `7.1%` | `0.0650` | Low voltage droop split feature |
