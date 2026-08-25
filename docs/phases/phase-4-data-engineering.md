# Phase 4: Data Engineering & Simulator

Describes the physics-informed synthetic burn-in generator and dataset normalization workflows.

## 1. Physics Degradation Models
*   **BTI Power-Law:** Timings drift follows a power-law relationship over stress duration:
    $$\Delta t_{pd}(t) = \beta \cdot t^n + \epsilon$$
    where $n \approx 0.20$ is the charging trap exponent, $\beta$ represents degradation rate, and $\epsilon$ is Gaussian measurement noise.
*   **TDDB Leakage Spikes:** Standby current exhibits exponential kinetics under stress:
    $$I(t) = I_0 \cdot \exp(\alpha \cdot t) + \delta_{defect}$$

## 2. lot-Aware Normalization
*   **Part Average Testing:** Standardizes parameters per lot using robust statistics to filter manufacturing offsets:
    $$Z_{\text{robust}} = \frac{x - \text{Median}}{\text{MAD} \cdot 1.4826}$$
*   **Split Disjointness:** Ensures zero leakage by splitting training, validation, and test cohorts by entire distinct lot IDs.
