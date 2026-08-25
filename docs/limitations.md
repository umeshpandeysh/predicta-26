# Scientific Limitations

> [!WARNING]
> This prototype is intended for research and demonstration. It is not a qualification or certification system for aerospace flight hardware. Validation on real production/flight-component data is required before operational deployment.

This document tracks the boundaries of our screening models to maintain technical transparency.

## Limitations Registry

*   **Dataset Constraints:** The system has been validated on a physics-informed synthetic dataset (\`ps170-synthetic-v0.1\`) and public proxy datasets (NASA, STMicroelectronics, UCI SECOM). It has not been validated on proprietary ISRO spaceflight-grade logs, as such data was not provided.
*   **Lot Cohort Sizes:** Robust statistics require at least **30 parts** per lot. For small lot cohorts, the system falls back to pooled wafer catalog medians, which are less sensitive to batch-specific variances.
*   **Extrapolation Boundaries:** GPR models are trained on standard burn-in stress profiles ($125^\circ\text{C}$, $1.5\text{V}$). Extreme temperature/voltage fluctuations lie outside the interpolation boundary, which will yield inflated prediction uncertainty bands.
*   **Failure Modes:** Dynamic screening flags statistical outliers and accelerated degradation rates. It is an engineering aid, not a replacement for qualified physical failure analysis (e.g., scanning electron microscopy or emission microscopy).
