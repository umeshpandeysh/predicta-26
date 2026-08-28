# SEMICONDUCTOR_TELEMETRY Parameter Mapping Strategy
## Translating Space-Grade Electrical Specs to AI Training Feeds

This document defines how the three primary parameters required by the High-Reliability Semiconductor SEMICONDUCTOR_TELEMETRY System Specification are mapped to real-world component specs, public datasets, and our synthetic degradation generator.

---

## 1. Parameter: Iddq (Quiescent Supply Current)

*   **Real-World Equivalent:** Quiescent supply current ($I_{cc}$ or $I_{dd}$) under static logic states. It represents the standby current of a chip when no switching activities occur.
*   **Datasheet Specifications:**
    *   *SN74LVC1G04:* $I_{cc} \le 10\,\mu\text{A}$ max at $125^\circ\text{C}$ (typical is $0.1\,\mu\text{A}$ at $25^\circ\text{C}$).
    *   *UT54ACS04:* $I_{ddq} \le 10\,\mu\text{A}$ max at $125^\circ\text{C}$.
*   **Public Proxy Datasets:** 
    *   *UCI SECOM:* Sensor readings mapping supply currents across 1,500 wafer lots.
*   **Synthetic Modeling Strategy:**
    *   *Healthy Device:* Log-normal initial distribution centered at $10.0\,\mu\text{A}$ with a sigma of $1.2\,\mu\text{A}$ per lot. Aging drift follows a sub-linear power law: $I_{ddq}(t) = I_{ddq, 0} + \alpha_1 t^{0.2} + \mathcal{N}(0, \sigma_{\text{noise}}^2)$.
    *   *Latent Defect:* Pre-factor $\alpha_1$ is set to $4\times$ normal, simulating early gate dielectric breakdown under voltage overstress.

---

## 2. Parameter: Ileak (Leakage Current)

*   **Real-World Equivalent:** Gate leakage current ($I_{\text{gss}}$) or drain-source leakage current ($I_{\text{dss}}$). In operational amplifiers, input bias current ($I_{ib}$) is the equivalent leakage metric.
*   **Datasheet Specifications:**
    *   *IRF540N MOSFET:* $I_{\text{gss}} \le \pm 100\text{ nA}$ gate-to-source leakage at $175^\circ\text{C}$; $I_{\text{dss}} \le 250\,\mu\text{A}$ drain-to-source leakage at $150^\circ\text{C}$.
    *   *OPA333 Op-Amp:* $I_{ib} \le 200\text{ pA}$ input bias current at $125^\circ\text{C}$.
*   **Public Proxy Datasets:**
    *   *NASA Power MOSFET Dataset:* Tracks gate leakage ($I_{gate\_leakage}$) and drain-to-source leakage ($I_{drain\_leakage}$) under accelerated temperature and electrical stress.
*   **Synthetic Modeling Strategy:**
    *   *Healthy Device:* Initial $I_{leak\_0h}$ generated using a log-normal distribution around $1.4\,\mu\text{A}$ ($\sigma = 0.1\,\mu\text{A}$). Aging follows a flat, sub-linear trend ($t^{0.15}$).
    *   *Latent Defect (Oxide Short):* Injects a step increase in leakage current representing time-dependent dielectric breakdown (TDDB) at random stress hours (e.g. at 96h).

---

## 3. Parameter: tpd (Propagation Delay)

*   **Real-World Equivalent:** Propagation delay time ($t_{pdh}$ or $t_{phl}$) representing the transition time from input to output change.
*   **Datasheet Specifications:**
    *   *SN74LVC1G04:* $t_{pd} \le 4.5\text{ ns}$ max at $1.8\text{V}$, $125^\circ\text{C}$ ($t_{pd} \le 2.2\text{ ns}$ max at $5.0\text{V}$).
    *   *UT54ACS04:* $t_{pd} \le 6.5\text{ ns}$ max at $5.0\text{V}$, $125^\circ\text{C}$.
*   **Public Proxy Datasets:**
    *   No public time-series delay dataset exists due to proprietary semiconductor clock logging. We utilize the **NASA MOSFET threshold voltage drift ($V_{th}$)** as a physical proxy, because $t_{pd}$ is mathematically derived from $V_{th}$ shifts.
*   **Synthetic Modeling Strategy:**
    *   *Physics-Informed Mapping:* We map delay degradation to the simulated $V_{th}$ shift caused by Bias Temperature Instability (BTI) traps:
        $$t_{pd}(t) = t_{pd, 0} + \beta (V_{th}(t) - V_{th, 0}) = t_{pd, 0} + \beta_2 t^{0.2} + \mathcal{N}(0, \sigma_{\text{noise}}^2)$$
    *   *Calibration:* Center the initial value at $120.0\text{ ns}$ ($\sigma = 4.0\text{ ns}$), drifting up to a maximum limit of $135.1\text{ ns}$.
