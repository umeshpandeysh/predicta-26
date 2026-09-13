# Predicta Day 22 — Research Defect Combination Evaluation Report

> [!NOTE]
> **HISTORICAL / EXPERIMENTAL CONFIGURATION**
> This document records an earlier milestone experiment where an operating threshold of 0.45 was evaluated.
> This threshold is not used by the current production system.
> The current authoritative production ML operating threshold is **0.20**.

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Multi-Defect Combination Performance

| Defect Combination | Sample Count | Defect Recall (%) | Operational Triage Verdict |
| :--- | :--- | :--- | :--- |
| **`LEAKAGE_THERMAL_COMBO`** | 950 records | **`99.89%`** (949 / 950) | 🔴 `CRITICAL FAIL` ($P > 0.85$) |
| **`VOLTAGE_TIMING_COMBO`** | 1,015 records | **`100.00%`** (1,015 / 1,015) | 🔴 `CRITICAL FAIL` ($P > 0.90$) |

---

## 2. Scientific Conclusion

When multiple defects occur simultaneously (e.g. high leakage current accompanied by thermal runaway), Predicta's decision engine correctly evaluates compound physical risks, pushing the failure probability above $0.85$ and classifying the component as **CRITICAL FAIL**.
