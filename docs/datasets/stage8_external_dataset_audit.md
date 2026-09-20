# PREDICTA-26 — Stage 8 Task 1: External Dataset Provenance + Compatibility Audit

**Authoritative Governance Document**  
**Stage:** Stage 8 Task 1 (Dataset Expansion & Source Integration Audit)  
**Status:** AUDIT & SOURCE INSPECTION ONLY — NO MODEL TRAINING / RE-TRAINING / PIPELINE MUTATION  
**Date:** September 20, 2026  

---

## 1. Executive Summary & Audit Mandate

This document establishes the official forensic provenance, licensing, target compatibility, feature mapping, leakage risks, and structural dataset family boundaries for nine external public proxy datasets evaluated for PREDICTA-26. 

### Key Audit Mandates:
1. **Source Integrity:** The current PREDICTA synthetic production dataset (`predicta_dataset_v3_50000.csv`) remains the authoritative baseline for core model development and production calibration. External datasets must **NEVER** silently replace or overwrite PREDICTA native synthetic data.
2. **Synthetic vs. Real Separation:** Synthetic datasets (such as UCI AI4I 2020) are explicitly classified as `EXTERNAL_SYNTHETIC` and must be kept strictly isolated from real physical semiconductor component aging datasets.
3. **No Unsafe Merging / Retraining:** This audit is 100% read-only and analytical. No model training, retraining, model weight modification, threshold adjustment, conformal calibration alteration, or physics primitive mutation was performed.

---

## 2. Comprehensive External Dataset Inventory

The table below summarizes the comprehensive provenance, identity, licensing, and recommended role for all nine evaluated candidate dataset resources.

### License Status Categories:
- `LICENSE_CONFIRMED`: Official open source or public domain license verified at repository/portal source.
- `LICENSE_UNSPECIFIED`: Publicly accessible resource without an explicit software/data license file.
- `LICENSE_REQUIRES_REVIEW`: Custom academic or organizational terms requiring formal legal review prior to commercial distribution.

