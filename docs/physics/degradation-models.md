# Semiconductor Degradation Physics

Our synthetic generator is built on physical wear-out models rather than randomized distributions:

```text
Stresses (Voltage, Temp) â”€â”€â–º Interface Trapping (BTI) â”€â”€â–º Vth Shift â”€â”€â–º Timing (tpd) / Leakage (Iddq)
```

## Degradation Kinetics
*   Trapping rate is driven by Bias Temperature Instability (BTI).
*   Thermal acceleration is calculated using Boltzmann activation pre-factors.
*   Degradation over time follows a sub-linear power-law representing reaction-diffusion boundaries.
