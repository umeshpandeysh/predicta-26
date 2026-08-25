# Component Research Report
## Analysis of Semiconductor Component Families and Space-Grade Hardware

---

## 1. Studied Component Families

To ensure that the AIPS tool is generalized and not overfit to a single component type, we investigated five major families of microelectronics:

### A. Digital Logic ICs
*   **Target Device:** Texas Instruments SN74LVC1G04 (Single Inverter Gate).
*   **Key Parameters:** Standby supply current ($I_{cc}$), propagation delay ($t_{pd}$), and input leakage ($I_i$).
*   **Relevance:** Digital logic gates represent the baseline cells for clock trees and data buses. They provide clear, repeatable propagation delays that drift under Bias Temperature Instability (BTI).

### B. Microcontrollers / Digital SoCs
*   **Target Device:** STMicroelectronics STM32F401 (32-bit ARM Cortex-M4).
*   **Key Parameters:** Run supply current ($I_{run}$), standby/sleep current ($I_{standby}$), and general-purpose I/O leakage current ($I_{lkg}$).
*   **Relevance:** MCUs have complex current states (active, sleep, standby). The standby leakage current is a highly sensitive metric for assessing gate oxide integrity in high-density CMOS processes.

### C. Analog / Mixed-Signal ICs
*   **Target Device:** Texas Instruments OPA333 (Zero-drift, low-power operational amplifier).
*   **Key Parameters:** Input bias current ($I_{ib}$), quiescent current ($I_q$), and offset voltage ($V_{os}$).
*   **Relevance:** Analog components are highly sensitive to parametric drift. An increase in input bias current ($I_{ib}$) indicates gate oxide wear-out in CMOS input stages.

### D. Power Semiconductors
*   **Target Device:** Infineon IRF540N (N-channel power MOSFET).
*   **Key Parameters:** Zero-gate-voltage drain leakage current ($I_{dss}$), gate-to-source leakage current ($I_{gss}$), and gate threshold voltage ($V_{gs(th)}$).
*   **Relevance:** Power discretes undergo significant thermal stress during high-temperature reverse bias (HTRB) testing. Gate leakage is a direct indicator of TDDB traps.

### E. Space-Grade / High-Reliability Components
*   **Target Device:** CAES UT54ACS04 (Rad-Hard CMOS Hex Inverter).
*   **Key Parameters:** Quiescent supply current ($I_{ddq}$), three-state output leakage ($I_{oz}$), and propagation delay ($t_{pd}$).
*   **Relevance:** Flight-qualified ceramic components. They follow MIL-PRF-38535 Class V screening guidelines, matching ISRO Space Applications Centre qualification plans.

---

## 2. Common Parametric Ranges

Through datasheet extraction, we established baseline operating limits to calibrate our synthetic data simulator:

1.  **Quiescent Current ($I_{ddq}$ / $I_{cc}$):** Space-grade digital parts specify max limits at $10\,\mu\text{A}$ to $40\,\mu\text{A}$ at $125^\circ\text{C}$. Healthy values are typically under $1\,\mu\text{A}$ at room temperature but drift up under stress.
2.  **Gate Leakage ($I_{gss}$ / $I_g$):** Discrete gate leakages are typically under $100\text{ nA}$ at maximum temperature. Outliers that exceed lot averages (even if well under $100\text{ nA}$) indicate localized gate oxide traps.
3.  **Propagation Delay ($t_{pd}$):** Logics exhibit delays of $2.0\text{ ns}$ to $10\text{ ns}$. High-temperature testing causes a sub-linear delay increase (approx. $+5\%$ to $+15\%$) due to threshold voltage shift.
