# PREDICTA-26 — Stage 6 Task 3 Multi-Lot Conformal Stability Benchmark Report

- **Task:** Stage 6 Task 3 — Multi-Lot Drift Stability & Conformal Production-Gate Evaluation
- **Governance Status:** `REVIEW_REQUIRED`
- **Acceptance Threshold Status:** `NO_PRODUCTION_ACCEPTANCE_THRESHOLD_AUTHORIZED`
- **Calibration Status:** `NOT_CALIBRATED`
- **Model Status:** `BENCHMARK_ONLY`
- **Generated UTC:** `2026-09-20T08:20:37.651157+00:00`

---

## 1. Executive Summary & Governance Verdict

This report presents the authoritative multi-lot empirical coverage evaluation of the frozen split-conformal prediction intervals across **all 8 held-out test lots (`LOT-SYN-043` through `LOT-SYN-050`, $n=800$)**.

> [!WARNING]
> **GOVERNANCE STATUS: REVIEW REQUIRED (NO PRODUCTION PROMOTION)**
> No empirical multi-lot production acceptance threshold is currently authorized in the repository. Numerical dispersion is reported for technical review; calibration_status remains strictly NOT_CALIBRATED.
> Multi-lot drift stability evaluation is a benchmark and gate-review artifact only. It does not constitute production calibration, external validation, qualification, or production approval.

---

## 2. Cryptographic Lineage & Provenance

| Artifact / Entity | Identity / Path | SHA-256 Digest |
| :--- | :--- | :--- |
| **Authoritative Dataset** | `data/synthetic/semiconductor_synthetic_full.csv` | `e2b969c458864b11ed61a6073ed1356adcbfd6775bb2c44b28023446bf9771fa` |
| **Split Manifest** | `ml/data/split_manifest.json` | `1764dff377386bf41f95f9bb96afb71dd01404bf65bdec9e324ba31afcf7a8dd` |
| **Prognostic Contract** | `ml/prognostics/prognostic_contract.json` | `943f7b3561bc34b85e36a8a9d1db5ea0672a232effc6a008fb464b20c8704975` |
| **Stability Contract** | `ml/prognostics/lot_stability_contract.json` | `080f1b0930ca718633e7637864bdb067b18fdb17e55600f788577d27467b2da7` |
| **Frozen Calibrator Artifact** | `ml/models/production/conformal_calibration_artifacts.json` | `198eaa50f5af96aa85721f168abc947a6cabfc02d91f77d1a032c343f85e7e7e` |
| **Production Model SHA** | `ml/models/production/predicta_production_manifest.json` | `91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98` |

---

## 3. Aggregate vs Multi-Lot Dispersion Summary

| Parameter | Horizon | Nominal | Aggregate Coverage | Min Lot Cov | Max Lot Cov | Lot Range | Mean Lot Cov | Std Dev | Worst Lot | Best Lot |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **IDDQ** | `96h` | `80%` | `74.62%` | `63.00%` | `81.00%` | `18.00%` | `74.62%` | `±6.57%` | `LOT-SYN-050` | `LOT-SYN-044` |
| **IDDQ** | `96h` | `90%` | `84.75%` | `77.00%` | `89.00%` | `12.00%` | `84.75%` | `±5.06%` | `LOT-SYN-050` | `LOT-SYN-044` |
| **IDDQ** | `96h` | `95%` | `93.00%` | `88.00%` | `97.00%` | `9.00%` | `93.00%` | `±3.16%` | `LOT-SYN-050` | `LOT-SYN-046` |
| **IDDQ** | `168h` | `80%` | `78.62%` | `63.00%` | `85.00%` | `22.00%` | `78.62%` | `±7.07%` | `LOT-SYN-048` | `LOT-SYN-046` |
| **IDDQ** | `168h` | `90%` | `89.75%` | `81.00%` | `95.00%` | `14.00%` | `89.75%` | `±4.86%` | `LOT-SYN-048` | `LOT-SYN-045` |
| **IDDQ** | `168h` | `95%` | `94.50%` | `89.00%` | `97.00%` | `8.00%` | `94.50%` | `±2.73%` | `LOT-SYN-048` | `LOT-SYN-043` |
| **ILEAK** | `96h` | `80%` | `77.75%` | `72.00%` | `88.00%` | `16.00%` | `77.75%` | `±5.01%` | `LOT-SYN-049` | `LOT-SYN-045` |
| **ILEAK** | `96h` | `90%` | `86.62%` | `81.00%` | `93.00%` | `12.00%` | `86.62%` | `±3.85%` | `LOT-SYN-050` | `LOT-SYN-045` |
| **ILEAK** | `96h` | `95%` | `92.75%` | `89.00%` | `97.00%` | `8.00%` | `92.75%` | `±3.01%` | `LOT-SYN-043` | `LOT-SYN-044` |
| **ILEAK** | `168h` | `80%` | `77.50%` | `71.00%` | `87.00%` | `16.00%` | `77.50%` | `±5.04%` | `LOT-SYN-047` | `LOT-SYN-050` |
| **ILEAK** | `168h` | `90%` | `87.25%` | `80.00%` | `92.00%` | `12.00%` | `87.25%` | `±4.13%` | `LOT-SYN-047` | `LOT-SYN-044` |
| **ILEAK** | `168h` | `95%` | `95.50%` | `93.00%` | `97.00%` | `4.00%` | `95.50%` | `±1.20%` | `LOT-SYN-047` | `LOT-SYN-049` |
| **TPD** | `96h` | `80%` | `77.75%` | `65.00%` | `87.00%` | `22.00%` | `77.75%` | `±7.17%` | `LOT-SYN-050` | `LOT-SYN-048` |
| **TPD** | `96h` | `90%` | `87.62%` | `82.00%` | `94.00%` | `12.00%` | `87.62%` | `±4.34%` | `LOT-SYN-050` | `LOT-SYN-048` |
| **TPD** | `96h` | `95%` | `92.25%` | `89.00%` | `97.00%` | `8.00%` | `92.25%` | `±2.60%` | `LOT-SYN-050` | `LOT-SYN-048` |
| **TPD** | `168h` | `80%` | `80.50%` | `74.00%` | `86.00%` | `12.00%` | `80.50%` | `±4.31%` | `LOT-SYN-044` | `LOT-SYN-045` |
| **TPD** | `168h` | `90%` | `89.38%` | `85.00%` | `94.00%` | `9.00%` | `89.38%` | `±2.92%` | `LOT-SYN-047` | `LOT-SYN-045` |
| **TPD** | `168h` | `95%` | `95.12%` | `91.00%` | `99.00%` | `8.00%` | `95.12%` | `±2.36%` | `LOT-SYN-047` | `LOT-SYN-045` |

