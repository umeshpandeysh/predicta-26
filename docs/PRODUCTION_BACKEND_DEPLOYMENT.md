# PREDICTA — SIH 2026 Deployment Hardening Guide (Phase 11)

**Date**: August 27, 2026  
**Project**: PREDICTA Semiconductor Test Analytics (SIH 2026 · Problem Statement 170)  
**Status**: DEPLOYMENT CONFIGURATION HARDENED  

---

## 1. Production Deployment Topology

```
                         [ Vercel Cloud Platform ]
                                     │
                 ┌───────────────────┴───────────────────┐
                 │                                       │
                 ▼                                       ▼
     [ Static Frontend CDN ]                  [ Serverless API Gateway ]
       (index.html, script.js)                      (api/index.js)
                 │                                       │
                 └───────────────────┬───────────────────┘
                                     │
                                     ▼
                      [ In-Process 5-Phase ML Engine ]
                      (src/api/inference.js + JSONs)
                                     │
                                     ▼
                     [ Supabase Cloud PostgreSQL DB ]
                     (prediction_runs & events tables)
```

---

## 2. Environment Variables Checklist

Set the following environment variables in your Vercel Project Settings:

| Environment Variable | Description | Example / Value |
|---|---|---|
| `SUPABASE_URL` | Supabase Cloud Database Endpoint URL | `https://your-project.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase Anonymous Client API Key | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key (Server-side) | `eyJhbGciOi...` |
| `NODE_ENV` | Production Environment Flag | `production` |

---

## 3. Pre-Deployment Verification Commands

Run locally before pushing to Vercel:
```bash
npm install
npm test
node scratch/verify_complete_backend.js
```
