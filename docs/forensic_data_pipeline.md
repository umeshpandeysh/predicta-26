# Predicta Day 28 — Forensic ML Data Pipeline Reconstruction & Rules Audit

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Data Generation & Label Determinism Reconstruction

```text
Raw Parameters (16 Physical Telemetry Fields)
        │
        ▼
BSIM4 MOSFET Physics Coupling & Ratio Engineering (+12 Features)
        │
        ▼
Synthetic Defect Injection (TIMING_FAILURE, THERMAL_ANOMALY, POWER_ANOMALY, etc.)
        │
        ▼
Deterministic Severity Calculation (s = max(delta_i_leak, delta_temp, delta_t_pd, ...))
        │
        ▼
Binary Label Assignment Rule: target = (severity >= 0.20 || any_defect_active ? 1 : 0)
```

---

## 2. Parameter Schema & Feature Rules Summary

| Feature Name | Feature Type | Generation Distribution | Deterministic Relationship / Formula |
| :--- | :--- | :--- | :--- |
| `supply_voltage` | Raw Physical | Gaussian $\mathcal{N}(1.20, 0.02^2)$ | Nominal $1.20V \pm 0.05V$ |
| `output_voltage` | Raw Physical | Linear coupling | $v_{out} = v_{sup} \times (0.98 - 0.05 \times t_{pd\_shift})$ |
| `current` | Raw Physical | Linear coupling | $i_{total} = i_{dyn} + i_{leak}$ |
| `leakage_current` | Raw Physical | Log-Normal exponential | $i_{leak} = 100 \times \exp((temp - 25)/36) \times (1 + severity \times 3)$ |
| `propagation_delay` | Raw Physical | Gaussian + Temp/Volt shift | $t_{pd} = 10.0 + (temp - 25)\times 0.15 + (1.20 - v_{sup})\times 15.0$ |
| `temperature` | Raw Physical | Gaussian $\mathcal{N}(25.0, 5.0^2)$ | Ambient + Dynamic power heating $\Delta T = p_{dyn} \times 0.15$ |
| `dynamic_power` | Raw Physical | Frequency-voltage coupling | $p_{dyn} = v_{sup}^2 \times freq \times 0.015$ |
| `total_power` | Raw Physical | Additive sum | $p_{total} = p_{dyn} + v_{sup} \times i_{leak} \times 10^{-3}$ |
