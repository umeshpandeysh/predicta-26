# Technical References & Reliability Standards

This document registers the primary references, textbooks, and standards used to design, implement, and validate the AIPS system.

---

## 1. Aerospace & Military Reliability Standards

*   **AEC-Q001 (Rev-D):** *Guidelines for Part Average Testing.* Automotive Electronics Council. Defines static and dynamic PAT limits for microcircuit screening.
*   **AEC-Q002 (Rev-B):** *Guidelines for Statistical Yield Analysis.* Automotive Electronics Council. Sets limits for lot-level yield quarantines.
*   **MIL-STD-883H Method 1015:** *Microelectronics Test Method Standard: Burn-In Test.* Department of Defense, USA. Establishes the 168h test duration and accelerated temperature/bias guidelines.
*   **JESD22-A108D:** *Temperature, Bias, and Operating Life.* JEDEC Solid State Technology Association. Establishes standard conditions for High Temperature Operating Life (HTOL) testing.
*   **ISRO-PAS-206:** *Qualification Requirements for Thick Film Hybrid Microcircuits.* Space Applications Centre (SAC) Product Assurance Group, ISRO. Outlines flight-grade hybrid microcircuit screening flows.

---

## 2. Primary Research Literature

*   **Dobbelaere, W. et al. (2016):** *Analog fault coverage improvement using final-test dynamic part average testing*, IEEE International Test Conference (ITC). DOI: [10.1109/TEST.2016.7805844](https://doi.org/10.1109/TEST.2016.7805844).
*   **Singh, K. & Kalra, S. (2022):** *Analysis of Negative-Bias Temperature Instability Utilizing Machine Learning Support Vector Regression for Robust Nanometer Design*, IEEE Transactions on Device and Materials Reliability. DOI: [10.1109/TDMR.2022.3175841](https://doi.org/10.1109/TDMR.2022.3175841).
*   **Sakamoto, T. et al. (2017):** *New method of screening out outlier; expanded part average testing during package level test*, IEEE Transactions on Semiconductor Manufacturing. DOI: [10.1109/TSM.2017.2713809](https://doi.org/10.1109/TSM.2017.2713809).
*   **Diaz, J. et al. (2021):** *Physics-informed machine learning model for bias temperature instability*, AIP Advances. DOI: [10.1063/5.0061298](https://doi.org/10.1063/5.0061298).
*   **Moreno-Lizaranzu, M. J., & Cuesta, F. (2013):** *Improving electronic sensor reliability by robust outlier screening*, Sensors. DOI: [10.3390/s130506012](https://doi.org/10.3390/s130506012).

---

## 3. Public Source Repositories

*   **STMicroelectronics ST-AWFD:** *Automatic Wafer Fault Detection Dataset.* [github.com/STMicroelectronics/ST-AWFD](https://github.com/STMicroelectronics/ST-AWFD).
*   **NASA PCoE Prognostics Data:** *Power MOSFET Thermal Overstress Aging Data.* [data.nasa.gov](https://data.nasa.gov/).
*   **PyOD Library:** *Python Outlier Detection.* [github.com/yzhao062/pyod](https://github.com/yzhao062/pyod).
