# Predicta Day 24 — Data Quality Gate Architecture Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Pre-Inference Safeguard Gate Criteria

| Validation Check | Failure Condition | Action Taken |
| :--- | :--- | :--- |
| **1. Equipment ID** | `equipment_id` not in `EQP-101` .. `EQP-105` | Rejects payload (`DATA_QUALITY_REJECTED`) |
| **2. Test ID & Duplicates** | Blank or duplicate `test_id` | Flags duplicate warning or rejects |
| **3. Physical Boundaries** | Value outside physical bounds (e.g. $temp > 175^\circ C$) | Rejects payload (`DATA_QUALITY_REJECTED`) |
| **4. Numeric Sanity** | `NaN`, `Infinity`, or string conversion failure | Rejects payload (`DATA_QUALITY_REJECTED`) |
| **5. Missing Fields** | Any of 16 required physical parameters missing | Rejects payload (`DATA_QUALITY_REJECTED`) |
