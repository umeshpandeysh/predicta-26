# Feature engineering and Provenance (Module B)

This document maps the parameters used in the 168h drift prediction pipeline.

## Drift Prediction Features

| Feature Identifier | Formula | Source | Unit | Available Time | Physical Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `iddq_0h` | $I_{ddq}(0\text{h})$ | Raw parameter | ÂµA | 0h | Initial standby leakage prior to stress |
| `iddq_24h` | $I_{ddq}(24\text{h})$ | Raw parameter | ÂµA | 24h | Intermediate standby leakage after early stress |
| `iddq_drift` | $I_{ddq}(24\text{h}) - I_{ddq}(0\text{h})$ | Computed delta | ÂµA | 24h | Measures initial quiescent current drift rate |
| `ileak_0h` | $I_{leak}(0\text{h})$ | Raw parameter | ÂµA | 0h | Initial terminal oxide leakage prior to stress |
| `ileak_24h` | $I_{leak}(24\text{h})$ | Raw parameter | ÂµA | 24h | Intermediate terminal leakage |
| `ileak_drift` | $I_{leak}(24\text{h}) - I_{leak}(0\text{h})$ | Computed delta | ÂµA | 24h | Measures initial gate dielectric breakdown drift |
| `tpd_0h` | $t_{pd}(0\text{h})$ | Raw parameter | ns | 0h | Initial propagation delay of Hex Inverter |
| `tpd_24h` | $t_{pd}(24\text{h})$ | Raw parameter | ns | 24h | Delay after 24h stress |
| `tpd_drift` | $t_{pd}(24\text{h}) - t_{pd}(0\text{h})$ | Computed delta | ns | 24h | Early delay drift indicating charge trapping kinetics |
