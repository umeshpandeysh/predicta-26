# PREDICTA PHASE 9 — LATENT DEFECT COST-SENSITIVE DECISION ANALYSIS REPORT

## Executive Summary & Production Status
* **Evaluation Target:** `latent_168h_failure` (`PASS at 24h AND FAIL at 168h`)
* **Phase 9 Predictor Evaluated:** `24H_MULTI_CHANNEL_DRIFT_HEURISTIC_BASELINE` (`HEURISTIC_BASELINE`)
* **Production Model Used:** `False` (Production XGBoost model schema is incompatible with latent 168h failure without retraining/relabeling)
* **Production Promotion Status:** `BENCHMARK_ONLY` (Zero changes to production model, weights, or threshold)
* **Authoritative Production Threshold:** `0.20` (UNTOUCHED & LOCKED)
* **Threshold Selection Partition:** `validation_tune` ONLY (Lots: `['LOT-SYN-036', 'LOT-SYN-037', 'LOT-SYN-038']`)
* **Calibration Lots Used for Threshold Selection:** `False` (Calibration lots `LOT-SYN-039` to `LOT-SYN-042` strictly excluded)
* **Tie-Breaking Rule:** `1. Minimum total cost; 2. Lower FNR (higher recall); 3. Higher threshold`

---

## 1. Population Eligibility & Class Accounting

| Population Category | Sample Count | Percentage / Prevalence | Description / Eligibility Rule |
| :--- | :--- | :--- | :--- |
| **Total Cohort Components** | 5,000 | 100.00% | Full dataset component population |
| **Excluded (Insufficient History)** | 0 | 0.00% | Missing 24h or 168h history (Never converted to negative) |
| **24h Early Failures (Already Screened)** | 166 | 3.32% | Failed at 24h screening prior to burn-in |
| **Eligible Screening Cohort** | **4,834** | **96.68%** | **Passed 24h screening with valid 168h ground truth** |
| **True Latent Positives (`PASS_24H_FAIL_168H`)** | 101 | **2.09%** (Prevalence) | Passed 24h screening, failed by 168h |
| **Non-Latent Negatives (`PASS_24H_PASS_168H`)** | 4,733 | 97.91% | Passed both 24h screening and 168h burn-in |

* **Class Imbalance Ratio:** `46.8614:1` (Non-Latent Negatives per Latent Positive)
* **Class Imbalance Justification:** Accuracy is scientifically inadequate for this benchmark because latent defects account for only **2.09%** of the population. A trivial classifier predicting "100% PASS" achieves **97.91% accuracy** while suffering a **100% False Negative Rate** (0% recall), letting every defective component escape into deployment.

---

## 2. Multi-Ratio Cost-Sensitivity Decision Analysis (1:1, 2:1, 5:1, 10:1, 20:1)

Below is the decision-boundary analysis illustrating how the validation-selected threshold ($	heta^*_{	ext{val}}$) and frozen held-out test performance shift as the relative cost ratio $C_{	ext{FN}} : C_{	ext{FP}}$ increases from 1:1 to 20:1.

| Cost Ratio ($C_{	ext{FN}}:C_{	ext{FP}}$) | Unit $C_{	ext{FN}}$ | Unit $C_{	ext{FP}}$ | Selected $	heta^*_{	ext{val}}$ | Val Total Cost | Test Total Cost | Test Recall | Test FNR | Test FPR | Test Precision | Test Pred Pos Rate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1:1** | $1.0 | $1.0 | **0.9000** | `$0.00` | `$0.00` | **100.00%** | 0.00% | 0.00% | 100.00% | 2.45% |
| **2:1** | $2.0 | $1.0 | **0.9000** | `$0.00` | `$0.00` | **100.00%** | 0.00% | 0.00% | 100.00% | 2.45% |
| **5:1** | $5.0 | $1.0 | **0.9000** | `$0.00` | `$0.00` | **100.00%** | 0.00% | 0.00% | 100.00% | 2.45% |
| **10:1** | $10.0 | $1.0 | **0.9000** | `$0.00` | `$0.00` | **100.00%** | 0.00% | 0.00% | 100.00% | 2.45% |
| **20:1** | $20.0 | $1.0 | **0.9000** | `$0.00` | `$0.00` | **100.00%** | 0.00% | 0.00% | 100.00% | 2.45% |

---

## 3. Held-Out Test Cohort Reliability & Cost Evaluation (N = 777)

* **Predictor Evaluated:** `24H_MULTI_CHANNEL_DRIFT_HEURISTIC_BASELINE`

| Evaluation Metric | Frozen Benchmark Threshold ($	heta^* = 0.9000) | Default Threshold ($	heta = 0.50$) | Production Reference ($	heta = 0.20$) |
| :--- | :--- | :--- | :--- |
| **Latent Recall (Sensitivity)** | **100.00%** | 100.00% | 100.00% |
| **False Negative Rate (FNR)** | **0.00%** | 0.00% | 0.00% |
| **Precision** | **100.00%** | 2.45% | 2.45% |
| **F1 Score** | **1.0000** | 0.0477 | 0.0477 |
| **F2 Score** | **1.0000** | 0.1114 | 0.1114 |
| **Specificity (TNR)** | **100.00%** | 0.00% | 0.00% |
| **False Positive Rate (FPR)** | **0.00%** | 100.00% | 100.00% |
| **ROC-AUC** | **0.9993** | 0.9993 | 0.9993 |
| **PR-AUC** | **0.9487** | 0.9487 | 0.9487 |
| **False Negatives (FN)** | **0** | 0 | 0 |
| **False Positives (FP)** | **0** | 758 | 758 |
| **Total Decision Cost** | **$0.00** | $75,800.00 | $75,800.00 |
| **Cost / Eligible Sample** | **$0.00** | $97.55 | $97.55 |
| **Normalized Cost** | **0.0000** | 7.9789 | 7.9789 |

---

## 4. Anomaly Evidence & Detector Assessment

* **Available Anomaly Detectors:** `RobustMAD`, `COPOD`, `MultiChannelDrift`
* **Phase 9 Predictor Used:** `24H_MULTI_CHANNEL_DRIFT_HEURISTIC_BASELINE`
* **Anomaly Scores Used for Primary Metrics:** `False` (Anomaly evidence is kept 100% separate from Latent Defect Ground Truth)

---

## 5. Governance & Synthetic Data Disclosures

1. **Zero Temporal Leakage:** Prediction features are verified to contain strictly 0h and 24h screening information. Post-24h tokens and ground truth targets are 100% excluded.
2. **Threshold Selection Governance:** Threshold $	heta^*$ was selected exclusively on the `validation_tune` partition (`['LOT-SYN-036', 'LOT-SYN-037', 'LOT-SYN-038']`). Calibration lots were NOT used for threshold selection. Threshold tuning against the held-out test set is strictly prohibited by automated code assertion.
3. **Synthetic Benchmark & Provenance Disclosure:**  
   > **SYNTHETIC BENCHMARK & PROVENANCE DISCLOSURE:**  
   > The reported Phase 9 performance measures the existing 24h multi-channel drift heuristic baseline (`24H_MULTI_CHANNEL_DRIFT_HEURISTIC_BASELINE`, type `HEURISTIC_BASELINE`, production model used = `False`) against the synthetic latent-defect target. Production XGBoost is incompatible with `latent_168h_failure` without retraining/relabeling. These results are synthetic benchmark results and are NOT: (1) production XGBoost latent-defect performance, (2) real-fab validation, (3) manufacturer-certified qualification evidence, (4) empirical semiconductor economic cost, (5) evidence of zero field escapes, or (6) a production disposition policy.
