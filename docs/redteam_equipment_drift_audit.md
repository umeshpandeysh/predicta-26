# Red Team Audit — Phase 3: Equipment Drift Recall Failure Audit

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Root Cause Analysis of Equipment Drift Recall (31.85%)

### Benchmark Performance Breakdown:
- **`TIMING_FAILURE` Recall**: `100.00%`
- **`THERMAL_ANOMALY` Recall**: `97.11%`
- **`POWER_ANOMALY` Recall**: `96.69%`
- **`LOW_VOLTAGE` Recall**: `94.54%`
- **`PROCESS_VARIATION` Recall**: `93.05%`
- **`HIGH_LEAKAGE` Recall**: `92.48%`
- **`EQUIPMENT_DRIFT` Recall**: **`31.85%`** ❌

---

## 2. Why Did `EQUIPMENT_DRIFT` Recall Drop to 31.85%?

### Root Cause 1: Synthetic Generator Disconnect
In `ml/data_generator/generate_dataset.py`:
- `equipment_id` was assigned **randomly** across all samples (`equipment_id = self.rng.choice(self.EQUIPMENT_IDS)`).
- When `defect_type == "EQUIPMENT_DRIFT"`, the generator modified physical parameters (`resistance *= 1.0 + severity * 0.15`, `output_voltage *= 1.0 - severity * 0.08`), but did **NOT** tie the drift to a specific equipment ID.
- As a result, the equipment one-hot encodings (`eq_EQP-101` .. `105`) carried **zero predictive signal** for equipment drift defects!

### Root Cause 2: Subtle Physical Mutation Magnitude
The physical parameter mutations for `EQUIPMENT_DRIFT` were $+15\%$ resistance and $-8\%$ output voltage. These shifts were too small to cross the tree split thresholds designed for severe thermal ($+38°C$) or timing ($+55\%$ delay) defects.

---

## 3. Red Team Summary & Recommended Future Fix

1. **Synthetic Data Realism Flaw**: The synthetic data generator failed to model real chamber-specific drift (where a single machine like `EQP-103` gradually drifts out of calibration over time).
2. **Future Engineering Recommendation**: Future dataset iterations should inject equipment-specific sensor offsets (e.g. `EQP-103` temperature reading biased $+5°C$) so that equipment one-hot features can learn true equipment context.
