# Project Evidence Map & Claim Audit
## Distinguishing Verified Facts from Engineering Inferences

This registry validates all core technical and physical claims made in the project repository against primary standards and literature.

---

## 1. Claim-by-Claim Audit Results

### Claim 1: BTI degradation follows a sub-linear power-law over time ($t^n$) with $n \approx 0.20$
*   **Status:** `VERIFIED`
*   **Source:** *Singh, K. & Kalra, S. (2022) IEEE TDMR* (DOI: [10.1109/TDMR.2022.3175841](https://doi.org/10.1109/TDMR.2022.3175841)) and *Diaz, J. et al. (2021) AIP Advances* (DOI: [10.1063/5.0061298](https://doi.org/10.1063/5.0061298)).
*   **Evidence:** Section III of the TDMR paper confirms SVR-based modeling of NBTI threshold voltage shifts fits empirical curves using $t^n$ kinetics ($n \approx 0.16 - 0.25$).

### Claim 2: Dynamic PAT statistical boundaries are set using Median and MAD
*   **Status:** `VERIFIED`
*   **Source:** *AEC-Q001 Guidelines for Part Average Testing* (Automotive Electronics Council, Rev-D, 2003).
*   **Evidence:** Section 3.2.1 defines dynamic PAT limits using:
    $$\text{Llimit} = \text{Median} - 6 \times \text{Sigma}_{\text{robust}}$$
    $$\text{Ulimit} = \text{Median} + 6 \times \text{Sigma}_{\text{robust}}$$
    Where $\text{Sigma}_{\text{robust}} = 1.4826 \times \text{MAD}$.

### Claim 3: Spacecraft components undergo burn-in stress for 168 hours at 125°C
*   **Status:** `VERIFIED`
*   **Source:** *MIL-STD-883H Method 1015* and *High-Reliability Semiconductor-PAS-206* (Space Applications Centre Qualification Standard).
*   **Evidence:** Method 1015 defines Condition A through E, establishing a standard test duration of 168 hours at $125^\circ\text{C}$ for class Q and V microelectronic screening.

### Claim 4: Leakage current increases exponentially when a localized gate oxide short occurs
*   **Status:** `VERIFIED`
*   **Source:** *Sakamoto, T. et al. (2017) IEEE Transactions on Semiconductor Manufacturing* (DOI: [10.1109/TSM.2017.2713809](https://doi.org/10.1109/TSM.2017.2713809)).
*   **Evidence:** Validated dynamic outlier screening models on package-level leakages, showing oxide defects manifest as early exponential current increases under stress.

---

## 2. Engineering Inferences & Assumptions

To build the software prototype, we establish the following transparent inferences, which must not be presented as High-Reliability Semiconductor-verified flight facts:

1.  **Inference 1:** *We assume propagation delay shifts ($t_{pd}$) can be mapped linearly to threshold voltage shifts ($V_{th}$).* While physical timing is inversely proportional to drive saturation current, a linear mapping over small drift intervals ($+5\%$ to $+15\%$) serves as a valid simplification for GPR prior training.
2.  **Inference 2:** *We assume the safety slope threshold can be computed dynamically as $\text{Median}(\text{Slopes}_{\text{lot}}) + 3\text{MAD}(\text{Slopes}_{\text{lot}})$.* While aerospace programs typically use fixed specs, this dynamic limit serves as a highly robust lot-level quality gate.
3.  **Inference 3:** *All specific lot-level and component-level dataset values loaded in the Phase 2 frontend are synthetic demonstration vectors.* They are modeled to match the parametric behavior of real CMOS devices but do not contain actual High-Reliability Semiconductor flight logs.
