# Authoritative Stage 6 Conformal Residual Calibration Specification

> **SYNTHETIC DATA DISCLAIMER:** All telemetry, test records, and parametric degradation measurements within this platform are generated synthetically for machine learning simulation and benchmark validation. None represent real-world fab qualifications or flight-certified semiconductor components.

---

## 1. Background & Scope of Stage 6

In Stage 5, the Predicta continuous prognostic engine established deterministic point forecasting for semiconductor degradation trajectories across 168 hours of burn-in testing ($\text{IDDQ}$, $\text{I}_{\text{leak}}$, $\text{T}_{\text{pd}}$ at horizons 24h, 48h, 72h, 96h, 120h, 144h, 168h).

However, point predictions $\hat{y}$ alone lack certified uncertainty bounds. Stage 6 introduces a distribution-free, finite-sample **Split-Conformal Residual Calibration** framework to construct statistically governed prediction intervals around the continuous point forecasts.

### Critical Status Governance
- **Calibration Method:** `CONFORMAL_RESIDUAL_CALIBRATION` (IMPLEMENTED)
- **Calibration Status:** `NOT_CALIBRATED` (Formally gated pending independent empirical review and flight qualification)
- **Model Status:** `BENCHMARK_ONLY`

A prediction interval is **not** automatically a calibrated interval. The platform uses the terminology **"nominal $(1-\alpha)$ conformal prediction interval"** (e.g. *nominal 95% conformal prediction interval*), and explicitly rejects claims of parametric "95% confidence intervals".

---

## 2. Split-Conformal Methodology & Cohort Isolation

To prevent data leakage and guarantee valid finite-sample coverage guarantees, the dataset is strictly partitioned across wafer lots:

```
Authoritative Synthetic Dataset (5,000 components across 50 Lots)
SHA-256: e2b969c458864b11ed61a6073ed1356adcbfd6775bb2c44b28023446bf9771fa
 │
 ├── TRAIN SPLIT: LOT-SYN-001 .. LOT-SYN-035 (3,500 components)
 │    └── Fits degradation regression base weights
 │
 ├── VALIDATION SPLIT: LOT-SYN-036 .. LOT-SYN-042 (700 components)
 │    └── Hyperparameter tuning (L2 alpha)
 │    └── Exclusively used to compute calibration residuals & conformal quantiles
 │
 └── TEST SPLIT: LOT-SYN-043 .. LOT-SYN-050 (800 components)
      └── Held-out frozen evaluation ONLY
      └── NEVER touches calibration fitting API
```

### Zero-Leakage Architecture
The calibrator interface strictly isolates fitting from evaluation:
- `calibrator.fit(val_preds, val_targets, split_name="VALIDATION")`: Validates that `split_name == "VALIDATION"`. Rejects `split_name == "TEST"` with `TEST_SPLIT_LEAKAGE_REJECTED`.
- `calibrator.apply(test_preds)`: Accepts **predictions only**, structurally preventing test ground-truth leakage into the quantile estimator.
- `calibrator.evaluate_coverage(intervals, test_targets)`: Evaluates empirical test coverage without modifying the frozen calibration parameters.

---

## 3. Mathematical Residual & Quantile Derivation

For each parameter $p \in \{\text{iddq}, \text{ileak}, \text{tpd}\}$ and horizon $h \in \{96\text{h}, 168\text{h}\}$:

### 1. Absolute Nonconformity Score
For each validation sample $i \in \{1, \dots, n\}$ (where $n = 700$):
$$R_i(p, h) = \left| y_i(p, h) - \hat{y}_i(p, h) \right|$$

### 2. Finite-Sample Conformal Quantile Formula
Residuals are sorted in ascending order:
$$R_{(1)} \le R_{(2)} \le \dots \le R_{(n)}$$

For nominal coverage level $1 - \alpha \in \{0.80, 0.90, 0.95\}$:
$$k = \min\left(n, \left\lceil (n + 1)(1 - \alpha) \right\rceil\right)$$

In zero-indexed array representation:
$$\text{index} = k - 1$$
$$q(p, h, 1 - \alpha) = R_{(k)}$$

### 3. Prediction Interval Construction
For any test point prediction $\hat{y}$:
$$\text{Lower Bound} = \hat{y} - q(p, h, 1 - \alpha)$$
$$\text{Upper Bound} = \hat{y} + q(p, h, 1 - \alpha)$$
$$\text{Interval Width} = 2 \cdot q(p, h, 1 - \alpha)$$

