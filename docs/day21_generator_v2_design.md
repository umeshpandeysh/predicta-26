# Predicta Day 21 — Research Data Generator V2 Design Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Generator V2 Scientific Improvements Matrix

| Weakness Identified in Day 20 | V2 Generator Scientific Correction | Implementation Location |
| :--- | :--- | :--- |
| **Deterministic Target Assignment (`FAIL = defect != NORMAL`)** | **Specification-Violation Target Assignment**: Latent specification limits ($t_{pd} > 14.0ns$, $i_{leak} > 175\mu A$, $temp > 38^\circ C$) calculate specification failure. | `ml/research/day21/generate_v2.js` |
| **Random Equipment ID Assignment** | **Machine-Specific Offset & Drift Coupling**: `EQP-103` is modeled as a drifting chamber ($+8\mu A$ leakage bias, $+2.5^\circ C$ temp bias), binding machine ID to drift. | `ml/research/day21/generate_v2.js` |
| **Binary Severity ($s=1.0$)** | **Continuous Severity Scale ($0.05 \le s \le 0.95$)**: Uniform continuous severity sampling avoids artificial sharp decision boundaries. | `ml/research/day21/generate_v2.js` |
| **Single-Feature Defect Mutations** | **Multi-Measurement Physical Signatures**: Defects influence all coupled physical parameters (e.g. `HIGH_LEAKAGE` affects leakage, current, and temperature). | `ml/research/day21/generate_v2.js` |

---

## 2. Research Dataset V2 Distribution Statistics

- **Total Samples**: 50,000 records
- **Train V2 Set**: 35,000 records (70 wafers) ➔ `ml/research/day21/data/train_v2.csv`
- **Validation V2 Set**: 15,000 records (30 wafers) ➔ `ml/research/day21/data/validation_v2.csv`
- **Target Distribution**: ~84.2% PASS, ~15.8% FAIL (Realistic specification violation prevalence)
