# Feature Engineering Guide

To prevent temporal data leakage and keep models interpretable, we use a compact set of absolute, relative, and temporal features at the **24h screening point**.

## Features Table

| Feature Identifier | Formula | time dependency | Intended Purpose |
| :--- | :--- | :--- | :--- |
| `iddq_24h` | $I_{ddq}(24\text{h})$ | 24h snapshot | Captures absolute standby current offsets |
| `ileak_24h` | $I_{leak}(24\text{h})$ | 24h snapshot | Captures absolute terminal leakage levels |
| `tpd_24h` | $t_{pd}(24\text{h})$ | 24h snapshot | Captures absolute cell timing offsets |
| `iddq_drift` | $I_{ddq}(24\text{h}) - I_{ddq}(0\text{h})$ | 0h to 24h | Identifies early quiescent current climbs |
| `ileak_drift`| $I_{leak}(24\text{h}) - I_{leak}(0\text{h})$| 0h to 24h | Identifies early gate dielectric breakdowns |
| `tpd_drift` | $t_{pd}(24\text{h}) - t_{pd}(0\text{h})$ | 0h to 24h | Identifies early charge trap timings |
