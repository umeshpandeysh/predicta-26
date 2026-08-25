# Reliability Physics Research Report
## Mathematical Modeling of Semiconductor Degradation under Accelerated Stress

---

## 1. Bias Temperature Instability (BTI) Kinetics

Bias Temperature Instability is the dominant degradation mechanism in deep-submicron CMOS gates under High Temperature Operating Life (HTOL) testing.

*   **Physical Process:** PMOS transistors operating at elevated temperatures under negative gate bias stress experience dissociation of Silicon-Hydrogen (Si-H) bonds at the $\text{Si-SiO}_2$ interface. The released hydrogen drifts into the oxide, leaving behind interface states (dangling silicon bonds) and bulk oxide traps that trap positive charge.
*   **Time Exponent Exponent ($n$):** Under the standard **Reaction-Diffusion (R-D) Model**, BTI degradation kinetics follow a sub-linear power-law:
    $$\Delta V_{th}(t) = A \cdot t^n$$
    *   For diffusion of neutral hydrogen molecules ($H_2$): $n \approx 0.16 - 0.20$.
    *   For diffusion of atomic hydrogen ($H$): $n \approx 0.25 - 0.30$.
*   **Mathematical Calibration:** We set $n = 0.20$ as the physical prior exponent for Module B GPR prior kernels.

---

## 2. Time-Dependent Dielectric Breakdown (TDDB) Phases

TDDB models the wear-out of the gate oxide layer under continuous electric fields.

1.  **Defect Generation Phase:** High-energy electrons tunneling through the oxide release energy, generating neutral traps (oxygen vacancies) in the dielectric layer. Leakage current is dominated by Fowler-Nordheim or Trap-Assisted Tunneling (TAT).
2.  **Percolation Path Formation:** When the local trap density reaches a critical value, a chain of traps forms a conductive bridge connecting the substrate to the gate.
3.  **Breakdown Phase:**
    *   *Soft Breakdown (SBD):* Localized current density is small, causing a sub-linear or moderate step drift in leakage current.
    *   *Hard Breakdown (HBD):* High current density thermalizes the filament, melting the silicon path and creating a permanent low-resistance short.
*   **AIPS Strategy:** Module A detects early TAT-induced quiescent current increases, and Module B rejects parts before the percolation path forms hard short circuits.

---

## 3. High-Temperature Acceleration (Arrhenius Relation)

Degradation rate is accelerated by temperature according to the Arrhenius relation:
$$k = A_0 \cdot \exp\left(-\frac{E_a}{k_B T}\right)$$
*   **Activation Energy ($E_a$):**
    *   *NBTI:* $E_a \approx 0.12 - 0.20\text{ eV}$.
    *   *HCI:* $E_a \approx -0.05\text{ eV}$ (exhibits negative activation because carrier scattering decreases at lower temperatures, increasing carrier energy).
    *   *TDDB:* $E_a \approx 0.5 - 0.9\text{ eV}$.
*   **Acceleration Factor (AF):** Standard spacecraft screening at $125^\circ\text{C}$ relative to room temperature operational limits ($25^\circ\text{C}$) yields an acceleration factor of:
    $$AF \approx 50 - 100\times$$
    This mathematically justifies why 168 hours of physical stress accelerates the equivalent of years of operational life.
