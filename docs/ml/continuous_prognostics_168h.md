# PREDICTA-26 — Authoritative Continuous 168-Hour Prognostic Trajectory Forecasting

## 1. Problem Definition & Operational Scope

In high-reliability semiconductor qualification, binary latent-failure screening (Stage 5 Task 1) is extended to continuous degradation trajectory forecasting. Instead of a single binary wear-out decision at 168 hours, engineering teams require multi-horizon parameter drift forecasts to:

1. Project the continuous evolution of critical parametric indicators (**IDDQ**, **Ileak**, **TPD**) across accelerated burn-in stress.
2. Predict the exact hour and direction of projected tolerance limit breaches.
3. Quantify empirical predictive uncertainty to guide early qualification and lot dispositioning.

### Operational Context
* **Task Name:** `continuous_168h_trajectory_forecasting`
* **Forecast Origin:** $t_{\text{origin}} = 24\text{h}$ (Strictly early telemetry from 0h ATE baseline, 24h early burn-in, and 24h drift)
* **Supported Forecast Horizons:** $t \in [24, 48, 72, 96, 120, 144, 168]\text{h}$
* **Evaluated Ground-Truth Horizons:** $96\text{h}$ and $168\text{h}$ (longitudinal burn-in checkpoints)
* **Target Parameters & Units:**
  * `iddq` — Quiescent supply current ($\mu\text{A}$)
  * `ileak` — Gate leakage current ($\mu\text{A}$)
  * `tpd` — Propagation delay ($\text{ns}$)
* **Model Status:** `BENCHMARK_ONLY`
* **Calibration Status:** `NOT_CALIBRATED` (Stage 5 baseline; formal conformal calibration scheduled for Stage 6)

```
0h (ATE Baseline) + 24h (Early Telemetry) + Δ24h Drift
                        ↓
      Strict Temporal Leakage Feature Validator
                        ↓
     Deterministic Continuous Degradation Model
                        ↓
  Multi-Horizon Forecasts: 24h → 48h → 72h → 96h → 120h → 144h → 168h
  Empirical Uncertainty Bands (NOT_CALIBRATED)
  Screening Limit Threshold Crossing Projections
```

---

## 2. Strict Temporal Leakage Defense

To prevent lookahead bias and artificial accuracy claims, feature engineering and inference boundaries strictly isolate early observations from future ground-truth data:

| Feature Category | Allowed Checkpoints | Parameter Fields | Policy |
| :--- | :--- | :--- | :--- |
| **EARLY_OBSERVABLE** | $t \le 24\text{h}$ | `iddq_0h`, `ileak_0h`, `tpd_0h`, `iddq_24h`, `ileak_24h`, `tpd_24h`, `iddq_drift_24h`, `ileak_drift_24h`, `tpd_drift_24h` | **Authorized for early forecasting inference** |
| **FUTURE_GROUND_TRUTH** | $t > 24\text{h}$ (48h..168h) | `iddq_96h`, `iddq_168h`, `ileak_96h`, `ileak_168h`, `tpd_96h`, `tpd_168h` | **STRICTLY FORBIDDEN in forecasting feature sets; evaluation only** |
| **IDENTIFIERS & METADATA** | Static | `component_id`, `lot_id`, `wafer_id` | **Forbidden as model features to prevent memorization** |

The input validator (`validate_continuous_feature_input`) actively rejects:
- Any dictionary containing forbidden leakage tokens (`168`, `96`, `48`, `72`, `120`, `144`, `future`, `ground_truth`, `post_burn_in`, `target`).
- Missing or extra feature keys.
- Schema order permutations.
- Non-numeric or non-finite values (`NaN`, `Inf`, strings).

---

## 3. Evaluated Models & Mathematical Formulations

### 3.1 Continuous Persistence Baseline (`ContinuousPersistenceBaseline`)
Serves as the zero-drift benchmark model. Assumes that parametric degradation remains constant from the 24h forecast origin:

$$\hat{p}_i(t) = p_i(24\text{h}) \quad \forall t \in [24, 48, 72, 96, 120, 144, 168]\text{h}$$

### 3.2 Deterministic Continuous Degradation Model (`DeterministicContinuousDegradationModel`)
A closed-form, regularized parametric regression model trained strictly on early observations:

$$\mathbf{x}_i = [1, p_i(0\text{h}), p_i(24\text{h}), \Delta p_i(24\text{h})]^T$$

$$\mathbf{w}^* = (\mathbf{X}_{\text{train}}^T \mathbf{X}_{\text{train}} + \alpha \mathbf{I})^{-1} \mathbf{X}_{\text{train}}^T \mathbf{y}_{\text{train}}$$

