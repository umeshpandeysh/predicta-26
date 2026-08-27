# PREDICTA — Backend Database Hardening Audit Report (Phase 5)

**Date**: August 27, 2026  
**Project**: PREDICTA Semiconductor Test Analytics (SIH 2026 · Problem Statement 170)  
**Status**: DATABASE HARDENING COMPLETE  

---

## 1. Schema Constraints & Relationship Graph

```
┌──────────────────────────────────────┐
│       public.prediction_runs         │
├──────────────────────────────────────┤
│ id (UUID, PRIMARY KEY)               │
│ trace_id (TEXT, UNIQUE, INDEXED)     │
│ test_id (TEXT, INDEXED)              │
│ equipment_id (TEXT)                  │
│ prediction (TEXT)                    │
│ probability (DOUBLE PRECISION)       │
│ risk_level (TEXT)                    │
│ lifecycle_state (TEXT, INDEXED)      │
│ ml_details (JSONB)                   │
│ event_history (JSONB)                │
└──────────────────┬───────────────────┘
                   │ 1
                   │
                   │ N (FOREIGN KEY ON DELETE CASCADE)
                   ▼
┌──────────────────────────────────────┐
│      public.prediction_events        │
├──────────────────────────────────────┤
│ id (UUID, PRIMARY KEY)               │
│ prediction_id (UUID, REFERENCES)     │
│ trace_id (TEXT, INDEXED)             │
│ event_type (TEXT)                    │
│ previous_state (TEXT)                │
│ new_state (TEXT)                     │
│ operator (TEXT)                      │
│ details (TEXT)                       │
└──────────────────────────────────────┘
```

---

## 2. Migration Safety Guarantees

- **No Destructive Operations**: Schema updates use `IF NOT EXISTS` constructs exclusively.
- **Trace ID Uniqueness**: Enforces `CONSTRAINT unique_prediction_runs_trace_id UNIQUE (trace_id)`.
- **Event Provenance**: Events strictly reference existing `prediction_id` parent rows.
