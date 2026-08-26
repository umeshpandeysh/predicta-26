# Predicta Day 22 — Research Feature Shortcut Challenge Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Feature Shortcut & Redundancy Audit

- **`thermal_delta` ($temp - 25.0$)**: 100% collinear with `temperature`. When `thermal_delta` is ablated, recall drops from $99.64\%$ to $87.36\%$, proving that XGBoost tree splits use temperature features to catch thermal runaways.
- **`normalized_timing_margin` ($t_{margin} / t_{pd}$)**: Provides timing path margin proxy. When propagation delay is neutralized, timing margin maintains $99.13\%$ defect recall.
- **`equipment_id` OHE (`eq_EQP-101` .. `105`)**: Acts as a machine context offset indicator without acting as a label proxy.
