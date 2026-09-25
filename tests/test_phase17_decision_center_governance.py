"""
PREDICTA-26 Phase 17.1 — Governed Decision Center & Taxonomy Mapping Test Suite (Python)
File: tests/test_phase17_decision_center_governance.py

Verifies the 10 required Phase 17.1 verification criteria:
1. Four UI disposition actions exist (PASS, MONITOR, RETEST, REJECT).
2. ML prediction cannot be modified by human disposition.
3. ML probability remains immutable.
4. Missing evidence displays INSUFFICIENT EVIDENCE (fail-closed).
5. Controlled reason is required.
6. Invalid disposition is rejected.
7. Existing backend governance remains authoritative (ACCEPT, HOLD, RETEST, REJECT, ESCALATE).
8. Existing audit events remain intact.
9. Production threshold remains unchanged (theta* = 0.20).
10. No production model or dataset files are modified (cryptographic SHA-256 validation).

PLUS:
- Semantically loss-protected ESCALATE mapping with explicit escalation indicator.
- Provenance lead time basis: 168H_EVALUATION_HORIZON_NOT_FAILURE_TIME.
"""

import hashlib
import os
import pytest

from src.governance.taxonomy_mapping import (
    UI_ACTION_TAXONOMY,
    BACKEND_DISPOSITION_TAXONOMY,
    REASON_CODE_TAXONOMY,
    LEAD_TIME_BASIS,
    INSUFFICIENT_EVIDENCE_STATUS,
    OPERATING_THRESHOLD,
    load_taxonomy_contract,
    map_ui_to_backend_disposition,
    map_backend_to_ui_disposition,
    validate_governed_action,
    derive_operational_recommendation,
    format_evidence_explainer_layers,
)
from src.governance.disposition import (
    HumanDispositionManager,
    register_authoritative_prediction,
)

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PROD_MODEL_PATH = os.path.join(PROJECT_ROOT, "ml", "models", "production", "predicta_xgboost_model.json")
PROD_DATASET_PATH = os.path.join(PROJECT_ROOT, "ml", "data", "synthetic", "predicta_dataset_v3_50000.csv")

EXPECTED_MODEL_SHA = "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"
EXPECTED_DATASET_SHA = "48e718643b6fe99bc410421f5b48715c294f1c4c2edabf10870935afdb820a06"


def compute_sha256(path: str) -> str:
    with open(path, "rb") as f:
        content = f.read().replace(b"\r\n", b"\n")
    return hashlib.sha256(content).hexdigest()


# --------------------------------------------------------------------------
# CRITERION 1: Four UI disposition actions exist
# --------------------------------------------------------------------------
def test_criterion_01_four_ui_disposition_actions_exist():
    assert len(UI_ACTION_TAXONOMY) == 4
    assert set(UI_ACTION_TAXONOMY) == {"PASS", "MONITOR", "RETEST", "REJECT"}

    contract = load_taxonomy_contract()
    contract_ui_actions = contract["layers"]["ui_action_layer"]["values"]
    assert set(contract_ui_actions) == {"PASS", "MONITOR", "RETEST", "REJECT"}

    # Test bidirectional mappings
    for action in UI_ACTION_TAXONOMY:
        backend_disp = map_ui_to_backend_disposition(action)
        assert backend_disp in BACKEND_DISPOSITION_TAXONOMY
        ui_res = map_backend_to_ui_disposition(backend_disp)
        assert ui_res["ui_action"] == action


