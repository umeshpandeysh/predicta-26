# PREDICTA-26 — Stage 8 Acquired Dataset Inventory & Source Audit

This document records the exact acquisition status, underlying source identity, validation, usefulness evaluation, dataset family classification, checksums, and recommended future roles for ALL external dataset sources listed across the two project-provided reference PDFs.

---

## Executive Summary & Dataset Universe Mapping

Across the two reference PDFs (`PREDICTA_Different_Datasets_Direct_Links (1).pdf` and `PREDICTA_Recommended_Datasets_Links_Formatted (1).pdf`), a total of 10 source entries/links were identified. Through identity deduplication and source verification:

- **7 Unique Underlying Datasets** were established.
- **3 Duplicate / Alternate Metadata Links** were identified and mapped to their authoritative primary datasets.
- **5 Datasets (ST-AWFD D1, ST-AWFD D2, UCI SECOM, UCI AI4I 2020, NASA IGBT)** were acquired, checksummed, extracted, and imported into the repository.
- **2 Datasets (NASA MOSFET #13: 7.85 GB, NASA Capacitor #12: 5.04 GB)** were verified via official HTTP HEAD metadata endpoints. Remote S3 links and SHA256/Content-Length descriptors are registered in `stage8_dataset_manifest.yaml` because their multi-gigabyte sizes exceed standard Git repository blob limits (100 MB per file) and GitHub Git LFS free tier server quotas.

---

## Source Inventory & Identity Table

| # | PDF Source Entry | Actual Dataset Identity | Download Status | Real / Synthetic | Dataset Family | Duplicate? | Repository Path / URL | SHA-256 Checksum | License Status | Recommended Future Role |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | STMicroelectronics ST-AWFD D1 | ST-AWFD D1 (Wafer E-Test Log 1) | DOWNLOADED & IMPORTED | EXTERNAL_REAL | manufacturing_anomaly | No | `data/external/raw/st_awfd/D1.zip` | `97b2df4206177c5bc5b89ba18758215674bd437fef8c514320b831404f7674b7` | LICENSE_CONFIRMED (CC BY-NC-SA 4.0) | TRAINING_CANDIDATE |
| 2 | STMicroelectronics ST-AWFD D2 | ST-AWFD D2 (Wafer E-Test Log 2) | DOWNLOADED & IMPORTED | EXTERNAL_REAL | manufacturing_anomaly | No | `data/external/raw/st_awfd/D2.zip` | `e93d9f69ecb5c303f7f484647406d1ac2beda5726b99bb2984801867fea36297` | LICENSE_CONFIRMED (CC BY-NC-SA 4.0) | EXTERNAL_VALIDATION |
| 3 | UCI SECOM | UCI SECOM (#179) | DOWNLOADED & IMPORTED | EXTERNAL_REAL | manufacturing_anomaly | No | `data/external/raw/uci_secom/secom.zip` | `eea568baf3c2229096d7d294cf0b096b5502bd96d92c0b80a65b84714059be8e` | LICENSE_UNSPECIFIED | EXTERNAL_VALIDATION |
| 4 | UCI AI4I 2020 Predictive Maintenance | UCI AI4I 2020 (#601) | DOWNLOADED & IMPORTED | EXTERNAL_SYNTHETIC | generalization | No | `data/external/raw/uci_ai4i/ai4i2020.zip` | `f601f14294bcf190f9d720676b7f0aea46a26cde9ab8ebc7b4f8174d9d26b252` | LICENSE_CONFIRMED (CC BY 4.0) | GENERALIZATION_TEST |
| 5 | NASA IGBT Accelerated Aging | NASA PCoE Dataset #8 | DOWNLOADED & IMPORTED | EXTERNAL_REAL | semiconductor_aging | No | `data/external/raw/nasa_igbt/8._IGBT_Accelerated_Aging.zip` | `5cd05410e0670f78fbb9b62e9784cd65638eac435c8dac6b738076395781b997` | LICENSE_REQUIRES_REVIEW (U.S. Gov) | CROSS_DOMAIN_VALIDATION |
| 6 | NASA IGBT Precursor-Parameter Prognostics | NASA PCoE Dataset #8 | ALTERNATE_SOURCE | EXTERNAL_REAL | semiconductor_aging | Yes (Duplicate of #8) | `https://data.nasa.gov/dataset/...` | `5cd05410e0670f78fbb9b62e9784cd65638eac435c8dac6b738076395781b997` | LICENSE_REQUIRES_REVIEW | DUPLICATE_ALTERNATE_SOURCE |
| 7 | NASA MOSFET Thermal Overstress Aging | NASA PCoE Dataset #13 | REGISTERED_REMOTE (7.85 GB) | EXTERNAL_REAL | semiconductor_aging | No | `https://phm-datasets.s3.amazonaws.com/NASA/13.+MOSFET+Thermal+Overstress+Aging.zip` | VERIFIED_CONTENT_LENGTH_7849865909_BYTES | LICENSE_UNSPECIFIED | CROSS_DOMAIN_VALIDATION |
| 8 | NASA Power MOSFET Prognostics | NASA PCoE Dataset #13 | ALTERNATE_SOURCE | EXTERNAL_REAL | semiconductor_aging | Yes (Duplicate of #13) | `https://data.nasa.gov/dataset/...` | VERIFIED_CONTENT_LENGTH_7849865909_BYTES | LICENSE_UNSPECIFIED | DUPLICATE_ALTERNATE_SOURCE |
| 9 | NASA MOSFET Thermal-Stress Aging | NASA PCoE Dataset #13 | ALTERNATE_SOURCE | EXTERNAL_REAL | semiconductor_aging | Yes (Duplicate of #13) | `https://data.nasa.gov/dataset/...` | VERIFIED_CONTENT_LENGTH_7849865909_BYTES | LICENSE_UNSPECIFIED | DUPLICATE_ALTERNATE_SOURCE |
| 10 | NASA Electrolytic Capacitor Aging / PHM | NASA PCoE Dataset #12 | REGISTERED_REMOTE (5.04 GB) | EXTERNAL_REAL | component_aging | No | `https://phm-datasets.s3.amazonaws.com/NASA/12.+Capacitor+Electrical+Stress.zip` | VERIFIED_CONTENT_LENGTH_5038942729_BYTES | LICENSE_UNSPECIFIED | CROSS_DOMAIN_VALIDATION |

---

## Detailed Evaluation per PDF Source

### 1. STMicroelectronics ST-AWFD D1
- **Source URL:** `https://github.com/STMicroelectronics/ST-AWFD/blob/main/Datasets/D1.zip`
- **Actual Dataset:** ST-AWFD Dataset D1 (602,108 records, 20 columns, 5,104 production lots).
- **Downloaded:** Yes (`data/external/raw/st_awfd/D1.zip`, 15,441,560 bytes, SHA256: `97b2df4206177c5bc5b89ba18758215674bd437fef8c514320b831404f7674b7`).
- **Why Valid:** Official repository source, checksum verified, readable CSV format (`D1.csv`, 127.2 MB).
- **Why Useful:** Directly aligned with PREDICTA Module A semiconductor manufacturing lot-relative anomaly detection.
- **Dataset Family:** `manufacturing_anomaly`
- **Real / Synthetic:** `EXTERNAL_REAL`
- **Duplicate Status:** Unique dataset.
- **License Status:** `LICENSE_CONFIRMED` (`CC BY-NC-SA 4.0`).
- **Future Role:** `TRAINING_CANDIDATE`

### 2. STMicroelectronics ST-AWFD D2
- **Source URL:** `https://github.com/STMicroelectronics/ST-AWFD/blob/main/Datasets/D2.zip`
- **Actual Dataset:** ST-AWFD Dataset D2 (126,794 records, 25 columns, 1,156 production lots).
- **Downloaded:** Yes (`data/external/raw/st_awfd/D2.zip`, 3,710,961 bytes, SHA256: `e93d9f69ecb5c303f7f484647406d1ac2beda5726b99bb2984801867fea36297`).
- **Why Valid:** Official repository source, checksum verified, readable CSV format (`D2.csv`, 34.1 MB).
- **Why Useful:** Aligned with PREDICTA Module A manufacturing anomaly detection and lot-level evaluation.
- **Dataset Family:** `manufacturing_anomaly`
- **Real / Synthetic:** `EXTERNAL_REAL`
- **Duplicate Status:** Unique dataset.
- **License Status:** `LICENSE_CONFIRMED` (`CC BY-NC-SA 4.0`).
- **Future Role:** `EXTERNAL_VALIDATION`

### 3. UCI SECOM
- **Source URL:** `https://archive.ics.uci.edu/dataset/179/secom`
- **Actual Dataset:** UCI SECOM Dataset #179 (1,567 wafer records, 590 anonymous sensor features, 41,951 missing values).
- **Downloaded:** Yes (`data/external/raw/uci_secom/secom.zip`, 1,964,989 bytes, SHA256: `eea568baf3c2229096d7d294cf0b096b5502bd96d92c0b80a65b84714059be8e`).
- **Why Valid:** Official UCI repository zip, valid data (`secom.data`) and label files (`secom_labels.data`).
- **Why Useful:** Provides real semiconductor fabrication yield test measurements for manufacturing anomaly validation.
- **Dataset Family:** `manufacturing_anomaly`
- **Real / Synthetic:** `EXTERNAL_REAL`
- **Duplicate Status:** Unique dataset.
- **License Status:** `LICENSE_UNSPECIFIED` (Landing page does not specify a explicit license).
- **Future Role:** `EXTERNAL_VALIDATION`

### 4. UCI AI4I 2020 Predictive Maintenance
- **Source URL:** `https://archive.ics.uci.edu/dataset/601/ai4i%2B2020%2Bpredictive%2Bmaintenance`
- **Actual Dataset:** UCI AI4I 2020 Dataset #601 (10,000 synthetic records, 14 features).
- **Downloaded:** Yes (`data/external/raw/uci_ai4i/ai4i2020.zip`, 522,170 bytes, SHA256: `f601f14294bcf190f9d720676b7f0aea46a26cde9ab8ebc7b4f8174d9d26b252`).
- **Why Valid:** Official UCI repository archive, readable CSV format (`ai4i2020.csv`).
- **Why Useful:** Provides an industrial machinery synthetic benchmark for generalization/cross-domain evaluation.
- **Dataset Family:** `generalization`
- **Real / Synthetic:** `EXTERNAL_SYNTHETIC` (Must remain strictly isolated from real semiconductor data).
- **Duplicate Status:** Unique dataset.
- **License Status:** `LICENSE_CONFIRMED` (`CC BY 4.0`).
- **Future Role:** `GENERALIZATION_TEST`

### 5. NASA IGBT Accelerated Aging
- **Source URL:** `https://phm-datasets.s3.amazonaws.com/NASA/8.+IGBT+Accelerated+Aging.zip`
- **Actual Dataset:** NASA PCoE Dataset #8 (6 IGBT devices, SMU waveform degradation data across 258 files).
- **Downloaded:** Yes (`data/external/raw/nasa_igbt/8._IGBT_Accelerated_Aging.zip`, 240,502,381 bytes, SHA256: `5cd05410e0670f78fbb9b62e9784cd65638eac435c8dac6b738076395781b997`).
- **Why Valid:** Official NASA PCoE repository S3 archive, verified zip structure (`IGBTAgingData_04022009.zip`).
- **Why Useful:** High physical relevance for power semiconductor degradation ($V_{ce(sat)}$ precursor tracking and thermal impedance).
- **Dataset Family:** `semiconductor_aging`
- **Real / Synthetic:** `EXTERNAL_REAL`
- **Duplicate Status:** Unique dataset.
- **License Status:** `LICENSE_REQUIRES_REVIEW` (U.S. Government Works).
- **Future Role:** `CROSS_DOMAIN_VALIDATION`

### 6. NASA IGBT Precursor-Parameter Prognostics (Alternate Link)
- **Source URL:** `https://data.nasa.gov/dataset/precursor-parameter-identification-for-insulated-gate-bipolar-transistor-igbt-prognostics`
- **Actual Dataset:** NASA PCoE Dataset #8.
- **Downloaded:** Alternate metadata page pointing to Dataset #8.
- **Why Valid:** Resolves to the identical underlying NASA IGBT Dataset #8.
- **Why Useful:** Recorded as duplicate provenance source.
- **Dataset Family:** `semiconductor_aging`
- **Real / Synthetic:** `EXTERNAL_REAL`
- **Duplicate Status:** Yes (Duplicate of NASA PCoE Dataset #8).
- **License Status:** `LICENSE_REQUIRES_REVIEW`.
- **Future Role:** `DUPLICATE_ALTERNATE_SOURCE`

### 7. NASA MOSFET Thermal Overstress Aging
- **Source URL:** `https://phm-datasets.s3.amazonaws.com/NASA/13.+MOSFET+Thermal+Overstress+Aging.zip`
- **Actual Dataset:** NASA PCoE Dataset #13 (34 MOSFET devices, thermal overstress aging).
- **Downloaded:** Registered via verified HTTP HEAD (Content-Length: 7,849,865,909 bytes = 7.85 GB).
- **Why Valid:** Official NASA PCoE S3 endpoint verified.
- **Why Useful:** Core reference dataset for power MOSFET thermal degradation forecasting.
- **Dataset Family:** `semiconductor_aging`
- **Real / Synthetic:** `EXTERNAL_REAL`
- **Duplicate Status:** Unique dataset.
- **License Status:** `LICENSE_UNSPECIFIED`.
- **Future Role:** `CROSS_DOMAIN_VALIDATION`

### 8. NASA Power MOSFET Prognostics & Thermal-Stress Aging (Alternate Links)
- **Source URLs:** `https://data.nasa.gov/dataset/prognostics-of-power-mosfet` and `https://data.nasa.gov/dataset/prognostics-approach-for-power-mosfet-under-thermal-stress-aging`
- **Actual Dataset:** NASA PCoE Dataset #13.
- **Downloaded:** Alternate metadata pages pointing to Dataset #13.
- **Why Valid:** Resolves to the identical underlying NASA MOSFET Dataset #13.
- **Why Useful:** Recorded as duplicate provenance sources.
- **Dataset Family:** `semiconductor_aging`
- **Real / Synthetic:** `EXTERNAL_REAL`
- **Duplicate Status:** Yes (Duplicate of NASA PCoE Dataset #13).
- **License Status:** `LICENSE_UNSPECIFIED`.
- **Future Role:** `DUPLICATE_ALTERNATE_SOURCE`

### 9. NASA Electrolytic Capacitor Electrical Stress Aging
- **Source URL:** `https://phm-datasets.s3.amazonaws.com/NASA/12.+Capacitor+Electrical+Stress.zip`
- **Actual Dataset:** NASA PCoE Dataset #12 (6 electrolytic capacitors, electrical overstress aging).
- **Downloaded:** Registered via verified HTTP HEAD (Content-Length: 5,038,942,729 bytes = 5.04 GB).
- **Why Valid:** Official NASA PCoE S3 endpoint verified.
- **Why Useful:** Provides passive component PHM degradation validation (capacitance loss & ESR increase).
- **Dataset Family:** `component_aging`
- **Real / Synthetic:** `EXTERNAL_REAL`
- **Duplicate Status:** Unique dataset.
- **License Status:** `LICENSE_UNSPECIFIED`.
- **Future Role:** `CROSS_DOMAIN_VALIDATION`

### 10. NASA Capacitor PHM / Physics-Based Failure Models (Alternate Link)
- **Source URL:** `https://data.nasa.gov/dataset/prognostics-health-management-and-physics-based-failure-models-for-electrolytic-capacitors`
- **Actual Dataset:** NASA PCoE Dataset #12.
- **Downloaded:** Alternate metadata page pointing to Dataset #12.
- **Why Valid:** Resolves to the identical underlying NASA Capacitor Dataset #12.
- **Why Useful:** Recorded as duplicate provenance source.
- **Dataset Family:** `component_aging`
- **Real / Synthetic:** `EXTERNAL_REAL`
- **Duplicate Status:** Yes (Duplicate of NASA PCoE Dataset #12).
- **License Status:** `LICENSE_UNSPECIFIED`.
- **Future Role:** `DUPLICATE_ALTERNATE_SOURCE`
