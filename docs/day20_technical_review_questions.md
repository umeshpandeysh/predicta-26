# Predicta Production 2026 — Day 20 Technical Technical Review Question Preparation

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 25 Technical Technical Review Questions & Defensible Answers

### 1. Why XGBoost instead of Deep Learning?
**Answer**: Tabular ATE telemetry features (16 physical measurements + 7 engineered ratios) benefit from tree-based ensembles, which outperform deep neural networks on tabular data, offer sub-25ms CPU inference without GPU overhead, and provide exact physical feature thresholds for explainability.

### 2. Is the dataset real or synthetic?
**Answer**: Predicta was trained on the Predicta Synthetic Dataset v3 (50,000 records) generated using physical CMOS degradation equations (BSIM4 gate leakage, thermal runaways, RC delay models). Real fab deployment would require calibrating feature distributions against specific fab ATE lines.

### 3. How was data leakage prevented?
**Answer**: Split by wafer ID rather than random die sampling. Training set contained 34,000 records (68 wafers); locked test set contained 10,000 records (20 unseen wafers). Zero die from test wafers were exposed during model fitting or hyperparameter search.

### 4. Why operating threshold 0.45?
**Answer**: Threshold 0.45 was chosen during validation search to maximize FAIL recall ($\ge 85\%$) to catch rare, high-cost semiconductor defects (e.g. 100% recall on timing failures).

### 5. Why is the locked test FPR 39.15%?
**Answer**: During training, XGBoost used `scale_pos_weight = 6.7413` to prioritize catching defects. On unseen test wafers with equipment drift, borderline PASS wafers crossed probability `0.45`, producing 3,406 false positives ($39.15\%$ FPR).

### 6. How does the system handle this high FPR operationally?
**Answer**: Predicta introduces a **3-Zone Decision Engine**. Borderline predictions ($0.35 \le P < 0.65$) are routed to **Secondary ATE Testing** rather than automatic scrap disposition, preserving yield while preventing escape of true defects.

### 7. Can operators alter the ML prediction?
**Answer**: No. The ML prediction (`PASS`/`FAIL`) and ML probability ($P$) are strictly **immutable**. Operators submit a separate secondary test result and final disposition (`CONFIRMED_PASS` / `CONFIRMED_FAIL`), preserving auditability.

### 8. How is end-to-end traceability maintained?
**Answer**: Every prediction receives a unique trace ID (`PRED-2026-XXXXXXXX`) that correlates telemetry inputs, ML probability, operational decision, operator actions, and Supabase audit events into a complete timeline.

### 9. What is the production API latency?
**Answer**: Benchmark testing demonstrates sub-25ms batch inference for $N=1000$ records on serverless CPU infrastructure ($0.023$ ms per record).

### 10. What happens if Supabase is temporarily offline?
**Answer**: The system switches seamlessly to in-memory local fallback storage. The UI explicitly displays `DATABASE DISCONNECTED - LOCAL MODE ACTIVE`, ensuring non-blocking operator screening.

### 11-25. Additional Technical Questions Covered:
- **Why wafer-level splitting?**: Prevents spatial autocorrelation leakage across dies on the same wafer.
- **Explainability mechanism**: Identifies physical measurement excursions (e.g. $i_{leak} > 185\mu A$) without making unvalidated causal claims.
- **Equipment context**: 5-dimensional one-hot encoding (`eq_EQP-101`..`105`) disambiguates chamber sensor offsets from true die defects.
- **Vercel architecture**: Node.js serverless functions execute frozen XGBoost JSON rules in light JavaScript without Python runtime dependencies.
- **Security isolation**: Zero service-role credentials in frontend JavaScript or Git repositories.
