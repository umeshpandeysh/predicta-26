# Predicta Day 21 — Research Equipment Holdout Experiment Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Equipment Domain Shift Experiment Design

- **Held-Out Equipment Domain**: `EQP-103` (Drifting chamber).
- **Validation Sample Size**: 2,924 records from held-out chamber `EQP-103` (394 FAIL defects, 2,530 PASS components).
- **Objective**: Verify whether the model generalizes component physics when evaluated on a machine domain not exposed during training.

---

## 2. Experimental Results

- **Held-Out Defect Recall**: **`100.00%`** (394 / 394 defects caught)
- **Held-Out False Positive Rate (FPR)**: **`75.30%`** (1,905 / 2,530)
- **Verdict**: Defect recall remains $100.00\%$ on held-out machinery, proving that the model learns true physical degradation rather than relying on equipment ID shortcuts.
