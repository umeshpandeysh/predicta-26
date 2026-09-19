# PREDICTA-26 — Stage 6 Task 1A Conformal Calibration Benchmark Report

## 1. Executive Summary & Calibration Status
- **Method:** Split-Conformal Residual Calibration (`CONFORMAL_RESIDUAL_CALIBRATION`)
- **Status:** `NOT_CALIBRATED` (Promotion Lock Active)
- **Model Status:** `BENCHMARK_ONLY`
- **Evaluation Timestamp (UTC):** `2026-09-19T21:12:43.160831+00:00`
- **Dataset SHA-256:** `e2b969c458864b11ed61a6073ed1356adcbfd6775bb2c44b28023446bf9771fa`
- **Contract SHA-256:** `943f7b3561bc34b85e36a8a9d1db5ea0672a232effc6a008fb464b20c8704975`
- **Split Manifest SHA-256:** `1764dff377386bf41f95f9bb96afb71dd01404bf65bdec9e324ba31afcf7a8dd`
- **Calibration Artifact SHA-256:** `198eaa50f5af96aa85721f168abc947a6cabfc02d91f77d1a032c343f85e7e7e`

---

## 2. Four-Way Lot-Disjoint Cohort Partitioning
| Cohort | Lots | Count | Purpose |
| :--- | :--- | :--- | :--- |
| **TRAIN** | LOT-SYN-001..035 (35 lots) | 3500 | Point forecaster parameter fitting |
| **VALIDATION_TUNE** | LOT-SYN-036..038 (3 lots) | 300 | Model selection & hyperparameter tuning |
| **CALIBRATION** | LOT-SYN-039..042 (4 lots) | 400 | Conformal nonconformity quantile estimation ONLY |
| **TEST** | LOT-SYN-043..050 (8 lots) | 800 | Final frozen empirical coverage evaluation |

> [!IMPORTANT]
> The point forecasting model was trained on `TRAIN` and tuned on `VALIDATION_TUNE`.
> The model configuration was frozen before nonconformity residuals were calculated on `CALIBRATION`.
> The `TEST` cohort remained strictly isolated until final coverage evaluation.

---

## 3. Parameter × Horizon Governance Status Matrix ($3 \times 7 = 21$ Groups)
| Parameter | 24h | 48h | 72h | 96h | 120h | 144h | 168h |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **IDDQ** | `NOT_EVALUATED` | `DATA_UNAVAILABLE` | `DATA_UNAVAILABLE` | `CALIBRATED_CANDIDATE` | `DATA_UNAVAILABLE` | `DATA_UNAVAILABLE` | `CALIBRATED_CANDIDATE` |
| **Ileak** | `NOT_EVALUATED` | `DATA_UNAVAILABLE` | `DATA_UNAVAILABLE` | `CALIBRATED_CANDIDATE` | `DATA_UNAVAILABLE` | `DATA_UNAVAILABLE` | `CALIBRATED_CANDIDATE` |
| **TPD** | `NOT_EVALUATED` | `DATA_UNAVAILABLE` | `DATA_UNAVAILABLE` | `CALIBRATED_CANDIDATE` | `DATA_UNAVAILABLE` | `DATA_UNAVAILABLE` | `CALIBRATED_CANDIDATE` |

- **Total Declared Groups:** 21
- **Calibrated Candidate Groups:** 6
- **Data Unavailable Groups:** 12

---

## 4. Empirical Test Cohort Coverage & Interval Widths (Held-Out $n=800$)
| Parameter | Horizon | Nominal Level | Observed Coverage | Coverage Error | Mean Width | Conformal Quantile ($q$) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **IDDQ** | 96h | 80% | **74.62%** | -0.0538 | 63.9790 | 31.9895 |
| **IDDQ** | 96h | 90% | **84.75%** | -0.0525 | 80.4860 | 40.2430 |
| **IDDQ** | 96h | 95% | **93.00%** | -0.0200 | 101.9664 | 50.9832 |
| **IDDQ** | 168h | 80% | **78.62%** | -0.0138 | 69.2506 | 34.6253 |
| **IDDQ** | 168h | 90% | **89.75%** | -0.0025 | 95.3570 | 47.6785 |
| **IDDQ** | 168h | 95% | **94.50%** | -0.0050 | 113.2779 | 56.6389 |
| **ILEAK** | 96h | 80% | **77.75%** | -0.0225 | 9.5569 | 4.7785 |
| **ILEAK** | 96h | 90% | **86.62%** | -0.0338 | 11.8525 | 5.9262 |
| **ILEAK** | 96h | 95% | **92.75%** | -0.0225 | 14.2600 | 7.1300 |
| **ILEAK** | 168h | 80% | **77.50%** | -0.0250 | 9.4199 | 4.7100 |
| **ILEAK** | 168h | 90% | **87.25%** | -0.0275 | 12.0150 | 6.0075 |
| **ILEAK** | 168h | 95% | **95.50%** | +0.0050 | 15.9056 | 7.9528 |
| **TPD** | 96h | 80% | **77.75%** | -0.0225 | 8.3179 | 4.1589 |
| **TPD** | 96h | 90% | **87.62%** | -0.0238 | 10.7219 | 5.3610 |
| **TPD** | 96h | 95% | **92.25%** | -0.0275 | 12.1981 | 6.0991 |
| **TPD** | 168h | 80% | **80.50%** | +0.0050 | 9.2689 | 4.6344 |
| **TPD** | 168h | 90% | **89.38%** | -0.0062 | 12.0804 | 6.0402 |
| **TPD** | 168h | 95% | **95.12%** | +0.0013 | 15.0005 | 7.5002 |

---

## 5. Methodological Notes & Limitations
1. **Marginal Coverage Property:** Split-conformal calibration provides finite-sample marginal coverage guarantees over exchangeable lot distributions.
2. **Homoscedastic Bounds:** Residual quantiles produce fixed-width prediction intervals per horizon. Heteroscedastic conformal prediction may be explored in Stage 7.
3. **Synthetic Ground Truth Disclosure:** All evaluations are conducted on synthetic degradation trajectories. Not flight qualified.
