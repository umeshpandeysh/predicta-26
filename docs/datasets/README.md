# PREDICTA-26 — External Dataset Layer Navigation

Welcome to the PREDICTA-26 External Dataset Layer documentation and repository section. This directory contains the authoritative machine-readable registries, raw file manifests, inventory evaluations, and storage guidelines for all external validation datasets integrated into PREDICTA-26.

---

## Quick Navigation Links

- **Authoritative Machine-Readable Registry:** [`data/dataset_registry.yaml`](file:///C:/Users/UMESH%20PANDEY/Downloads/ceenew/data/dataset_registry.yaml)
- **Raw File & Checksum Manifest:** [`data/external/manifests/stage8_dataset_manifest.yaml`](file:///C:/Users/UMESH%20PANDEY/Downloads/ceenew/data/external/manifests/stage8_dataset_manifest.yaml)
- **Detailed SIH-Ready Dataset Inventory:** [`docs/datasets/stage8_acquired_dataset_inventory.md`](file:///C:/Users/UMESH%20PANDEY/Downloads/ceenew/docs/datasets/stage8_acquired_dataset_inventory.md)
- **Stage 8 Dataset Provenance Audit:** [`docs/datasets/stage8_external_dataset_audit.md`](file:///C:/Users/UMESH%20PANDEY/Downloads/ceenew/docs/datasets/stage8_external_dataset_audit.md)

---

## Dataset Categories & Overview

PREDICTA-26 organizes external datasets across four distinct dataset families to prevent semantic mixing and maintain strict domain boundaries:

1. **Manufacturing Anomaly Datasets:**
   - [STMicroelectronics ST-AWFD D1](file:///C:/Users/UMESH%20PANDEY/Downloads/ceenew/data/external/extracted/st_awfd/D1/D1.csv) (Wafer fab E-test logs, 602,108 rows)
   - [STMicroelectronics ST-AWFD D2](file:///C:/Users/UMESH%20PANDEY/Downloads/ceenew/data/external/extracted/st_awfd/D2/D2.csv) (Wafer fab E-test logs, 126,794 rows)
   - [UCI SECOM Process Logs](file:///C:/Users/UMESH%20PANDEY/Downloads/ceenew/data/external/extracted/uci_secom/) (In-line semiconductor fab sensor logs, 1,567 rows, 590 features)

2. **Semiconductor Aging & Prognostics Datasets:**
   - [NASA PCoE IGBT Accelerated Aging (Dataset #8)](file:///C:/Users/UMESH%20PANDEY/Downloads/ceenew/data/external/extracted/nasa_igbt/) (6 IGBT devices, SMU degradation waveforms)
   - NASA PCoE MOSFET Thermal Overstress Aging (Dataset #13) (34 MOSFET devices, registered via S3 remote endpoint)
   - UPC Si IGBT Accelerated Power-Cycling Aging Dataset (2026) (3 Si IGBT devices, registered via CORA Dataverse DOI: `10.34810/DATA3204`)

3. **Cross-Domain Component Aging Datasets:**
   - NASA PCoE Electrolytic Capacitor Electrical Stress Aging (Dataset #12) (6 capacitors, registered via S3 remote endpoint)

4. **External Synthetic Generalization Datasets:**
   - [UCI AI4I 2020 Predictive Maintenance Dataset](file:///C:/Users/UMESH%20PANDEY/Downloads/ceenew/data/external/extracted/uci_ai4i/ai4i2020.csv) (10,000 synthetic mechanical CNC tool records)

---

## Quick Summary Table

| Dataset ID | Name | Family | Provenance Class | Download Status | Feature Compatibility | License Status |
|---|---|---|---|---|---|---|
| `st_awfd_d1` | STMicroelectronics ST-AWFD D1 | manufacturing_anomaly | EXTERNAL_REAL | `IMPORTED_AND_VERIFIED` | `NO_COMPATIBLE_FEATURE` | `LICENSE_CONFIRMED` (`CC BY-NC-SA 4.0`) |
| `st_awfd_d2` | STMicroelectronics ST-AWFD D2 | manufacturing_anomaly | EXTERNAL_REAL | `IMPORTED_AND_VERIFIED` | `NO_COMPATIBLE_FEATURE` | `LICENSE_CONFIRMED` (`CC BY-NC-SA 4.0`) |
| `uci_secom` | UCI SECOM Process Logs | manufacturing_anomaly | EXTERNAL_REAL | `IMPORTED_AND_VERIFIED` | `NO_COMPATIBLE_FEATURE` | `LICENSE_UNSPECIFIED` |
| `uci_ai4i_2020` | UCI AI4I 2020 Predictive Maintenance | generalization | EXTERNAL_SYNTHETIC | `IMPORTED_AND_VERIFIED` | `NO_COMPATIBLE_FEATURE` | `LICENSE_CONFIRMED` (`CC BY 4.0`) |
| `nasa_igbt_aging` | NASA PCoE IGBT Accelerated Aging #8 | semiconductor_aging | EXTERNAL_REAL | `IMPORTED_AND_VERIFIED` | `SEMANTIC_MATCH` | `LICENSE_REQUIRES_REVIEW` (U.S. Gov) |
| `nasa_mosfet_aging` | NASA PCoE MOSFET Thermal Aging #13 | semiconductor_aging | REMOTE_EXTERNAL_DATASET | `REMOTE_EXTERNAL_DATASET` (7.85 GB) | `SEMANTIC_MATCH` | `LICENSE_UNSPECIFIED` |
| `nasa_capacitor_aging` | NASA PCoE Capacitor Electrical Stress #12 | component_aging | REMOTE_EXTERNAL_DATASET | `REMOTE_EXTERNAL_DATASET` (5.04 GB) | `NO_COMPATIBLE_FEATURE` | `LICENSE_UNSPECIFIED` |
| `upc_si_igbt_2026` | UPC Si IGBT Power-Cycling Aging (2026) | semiconductor_aging | EXTERNAL_REAL | `REMOTE_EXTERNAL_DATASET` (Dataverse DOI) | `SEMANTIC_MATCH` | `LICENSE_CONFIRMED` (`CC BY 4.0`) |

---

## Governance Policies

### 1. Provenance Policy
External datasets are categorized into `EXTERNAL_REAL`, `EXTERNAL_SYNTHETIC`, or `REMOTE_EXTERNAL_DATASET`. External datasets are NEVER tagged as `PREDICTA_SYNTHETIC`.

### 2. Licensing Policy
Licenses are recorded strictly from source metadata without invention (`LICENSE_CONFIRMED`, `LICENSE_UNSPECIFIED`, or `LICENSE_REQUIRES_REVIEW`). Commercial redistribution restrictions (e.g., ST-AWFD NonCommercial clause) must be strictly honored.

### 3. Leakage & Splitting Policy
- **ST-AWFD:** Group-based splitting by `MaterialID` (production lot) is mandatory to prevent lot-level data leakage.
- **NASA & UPC Aging:** Splitting must be performed strictly by `Device ID` / `DUT`, preserving temporal measurement ordering.
- **SECOM:** Imputation and scaling transformers must be fit exclusively on training splits.

### 4. Acquisition & Storage Policy
- Raw immutable archives are stored in `data/external/raw/`.
- Extracted datasets are stored in `data/external/extracted/`.
- Large archives (>50 MB) are tracked via Git LFS (`.gitattributes`).
- Multi-gigabyte datasets exceeding GitHub repository limits are registered via verified remote S3/DOI endpoints.

---

## Instructions for Registering a Future External Dataset

1. **Verify Source Provenance:** Confirm official landing page, DOI, or repository URL.
2. **Download & Checksum:** Save raw file to `data/external/raw/<dataset_id>/` and calculate exact SHA-256.
3. **Register Entry:** Append dataset metadata to [`data/dataset_registry.yaml`](file:///C:/Users/UMESH%20PANDEY/Downloads/ceenew/data/dataset_registry.yaml).
4. **Update Manifest & Inventory:** Add file entry to [`data/external/manifests/stage8_dataset_manifest.yaml`](file:///C:/Users/UMESH%20PANDEY/Downloads/ceenew/data/external/manifests/stage8_dataset_manifest.yaml) and document evaluation in [`docs/datasets/stage8_acquired_dataset_inventory.md`](file:///C:/Users/UMESH%20PANDEY/Downloads/ceenew/docs/datasets/stage8_acquired_dataset_inventory.md).
5. **Configure LFS if Needed:** If raw/extracted file exceeds 50 MB, add tracking rule to `.gitattributes`.
