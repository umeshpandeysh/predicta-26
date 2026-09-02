# Predicta Day 30 — Final Scientific ML Verdict

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Official Classification Verdicts

### Current Production Model V1
> **VERDICT: 🟡 ACCEPTABLE WITH LIMITATIONS**

- **Strengths**: 100% stable integration, sub-10ms Node.js inference, $99.20\%$ FAIL recall, 3-zone decision engine routing borderline cases to `SECONDARY_TEST`.
- **Limitations**: Benchmark False Positive Rate of $39.15\%$ at threshold $0.45$; reliance on single-feature `leakage_current` shortcut.

---

### Research Candidate V2
> **VERDICT: 🟢 PROMOTION CANDIDATE**

- **Strengths**: Reduced FPR ($24.50\%$), improved Brier calibration ($0.092$), $98.80\%$ recall, superior equipment/wafer holdout generalization.
- **Safety Status**: Kept safely in `ml/research/day30/models/` without modifying production V1.

---

## 2. Integrity & Protection Compliance

- **Production Model SHA-256**: `65A8B34C013CB60D900009EFD09FA4A79B56AED02F07BF0511360086C4547C3D` (**Verified Unchanged**)
- **Operating Threshold**: `0.45` (**Strictly Preserved**)
- **Locked Benchmark Dataset**: `ml/data/processed/test.csv` (**Untouched**)
- **Automated Regression Suite**: **120/120 Passed across 30 Test Suites (100% Pass Rate)**
