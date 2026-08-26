# Predicta Day 21 — Research Calibration & Brier Score Audit

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Reliability & Calibration Analysis

- **Brier Score Baseline V1**: `0.3421`
- **Brier Score Research V2**: **`0.2639`** (Improved calibration)
- **Calibration Observation**: Under V2 specification-violation data generation, Brier score improved from `0.3421` to `0.2639`. Raw tree probabilities reflect a conservative screening posture designed to prevent false negatives.
