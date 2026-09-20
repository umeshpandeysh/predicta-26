# PREDICTA-26 — Stage 8 Task 3: External Dataset ML Integration & Benchmarking

## Executive Overview & Architectural Principles

Stage 8 Task 3 establishes an authoritative, scientifically defensible ML benchmarking layer for externally acquired and registered validation datasets. This layer operates with **strict production isolation**, ensuring that external validation datasets evaluate generalizability and physical prognostics without contaminating the authoritative PREDICTA production pipeline.

---

## Authoritative Dataset Integration Matrix

| Dataset ID | Provenance Class | Acquisition Status | Task Type | Native Feature Count | Target Variable | Split Strategy | Preprocessing Boundaries | Compatibility Status |
|---|---|---|---|---|---|---|---|---|
| `st_awfd_d1` | `EXTERNAL_REAL` | `PHYSICALLY_IMPORTED_AND_HASH_VERIFIED` | Binary Anomaly | 15 E-test variables | `target` (lot fault) | `GroupKFold(MaterialID)` | None (Raw E-test) | `GENERALIZATION_ONLY` |
| `st_awfd_d2` | `EXTERNAL_REAL` | `PHYSICALLY_IMPORTED_AND_HASH_VERIFIED` | Binary Anomaly | 20 E-test variables | `target` (lot fault) | `GroupKFold(MaterialID)` | None (Raw E-test) | `GENERALIZATION_ONLY` |
| `uci_secom` | `EXTERNAL_REAL` | `PHYSICALLY_IMPORTED_AND_HASH_VERIFIED` | Binary Yield Failure | 590 sensor variables | `target` (Pass/Fail) | `StratifiedKFold(n_splits=5)` | Train-Only Median Imputation & Scaling | `GENERALIZATION_ONLY` |
| `uci_ai4i_2020` | `EXTERNAL_SYNTHETIC` | `PHYSICALLY_IMPORTED_AND_HASH_VERIFIED` | Mechanical Failure | 5 mechanical variables | `Machine failure` | `StratifiedKFold(n_splits=5)` | Standard Scaling | `GENERALIZATION_ONLY` |
| `nasa_igbt` | `EXTERNAL_REAL` | `PHYSICALLY_IMPORTED_AND_HASH_VERIFIED` | Continuous Prognostics | 2 SMU variables | `current` (degradation) | Device-based temporal split | Standard Scaling on SMU features | `CONTINUOUS_PROGNOSTICS_ONLY` |
| `nasa_mosfet` | `REMOTE_EXTERNAL_DATASET` | `REMOTE_EXTERNAL_DATASET` | Continuous Prognostics | 8 (secondary metadata) | None | None (Remote Only) | None (Remote Only) | `REMOTE_ONLY` |
| `nasa_capacitor` | `REMOTE_EXTERNAL_DATASET` | `REMOTE_EXTERNAL_DATASET` | Continuous Prognostics | 5 (official metadata) | None | None (Remote Only) | None (Remote Only) | `REMOTE_ONLY` |
| `upc_si_igbt_2026` | `REMOTE_EXTERNAL_DATASET` | `REMOTE_EXTERNAL_DATASET` | Continuous Prognostics | 3 DUT parameters | None | None (Remote Only) | None (Remote Only) | `REMOTE_ONLY` |

---

## Leakage Controls & Non-Contamination Governance

### 1. ST-AWFD Lot-Level Group Leakage Control
- **Mechanism:** Split via `GroupKFold(n_splits=5)` grouped strictly by `MaterialID`.
- **Enforcement:** Automated assertion verifies 0% `MaterialID` group overlap across train, validation, and test splits. Raises `DataLeakageError` if any lot ID leaks.

### 2. UCI SECOM Preprocessing Fit Control
- **Mechanism:** `SimpleImputer(strategy="median")` and `StandardScaler()` are wrapped in a Pipeline fitted **exclusively on the training fold** inside each CV split.
- **Enforcement:** Imputer statistics (`statistics_`) and scaler parameters (`mean_`, `var_`) depend 100% on `X_train`. Test fold statistics are never accessed during feature transformation.

### 3. UCI AI4I Target Leakage Defense
- **Mechanism:** Diagnostic failure cause codes (`TWF`, `HDF`, `PWF`, `OSF`, `RNF`) are target-derived flags that encode the failure cause.
- **Enforcement:** The native loader automatically removes these diagnostic cause fields from the feature matrix prior to benchmarking `Machine failure`.

### 4. NASA IGBT Temporal & Device Sequence Control
- **Mechanism:** Telemetry records preserve strict temporal index ordering and device partition boundaries across physical DUTs (Parts 11, 12, 13 vs Parts 21, 22, 23).
- **Enforcement:** Binary failure labels are marked unavailable (`binary_labels_available = False`). Attempting to request binary failure classification on NASA IGBT fails closed.

---

## Production Isolation Safeguards

To prevent external dataset contamination of the PREDICTA production pipeline:

1. **Production Dataset Integrity:** `ml/data/synthetic/predicta_dataset_v3_50000.csv` SHA-256 (`48e718643b6fe99bc410421f5b48715c294f1c4c2edabf10870935afdb820a06`) remains locked.
2. **Production Model Weights:** `ml/models/production/predicta_xgboost_model.json` SHA-256 (`91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98`) remains locked.
3. **Production Threshold & Calibration:** Production decision threshold (`0.20`) and conformal artifacts (`ml/models/production/conformal_calibration_artifacts.json`) are untouched.
4. **Artifact Isolation:** External benchmarks write evaluation outputs exclusively to `experiments/external_benchmarks/external_benchmark_report.json` and `.md`.

---

## Execution Protocol

To run the automated external benchmark suite:

```bash
# Execute external benchmark runner
python -m ml.benchmarks.external.runner

# Run external dataset unit & integration test suite
python -m pytest tests/test_external_dataset_benchmarks.py -v
```

---

## Mandatory Benchmark Disclaimer

> **MANDATORY DISCLAIMER:**  
> External benchmark results do not modify or validate manufacturer qualification limits and do not automatically validate PREDICTA production thresholds.
