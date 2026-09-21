"""
PREDICTA — PHASE 11 TASK 1 HUMAN FEEDBACK GOVERNANCE FOUNDATION TEST SUITE (Python)
File: tests/test_phase11_task1_governance.py

Verifies Python implementation parity for:
1. Contract version 1.1.0 & lifecycle state transitions (RECORDED_ONLY -> PENDING_OUTCOME -> CONFIRMED / CONTRADICTED / UNRESOLVED)
2. Backend-authoritative prediction & identity resolution
3. Rejection of client-controlled ML outputs, snapshots, and identity overrides
4. Conflict detection for multiple operator dispositions on the same trace
5. Fail-closed durable persistence behavior
6. Hard governance invariants (no retraining, no threshold modification, dataset isolation)
"""

import os
import pytest
from src.governance.disposition import (
    HumanDispositionManager,
    register_authoritative_prediction,
    DISPOSITION_CONTRACT_PATH,
    PROD_MANIFEST_PATH,
    MODEL_JSON_PATH
)

EXPECTED_MODEL_SHA = "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"
EXPECTED_THRESHOLD = 0.20


@pytest.fixture
def manager():
    return HumanDispositionManager()


def test_01_contract_version_and_lifecycle_statuses(manager):
    assert manager.contract["contract_version"] == "1.1.0"
    statuses = manager.allowed_feedback_statuses
    for s in ["RECORDED_ONLY", "PENDING_OUTCOME", "CONFIRMED", "CONTRADICTED", "UNRESOLVED"]:
        assert s in statuses


def test_02_valid_disposition_and_default_lifecycle_state(manager):
    sample_trace_id = "TRACE-PY-P11-001"
    register_authoritative_prediction({
        "trace_id": sample_trace_id,
        "component_id": "COMP-PY-P11-101",
        "lot_id": "LOT-SYN-045",
        "prediction": "FAIL",
        "probability": 0.88,
        "anomaly_status": "NORMAL",
        "prognostic_summary": "NOMINAL_168H"
    })

    res = manager.record_disposition(
        trace_id=sample_trace_id,
        disposition="HOLD",
        reason_code="FALSE_POSITIVE_SUSPECTED",
        comment="Suspect thermal noise during test run."
    )

    assert res["disposition_id"].startswith("DISP-")
    assert res["trace_id"] == sample_trace_id
    assert res["component_id"] == "COMP-PY-P11-101"
    assert res["lot_id"] == "LOT-SYN-045"
    assert res["disposition"] == "HOLD"
    assert res["reason_code"] == "FALSE_POSITIVE_SUSPECTED"
    assert res["original_ml_decision"] == "FAIL"
    assert res["original_ml_probability"] == 0.88
    assert res["feedback_status"] == "RECORDED_ONLY"
    assert res["conflict"] is False


def test_03_valid_lifecycle_transitions(manager):
    sample_trace_id = "TRACE-PY-P11-002"
    register_authoritative_prediction({
        "trace_id": sample_trace_id,
        "component_id": "COMP-PY-P11-102",
        "lot_id": "LOT-SYN-045",
        "prediction": "FAIL",
        "probability": 0.79
    })

    res = manager.record_disposition(
        trace_id=sample_trace_id,
        disposition="RETEST",
        reason_code="RETEST_REQUIRED"
    )
    disp_id = res["disposition_id"]

    # Transition to PENDING_OUTCOME
    u1 = manager.update_feedback_status(sample_trace_id, disp_id, "PENDING_OUTCOME", comment="Awaiting re-test")
    assert u1["feedback_status"] == "PENDING_OUTCOME"

    # Transition to CONFIRMED
    u2 = manager.update_feedback_status(sample_trace_id, disp_id, "CONFIRMED", comment="Re-test confirmed failure")
    assert u2["feedback_status"] == "CONFIRMED"

    # Invalid transition from CONFIRMED -> PENDING_OUTCOME
    with pytest.raises(ValueError, match="INVALID_LIFECYCLE_TRANSITION"):
        manager.update_feedback_status(sample_trace_id, disp_id, "PENDING_OUTCOME")


