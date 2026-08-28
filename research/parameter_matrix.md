# Parameter Research Matrix
## Mapping Electrical and Environmental Variables to AI screening modules

This matrix registers all features analyzed for the AI-Driven Predictive Screening (AIPS) console. It connects datasheet parameters to their physics-of-failure degradation mechanisms and uses them to calibrate our synthetic data generator.

| Feature Identifier | Parameter Name | Standard Unit | Primary Physics-of-Failure | Component Evidence (TI, CAES, ON) | Relevant AI Modules | SEMICONDUCTOR_TELEMETRY Mapping & Calibration |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Iddq** | Quiescent supply current | $\mu\text{A}$ | Gate oxide degradation, Trap-Assisted Tunneling | SN74LVC1G04 ($10\,\mu\text{A}$ max), UT54ACS04 ($10\,\mu\text{A}$ max) | Module A (Anomaly) | Core outlier detector. Multi-parameter lot median offsets indicate latent shorts. |
| **Ileak** | Gate/Drain leakage current | $\text{nA}$ / $\mu\text{A}$ | Dielectric Breakdown, Thermal Overstress | IRF540N ($100\text{ nA}$ max gate leakage), OPA333 ($200\text{ pA}$ bias) | Module A, Module B (Drift) | Tracks gate leakage current increases over time to detect dielectric wear-out. |
| **tpd** | Cell propagation delay | $\text{ns}$ | Threshold voltage shift ($V_{th}$), saturation current decay | SN74LVC1G04 ($4.5\text{ ns}$ max), UT54ACS04 ($6.5\text{ ns}$ max) | Module B (Drift) | Timing-degradation metric. Normal devices degrade via sub-linear power law ($t^{0.2}$). |
| **Vth** | Threshold voltage | $\text{V}$ | Bias Temperature Instability (BTI), oxide charge trapping | IRF540N ($2.0\text{V} - 4.0\text{V}$ gate threshold) | Module B (Drift) | Internal physical driver. An increase in $|V_{th}|$ directly degrades sat drive current, slowing delays. |
| **Temp** | Oven stress temperature | $^\circ\text{C}$ | Arrhenius rate acceleration factor | standard burn-in stress ($125^\circ\text{C}$ / $150^\circ\text{C}$) | Decision Engine | Input feature for BTI kinetics. Normalizes drift rates across variable oven cycles. |
| **Voltage** | Electrical stress voltage | $\text{V}$ | Tunneling currents, trap generation rate | static bias voltage ($1.2\times - 1.5\times$ nominal) | Decision Engine | Overstress acceleration factor. Captures voltage-dependent degradation rates. |
| **Lot ID** | Lot cohort ID | Text | Wafer-level manufacturing process shifts | standard e-test process lots | Module A (Anomaly) | Statistical grouping variable. Median and MAD calculations are lot-specific. |
| **Wafer ID** | Wafer coordinate ID | Text | Radial spatial process variation | ST-AWFD wafer coordinates | Module A (Anomaly) | Identifies spatial patterns (e.g., ring patterns indicating defective wafer edges). |
