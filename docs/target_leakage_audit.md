# Predicta Day 28 — Target Leakage & Synthetic Shortcut Audit Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Feature Correlation & Mutual Information Matrix

| Feature Name | Pearson Correlation | Spearman Correlation | Mutual Information | Univariate ROC-AUC | Shortcut Risk Level |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`leakage_current`** | `0.7842` | `0.8120` | `0.4510` | `0.9248` | 🔴 **HIGH SHORTCUT** |
| **`temperature`** | `0.7120` | `0.7350` | `0.3890` | `0.8840` | 🟠 **MODERATE** |
| **`propagation_delay`** | `0.6850` | `0.7010` | `0.3620` | `0.8650` | 🟠 **MODERATE** |
| **`total_power`** | `0.6420` | `0.6580` | `0.3210` | `0.8310` | 🟡 **LOW** |
| **`supply_voltage`** | `-0.4120` | `-0.4350` | `0.1980` | `0.7120` | 🟡 **LOW** |

---

## 2. Single-Feature & Shallow Tree Classification Attacks

- **Single-Feature Classifier (`leakage_current > 150.0 µA`)**:
  - ROC-AUC = `0.9248`
  - F1 Score = `0.8640`
  - **Audit Finding**: A single-feature decision stump on `leakage_current` achieves over 92% ROC-AUC, proving that the synthetic generator relies heavily on leakage current thresholding.
