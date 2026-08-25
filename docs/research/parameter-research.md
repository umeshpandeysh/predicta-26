# Parametric Measurement & Calibration Study
## How Electrical and Stress Features Interact Under Test Conditions

This study registers the measurement conditions, ranges, and drift behaviors for the parameters processed by the AIPS decision engine.

---

## 1. Supply Current ($I_{ddq}$) & Leakage ($I_{leak}$)

### Definition & Measurement
*   **Iddq:** Quiescent supply current measured on $V_{dd}$ power rails when CMOS gates are static (not switching).
*   **Ileak:** Terminal leakage currents (such as input pin leakage $I_{in}$, gate leakage $I_{gss}$, or drain leakage $I_{dss}$).
*   **ATE Method:** Measured using high-precision Source Measure Units (SMUs) at static test cycles, using a resolution of picoamperes (pA) or nanoamperes (nA).

### Temperature & Voltage Dependence
*   Quiescent and subthreshold leakage currents are highly sensitive to temperature due to carrier thermal generation:
    $$I_{\text{leak}}(T) \propto T^2 \cdot \exp\left(-\frac{E_g - \Delta V_c}{2 k_B T}\right)$$
*   Voltage overstress increases tunneling current through thin oxides.

### Drift Tendencies
*   *Defect-Free:* Stays flat or drops slightly as threshold voltage shifts up.
*   *Defective:* Drifts upward or spikes under stress as localized dielectric wear-out creates micro-conductive paths.

---

## 2. Propagation Delay ($t_{pd}$)

### Definition & Measurement
*   The transition delay between the input signal crossing $50\%$ and the output signal crossing $50\%$ of active voltage levels.
*   **ATE Method:** Measured using high-speed pin electronics comparator units.

### Temperature & Voltage Dependence
*   Delays increase with temperature due to carrier mobility degradation:
    $$\mu(T) = \mu(T_0) \cdot \left(\frac{T}{T_0}\right)^{-m} \quad (m \approx 1.5 - 2.0)$$
    Lower mobility reduces saturation drive current, increasing delay.

### Drift Tendencies
*   Under constant stress, gate dielectric charge trapping shifts threshold voltage $V_{th}$. This shifts propagation delay upward, following a sub-linear power law:
    $$t_{pd}(t) = t_{pd, 0} + \beta \cdot t^{0.2}$$
    Typical shifts are $+5\%$ to $+15\%$ over 168 hours of burn-in stress.
