# Red Team Audit — Phase 1: Data Generation & Label Assignment Audit

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Data Generator Source Code Inspection

- **Primary Generator Script**: `ml/data_generator/generate_dataset.py` (`SemiconductorDataGenerator` class).
- **Secondary Generator Script**: `src/physics/generator.py` (`generate_lot_components` function).

### Target Label Assignment Formula (`generate_dataset.py:306`):
```python
result = "PASS" if defect_type == "NORMAL" else "FAIL"
```

---

## 2. Defect Injections & Synthetic Shortcut Leakage Table

| Defect Type | Parameter Injections & Mutations | Severity Scaling | Synthetic Shortcut / Risk Level | Model Recall Result |
| :--- | :--- | :--- | :--- | :--- |
| **`TIMING_FAILURE`** | `propagation_delay *= 1.0 + (severity * 0.20..0.55)`<br>`timing_margin -= severity * 1.2..3.0` | $0.20 \le s \le 1.0$ | **HIGH LEAKAGE RISK**: Pushes `propagation_delay > 13.8ns` into an unrealistically clean decision boundary. | **100.00%** |
| **`THERMAL_ANOMALY`** | `temperature += severity * 10.0..38.0`<br>`thermal_leak_boost = exp((temp-25)/45)` | $0.20 \le s \le 1.0$ | **HIGH LEAKAGE RISK**: Direct temperature spike above $31.0^\circ C$ creates easily separable cluster. | **97.11%** |
| **`POWER_ANOMALY`** | `dynamic_power *= 1.0 + (severity * 0.25..0.75)` | $0.20 \le s \le 1.0$ | **MEDIUM LEAKAGE RISK**: `dynamic_power > 60.0mW` boundary easily separated. | **96.69%** |
| **`LOW_VOLTAGE`** | `supply_voltage *= 1.0 - (severity * 0.08..0.18)` | $0.20 \le s \le 1.0$ | **MEDIUM LEAKAGE RISK**: `supply_voltage < 1.15V` creates sharp threshold boundary. | **94.54%** |
| **`PROCESS_VARIATION`** | `threshold_voltage *= 1.0 + (severity * 0.18)`<br>`resistance *= 1.0 + (severity * 0.16)` | $0.20 \le s \le 1.0$ | **LOW LEAKAGE RISK**: Broad parameter shift across $v_{th}, r, c, t_{pd}$. | **93.05%** |
| **`HIGH_LEAKAGE`** | `leakage_current *= 1.0 + (severity * 0.55..1.45)` | $0.20 \le s \le 1.0$ | **MEDIUM LEAKAGE RISK**: $i_{leak} > 185\mu A$ threshold; $25-30\%$ overlap with Normal tail. | **92.48%** |
| **`EQUIPMENT_DRIFT`** | `resistance *= 1.0 + (severity * 0.15)`<br>`output_voltage *= 1.0 - (severity * 0.08)` | $0.20 \le s \le 1.0$ | **NO LEAKAGE (MISSED DEFECT)**: `equipment_id` assigned randomly; subtle parameter shifts missed by main tree splits. | **31.85%** |

---

## 3. Red Team Summary

1. **Deterministic Target Assignment**: The binary target `result` was created directly by checking `defect_type != "NORMAL"`.
2. **Synthetic Boundary Separability**: Severe defect mutations ($s = 1.0$) created highly separable clusters for timing and thermal defects.
3. **Equipment ID Disconnect**: `equipment_id` was assigned randomly without tying to `EQUIPMENT_DRIFT` severity, causing `EQUIPMENT_DRIFT` recall to drop to $31.85\%$.