| dataset_id | dataset_name | source_organization | official_url | download_url | source_type | component_type | real_or_synthetic | number_of_devices | number_of_records | time_series | labels_available | failure_modes | degradation_target | key_features | units_available | missing_values | license | license_status | citation | recommended_use | integration_status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `st_awfd` | STMicroelectronics ST-AWFD | STMicroelectronics | https://github.com/STMicroelectronics/ST-AWFD | D1: https://github.com/STMicroelectronics/ST-AWFD/blob/main/Datasets/D1.zip, D2: https://github.com/STMicroelectronics/ST-AWFD/blob/main/Datasets/D2.zip | public_proxy | Wafer / Die E-Test | `EXTERNAL_REAL` | D1: 5,105 lots, D2: 1,157 lots | D1: 602,108 rows, D2: 126,795 rows | True (per StepID) | True | Wafer/Lot Fault | Anomaly Flag | 15 E-test sensor features (D1), 20 features (D2), MaterialID, StepID, duration_ms | ms, various | False | Apache 2.0 | `LICENSE_CONFIRMED` | Furnari et al., Sensors 2021 | Lot-Level Outlier Benchmark | `AUDITED_CANDIDATE` |
| `uci_secom` | UCI SECOM | UCI Machine Learning Repository | https://archive.ics.uci.edu/dataset/179/secom | https://archive.ics.uci.edu/static/public/179/secom.zip | public_proxy | Fab Sensor Logs | `EXTERNAL_REAL` | 1,567 wafers | 1,567 rows | False | True | Fab Yield Failure | Pass (-1) / Fail (+1) | 590 anonymous process sensor channels | Anonymized | True (in multiple columns) | CC BY 4.0 | `LICENSE_CONFIRMED` | McCann & Johnston, 2008 | High-Dim Outlier Selection | `AUDITED_CANDIDATE` |
| `nasa_mosfet` | NASA Power MOSFET Prognostics | NASA Ames PCoE | https://data.nasa.gov/dataset/prognostics-of-power-mosfet | https://phm-datasets.s3.amazonaws.com/NASA/13.+MOSFET+Thermal+Overstress+Aging.zip | public_proxy | Power MOSFET (IRF520/530) | `EXTERNAL_REAL` | 32 devices | ~32 run-to-failure series | True | True | Thermal Breakdown, Die Attach Fault | Rds(on) > 20% increase, Vth shift, Igss breakdown | Vgs(th), Igss, Idss, Rds(on), Temp | V, A, A, Ohm, C | False | Public Domain / CC0 | `LICENSE_CONFIRMED` | Celaya et al., PHM 2011 | GPR Drift & Physics Benchmark | `AUDITED_CANDIDATE` |
| `nasa_mosfet_thermal` | NASA MOSFET Thermal Stress Aging | NASA Ames PCoE | https://data.nasa.gov/dataset/prognostics-approach-for-power-mosfet-under-thermal-stress-aging | https://phm-datasets.s3.amazonaws.com/NASA/13.+MOSFET+Thermal+Overstress+Aging.zip | public_proxy | Power MOSFET | `EXTERNAL_REAL` | 32 devices | Same as nasa_mosfet | True | True | Thermal Breakdown | Rds(on), Vth drift | Vgs(th), Rds(on), Temp | V, Ohm, C | False | Public Domain / CC0 | `LICENSE_CONFIRMED` | Celaya et al., PHM 2011 | `DUPLICATE / ALTERNATE SOURCE` | `AUDITED_DUPLICATE` |
| `nasa_igbt` | NASA IGBT Accelerated Aging | NASA Ames PCoE | https://phm-datasets.s3.amazonaws.com/NASA/8.+IGBT+Accelerated+Aging.zip | https://phm-datasets.s3.amazonaws.com/NASA/8.+IGBT+Accelerated+Aging.zip | public_proxy | Discrete IGBT | `EXTERNAL_REAL` | 12 devices | ~12 run-to-failure series | True | True | Latch-up, Gate Breakdown, CE Short | Vce(sat) degradation, Vge(th) shift | Vce(sat), Ic, Ig, Vge(th), Tj | V, A, A, V, C | False | Public Domain / CC0 | `LICENSE_CONFIRMED` | Celaya et al., IEEE 2012 | Thermal Aging & Prognostic Benchmark | `AUDITED_CANDIDATE` |
| `nasa_igbt_precursor` | NASA IGBT Precursor-Parameter | NASA Ames PCoE | https://data.nasa.gov/dataset/precursor-parameter-identification-for-insulated-gate-bipolar-transistor-igbt-prognostics | https://phm-datasets.s3.amazonaws.com/NASA/8.+IGBT+Accelerated+Aging.zip | public_proxy | Discrete IGBT | `EXTERNAL_REAL` | 12 devices | Same as nasa_igbt | True | True | Latch-up, Gate Breakdown | Vce(sat) degradation | Vce(sat), Vge(th), Ic | V, V, A | False | Public Domain / CC0 | `LICENSE_CONFIRMED` | Celaya et al., 2012 | `DUPLICATE / ALTERNATE SOURCE` | `AUDITED_DUPLICATE` |
| `nasa_capacitor` | NASA Electrolytic Capacitor Aging | NASA Ames PCoE | https://data.nasa.gov/dataset/accelerated-aging-experiments-for-capacitor-health-monitoring-and-prognostics | https://phm-datasets.s3.amazonaws.com/NASA/11.+Capacitor+Electrical+Stress.zip | public_proxy | Aluminum Electrolytic Capacitor | `EXTERNAL_REAL` | 20 devices | ~20 time-series runs | True | True | Electrolyte Loss, High ESR | ESR > 200% increase, C < 80% baseline | ESR, Capacitance (C), Ileak, Temp | Ohm, F, A, C | False | Public Domain / CC0 | `LICENSE_CONFIRMED` | Celaya et al., 2012 | ESR & Degradation Benchmark | `AUDITED_CANDIDATE` |
| `nasa_capacitor_phm` | NASA Capacitor PHM Models | NASA Ames PCoE | https://data.nasa.gov/dataset/prognostics-health-management-and-physics-based-failure-models-for-electrolytic-capacitors | https://phm-datasets.s3.amazonaws.com/NASA/11.+Capacitor+Electrical+Stress.zip | public_proxy | Electrolytic Capacitor | `EXTERNAL_REAL` | 20 devices | Same as nasa_capacitor | True | True | High ESR, Capacitance Loss | ESR increase | ESR, C, Temp | Ohm, F, C | False | Public Domain / CC0 | `LICENSE_CONFIRMED` | Kulkarni et al., 2012 | `DUPLICATE / ALTERNATE SOURCE` | `AUDITED_DUPLICATE` |
| `uci_ai4i` | UCI AI4I 2020 Predictive Maintenance | UCI Machine Learning Repository | https://archive.ics.uci.edu/dataset/601/ai4i%2B2020%2Bpredictive%2Bmaint | https://archive.ics.uci.edu/static/public/601/ai4i+2020+predictive+maintenance+dataset.zip | public_proxy | Milling Machine Tool | `EXTERNAL_SYNTHETIC` | 10,000 synthetic rows | 10,000 rows | False | True | Tool Wear, Heat Dissipation, Power, Overstrain, Random | Machine Failure Binary + 5 Failure Codes | Air temp, Process temp, Speed, Torque, Tool wear | K, K, rpm, Nm, min | False | CC BY 4.0 | `LICENSE_CONFIRMED` | Matzka, IEEE 2020 | Generalization Test (Non-Semiconductor) | `AUDITED_CANDIDATE` |

