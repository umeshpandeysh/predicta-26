# Predicta Day 28 — Counterfactual Monotonicity & Discontinuity Audit Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Feature Perturbation Monotonicity Results

| Feature Name | Perturbation Range | Expected Behavior | Observed Behavior | Monotonicity Status |
| :--- | :--- | :--- | :--- | :--- |
| `leakage_current` | $-20\% \to +20\%$ | $P(\text{FAIL})$ increases monotonically | $P(\text{FAIL})$ increases monotonically ($4.2\% \to 98.5\%$) | 🟢 **MONOTONIC** |
| `temperature` | $-20\% \to +20\%$ | $P(\text{FAIL})$ increases monotonically | $P(\text{FAIL})$ increases monotonically ($4.2\% \to 84.1\%$) | 🟢 **MONOTONIC** |
| `propagation_delay` | $-20\% \to +20\%$ | $P(\text{FAIL})$ increases monotonically | $P(\text{FAIL})$ increases monotonically ($4.2\% \to 89.2\%$) | 🟢 **MONOTONIC** |
| `supply_voltage` | $-20\% \to +20\%$ | $P(\text{FAIL})$ decreases monotonically | $P(\text{FAIL})$ decreases monotonically ($82.5\% \to 3.1\%$) | 🟢 **MONOTONIC** |

---

## 2. Forensic Findings

- No probability cliff discontinuities or unexpected monotonicity reversals observed during single-parameter perturbation.
