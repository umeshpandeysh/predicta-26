# PREDICTA-26 — External Dataset ML Benchmark Report

> **MANDATORY DISCLAIMER:**  
> External benchmark results do not modify or validate manufacturer qualification limits and do not automatically validate PREDICTA production thresholds.

---

## 1. Executive Summary & Production Isolation

- **Execution Timestamp:** `2026-09-23T18:42:44.669532Z`
- **Production Isolation Status:** `VERIFIED_ISOLATED` (Zero modification to production models, calibration, thresholds, or synthetic dataset)
- **Authoritative Production Threshold:** `0.20` (UNTOUCHED)

---

## 2. Benchmark Summary Table

| Dataset ID | Provenance Class | Task Type | Status | Compatibility Status | Primary Performance Metric |
|---|---|---|---|---|---|
| `st_awfd_d1` | `EXTERNAL_REAL` | `binary_anomaly_classification` | `COMPLETED` | `GENERALIZATION_ONLY` | ROC-AUC: 0.7605 | PR-AUC: 0.2627 | F1: 0.1107 |
| `st_awfd_d2` | `EXTERNAL_REAL` | `binary_anomaly_classification` | `COMPLETED` | `GENERALIZATION_ONLY` | ROC-AUC: 1.0000 | PR-AUC: 1.0000 | F1: 1.0000 |
| `uci_secom` | `EXTERNAL_REAL` | `binary_yield_failure_classification` | `COMPLETED` | `GENERALIZATION_ONLY` | ROC-AUC: 0.6954 | PR-AUC: 0.1267 | F1: 0.0000 |
| `uci_ai4i_2020` | `EXTERNAL_SYNTHETIC` | `binary_mechanical_failure_classification` | `COMPLETED` | `GENERALIZATION_ONLY` | ROC-AUC: 0.9653 | PR-AUC: 0.7463 | F1: 0.6843 |
| `nasa_igbt` | `EXTERNAL_REAL` | `continuous_degradation_prognostics` | `INSUFFICIENT_COMPATIBLE_TARGET` | `INSUFFICIENT_COMPATIBLE_TARGET` | N/A (Failed Closed: Insufficient Compatible Target) |
| `nasa_mosfet` | `REMOTE_EXTERNAL_DATASET` | `continuous_degradation_prognostics` | `REMOTE_ONLY` | `REMOTE_ONLY` | N/A (REMOTE_ONLY) |
| `nasa_capacitor` | `REMOTE_EXTERNAL_DATASET` | `continuous_degradation_prognostics` | `REMOTE_ONLY` | `REMOTE_ONLY` | N/A (REMOTE_ONLY) |
| `upc_si_igbt_2026` | `REMOTE_EXTERNAL_DATASET` | `continuous_degradation_prognostics` | `REMOTE_ONLY` | `REMOTE_ONLY` | N/A (REMOTE_ONLY) |

---

## 3. Detailed Dataset Evaluation Results

### Dataset: `st_awfd_d1` (STMicroelectronics ST-AWFD Dataset D1)
- **Provenance Class:** `EXTERNAL_REAL`
- **Acquisition Status:** `PHYSICALLY_IMPORTED_AND_HASH_VERIFIED`
- **Compatibility Status:** `GENERALIZATION_ONLY`
- **Leakage Controls:** Zero MaterialID group overlap enforced between training partitions and fold validation partitions.
- **Limitations:** Anonymous wafer fab E-test features cannot be mapped to PREDICTA physical semiconductor fields.

```json
{
  "sample_count": 602108,
  "feature_count": 15,
  "lot_count": 5104,
  "target_distribution": {
    "normal_count": 601870,
    "abnormal_count": 238,
    "abnormal_ratio": 0.0003952779235618859
  },
  "roc_auc": 0.7605,
  "pr_auc": 0.2627,
  "precision": 0.9333,
  "recall": 0.0588,
  "f1_score": 0.1107,
  "accuracy": 0.9996,
  "confusion_matrix": [
    [
      601869,
      1
    ],
    [
      224,
      14
    ]
  ]
}
```

### Dataset: `st_awfd_d2` (STMicroelectronics ST-AWFD Dataset D2)
- **Provenance Class:** `EXTERNAL_REAL`
- **Acquisition Status:** `PHYSICALLY_IMPORTED_AND_HASH_VERIFIED`
- **Compatibility Status:** `GENERALIZATION_ONLY`
- **Leakage Controls:** Zero MaterialID group overlap enforced between training partitions and fold validation partitions.
- **Limitations:** Anonymous wafer fab E-test features cannot be mapped to PREDICTA physical semiconductor fields.

```json
{
  "sample_count": 126794,
  "feature_count": 20,
  "lot_count": 1156,
  "target_distribution": {
    "normal_count": 86522,
    "abnormal_count": 40272,
    "abnormal_ratio": 0.31761755288105115
  },
  "roc_auc": 1.0,
  "pr_auc": 1.0,
  "precision": 1.0,
  "recall": 1.0,
  "f1_score": 1.0,
  "accuracy": 1.0,
  "confusion_matrix": [
    [
      86522,
      0
    ],
    [
      0,
      40272
    ]
  ]
}
```

### Dataset: `uci_secom` (UCI SECOM Semiconductor Manufacturing Data)
- **Provenance Class:** `EXTERNAL_REAL`
- **Acquisition Status:** `PHYSICALLY_IMPORTED_AND_HASH_VERIFIED`
- **Compatibility Status:** `GENERALIZATION_ONLY`
- **Leakage Controls:** SimpleImputer and StandardScaler fit strictly on train split inside each CV fold.
- **Limitations:** Anonymous sensor channels cannot be mapped to PREDICTA physical fields (iddq, ileak, tpd, vth).

