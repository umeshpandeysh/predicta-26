# PREDICTA — Backend Security & Authentication Audit Report (Phase 2)

**Date**: August 27, 2026  
**Project**: PREDICTA Semiconductor Test Analytics (SIH 2026 · Problem Statement 170)  
**Status**: SECURITY AUDIT COMPLETE  

---

## 1. Endpoint Security Matrix

| Endpoint Path | Method | Access Level | Target Role | Auth Requirement | Rate Limit Tier |
|---|---|---|---|---|---|
| `/api/health` | `GET` | Public | Any | None | Standard (120 req/min) |
| `/api/system/status` | `GET` | Public | Any | None | Standard (120 req/min) |
| `/api/predict` | `POST` | Ingestion | Any / Telemetry | Optional Token / API Key | High (100 req/min) |
| `/api/predict/batch` | `POST` | Ingestion | Any / Telemetry | Optional Token / API Key | High (50 req/min) |
| `/api/prediction/detail` | `GET` | Public | Any | None | Standard (120 req/min) |
| `/api/dashboard/summary` | `GET` | Public | Any | None | Standard (120 req/min) |
| `/api/dashboard/recent` | `GET` | Public | Any | None | Standard (120 req/min) |
| `/api/dashboard/equipment` | `GET` | Public | Any | None | Standard (120 req/min) |
| `/api/dashboard/risk` | `GET` | Public | Any | None | Standard (120 req/min) |
| `/api/ate/status` | `GET` | Public | Any | None | Standard (120 req/min) |
| `/api/ate/simulate` | `POST` | Demo Ingestion | Any / Demo | None | Standard (60 req/min) |
| `/api/prediction/secondary-test/request` | `POST` | Protected Mutation | `OPERATOR`, `ADMIN` | Bearer Token / API Key | Strict (30 req/min) |
| `/api/prediction/secondary-test/complete` | `POST` | Protected Mutation | `OPERATOR`, `ADMIN` | Bearer Token / API Key | Strict (30 req/min) |
| `/api/prediction/disposition` | `POST` | Protected Mutation | `OPERATOR`, `ADMIN` | Bearer Token / API Key | Strict (30 req/min) |
| `/api/prediction/history` | `GET` | Audit Read | Any | None | Standard (120 req/min) |

---

## 2. Identified Vulnerabilities & Security Gaps

1. **Unprotected QA Workflow Mutations**: Previously, `/api/prediction/secondary-test/request`, `/complete`, and `/disposition` allowed any anonymous HTTP client to mutate component lifecycle state without token verification.
2. **Missing Rate Limiting**: Zero rate limiting existed, allowing rapid POST flooding.
3. **Missing Request Payload Limits**: Large body payloads could trigger memory spikes.
4. **Missing Security Headers**: Lacked standard security headers (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`).

---

## 3. Phase 2 Security Architecture Design

- **Role Hierarchy**:
  - `ANONYMOUS`: Can read dashboard analytics & submit telemetry predictions for demo.
  - `OPERATOR`: Can request/complete secondary ATE tests and record final QA dispositions.
  - `ADMIN`: Full system access, including configuration management.
- **Authentication Protocol**:
  - Checks `Authorization: Bearer <token>` or `X-API-Key: <key>` headers.
  - Validates JWT signature / token claims or demo API keys.
  - Exposes `req.user = { id: '...', role: 'OPERATOR', operator: 'ENGINEER_AZ' }`.
- **Response Codes**:
  - Missing token on protected endpoint ➔ `401 Unauthorized`
  - Invalid token / signature ➔ `401 Unauthorized`
  - Insufficient role ➔ `403 Forbidden`
  - Rate limit exceeded ➔ `429 Too Many Requests`
  - Payload too large ($> 2\text{MB}$) ➔ `413 Payload Too Large`