* **Hyperparameter Selection:** Regularization parameter $\alpha \in [0.001, 0.01, 0.1, 1.0, 10.0, 100.0]$ is tuned **strictly on the Validation_Tune partition** to minimize validation RMSE.
* **Frozen Test Evaluation:** The model weights $\mathbf{w}^*$ and $\alpha$ are permanently frozen before evaluating the held-out test cohort. Any attempt to tune hyperparameters on test data raises a structural `ValueError`.
* **Multi-Horizon Interpolation:** Trajectories across intermediate horizons ($48\text{h}, 72\text{h}, 120\text{h}, 144\text{h}$) are generated via piecewise linear trajectory projection anchored at $24\text{h}$, $96\text{h}$, and $168\text{h}$.

---

## 4. Standardized Continuous Regression Metrics

Standard regression evaluation metrics computed across true observations $y_i$ and predictions $\hat{y}_i$:

1. **Mean Absolute Error (MAE):**
   $$\text{MAE} = \frac{1}{N} \sum_{i=1}^N |y_i - \hat{y}_i|$$
2. **Root Mean Squared Error (RMSE):**
   $$\text{RMSE} = \sqrt{\frac{1}{N} \sum_{i=1}^N (y_i - \hat{y}_i)^2}$$
3. **Median Absolute Error (MedAE):**
   $$\text{MedAE} = \text{median}(|y_i - \hat{y}_i|)$$
4. **Maximum Absolute Error (MaxAE):**
   $$\text{MaxAE} = \max_{i} (|y_i - \hat{y}_i|)$$
5. **Normalized RMSE (NRMSE):**
   $$\text{NRMSE} = \frac{\text{RMSE}}{\max(|\bar{y}|, 10^{-6})}$$

---

## 5. Screening Threshold Crossing Projections

Forecasted parameter trajectories are projected against project-defined parametric screening limits:

| Parameter | Screening Limit | Threshold Criterion Type |
| :--- | :--- | :--- |
| `iddq` | $5000.0\,\mu\text{A}$ | `PROJECT_DEFINED_SCREENING_CRITERION` |
| `ileak` | $500.0\,\mu\text{A}$ | `PROJECT_DEFINED_SCREENING_CRITERION` |
| `tpd` | $250.0\,\text{ns}$ | `PROJECT_DEFINED_SCREENING_CRITERION` |

* **Breach Identification:** Identifies earliest crossing hour $t_{\text{breach}} \in [24, 48, 72, 96, 120, 144, 168]\text{h}$ where $\hat{p}(t) > p_{\text{limit}}$.
* **Screening Disclaimer:** All screening limits are project-defined synthetic screening criteria, not manufacturer datasheet guarantees or externally certified space-flight thresholds.

---

## 6. Empirical Uncertainty Diagnostics Governance

Prediction intervals are derived from empirical validation residual standard deviations ($\sigma_{\text{val}}$):

$$\hat{y}_i \pm 1.645 \cdot \sigma_{\text{val}}$$

> **CRITICAL GOVERNANCE POLICY:**  
> These intervals are explicitly labeled **`NOT_CALIBRATED`**. They provide empirical diagnostic spreads for simulation and evaluation purposes only. Formal conformal residual calibration for finite-sample coverage estimation is part of Stage 6.

---

## 7. Legacy GPR Artifact Audit

The legacy Gaussian Process Regression artifact located at:
`ml/models/production/predicta_gpr_kernel_artifacts.json`

was audited against the authoritative Stage 5 continuous prognostic specification:
* **Status:** `INCOMPATIBLE_TRAINING_SCHEMA`
* **Promotion Eligible:** `False`
* **Rejection Rationale:** Trained on non-authoritative lot partitioning (`LOT-SYN-001..030`) that contaminates the authoritative validation tuning (`LOT-SYN-036..038`) and calibration (`LOT-SYN-039..042`) cohorts, and lacks multi-horizon trajectory projection targets.

---

## 8. Lot Partitioning & Synthetic Data Governance

* **Dataset:** `data/synthetic/semiconductor_synthetic_full.csv`
* **SHA-256:** `e2b969c458864b11ed61a6073ed1356adcbfd6775bb2c44b28023446bf9771fa`
* **Train Partition (35 lots, 3,500 samples):** `LOT-SYN-001` .. `LOT-SYN-035`
* **Validation Tuning Partition (3 lots, 300 samples):** `LOT-SYN-036` .. `LOT-SYN-038`
* **Calibration Partition (4 lots, 400 samples):** `LOT-SYN-039` .. `LOT-SYN-042`
* **Held-Out Test Partition (8 lots, 800 samples):** `LOT-SYN-043` .. `LOT-SYN-050`

> **DISCLAIMER:** All telemetry in this repository is synthetic data generated for software testing and algorithmic research. It does not represent flight telemetry, fab-certified silicon data, or manufacturer qualification tests.
