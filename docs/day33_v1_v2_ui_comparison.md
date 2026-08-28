# Predicta Day 33 — Model Comparison UI Specification

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. Model Comparison UI Layout Specification

```text
┌─────────────────────────────────────────────────────────────┐
│ INDUSTRIAL TEST RESULT WORKSTATION                          │
├─────────────────────────────────────────────────────────────┤
│ PRODUCTION MODEL (ACTIVE)                                   │
│ Predicta XGBoost V1                                         │
│                                                             │
│ FAIL PROBABILITY                    99.9%                   │
│ OPERATIONAL DECISION               🔴 CRITICAL FAIL         │
│ TRACE ID                           PRED-2026-XXXXXXXX       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ 🔬 RESEARCH SHADOW MODEL (V2)        SHADOW ● NON-BLOCKING  │
│                                                             │
│ SHADOW PROBABILITY                 99.5%                    │
│ V1/V2 DELTA                        -0.4 pp                  │
│ SHADOW CLASSIFICATION              FAIL                     │
│                                                             │
│ RESEARCH SHADOW — NOT USED FOR DECISION                     │
└─────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **EXPLICIT NON-INTERFERENCE**: The Research Shadow V2 block is explicitly styled with a blue technical outline and explicit disclaimer (`RESEARCH SHADOW — NOT USED FOR DECISION`). An operator or technical reviewer cannot confuse research outputs with production decisions.
