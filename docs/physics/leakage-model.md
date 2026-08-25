# Quiescent & Leakage Current Models

Quiescent standby current ($I_{ddq}$) and terminal leakage current ($I_{leak}$) exhibit different degradation paths depending on dielectric health.

## Healthy Current Model
Healthy CMOS gates experience sub-linear current shifts as threshold voltage increases:
$$I_{ddq}(t) = I_0 \cdot \exp\left(-c \cdot \Delta V_{th}(t)\right)$$

## Defect Breakdown Trajectories
1.  **Gate Oxide Short (Continuous Trap-Assisted Tunneling):**
    $$I_{ddq}(t) = I_{\text{healthy}}(t) + 2.5 \cdot \exp\left(0.015 \cdot (t - t_{\text{onset}})\right)$$
2.  **Severe Dielectric Failure (Catastrophic Step Short):**
    $$I_{ddq}(t) = I_{\text{healthy}}(t) + 15.0 \quad (\text{for } t \ge t_{\text{onset}})$$
