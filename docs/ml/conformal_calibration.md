# Stage 6 Task 1A: Uncertainty + Conformal Residual Calibration Foundation

## 1. Overview & Objectives
This document specifies the authoritative **conformal uncertainty calibration architecture** for PREDICTA-26 continuous prognostic degradation forecasting (IDDQ, Ileak, TPD across 168h burn-in stress).

The calibration layer produces statistically certified, finite-sample prediction intervals:
$$\hat{C}_{1-\alpha}(x) = [\hat{y}(x) - q_{1-\alpha},\; \hat{y}(x) + q_{1-\alpha}]$$
where $q_{1-\alpha}$ is estimated via split-conformal calibration without making parametric Gaussian or distributional assumptions.

---

## 2. Four-Way Lot-Disjoint Cohort Partitioning Architecture

To preserve rigorous statistical independence and prevent calibration-to-tuning contamination, the 5,000 synthetic components (50 lots) are partitioned into four strictly lot-disjoint cohorts:

| Cohort Name | Lot Range | Lots Count | Component Count | Purpose / Governance Rule |
| :--- | :--- | :--- | :--- | :--- |
| **TRAIN** | `LOT-SYN-001` .. `LOT-SYN-035` | 35 | 3,500 | Point model parameter fitting |
| **VALIDATION_TUNE** | `LOT-SYN-036` .. `LOT-SYN-038` | 3 | 300 | Model selection, hyperparameter tuning & threshold optimization |
| **CALIBRATION** | `LOT-SYN-039` .. `LOT-SYN-042` | 4 | 400 | Conformal nonconformity quantile estimation **ONLY** |
| **TEST** | `LOT-SYN-043` .. `LOT-SYN-050` | 8 | 800 | Frozen held-out empirical coverage & interval width evaluation |

### Key Governance Rules:
1. **Model Freeze Before Calibration:** The point forecasting model formulation, hyperparameters, and weights are tuned on `TRAIN + VALIDATION_TUNE` and **frozen**. Only after the model is frozen are calibration nonconformity residuals $|y - \hat{y}|$ evaluated on `CALIBRATION`.
2. **Strict Calibration Isolation:** The `ConformalResidualCalibrator` accepts data from the `CALIBRATION` split only. Any attempt to pass `VALIDATION_TUNE`, `TRAIN`, `TEST`, or mixed batches throws `CALIBRATION_SPLIT_LEAKAGE_REJECTED`.
3. **Zero Test Contamination:** The held-out `TEST` cohort remains strictly frozen and is used exclusively for final empirical coverage verification.

---

## 3. Parameter × Horizon Governance Status Matrix ($3 \times 7 = 21$ Groups)

The prognostic contract declares 7 horizons ($24\text{h}, 48\text{h}, 72\text{h}, 96\text{h}, 120\text{h}, 144\text{h}, 168\text{h}$) across 3 parameters (`iddq`, `ileak`, `tpd`), yielding 21 potential calibration groups. The physical synthetic dataset records telemetry at checkpoints $0\text{h}, 24\text{h}, 96\text{h}, 168\text{h}$.

The status of all 21 groups is explicitly tracked:

| Parameter | 24h (Origin) | 48h | 72h | 96h | 120h | 144h | 168h |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **IDDQ** | `NOT_EVALUATED` | `DATA_UNAVAILABLE` | `DATA_UNAVAILABLE` | `CALIBRATED_CANDIDATE` | `DATA_UNAVAILABLE` | `DATA_UNAVAILABLE` | `CALIBRATED_CANDIDATE` |
| **Ileak** | `NOT_EVALUATED` | `DATA_UNAVAILABLE` | `DATA_UNAVAILABLE` | `CALIBRATED_CANDIDATE` | `DATA_UNAVAILABLE` | `DATA_UNAVAILABLE` | `CALIBRATED_CANDIDATE` |
| **TPD** | `NOT_EVALUATED` | `DATA_UNAVAILABLE` | `DATA_UNAVAILABLE` | `CALIBRATED_CANDIDATE` | `DATA_UNAVAILABLE` | `DATA_UNAVAILABLE` | `CALIBRATED_CANDIDATE` |

- **Total Declared Contract Groups:** 21
- **Calibrated Candidate Groups:** 6 (`IDDQ@96h`, `IDDQ@168h`, `ILEAK@96h`, `ILEAK@168h`, `TPD@96h`, `TPD@168h`)
- **Data Unavailable Groups:** 12 (`48h`, `72h`, `120h`, `144h` across 3 parameters)
- **Forecast Origin / Not Evaluated:** 3 (`24h` across 3 parameters)

---

## 4. Mathematical Conformal Formulation

For a given parameter $p$ and horizon $h$, let $R_i = |y_i - \hat{y}_i|$ denote the absolute nonconformity residual evaluated on the $n = 400$ units in `CALIBRATION`.
Let $R_{(1)} \le R_{(2)} \le \dots \le R_{(n)}$ be the sorted order statistics of the residuals.

For a requested nominal coverage level $1 - \alpha \in \{0.80, 0.90, 0.95\}$:
$$k = \min\left(n, \left\lceil (n + 1)(1 - \alpha) \right\rceil\right)$$
The conformal quantile is the $k$-th order statistic (0-indexed: `index = k - 1`):
$$q_{1-\alpha} = R_{(k)}$$

Prediction intervals are constructed symmetrically:
$$\hat{C}_{1-\alpha}(x) = [\hat{y}(x) - q_{1-\alpha},\; \hat{y}(x) + q_{1-\alpha}]$$
$$\text{Interval Width } W = 2 \cdot q_{1-\alpha}$$

---

## 5. Security & Leakage Hardening Attack Suite (Attacks A – H)

| Attack ID | Threat Vector Tested | Expected Defense Behavior | Result |
| :--- | :--- | :--- | :--- |
| **Attack A** | $1000\times$ nonconformity injected into Test cohort | Frozen calibration quantiles remain strictly identical | **PASS** |
| **Attack B** | Perturbation of test set ground truth targets | Frozen calibrator artifact hash remains byte-identical | **PASS** |
| **Attack C** | Explicit calibration fitting call with `split_name="TEST"` | Instant fatal rejection (`CALIBRATION_SPLIT_LEAKAGE_REJECTED`) | **PASS** |
| **Attack D** | Overlapping calibration lots and validation tune lots | Instant fatal rejection (`CALIBRATION_LOT_OVERLAP`) | **PASS** |
| **Attack E** | Modifying `VALIDATION_TUNE` targets | Calibration artifact hash and quantiles remain identical | **PASS** |
| **Attack F** | Modifying `CALIBRATION` targets | Calibration artifact changes while frozen model config remains identical | **PASS** |
| **Attack G** | Attempting to tune model on `CALIBRATION` cohort | Lot disjointness check fails closed | **PASS** |
| **Attack H** | Calling calibrator fitting on `VALIDATION_TUNE` split | Instant fatal rejection (`CALIBRATION_SPLIT_LEAKAGE_REJECTED`) | **PASS** |

---

## 6. Release Lock & Status Governance
In strict accordance with PREDICTA-26 governance rules:
- `model_status = BENCHMARK_ONLY`
- `calibration_status = NOT_CALIBRATED`

A model or calibration module may not be promoted to production or marked `CALIBRATED` merely because calibration infrastructure exists. Formal production release requires multi-lot drift stability certification and flight clearance.
