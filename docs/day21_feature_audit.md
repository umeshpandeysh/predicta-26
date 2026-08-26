# Predicta Day 21 — Research Feature Schema Audit Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. 28-Feature Schema Classification

| Feature Name | Category | Classification | Retain in Research V2? | Justification |
| :--- | :--- | :--- | :--- | :--- |
| `supply_voltage` | Raw | **PHYSICALLY JUSTIFIED** | YES | Core operating parameter. |
| `output_voltage` | Raw | **PHYSICALLY JUSTIFIED** | YES | Electrical droop measurement. |
| `current` | Raw | **PHYSICALLY JUSTIFIED** | YES | Dynamic IC current draw. |
| `leakage_current` | Raw | **PHYSICALLY JUSTIFIED** | YES | Transistor gate/subthreshold leakage. |
| `resistance` | Raw | **PHYSICALLY JUSTIFIED** | YES | Interconnect resistance. |
| `capacitance` | Raw | **PHYSICALLY JUSTIFIED** | YES | Gate load capacitance. |
| `threshold_voltage` | Raw | **PHYSICALLY JUSTIFIED** | YES | MOSFET threshold voltage. |
| `frequency` | Raw | **PHYSICALLY JUSTIFIED** | YES | Operating clock frequency. |
| `propagation_delay` | Raw | **PHYSICALLY JUSTIFIED** | YES | Gate propagation delay. |
| `setup_time` | Raw | **PHYSICALLY JUSTIFIED** | YES | Flip-flop setup constraint. |
| `hold_time` | Raw | **PHYSICALLY JUSTIFIED** | YES | Flip-flop hold constraint. |
| `timing_margin` | Raw | **POTENTIAL REDUNDANCY** | YES | Path timing headroom. |
| `temperature` | Raw | **PHYSICALLY JUSTIFIED** | YES | Junction operating temperature. |
| `dynamic_power` | Raw | **PHYSICALLY JUSTIFIED** | YES | Switching power dissipation. |
| `total_power` | Raw | **POTENTIAL REDUNDANCY** | YES | Total power ($p_{dyn} + p_{stat}$). |
| `test_duration` | Raw | **PHYSICALLY JUSTIFIED** | YES | ATE test duration. |
| `voltage_headroom` | Engineered | **PHYSICALLY JUSTIFIED** | YES | $v_{sup} - v_{th}$ overdrive proxy. |
| `voltage_utilization` | Engineered | **PHYSICALLY JUSTIFIED** | YES | $v_{th} / v_{sup}$ ratio. |
| `leakage_fraction` | Engineered | **PHYSICALLY JUSTIFIED** | YES | $(i_{leak} \times 10^{-3}) / i_{tot}$ ratio. |
| `power_per_current` | Engineered | **PHYSICALLY JUSTIFIED** | YES | $p_{dyn} / i_{tot}$ ratio. |
| `normalized_timing_margin` | Engineered | **PHYSICALLY JUSTIFIED** | YES | $t_{margin} / t_{pd}$ ratio. |
| `frequency_delay_product` | Engineered | **PHYSICALLY JUSTIFIED** | YES | $freq \times t_{pd}$ product. |
| `thermal_delta` | Engineered | **HIGH REDUNDANCY ($r=1.0$)** | ABLATION TEST | $temp - 25.0$ (Exact shift of temperature). |
| `eq_EQP-101` .. `105` | Equipment OHE | **EQUIPMENT CONTEXT** | YES (v2) | Chamber-specific offset indicator. |

---

## 2. Research Feature Combinations Evaluated in Day 21

- **Combination A**: Raw physical features only (16 features)
- **Combination B**: Raw + Engineered features (23 features)
- **Combination C**: Raw + Equipment OHE (21 features)
- **Combination D**: Raw + Engineered + Equipment OHE (28 features)
