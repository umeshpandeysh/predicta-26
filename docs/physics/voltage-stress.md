# Electrical Voltage Stress Model

Voltage overstress accelerates trap generation in the gate oxide layer, increasing tunnel currents.

## Mathematical Formulation
$$\Delta V_{th}(V_{\text{stress}}) \propto \left(\frac{V_{\text{stress}}}{V_{\text{nominal}}}\right)^\gamma$$
*   Where:
    *   $V_{\text{stress}}$: Applied static gate voltage during burn-in (typically $1.2\times$ to $1.5\times$ nominal).
    *   $\gamma$: Voltage acceleration exponent (calibrated at $\gamma = 1.3$).
*   **Physical Relevance:** Simulates voltage bias overstress acceleration under High Temperature Gate Bias (HTGB) screening runs.
