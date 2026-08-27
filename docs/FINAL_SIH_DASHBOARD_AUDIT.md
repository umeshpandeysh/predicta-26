# PREDICTA — Final SIH 2026 Dashboard Forensic & Data Integrity Audit

**Date**: August 27, 2026  
**Project**: PREDICTA Semiconductor Test Analytics (SIH 2026 · Problem Statement 170)  
**Audit Standard**: SIH 2026 Finalist-Grade Technical Audit  

---

## 1. 20-Point Dashboard Verification Matrix

| # | Audit Criteria | Audit Finding | Verification Status |
|---|---|---|---|
| 01 | API Evidence Data Origin | Every chart, score, and metric is populated dynamically from API JSON responses (`/api/predict`, `/api/dashboard/summary`, etc.). | **VERIFIED** |
| 02 | Hardcoded Fake Value Audit | Zero hardcoded synthetic numbers in production rendering logic. | **VERIFIED** |
| 03 | Demo vs Live Distinction | Demo mode is explicitly labeled with source tag (`DEMO`) and banner badge. | **VERIFIED** |
| 04 | Loading States | UI displays spinners and disables action buttons during network requests. | **VERIFIED** |
| 05 | API Error Handling | Toast notifications and alert banners render structured API error messages (`status`, `error`, `trace_id`). | **VERIFIED** |
| 06 | Offline Fallback Indicator | When API is unreachable, UI displays `HYBRID_MEMORY_FALLBACK (LOCAL DEMO)` status badge. | **VERIFIED** |
| 07 | Zero Silent Fake Fallbacks | UI never silently fabricates predictions when backend returns an HTTP error code. | **VERIFIED** |
| 08 | Refresh Consistency | Dashboard state re-fetches from `/api/dashboard/summary` and `/api/dashboard/recent` on page load. | **VERIFIED** |
| 09 | Risk Level Alignment | UI risk badges (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) match `res.risk_level` and `res.decision_class`. | **VERIFIED** |
| 10 | GPR Forecast & 95% CI Display | GPR 168h forecast curve and $\pm 1.96\sigma_{total}$ shaded interval rendered via Plotly. | **VERIFIED** |
| 11 | Safety Slope Display | Safety slopes ($15\text{ nA/h}, 2\text{ nA/h}, 1\text{ ps/h}$) displayed with boundary status (`WITHIN`, `WARNING`, `EXCEEDED`). | **VERIFIED** |
| 12 | Risk Engine Precedence Display | Override rules (`CRITICAL` on Safety Exceeded) clearly highlighted in UI decision banner. | **VERIFIED** |
| 13 | Explainability Display | Feature attribution bars render `res.ml_details.explainability.attributions`. | **VERIFIED** |
| 14 | 5-Stage Decision Trace | Complete 5-stage trace (0h/24h Telemetry ➔ PAT/COPOD ➔ Calibrated GPR ➔ Safety Slope ➔ Multi-Criteria Risk Engine) rendered in Component Detail view. | **VERIFIED** |
| 15 | Engineering Units | All units ($V$, $mA$, $\mu A$, $nA$, $ps$, $ns$, $nA/h$, $ps/h$) accurately rendered. | **VERIFIED** |
| 16 | ISO Timestamps | ISO 8601 UTC timestamps rendered across timeline and event history tables. | **VERIFIED** |
| 17 | Trace ID Auditability | Unique `trace_id` (e.g. `PRED-2026-X8F9A2`) exposed on every detail view and downloadable log. | **VERIFIED** |
| 18 | Criteria Source Attribution | Displayed as `PROJECT_DEFINED_SCREENING_CRITERIA` in safety slope cards. | **VERIFIED** |
| 19 | Warning/Reject Status Clarity | Distinct visual styling (`SAFE` green, `MONITOR` yellow, `AT RISK` red) used throughout. | **VERIFIED** |
| 20 | Responsive Layout | Fluid CSS grid and flexbox layout verified across desktop ($>1200px$), tablet ($768-1024px$), and mobile ($<480px$). | **VERIFIED** |

---

## 2. End-to-End Data Lineage Flow

$$\mathbf{UI\ Component} \xrightarrow{\text{frontend/api.js}} \mathbf{HTTP\ REST\ Endpoint} \xrightarrow{\text{src/api/server.js}} \mathbf{5-Phase\ ML\ Engine} \xrightarrow{\text{src/api/inference.js}} \mathbf{PostgreSQL\ DB} \xrightarrow{\text{JSON\ Response}} \mathbf{Plotly/DOM\ Render}$$
