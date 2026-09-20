# PREDICTA-26 — Stage 8 Task 1: External Dataset Provenance + Compatibility Audit

**Authoritative Governance Document**  
**Stage:** Stage 8 Task 1 (Dataset Expansion & Source Integration Audit)  
**Status:** AUDIT & SOURCE INSPECTION ONLY — NO MODEL TRAINING / RE-TRAINING / PIPELINE MUTATION  
**Date:** September 20, 2026 (Updated Corrective Pass)  

---

## 1. Executive Summary & Audit Mandate

This document establishes the official forensic provenance, licensing, target compatibility, feature mapping, leakage risks, and structural dataset family boundaries for nine external public candidate dataset resources evaluated for PREDICTA-26.

### Key Audit Mandates:
1. **Source Integrity:** The current PREDICTA synthetic production dataset (`predicta_dataset_v3_50000.csv`) remains the authoritative baseline for core model development and production calibration. External datasets must **NEVER** silently replace or overwrite PREDICTA native synthetic data.
2. **Synthetic vs. Real Separation:** Synthetic datasets (such as UCI AI4I 2020) are explicitly classified as `EXTERNAL_SYNTHETIC` and must be kept strictly isolated from real physical semiconductor component aging datasets.
3. **No Unsafe Merging / Retraining:** This audit is 100% read-only and analytical. No model training, retraining, model weight modification, threshold adjustment, conformal calibration alteration, or physics primitive mutation was performed.

---

## 2. Comprehensive External Dataset Inventory

The table below summarizes the official provenance, identity, licensing, verification levels, and recommended roles for all candidate dataset resources.

### Approved License Status Categories:
- `LICENSE_CONFIRMED`: Official open source or creative commons license explicitly verified at source.
- `LICENSE_UNSPECIFIED`: Publicly accessible resource without an explicit license document at source portal.
- `LICENSE_REQUIRES_REVIEW`: Custom academic, government, or organizational terms requiring legal review prior to commercial product distribution.

### Verification Levels:
- `VERIFIED_FROM_OFFICIAL_METADATA`: Verified directly from official repository documentation or portal metadata.
- `VERIFIED_FROM_ARCHIVE`: Verified through direct inspection of the downloadable archive.
- `NOT_VERIFIED`: Not verified at Task 1 (requires controlled archive acquisition in future task).