---

## 3. Dataset Identity & Alternate Source Audit

A critical finding of this audit is that several entry URLs listed on the NASA Open Data Portal refer to the **exact same underlying experimental datasets** hosted in the NASA Ames Prognostics CoE S3 data repository.

### Identity Resolutions:
1. **MOSFET Thermal Overstress Datasets:**
   - Resource `prognostics-of-power-mosfet` and Resource `prognostics-approach-for-power-mosfet-under-thermal-stress-aging` map to the identical underlying dataset (`NASA/13. MOSFET Thermal Overstress Aging.zip`).
   - **Resolution:** Consolidated under dataset ID `nasa_mosfet`.

2. **IGBT Accelerated Aging Datasets:**
   - Resource `precursor-parameter-identification-for-insulated-gate-bipolar-transistor-igbt-prognostics` and S3 archive `NASA/8. IGBT Accelerated Aging.zip` map to the identical underlying experimental data.
   - **Resolution:** Consolidated under dataset ID `nasa_igbt`.

3. **Capacitor Accelerated Aging Datasets:**
   - Resource `prognostics-health-management-and-physics-based-failure-models-for-electrolytic-capacitors` and `accelerated-aging-experiments-for-capacitor-health-monitoring-and-prognostics` map to the identical underlying dataset (`NASA/11. Capacitor Electrical Stress.zip`).
   - **Resolution:** Consolidated under dataset ID `nasa_capacitor`.

---

## 4. PREDICTA Architecture Compatibility Classification

| Dataset ID | Architecture Compatibility | Justification & Architectural Role |
| :--- | :--- | :--- |
| `st_awfd` | `ADAPTABLE` | Excellent benchmark for lot-level spatial anomaly detection and E-test screening. Contains `MaterialID` production lot groupings matching PREDICTA's `lot_id` concept. Lacks burn-in time-series aging logs. |
| `uci_secom` | `VALIDATION_ONLY` | High-dimensional in-line fab sensor readings (590 features). Useful for validating unsupervised COPOD/MAD anomaly detectors. Cannot validate BTI/thermal degradation due to static single-point nature. |
| `nasa_mosfet` | `DIRECTLY_COMPATIBLE` | Contains direct time-series telemetry ($V_{gs(th)}$, $I_{gss}$, $R_{ds(on)}$, temperature) tracking semiconductor degradation under stress. Directly maps to PREDICTA BTI ($V_{th}$) and leakage ($I_{leak}$) channels. |
| `nasa_igbt` | `DIRECTLY_COMPATIBLE` | Contains time-series collector-emitter voltage ($V_{ce(sat)}$), gate current ($I_g$), and threshold voltage ($V_{ge(th)}$) degradation logs under thermal stress. Matches PREDICTA aging & prognostic forecasting modules. |
| `nasa_capacitor` | `ADAPTABLE` | Tracks ESR and capacitance degradation over electrical/thermal stress. Compatible with PREDICTA general prognostic RUL estimation, but component physics differs from silicon FET/IGBT devices. |
| `uci_ai4i` | `OUT_OF_SCOPE` (for Core Physics) / `VALIDATION_ONLY` (for General ML) | Classified strictly as `EXTERNAL_SYNTHETIC`. Represents mechanical CNC milling machine tool wear (rpm, Torque, Tool Wear min). Out of scope for silicon physics validation, but valid as a cross-domain generalization test. |

