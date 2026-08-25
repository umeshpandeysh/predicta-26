# Predicta ML Inference API Documentation

Version: `2.0_production`  
Base URL: `http://localhost:8000/api`  
Operating Threshold: `0.45`  

---

## 1. Overview

The Predicta ML Inference API exposes automated PASS/FAIL semiconductor defect classification using the frozen production XGBoost model (`predicta_final_xgboost.json`).

The model vector consists of **28 total features**:
- 16 Raw Physical Measurement Features
- 7 Domain-Engineered Ratios ($V_{\text{headroom}}$, $V_{\text{util}}$, $I_{\text{fraction}}$, $P_{\text{efficiency}}$, $t_{\text{slack\_ratio}}$, $f \times t_{\text{pd}}$, $T_{\text{delta}}$)
- 5 One-Hot Encoded Equipment IDs (`eq_EQP-101` .. `eq_EQP-105`)

---

## 2. Endpoints

### `GET /api/health`

Checks the operational health and status of the ML inference engine.

**Response `200 OK`**:
```json
{
  "status": "ok",
  "model": "predicta_final_xgboost",
  "version": "2.0_production",
  "threshold": 0.45
}
```

---

### `POST /api/predict`

Submits a single semiconductor test measurement record for PASS/FAIL inference.

**Request Body**:
```json
{
  "test_id": "DEV-TEST-001",
  "equipment_id": "EQP-103",
  "supply_voltage": 1.20,
  "output_voltage": 1.18,
  "current": 45.2,
  "leakage_current": 195.4,
  "resistance": 12.5,
  "capacitance": 4.2,
  "threshold_voltage": 0.42,
  "frequency": 2400.0,
  "propagation_delay": 14.5,
  "setup_time": 1.2,
  "hold_time": 0.8,
  "timing_margin": 2.1,
  "temperature": 35.0,
  "dynamic_power": 65.0,
  "total_power": 72.0,
  "test_duration": 12.0
}
```

**Response `200 OK`**:
```json
{
  "prediction": "FAIL",
  "probability": 0.999,
  "threshold": 0.45,
  "risk_level": "CRITICAL",
  "model_version": "2.0_production",
  "test_id": "DEV-TEST-001",
  "equipment_id": "EQP-103",
  "explanation": {
    "key_indicators": [
      {
        "feature": "leakage_current",
        "value": 195.4,
        "unit": "µA",
        "status": "ELEVATED",
        "description": "High leakage current indicates potential transistor gate oxide defect."
      },
      {
        "feature": "temperature",
        "value": 35.0,
        "unit": "°C",
        "status": "ELEVATED",
        "description": "Operating temperature above nominal thermal envelope."
      }
    ]
  }
}
```

**Error Response `400 Bad Request`**:
```json
{
  "detail": "Invalid equipment_id 'EQP-999'. Must be one of: EQP-101, EQP-102, EQP-103, EQP-104, EQP-105"
}
```

---

### `POST /api/predict/batch`

Submits an array of test measurement records for batch processing.

**Request Body**:
```json
[
  { "equipment_id": "EQP-101", ... },
  { "equipment_id": "EQP-102", ... }
]
```

**Response `200 OK`**:
```json
{
  "total": 2,
  "pass_count": 1,
  "fail_count": 1,
  "results": [ ... ]
}
```

---

## 3. Risk Level Mapping

| Probability Range | Prediction | Risk Level | Description |
| :--- | :--- | :--- | :--- |
| `p < 0.25` | PASS | **`LOW`** | Nominal physical parameters |
| `0.25 <= p < 0.45` | PASS | **`MEDIUM`** | Elevated lot variance / borderline warning |
| `0.45 <= p < 0.75` | FAIL | **`HIGH`** | Model threshold exceeded |
| `p >= 0.75` | FAIL | **`CRITICAL`** | Severe defect detected |
