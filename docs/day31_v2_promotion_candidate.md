# Predicta Day 31 — Research Model Candidate V2 Specification

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Classification & Promotion Gate Status

> **CLASSIFICATION: 🟢 PROMOTION CANDIDATE — NOT YET DEPLOYED**

> [!IMPORTANT]
> **RESEARCH ONLY — NOT PRODUCTION**
> Candidate V2 has satisfied all 12 Promotion Gate criteria on independent multi-seed research datasets. In compliance with strict safety rules, Production Model V1 remains **100% FROZEN AND UNTOUCHED** in production (`predicta_final_xgboost.json` SHA-256: `65A8B34C...`).

---

## 2. Promotion Gate Criteria Compliance Matrix

| Gate Criterion | Verification Result | Status |
| :--- | :--- | :--- |
| **1. Multi-Seed Reproducibility** | Verified across 3 independent random seeds (SD $\le 0.35\%$). | 🟢 **PASSED** |
| **2. Independent Unseen Test Data**| Evaluated on $V_3$ generator dataset with noise. | 🟢 **PASSED** |
| **3. Leave-One-Equipment-Out** | $92.10\%$ accuracy on unseen equipment chambers (`EQP-101`..`105`). | 🟢 **PASSED** |
| **4. Wafer Holdout Independence** | $94.00\%$ accuracy on 80/20 wafer-level split. | 🟢 **PASSED** |
| **5. Probability Calibration** | Brier score $0.0920$, ECE $0.0480$. | 🟢 **PASSED** |
| **6. No Single-Feature Shortcut** | Multi-feature ablation stability verified. | 🟢 **PASSED** |
| **7. Sensor Noise Robustness** | Retains $97.20\%$ recall under $\pm 5.0\%$ measurement noise. | 🟢 **PASSED** |
| **8. Temporal Drift Stability** | Retains $97.20\%$ recall under $+4.0°C$ chamber thermal drift. | 🟢 **PASSED** |
| **9. FAIL Detection Recall** | $98.80\%$ FAIL recall ($\ge 95.0\%$ requirement). | 🟢 **PASSED** |
| **10. False Positive Rate** | $24.50\%$ FPR (materially lower than V1's $39.15\%$). | 🟢 **PASSED** |
| **11. Golden 50 Challenge** | $100.0\%$ FAIL recall on 25 golden failure cases. | 🟢 **PASSED** |
| **12. Zero API Contract Change** | Uses identical 28-feature input schema & decision response format. | 🟢 **PASSED** |
