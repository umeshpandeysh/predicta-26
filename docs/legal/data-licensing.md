# Copyright & Licensing Registry

This document lists the licensing and usage boundaries for datasets and component datasheets.

## 1. Public Proxy Datasets

*   **NASA Power MOSFET Thermal Overstress Dataset:**
    *   *Source:* NASA Ames Prognostics Data Repository
    *   *Usage Permissions:* Open-source public domain data provided for research and academic prognostics evaluation.
    *   *Redistribution:* Permitted. The parsed schema is stored in `data/proxy/`.
*   **STMicroelectronics ST-AWFD (Wafer Fault Dataset):**
    *   *Source:* STMicroelectronics / Academic Sharing Channels
    *   *Usage Permissions:* Academic research license for fault detection and classifier evaluation.
    *   *Redistribution:* Metadata and parsed logs are mapped; raw binaries are omitted to adhere to licensing boundaries.
*   **UCI SECOM (Semiconductor Manufacturing Dataset):**
    *   *Source:* UCI Machine Learning Repository
    *   *License:* CC BY 4.0
    *   *Redistribution:* Permitted with citations. Mapped features are stored in `data/proxy/`.

---

## 2. Component Datasheets & Specifications

*   **SN74LVC1G04 (Texas Instruments):**
    *   *Datasheet URL:* [ti.com/lit/ds/symlink/sn74lvc1g04.pdf](https://www.ti.com/lit/ds/symlink/sn74lvc1g04.pdf)
    *   *Copyright:* Texas Instruments Incorporated.
    *   *Redistribution Policy:* PDF file is proprietary. We do not store TI PDF files in the repository. We only track parameters and reference links in `research/components/component_registry.yaml`.
*   **IRF540N (Infineon / International Rectifier):**
    *   *Datasheet URL:* [infineon.com/dgdl/irf540n.pdf](https://www.infineon.com/dgdl/Infinion-IRF540N-DS-v01_00-EN.pdf)
    *   *Copyright:* Infineon Technologies AG.
    *   *Redistribution Policy:* PDF file is proprietary. We only track parameters and reference links.
*   **UT54ACS04 (Cobham / Aeroflex):**
    *   *Datasheet URL:* [cobhamaeroflex.com/datasheets/ut54acs04.pdf](https://www.cobhamaeroflex.com/apn/UT54ACS04_Datasheet.pdf)
    *   *Copyright:* Cobham Advanced Electronic Solutions.
    *   *Redistribution Policy:* Proprietary spaceflight rad-hard specification. Mapped using links only.
