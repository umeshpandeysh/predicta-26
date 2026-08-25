# Physics-of-Failure: Semiconductor Degradation Mechanisms
## Grounding AI in Device Physics under Burn-In Stress

---

## 1. Primary Degradation Drivers

During burn-in testing, microcircuits are operated at elevated temperatures (typically 125°C) and voltage biases ($1.2\times - 1.5\times$ nominal $V_{dd}$). This accelerated environment triggers and accelerates physical degradation mechanisms within the transistors:

### Bias Temperature Instability (BTI)
Bias Temperature Instability is the primary cause of threshold voltage ($V_{th}$) drift in modern CMOS technologies:
*   **Negative BTI (NBTI):** Dominates in PMOS transistors under negative gate bias at high temperatures. Si-H bonds at the $\text{Si-SiO}_2$ interface break, leaving behind dangling bonds (interface traps) and trapping positive charges in the oxide.
*   **Positive BTI (PBTI):** Occurs in NMOS transistors, particularly in high-k metal gate (HKMG) stacks, where electrons are trapped in the high-k bulk layer.
*   **Mathematical Model:** BTI-induced threshold voltage shift follows a sub-linear power-law over time:
    $$\Delta V_{th}(t) = A \cdot \exp\left(-\frac{E_a}{k_B T}\right) \cdot V_{\text{stress}}^\gamma \cdot t^n$$
    Where:
    *   $E_a \approx 0.12\text{ eV}$ is the activation energy.
    *   $n \approx 0.16 - 0.25$ is the time exponent.
    *   $t$ is the cumulative stress duration.

### Hot Carrier Injection (HCI)
*   **Mechanism:** High-energy carriers (hot electrons/holes) switching rapidly in the channel collide with the lattice, creating interface states and trapping charges near the drain side of the gate dielectric.
*   **Impact:** Shifts threshold voltage ($V_{th}$) and degrades transconductance ($g_m$).

---

## 2. Impact on Parametric Measurements

The physics of semiconductor degradation dictates the direction of parameter drift for our synthetic model and validation metrics:

### Propagation Delay ($t_{pd}$)
*   **Physics:** Cell propagation delay is inversely proportional to transistor drive saturation current:
    $$t_{pd} \propto \frac{C_L V_{dd}}{I_{\text{sat}}} \propto \frac{C_L V_{dd}}{(V_{dd} - V_{th})^\alpha}$$
    Where $\alpha \approx 1.3 - 2$ due to velocity saturation.
*   **Drift Direction:** As BTI/HCI causes $V_{th}$ to **increase**, drive current decreases, which causes **propagation delay ($t_{pd}$) to increase over time (circuits slow down)**.

### Standby Quiescent Current ($I_{ddq}$ / Leakage Current)
*   **Defect-Free Aging:** In a healthy CMOS device, subthreshold leakage current is exponentially dependent on $V_{th}$:
    $$I_{\text{sub}} \propto \exp\left(-\frac{V_{th}}{n v_T}\right)$$
    As aging causes $V_{th}$ to increase, subthreshold leakage actually *decreases* slightly.
*   **Defective Device Degradation:** In a device with latent defects (e.g., gate oxide pinholes, micro-cracks, lattice dislocations), high temperature and bias overstress accelerate local dielectric wear-out:
    1.  **Gate Oxide Shorts (GOS):** Leads to a localized breakdown path, causing gate leakage current ($I_g$) to **increase exponentially** over time.
    2.  **Trap-Assisted Tunneling:** Interface traps generate localized leakage paths, causing junction leakage to **increase**.
*   **Drift Direction:** For components with latent defects, the **total quiescent current ($I_{ddq}$) and leakage current ($I_{leak}$) drift upwards or spike over time**.

---

## 3. Arrhenius Temperature Acceleration

The rate of chemical reactions and physical degradation is accelerated by temperature according to the Arrhenius relation. The Acceleration Factor (AF) is:
$$AF = \exp\left(\frac{E_a}{k_B} \left(\frac{1}{T_{\text{use}}} - \frac{1}{T_{\text{stress}}}\right)\right)$$
This formula is embedded in our synthetic data generator to simulate realistic degradation rates under elevated burn-in temperatures ($125^\circ\text{C}$).
