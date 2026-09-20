# PREDICTA-26 External Dataset Inventory

---

## 1. Purpose

The PREDICTA-26 external dataset layer provides independent, multi-source validation benchmarks for evaluating the reliability engine, prognostic algorithms, manufacturing anomaly detectors, and cross-domain generalization capabilities of the architecture.

Key objectives of external dataset integration include:
- **Manufacturing Anomaly Validation:** Benchmarking wafer-level and lot-relative spatial/parametric anomaly detection algorithms against real silicon fab E-test logs and yield test data.
- **Degradation & Prognostics Validation:** Testing physical degradation trajectory tracking ($V_{th}$ drift, $V_{ce}$ saturation shift, thermal impedance decay) using real accelerated stress testing datasets.
- **Cross-Domain Validation:** Verifying that physics-aware failure models and reliability algorithms function robustly across power transistors (MOSFETs, IGBTs) and passive components (electrolytic capacitors).
- **Generalization Testing:** Evaluating machine learning classifier behavior on out-of-domain synthetic industrial machinery datasets without corrupting silicon-specific physics models.

---

## 2. Dataset Provenance Classes

To maintain 100% auditability and prevent dataset contamination, every dataset in the PREDICTA-26 inventory is categorized into one of three strict provenance classes:

- `EXTERNAL_REAL`: Real physical measurement datasets generated from semiconductor wafer fab E-tests, accelerated laboratory aging experiments (MOSFET/IGBT), or industrial sensor logs.
- `EXTERNAL_SYNTHETIC`: External synthetic benchmark datasets (e.g., UCI AI4I 2020) kept strictly isolated from silicon physics models for domain generalization testing.
- `REMOTE_EXTERNAL_DATASET`: Real physical datasets registered via authoritative remote endpoints (e.g., S3 or Dataverse DOIs) when their multi-gigabyte file sizes exceed GitHub repository blob limits (100 MB per file) or Git LFS server quotas.

> [!IMPORTANT]
> External datasets are NEVER classified as `PREDICTA_SYNTHETIC`. The primary PREDICTA production synthetic dataset (`data/predicta_dataset_v3_50000.csv`) remains completely untouched and isolated.

---

## 3. Dataset Summary Table

| Dataset Name | Source Organization | Family | Real / Synthetic | Downloaded? | Archive / File Size | Samples / Devices | Time-Series | Labels Available | Primary Role | Feature Compatibility | License Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **ST-AWFD D1** | STMicroelectronics | manufacturing_anomaly | EXTERNAL_REAL | Yes | 15.4 MB (Raw) / 127.2 MB (CSV) | 602,108 rows / 5,104 lots | Yes | Binary Anomaly Target | TRAINING_CANDIDATE | NO_COMPATIBLE_FEATURE | LICENSE_CONFIRMED (CC BY-NC-SA 4.0) |
| **ST-AWFD D2** | STMicroelectronics | manufacturing_anomaly | EXTERNAL_REAL | Yes | 3.71 MB (Raw) / 34.1 MB (CSV) | 126,794 rows / 1,156 lots | Yes | Binary Anomaly Target | EXTERNAL_VALIDATION | NO_COMPATIBLE_FEATURE | LICENSE_CONFIRMED (CC BY-NC-SA 4.0) |
| **UCI SECOM** | UCI ML Repository | manufacturing_anomaly | EXTERNAL_REAL | Yes | 1.96 MB | 1,567 rows / 590 sensors | Yes | Binary Yield Failure | EXTERNAL_VALIDATION | NO_COMPATIBLE_FEATURE | LICENSE_UNSPECIFIED |
| **UCI AI4I 2020** | UCI ML Repository | generalization | EXTERNAL_SYNTHETIC | Yes | 522 KB | 10,000 rows / 10,000 tools | Yes | Machine Failure + 5 Modes | GENERALIZATION_TEST | NO_COMPATIBLE_FEATURE | LICENSE_CONFIRMED (CC BY 4.0) |
| **NASA IGBT #8** | NASA Ames PCoE | semiconductor_aging | EXTERNAL_REAL | Yes | 240.5 MB | 258 files / 6 devices | Yes | Continuous Vce + Rth | CROSS_DOMAIN_VALIDATION | SEMANTIC_MATCH | LICENSE_REQUIRES_REVIEW (U.S. Gov) |
| **NASA MOSFET #13** | NASA Ames PCoE | semiconductor_aging | REMOTE_EXTERNAL_DATASET | Remote (7.85 GB) | 7.85 GB (S3 Archive) | 34 devices | Yes | Continuous Vth + Rds(on) | CROSS_DOMAIN_VALIDATION | SEMANTIC_MATCH | LICENSE_UNSPECIFIED |
| **NASA Capacitor #12** | NASA Ames PCoE | component_aging | REMOTE_EXTERNAL_DATASET | Remote (5.04 GB) | 5.04 GB (S3 Archive) | 6 capacitors | Yes | Continuous ESR + Cap Loss | CROSS_DOMAIN_VALIDATION | NO_COMPATIBLE_FEATURE | LICENSE_UNSPECIFIED |
| **UPC Si IGBT 2026** | UPC Barcelona | semiconductor_aging | EXTERNAL_REAL | Remote (Dataverse DOI) | Registered via DOI | 3 devices (DUTs) | Yes | Continuous Vce + Rth,j-c | CROSS_DOMAIN_VALIDATION | SEMANTIC_MATCH | LICENSE_CONFIRMED (CC BY 4.0) |

