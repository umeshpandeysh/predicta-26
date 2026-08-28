# PREDICTA — PRODUCTION CONSISTENCY & REPRODUCIBILITY REPORT

## 1. Single Source of Truth Configuration Protocol
* **Authoritative Threshold Metadata**: `ml/models/predicta_xgboost_v2_metadata.json`
* **Configuration Key**: `"operating_threshold": 0.20`
* **Fail-Fast Policy**: Sourced dynamically at application startup by Node.js (`src/api/inference.js`) and Python (`src/api/inference_service.py`). Throws explicit `CONFIGURATION_ERROR` if missing or corrupted.

---

## 2. Certified Model SHA-256 Checksum Verification
* **Model File**: `ml/models/predicta_xgboost_v2.json`
* **SHA-256 Hash**: `2e7df9f1e2ad3cad66c1556e16e6b1694b167b6b04323387f761d4a1cda021ed`
* **Diff Status**: 0 bytes modified (**100% UNTOUCHED**)

---

## 3. End-to-End Inference Traceability
Every prediction event emits a unified JSON contract containing:
* `test_id` & `trace_id` (`X-Trace-ID` header)
* `prediction` (`PASS` / `FAIL`)
* `probability` (e.g. `0.9991`)
* `threshold` (`0.20`)
* `operational_decision` (`PASS` / `SECONDARY_TEST` / `FAIL`)
* `decision_class` (`LOW_RISK` / `REVIEW` / `CRITICAL_FAILURE`)
* `risk_level` (`LOW` / `MEDIUM` / `HIGH` / `CRITICAL`)
* `explanation` (Physics root cause & key indicators)
