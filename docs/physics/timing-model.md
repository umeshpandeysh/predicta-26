# Propagation Delay Model

Propagation delay ($t_{pd}$) is determined by transconductance and carrier mobility under stress.

## Physical Kinetics
1.  **Carrier Mobility Temperature Scaling:**
    $$\mu(T) = \mu_0 \cdot \left(\frac{T}{298.15}\right)^{-1.5}$$
    Elevated oven temperatures reduce carrier mobility, slowing delay.
2.  **Charge Trap Delay Shift:**
    $$t_{pd}(t) = t_{pd, 0} \cdot \left(\frac{\mu_0}{\mu(T)}\right) + \beta \cdot \Delta V_{th}(t) + \epsilon_{\text{noise}}$$
    *   Calibration: $\beta = 8.5\text{ ns/V}$ maps threshold shifts directly to delay slow-down.