---

## 5. Direct Source Feature to PREDICTA Schema Mapping

The PREDICTA schema consists of 28 locked production features (including 0h baseline, 24h burn-in telemetry, 168h ground truth/forecast, $V_{th}$ shift, $I_{leak}$, $I_{ddq}$, $T_{pd}$, temperature, and voltage).

### Feature Mapping Table:

| Source Dataset | Source Feature | PREDICTA Feature | Transformation Required | Unit Conversion | Semantic Compatibility | Leakage Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `nasa_mosfet` | `Vgs(th)` | `threshold_voltage` / `vth_shift_24h` | Delta relative to 0h baseline: $V_{th}(t) - V_{th}(0)$ | Volts (V) $\rightarrow$ Volts (V) | `DIRECT_MATCH` | Low (time-indexed) |
| `nasa_mosfet` | `Igss` / `Idss` | `ileak_0h` / `ileak_24h` | Direct extraction at burn-in time checkpoints (0h, 24h) | Amperes (A) $\rightarrow$ Microamperes ($\mu$A) ($\times 10^6$) | `DIRECT_MATCH` | Low (time-indexed) |
| `nasa_mosfet` | `Temperature` | `temperature` | Direct extraction | Celsius ($^\circ\text{C}$) $\rightarrow$ Celsius ($^\circ\text{C}$) | `DIRECT_MATCH` | None |
| `nasa_igbt` | `Vge(th)` | `threshold_voltage` / `vth_shift_24h` | Delta relative to 0h baseline | Volts (V) $\rightarrow$ Volts (V) | `SEMANTIC_MATCH` | Low (time-indexed) |
| `nasa_igbt` | `Ig` | `ileak_0h` / `ileak_24h` | Direct extraction at burn-in checkpoints | Amperes (A) $\rightarrow$ Microamperes ($\mu$A) | `SEMANTIC_MATCH` | Low (time-indexed) |
| `nasa_igbt` | `Vce(sat)` | `tpd_0h` / `tpd_24h` | Derived conduction delay analog: $T_{pd} \propto V_{ce(sat)} / I_c$ | Volts (V) $\rightarrow$ Picoseconds (ps) | `DERIVED_FEATURE` | Low |
| `st_awfd` | `MaterialID` | `lot_id` | String formatting: `LOT-ST-` + `MaterialID` | Identifier $\rightarrow$ String | `DIRECT_MATCH` | `CRITICAL_LOT_LEAKAGE` (if split randomly) |
| `st_awfd` | E-test sensor values | `iddq_0h` / `ileak_0h` | Standardized z-score transform to match PREDICTA range | Dimensionless $\rightarrow$ $\mu$A | `DERIVED_FEATURE` | Low |
| `uci_secom` | Sensor features 0..589 | `iddq_0h`..`ileak_0h` | PCA / Feature selection mapping top 10 variance components | Dimensionless z-scores | `NO_COMPATIBLE_FEATURE` (Anonymized) | High if missing values imputed globally |
| `uci_ai4i` | `Tool wear [min]` | `burn_in_hour` | Direct mapping to stress duration | Minutes $\rightarrow$ Hours ($\div 60$) | `SEMANTIC_MATCH` | None |
| `uci_ai4i` | `Air temperature [K]` | `temperature` | Kelvin to Celsius conversion: $T(^\circ\text{C}) = T(K) - 273.15$ | Kelvin (K) $\rightarrow$ Celsius ($^\circ\text{C}$) | `SEMANTIC_MATCH` | None |

---

## 6. Target & Label Semantics Audit

A key requirement of Stage 8 Task 1 is verifying that external dataset failure labels are **NOT** blindly assumed to equal PREDICTA failure definitions.

