# PREDICTA-26 — Stage 5 168h Prognostic Target & Trajectory Benchmark Report

## 1. Problem Formulation & Authoritative Target
* **Task Name:** `latent_168h_failure`
* **Prediction Horizon:** `168 hours`
* **Decision Checkpoint:** `24 hours`
* **Target Definition:** `latent_168h_failure = 1 when (state_24h == 'PASS') AND (state_168h == 'FAIL'), 0 otherwise`
* **Criteria Source:** `PROJECT_DEFINED_SCREENING_CRITERIA`
* **Criteria Disclaimer:** Criteria are project-defined parametric screening limits for synthetic benchmark evaluation; NOT manufacturer datasheet limits and NOT externally flight/fab qualified.
* **Model Promotion Status:** `BENCHMARK_ONLY` (Promotion Lock Active)
* **Calibration Status:** `NOT_CALIBRATED`

> [!WARNING]
> **SYNTHETIC BENCHMARK DATA ONLY — NOT EXTERNALLY VALIDATED**
> All evaluations are performed on synthetic physics-informed drift simulations.
> Performance does not represent flight-certified qualification or fab-proven limits.

---

## 2. Trajectory State Distribution (Total Components N = 5,000)

| Trajectory State | Semantic Meaning | Total Count | Proportion |
| :--- | :--- | :--- | :--- |
| **PASS_24H_PASS_168H** | Healthy through 168h qualification | 4,733 | 94.66% |
| **PASS_24H_FAIL_168H** | **True Latent Failure (Target = 1)** | 101 | 2.02% |
| **FAIL_24H_FAIL_168H** | Early Failure (quarantined at 24h) | 166 | 3.32% |
| **FAIL_24H_PASS_168H** | Early anomaly recovery | 0 | 0.00% |
| **INSUFFICIENT_HISTORY**| Incomplete checkpoints | 0 | 0.00% |

---

## 3. Baseline Model Performance Comparison on Held-Out Test Cohort (N = 800)

| Metric | Persistence Constant-Zero | Early-Feature HistGradientBoosting (Frozen Threshold) |
| :--- | :---: | :---: |
| **Algorithm** | `PERSISTENCE_CONSTANT_ZERO` | `HIST_GRADIENT_BOOSTING_CLASSIFIER` |
| **Operating Threshold** | `0.5000` | `0.8200` (ValTune-tuned) |
| **Latent F2 Score** | `0.0000` | **`0.9896`** |
| **Latent Recall (TPR)** | `0.00%` | **`100.00%`** |
| **Latent False Negative Rate (FNR)**| `100.00%` | **`0.00%`** |
| **Latent Precision** | `0.00%` | **`95.00%`** |
| **Latent F1 Score** | `0.0000` | **`0.9744`** |
| **Specificity** | `100.00%` | **`99.87%`** |
| **PR-AUC** | `0.0238` | **`1.0000`** |
| **ROC-AUC** | `0.5000` | **`1.0000`** |
| **Confusion Matrix (TP/FN/FP/TN)**| `TP=0, FN=19, FP=0, TN=781` | `TP=19, FN=0, FP=1, TN=780` |

---

## 4. Production GPR Degradation Forecasting Engine Assessment
* **Model Name:** `Predicta Gaussian Process Regressor (GPR)`
* **Compatibility Status:** `INCOMPATIBLE_TRAINING_SCHEMA`
* **Direct 168h Target Evaluation:** `False (Incompatible schema; continuous regression vs binary failure)`
* **Audit Rationale:** Production GPR model is trained for continuous drift trajectory regression (IDDQ/Ileak vs time) and does not natively output binary classification probabilities for the 'latent_168h_failure' target. Direct binary evaluation is not fabricated.
* **Recommended Next Step:** Maintain GPR for continuous parametric health degradation forecasting in Stage 5 Task 2+; use early-feature classification baselines for discrete 168h screening.

---

## 5. Lineage & Governance Integrity
* **Dataset SHA-256:** `e2b969c458864b11ed61a6073ed1356adcbfd6775bb2c44b28023446bf9771fa`
* **Split Strategy:** `LOT_HELD_OUT_DISJOINT` (35 Train lots / 3 ValTune lots / 4 Calibration lots / 8 Held-out Test lots)
* **Lot Contamination:** `0 lots leaked across partitions`
* **Component Contamination:** `0 components leaked across partitions`
* **Temporal Leakage Policy:** `0 future tokens permitted in early screening features`
* **Evaluation Timestamp:** `2026-09-19T20:43:36Z`
