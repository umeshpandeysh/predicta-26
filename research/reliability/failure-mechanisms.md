# Semiconductor Failure Mechanisms Map
## Physical Degradation Kinetics under Environmental Stress Screening

This document maps the relationship between electrical/thermal stress conditions, physical wear-out mechanisms, and their parametric drift signatures in semiconductor devices.

```text
Environmental / Electrical Stress (125°C, 1.5x Vdd)
 │
 ├─► High Temperature & Bias Overstress ──────────────────┐
 │   │                                                    │
 │   ▼ (Bias Temperature Instability - BTI)                ▼ (Time-Dependent Dielectric Breakdown - TDDB)
 │   Interface trap charge accumulation ($t^{0.2}$)        Oxide thinning & trap-assisted tunneling path
 │   │                                                    │
 │   ▼                                                    ▼
 │   Threshold Voltage Shift ($|V_{th}|$ increases)        Gate Leakage Current ($I_{leak}$ / $I_{ddq}$ drifts up)
 │   │                                                    │
 │   ▼                                                    └──────────────────────┬──────────────────────┐
 │   Drive Saturation Current ($I_{sat}$ decays)                                 ▼                      ▼
 │   │                                                                      [Monitor State]        [Reject State]
 │   ▼                                                                      Slow sub-linear        Sudden dielectric
 │   Propagation Delay ($t_{pd}$ increases / slows down)                     creep                  step-breakdown
 │
 └─► High Switching Frequency (HCI)
     Carrier injection at drain junction, interface damage near gate
     Slow threshold shift and transconductance degradation
```

---

## 1. Bias Temperature Instability (BTI)
*   **Mechanism:** Charge trapping in the gate dielectric (mostly NBTI in PMOS, PBTI in NMOS) under high temperature and gate bias. Dangling bonds at the silicon-dielectric interface form traps that raise the energy barrier for inversion.
*   **Drift Signature:** Threshold voltage ($V_{th}$) shifts upward following a sub-linear power-law over time:
    $$\Delta V_{th}(t) \propto t^n \quad (n \approx 0.16 - 0.25)$$
*   **Timing Correlation:** An increase in $V_{th}$ reduces gate overdrive ($V_{gs} - V_{th}$), slowing down transistor switching and causing cell propagation delay ($t_{pd}$) to **increase (slow down) non-linearly over time**.
*   **Literature Reference:** *Singh, K. & Kalra, S. (2022)*, IEEE TDMR.

---

## 2. Time-Dependent Dielectric Breakdown (TDDB)
*   **Mechanism:** Severe localized electric field stress across the gate oxide creates defects. Over time, these defects align, creating a conductive micro-channel through the gate dielectric (localized oxide short).
*   **Drift Signature:**
    *   *Early Stage:* Slow sub-linear increase in gate leakage current ($I_{leak}$) and standby current ($I_{ddq}$) due to trap-assisted tunneling.
    *   *Failure Stage:* A sudden, catastrophic step-like jump in leakage current (hard breakdown) or continuous thermal runaway (soft breakdown).
*   **Literature Reference:** *Diaz, J. et al. (2021)*, AIP Advances.

---

## 3. Hot Carrier Injection (HCI)
*   **Mechanism:** High-energy carriers switching at the channel drain side collide with the lattice, creating interface traps and trapping charges near the drain spacer.
*   **Drift Signature:** Degradation in transistor saturation current ($I_{dsat}$) and transconductance ($g_m$). Manifests as a slow shift in propagation delay ($t_{pd}$) that is proportional to switching frequency and active clock transitions.
*   **Literature Reference:** *Sakamoto, T. et al. (2017)*, IEEE TSM.

---

## 4. Infant Mortality & Latent Defects
*   **Mechanism:** Manufacturing imperfections (wafer voids, gate oxide pinholes, mask misalignments) that do not cause immediate failure at $0\text{h}$ but accelerate wear-out kinetics.
*   **AIPS Strategy:** Latent defects exhibit significantly higher activation energy and pre-exponential coefficients. Our system flags these parts at the 24h prediction step because their projected 168h trajectory will cross the safety slope bounds.
*   **Literature Reference:** *AEC-Q001 Guidelines for Part Average Testing*.
