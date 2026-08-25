# Datasheet Parametric Extraction Study
## Analysis of Real Electrical Specifications and Test Environments

This document details the exact conditions, definitions, and limits extracted from manufacturer datasheets for three high-relevance representative devices.

---

## 1. Digital Logic: SN74LVC1G04 (Texas Instruments)

*   **Document Reference:** TI Datasheet SCES375T (Revised August 2023).
*   **Propagation Delay ($t_{pd}$):**
    *   *Specification Limit:* $4.5\text{ ns}$ maximum at $V_{cc} = 1.8\text{V}$, temperature $= 125^\circ\text{C}$ (Page 7).
    *   *Condition:* Load capacitance $C_L = 30\text{ pF}$, Input rise/fall times $\le 10\text{ ns}$.
    *   *Significance:* Evaluates cell timing degradation. Normal devices shift up slowly, whereas components with manufacturing traps slow down prematurely.
*   **Quiescent Supply Current ($I_{cc}$):**
    *   *Specification Limit:* $10\,\mu\text{A}$ maximum at $125^\circ\text{C}$; typical is $0.1\,\mu\text{A}$ at $25^\circ\text{C}$ (Page 6).
    *   *Condition:* $V_i = V_{cc}$ or GND, $I_o = 0$.
    *   *Significance:* Directly equivalent to quiescent standby current ($I_{ddq}$). Atypical increases indicate dielectric degradation.

---

## 2. Power Discrete: IRF540N (Infineon)

*   **Document Reference:** Infineon Datasheet PD-91340S (Revised May 2001).
*   **Gate-to-Source Leakage Current ($I_{\text{gss}}$):**
    *   *Specification Limit:* $\pm 100\text{ nA}$ maximum at gate-source voltage $V_{gs} = \pm 20\text{V}$ and temperature $= 175^\circ\text{C}$ (Page 2).
    *   *Significance:* Gate oxide stress parameter. Increases in $I_{\text{gss}}$ under High Temperature Gate Bias (HTGB) stress capture oxide trap generation.
*   **Gate Threshold Voltage ($V_{gs(th)}$):**
    *   *Specification Limit:* $2.0\text{V}$ minimum, $4.0\text{V}$ maximum at $V_{ds} = V_{gs}$, $I_d = 250\,\mu\text{A}$ (Page 2).
    *   *Significance:* Temperature coefficient is $-1.0\text{V} / 100^\circ\text{C}$. BTI traps cause the absolute magnitude of $|V_{th}|$ to shift, degrading device transconductance.

---

## 3. Space-Grade Logic: UT54ACS04 (CAES/Cobham)

*   **Document Reference:** UT54ACS04 Rad-Hard Hex Inverter Datasheet (Revised April 2020).
*   **Standby Supply Current ($I_{ddq}$):**
    *   *Specification Limit:* $10\,\mu\text{A}$ maximum at $V_{dd} = 5.5\text{V}$ and temperature $= 125^\circ\text{C}$ (Page 4).
    *   *Condition:* Inputs at $V_{dd}$ or GND, outputs open.
    *   *Significance:* Forms the baseline statistical distribution range for our space-grade synthetic simulator lot models.
*   **Input Leakage Current ($I_{in}$):**
    *   *Specification Limit:* $\pm 1\,\mu\text{A}$ maximum at $V_{in} = V_{dd}$ or GND (Page 4).
    *   *Significance:* Evaluates terminal integrity. Input pin damage or ESD diode wear-out shifts this current.
