# Predicta Day 23 — Production ML vs Research Model Separation Audit

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Production Model Loading & Execution Path Audit

```text
https://ceenew.vercel.app (Frontend UI Workstation)
        │
        ▼
Vercel Serverless Function Handler (api/index.js)
        │
        ▼
Node.js REST API Server (src/api/server.js)
        │
        ▼
Inference Service Engine (src/api/inference.js)
        │
        ▼
Frozen Production XGBoost Model (ml/models/predicta_final_xgboost.json)
```

- **Production Model File**: [`ml/models/predicta_final_xgboost.json`](file:///C:/Users/UMESH%20PANDEY/Downloads/ceenew/ml/models/predicta_final_xgboost.json)
- **Model Version**: `2.0_production`
- **SHA-256 Hash**: `65A8B34C013CB60D900009EFD09FA4A79B56AED02F07BF0511360086C4547C3D` (**100% Unchanged**)
- **Operating Threshold**: `0.45` (**Strictly Preserved**)
- **Feature Vector Count**: 28 features (16 raw physical + 5 engineered ratios + 5 equipment one-hot + 2 process flags).
- **Isolation Status**: **100% Isolated**. Zero research scripts or experimental models under `ml/research/` are loaded or executed by production API routes.

---

## 2. Research Artifacts vs Production Separation Audit

| Subsystem Component | Production Environment | Research Environment (Day 21 & Day 22) | Separation Audit Verdict |
| :--- | :--- | :--- | :--- |
| **Model Weights File** | `ml/models/predicta_final_xgboost.json` | `ml/research/day21/research_metrics.json` | 🟢 **100% SEPARATED** |
| **Data Generator** | Client inputs / REST API | `ml/research/day21/generate_v2.js`, `ml/research/day22/generate_v3.js` | 🟢 **100% SEPARATED** |
| **Evaluation Data** | Live UI predictions | `train_v2.csv`, `validation_v2.csv`, `validation_v3.csv` | 🟢 **100% SEPARATED** |
| **Operating Threshold** | `0.45` | Research threshold sweeps (0.10 to 0.90) | 🟢 **100% SEPARATED** |
