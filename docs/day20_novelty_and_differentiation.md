# Predicta SIH 2026 — Day 20 Novelty & Differentiation Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## Technical Differentiation Pillars

### 1. Physics-Aware Domain Engineering
Unlike generic AutoML systems that evaluate raw features blindly, Predicta engineers 7 physical domain ratios (`voltage_headroom`, `leakage_fraction`, `power_per_current`, `normalized_timing_margin`, `frequency_delay_product`, `thermal_delta`) capturing physical transistor degradation mechanisms.

### 2. Equipment-Context Dual Encoding
Integrates 5 equipment one-hot binary channels (`eq_EQP-101` .. `105`) directly into the feature matrix, enabling the model to distinguish chamber-specific sensor offset drift from genuine semiconductor wafer defects.

### 3. 3-Zone Operational Triage Engine
Solves the industrial high-FPR dilemma by decoupling raw ML classification from operational action:
- **LOW RISK** ($P < 0.35$): Standard PASS routing.
- **REVIEW** ($0.35 \le P < 0.65$): Mandatory secondary ATE re-testing.
- **CRITICAL FAILURE** ($P \ge 0.65$): Immediate quarantine disposition.

### 4. Immutable ML Engine + Operator Lifecycle Audit Trail
Original ML predictions ($P$, PASS/FAIL) are locked and immutable. Operator actions and secondary test outcomes are stored in a separate, auditable state machine with unique trace IDs (`PRED-2026-XXXXXXXX`).
