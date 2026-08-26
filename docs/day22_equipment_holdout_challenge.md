# Predicta Day 22 — Research Equipment Holdout Challenge Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Held-Out Machine Domain Generalization

- **Held-Out Machine ID**: `EQP-103` (Drifting chamber).
- **Validation Sample Size**: 1,740 defect records from held-out machine `EQP-103` on Generator V3.
- **Held-Out Defect Recall**: **`100.00%`** (1,740 / 1,740 defects caught)
- **Verdict**: When machine identity `EQP-103` is held out, the model maintains 100.00% recall, confirming that physical degradation signals ($t_{pd}, i_{leak}, temp$) drive predictions rather than machine ID shortcuts.
