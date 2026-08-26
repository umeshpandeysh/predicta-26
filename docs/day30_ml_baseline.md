# Predicta Day 30 — Production Model Immutable Baseline Document

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Production Model Immutable Specification

| Attribute Dimension | Production Model Value |
| :--- | :--- |
| **Model File Path** | [`ml/models/predicta_final_xgboost.json`](file:///C:/Users/UMESH%20PANDEY/Downloads/ceenew/ml/models/predicta_final_xgboost.json) |
| **Model SHA-256 Hash** | `65A8B34C013CB60D900009EFD09FA4A79B56AED02F07BF0511360086C4547C3D` |
| **Metadata File Path** | [`ml/models/predicta_final_metadata.json`](file:///C:/Users/UMESH%20PANDEY/Downloads/ceenew/ml/models/predicta_final_metadata.json) |
| **Metadata SHA-256 Hash** | `9BD1BE75EEE4628E1001470EA39B5B6EBB0F958B9E2AA1EC7D5C3C42628F06E0` |
| **Model Architecture** | Gradient Boosted Decision Trees (XGBoost 2.0.3 format) |
| **Total Feature Inputs** | 28 features (16 raw physical + 7 engineered + 5 equipment one-hot) |
| **Operating Threshold** | `0.45` |
| **Benchmark FPR** | `39.15%` |
| **Benchmark Recall** | `99.20%` |
| **Benchmark ROC-AUC** | `0.9421` |

---

## 2. Protection Rule

The production model file `predicta_final_xgboost.json` remains **100% FROZEN AND UNTOUCHED**. All research candidate models, dataset generators, and experimental evaluations are strictly isolated under `ml/research/day30/`.
