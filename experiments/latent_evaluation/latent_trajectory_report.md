# PREDICTA — AUTHORITATIVE LATENT-168H TRAJECTORY EVALUATION REPORT

## 1. Executive Summary & Problem Formulation
The SIH semiconductor reliability challenge requires early screening of components that appear acceptable at 24h but fail by 168h of burn-in stress.

* **Authoritative Target:** `latent_168h_failure`
* **Target Definition:** `PASS at 24h AND FAIL at 168h`
* **Evaluation Criteria:** `PROJECT_DEFINED_SCREENING_CRITERIA`

---

## 2. Component Trajectory State Distribution (Total N = 5,000)

| Trajectory State | Semantic Meaning | Count | Percentage |
| :--- | :--- | :--- | :--- |
| **PASS_24H_PASS_168H** | Healthy through 168h burn-in | 4,733 | 94.66% |
| **PASS_24H_FAIL_168H** | **True SIH Latent Failure** | 101 | 2.02% |
| **FAIL_24H_FAIL_168H** | Early Failure (already failed at 24h) | 166 | 3.32% |
| **FAIL_24H_PASS_168H** | Anomaly recovery | 0 | 0.00% |
| **INSUFFICIENT_HISTORY**| Missing telemetry | 0 | 0.00% |

---

## 3. Early-Screening Latent Failure Prediction on Held-Out Test Cohort (N = 800)

| Metric | Screening Performance (Threshold = 0.50) | Engineering Interpretation |
| :--- | :--- | :--- |
| **Latent Recall** | **100.00%** | Proportion of true latent wear-outs screened early |
| **False Negative Rate** | **0.00%** | Uncaught defect rate escaping to long-term deployment |
| **Latent F2-Score** | **0.1084** | Recall-emphasized composite reliability metric |
| **Precision** | **2.38%** | Accuracy of early quarantine recommendations |
| **PR-AUC** | **0.474** | Area under precision-recall curve across thresholds |
| **ROC-AUC** | **0.9942** | Multi-threshold discriminative capacity |

### Held-Out Test Confusion Matrix

```
                      PREDICTED LATENT FAIL    PREDICTED PASS
ACTUAL LATENT FAIL         19                     0           (FN: ESCAPES)
ACTUAL HEALTHY             781                    0           (FP: FALSE QUARANTINE)
```

---

## 4. Production Model Assessment
* **Model Status:** `INCOMPATIBLE_TRAINING_SCHEMA`
* **Explanation:** Production model 'predicta_xgboost_model.json' was trained on static single-snapshot ATE screening data ('predicta_dataset_v3_50000.csv') with 28 ATE features targeting instantaneous qualification ('result'). It does not contain longitudinal 0h->24h->168h burn-in telemetry labels and cannot directly evaluate the 'latent_168h_failure' trajectory target without retraining/relabeling.

---

## 5. Dataset & Lineage Provenance
* **Dataset Path:** `data/synthetic/semiconductor_synthetic_full.csv`
* **Dataset SHA-256:** `e2b969c458864b11ed61a6073ed1356adcbfd6775bb2c44b28023446bf9771fa`
* **Split Strategy:** `LOT_HELD_OUT_DISJOINT`
* **Evaluation Timestamp:** `2026-09-15T18:36:05Z`

---

## 6. Scientific Presentation & Integrity Disclosure
> **SYNTHETIC BENCHMARK DISCLOSURE**
> All metrics reported above were obtained using physics-informed synthetic semiconductor telemetry. They represent reproducible algorithmic verification of the latent trajectory evaluation contract and must not be cited as empirical real-fab qualification data.
