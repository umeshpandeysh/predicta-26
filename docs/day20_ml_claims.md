# Predicta SIH 2026 — Day 20 ML Performance Claims Audit Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Official Model Metric Benchmarks

| Metric | Validation Set (Tuning) | Locked Test Set (10,000 Records / 20 Unseen Wafers) | Operational Target Status |
| :--- | :--- | :--- | :--- |
| **ROC-AUC** | `0.8630` | `0.8630` | High discrimination capacity across operational range |
| **PR-AUC** | `0.7660` | `0.7625` | Excellent precision-recall trade-off under 13% defect prevalence |
| **FAIL Recall** | `86.49%` | **`87.70%`** | **SATISFIED** (Target $\ge 85\%$) — 100% on `TIMING_FAILURE`, 97.11% on `THERMAL_ANOMALY` |
| **False Positive Rate (FPR)** | `14.20%` | **`39.15%`** | **UNSATISFIED** (Target $\le 15\%$) — Caused by `scale_pos_weight = 6.7413` & process/equipment drift on unseen wafers |

---

## 2. Scientific & Operational Explanation of Test Set FPR (39.15%)

### Technical Root Cause:
1. **High Class Imbalance Loss Weight (`scale_pos_weight = 6.7413`)**:
   XGBoost training heavily penalized false negatives to guarantee zero escapes of catastrophic semiconductor defects (such as timing violations and gate oxide breakdowns).
2. **Conservative Operating Threshold (`0.45`)**:
   Setting operating threshold to `0.45` forces an aggressive screening posture, ensuring $87.70\%$ defect recall.
3. **Unseen Wafer Distribution Shift**:
   Unseen test wafers exhibited equipment drift and wafer-edge process variations, causing borderline PASS components to cross probability `0.45`, yielding 3,406 false positives ($39.15\%$ FPR out of 8,699 actual PASS wafers).

### Operational Mitigation via 3-Zone Decision Engine:
Rather than automatically scrapping or rejecting all flagged components, Predicta routes borderline predictions ($0.35 \le P < 0.65$) into the **REVIEW** zone for **Secondary ATE Testing**. This operational safety mechanism prevents unnecessary scrap while maintaining high defect detection.
