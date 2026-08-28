# PREDICTA API CONTRACT SCHEMAS (v2.0.0)

## POST /api/predict

### Request Payload (JSON)
```json
{
  "supply_voltage": 1.20,
  "output_voltage": 1.18,
  "current": 45.2,
  "leakage_current": 12.4,
  "resistance": 12.1,
  "capacitance": 0.15,
  "threshold_voltage": 0.35,
  "frequency": 2.50,
  "propagation_delay": 3.80,
  "setup_time": 0.45,
  "hold_time": 0.25,
  "timing_margin": 0.85,
  "temperature": 27.5,
  "dynamic_power": 42.0,
  "total_power": 54.4,
  "test_duration": 1.20,
  "wafer_id": "WFR-001",
  "equipment_id": "EQP-101"
}
```

### Response Payload (JSON)
```json
{
  "system_version": "v2.0.0-PRODUCTION",
  "decision_state": "NORMAL",
  "severity": "LOW",
  "recommended_action": "PASS",
  "confidence_level": "HIGH",
  "confidence_score": 0.9850,
  "static_probability": 0.0075,
  "anomaly_score": 0.4200,
  "physics_root_cause": "NONE",
  "temporal_warning": null
}
```