Intervals are **never** artificially clipped to project screening limits during uncertainty estimation.

---

## 4. Grouping Granularity

Quantiles are computed separately for each `(parameter x horizon x nominal_level)` tuple:
- `IDDQ @ 96h`
- `IDDQ @ 168h`
- `Ileak @ 96h`
- `Ileak @ 168h`
- `TPD @ 96h`
- `TPD @ 168h`

Parameters and horizons are **never silently pooled**, preserving parameter-specific physics and noise scales.

---

## 5. Frozen Calibration Artifact

Once fitted on the validation cohort, the calibration parameters are exported to `ml/models/production/conformal_calibration_artifacts.json` with a cryptographic content SHA-256 hash.

### Empirical Summary (Test Set $n=800$)

| Parameter | Horizon | Nominal Coverage | Observed Test Coverage | Coverage Error | Conformal Quantile ($q$) | Mean Interval Width |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **IDDQ** | 96h | 80.0% | 76.88% | -3.12% | 33.51 $\mu\text{A}$ | 67.02 $\mu\text{A}$ |
| **IDDQ** | 96h | 90.0% | 87.88% | -2.12% | 43.63 $\mu\text{A}$ | 87.27 $\mu\text{A}$ |
| **IDDQ** | 96h | 95.0% | 94.00% | -1.00% | 54.25 $\mu\text{A}$ | 108.51 $\mu\text{A}$ |
| **IDDQ** | 168h | 80.0% | 80.12% | +0.12% | 35.62 $\mu\text{A}$ | 71.24 $\mu\text{A}$ |
| **IDDQ** | 168h | 90.0% | 88.75% | -1.25% | 46.71 $\mu\text{A}$ | 93.42 $\mu\text{A}$ |
| **IDDQ** | 168h | 95.0% | 94.75% | -0.25% | 57.66 $\mu\text{A}$ | 115.32 $\mu\text{A}$ |
| **ILEAK** | 96h | 80.0% | 79.00% | -1.00% | 4.86 $\mu\text{A}$ | 9.71 $\mu\text{A}$ |
| **ILEAK** | 96h | 90.0% | 87.62% | -2.38% | 6.11 $\mu\text{A}$ | 12.21 $\mu\text{A}$ |
| **ILEAK** | 96h | 95.0% | 94.38% | -0.62% | 7.46 $\mu\text{A}$ | 14.92 $\mu\text{A}$ |
| **ILEAK** | 168h | 80.0% | 77.62% | -2.38% | 4.76 $\mu\text{A}$ | 9.51 $\mu\text{A}$ |
| **ILEAK** | 168h | 90.0% | 87.62% | -2.38% | 6.10 $\mu\text{A}$ | 12.19 $\mu\text{A}$ |
| **ILEAK** | 168h | 95.0% | 93.00% | -2.00% | 7.42 $\mu\text{A}$ | 14.84 $\mu\text{A}$ |
| **TPD** | 96h | 80.0% | 76.88% | -3.12% | 4.10 $\text{ns}$ | 8.20 $\text{ns}$ |
| **TPD** | 96h | 90.0% | 87.00% | -3.00% | 5.21 $\text{ns}$ | 10.42 $\text{ns}$ |
| **TPD** | 96h | 95.0% | 92.25% | -2.75% | 6.10 $\text{ns}$ | 12.20 $\text{ns}$ |
| **TPD** | 168h | 80.0% | 79.88% | -0.13% | 4.52 $\text{ns}$ | 9.04 $\text{ns}$ |
| **TPD** | 168h | 90.0% | 88.38% | -1.62% | 5.79 $\text{ns}$ | 11.58 $\text{ns}$ |
| **TPD** | 168h | 95.0% | 94.25% | -0.75% | 7.35 $\text{ns}$ | 14.69 $\text{ns}$ |

---

## 6. Limitations & Future Roadmap

1. **Exchangeability Assumption:** Split-conformal guarantees rely on exchangeability between the validation and test cohorts. Lot-level covariate shift across fabrication runs can lead to slight empirical undercoverage (1–3% observed).
2. **Homoscedasticity:** Constant quantile width $q(p, h)$ does not adapt to individual component noise scale. Locally adaptive conformal prediction (e.g., CQR) will be explored in subsequent stages.
3. **No External Fab Certification:** All calibration statistics are derived from synthetic benchmark data.
