# Data Provenance Registry

This registry tracks the origin, confidence, and validation status of every dataset processed by AIPS.

## Data Mappings & Mapped Variables

| Dataset ID | Parameter Mapped | Canonical Field | Mapping Type | Confidence | Limitation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **nasa_mosfet** | `gate_leakage_a` | `ileak` | DIRECT | HIGH | Aggressive stress conditions run to failure. |
| **nasa_mosfet** | `threshold_voltage_v` | `vth` | DIRECT | HIGH | Small sample size (32 parts). |
| **st_awfd** | `e_test_1` | `iddq` | APPROXIMATE| MEDIUM | Static snapshot, no burn-in stress. |
| **uci_secom** | `sensor_001` | `iddq` | APPROXIMATE| LOW | Features are fully anonymized. |
| **SEMICONDUCTOR_TELEMETRY_synthetic** | `iddq`, `ileak`, `tpd` | `iddq`, `ileak`, `tpd`| DIRECT | HIGH | Configurable model-derived values. |
