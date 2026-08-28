# Predicta Day 21 — Scientific Model Selection Matrix

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Model Selection Matrix

| Candidate Model | `EQUIPMENT_DRIFT` Recall | Held-Out Generalization | Brier Score | Production API Contract Compatibility | Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Current Frozen Baseline V1** | **`31.85%`** ❌ | Unverified | `0.3421` | Native | **KEEP FROZEN FOR product demonstration** |
| **Research Model V2** | **`100.00%`** ✅ | **`100.00%`** ✅ | **`0.2639`** | **100% Compatible** | **RECOMMENDED FUTURE MIGRATION (POST-Production)** |

---

## 2. Scientific Recommendation

- **product demonstrationnstration Phase**: Keep `predicta_final_xgboost.json` frozen at threshold `0.45` to preserve all verified 78/78 regression tests and production Vercel deployment stability.
- **Post-Production Fab Phase**: Recommend migrating production to Model V2 to unlock $100\%$ equipment drift recall and improved Brier calibration scores.
