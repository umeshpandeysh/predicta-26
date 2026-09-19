# Authoritative Stage 5 Continuous Prognostics Benchmark Report

**Generated:** `2026-09-19T15:13:15.141320+00:00`  
**Contract Version:** `1.0.0`  
**Dataset SHA-256:** `e2b969c458864b11ed61a6073ed1356adcbfd6775bb2c44b28023446bf9771fa`  
**Dataset Path:** `data/synthetic/semiconductor_synthetic_full.csv`  

> **DISCLAIMER:** All telemetry is synthetic data generated for benchmark and simulation. Not flight-qualified or real-world certified.

---

## 1. Executive Summary & Specification

- **Task Name:** `continuous_168h_trajectory_forecasting`
- **Forecast Origin:** `[24]h` (Strictly observable early features at 0h, 24h, and 24h drift)
- **Forecast Horizons:** `[24, 48, 72, 96, 120, 144, 168]`
- **Evaluated Horizons:** `[96, 168]`
- **Target Parameters:** `iddq` (μA), `ileak` (μA), `tpd` (ns)
- **Model Status:** `BENCHMARK_ONLY`
- **Calibration Status:** `NOT_CALIBRATED`

### Lot-Held-Out Partitions
- **Train Cohort:** Lots `LOT-SYN-001` .. `LOT-SYN-035` (3500 samples)
- **Validation Cohort:** Lots `LOT-SYN-036` .. `LOT-SYN-042` (700 samples)
- **Held-Out Test Cohort:** Lots `LOT-SYN-043` .. `LOT-SYN-050` (800 samples)

---

## 2. Continuous Trajectory Forecasting Performance (Held-Out Test Set)

### IDDQ Trajectory Forecasting (μA)
| Horizon | Model | MAE (μA) | RMSE (μA) | MedAE (μA) | MaxAE (μA) | NRMSE |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **96h** | Persistence Baseline | 25.9121 | 32.3266 | 22.0580 | 106.5340 | 0.0152 |
| **96h** | **Degradation Model** | **22.4524** | **28.8344** | **17.5452** | **103.6956** | **0.0136** |
| **168h** | Persistence Baseline | 26.2694 | 33.3457 | 21.5615 | 123.8710 | 0.0157 |
| **168h** | **Degradation Model** | **23.2227** | **29.8887** | **19.4203** | **161.7392** | **0.0141** |

### Ileak Trajectory Forecasting (μA)
| Horizon | Model | MAE (μA) | RMSE (μA) | MedAE (μA) | MaxAE (μA) | NRMSE |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **96h** | Persistence Baseline | 3.5129 | 4.4139 | 3.0160 | 15.7020 | 0.0146 |
| **96h** | **Degradation Model** | **3.1055** | **3.9492** | **2.5306** | **14.0605** | **0.0131** |
| **168h** | Persistence Baseline | 3.6253 | 4.5549 | 2.9975 | 18.2710 | 0.0151 |
| **168h** | **Degradation Model** | **3.1341** | **3.9648** | **2.6307** | **14.9208** | **0.0132** |

### TPD Trajectory Forecasting (ns)
| Horizon | Model | MAE (ns) | RMSE (ns) | MedAE (ns) | MaxAE (ns) | NRMSE |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **96h** | Persistence Baseline | 3.2237 | 4.5877 | 2.4700 | 29.4000 | 0.0234 |
| **96h** | **Degradation Model** | **2.7251** | **3.4739** | **2.1757** | **14.9581** | **0.0177** |
| **168h** | Persistence Baseline | 4.1199 | 6.0592 | 3.3500 | 51.7500 | 0.0307 |
| **168h** | **Degradation Model** | **2.9549** | **3.9120** | **2.4412** | **27.8795** | **0.0198** |

---

## 3. Empirical Uncertainty Diagnostics (Uncalibrated)

> **IMPORTANT:** Prediction intervals are derived from validation empirical residuals and are designated **`NOT_CALIBRATED`**. They represent uncalibrated empirical diagnostic bands, not formal conformal or Bayesian coverage guarantees.

| Parameter | Horizon | Nominal Level | Observed Test Coverage (%) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **IDDQ** | 96h | 90.0% | 89.75% | NOT_CALIBRATED |
| **IDDQ** | 168h | 90.0% | 90.50% | NOT_CALIBRATED |
| **Ileak** | 96h | 90.0% | 88.12% | NOT_CALIBRATED |
| **Ileak** | 168h | 90.0% | 90.25% | NOT_CALIBRATED |
| **TPD** | 96h | 90.0% | 88.88% | NOT_CALIBRATED |
| **TPD** | 168h | 90.0% | 91.00% | NOT_CALIBRATED |

---

## 4. Screening Threshold Crossing Projections

Projected against authoritative project-defined screening criteria:
- `iddq_max_uA`: 5000.0 μA
- `ileak_max_uA`: 500.0 μA
- `tpd_max_ns`: 250.0 ns

**Test Cohort Breach Summary (800 devices):**
- Overall Projected Breaches: **23** (2.88%)
- IDDQ Projected Breaches: **0** (0.0%)
- Ileak Projected Breaches: **0** (0.0%)
- TPD Projected Breaches: **23** (2.88%)

---

## 5. Legacy GPR Governance Audit

- **Artifact Name:** `Predicta Gaussian Process Regressor (GPR)`
- **Artifact Path:** `ml/models/production/predicta_gpr_kernel_artifacts.json`
- **Artifact SHA-256:** `1d5fd207ecbd8fed31c09c9e0e8f4655b72f2596ba6c9faf421c7d54fd6a3fcf`
- **Compatibility Status:** `INCOMPATIBLE_TRAINING_SCHEMA`
- **Promotion Eligible:** `False`
- **Rejection Reason:** Legacy GPR artifact was trained on a non-authoritative lot split (LOT-SYN-001..030) that overlaps the authoritative Stage 5 validation cohort (LOT-SYN-036..042) and lacks multi-horizon (48h..168h) trajectory projection targets.
