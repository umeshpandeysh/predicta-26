# Temperature Influence & Arrhenius Model

AIPS incorporates high-temperature stress acceleration using the classical Arrhenius equation.

## Mathematical Model
$$\text{Rate}(T) = A_0 \cdot \exp\left(-\frac{E_a}{k_B T}\right)$$
*   Where:
    *   $E_a$: Activation energy in electron-volts ($\text{eV}$).
    *   $k_B$: Boltzmann constant ($8.6173 \times 10^{-5}\text{ eV/K}$).
    *   $T$: Absolute temperature in Kelvin ($\text{K}$).
*   **Calibrated Activation Energies:**
    *   *BTI Trapping:* $E_{a, \text{bti}} = 0.12\text{ eV}$ (Singh & Kalra, 2022).
    *   *TDDB Dielectric Leakage:* $E_{a, \text{leak}} = 0.55\text{ eV}$ (Diaz et al., 2021).
*   **Relevance:** Standardizes aging pre-factors across different oven stress configurations ($125^\circ\text{C}$ vs. $150^\circ\text{C}$).