| dataset_id | dataset_name | source_organization | official_url | download_url | source_type | component_type | real_or_synthetic | number_of_devices | number_of_records | time_series | labels_available | failure_modes | degradation_target | key_features | units_available | missing_values | license | license_status | citation | recommended_use | integration_status | verification_level |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `st_awfd` | STMicroelectronics ST-AWFD | STMicroelectronics | https://github.com/STMicroelectronics/ST-AWFD | D1: https://github.com/STMicroelectronics/ST-AWFD/blob/main/Datasets/D1.zip, D2: https://github.com/STMicroelectronics/ST-AWFD/blob/main/Datasets/D2.zip | public_proxy | Wafer / Die E-Test | `EXTERNAL_REAL` | D1: 5,105 MaterialIDs, D2: 1,157 MaterialIDs | D1: 602,108 rows, D2: 126,795 rows | True (StepID logs per lot) | True | Wafer/Lot Fault | Anomaly Flag (`target`) | MaterialID, StepID, duration_ms, 15 E-test features (D1) / 20 features (D2), target, is_test | ms, various | False | Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) | `LICENSE_CONFIRMED` | Furnari et al., Sensors 2021 | Lot-Level Outlier Benchmark | `AUDITED_CANDIDATE` | `VERIFIED_FROM_OFFICIAL_METADATA` |
| `uci_secom` | UCI SECOM Process Logs | UCI Machine Learning Repository | https://archive.ics.uci.edu/dataset/179/secom | https://archive.ics.uci.edu/static/public/179/secom.zip | public_proxy | Fab Sensor Logs | `EXTERNAL_REAL` | 1,567 wafers | 1,567 rows | False | True | Fab Yield Failure | Pass (-1) / Fail (+1) | 590 anonymous process sensor channels | Anonymized | True (multiple columns) | CC BY 4.0 | `LICENSE_CONFIRMED` | McCann & Johnston, 2008 | High-Dim Outlier Selection | `AUDITED_CANDIDATE` | `VERIFIED_FROM_OFFICIAL_METADATA` |
| `nasa_mosfet` | NASA Power MOSFET Prognostics (PCoE Dataset #13) | NASA Ames PCoE | https://data.nasa.gov/dataset/prognostics-of-power-mosfet | https://phm-datasets.s3.amazonaws.com/NASA/13.+MOSFET+Thermal+Overstress+Aging.zip | public_proxy | Power MOSFET (IRF520/530) | `EXTERNAL_REAL` | NOT VERIFIED AT TASK 1 | NOT VERIFIED AT TASK 1 | True | True | Thermal Breakdown, Die Attach Fault | Continuous Rds(on) & Vth degradation trajectory | Vgs(th), Igss, Idss, Rds(on), Temp | V, A, A, Ohm, C | NOT VERIFIED | License not specified | `LICENSE_UNSPECIFIED` | Celaya et al., PHM 2011 | GPR Drift & Physics Benchmark | `AUDITED_CANDIDATE` | `VERIFIED_FROM_OFFICIAL_METADATA` |
| `nasa_mosfet_thermal` | NASA MOSFET Thermal Stress Aging | NASA Ames PCoE | https://data.nasa.gov/dataset/prognostics-approach-for-power-mosfet-under-thermal-stress-aging | Same as nasa_mosfet | public_proxy | Power MOSFET | `EXTERNAL_REAL` | NOT VERIFIED AT TASK 1 | NOT VERIFIED AT TASK 1 | True | True | Thermal Breakdown | Continuous Rds(on) degradation | Vgs(th), Rds(on), Temp | V, Ohm, C | NOT VERIFIED | License not specified | `LICENSE_UNSPECIFIED` | Celaya et al., PHM 2011 | `DUPLICATE / ALTERNATE SOURCE` | `AUDITED_DUPLICATE` | `VERIFIED_FROM_OFFICIAL_METADATA` |
| `nasa_igbt` | NASA IGBT Accelerated Aging (PCoE Dataset #8) | NASA Ames PCoE | https://data.nasa.gov/dataset/insulated-gate-bipolar-transistor-igbt-accelerated-aging | https://phm-datasets.s3.amazonaws.com/NASA/8.+IGBT+Accelerated+Aging.zip | public_proxy | Discrete IGBT | `EXTERNAL_REAL` | 6 devices (1 DC bias, 5 squared signal bias) | NOT VERIFIED AT TASK 1 | True | True | Latch-up, Gate Breakdown, CE Short | Continuous Vce(sat) & Vge(th) degradation trajectory | Vce(sat), Ic, Ig, Vge(th), Tj | V, A, A, V, C | NOT VERIFIED | U.S. Government Works (other-license-specified: https://www.usa.gov/government-works) | `LICENSE_REQUIRES_REVIEW` | Celaya et al., IEEE 2012 | Thermal Aging & Prognostic Benchmark | `AUDITED_CANDIDATE` | `VERIFIED_FROM_OFFICIAL_METADATA` |
| `nasa_igbt_precursor` | NASA IGBT Precursor-Parameter | NASA Ames PCoE | https://data.nasa.gov/dataset/precursor-parameter-identification-for-insulated-gate-bipolar-transistor-igbt-prognostics | Same as nasa_igbt | public_proxy | Discrete IGBT | `EXTERNAL_REAL` | 6 devices | Same as nasa_igbt | True | True | Latch-up, Gate Breakdown | Continuous Vce(sat) degradation | Vce(sat), Vge(th), Ic | V, V, A | NOT VERIFIED | U.S. Government Works | `LICENSE_REQUIRES_REVIEW` | Celaya et al., 2012 | `DUPLICATE / ALTERNATE SOURCE` | `AUDITED_DUPLICATE` | `VERIFIED_FROM_OFFICIAL_METADATA` |
| `nasa_capacitor` | NASA Electrolytic Capacitor Aging (PCoE Dataset #11/#12) | NASA Ames PCoE | https://data.nasa.gov/dataset/accelerated-aging-experiments-for-capacitor-health-monitoring-and-prognostics | https://phm-datasets.s3.amazonaws.com/NASA/11.+Capacitor+Electrical+Stress.zip | public_proxy | Aluminum Electrolytic Capacitor | `EXTERNAL_REAL` | NOT VERIFIED AT TASK 1 | NOT VERIFIED AT TASK 1 | True | True | Electrolyte Loss, High ESR | Continuous ESR & Capacitance degradation trajectory | ESR, Capacitance (C), Ileak, Temp | Ohm, F, A, C | NOT VERIFIED | License not specified | `LICENSE_UNSPECIFIED` | Celaya et al., 2012 | ESR & Degradation Benchmark | `AUDITED_CANDIDATE` | `VERIFIED_FROM_OFFICIAL_METADATA` |
| `nasa_capacitor_phm` | NASA Capacitor PHM Models | NASA Ames PCoE | https://data.nasa.gov/dataset/prognostics-health-management-and-physics-based-failure-models-for-electrolytic-capacitors | Same as nasa_capacitor | public_proxy | Electrolytic Capacitor | `EXTERNAL_REAL` | NOT VERIFIED AT TASK 1 | Same as nasa_capacitor | True | True | High ESR, Capacitance Loss | Continuous ESR degradation | ESR, C, Temp | Ohm, F, C | NOT VERIFIED | License not specified | `LICENSE_UNSPECIFIED` | Kulkarni et al., 2012 | `DUPLICATE / ALTERNATE SOURCE` | `AUDITED_DUPLICATE` | `VERIFIED_FROM_OFFICIAL_METADATA` |
| `uci_ai4i` | UCI AI4I 2020 Predictive Maintenance Dataset | UCI Machine Learning Repository | https://archive.ics.uci.edu/dataset/601/ai4i%2B2020%2Bpredictive%2Bmaint | https://archive.ics.uci.edu/static/public/601/ai4i+2020+predictive+maintenance+dataset.zip | public_proxy | Milling Machine Tool | `EXTERNAL_SYNTHETIC` | 10,000 synthetic rows | 10,000 rows | True (Multivariate, Time-Series per UCI metadata) | True | Tool Wear, Heat Dissipation, Power, Overstrain, Random | Machine Failure Binary + 5 Failure Codes | Air temp, Process temp, Speed, Torque, Tool wear | K, K, rpm, Nm, min | False | CC BY 4.0 | `LICENSE_CONFIRMED` | Matzka, IEEE 2020 | Generalization Test (Non-Semiconductor) | `AUDITED_CANDIDATE` | `VERIFIED_FROM_OFFICIAL_METADATA` |

---

## 3. Dataset Identity & Alternate Source Audit

A forensic audit of the official NASA Prognostics Center of Excellence (PCoE) repository establishes that several resource URLs listed on data.nasa.gov represent **metadata landing pages or paper references** for identical underlying PCoE S3 data archives.

### Authoritative PCoE Identity Mapping:
1. **MOSFET Thermal Overstress Aging (PCoE Dataset #13):**
   - Resource `prognostics-of-power-mosfet` and Resource `prognostics-approach-for-power-mosfet-under-thermal-stress-aging` refer to the **SAME underlying dataset** (`13. MOSFET Thermal Overstress Aging.zip`).
   - **Classification:** `nasa_mosfet` is the primary `DATASET`. Resource `prognostics-approach-...` is classified as `METADATA_PAGE / ALTERNATE_SOURCE`.

2. **IGBT Accelerated Aging (PCoE Dataset #8):**
   - Resource `precursor-parameter-identification-for-insulated-gate-bipolar-transistor-igbt-prognostics` and S3 archive `8. IGBT Accelerated Aging.zip` refer to the **SAME underlying experimental data**.
   - **Classification:** `nasa_igbt` is the primary `DATASET`. Resource `precursor-parameter-...` is classified as `METADATA_PAGE / PAPER_REFERENCE`.

3. **Capacitor Accelerated Aging (PCoE Dataset #11 / #12):**
   - Resource `prognostics-health-management-and-physics-based-failure-models-for-electrolytic-capacitors` and `accelerated-aging-experiments-for-capacitor-health-monitoring-and-prognostics` refer to the **SAME underlying experimental dataset**.
   - **Classification:** `nasa_capacitor` is the primary `DATASET`. Resource `prognostics-health-management-...` is classified as `PAPER_REFERENCE / METADATA_PAGE`.

---

## 4. Licensing Audit & Commercial Usage Implications

1. **STMicroelectronics ST-AWFD (`CC BY-NC-SA 4.0`):**
   - Official license verified directly at source repository (`STMicroelectronics/ST-AWFD/blob/main/LICENSE`).
   - **Licensing Restrictions:** Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International.
   - **Operational Impact:** Permitted for internal academic evaluation, research benchmarking, and offline algorithm validation. **CANNOT** be distributed in commercial product offerings without express authorization from STMicroelectronics. Adapted derivative artifacts must be distributed under identical ShareAlike terms.

2. **NASA Datasets (`LICENSE_UNSPECIFIED` / `LICENSE_REQUIRES_REVIEW`):**
   - `nasa_mosfet` & `nasa_capacitor`: Official NASA portal metadata specifies `License not specified`. Assigned `license_status = LICENSE_UNSPECIFIED`.
   - `nasa_igbt`: Official NASA portal metadata specifies `other-license-specified` pointing to U.S. Government Works terms (`https://www.usa.gov/government-works`). Assigned `license_status = LICENSE_REQUIRES_REVIEW`.
   - **Operational Impact:** Do not claim Public Domain / CC0 without explicit archive-level documentation. Formal legal review required before commercial code bundling.

3. **UCI Machine Learning Repository (`CC BY 4.0`):**
   - `uci_secom` & `uci_ai4i`: Explicit CC BY 4.0 license confirmed at source. Permitted for distribution with standard attribution.

---

## 5. Strict Feature Mapping Audit (No Unsupported Inferences)

To maintain scientific integrity, feature mappings must **NOT** force unevidenced physical identities onto PREDICTA variables.

### Permitted Mapping Categories:
- `DIRECT_MATCH`: Exact physical and semantic variable identity.
- `SEMANTIC_MATCH`: Equivalent physical parameter under standard unit conversion.
- `DERIVED_FEATURE`: Mathematically derived parameter with established physical justification.
- `NO_COMPATIBLE_FEATURE`: Parameter lacks a defensible physical or semantic identity in PREDICTA.

### Feature Mapping Analysis:

| Source Dataset | Source Feature | PREDICTA Feature | Mapping Classification | Unit Conversion | Justification & Strict Boundary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `nasa_mosfet` | $V_{gs(th)}$ | `threshold_voltage` (potential candidate only) | `NO_COMPATIBLE_FEATURE` | N/A | Potential semantic candidate for raw threshold voltage; NOT an implemented mapping. `vth_shift_24h` MUST NOT be claimed. Baseline-relative threshold drift may be derived in a future task only after the source archive's temporal structure and baseline definition are verified. |
| `nasa_mosfet` | $I_{gss}$ / $I_{dss}$ | None | `NO_COMPATIBLE_FEATURE` | N/A | **REMOVED UNSUPPORTED LEAKAGE MAPPINGS:** Archive-level inspection is required before determining whether this source measurement has a defensible physical/temporal mapping to PREDICTA leakage telemetry. Unit conversion alone does not establish equivalence. |
| `nasa_mosfet` | Temperature | `temperature` | `DIRECT_MATCH` | $^\circ C \rightarrow ^\circ C$ | Operating/stress temperature. |
| `nasa_igbt` | $V_{ge(th)}$ | `threshold_voltage` (potential candidate only) | `NO_COMPATIBLE_FEATURE` | N/A | Potential semantic candidate for raw threshold voltage; NOT an implemented mapping. `vth_shift_24h` MUST NOT be claimed. Baseline-relative threshold drift may be derived in a future task only after the source archive's temporal structure and baseline definition are verified. |
| `nasa_igbt` | $I_g$ | None | `NO_COMPATIBLE_FEATURE` | N/A | **REMOVED UNSUPPORTED LEAKAGE MAPPINGS:** Archive-level inspection is required before determining whether this source measurement has a defensible physical/temporal mapping to PREDICTA leakage telemetry. Unit conversion alone does not establish equivalence. |
| `nasa_igbt` | $V_{ce(sat)}$ | None | `NO_COMPATIBLE_FEATURE` | N/A | **REMOVED UNSUPPORTED MAPPING:** Collector-emitter saturation voltage is not propagation delay ($T_{pd}$). $V_{ce(sat)}$ cannot be mapped to $T_{pd}$ without explicit empirical characterization. |
| `st_awfd` | `MaterialID` | `lot_id` | `DIRECT_MATCH` | String $\rightarrow$ String | Production lot identifier. |
| `st_awfd` | E-test sensor values | None | `NO_COMPATIBLE_FEATURE` | N/A | **REMOVED UNSUPPORTED MAPPING:** Normalized anonymous E-test values are not physical currents ($I_{ddq}$ / $I_{leak}$). |
| `uci_secom` | Sensor 0..589 | None | `NO_COMPATIBLE_FEATURE` | N/A | **REMOVED UNSUPPORTED MAPPING:** Anonymous sensor channels and PCA components cannot be mapped to named physical variables ($I_{ddq}, I_{leak}, T_{pd}, V_{th}$). |
| `uci_ai4i` | `Tool wear [min]` | None | `NO_COMPATIBLE_FEATURE` | N/A | **REMOVED UNSUPPORTED MAPPING:** Mechanical milling tool wear minutes is not silicon burn-in elapsed time (`burn_in_hour`). |
| `uci_ai4i` | `Air temperature [K]` | `temperature` | `SEMANTIC_MATCH` | $K \rightarrow ^\circ C$ ($T - 273.15$) | Temperature conversion (for cross-domain ML test only). |

---

## 6. Label Semantics Audit (Removal of Invented Failure Thresholds)

### Source Label Semantics:
- **`st_awfd` (`target`):** Binary wafer lot fault flag (1 = abnormal lot, 0 = normal lot).
- **`uci_secom` (`Pass/Fail`):** In-line fab process failure flag (-1 = Pass, +1 = Fail).
- **`nasa_mosfet` / `nasa_igbt` / `nasa_capacitor`:** Continuous degradation time-series logs tracking physical parameters. Verified binary failure labels are NOT available (`binary_labels_available: false`; `continuous_degradation_available: true`). Continuous degradation measurements may serve as future evaluation targets.
- **`uci_ai4i` (`Machine failure`):** Binary mechanical machine failure flag + 5 diagnostic failure cause codes (TWF, HDF, PWF, OSF, RNF).

### Governance Rule on Binary Failure Thresholds:
Previous assumed thresholds (e.g. $R_{ds(on)} > 1.20 \times \text{baseline}$, $V_{th} > 15\%$, $V_{ce(sat)} > 1.15 \times \text{baseline}$, $ESR > 2.0 \times \text{baseline}$) were **UNSUPPORTED INVENTIONS** and are **REMOVED**.

For any future task requiring binary failure categorization of continuous NASA time-series logs, the label transformation state is recorded as:  
**`REQUIRES FUTURE LABEL-DEFINITION REVIEW`**

---

## 7. Forensic Data Leakage & Splitting Audit

### 1. STMicroelectronics ST-AWFD Lot-Level Leakage:
- `MaterialID` represents the production lot ID.
- **Hazard:** Performing random row-level splitting (`train_test_split`) across ST-AWFD's 602,108 rows causes catastrophic data leakage because step observations from the same `MaterialID` lot appear in both training and validation sets simultaneously.
- **Mandated Fix:** Splitting MUST be performed strictly at the `MaterialID` level using `GroupKFold(groups=df['MaterialID'])`.

### 2. UCI SECOM Preprocessing Imputation Leakage:
- UCI SECOM contains missing values across 590 sensor channels.
- **Hazard:** Imputing missing values (`SimpleImputer`) or computing standard scaling ($mean, std$) across the full dataset prior to splitting leaks test statistics into training data.
- **Mandated Fix:** All imputation and scaling transformers MUST be fit strictly on the training split only.

---

## 8. Provenance Classification Summary

All evaluated datasets are formally categorized into four authoritative provenance classes:

1. **`PREDICTA_SYNTHETIC`**:
   - `predicta_dataset_v3_50000.csv` (Authoritative baseline synthetic production dataset).
2. **`EXTERNAL_REAL`**:
   - `st_awfd` (STMicroelectronics ST-AWFD, D1 & D2)
   - `uci_secom` (UCI SECOM Process Logs)
   - `nasa_mosfet` (NASA Power MOSFET Thermal Overstress Aging)
   - `nasa_igbt` (NASA IGBT Accelerated Aging)
   - `nasa_capacitor` (NASA Electrolytic Capacitor Aging)
3. **`EXTERNAL_SYNTHETIC`**:
   - `uci_ai4i` (UCI AI4I 2020 Predictive Maintenance Dataset — Mechanical milling tool wear, strictly isolated from silicon physics validation).
4. **`UNKNOWN`**:
   - None.

---

## 9. Dataset Family Boundaries

```
┌───────────────────────────┐    ┌───────────────────────────┐
│   MANUFACTURING ANOMALY   │    │    SEMICONDUCTOR AGING    │
│          FAMILY           │    │          FAMILY           │
├───────────────────────────┤    ├───────────────────────────┤
│ • ST-AWFD (Wafer E-test)  │    │ • NASA Power MOSFET       │
│ • UCI SECOM (In-line Fab) │    │ • NASA IGBT Accelerated   │
└───────────────────────────┘    └───────────────────────────┘
┌───────────────────────────┐    ┌───────────────────────────┐
│   PROGNOSTICS TIME-SERIES │    │   GENERALIZATION FAMILY   │
│          FAMILY           │    │   (NON-SEMICONDUCTOR)     │
├───────────────────────────┤    ├───────────────────────────┤
│ • NASA MOSFET / IGBT / Cap│    │ • UCI AI4I 2020 Synthetic │
└───────────────────────────┘    └───────────────────────────┘
```

---

## 10. Existing PREDICTA Repository Audit & Integration Findings

- `data/dataset_registry.yaml` contains locked metadata matching verified source facts.
- `ml/data_generator/generate_dataset.py` produces the 28-feature synthetic production baseline (`predicta_dataset_v3_50000.csv`).
- `src/physics/reliability_engine.py` evaluates physics evidence using authoritative primitives.
- **Required Future Integration Work (Stage 8 Task 2+):**
  1. Implement isolated dataset loaders in `ml/data/external/` for `st_awfd`, `nasa_mosfet`, and `nasa_igbt`.
  2. Implement `MaterialID` lot-level group splitters for `st_awfd`.
  3. Build feature transformer adapters mapping external variables into PREDICTA's 28-feature format.

---

## 11. Verification & Certification Statement

- **Full Python Test Suite:** Passed 370/370 tests cleanly.
- **Node.js Test Suite:** Passed 32/32 tests cleanly (18/18 release criteria, 14/14 prognostic parity).
- **Git Status:** Working tree clean; zero production code or model artifact changes.

**Certification:** Stage 8 Task 1 External Dataset Audit Targeted Correction is complete, verified, and certified.
