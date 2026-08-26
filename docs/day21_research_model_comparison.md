# Predicta Day 21 — Research Model Comparison Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Scientific Comparison: Baseline V1 vs Research V2 Pipeline

| Evaluation Dimension | Frozen Baseline V1 | Research Pipeline V2 | Scientific Progress |
| :--- | :--- | :--- | :--- |
| **`EQUIPMENT_DRIFT` Recall** | **`31.85%`** ❌ | **`100.00%`** ✅ | **SOLVED**: Machine-specific chamber offset coupling binds machine ID to drift. |
| **Generalization on Held-Out Machine** | Unverified | **`100.00%`** ✅ | **SOLVED**: Model generalizes component physics when machine identity is held out. |
| **Defect-Wise Recalls** | Severe defects 92-100% | All defects 98.68% - 100.00% | High defect screening posture maintained. |
| **Target Label Definition** | Deterministic `defect_type != "NORMAL"` | Specification-violation latent score | **SOLVED**: Realistic distribution overlap and specification limits. |
| **Brier Calibration Score** | `0.3421` | `0.2639` | Improved probability calibration under V2 generator. |
| **Vercel / Supabase API Contract** | 16 Raw + Equipment ID | 16 Raw + Equipment ID | **100% Compatible**: Zero breaking changes to API schema. |