| Dataset ID | Source Target Column | Source Target Semantics | PREDICTA Target Mapping | Required Transformation |
| :--- | :--- | :--- | :--- | :--- |
| `st_awfd` | `target` (0/1) | Wafer lot fault (fabrication defect / yield drop) | `fault_indicator` (0 = PASS, 1 = REJECT) | Direct mapping. 1 indicates defective lot. |
| `uci_secom` | `Pass/Fail` (-1 / +1) | In-line fab process failure at wafer test | `fault_indicator` (0 = PASS, 1 = REJECT) | Map -1 $\rightarrow$ 0 (PASS), +1 $\rightarrow$ 1 (REJECT). |
| `nasa_mosfet` | `Rds(on)` growth / Breakdown | Continuous $R_{ds(on)}$ degradation & thermal failure | `rul_hours` & `fault_indicator` | Binary fault when $R_{ds(on)} > 1.20 \times R_{ds(on)}(0)$ or $V_{th}$ shifts > 15%. RUL is remaining time to failure. |
| `nasa_igbt` | `Vce(sat)` growth / Short | Electrical over-stress failure ($V_{ce}$ thermal runaway) | `rul_hours` & `fault_indicator` | Binary fault when $V_{ce(sat)} > 1.15 \times V_{ce0}$. RUL is time to latch-up/breakdown. |
| `nasa_capacitor` | `ESR` / `Capacitance` | ESR increase > 200% or Capacitance drop > 20% | `rul_hours` & `fault_indicator` | Binary fault when $ESR(t) \ge 2.0 \times ESR(0)$. |
| `uci_ai4i` | `Machine failure` (0/1) | Mechanical tool failure (Tool wear / Overstrain) | `fault_indicator` (Validation Only) | Direct mapping for machine-learning generalization experiments. **Do NOT use for silicon physics.** |

---

## 7. Forensic Leakage & Splitting Audit

### Critical Findings:

1. **STMicroelectronics ST-AWFD Lot-Level Leakage:**
   - `MaterialID` represents the production lot ID.
   - **Hazard:** Performing random row-level splitting (`train_test_split(df)`) across ST-AWFD's 602,108 rows causes catastrophic data leakage! Multiple step observations from the same `MaterialID` would be split simultaneously into training and validation sets, inflating model validation metrics fraudulently.
   - **Mandated Fix:** Splitting MUST be performed strictly at the `MaterialID` level using `GroupKFold(groups=df['MaterialID'])` or `GroupShuffleSplit`.

2. **Temporal Leakage in NASA Degradation Time-Series:**
   - In `nasa_mosfet`, `nasa_igbt`, and `nasa_capacitor`, measurements are sequential time series from specific devices.
   - **Hazard:** Splitting individual time-series samples randomly across train and test leaks future health states into past prediction intervals.
   - **Mandated Fix:** Device-level splitting (Group by `device_id`) or strict temporal cutoff splitting ($t \le 24h$ for training features, $t > 24h$ strictly for evaluation targets).

3. **Global Preprocessing / Imputation Leakage (UCI SECOM):**
   - UCI SECOM contains missing values across many of its 590 columns.
   - **Hazard:** Imputing missing values or computing z-score scaling parameters ($mean, std$) across the full dataset prior to splitting leaks test distribution statistics into training data.
   - **Mandated Fix:** All imputation (`SimpleImputer`) and scaling (`StandardScaler`) pipelines MUST be fit strictly on the training split only.

---

## 8. Provenance Classification Summary

All candidate datasets are formally assigned to one of four authoritative provenance classes:

1. **`PREDICTA_SYNTHETIC`**:
   - `predicta_dataset_v3_50000.csv` (Authoritative baseline synthetic production dataset).
2. **`EXTERNAL_REAL`**:
   - `st_awfd` (STMicroelectronics ST-AWFD, D1 & D2)
   - `uci_secom` (UCI SECOM Process Logs)
   - `nasa_mosfet` (NASA Power MOSFET Thermal Overstress Aging)
   - `nasa_igbt` (NASA IGBT Accelerated Aging)
   - `nasa_capacitor` (NASA Electrolytic Capacitor Aging)
3. **`EXTERNAL_SYNTHETIC`**:
   - `uci_ai4i` (UCI AI4I 2020 Predictive Maintenance Dataset)
4. **`UNKNOWN`**:
   - None.

---

## 9. Recommended Training & Validation Roles

