# Data Platform Conformance Report

Audit of the physical parameter distributions, unit normalization, and split disjointness.

*   **Parameter Conformance:** supply quiescent current ($I_{ddq}$), gate oxide terminal leakage ($I_{leak}$), and cell propagation delay ($t_{pd}$) are mapped correctly.
*   **Unit Normalization:** Standby and gate currents are standardized to **Microamperes (µA)**, delays to **Nanoseconds (ns)**, and temperature to **Celsius (°C)**.
*   **Leakage Disjointness Check:** We verified that training lots (`LOT-SYN-001` to `LOT-SYN-035`) and test lots (`LOT-SYN-043` to `LOT-SYN-050`) share zero components, enforcing complete lot-level cohort segregation.
