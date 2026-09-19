# PREDICTA-26 — Authoritative 168-Hour Prognostics Architecture & Evaluation Foundation

## 1. Problem Definition & Operational Scope
Semiconductor components deployed in high-reliability applications (spacecraft avionics, automotive controllers, defense radar) require early screening to catch latent defect wear-out mechanisms before deployment. 

Burn-in stress testing screens early failures, but components exhibiting latent defect mechanisms may pass initial 24-hour screening while degrading past parametric tolerance limits by 168 hours of accelerated stress.

* **Target Task:** `latent_168h_failure_prognostics`
* **Prediction Horizon:** `168 hours`
* **Early Decision Checkpoint:** `24 hours`
* **Authoritative Target:** `latent_168h_failure`

```
0h (ATE Baseline) + 24h (Early Burn-In) Telemetry
                      ↓
    Early Degradation Features & Drift Rates
                      ↓
  Prognostic Target Inference (Early Screening)
                      ↓
   168h Retrospective Ground Truth Verification
```

---

## 2. Target Semantics & Trajectory States
The authoritative 168h prognostic target answers:
> *"Given observable telemetry at 0h and 24h, does this component pass early screening but experience parametric degradation exceeding specification limits by 168h?"*

$$\text{latent\_168h\_failure} = \begin{cases} 1 & \text{if } \text{state\_24h} = \text{PASS} \text{ and } \text{state\_168h} = \text{FAIL} \\ 0 & \text{otherwise} \end{cases}$$

### Explicit Trajectory Semantic States:
1. **`PASS_24H_PASS_168H`** — Healthy component passing both 24h screening and 168h qualification stress (`latent_168h_failure = 0`).
2. **`PASS_24H_FAIL_168H`** — **True Latent Defect**: Passed initial 24h screening but degraded past parametric limits by 168h (`latent_168h_failure = 1`).
3. **`FAIL_24H_FAIL_168H`** — Early gross failure visible at 24h screening (`latent_168h_failure = 0`). Quarantined immediately at 24h; explicitly excluded from the latent defect class to prevent artificial metric inflation.
4. **`FAIL_24H_PASS_168H`** — Early 24h anomaly followed by normal 168h reading (`latent_168h_failure = 0`).
5. **`INSUFFICIENT_HISTORY`** — Missing 24h or 168h telemetry checkpoint; ground truth unknown (`latent_168h_failure = null`).

---

## 3. Strict Temporal Leakage Protection
To prevent lookahead bias and artificial accuracy claims, feature engineering and model inputs enforce strict temporal boundaries:

| Category | Allowed Checkpoints | Field Examples | Policy |
| :--- | :--- | :--- | :--- |
| **EARLY_OBSERVABLE** | $t \le 24\text{h}$ | `iddq_0h`, `ileak_0h`, `tpd_0h`, `iddq_24h`, `ileak_24h`, `tpd_24h`, `iddq_drift_24h`, `ileak_drift_24h`, `tpd_drift_24h` | **Authorized for early screening inference** |
| **FUTURE_GROUND_TRUTH** | $t > 24\text{h}$ (168h) | `iddq_168h_ground_truth`, `ileak_168h_ground_truth`, `tpd_168h_ground_truth`, `state_168h`, `latent_168h_failure` | **STRICTLY FORBIDDEN in prediction features; evaluation only** |
| **IDENTIFIERS** | N/A | `component_id`, `die_id`, `test_id` | **Forbidden as model features to prevent memorization** |

Model input validators (`validate_early_feature_input`) reject any input containing forbidden tokens (`168`, `96`, `48`, `future`, `ground_truth`, `post_burn_in`, `state_168`, `result_168`, `target`), missing keys, extra keys, reordered keys, or non-finite numbers (NaN/Inf).

---

## 4. Lot-Held-Out Disjoint Split Strategy
To ensure true generalizability across fabrication batches, dataset splitting follows the Stage 3 authoritative split manifest (`ml/data/split_manifest.json`):

* **Train Partition (35 lots, 70%):** `LOT-SYN-001` through `LOT-SYN-035` (3,500 components).
* **Validation_Tune Partition (3 lots, 6%):** `LOT-SYN-036` through `LOT-SYN-038` (300 components).
* **Calibration Partition (4 lots, 8%):** `LOT-SYN-039` through `LOT-SYN-042` (400 components).
* **Held-Out Test Partition (8 lots, 16%):** `LOT-SYN-043` through `LOT-SYN-050` (800 components).

### Threshold Governance
* Operating decision thresholds are tuned **strictly on the Validation_Tune partition** (optimizing $F_2$ score to prioritize high recall on latent defect escapes).
* The selected threshold is **frozen** prior to evaluating the held-out Test cohort. Test set threshold optimization is strictly prohibited.

---

## 5. Evaluation Metrics & Standards
Standardized future-failure metrics computed on the held-out test cohort:
* **Support:** Total components, positive latent failures, negative components.
* **Recall (Sensitivity / True Positive Rate):** Proportion of true latent failures intercepted at 24h.
* **False Negative Rate (FNR = 1 - Recall):** Proportion of latent defects escaping quarantine (critical spaceflight risk).
* **Precision:** Proportion of flagged components that are genuine latent defects.
* **$F_2$ Score:** Harmonic mean weighted 4x toward recall over precision ($F_2 = \frac{5 \cdot P \cdot R}{4P + R}$).
* **PR-AUC & ROC-AUC:** Area under precision-recall and ROC curves.
* **Confusion Matrix:** $TN, FP, FN, TP$.

All metric calculations handle zero-positive and zero-prediction cases safely without division-by-zero crashes or NaN values.

---

## 6. Production Model Governance & Honest Disclosures
* **Current Status:** `prognostic_model_status = "BENCHMARK_ONLY"`.
* **Calibration Status:** `calibration_status = "NOT_CALIBRATED"`.
* **Production Promotion Lock:** `production_promotion_permitted = false`.

### GPR Model Lineage & Status:
The in-service Gaussian Process Regressor (`predicta_gpr_kernel_artifacts.json`) is designed for continuous multi-point parametric drift trajectory regression (estimating continuous $I_{DDQ}(t)$ and $I_{LEAK}(t)$ degradation curves). It is explicitly designated `INCOMPATIBLE_TRAINING_SCHEMA` for direct binary `latent_168h_failure` classification rather than fabricating performance.

### Scientific & Operational Limitations:
> [!CAUTION]
> 1. **Synthetic Data Disclosure:** All evaluation data (`semiconductor_synthetic_full.csv`) is generated via physics-informed multi-channel degradation simulation.
> 2. **No Flight / Fab Qualification Claims:** Models and screening criteria are project-defined research benchmarks for SIH 2026. They do not constitute manufacturer datasheet limits, ISRO flight-qualified silicon certification, or externally validated commercial ATE programs.
> 3. **Uncalibrated Probabilities:** Baseline model output probabilities are not yet calibrated and should be treated as uncalibrated risk rankings until Stage 5 calibration tasks are completed.