```json
{
  "sample_count": 1567,
  "feature_count": 590,
  "target_distribution": {
    "pass_count": 1463,
    "fail_count": 104,
    "fail_ratio": 0.06636885768985322
  },
  "roc_auc": 0.6954,
  "pr_auc": 0.1267,
  "precision": 0.0,
  "recall": 0.0,
  "f1_score": 0.0,
  "accuracy": 0.9324,
  "confusion_matrix": [
    [
      1461,
      2
    ],
    [
      104,
      0
    ]
  ]
}
```

### Dataset: `uci_ai4i_2020` (UCI AI4I 2020 Predictive Maintenance Dataset)
- **Provenance Class:** `EXTERNAL_SYNTHETIC`
- **Acquisition Status:** `PHYSICALLY_IMPORTED_AND_HASH_VERIFIED`
- **Compatibility Status:** `GENERALIZATION_ONLY`
- **Leakage Controls:** Diagnostic cause fields (TWF, HDF, PWF, OSF, RNF) strictly excluded from feature set.
- **Limitations:** Mechanical CNC tool wear dataset; strictly isolated from semiconductor physics validation.

```json
{
  "sample_count": 10000,
  "feature_count": 5,
  "target_distribution": {
    "healthy_count": 9661,
    "failure_count": 339,
    "failure_ratio": 0.0339
  },
  "roc_auc": 0.9653,
  "pr_auc": 0.7463,
  "precision": 0.6813,
  "recall": 0.6873,
  "f1_score": 0.6843,
  "accuracy": 0.9785,
  "confusion_matrix": [
    [
      9552,
      109
    ],
    [
      106,
      233
    ]
  ]
}
```

### Dataset: `nasa_igbt` (NASA PCoE IGBT Accelerated Aging Dataset (#8))
- **Provenance Class:** `EXTERNAL_REAL`
- **Acquisition Status:** `PHYSICALLY_IMPORTED_AND_HASH_VERIFIED`
- **Compatibility Status:** `INSUFFICIENT_COMPATIBLE_TARGET`
- **Leakage Controls:** Target variable 'current' strictly excluded from feature matrix. Static SMU I-V sweeps lack longitudinal aging timestamps required for causal temporal prognostics.
- **Limitations:** Binary failure labels unavailable (binary_labels_available=false). Static SMU sweeps lack longitudinal aging timestamps. Target 'current' is strictly excluded from features to eliminate target leakage, rendering target insufficient for causal temporal forecasting.

_Status: INSUFFICIENT_COMPATIBLE_TARGET — Extracted NASA IGBT archive contains static SMU I-V sweeps (voltage vs current) without longitudinal aging timestamps. Target 'current' is strictly excluded from predictors to eliminate target leakage. With same-timestep target 'current' removed, the dataset lacks a compatible causal temporal prognosis target._

### Dataset: `nasa_mosfet` (NASA PCoE MOSFET Thermal Overstress Aging Dataset (#13))
- **Provenance Class:** `REMOTE_EXTERNAL_DATASET`
- **Acquisition Status:** `REMOTE_EXTERNAL_DATASET`
- **Compatibility Status:** `REMOTE_ONLY`
- **Leakage Controls:** Remote dataset not downloaded into repository storage.
- **Limitations:** Remote S3 archive (7.85 GB); local archive download and extraction not performed.

_Status: REMOTE_ONLY — Remote external dataset. Archive not downloaded into local repository storage._

### Dataset: `nasa_capacitor` (NASA PCoE Electrolytic Capacitor Electrical Stress Aging Dataset (#12))
- **Provenance Class:** `REMOTE_EXTERNAL_DATASET`
- **Acquisition Status:** `REMOTE_EXTERNAL_DATASET`
- **Compatibility Status:** `REMOTE_ONLY`
- **Leakage Controls:** Remote dataset not downloaded into repository storage.
- **Limitations:** Remote S3 archive (5.04 GB); local archive download and extraction not performed.

_Status: REMOTE_ONLY — Remote external dataset. Archive not downloaded into local repository storage._

### Dataset: `upc_si_igbt_2026` (UPC Si IGBT Accelerated Power-Cycling Aging Dataset (2026 v1.1))
- **Provenance Class:** `REMOTE_EXTERNAL_DATASET`
- **Acquisition Status:** `REMOTE_EXTERNAL_DATASET`
- **Compatibility Status:** `REMOTE_ONLY`
- **Leakage Controls:** Remote dataset not downloaded into repository storage.
- **Limitations:** Remote Dataverse DOI resource (10.34810/DATA3204); files not locally downloaded.

_Status: REMOTE_ONLY — Remote external dataset. Archive not downloaded into local repository storage._

---

## 4. Scientific Governance & Non-Contamination Boundaries

1. **Zero Production Contamination:** External datasets are evaluated strictly in isolated benchmark routines. Production models are trained exclusively on certified PREDICTA production data.
2. **No Invented Mappings:** Anonymous sensors, E-test values, and continuous degradation parameters are evaluated in native schemas without unsupported physical mappings to PREDICTA physical fields.
3. **Leakage-Safe Splitting:** Lot-level grouping (`MaterialID` for ST-AWFD), train-only preprocessing fits (UCI SECOM), and strict device separation (NASA IGBT) guarantee zero temporal or group leakage.
