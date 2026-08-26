# Predicta Day 23 — Research Feature Shortcut & Importance Audit

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Top Feature Permutation Importance Ranking

1. `leakage_current` (Primary parameter for high leakage defect class)
2. `temperature` (Primary parameter for thermal anomaly defect class)
3. `propagation_delay` (Primary parameter for timing failure defect class)
4. `thermal_delta` ($temp - 25.0$, engineered thermal coupling)
5. `dynamic_power` (Primary parameter for power anomaly defect class)
6. `supply_voltage` (Primary parameter for low voltage droop defect class)
7. `frequency_delay_product` ($freq \times t_{pd}$, timing path load)
8. `equipment_id` (Machine chamber offset context)

---

## 2. Feature Shortcut Resistance Audit

- **Single Feature Shortcut Test**: No single physical feature alone can predict all defect classes because defect signatures span multiple orthogonal physical domains (electrical leakage, timing delay, thermal, power).
- **Physical Monotonicity**: Permutating `leakage_current` upward monotonically increases failure probability, proving tree splits respect semiconductor device physics.
