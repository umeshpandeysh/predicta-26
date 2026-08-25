# System Architecture Map

This document describes the deployment and system boundaries of the AI-Driven Predictive Screening (AIPS) tool.

---

## 1. Context Diagram

The system operates as an edge-deployable test analytics service integrated directly with Automated Test Equipment (ATE) on the ISRO component screening floor:

```text
  ┌────────────────────────────────────────────────────────┐
  │                    Burn-In Test Floor                  │
  │                                                        │
  │   ┌──────────────────┐          ┌──────────────────┐   │
  │   │  ATE Test Rig    │          │  Oven Controller │   │
  │   │  (Keithley/NI)   │          │  (Temp & Bias)   │   │
  │   └────────┬─────────┘          └────────┬─────────┘   │
  └────────────┼─────────────────────────────┼─────────────┘
               │ (Standard Test format STDF) │ (Modbus/TCP logs)
               ▼                             ▼
  ┌────────────────────────────────────────────────────────┐
  │                      AIPS Software                     │
  │                                                        │
  │   ┌────────────────────────────────────────────────┐   │
  │   │              Data Ingestion API                │   │
  │   │              (FastAPI / Python)                │   │
  │   └──────────────────────┬─────────────────────────┘   │
  │                          ▼                             │
  │   ┌────────────────────────────────────────────────┐   │
  │   │               Processing Core                  │   │
  │   │   - Robust Lot Normalizer                      │   │
  │   │   - Module A COPOD Engine                      │   │
  │   │   - Module B Physics GPR Engine                │   │
  │   └──────────────────────┬─────────────────────────┘   │
  │                          ▼                             │
  │   ┌────────────────────────────────────────────────┐   │
  │   │             Decision Engine                    │   │
  │   │     (PASS / MONITOR / REJECT Router)           │   │
  │   └──────────────────────┬─────────────────────────┘   │
  └──────────────────────────┼─────────────────────────────┘
                             ▼ (REST / JSON)
  ┌────────────────────────────────────────────────────────┐
  │                   Reliability Dashboard                │
  │         (React.js - Visual Lot Grid & Drift Logs)      │
  └────────────────────────────────────────────────────────┘
```

---

## 2. Component Layout

*   **Ingestion Engine:** Converts STDF files or CSV test sheets into structured pandas DataFrames.
*   **Database (SQLite for Prototype):** Stores lot IDs, component serial records, parameters at 0h and 24h, predicted values, and decision reasons.
*   **Machine Learning Core:**
    *   **COPOD Model:** Written in Python using `PyOD` and `numpy`. Persisted as a pickled object in `models/anomaly/`.
    *   **Gaussian Process Regressor:** Written in Python using `scikit-learn` or `gpytorch`. Persisted in `models/drift/`.
*   **REST API Layer:** Fast API web server providing endpoints for ATE integration and React dashboard data loading.
*   **Web Console:** Sleek React.js single-page application built on a premium space-dark theme for engineers to analyze outliers and review model explanations.
