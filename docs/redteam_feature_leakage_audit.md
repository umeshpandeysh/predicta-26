# Red Team Audit — Phase 2: Feature Leakage & Redundancy Audit

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. 28-Feature Leakage & Redundancy Evaluation

| Feature Name | Feature Category | Generated Before/After Label? | Mathematical Redundancy | Leakage / Shortcut Assessment |
| :--- | :--- | :--- | :--- | :--- |
| `supply_voltage` | Raw Measurement | Before | None | Low risk; nominal parameter. |
| `output_voltage` | Raw Measurement | Before | Derived from `supply_voltage` | Low risk; physical voltage droop. |
| `current` | Raw Measurement | Before | Correlated with $v_{sup}$ | Low risk; total current. |
| `leakage_current` | Raw Measurement | Before | Temperature coupled | **Moderate Leakage**: Directly boosted during `HIGH_LEAKAGE` injection. |
| `resistance` | Raw Measurement | Before | None | Low risk; IC interconnect resistance. |
| `capacitance` | Raw Measurement | Before | None | Low risk; gate load capacitance. |
| `threshold_voltage` | Raw Measurement | Before | None | Low risk; transistor $v_{th}$. |
| `frequency` | Raw Measurement | Before | Derived from overdrive | Low risk; clock frequency. |
| `propagation_delay` | Raw Measurement | Before | Overdrive coupled | **High Leakage**: Directly boosted during `TIMING_FAILURE` injection. |
| `setup_time` | Raw Measurement | Before | None | Low risk; flip-flop setup. |
| `hold_time` | Raw Measurement | Before | None | Low risk; flip-flop hold. |
| `timing_margin` | Raw Measurement | Before | $path\_budget - (t_{pd} + t_{setup})$ | **High Redundancy**: Directly derived from $t_{pd}$ and $t_{setup}$. |
| `temperature` | Raw Measurement | Before | Ambient coupled | **High Leakage**: Directly boosted during `THERMAL_ANOMALY` injection. |
| `dynamic_power` | Raw Measurement | Before | $v_{sup}^2$ coupled | **Moderate Leakage**: Directly boosted during `POWER_ANOMALY` injection. |
| `total_power` | Raw Measurement | Before | $p_{dyn} + p_{stat}$ | **High Redundancy**: Collinear with dynamic and static power. |
| `test_duration` | Raw Measurement | Before | None | Zero leakage; constant random test duration. |
| `voltage_headroom` | Engineered | After Raw | $v_{sup} - v_{th}$ | High collinearity with $v_{sup}$ and $v_{th}$. |
| `voltage_utilization` | Engineered | After Raw | $v_{th} / v_{sup}$ | High collinearity with $v_{sup}$ and $v_{th}$. |
| `leakage_fraction` | Engineered | After Raw | $(i_{leak} \times 10^{-3}) / i_{tot}$ | Collinear with $i_{leak}$ and $i_{tot}$. |
| `power_per_current` | Engineered | After Raw | $p_{dyn} / i_{tot}$ | Collinear with $p_{dyn}$ and $i_{tot}$. |
| `normalized_timing_margin` | Engineered | After Raw | $t_{margin} / t_{pd}$ | Collinear with $t_{margin}$ and $t_{pd}$. |
| `frequency_delay_product` | Engineered | After Raw | $freq \times t_{pd}$ | Collinear with $freq$ and $t_{pd}$. |
| `thermal_delta` | Engineered | After Raw | $temp - 25.0$ | **Perfect Collinearity ($r = 1.0$)**: Identical to `temperature` minus constant 25. |
| `eq_EQP-101` .. `105` | Equipment OHE | Before | Binary 5-vector | **Zero Defect Correlation**: Randomly assigned; no predictive relationship to defect type. |

---

## 2. Red Team Summary

1. **Collinear Physical Indicators**: Features like `thermal_delta` ($temp - 25$) are $100\%$ collinear with `temperature`.
2. **Defect-Direct Parameter Injection**: Features like `propagation_delay` and `temperature` directly received severity multipliers during synthetic generation, creating explicit decision boundaries for XGBoost trees.
