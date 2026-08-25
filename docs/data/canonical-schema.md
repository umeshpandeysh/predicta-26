# Canonical PS170 Schema

Every record in the AIPS data platform follows this standard format to ensure consistency across proxy datasets and synthetic simulators.

## Schema Fields

| Field | Type | Description | Range | Source |
| :--- | :--- | :--- | :--- | :--- |
| `component_id` | String | Unique component identifier | `COMP-[SYN/ST/NASA]-[0-9]+` | Generated / Raw |
| `lot_id` | String | Cohort lot identifier | `LOT-[A-Z0-9-]+` | Generated / Raw |
| `manufacturer` | String | Manufacturer name | Free text | Raw / Model-derived |
| `component_family` | String | High-level silicon group | `CMOS_LOGIC`, `MOSFET`, `OP_AMP` | Raw / Model-derived |
| `component_type` | String | Functional category | `HEX_INVERTER`, `POWER_MOSFET`, etc. | Raw / Model-derived |
| `package` | String | Package type | `CERAMIC_FP`, `TO-220`, `SOT-23` | Raw / Model-derived |
| `burn_in_hour` | Integer | Environmental stress hour | `[0, 24, 96, 168]` | Raw / Generated |
| `temperature_c` | Float | Stress oven temperature in Celsius | `-55.0 to 200.0` | Raw / Generated |
| `voltage_v` | Float | Stress bias voltage in Volts | `0.0 to 100.0` | Raw / Generated |
| `iddq` | Float | Quiescent standby current in ÂµA | `0.0 to 1000.0` | Raw / Generated |
| `ileak` | Float | Gate/terminal leakage current in ÂµA | `0.0 to 500.0` | Raw / Generated |
| `tpd` | Float | Cell propagation delay in ns | `0.0 to 1000.0` | Raw / Generated |
| `vth` | Float | Internal threshold voltage shift in Volts | `0.0 to 5.0` | Derived / Generated |
| `health_state` | String | Evaluated health categorization | `HEALTHY`, `BORDERLINE`, `LATENT_DEFECT`, `FAILED` | Model-derived |
| `defect_type` | String | Specific physical failure mode | `NONE`, `GATE_OXIDE_SHORT`, `TIMING_OFFSET`, `STEP_BREAKDOWN` | Model-derived |
| `anomaly_label` | Integer | Anomaly flag | `0` (Normal), `1` (Anomaly) | Model-derived |
| `failure_label` | Integer | Critical failure / out-of-spec flag | `0` (Pass), `1` (Fail) | Model-derived |
| `source_type` | String | Dataset origin mode | `synthetic`, `proxy` | Metadata |
| `source_dataset` | String | Source dataset name | `ps170_synthetic`, `st_awfd`, `nasa_mosfet`, `uci_secom` | Metadata |
| `generation_method`| String | Algorithm used to create records | `physics_RD_power_law`, `raw_ingestion` | Metadata |
| `generation_version`| String | Software version code | `0.1` | Metadata |
