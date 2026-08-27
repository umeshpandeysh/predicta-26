# PREDICTA — Backend API Architecture & Contract Audit Report (Phase 3)

**Date**: August 27, 2026  
**Project**: PREDICTA Semiconductor Test Analytics (SIH 2026 · Problem Statement 170)  
**Status**: API AUDIT & HARDENING COMPLETE  

---

## 1. Complete REST API Endpoint Inventory

| Endpoint Path | Method | Auth Level | Success Code | Conflict Code | Error Response Schema |
|---|---|---|---|---|---|
| `/api/health` | `GET` | Public | `200 OK` | N/A | Standard JSON |
| `/api/system/status` | `GET` | Public | `200 OK` | N/A | Standard JSON |
| `/api/predict` | `POST` | Ingestion | `200 OK` | `400 Bad Request` | Centralized API Error Format |
| `/api/predict/batch` | `POST` | Ingestion | `200 OK` | `400 Bad Request` | Centralized API Error Format |
| `/api/prediction/detail` | `GET` | Public | `200 OK` | `404 Not Found` | Centralized API Error Format |
| `/api/dashboard/summary` | `GET` | Public | `200 OK` | N/A | Standard JSON |
| `/api/dashboard/recent` | `GET` | Public | `200 OK` | N/A | Standard JSON |
| `/api/dashboard/equipment` | `GET` | Public | `200 OK` | N/A | Standard JSON |
| `/api/dashboard/risk` | `GET` | Public | `200 OK` | N/A | Standard JSON |
| `/api/ate/status` | `GET` | Public | `200 OK` | N/A | Standard JSON |
| `/api/ate/simulate` | `POST` | Demo | `200 OK` | `400 Bad Request` | Centralized API Error Format |
| `/api/prediction/secondary-test/request` | `POST` | `OPERATOR` | `201 Created` | `409 Conflict` | Centralized API Error Format |
| `/api/prediction/secondary-test/complete` | `POST` | `OPERATOR` | `200 OK` | `409 Conflict` | Centralized API Error Format |
| `/api/prediction/disposition` | `POST` | `OPERATOR` | `200 OK` | `409 Conflict` | Centralized API Error Format |
| `/api/prediction/history` | `GET` | Audit Read | `200 OK` | `404 Not Found` | Centralized API Error Format |

---

## 2. Standardized Central Error Response Format

All error responses across the API follow the unified schema:
```json
{
  "error": "CONFLICT",
  "detail": "Secondary test already requested for test_id 'SUPA-001'.",
  "status": 409,
  "timestamp": "2026-08-27T14:45:00.000Z",
  "trace_id": "PRED-2026-ERR-99"
}
```