---

## 4. Manufacturing Anomaly Datasets

### A. STMicroelectronics ST-AWFD D1 & D2
- **Source Repository:** `https://github.com/STMicroelectronics/ST-AWFD`
- **Description:** Industrial wafer fabrication parametric E-test sensor logs covering 5,104 production lots (D1) and 1,156 production lots (D2).
- **Physical Characteristics:** Multi-step time-series measurements (`duration_ms`), anonymized parametric test features, and lot identifiers (`MaterialID`).
- **Usefulness:** Directly benchmarks PREDICTA Module A lot-relative and spatial anomaly detection algorithms on real silicon manufacturing logs.

### B. UCI SECOM Semiconductor Manufacturing Data
- **Source Repository:** `https://archive.ics.uci.edu/dataset/179/secom`
- **Description:** High-dimensional in-line semiconductor process logs containing 590 anonymized sensor features across 1,567 wafer test instances.
- **Physical Characteristics:** Contains 41,951 missing values and imbalanced yield test labels (104 fails vs 1,463 passes).
- **Usefulness:** Validates high-dimensional feature selection and missingness-aware anomaly detection models.

---

## 5. Semiconductor Aging Datasets

### A. NASA PCoE IGBT Accelerated Aging (Dataset #8)
- **Source Repository:** `https://phm-datasets.s3.amazonaws.com/NASA/8.+IGBT+Accelerated+Aging.zip`
- **Description:** Accelerated thermal/electrical overstress aging data for 6 IRG4BC30K IGBT power transistors (1 device under DC gate bias, 5 devices under squared signal gate bias).
- **Physical Characteristics:** High-frequency SMU waveform logs recording $V_{ce(sat)}$, collector current $I_c$, gate voltage $V_{ge}$, and thermal impedance $R_{th}$.
- **Usefulness:** Primary experimental benchmark for calibrating power semiconductor degradation forecasting and precursor parameter breakdown models.

### B. NASA PCoE MOSFET Thermal Overstress Aging (Dataset #13)
- **Source Repository:** `https://phm-datasets.s3.amazonaws.com/NASA/13.+MOSFET+Thermal+Overstress+Aging.zip`
- **Description:** Accelerated thermal overstress aging experiments conducted on 34 power MOSFET devices under static gate voltage bias at 175°C.
- **Physical Characteristics:** Tracks continuous threshold voltage shift ($V_{gs(th)}$), drain-source ON resistance ($R_{ds(on)}$), and gate/drain leakage currents.
- **Usefulness:** Core physical reference for calibrating PREDICTA Module B threshold voltage drift models.

### C. UPC Si IGBT Accelerated Power-Cycling Aging Dataset (2026)
- **DOI Endpoint:** `https://doi.org/10.34810/data3204`
- **Dataverse URL:** `https://dataverse.csuc.cat/dataset.xhtml?persistentId=doi:10.34810/DATA3204`
- **Description:** Recent 2026 experimental dataset from Universitat Politècnica de Catalunya capturing electrical and thermal degradation of 3 Si IGBT devices under power cycling per ECPE AQG 324 guidelines.
- **Physical Characteristics:** Measures collector current $I_c$, collector-emitter saturation voltage $V_{ce}$, junction temperature $T_j$, case temperature $T_c$, conduction losses $P_{ce}$, and thermal resistance $R_{th,j-c}$ until failure.
- **Usefulness:** Provides independent 2026 experimental validation for Si IGBT thermal resistance decay and conduction voltage degradation under power-cycling stress.

