# Defect Generator Specification

To train predictive screening models, AIPS generates three signature semiconductor defects.

## Defect Classes

1.  **Gate Oxide Shorts:** Continuous wear-out, leading to exponential increases in leakage and quiescent currents.
2.  **Timing Offsets:** Abnormal threshold shifts causing propagation delays to exceed limits ($t_{pd} > 135.1\text{ ns}$ at 168h).
3.  **Step Breakdowns:** Represents catastrophic dielectric filament formation (pinholes), triggering sudden step increases ($+15.0\,\mu\text{A}$) in supply currents.

## Defect Onset Timing
*   Defects are simulated to trigger at random stress hours ($t_{\text{onset}} \in [24, 96]$) to test the predictive capability of Module B's GPR forecasting engine.
