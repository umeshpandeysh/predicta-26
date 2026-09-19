# Authoritative Stage 6 Conformal Calibration Benchmark Report

**Generated:** `2026-09-19T18:16:46.111216+00:00`
**Contract Version:** `1.0.0`
**Dataset SHA-256:** `e2b969c458864b11ed61a6073ed1356adcbfd6775bb2c44b28023446bf9771fa`
**Dataset Path:** `C:\Users\UMESH PANDEY\Downloads\ceenew\data\synthetic\semiconductor_synthetic_full.csv`
**Calibration Artifact SHA-256:** `637ee84654cb334e7ae4d6c21cd0a2865354599a04824a13080c0b197dbea550`

> **DISCLAIMER:** All telemetry is synthetic data generated for benchmark and simulation. Not flight-qualified or real-world certified.

---

## 1. Executive Summary & Specification

- **Method:** `CONFORMAL_RESIDUAL_CALIBRATION`
- **Calibration Split:** `VALIDATION` (Validation Lots LOT-SYN-036..042, 700 components)
- **Evaluation Split:** `TEST` (Held-out Test Lots LOT-SYN-043..050, 800 components)
- **Forecast Origin:** `24h`
- **Candidate Nominal Levels:** `[0.8, 0.9, 0.95]`
- **Finite-Sample Quantile Rule:** `CEIL_N_PLUS_ONE_TIMES_COVERAGE_DIVIDED_BY_N`
- **Calibration Status:** `NOT_CALIBRATED`
- **Model Status:** `BENCHMARK_ONLY`

---

## 2. Frozen Conformal Residual Quantiles (Validation Split, n=700)

| Parameter | Horizon | Nominal Level | Conformal Quantile ($q$) | Half-Width ($q$) | Full Width ($2q$) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **IDDQ** | `96h` | `80%` | `33.5105 uA` | `±33.5105 uA` | `67.0211 uA` |
| **IDDQ** | `96h` | `90%` | `43.6342 uA` | `±43.6342 uA` | `87.2685 uA` |
| **IDDQ** | `96h` | `95%` | `54.2540 uA` | `±54.2540 uA` | `108.5080 uA` |
| **IDDQ** | `168h` | `80%` | `35.6223 uA` | `±35.6223 uA` | `71.2447 uA` |
| **IDDQ** | `168h` | `90%` | `46.7087 uA` | `±46.7087 uA` | `93.4173 uA` |
| **IDDQ** | `168h` | `95%` | `57.6576 uA` | `±57.6576 uA` | `115.3152 uA` |
| **ILEAK** | `96h` | `80%` | `4.8557 uA` | `±4.8557 uA` | `9.7115 uA` |
| **ILEAK** | `96h` | `90%` | `6.1066 uA` | `±6.1066 uA` | `12.2132 uA` |
| **ILEAK** | `96h` | `95%` | `7.4621 uA` | `±7.4621 uA` | `14.9242 uA` |
| **ILEAK** | `168h` | `80%` | `4.7560 uA` | `±4.7560 uA` | `9.5121 uA` |
| **ILEAK** | `168h` | `90%` | `6.0965 uA` | `±6.0965 uA` | `12.1930 uA` |
| **ILEAK** | `168h` | `95%` | `7.4202 uA` | `±7.4202 uA` | `14.8404 uA` |
| **TPD** | `96h` | `80%` | `4.0998 ns` | `±4.0998 ns` | `8.1995 ns` |
| **TPD** | `96h` | `90%` | `5.2115 ns` | `±5.2115 ns` | `10.4229 ns` |
| **TPD** | `96h` | `95%` | `6.0991 ns` | `±6.0991 ns` | `12.1981 ns` |
| **TPD** | `168h` | `80%` | `4.5216 ns` | `±4.5216 ns` | `9.0432 ns` |
| **TPD** | `168h` | `90%` | `5.7919 ns` | `±5.7919 ns` | `11.5838 ns` |
| **TPD** | `168h` | `95%` | `7.3468 ns` | `±7.3468 ns` | `14.6935 ns` |

---

## 3. Empirical Test Cohort Coverage Results (Held-Out Test, n=800)

| Parameter | Horizon | Nominal Level | Observed Coverage | Coverage Error | Conformal Quantile ($q$) | Avg Width | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **IDDQ** | `96h` | `80%` | `76.88%` | `-0.0312` | `33.5105` | `67.0211` | `NOT_CALIBRATED` |
| **IDDQ** | `96h` | `90%` | `87.88%` | `-0.0212` | `43.6342` | `87.2685` | `NOT_CALIBRATED` |
| **IDDQ** | `96h` | `95%` | `94.00%` | `-0.0100` | `54.2540` | `108.5080` | `NOT_CALIBRATED` |
| **IDDQ** | `168h` | `80%` | `80.12%` | `+0.0012` | `35.6223` | `71.2447` | `NOT_CALIBRATED` |
| **IDDQ** | `168h` | `90%` | `88.75%` | `-0.0125` | `46.7087` | `93.4173` | `NOT_CALIBRATED` |
| **IDDQ** | `168h` | `95%` | `94.75%` | `-0.0025` | `57.6576` | `115.3152` | `NOT_CALIBRATED` |
| **ILEAK** | `96h` | `80%` | `79.00%` | `-0.0100` | `4.8557` | `9.7115` | `NOT_CALIBRATED` |
| **ILEAK** | `96h` | `90%` | `87.62%` | `-0.0238` | `6.1066` | `12.2132` | `NOT_CALIBRATED` |
| **ILEAK** | `96h` | `95%` | `94.38%` | `-0.0062` | `7.4621` | `14.9242` | `NOT_CALIBRATED` |
| **ILEAK** | `168h` | `80%` | `77.62%` | `-0.0238` | `4.7560` | `9.5121` | `NOT_CALIBRATED` |
| **ILEAK** | `168h` | `90%` | `87.62%` | `-0.0238` | `6.0965` | `12.1930` | `NOT_CALIBRATED` |
| **ILEAK** | `168h` | `95%` | `93.00%` | `-0.0200` | `7.4202` | `14.8404` | `NOT_CALIBRATED` |
| **TPD** | `96h` | `80%` | `76.88%` | `-0.0312` | `4.0998` | `8.1995` | `NOT_CALIBRATED` |
| **TPD** | `96h` | `90%` | `87.00%` | `-0.0300` | `5.2115` | `10.4229` | `NOT_CALIBRATED` |
| **TPD** | `96h` | `95%` | `92.25%` | `-0.0275` | `6.0991` | `12.1981` | `NOT_CALIBRATED` |
| **TPD** | `168h` | `80%` | `79.88%` | `-0.0013` | `4.5216` | `9.0432` | `NOT_CALIBRATED` |
| **TPD** | `168h` | `90%` | `88.38%` | `-0.0162` | `5.7919` | `11.5838` | `NOT_CALIBRATED` |
| **TPD** | `168h` | `95%` | `94.25%` | `-0.0075` | `7.3468` | `14.6935` | `NOT_CALIBRATED` |

---

## 4. Scientific Governance & Verification Verdict

- **Validation-Only Calibration Enforced:** `True`
- **Test Set Immutability & Freeze:** `True`
- **Zero Test Leakage Verified:** `True`
- **Parameter x Horizon Grouping:** `True`
- **Final Calibration Status:** `NOT_CALIBRATED`

> **NOTICE:** Prediction intervals are candidate split-conformal intervals. Calibration status remains NOT_CALIBRATED pending independent empirical review and formal release certification.
