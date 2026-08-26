# Red Team Audit — Phase 1: Data Generation Pipeline & Defect Injections

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Complete Synthetic Data Pipeline Tracing

```text
ml/data_generator/generate_dataset.py
   ├── 1. Random Base Generation (N=50,000)
   │      ├── Normal Gauss: supply_voltage (1.20V), threshold_voltage (0.45V), current (45mA)
   │      ├── Derived Overdrive: overdrive = max(0.1, supply - vth)
   │      ├── Physics Frequency: base_freq = 2500.0 * (overdrive / 0.75)^1.2
   │      ├── Physics Propagation Delay: base_delay = 12.50 * (0.75 / overdrive)^1.1
   │      └── Thermal Coupling: ileak = gauss(120, 15) * exp((temp - 25) / 35)
   │
   ├── 2. Defect Type Assignment (87% Normal, 13% Defect Split)
   │      ├── HIGH_LEAKAGE (20%): leakage_current *= 1.0 + (severity * 0.55..1.45)
   │      ├── LOW_VOLTAGE (15%): supply_voltage *= 1.0 - (severity * 0.08..0.18)
   │      ├── TIMING_FAILURE (15%): propagation_delay *= 1.0 + (severity * 0.20..0.55)
   │      ├── THERMAL_ANOMALY (12%): temperature += severity * 10.0..38.0
   │      ├── POWER_ANOMALY (12%): dynamic_power *= 1.0 + (severity * 0.25..0.75)
   │      ├── PROCESS_VARIATION (14%): vth *= 1.0 + (severity * 0.18), resistance *= 1.16
   │      └── EQUIPMENT_DRIFT (12%): resistance *= 1.15, output_voltage *= 0.92
   │
   └── 3. Target Label Assignment (Line 306)
          └── result = "PASS" if defect_type == "NORMAL" else "FAIL"
```

---

## 2. Defect Injections & Generator Rule Analysis

| Defect Class | Features Mutated | Injection Magnitude | Target Label Rule | Generator Pattern vs Real Physics |
| :--- | :--- | :--- | :--- | :--- |
| **`TIMING_FAILURE`** | `propagation_delay`, `setup_time`, `timing_margin` | $+20\%$ to $+55\%$ delay boost | Direct assignment: `FAIL` | **Generator Rule Shortcut**: Forces $t_{pd} > 13.8ns$. Unrealistically clean decision boundary ($100\%$ recall). |
| **`THERMAL_ANOMALY`** | `temperature`, `leakage_current` | $+10^\circ C$ to $+38^\circ C$ temperature boost | Direct assignment: `FAIL` | **Generator Rule Shortcut**: Pushes temperature $> 31.0^\circ C$. High separability ($97.11\%$ recall). |
| **`POWER_ANOMALY`** | `dynamic_power`, `current`, `temperature` | $+25\%$ to $+75\%$ power boost | Direct assignment: `FAIL` | **Generator Rule Shortcut**: Dynamic power $> 60mW$ split node ($96.69\%$ recall). |
| **`LOW_VOLTAGE`** | `supply_voltage`, `output_voltage`, `frequency` | $-8\%$ to $-18\%$ voltage drop | Direct assignment: `FAIL` | **Generator Rule Shortcut**: Sharp cutoff below $1.15V$ ($94.54\%$ recall). |
| **`PROCESS_VARIATION`** | `threshold_voltage`, `resistance`, `capacitance` | $+18\%$ $v_{th}$, $+16\%$ resistance boost | Direct assignment: `FAIL` | **Broad Parameter Drift**: Multi-feature shift ($93.05\%$ recall). |
| **`HIGH_LEAKAGE`** | `leakage_current`, `current`, `temperature` | $+55\%$ to $+145\%$ leakage boost | Direct assignment: `FAIL` | **Realistic Tail Overlap**: $25-30\%$ distribution overlap with Normal tail ($92.48\%$ recall). |
| **`EQUIPMENT_DRIFT`** | `resistance`, `output_voltage`, `current` | $+15\%$ resistance, $-8\%$ voltage | Direct assignment: `FAIL` | **GENERATOR DISCONNECT**: `equipment_id` assigned randomly! Model fails to associate drift with machine ID ($31.85\%$ recall). |

---

## 3. Key Findings

1. **Deterministic Binary Target**: Label `result` is assigned strictly by `defect_type != "NORMAL"`.
2. **Severe Defects Create Artificial Separability**: Severe defect mutations ($severity = 1.0$) allow decision trees to learn trivial thresholds ($t_{pd} > 13.8ns$, $temp > 31^\circ C$) rather than complex physical interactions.
3. **Equipment Drift Disconnect**: `equipment_id` is assigned randomly in `generate_dataset.py:178`, leaving the one-hot features (`eq_EQP-101`..`105`) disconnected from equipment drift defects.
