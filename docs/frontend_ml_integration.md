# Predicta Day 11 — Frontend ↔ ML API Integration Document

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Overview

Day 11 connected the existing Predicta frontend dashboard to the Day 10 REST ML Inference API (`GET /api/health`, `POST /api/predict`, `POST /api/predict/batch`).

The frontend preserves the existing industrial semiconductor test workstation aesthetic while embedding dynamic model health tracking, real-time single component inference, automated batch testing, explanation breakdown, session prediction history, and responsive layout scaling.

---

## 2. Connected UI Components & Workflow

### 1. Dynamic ML Engine Health Status Indicator
- **Sidebar Footer & Header Badges**: Dynamic status indicator polling `GET /api/health`.
- Shows `ML ENGINE: ● ONLINE (Threshold: 0.45)` when live, or gracefully degrades to `● OFFLINE (Local Mode Active)` if the backend server is temporarily unreachable.

### 2. Single Component Live Predictor Workstation
- **Input Form**: All 16 raw physical features + `equipment_id` dropdown (`EQP-101` .. `EQP-105`).
- **Quick Preset Buttons**:
  - `⚡ Load High-Leakage Failure`
  - `🔥 Load Thermal Anomaly`
  - `✅ Load Nominal PASS Component`
- **Action Button**: `Run Semiconductor Analysis` (with loading state `"Running semiconductor analysis..."` and duplicate submit prevention).
- **Industrial Workstation Result Panel**:
  - **STATUS**: `PASS` (green badge) or `FAIL` (red badge)
  - **FAIL PROBABILITY**: `XX.X%`
  - **RISK LEVEL**: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
  - **MODEL THRESHOLD**: `0.45`
  - **EQUIPMENT**: `EQP-10X`
  - **MODEL VERSION**: `Predicta XGBoost v2.0_production`

### 3. Key Indicator Explanation Panel
Displays major contributing physical measurement signals returned by the model:
- `leakage_current` (µA)
- `temperature` (°C)
- `propagation_delay` (ps)
- `dynamic_power` (mW)
- `supply_voltage` (V)
- `frequency_delay_product` (MHz·ps)

For each indicator, displays measured value, unit, status (`ELEVATED`, `HIGH_LOAD`, `LOW`, `NORMAL`), and non-causal signal context.

### 4. Automated Batch Testing Workstation
- Executes `POST /api/predict/batch` on 50 synthetic development components.
- Loading state `"Analyzing 50 test records..."`.
- Displays summary statistics grid: `Total Tested`, `PASS Count`, `FAIL Count`, `FAIL Rate (%)`, `Average Probability (%)`.
- Renders interactive batch results table with individual `Inspect` buttons.

### 5. Session Prediction History
- Client-side array tracking recent prediction calls during current session.
- Displays `Timestamp`, `Test ID`, `Equipment`, `Prediction`, `Probability`, `Risk Level`.

---

## 3. Responsive Scaling & Page Navigation

- **Desktop**: 2-column workstation dashboard grid.
- **Tablet & Mobile**: Reorganizes into single-column responsive flow with zero horizontal page overflow.
- **Navigation Router**: Switching pages invokes `window.scrollTo({ top: 0, behavior: 'smooth' })` to reset scroll position to top.

---

## 4. Verification & Model Preservation Confirmation

- **Frozen Model Artifact**: `ml/models/predicta_final_xgboost.json` (100% UNMODIFIED)
- **Model Metadata**: `ml/models/predicta_final_metadata.json` (100% UNMODIFIED)
- **Operating Threshold**: `0.45` (STRICTLY PRESERVED)
- **Data Protection**: `ml/data/processed/test.csv` (ABSOLUTELY NOT ACCESSED)
- **Test Suite Results**: All Day 10 and Day 11 frontend/API integration test cases passed (`node tests/test_frontend_integration.js`).