---

## 6. Cross-Domain Aging Datasets

### NASA PCoE Electrolytic Capacitor Electrical Stress Aging (Dataset #12)
- **Source Repository:** `https://phm-datasets.s3.amazonaws.com/NASA/12.+Capacitor+Electrical+Stress.zip`
- **Description:** Accelerated electrical overstress and thermal aging experiments on 6 aluminum electrolytic capacitors.
- **Physical Characteristics:** Tracks Equivalent Series Resistance (ESR) increase, capacitance loss, and leakage current over operational time.
- **Usefulness:** Evaluates reliability engine adaptability on passive electronic components outside silicon FET/IGBT physics.

---

## 7. External Synthetic Generalization Datasets

### UCI AI4I 2020 Predictive Maintenance Dataset
- **Source Repository:** `https://archive.ics.uci.edu/dataset/601/ai4i%2B2020%2Bpredictive%2Bmaintenance`
- **Description:** Synthetic industrial CNC milling machine dataset containing 10,000 operational records, tool wear metrics, and 5 mechanical failure modes.
- **Physical Characteristics:** Mechanical variables (air/process temperature in K, rotational speed in rpm, torque in Nm, tool wear in min).
- **Usefulness:** Benchmarks ML binary classification performance on out-of-domain synthetic data; strictly isolated from semiconductor physics.

---

## 8. Feature Compatibility Matrix

Every external variable mapping to the PREDICTA feature schema is strictly evaluated using only four explicit classifications:

| Dataset | External Variable | PREDICTA Target Feature | Compatibility Classification | Technical Justification |
|---|---|---|---|---|
| ST-AWFD D1/D2 | `feature_1` ... `feature_15` | N/A | `NO_COMPATIBLE_FEATURE` | Wafer E-test sensor logs represent process step measurements, not direct silicon IDDQ/ILEAK. |
| UCI SECOM | `sensor_0` ... `sensor_589` | N/A | `NO_COMPATIBLE_FEATURE` | Anonymous sensor channels have no verified physical correspondence to PREDICTA features. |
| UCI AI4I 2020 | `Tool wear [min]`, `Torque [Nm]` | N/A | `NO_COMPATIBLE_FEATURE` | Mechanical tool wear and torque are not semantically equivalent to semiconductor FET parameters. |
| NASA IGBT #8 | $V_{ce(sat)}$, $V_{ge(th)}$ | `threshold_voltage`, $I_{leak}$ | `SEMANTIC_MATCH` | $V_{ce(sat)}$ and $V_{ge(th)}$ capture power transistor conduction and threshold degradation, semantically parallel to PREDICTA drift trends. |
| NASA MOSFET #13 | $V_{gs(th)}$, $R_{ds(on)}$ | `threshold_voltage`, $I_{ddq}$ | `SEMANTIC_MATCH` | $V_{gs(th)}$ and $R_{ds(on)}$ physically represent MOSFET threshold shift and conduction degradation. |
| NASA Capacitor #12 | ESR, Capacitance | N/A | `NO_COMPATIBLE_FEATURE` | Passive capacitor parameters (ESR, Capacitance) differ physically from silicon semiconductor FET/IGBT physics. |
| UPC Si IGBT 2026 | $V_{ce}$, $R_{th,j-c}$ | `threshold_voltage`, $T_{junction}$ | `SEMANTIC_MATCH` | $V_{ce}$ and thermal resistance $R_{th,j-c}$ capture power cycling conduction and junction thermal degradation under ECPE AQG 324 stress. |

---

## 9. Label Semantics Matrix

To prevent misleading claims, dataset labels are explicitly separated across 5 distinct verification columns:

