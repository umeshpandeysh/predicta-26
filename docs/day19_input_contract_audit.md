# Predicta Production 2026 — Day 19 Input & Telemetry Contract Audit Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Input Telemetry Schema Contract

| Feature Name | Category | Standard Unit | Valid Range | Missing / Invalid Rejection |
| :--- | :--- | :--- | :--- | :--- |
| `supply_voltage` | Raw Measurement | Volts ($V$) | $0.5 \le v \le 2.5$ | Rejects `null`, `undefined`, `NaN`, `Infinity`, Non-numeric |
| `output_voltage` | Raw Measurement | Volts ($V$) | $0.0 \le v \le 2.5$ | Rejects `null`, `undefined`, `NaN`, `Infinity`, Non-numeric |
| `current` | Raw Measurement | Milliamperes ($mA$) | $1.0 \le i \le 200.0$ | Rejects `null`, `undefined`, `NaN`, `Infinity`, Non-numeric |
| `leakage_current` | Raw Measurement | Microamperes ($\mu A$) | $0.0 \le i \le 500.0$ | Rejects `null`, `undefined`, `NaN`, `Infinity`, Non-numeric |
| `resistance` | Raw Measurement | Ohms ($\Omega$) | $0.1 \le r \le 100.0$ | Rejects `null`, `undefined`, `NaN`, `Infinity`, Non-numeric |
| `capacitance` | Raw Measurement | Picofarads ($pF$) | $0.01 \le c \le 50.0$ | Rejects `null`, `undefined`, `NaN`, `Infinity`, Non-numeric |
| `threshold_voltage` | Raw Measurement | Volts ($V$) | $0.1 \le v \le 1.0$ | Rejects `null`, `undefined`, `NaN`, `Infinity`, Non-numeric |
| `frequency` | Raw Measurement | Megahertz ($MHz$) | $100.0 \le f \le 5000.0$ | Rejects `null`, `undefined`, `NaN`, `Infinity`, Non-numeric |
| `propagation_delay` | Raw Measurement | Nanoseconds ($ns$) | $1.0 \le t \le 50.0$ | Rejects `null`, `undefined`, `NaN`, `Infinity`, Non-numeric |
| `setup_time` | Raw Measurement | Nanoseconds ($ns$) | $0.01 \le t \le 10.0$ | Rejects `null`, `undefined`, `NaN`, `Infinity`, Non-numeric |
| `hold_time` | Raw Measurement | Nanoseconds ($ns$) | $0.01 \le t \le 10.0$ | Rejects `null`, `undefined`, `NaN`, `Infinity`, Non-numeric |
| `timing_margin` | Raw Measurement | Nanoseconds ($ns$) | $0.0 \le t \le 20.0$ | Rejects `null`, `undefined`, `NaN`, `Infinity`, Non-numeric |
| `temperature` | Raw Measurement | Celsius ($^\circ C$) | $-40.0 \le t \le 150.0$ | Rejects `null`, `undefined`, `NaN`, `Infinity`, Non-numeric |
| `dynamic_power` | Raw Measurement | Milliwatts ($mW$) | $0.0 \le p \le 500.0$ | Rejects `null`, `undefined`, `NaN`, `Infinity`, Non-numeric |
| `total_power` | Raw Measurement | Milliwatts ($mW$) | $0.0 \le p \le 1000.0$ | Rejects `null`, `undefined`, `NaN`, `Infinity`, Non-numeric |
| `test_duration` | Raw Measurement | Seconds ($s$) | $0.1 \le t \le 300.0$ | Rejects `null`, `undefined`, `NaN`, `Infinity`, Non-numeric |

---

## 2. Engineered Physical Formulas & One-Hot Categorical Mapping

| Engineered Feature | Exact Formula | Unit Conversion Scaling |
| :--- | :--- | :--- |
| `voltage_headroom` | $v_{sup} - v_{th}$ | $V$ |
| `voltage_utilization` | $v_{th} / v_{sup}$ | Ratio |
| `leakage_fraction` | $(i_{leak} \times 10^{-3}) / i_{tot}$ | Ratio ($\mu A$ to $mA$ unit scaling) |
| `power_per_current` | $p_{dyn} / i_{tot}$ | $mW/mA$ |
| `normalized_timing_margin` | $t_{margin} / t_{pd}$ | Ratio |
| `frequency_delay_product` | $freq \times t_{pd}$ | $MHz \cdot ns$ |
| `thermal_delta` | $temp - 25.0$ | $^\circ C$ |

### Categorical Equipment One-Hot Mapping:
- **`equipment_id` Valid Set**: `{"EQP-101", "EQP-102", "EQP-103", "EQP-104", "EQP-105"}`
- One-hot binary columns: `eq_EQP-101`, `eq_EQP-102`, `eq_EQP-103`, `eq_EQP-104`, `eq_EQP-105`.

---

## 3. Schema Alignment Audit Verdict

**VERDICT: 100% ALIGNED**  
Frontend Form Fields $\equiv$ Vercel API Schema $\equiv$ 28-Feature Inference Vector $\equiv$ XGBoost Model Input Expectation. Zero missing fields or unit conversion drift across layers.
