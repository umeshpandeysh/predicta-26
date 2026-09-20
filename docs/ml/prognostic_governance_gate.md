# PREDICTA Stage 6 Task 4 — Prognostic Governance Gate Review

## Purpose
The Prognostic Governance Gate Review is an auditable, deterministic governance evaluator that aggregates evidence produced by Stage 6 Task 1 (Conformal Calibration), Task 2 (Human Disposition Governance), and Task 3 (Multi-Lot Stability Evaluation).

> [!IMPORTANT]
> This review evaluates governance evidence completeness and cryptographic provenance. It **DOES NOT** grant production authorization, production approval, calibration certification, or external/fab/flight qualification.

---

## Authoritative Evidence Sources & Cryptographic Provenance

| Evidence Component | Path | SHA-256 Expectation |
|---|---|---|
| Dataset Manifest | `ml/data/dataset_manifest.json` | `e2b969c458864b11ed61a6073ed1356adcbfd6775bb2c44b28023446bf9771fa` |
| Split Manifest | `ml/data/split_manifest.json` | `1764dff377386bf41f95f9bb96afb71dd01404bf65bdec9e324ba31afcf7a8dd` |
| Production Model Artifact | `ml/models/production/predicta_xgboost_model.json` | `91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98` |
| Calibration Artifact | `ml/models/production/conformal_calibration_artifacts.json` | `198eaa50f5af96aa85721f168abc947a6cabfc02d91f77d1a032c343f85e7e7e` |
| Task 1 Calibration Report | `experiments/prognostics/conformal_calibration_report.json` | Structure & governance status verified |
| Task 2 Disposition Contract | `ml/governance/disposition_contract.json` | Immutability & identity rejection rules verified |
| Task 3 Stability Report | `experiments/prognostics/multi_lot_conformal_stability_report.json` | 8 test lots (LOT-SYN-043..050) evaluated |

---

## 18 Governance Checks

1. **GOV-001 Dataset Provenance:** Dataset SHA-256 matches `e2b969c4...`, `is_synthetic=true`, `is_externally_validated=false`.
2. **GOV-002 Split Provenance:** Actual SHA-256 computed from `split_manifest.json` bytes matches `1764dff3...`.
3. **GOV-003 Model Provenance:** Dynamic path resolution from production manifest; model artifact file SHA-256 matches `91bb598a...`.
4. **GOV-004 Calibration Artifact Provenance:** Calibration specification SHA-256 matches `198eaa50...`.
5. **GOV-005 Task 1 Calibration Evidence:** Report present, `status=NOT_CALIBRATED`, `model_status=BENCHMARK_ONLY`.
6. **GOV-006 Task 1 Leakage/Security:** `hyperparameters_frozen=true`, 0 lot overlap between calibration, train, and test sets.
7. **GOV-007 Task 2 Authoritative Identity:** `identity_policy=REJECT_CLIENT_IDENTIFIERS`, `component_id` & `lot_id` in prohibited fields.
8. **GOV-008 Task 2 Append-Only History:** `storage_policy=APPEND_ONLY_HISTORY`, `original_ml_decision_immutable=true`.
9. **GOV-009 Task 2 Human-Disposition Semantics:** Disclaimer states dispositions are NOT ground truth; `ground_truth` prohibited.
10. **GOV-010 Task 3 Multi-Lot Stability Evidence:** All 8 held-out test lots evaluated (`LOT-SYN-043` through `LOT-SYN-050`).
11. **GOV-011 Task 3 Provenance Validation:** Split manifest SHA and model SHA recorded in Task 3 report match expected values.
12. **GOV-012 Task 3 Unsupported Horizon Accounting:** Horizons 48h, 72h, 120h, 144h marked `DATA_UNAVAILABLE`; 24h marked `NOT_EVALUATED`.
13. **GOV-013 Python/Node Parity:** Dual-language evaluators produce identical evidence completeness and governance results.
14. **GOV-014 Test Isolation:** `test_tuning_permitted=false`, `arbitrary_threshold_permitted=false` enforced.
15. **GOV-015 Production Threshold Governance:** Threshold status remains `NO_PRODUCTION_ACCEPTANCE_THRESHOLD_AUTHORIZED`.
16. **GOV-016 Production Promotion Lock:** `promotion_locked=true`, `production_promotion_permitted=false`.
17. **GOV-017 Synthetic-Data Limitation:** Explicitly flags all telemetry as synthetic simulation data.
18. **GOV-018 External/Fab Validation Status:** `is_externally_validated=false`, no fab or flight qualification claimed.

---

## Terminal Governance State

Regardless of evidence check outcomes:
- **`governance_status`:** `REVIEW_REQUIRED`
- **`model_status`:** `BENCHMARK_ONLY`
- **`calibration_status`:** `NOT_CALIBRATED`
- **`promotion_locked`:** `true`
- **`production_promotion_permitted`:** `false`
- **`acceptance_threshold_status`:** `NO_PRODUCTION_ACCEPTANCE_THRESHOLD_AUTHORIZED`

---

## Verification & Execution

To execute the governance gate review and run behavioral tests:
```bash
npm run evaluate:prognostics:governance
```
Or via Python directly:
```bash
python -m pytest tests/test_governance_gate.py -v
python src/prognostics/evaluate_governance_gate.py
```
