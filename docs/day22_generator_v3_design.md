# Predicta Day 22 — Research Data Generator V3 Design Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Generator V3 Independent Design & Differences

| Design Dimension | Generator V1 (Baseline) | Generator V2 | Generator V3 (Independent Challenge) |
| :--- | :--- | :--- | :--- |
| **Label Rule** | Deterministic `FAIL = defect != NORMAL` | Specification limits | **Independent Specification Violation Matrix**: $t_{pd} > 13.8ns$, $i_{leak} > 170\mu A$, $temp > 37.5^\circ C$. |
| **Equipment Modeling** | Random equipment ID assignment | Machine-specific offsets | **Equipment Chamber Profiles**: Gain variations ($1.04 \times$ leakage on `EQP-102`, $1.08 \times$ on `EQP-103`) + temperature shifts. |
| **Defect Classes** | 7 Defect types | 7 Defect types | **9 Defect Classes**: Added multi-defect combinations (`LEAKAGE_THERMAL_COMBO`, `VOLTAGE_TIMING_COMBO`). |
| **Wafer Process Corner** | Random SS/FF corners | Random corners | **Wafer-Level Latent Shift**: Process corner threshold voltage shifts tied to wafer ID. |

---

## 2. Dataset V3 Summary Statistics

- **Total Samples**: 15,000 records (`ml/research/day22/data/validation_v3.csv`)
- **Distribution**: 8,500 PASS components (56.7%), 6,500 FAIL defects (43.3%)
- **Defect Coverage**: 9 defect classes including single and multi-defect combinations.