| Dataset | Binary Labels Available | Continuous Degradation Available | Time-to-Failure Available | Failure Event Available | Verified Label Semantics |
|---|---|---|---|---|---|
| ST-AWFD D1 | `true` | `false` | `false` | `true` | Binary wafer anomaly target (0: normal, 1: anomaly) |
| ST-AWFD D2 | `true` | `false` | `false` | `true` | Binary wafer anomaly target (0: normal, 1: anomaly) |
| UCI SECOM | `true` | `false` | `false` | `true` | Binary yield failure target (-1: pass, 1: fail) |
| UCI AI4I 2020 | `true` | `true` | `false` | `true` | Machine failure binary target + 5 failure modes |
| NASA IGBT #8 | `false` | `true` | `true` | `true` | Continuous degradation ($V_{ce(sat)}$, $R_{th}$) & time-to-failure |
| NASA MOSFET #13 | `false` | `true` | `true` | `true` | Continuous degradation ($V_{gs(th)}$, $R_{ds(on)}$) & EOL markers |
| NASA Capacitor #12 | `false` | `true` | `true` | `true` | Continuous degradation (ESR, Capacitance) & EOL markers |
| UPC Si IGBT 2026 | `false` | `true` | `true` | `true` | Continuous degradation ($V_{ce}$, $R_{th,j-c}$) & complete failure |

---

## 10. Leakage & Split Controls

To guarantee empirical validity and prevent data leakage during future experiments:

1. **ST-AWFD D1 & D2:** Must be split strictly by `MaterialID` (production lot grouping). Random row-level splitting across train/test sets causes severe lot-level data leakage.
2. **NASA IGBT #8 & MOSFET #13:** Must be split strictly by `Device ID`. Temporal sequence ordering within each device run must be preserved; future degradation states must never leak into early observation windows.
3. **UPC Si IGBT 2026:** Must be split strictly by Device Under Test (DUT 1, 2, 3) and power-cycling step sequence.
4. **UCI SECOM:** Preprocessing transformers (imputation, scaling) must be fit strictly on training splits. Missingness patterns must be preserved.
5. **UCI AI4I 2020:** Must remain 100% isolated as `EXTERNAL_SYNTHETIC` and never combined into semiconductor training splits.

---

## 11. Storage & Repository Integrity

Physical dataset storage rules strictly enforce repository bounds:
- **Raw Immutable Storage:** `data/external/raw/` stores original downloaded archives without modification.
- **Extracted Storage:** `data/external/extracted/` stores extracted CSV/data files.
- **Git LFS Tracked Files:**
  - `data/external/raw/nasa_igbt/*.zip` (240.5 MB)
  - `data/external/extracted/st_awfd/D1/*.csv` (127.2 MB)
  - `data/external/extracted/nasa_igbt/**/*.zip` (240.5 MB)
- **Remote Large Datasets:** Datasets exceeding GitHub repository limits (NASA MOSFET #13: 7.85 GB, NASA Capacitor #12: 5.04 GB, UPC Si IGBT 2026: Dataverse DOI) are registered via verified remote S3/DOI endpoints.

---

## 12. Licensing Policy

Licenses are verified directly from source metadata without invention:
- `LICENSE_CONFIRMED`: `CC BY-NC-SA 4.0` (ST-AWFD), `CC BY 4.0` (UCI AI4I, UPC Si IGBT 2026).
- `LICENSE_REQUIRES_REVIEW`: U.S. Government Works terms (NASA IGBT #8).
- `LICENSE_UNSPECIFIED`: Unspecified on official source landing page (UCI SECOM, NASA MOSFET #13, NASA Capacitor #12).

---

## 13. Current Acquisition Status Overview

| Status Category | Count | Datasets Included |
|---|---|---|
| `IMPORTED_AND_VERIFIED` | 5 | ST-AWFD D1, ST-AWFD D2, UCI SECOM, UCI AI4I 2020, NASA IGBT #8 |
| `REMOTE_EXTERNAL_DATASET` | 3 | NASA MOSFET #13 (7.85 GB S3), NASA Capacitor #12 (5.04 GB S3), UPC Si IGBT 2026 (Dataverse DOI) |
| `NOT_AVAILABLE` | 0 | None |
| `REQUIRES_REVIEW` | 0 | None |

---

## 14. Scope Boundary Confirmation

External datasets are imported strictly for independent benchmarking, cross-domain validation, and research documentation. They are **NOT** automatically merged into PREDICTA production training pipelines. The primary PREDICTA production synthetic dataset (`data/predicta_dataset_v3_50000.csv`), ML model weights, thresholds (`0.20`), physics primitives, and calibration artifacts remain 100% untouched and unchanged.
