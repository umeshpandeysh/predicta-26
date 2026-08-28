# Predicta Production 2026 — Day 14 Full System Integrity Audit Report

Version: `2.0_production`  
Operating Threshold: `0.45` (STRICTLY PRESERVED)  

---

## 1. System Audit Status Summary

| Audit Domain | Status | Key Findings & Evidence |
| :--- | :--- | :--- |
| **ML ↔ Inference Feature Engineering** | **PASS** | 28 features (16 raw, 7 engineered, 5 equipment OHE) formulaically match across Node, Python, and Metadata. |
| **28-Feature Formula & Unit Consistency** | **PASS** | `leakage_fraction` unit scaling `(iLeak * 1e-3) / iTot` verified. `voltage_headroom`, `voltage_utilization`, `power_per_current`, `normalized_timing_margin`, `frequency_delay_product`, `thermal_delta` match. |
| **Golden Record Test** | **PASS** | `DAY14-GOLDEN-001` generates 100% equivalent 28-feature vectors and probabilities across Node.js and Python. |
| **Node.js ↔ Python Service Parity** | **PASS** | `src/api/inference.js` and `src/api/inference_service.py` yield deterministic predictions at threshold `0.45`. |
| **Model Artifact Integrity** | **PASS** | SHA-256 hash `65A8B34C013CB60D900009EFD09FA4A79B56AED02F07BF0511360086C4547C3D` verified 100% unchanged before and after tests. |
| **Threshold Consistency** | **PASS** | Single authoritative operating threshold `0.45` enforced across Node, Python, and Frontend. |
| **Locked Test FPR Discrepancy Analysis** | **EXPLAINED (SCIENTIFIC AUDIT)** | Locked test set achieved **87.70% FAIL recall** (satisfying $\ge 85\%$ target), but produced **39.15% FPR** due to high `scale_pos_weight` (6.7413) and process/equipment drift on unseen test wafers. |
| **Frontend ↔ Production API Integration** | **PASS** | Telemetry inputs map 1-to-1. Dynamic origin resolution points to `https://ceenew.vercel.app/api` on Vercel. |
| **API ↔ Supabase Persistence** | **PASS** | `prediction_runs`, `prediction_indicators`, `batch_runs`, `dashboard_events` schema verified with graceful fallback. |
| **Supabase ↔ Dashboard Analytics** | **PASS** | Live endpoints `/api/dashboard/summary`, `/recent`, `/equipment`, `/risk` stream real database metrics to workstation cards. |
| **Offline Mode UI Safety** | **PASS** | When offline, UI explicitly displays `ML ENGINE OFFLINE (Local Mode Active)`. |
| **Error Handling & Robustness** | **PASS** | NaN, Infinity, oversized batches ($N > 1000$), missing numerical features, and invalid equipment IDs rejected with clear HTTP errors. |
| **Security & Credential Isolation** | **PASS** | 100% clean. Zero committed secrets or service-role keys in frontend JavaScript or Git history. |
| **Automated Regression Suite** | **PASS** | **44/44 Test Cases Passed (100% Pass Rate)** across 6 test suites. |
| **Live Production Verification** | **PASS** | Live HTTPS probes to `https://ceenew.vercel.app` returned HTTP 200 OK. |

---

## 2. Locked Test FPR Discrepancy Technical Analysis

### Empirical Observation:
- **Validation Set (Tuning)**: Recall = **86.49%**, FPR = **14.20%**
- **Locked Test Set (Evaluation)**: Recall = **87.70%**, FPR = **39.15%**

### Root Cause Analysis:
1. **High Positive Class Imbalance Weighting (`scale_pos_weight = 6.7413`)**:
   Training configured a high loss penalty on missed defects to guarantee catastrophic failure detection.
2. **Conservative Operating Threshold (`0.45`)**:
   Operating at threshold `0.45` forces an aggressive screening posture, yielding 100% recall on `TIMING_FAILURE` and 97.11% recall on `THERMAL_ANOMALY`.
3. **Distribution Shift on Unseen Wafers**:
   Unseen test wafers exhibited equipment drift and borderline process variations, causing borderline PASS wafers to cross the `0.45` threshold, resulting in 3,406 false positives (39.15% FPR out of 8,699 actual PASS wafers).

### Scientific Verdict:
*"The model satisfies the FAIL recall target ($87.70\% \ge 85\%$) on the locked test set, but does NOT satisfy the $\le 15\%$ FPR operational target on unseen test wafers."*

---

## 3. Production 2026 Prototype Readiness Verdict

**release readiness: READY WITH WARNINGS**
- **Ready**: End-to-end pipeline (Telemetry $\to$ Vercel API $\to$ Frozen Model $\to$ Supabase $\to$ Workstation UI) is 100% functional, secure, and passing 44/44 regression tests.
- **Warning**: Operational yield screening on unseen wafers carries a $39.15\%$ False Positive Rate due to high sensitivity settings, which should be highlighted transparently during technical technical evaluation.
