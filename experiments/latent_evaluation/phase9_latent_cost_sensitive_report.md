# PREDICTA PHASE 9 — LATENT DEFECT COST-SENSITIVE EVALUATION REPORT

## Executive Summary & Production Status
* **Evaluation Target:** `latent_168h_failure` (`PASS at 24h AND FAIL at 168h`)
* **Phase 9 Predictor Evaluated:** `24H_MULTI_CHANNEL_DRIFT_HEURISTIC_BASELINE` (`HEURISTIC_BASELINE`)
* **Production Model Used:** `False` (Production XGBoost model schema is incompatible with latent 168h failure)
* **Production Promotion Status:** `BENCHMARK_ONLY` (Zero changes to production model, weights, or threshold)
* **Authoritative Production Threshold:** `0.20` (UNTOUCHED & LOCKED)
* **Threshold Selection Partition:** `validation_tune` ONLY (Lots: `['LOT-SYN-036', 'LOT-SYN-037', 'LOT-SYN-038']`)
* **Calibration Lots Used for Threshold Selection:** `False`
* **Benchmark Operating Threshold:** `0.9000` (Optimized strictly on `validation_tune` partition)

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

---

## 2. Explicit Cost Contract Configuration

* **False Negative Cost ($C_{FN}$):** `$500.00` (Escaped latent defect reaching field/flight deployment)
* **False Positive Cost ($C_{FP}$):** `$100.00` (False quarantine / unnecessary extended burn-in)
* **Cost Ratio ($C_{FN} : C_{FP}$):** `5.0:1`
* **Cost Provenance:** `PROJECT_DEFINED_SYNTHETIC_BENCHMARK`

$$\text{Total Cost} = C_{FN} \cdot \text{FN} + C_{FP} \cdot \text{FP}$$

---

## 3. Held-Out Test Cohort Reliability & Cost Evaluation (N = 777)

* **Predictor Evaluated:** `24H_MULTI_CHANNEL_DRIFT_HEURISTIC_BASELINE`

| Evaluation Metric | Frozen Benchmark Threshold ($	heta^* = 0.9000$) | Default Threshold ($	heta = 0.50$) | Production Reference ($	heta = 0.20$) |
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

## 5. Frozen Test Confusion Matrix ($	heta^* = 0.9000$)

```
                      PREDICTED LATENT FAIL    PREDICTED PASS
ACTUAL LATENT FAIL         19                     0           (FN: ESCAPES @ $500 ea = $0.00)
ACTUAL HEALTHY             0                      758         (FP: FALSE ALARM @ $100 ea = $0.00)
```

---

## 6. Governance & Synthetic Data Disclosures

1. **Zero Temporal Leakage:** Prediction features are verified to contain strictly 0h and 24h screening information. Post-24h tokens and ground truth targets are 100% excluded.
2. **Threshold Selection Governance:** Threshold $	heta^* = 0.9000$ was selected exclusively on the `validation_tune` partition (`['LOT-SYN-036', 'LOT-SYN-037', 'LOT-SYN-038']`). Calibration lots were NOT used for threshold selection. Threshold tuning against the held-out test set is strictly prohibited by automated code assertion.
3. **Synthetic Benchmark Disclosure:**  
   > **SYNTHETIC BENCHMARK DISCLOSURE:**  
   > The reported Phase 9 performance measures the existing 24h multi-channel drift heuristic baseline (`24H_MULTI_CHANNEL_DRIFT_HEURISTIC_BASELINE`) against the synthetic latent-defect target. It is NOT: (1) production XGBoost latent-defect performance, (2) real-fab validation, (3) manufacturer-certified qualification evidence, or (4) empirical flight-hardware reliability performance.
