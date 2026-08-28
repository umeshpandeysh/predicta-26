# PREDICTA — SIH 2026 JUDGE ATTACK & TECHNICAL DEFENSE REPORT

## Executive Summary
This document records 30 hostile technical cross-examination questions simulated during **EXP-14 (SIH Judge Attack Dry Run)**. Every answer is backed by empirical experiment data, code references, and explicit acknowledgment of scientific limitations.

---

### Q1: Why XGBoost instead of Deep Neural Networks (CNN/Transformer)?
- **Best Answer**: GBDT (XGBoost) provides fast inference ($0.034	ext{ ms}$ per die), low memory footprint, and exact feature split interpretability. Tabular ATE telemetry features lack grid/spatial structure where CNNs excel, making tree-based ensembles superior in performance and execution efficiency.
- **Evidence**: EXP-01 baseline benchmark ($0.9913	ext{ ROC-AUC}$ vs $0.9420$ MLP baseline).
- **Limitation**: XGBoost does not natively process raw continuous time-series waveforms without feature extraction.

### Q2: How did you select the operating threshold $	heta^* = 0.20$?
- **Best Answer**: We performed a 5-fold GroupKFold wafer cross-validation sweep ($0.05 ightarrow 0.95$). $	heta^* = 0.20$ maximized FAIL recall ($97.31%$) while keeping false positive rate at $7.70%$.
- **Evidence**: EXP-04 cross-validation sweep (`ml/experiments/EXP-04/cross_validation_results.json`).
- **Limitation**: The threshold is calibrated for a $5:1$ cost ratio of unescaped defects to false alarms.

### Q3: Did you use the locked test set during hyperparameter optimization?
- **Best Answer**: No. Hyperparameter optimization was conducted strictly on `train.csv` and `validation.csv` using 5-fold GroupKFold wafer splits. `test.csv` (10,000 records) was locked until EXP-07.
- **Evidence**: EXP-04 script (`run_exp04_optimization.js`).
- **Limitation**: Training and test sets derive from the same synthetic data generation pipeline.

### Q4: How do you prevent data leakage in temporal equipment prediction?
- **Best Answer**: Wafers are strictly grouped by sequential wafer ID ($WFR-001 ightarrow WFR-080$). Telemetry features for wafer $N$ use strictly past observations ($1 ldots N$). Wafers $N+1 ldots N+H$ are completely isolated.
- **Evidence**: EXP-06 temporal forecasting pipeline (`run_exp06_temporal_gpr.js`).
- **Limitation**: Telemetry assumes constant sampling intervals across wafer processing steps.

### Q5: Why is your ROC-AUC 0.9901? Is the data synthetic?
- **Best Answer**: Yes, the evaluation dataset is synthetic, generated using semiconductor physics equations (Arrhenius, Elmore RC, Subthreshold leakage). Synthetic telemetry has lower random noise than real fab ATE data, resulting in higher separability.
- **Evidence**: Dataset documentation (`docs/FINAL_ML_BENCHMARK_REPORT.md`).
- **Limitation**: Real fab ATE data contains unmodeled environmental noise that will reduce ROC-AUC.

### Q6: What does "zero-day anomaly detection" mean in PREDICTA?
- **Best Answer**: It refers to detecting physical defect patterns that were never present in the supervised GBDT training dataset. PREDICTA uses an unsupervised Open-Set Layer (Isolation Forest + PAT/MAD + COPOD) trained strictly on normal dies ($y=0$).
- **Evidence**: EXP-08 open-set evaluation (`run_exp08_openset_intelligence.js`).
- **Limitation**: Zero-day recall varies by anomaly family (94.33% for severe thermal spikes vs 62.75% for subtle drift).

### Q7: How does the system distinguish sensor failure from semiconductor defects?
- **Best Answer**: PREDICTA's Data Quality Gate pre-filters physically impossible sensor readings (e.g. $V_{	ext{sup}} le 0	ext{V}$, $I_{	ext{tot}} < 0	ext{A}$, $T > 150^circ	ext{C}$) before model inference. If triggered, it outputs `SENSOR_UNRELIABLE` and requests sensor calibration.
- **Evidence**: Data Quality Gate implementation (`src/ingestion/data_quality_gate.js`).
- **Limitation**: Soft sensor drift within physically valid bounds cannot be detected by the quality gate alone.

### Q8: What happens if cleanroom ambient temperature increases by $+5^circ	ext{C}$?
- **Best Answer**: In standard classifiers, FPR explodes to 99%. PREDICTA applies Lot-Relative Z-Score Normalization ($Z_x = rac{x - mu_{	ext{wafer}}}{sigma_{	ext{wafer}}}$), subtracting the wafer lot mean. This provides 100% FPR stability (7.70%) across tested $+2^circ	ext{C}$ to $+10^circ	ext{C}$ shifts.
- **Evidence**: EXP-03 distribution-shift matrix (`ml/experiments/EXP-03/distribution_shift_matrix.json`).
- **Limitation**: Requires a full wafer batch (minimum 20 dies) to compute reliable lot mean and variance.

### Q9: Why use Gaussian Process Regression (GPR) for equipment drift prediction?
- **Best Answer**: GPR provides non-parametric trajectory forecasting with explicit 95% Bayesian confidence intervals ($mu_{168h} pm 1.96,sigma$). This allows scheduling maintenance before upper confidence bounds cross critical safety thresholds.
- **Evidence**: EXP-06 GPR kernel artifacts (`ml/models/predicta_gpr_kernel_artifacts.json`).
- **Limitation**: GPR has $O(N^3)$ training complexity and requires support point sampling for real-time inference.

### Q10: What happens when the ML model and physics root-cause engine disagree?
- **Best Answer**: The Unified Decision Engine synthesizes both scores into multi-criteria risk classes. If GBDT indicates low risk but physics/PAT-MAD flags extreme outliers, the state escalates to `UNKNOWN_ANOMALY` or `ENGINEER_REVIEW`.
- **Evidence**: Unified Decision Engine (`src/decision_engine/decision.js`).
- **Limitation**: Engineering rules require domain parameter tuning when migrating to new fab technology nodes.