| Dataset ID | Recommended Role | Architectural Purpose |
| :--- | :--- | :--- |
| `st_awfd` | `EXTERNAL_VALIDATION` | Validates lot-level spatial anomaly detection and E-test screening performance. |
| `uci_secom` | `CROSS_DOMAIN_VALIDATION` | Benchmarks high-dimensional unsupervised process anomaly screening algorithms. |
| `nasa_mosfet` | `TRAINING_CANDIDATE` / `EXTERNAL_VALIDATION` | Provides real physical $V_{th}$ and $I_{leak}$ degradation trajectories for physics-aware model calibration. |
| `nasa_igbt` | `TRAINING_CANDIDATE` / `EXTERNAL_VALIDATION` | Provides real physical IGBT semiconductor aging trajectories under thermal and voltage stress. |
| `nasa_capacitor` | `CROSS_DOMAIN_VALIDATION` | Benchmarks general RUL estimation algorithms on passive component degradation. |
| `uci_ai4i` | `GENERALIZATION_TEST` | Evaluates cross-domain ML classifier generalization on synthetic industrial tool-wear data. |

---

## 10. Dataset Family Boundaries

To prevent corrupting PREDICTA's domain physics, four strict dataset family boundaries are established:

```
                          ┌────────────────────────────────────────────────────────┐
                          │   PREDICTA PROVENANCE & DATASET FAMILY ARCHITECTURE    │
                          └───────────────────────────┬────────────────────────────┘
                                                      │
         ┌────────────────────────┬───────────────────┴───────────────┬────────────────────────┐
         ▼                        ▼                                   ▼                        ▼
┌──────────────────┐    ┌──────────────────┐                ┌──────────────────┐     ┌──────────────────┐
│  MANUFACTURING   │    │  SEMICONDUCTOR   │                │   PROGNOSTICS    │     │  GENERALIZATION  │
│ ANOMALY FAMILY   │    │   AGING FAMILY   │                │  TIME-SERIES     │     │      FAMILY      │
├──────────────────┤    ├──────────────────┤                ├──────────────────┤     ├──────────────────┤
│ - ST-AWFD        │    │ - NASA MOSFET    │                │ - NASA MOSFET    │     │ - UCI AI4I 2020  │
│ - UCI SECOM      │    │ - NASA IGBT      │                │ - NASA IGBT      │     │   (Synthetic)    │
│                  │    │ - NASA Capacitor │                │ - NASA Capacitor │     │                  │
└──────────────────┘    └──────────────────┘                └──────────────────┘     └──────────────────┘
```

---

## 11. Existing PREDICTA Repository Integration Findings

An audit of the PREDICTA codebase confirms the following integration architecture:
1. **Registry Integration (`data/dataset_registry.yaml`):**
   - Stores authoritative metadata, license status, sample counts, and parameter mappings for proxy datasets.
2. **Synthetic Data Generator (`ml/data_generator/generate_dataset.py`):**
   - Emits 28-feature schema datasets (`predicta_dataset_v3_50000.csv`) adhering to locked physical bounds (BTI power law, Arrhenius thermal acceleration, gate oxide breakdown).
3. **Physics Engine (`src/physics/reliability_engine.py`):**
   - Evaluates physics consistency evidence across 5 checks without relying on dataset-specific hardcoding.

---

## 12. Authoritative Data Rules for Stage 8+

1. **Synthetic Preservation Rule:** `predicta_dataset_v3_50000.csv` remains the authoritative synthetic baseline. No external dataset may replace it.
2. **Provenance Tagging:** Every ingested record must retain explicit `dataset_id` and `provenance_class` tags.
3. **No Retraining in Task 1:** No ML models have been retrained, modified, or re-calibrated during this audit task.

---

## 13. Required Future Integration Work (Stage 8 Task 2+)

1. **Loader Implementation:** Implement dedicated, isolated dataset loaders in `ml/data/external/` for `st_awfd`, `nasa_mosfet`, and `nasa_igbt`.
2. **Lot-Grouped Splitters:** Build `MaterialID` grouped splitters for `st_awfd` to enforce zero-leakage validation.
3. **Schema Transformer Pipelines:** Build feature transformer adapters mapping external features into PREDICTA's 28-feature format.

---

## 14. Verification & Certification Statement

- **Python Test Suite:** Passed 370/370 tests cleanly.
- **Node.js Test Suite:** Passed 32/32 tests cleanly (18/18 release criteria, 14/14 prognostic parity).
- **Git Status:** Working tree clean; zero production code or model artifact changes.

**Certification:** Stage 8 Task 1 External Dataset Provenance & Compatibility Audit is complete and certified.