# --------------------------------------------------------------------------
# CRITERION 2: ML prediction cannot be modified by human disposition
# --------------------------------------------------------------------------
def test_criterion_02_ml_prediction_cannot_be_modified_by_disposition():
    mgr = HumanDispositionManager()
    trace_id = "TRACE-P17-IMMUT-001"
    original_pred = "FAIL"
    original_prob = 0.842

    register_authoritative_prediction({
        "trace_id": trace_id,
        "component_id": "COMP-17-001",
        "lot_id": "LOT-17-A",
        "prediction": original_pred,
        "probability": original_prob,
    })

    # Operator records PASS (maps to ACCEPT)
    backend_disp = map_ui_to_backend_disposition("PASS")
    res = mgr.record_disposition(
        trace_id=trace_id,
        disposition=backend_disp,
        reason_code="FALSE_POSITIVE_SUSPECTED",
        comment="Operator overrides to PASS based on clean physical retest."
    )

    # ML decision stored in disposition record must remain strictly FAIL
    assert res["original_ml_decision"] == original_pred
    assert res["disposition"] == "ACCEPT"

    # Lookup authoritative prediction again - must remain FAIL
    auth_rec = mgr.lookup_authoritative_prediction(trace_id)
    assert auth_rec["prediction"] == original_pred
    assert auth_rec["probability"] == original_prob


# --------------------------------------------------------------------------
# CRITERION 3: ML probability remains immutable
# --------------------------------------------------------------------------
def test_criterion_03_ml_probability_remains_immutable():
    mgr = HumanDispositionManager()
    trace_id = "TRACE-P17-PROB-002"
    orig_prob = 0.0415

    register_authoritative_prediction({
        "trace_id": trace_id,
        "component_id": "COMP-17-002",
        "lot_id": "LOT-17-B",
        "prediction": "PASS",
        "probability": orig_prob,
    })

    # Multiple operator actions
    for action in ["MONITOR", "RETEST", "REJECT"]:
        backend_disp = map_ui_to_backend_disposition(action)
        mgr.record_disposition(
            trace_id=trace_id,
            disposition=backend_disp,
            reason_code="MANUAL_ENGINEERING_REVIEW",
            comment="Successive human disposition evaluations"
        )

    # Verified probability remains exactly 0.0415
    auth_rec = mgr.lookup_authoritative_prediction(trace_id)
    assert auth_rec["probability"] == orig_prob


# --------------------------------------------------------------------------
# CRITERION 4: Missing evidence displays INSUFFICIENT EVIDENCE
# --------------------------------------------------------------------------
def test_criterion_04_missing_evidence_displays_insufficient_evidence():
    # Empty evidence input
    layers = format_evidence_explainer_layers({})

    assert layers["lot_deviation"]["status"] == INSUFFICIENT_EVIDENCE_STATUS
    assert layers["lot_deviation"]["has_evidence"] is False

    assert layers["trajectory_drift"]["status"] == INSUFFICIENT_EVIDENCE_STATUS
    assert layers["trajectory_drift"]["has_evidence"] is False

    assert layers["prognostic_forecast_168h"]["status"] == INSUFFICIENT_EVIDENCE_STATUS
    assert layers["prognostic_forecast_168h"]["has_evidence"] is False

    assert layers["uncertainty_envelope"]["status"] == INSUFFICIENT_EVIDENCE_STATUS
    assert layers["uncertainty_envelope"]["has_evidence"] is False

    assert layers["physics_consistency"]["status"] == INSUFFICIENT_EVIDENCE_STATUS
    assert layers["physics_consistency"]["has_evidence"] is False

    assert layers["risk_contribution"]["status"] == INSUFFICIENT_EVIDENCE_STATUS
    assert layers["risk_contribution"]["has_evidence"] is False

    # Lead time basis is preserved and zero-fabricated
    assert layers["prognostic_forecast_168h"]["lead_time_basis"] == LEAD_TIME_BASIS


# --------------------------------------------------------------------------
# CRITERION 5: Controlled reason is required
# --------------------------------------------------------------------------
def test_criterion_05_controlled_reason_is_required():
    # Missing reason code must fail
    with pytest.raises(ValueError, match="REASON_CODE_REQUIRED"):
        validate_governed_action("PASS", "")

    # Invalid reason code must fail
    with pytest.raises(ValueError, match="INVALID_REASON_CODE"):
        validate_governed_action("PASS", "UNAPPROVED_CUSTOM_REASON")

    # Valid reason code succeeds
    for code in REASON_CODE_TAXONOMY:
        res = validate_governed_action("RETEST", code, comment="Automated test validation")
        assert res["is_valid"] is True
        assert res["reason_code"] == code


