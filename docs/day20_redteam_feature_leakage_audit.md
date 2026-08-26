# Red Team Audit — Phase 2: Feature Leakage & Redundancy Audit

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. 28-Feature Leakage & Redundancy Analysis

| Feature Name | Category | Generation Timing | Mathematical Redundancy | Leakage / Shortcut Assessment | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `supply_voltage` | Raw | Pre-label | None | Nominal parameter; low leakage risk. | LOW |
| `output_voltage` | Raw | Pre-label | Derived from $v_{sup}$ | Physical voltage droop; low leakage risk. | LOW |
| `current` | Raw | Pre-label | Correlated with $v_{sup}$ | Total operating current; low leakage risk. | LOW |
| `leakage_current` | Raw | Pre-label | Temperature coupled | **Direct Defect Injected**: Boosted during `HIGH_LEAKAGE` injection. | MODERATE |
| `resistance` | Raw | Pre-label | None | Interconnect resistance; low leakage risk. | LOW |
| `capacitance` | Raw | Pre-label | None | Gate capacitance; low leakage risk. | LOW |
| `threshold_voltage` | Raw | Pre-label | None | Transistor threshold voltage; low leakage risk. | LOW |
| `frequency` | Raw | Pre-label | Derived from overdrive | Clock frequency; low leakage risk. | LOW |
| `propagation_delay` | Raw | Pre-label | Overdrive coupled | **Direct Defect Injected**: Boosted up to $+55\%$ in `TIMING_FAILURE`. | HIGH |
| `setup_time` | Raw | Pre-label | None | Flip-flop setup time; low leakage risk. | LOW |
| `hold_time` | Raw | Pre-label | None | Flip-flop hold time; low leakage risk. | LOW |
| `timing_margin` | Raw | Pre-label | $path\_budget - (t_{pd} + t_{setup})$ | **High Redundancy**: Directly derived from $t_{pd}$ and $t_{setup}$. | MODERATE |
| `temperature` | Raw | Pre-label | Ambient coupled | **Direct Defect Injected**: Boosted up to $+38^\circ C$ in `THERMAL_ANOMALY`. | HIGH |
| `dynamic_power` | Raw | Pre-label | $v_{sup}^2$ coupled | **Direct Defect Injected**: Boosted in `POWER_ANOMALY`. | MODERATE |
| `total_power` | Raw | Pre-label | $p_{dyn} + p_{stat} + noise$ | **High Redundancy**: Collinear with dynamic and static power. | MODERATE |
| `test_duration` | Raw | Pre-label | None | Random test duration; zero leakage. | LOW |
| `voltage_headroom` | Engineered | Post-raw | $v_{sup} - v_{th}$ | Collinear with $v_{sup}$ and $v_{th}$. | LOW |
| `voltage_utilization` | Engineered | Post-raw | $v_{th} / v_{sup}$ | Collinear with $v_{sup}$ and $v_{th}$. | LOW |
| `leakage_fraction` | Engineered | Post-raw | $(i_{leak} \times 10^{-3}) / i_{tot}$ | Collinear with $i_{leak}$ and $i_{tot}$. | MODERATE |
| `power_per_current` | Engineered | Post-raw | $p_{dyn} / i_{tot}$ | Collinear with $p_{dyn}$ and $i_{tot}$. | LOW |
| `normalized_timing_margin` | Engineered | Post-raw | $t_{margin} / t_{pd}$ | Collinear with $t_{margin}$ and $t_{pd}$. | MODERATE |
| `frequency_delay_product` | Engineered | Post-raw | $freq \times t_{pd}$ | Collinear with $freq$ and $t_{pd}$. | MODERATE |
| `thermal_delta` | Engineered | Post-raw | $temp - 25.0$ | **Perfect Collinearity ($r = 1.0$)**: Identical to `temperature` minus constant 25. | HIGH |
| `eq_EQP-101` .. `105` | Equipment OHE | Pre-label | Binary 5-vector | **Zero Defect Correlation**: Randomly assigned; no predictive relationship to defect type. | LOW |

---

## 2. Red Team Summary

1. **Perfect Collinearity**: `thermal_delta` ($temp - 25.0$) provides zero additional mathematical entropy over `temperature`.
2. **Defect Signature Shortcuts**: Features like `propagation_delay` and `temperature` directly received severity multipliers during synthetic generation, acting as synthetic shortcuts for XGBoost split nodes.