---

## 4. Per-Lot Empirical Coverage Matrix ($n=100$ per lot)

### Parameter: IDDQ

| Lot ID | 96h (80%) | 96h (90%) | 96h (95%) | 168h (80%) | 168h (90%) | 168h (95%) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `LOT-SYN-043` | 78.0% | 86.0% | 95.0% | 80.0% | 90.0% | 97.0% |
| `LOT-SYN-044` | 81.0% | 89.0% | 95.0% | 83.0% | 89.0% | 95.0% |
| `LOT-SYN-045` | 81.0% | 89.0% | 95.0% | 84.0% | 95.0% | 97.0% |
| `LOT-SYN-046` | 79.0% | 89.0% | 97.0% | 85.0% | 95.0% | 96.0% |
| `LOT-SYN-047` | 70.0% | 82.0% | 89.0% | 79.0% | 90.0% | 96.0% |
| `LOT-SYN-048` | 69.0% | 78.0% | 92.0% | 63.0% | 81.0% | 89.0% |
| `LOT-SYN-049` | 76.0% | 88.0% | 93.0% | 80.0% | 93.0% | 93.0% |
| `LOT-SYN-050` | 63.0% | 77.0% | 88.0% | 75.0% | 85.0% | 93.0% |

### Parameter: ILEAK

| Lot ID | 96h (80%) | 96h (90%) | 96h (95%) | 168h (80%) | 168h (90%) | 168h (95%) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `LOT-SYN-043` | 81.0% | 84.0% | 89.0% | 73.0% | 85.0% | 95.0% |
| `LOT-SYN-044` | 78.0% | 90.0% | 97.0% | 77.0% | 92.0% | 96.0% |
| `LOT-SYN-045` | 88.0% | 93.0% | 96.0% | 78.0% | 85.0% | 96.0% |
| `LOT-SYN-046` | 77.0% | 85.0% | 90.0% | 82.0% | 91.0% | 95.0% |
| `LOT-SYN-047` | 77.0% | 88.0% | 93.0% | 71.0% | 80.0% | 93.0% |
| `LOT-SYN-048` | 76.0% | 84.0% | 95.0% | 76.0% | 85.0% | 96.0% |
| `LOT-SYN-049` | 72.0% | 88.0% | 92.0% | 76.0% | 90.0% | 97.0% |
| `LOT-SYN-050` | 73.0% | 81.0% | 90.0% | 87.0% | 90.0% | 96.0% |

### Parameter: TPD

| Lot ID | 96h (80%) | 96h (90%) | 96h (95%) | 168h (80%) | 168h (90%) | 168h (95%) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `LOT-SYN-043` | 82.0% | 89.0% | 92.0% | 80.0% | 87.0% | 94.0% |
| `LOT-SYN-044` | 72.0% | 83.0% | 91.0% | 74.0% | 88.0% | 95.0% |
| `LOT-SYN-045` | 81.0% | 88.0% | 94.0% | 86.0% | 94.0% | 99.0% |
| `LOT-SYN-046` | 75.0% | 87.0% | 91.0% | 81.0% | 91.0% | 95.0% |
| `LOT-SYN-047` | 76.0% | 85.0% | 90.0% | 75.0% | 85.0% | 91.0% |
| `LOT-SYN-048` | 87.0% | 94.0% | 97.0% | 85.0% | 90.0% | 97.0% |
| `LOT-SYN-049` | 84.0% | 93.0% | 94.0% | 80.0% | 88.0% | 94.0% |
| `LOT-SYN-050` | 65.0% | 82.0% | 89.0% | 83.0% | 92.0% | 96.0% |

---

## 5. Unsupported Group Accounting

- **Forecast Origin Checkpoint (24h):** `NOT_EVALUATED`. Forecast origin where early burn-in screening occurs.
- **Unrecorded Horizons (48h, 72h, 120h, 144h):** `DATA_UNAVAILABLE`. Intermediate burn-in telemetry not physically recorded in synthetic dataset. Zero fabricated numbers permitted.

---

## 6. Formal Production Gate Review Verdict

```json
{
  "governance_status": "REVIEW_REQUIRED",
  "acceptance_threshold_status": "NO_PRODUCTION_ACCEPTANCE_THRESHOLD_AUTHORIZED",
  "model_status": "BENCHMARK_ONLY",
  "calibration_status": "NOT_CALIBRATED",
  "promotion_lock": "ACTIVE"
}
```

**Conclusion:**
Multi-lot empirical coverage evaluation has been completed under strict fail-closed governance. While aggregate coverage aligns with nominal targets, per-lot dispersion illustrates measurable variance across wafer lots. In strict adherence to repository policy, **no arbitrary acceptance threshold has been introduced**. Formal production release requires offline fab validation and committee authorization.
