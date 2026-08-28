# AUDIT-FIX-04: API ATTACK SURFACE INVENTORY & CONTRACT REPORT

## Executive Overview
This document details the complete API attack surface inventory for PREDICTA (Production 2026 Semiconductor Telemetry Requirements), covering all 10 production endpoints, authentication guards, payload validators, database interactions, and error response contracts.

---

## Endpoint Inventory Table

| Endpoint Path | HTTP Method | Auth Level | Rate Limit Tier | DB Interactions | Input Schema Summary | Response Status Codes |
|---|---|---|---|---|---|---|
| `/api/health` | GET | Public | STANDARD | Read (Summary) | None | 200 OK |
| `/api/system/status` | GET | Public | STANDARD | Read (Internal) | None | 200 OK |
| `/api/predict` | POST | Public | HIGH | Write (Predictions) | Single Telemetry Record JSON | 200 OK, 400 Bad Req, 413 Too Large, 429 Too Many Req |
| `/api/predict/batch` | POST | Public | HIGH | Write (Batch) | Array of Telemetry Records JSON | 200 OK, 400 Bad Req, 413 Too Large, 429 Too Many Req |
| `/api/prediction/detail` | GET | Public | STANDARD | Read (By Trace ID) | `?id=<trace_id>` Query Param | 200 OK, 404 Not Found |
| `/api/dashboard/summary` | GET | Public | STANDARD | Read (Aggregates) | None | 200 OK |
| `/api/dashboard/recent` | GET | Public | STANDARD | Read (History) | `?limit=<n>` Query Param | 200 OK |
| `/api/dashboard/equipment` | GET | Public | STANDARD | Read (Equipment) | None | 200 OK |
| `/api/dashboard/risk` | GET | Public | STANDARD | Read (Risk) | None | 200 OK |
| `/api/prediction/secondary-test/request` | POST | `OPERATOR` / `ADMIN` | STRICT | Write (Lifecycle) | `{ test_id, comments }` JSON | 201 Created, 401 Unauth, 403 Forbidden, 409 Conflict |
| `/api/prediction/secondary-test/complete` | POST | `OPERATOR` / `ADMIN` | STRICT | Write (Lifecycle) | `{ test_id, secondary_result, comments }` | 200 OK, 401 Unauth, 403 Forbidden, 409 Conflict |
| `/api/prediction/disposition` | POST | `OPERATOR` / `ADMIN` | STRICT | Write (Lifecycle) | `{ test_id, disposition, comments }` | 200 OK, 401 Unauth, 403 Forbidden, 409 Conflict |

---

## Security Headers & Middleware Guards

Every response processed by `src/api/server.js` automatically receives hardened HTTP security headers:
* `Content-Security-Policy`: Restricts script, style, frame, and connect sources (`frame-ancestors 'none'`, `object-src 'none'`)
* `Strict-Transport-Security`: `max-age=31536000; includeSubDomains; preload`
* `X-Content-Type-Options`: `nosniff`
* `X-Frame-Options`: `DENY`
* `X-XSS-Protection`: `1; mode=block`
* `Referrer-Policy`: `strict-origin-when-cross-origin`
* `Permissions-Policy`: `camera=(), microphone=(), geolocation=(), payment=()`