# --------------------------------------------------------------------------
# CRITERION 6: Invalid disposition is rejected
# --------------------------------------------------------------------------
def test_criterion_06_invalid_disposition_is_rejected():
    invalid_actions = ["APPROVE", "QUARANTINE", "IGNORE", "OVERRIDE", "UNKNOWN", ""]
    for bad in invalid_actions:
        with pytest.raises(ValueError, match="INVALID_UI_ACTION"):
            map_ui_to_backend_disposition(bad)

    with pytest.raises(ValueError, match="INVALID_BACKEND_DISPOSITION"):
        map_backend_to_ui_disposition("INVALID_STATE")


# --------------------------------------------------------------------------
# CRITERION 7: Existing backend governance remains authoritative
# --------------------------------------------------------------------------
def test_criterion_07_backend_governance_remains_authoritative():
    # Verify authoritative backend taxonomy
    assert set(BACKEND_DISPOSITION_TAXONOMY) == {"ACCEPT", "REJECT", "HOLD", "RETEST", "ESCALATE"}

    # Test ESCALATE mapping retains explicit escalation indicator (loss protection)
    escalate_ui = map_backend_to_ui_disposition("ESCALATE")
    assert escalate_ui["ui_action"] == "MONITOR"
    assert escalate_ui["escalation_flag"] is True
    assert escalate_ui["escalation_indicator"] == "ESCALATED_TO_QUALITY_ENGINEERING"
    assert "ESCALATED" in escalate_ui["display_label"]

    # Other states do not have escalation flag
    hold_ui = map_backend_to_ui_disposition("HOLD")
    assert hold_ui["ui_action"] == "MONITOR"
    assert hold_ui["escalation_flag"] is False
    assert hold_ui["escalation_indicator"] is None


# --------------------------------------------------------------------------
# CRITERION 8: Existing audit events remain intact
# --------------------------------------------------------------------------
def test_criterion_08_existing_audit_events_remain_intact():
    from src.governance.disposition import _AUDIT_LOGS, record_audit_event

    initial_count = len(_AUDIT_LOGS)
    test_event = record_audit_event("PHASE_17_TEST_EVENT", {
        "component_id": "TEST-AUDIT-01",
        "action": "VERIFY_AUDIT_LOG_APPEND_ONLY"
    })

    assert len(_AUDIT_LOGS) == initial_count + 1
    assert test_event["event_type"] == "PHASE_17_TEST_EVENT"
    assert test_event["event_id"].startswith("AUDIT-")
    assert "timestamp" in test_event


# --------------------------------------------------------------------------
# CRITERION 9: Production threshold remains unchanged (theta* = 0.20)
# --------------------------------------------------------------------------
def test_criterion_09_production_threshold_remains_0_20():
    assert abs(OPERATING_THRESHOLD - 0.20) < 1e-6

    # Operational recommendations respect theta* = 0.20
    assert derive_operational_recommendation("PASS", 0.05) == "PASS"
    assert derive_operational_recommendation("PASS", 0.15) == "MONITOR"
    assert derive_operational_recommendation("PASS", 0.20) == "REJECT"
    assert derive_operational_recommendation("PASS", 0.85) == "REJECT"
    assert derive_operational_recommendation("FAIL", 0.05) == "REJECT"


# --------------------------------------------------------------------------
# CRITERION 10: No production model or dataset files are modified
# --------------------------------------------------------------------------
def test_criterion_10_no_production_model_or_dataset_files_modified():
    actual_model_sha = compute_sha256(PROD_MODEL_PATH)
    assert actual_model_sha == EXPECTED_MODEL_SHA, f"Model SHA mismatch: {actual_model_sha} != {EXPECTED_MODEL_SHA}"

    actual_dataset_sha = compute_sha256(PROD_DATASET_PATH)
    assert actual_dataset_sha == EXPECTED_DATASET_SHA, f"Dataset SHA mismatch: {actual_dataset_sha} != {EXPECTED_DATASET_SHA}"
