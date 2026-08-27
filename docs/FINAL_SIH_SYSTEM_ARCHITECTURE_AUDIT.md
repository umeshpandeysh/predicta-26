# PREDICTA — Final SIH 2026 System Architecture Audit

**Date**: August 27, 2026  
**Project**: PREDICTA Semiconductor Test Analytics (SIH 2026 · Problem Statement 170)  
**Audit Standard**: SIH 2026 Finalist-Grade Technical Audit  

---

## 1. Top-Level Architectural Map

```
                                [ ATE / User / Frontend UI ]
                                             │
                                             ▼
                                  [ Serverless API Gateway ]
                                  (api/index.js / server.js)
                                             │
             ┌───────────────────────────────┼───────────────────────────────┐
             │                               │                               │
             ▼                               ▼                               ▼
    [ Auth Guard & RBAC ]          [ Observability Engine ]        [ Rate Limiting Guard ]
    (src/api/auth.js)              (src/api/logger.js)             (Process-Local Limiter)
             │                               │                               │
             └───────────────────────────────┼───────────────────────────────┘
                                             │
                                             ▼
                              [ In-Process 5-Phase ML Engine ]
                              (src/api/inference.js + JSONs)
                                             │
             ┌───────────────────────────────┴───────────────────────────────┐
             │                                                               │
             ▼                                                               ▼
 [ Supabase Cloud PostgreSQL ]                                   [ Hybrid Memory Cache ]
 (prediction_runs & events)                                      (durable local fallback)
```

---

## 2. Component Inventory & Directory Layout

- **Frontend Tier (`frontend/`)**: Static HTML5/CSS3/JavaScript single-page dashboard (`index.html`, `script.js`, `api.js`). Interfaces with API via relative origin or configurable `API_BASE_URL`.
- **API Gateway (`src/api/server.js`, `api/index.js`)**: Node.js HTTP server exporting 15 REST endpoints with standardized status codes (`200`, `201`, `400`, `401`, `403`, `404`, `409`, `429`).
- **5-Phase ML Pipeline (`src/api/inference.js`, `ml/artifacts/`)**:
  - *Phase 1*: Dynamic Anomaly Detection (PAT Robust MAD + COPOD)
  - *Phase 2D*: Genuine GPR 168h Forecast + Calibrated Latent & Observation Uncertainty ($\sigma_{total}$)
  - *Phase 3*: Calculated Safety Slope ($15\text{ nA/h}, 2\text{ nA/h}, 1\text{ ps/h}$) + Project-Defined Screening Criteria
  - *Phase 4*: Multi-Criteria Risk Engine (Dimensionless Normalization + Precedence Override Rules)
  - *Phase 5*: Deterministic Engineering Feature Attribution (`DETERMINISTIC_ENGINEERING_ATTRIBUTION`)
- **Database Tier (`supabase/schema.sql`)**: PostgreSQL schema containing `public.prediction_runs` (`trace_id` UNIQUE, `ml_details` JSONB) and `public.prediction_events` audit table.
- **Security Tier (`src/api/auth.js`)**: Bearer token and API key parser with `ANONYMOUS`, `OPERATOR`, `ADMIN` Role-Based Access Control and sliding-window rate limiting.
