# Predicta Day 21 — Current Frozen ML Baseline Documentation

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Frozen Production Model Specifications

- **Model Artifact Path**: `ml/models/predicta_final_xgboost.json`
- **Metadata Path**: `ml/models/predicta_final_metadata.json`
- **Model Card Path**: `ml/models/predicta_final_model_card.json`
- **SHA-256 Hash**: `65A8B34C013CB60D900009EFD09FA4A79B56AED02F07BF0511360086C4547C3D` (100% Frozen)
- **Operating Threshold**: **`0.45`** (Strictly Preserved)
- **Training Dataset**: Predicta Synthetic Dataset v3 (50,000 records, 68 training wafers / 20 test wafers)
- **Primary Target**: `result` (`PASS` / `FAIL`)

---

## 2. Frozen Production Metric Benchmarks

- **ROC-AUC**: `0.8630`
- **PR-AUC**: `0.7625`
- **FAIL Defect Recall**: **`87.70%`** (1,141 / 1,301 actual test defects caught)
- **False Positive Rate (FPR)**: **`39.15%`** (3,406 / 8,699 actual PASS wafers flagged)
- **Defect-Wise Recalls**:
  - `TIMING_FAILURE`: **100.00%**
  - `THERMAL_ANOMALY`: **97.11%**
  - `POWER_ANOMALY`: **96.69%**
  - `LOW_VOLTAGE`: **94.54%**
  - `PROCESS_VARIATION`: **93.05%**
  - `HIGH_LEAKAGE`: **92.48%**
  - `EQUIPMENT_DRIFT`: **31.85%** ❌

---

## 3. Key Baseline Weaknesses Identified in Day 20 Audit

1. **Equipment Drift Recall Failure (31.85%)**: `equipment_id` was assigned randomly without tying chamber drift to machine ID, leaving equipment one-hot features disconnected from equipment defects.
2. **High Locked-Test FPR (39.15%)**: High `scale_pos_weight = 6.7413` loss penalty + process drift on unseen test wafers caused borderline PASS components to cross probability `0.45`.
3. **Deterministic Label Assignment**: Target `result` was assigned deterministically from `defect_type != "NORMAL"`.
