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

> [!NOTE]
> Early failures already visible at 24h (`FAIL_24H_FAIL_168H`) are **explicitly excluded** from `latent_168h_failure`, preventing artificial metric inflation.

---

## 3. Early Screening Evaluation on Held-Out Lots (Test N = 800)

Evaluation performed with strict temporal leakage prevention (zero 168h features available during screening).

### Standard Operating Threshold (0.50)
* **Latent Recall:** `100.0%`
* **Latent False Negative Rate (FNR):** `0.0%`
* **Precision:** `6.9%`
* **F1 Score:** `0.1288`
* **F2 Score (Recall-Prioritized):** `0.2699`
* **PR-AUC:** `0.4096`
* **ROC-AUC:** `0.9840`
* **Confusion Matrix:** TP=19, FN=0, FP=257, TN=524

### Safety-Oriented High-Recall Threshold (0.35)
* **Latent Recall:** `100.0%`
* **Latent False Negative Rate (FNR):** `0.0%`
* **Precision:** `2.6%`
* **F1 Score:** `0.0504`
* **F2 Score (Recall-Prioritized):** `0.1171`

---

## 4. Current Production Model Assessment
* **Model Name:** `Predicta Binary XGBoost` (2.0_production)
* **Model SHA-256:** `9c671a615cf253746181f2391a095d496344b45a936ebebe8a5971508521fbba`
* **Training Target:** `result (single ATE snapshot)`
* **Compatibility Status:** `INCOMPATIBLE_TRAINING_SCHEMA`
* **Directly Evaluatable on Latent-168h:** `False`
* **Requires Retraining / Relabeling:** `True`

### Limitation Rationale
Production model 'predicta_xgboost_model.json' was trained on static single-snapshot ATE screening data ('predicta_dataset_v3_50000.csv') with 28 ATE features targeting instantaneous qualification ('result'). It does not contain longitudinal 0h->24h->168h burn-in telemetry labels and cannot directly evaluate the 'latent_168h_failure' trajectory target without retraining/relabeling.

### Recommended Operational Action
Preserve production model operational for 28-feature single-station ATE screening. Deploy longitudinal GPR drift forecasting engine and retrain specialized trajectory screening model on trajectory-level latent_168h_failure labels.

---

## 5. Dataset & Lineage Provenance
* **Dataset Path:** `data/synthetic/semiconductor_synthetic_full.csv`
* **Dataset SHA-256:** `e2b969c458864b11ed61a6073ed1356adcbfd6775bb2c44b28023446bf9771fa`
* **Split Strategy:** `LOT_HELD_OUT_DISJOINT`
* **Evaluation Timestamp:** `2026-09-15T15:08:30Z`
