# Red Team Audit — Phase 16: Skeptical Production Evaluator Defense Guide

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## Skeptical Evaluator Defense Guide & Evidence-Based Answers

### 1. "Where did your data come from?"
**Honest Answer**: Predicta was trained on the Predicta Synthetic Semiconductor Dataset (50,000 records) generated using physical CMOS degradation equations (BSIM4 gate leakage, thermal runaways, RC delay models). Real fab deployment would involve calibrating feature distributions against specific fab ATE lines.

### 2. "Why is the false positive rate 39.15% on unseen test wafers?"
**Honest Answer**: During training, XGBoost used `scale_pos_weight = 6.7413` to prioritize catching defects, ensuring zero escapes of catastrophic defects (such as timing violations and gate oxide breakdowns). On unseen test wafers with process drift, borderline PASS wafers crossed probability `0.45`, producing false positives. Predicta mitigates this operationally via the **3-Zone Decision Engine**: borderline predictions ($0.35 \le P < 0.65$) are routed to **Secondary ATE Testing** rather than automatic scrap disposition.

### 3. "Why is Equipment Drift recall only 31.85%?"
**Honest Answer**: In the synthetic data generator (`generate_dataset.py`), `equipment_id` was assigned randomly while physical drift was injected as a small parameter shift. Because machine identity was not tied to drift severity, the one-hot features carried no predictive signal. This is a known synthetic data generator limitation documented in our technical report; in real fabs, chamber sensor logs are directly tied to machine IDs.

### 4. "Can an operator alter the ML prediction?"
**Honest Answer**: No. The original ML prediction (`PASS`/`FAIL`) and ML probability ($P$) are strictly **immutable**. Operators submit a separate secondary test result and final disposition (`CONFIRMED_PASS` / `CONFIRMED_FAIL`), preserving 100% auditability.

### 5. "What exactly is the core AI innovation in Predicta?"
**Honest Answer**: The innovation lies in the **combination of physics-aware feature engineering (7 physical ratios), equipment-context dual encoding, and 3-zone operational triage (LOW_RISK, REVIEW, CRITICAL_FAILURE)** which decouples raw ML probability from high-cost scrap actions.