def test_04_multiple_operator_dispositions_and_conflict_flag(manager):
    trace_id = "TRACE-PY-CONFLICT"
    register_authoritative_prediction({
        "trace_id": trace_id,
        "component_id": "COMP-PY-P11-103",
        "lot_id": "LOT-SYN-045",
        "prediction": "FAIL",
        "probability": 0.74
    })

    # Operator A submits ACCEPT
    op_a = manager.record_disposition(
        trace_id=trace_id,
        disposition="ACCEPT",
        reason_code="FALSE_POSITIVE_SUSPECTED",
        operator_id="OPERATOR_A"
    )
    assert op_a["disposition"] == "ACCEPT"
    assert op_a["conflict"] is False

    # Operator B submits REJECT
    op_b = manager.record_disposition(
        trace_id=trace_id,
        disposition="REJECT",
        reason_code="MANUAL_ENGINEERING_REVIEW",
        operator_id="OPERATOR_B"
    )
    assert op_b["disposition"] == "REJECT"
    assert op_b["conflict"] is True

    # Summary lookup
    summary = manager.get_disposition(trace_id)
    assert summary["total_dispositions"] == 2
    assert summary["has_conflict"] is True
    assert summary["conflict"] is True
    assert summary["history"][0]["disposition"] == "ACCEPT"
    assert summary["history"][1]["disposition"] == "REJECT"
    assert summary["history"][0]["original_ml_decision"] == "FAIL"
    assert summary["history"][1]["original_ml_decision"] == "FAIL"


def test_05_security_rejection_of_client_controlled_fields(manager):
    sample_trace = "TRACE-PY-P11-SEC"
    register_authoritative_prediction({
        "trace_id": sample_trace,
        "component_id": "COMP-PY-SEC",
        "lot_id": "LOT-SYN-045",
        "prediction": "PASS",
        "probability": 0.05
    })

    # Client-injected probability
    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED"):
        manager.record_disposition(trace_id=sample_trace, disposition="ACCEPT", reason_code="OTHER", probability=0.99)

    # Client-injected ML decision
    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED"):
        manager.record_disposition(trace_id=sample_trace, disposition="ACCEPT", reason_code="OTHER", ml_decision="FAIL")

    # Client-injected model hash
    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED"):
        manager.record_disposition(trace_id=sample_trace, disposition="ACCEPT", reason_code="OTHER", model_hash="fake")

    # Client-injected anomaly score
    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED"):
        manager.record_disposition(trace_id=sample_trace, disposition="ACCEPT", reason_code="OTHER", anomaly_score=1.0)

    # Client-injected prognostic output
    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED"):
        manager.record_disposition(trace_id=sample_trace, disposition="ACCEPT", reason_code="OTHER", prognostic_output="CRITICAL")

    # Client-injected ground truth
    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED"):
        manager.record_disposition(trace_id=sample_trace, disposition="ACCEPT", reason_code="OTHER", ground_truth=1)

    # Client-injected component ID
    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_IDENTITY_PROHIBITED"):
        manager.record_disposition(trace_id=sample_trace, disposition="ACCEPT", reason_code="OTHER", component_id="COMP-FAKE")

    # Client-injected lot ID
    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_IDENTITY_PROHIBITED"):
        manager.record_disposition(trace_id=sample_trace, disposition="ACCEPT", reason_code="OTHER", lot_id="LOT-FAKE")

    # Unauthorized role
    with pytest.raises(PermissionError, match="UNAUTHORIZED_ROLE"):
        manager.record_disposition(trace_id=sample_trace, disposition="ACCEPT", reason_code="OTHER", operator_role="GUEST")


def test_06_persistence_fails_closed(manager):
    sample_trace = "TRACE-PY-PERSIST"
    register_authoritative_prediction({
        "trace_id": sample_trace,
        "component_id": "COMP-PY-PERSIST",
        "lot_id": "LOT-SYN-045",
        "prediction": "PASS",
        "probability": 0.02
    })

    # When require_durable_persistence=True and db_client is None -> fails closed with RuntimeError
    with pytest.raises(RuntimeError, match="PERSISTENCE_ERROR"):
        manager.record_disposition(
            trace_id=sample_trace,
            disposition="ACCEPT",
            reason_code="OTHER",
            require_durable_persistence=True
        )


def test_07_governance_invariants(manager):
    actual_sha = manager.verify_model_provenance()
    assert actual_sha == EXPECTED_MODEL_SHA
    rules = manager.contract["governance_rules"]
    assert rules["no_automatic_retraining"] is True
    assert rules["no_threshold_modification"] is True
    assert "never be injected" in rules["test_set_isolation"]
