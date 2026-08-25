# Data Flow Architecture

This document describes the sequence of data transformations and data flow across the AIPS system during a standard screening run.

---

## 1. Sequence Diagram: Ingestion to Decision

The diagram below maps the sequence of data transfers from the initial upload of the 24h test sheet to the final dashboard visual rendering:

```text
[ATE / User]      [FastAPI Backend]      [Module A / B]     [Decision Engine]    [React UI]
     │                    │                     │                   │                │
     │─── Ingest CSV ────►│                     │                   │                │
     │   (0h & 24h logs)  │── Validate Lot ────►│                   │                │
     │                    │   Size (N >= 30)    │                   │                │
     │                    │                     │                   │                │
     │                    │── Robust Z-Scale ──►│                   │                │
     │                    │   Median/MAD        │                   │                │
     │                    │                     │                   │                │
     │                    │── Run COPOD (ModA) ─►│                   │                │
     │                    │   Anomaly Score &   │                   │                │
     │                    │   Attribution       │                   │                │
     │                    │                     │                   │                │
     │                    │── Run GPR (ModB) ──►│                   │                │
     │                    │   Predict 168h Mean │                   │                │
     │                    │   & Variance        │                   │                │
     │                    │                     │                   │                │
     │                    │─────────────────────┼── Evaluate Spec ─►│                │
     │                    │                     │   & Safety Slope  │                │
     │                    │                     │   Limits          │                │
     │                    │                     │                   │                │
     │                    │◄────────────────────┼── Return Status ──│                │
     │                    │                     │   (PASS/MON/REJ)  │                │
     │                    │                     │                   │                │
     │◄── JSON Response ──│                     │                   │                │
     │   (Component list) │                     │                   │                │
     │                    │                     │                   │                │
     │────────────────────┼─────────────────────┼───────────────────┼── Render Grid ─►
     │                    │                     │                   │   (Lot Maps)   │
```

---

## 2. API Data Schema (Input / Output formats)

### Input Schema (`POST /screen-component`)
```json
{
  "component_id": "IC_042",
  "lot_id": "LOT_ISRO_2026_09",
  "test_hour": 24,
  "parameters": {
    "iddq_0h": 10.5,
    "iddq_24h": 12.1,
    "ileak_0h": 1.45,
    "ileak_24h": 1.62,
    "tpd_0h": 118.2,
    "tpd_24h": 119.5
  },
  "stress_conditions": {
    "temperature_celsius": 125,
    "voltage_volts": 1.2
  }
}
```

### Output Schema (`POST /screen-component` Response)
```json
{
  "component_id": "IC_042",
  "lot_id": "LOT_ISRO_2026_09",
  "status": "REJECT",
  "decision_reason": "Propagation delay drift slope (0.016 ns/hr) exceeds dynamic safety slope limit (0.011 ns/hr) + predicted 168h delay (122.5 ns) has a 12% probability of crossing datasheet maximum specifications.",
  "module_a": {
    "anomaly_score": 8.42,
    "anomaly_flag": true,
    "contributions": {
      "iddq": 0.45,
      "ileak": 0.35,
      "tpd": 0.20
    }
  },
  "module_b": {
    "predicted_iddq_168h": 13.5,
    "predicted_tpd_168h": 122.5,
    "confidence_interval_lower": 120.1,
    "confidence_interval_upper": 124.9,
    "predicted_drift_slope": 0.016,
    "safety_slope_threshold": 0.011
  }
}
```
