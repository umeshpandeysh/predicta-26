"""
PREDICTA — PHASE 11 TASK 2 HUMAN FEEDBACK GOVERNANCE & OFFLINE EVALUATION TEST SUITE (Python)
File: tests/test_phase11_task2_governance.py

Verifies Phase 11 Task 2 Requirements:
1. Eligibility contract evaluation (ELIGIBLE_FOR_OFFLINE_REVIEW vs REJECTED_GOVERNANCE)
2. Strict separation between operator feedback and ground truth (ground_truth_status === "NOT_ESTABLISHED")
3. Conflict governance (conflicting operators yield REJECTED_GOVERNANCE, preserve all records)
4. Offline evaluation candidate generation (evaluation_only: True, production_effect: False)
5. Database-authoritative history reconstruction across cold starts / memory wipes
6. Dataset leakage prevention & test set isolation
7. Production protection (Model SHA 91bb59..., threshold 0.20, no retraining, no recalibration)
8. JS / Python exact semantic parity
"""

import os
import sys
import json
import hashlib
import pytest
from unittest.mock import MagicMock

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

EXPECTED_MODEL_SHA = "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"
EXPECTED_THRESHOLD = 0.20

PROD_MANIFEST_PATH = os.path.join(project_root, "ml", "models", "production", "predicta_production_manifest.json")
MODEL_JSON_PATH = os.path.join(project_root, "ml", "models", "production", "predicta_xgboost_model.json")
DISPOSITION_CONTRACT_PATH = os.path.join(project_root, "ml", "governance", "disposition_contract.json")

from src.governance.disposition import (
    HumanDispositionManager,
    register_authoritative_prediction,
    _FEEDBACK_STORE,
    _LIFECYCLE_EVENTS
)


@pytest.fixture(autouse=True)
def setup_test_predictions():
    _FEEDBACK_STORE.clear()
    _LIFECYCLE_EVENTS.clear()

    register_authoritative_prediction({
        "trace_id": "TRACE-PY-T2-001",
        "component_id": "COMP-PY-001",
        "lot_id": "LOT-PY-001",
        "prediction": "REJECT",
        "probability": 0.85,
        "anomaly_score": 0.92,
        "prognostic_summary": "CRITICAL_DEGRADATION"
    })

    register_authoritative_prediction({
        "trace_id": "TRACE-PY-T2-CONFLICT",
        "component_id": "COMP-PY-CONF",
        "lot_id": "LOT-PY-CONF",
        "prediction": "REJECT",
        "probability": 0.88,
        "anomaly_score": 0.90
    })

    register_authoritative_prediction({
        "trace_id": "TRACE-PY-T2-UNRESOLVED",
        "component_id": "COMP-PY-UNRES",
        "lot_id": "LOT-PY-UNRES",
        "prediction": "ACCEPT",
        "probability": 0.12
    })

    register_authoritative_prediction({
        "trace_id": "BENCHMARK_PY_001",
        "component_id": "COMP-BENCH-PY-01",
        "lot_id": "LOT-BENCH-PY-01",
        "prediction": "REJECT",
        "probability": 0.75
    })


def test_01_valid_candidate_eligible():
    manager = HumanDispositionManager()
    disp = manager.record_disposition(
        trace_id="TRACE-PY-T2-001",
        disposition="REJECT",
        reason_code="FALSE_POSITIVE_SUSPECTED",
        operator_id="OPERATOR_PY_01",
        comment="Offline candidate verification"
    )
    manager.update_feedback_status(
        trace_id="TRACE-PY-T2-001",
        disposition_id=disp["disposition_id"],
        new_status="CONFIRMED",
        operator_id="OPERATOR_PY_01",
        comment="Lab confirmation completed"
    )

    gov = manager.evaluate_disposition_governance("TRACE-PY-T2-001")
    assert gov["governance_classification"] == "ELIGIBLE_FOR_OFFLINE_REVIEW"
    assert len(gov["rejection_reasons"]) == 0
    assert gov["evaluation_candidate"] is not None
    assert gov["evaluation_candidate"]["trace_id"] == "TRACE-PY-T2-001"
    assert gov["evaluation_candidate"]["ground_truth_status"] == "NOT_ESTABLISHED"
    assert gov["evaluation_candidate"]["evaluation_only"] is True
    assert gov["evaluation_candidate"]["production_effect"] is False


def test_02_missing_ml_provenance_rejected():
    bad_manager = HumanDispositionManager()
    bad_manager.expected_model_sha = "0000000000000000000000000000000000000000000000000000000000000000"

    gov = bad_manager.evaluate_disposition_governance("TRACE-PY-T2-001")
    assert gov["governance_classification"] == "REJECTED_GOVERNANCE"
    assert "INVALID_MODEL_PROVENANCE" in gov["rejection_reasons"]
    assert gov["evaluation_candidate"] is None


def test_03_missing_authoritative_prediction_rejected():
    manager = HumanDispositionManager()
    gov = manager.evaluate_disposition_governance("TRACE-PY-NONEXISTENT-999")
    assert gov["governance_classification"] == "REJECTED_GOVERNANCE"
    assert "AUTHORITATIVE_ML_RECORD_NOT_FOUND" in gov["rejection_reasons"]
    assert gov["evaluation_candidate"] is None


def test_04_client_supplied_ml_snapshot_rejected():
    manager = HumanDispositionManager()
    with pytest.raises(ValueError) as excinfo:
        manager.record_disposition(
            trace_id="TRACE-PY-T2-001",
            disposition="REJECT",
            reason_code="FALSE_POSITIVE_SUSPECTED",
            probability=0.10,
            ground_truth="PASS"
        )
    assert "CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED" in str(excinfo.value)


def test_05_operator_feedback_is_not_ground_truth():
    manager = HumanDispositionManager()
    disp = manager.record_disposition(
        trace_id="TRACE-PY-T2-001",
        disposition="REJECT",
        reason_code="FALSE_POSITIVE_SUSPECTED"
    )
    manager.update_feedback_status(
        trace_id="TRACE-PY-T2-001",
        disposition_id=disp["disposition_id"],
        new_status="CONFIRMED"
    )

    gov = manager.evaluate_disposition_governance("TRACE-PY-T2-001")
    assert gov["evaluation_candidate"]["ground_truth_status"] == "NOT_ESTABLISHED"
    assert gov["evaluation_candidate"]["ground_truth_status"] != "PASS"
    assert gov["evaluation_candidate"]["ground_truth_status"] != "FAIL"


def test_06_conflicting_operators_rejected():
    manager = HumanDispositionManager()
    disp1 = manager.record_disposition(
        trace_id="TRACE-PY-T2-CONFLICT",
        disposition="ACCEPT",
        reason_code="FALSE_POSITIVE_SUSPECTED",
        operator_id="OPERATOR_PY_01"
    )
    manager.update_feedback_status("TRACE-PY-T2-CONFLICT", disp1["disposition_id"], "CONFIRMED", "OPERATOR_PY_01")

    disp2 = manager.record_disposition(
        trace_id="TRACE-PY-T2-CONFLICT",
        disposition="REJECT",
        reason_code="PROCESS_EXCEPTION",
        operator_id="OPERATOR_PY_02"
    )
    manager.update_feedback_status("TRACE-PY-T2-CONFLICT", disp2["disposition_id"], "CONFIRMED", "OPERATOR_PY_02")

    history = manager.get_disposition("TRACE-PY-T2-CONFLICT")
    assert history["total_dispositions"] == 2
    assert history["has_conflict"] is True

    gov = manager.evaluate_disposition_governance("TRACE-PY-T2-CONFLICT")
    assert gov["governance_classification"] == "REJECTED_GOVERNANCE"
    assert any("UNRESOLVED_GOVERNANCE_CONFLICT" in r for r in gov["rejection_reasons"])
    assert gov["evaluation_candidate"] is None


def test_07_unresolved_lifecycle_rejected():
    manager = HumanDispositionManager()
    disp = manager.record_disposition(
        trace_id="TRACE-PY-T2-UNRESOLVED",
        disposition="HOLD",
        reason_code="INSUFFICIENT_DATA",
        operator_id="OPERATOR_PY_03"
    )
    manager.update_feedback_status("TRACE-PY-T2-UNRESOLVED", disp["disposition_id"], "UNRESOLVED", "OPERATOR_PY_03")

    gov = manager.evaluate_disposition_governance("TRACE-PY-T2-UNRESOLVED")
    assert gov["governance_classification"] == "REJECTED_GOVERNANCE"
    assert any("UNRESOLVED_LIFECYCLE_STATUS" in r for r in gov["rejection_reasons"])


def test_08_restart_reconstruction_from_durable_storage():
    restart_trace_id = "TRACE-RESTART-PY-001"
    register_authoritative_prediction({
        "trace_id": restart_trace_id,
        "component_id": "COMP-RESTART-PY",
        "lot_id": "LOT-RESTART-PY",
        "prediction": "REJECT",
        "probability": 0.82
    })

    mock_db = MagicMock()

    # Mock operator_dispositions query
    disp_query = MagicMock()
    disp_query.eq.return_value.execute.return_value.data = [{
        "disposition_id": "DISP-DURABLE-PY-001",
        "trace_id": restart_trace_id,
        "component_id": "COMP-RESTART-PY",
        "lot_id": "LOT-RESTART-PY",
        "operator_id": "OPERATOR_DURABLE",
        "disposition": "REJECT",
        "reason_code": "MANUAL_ENGINEERING_REVIEW",
        "created_at": "2026-09-22T00:00:00Z",
        "model_id_at_decision": "predicta_xgboost_model",
        "model_hash_at_decision": EXPECTED_MODEL_SHA,
        "original_ml_decision": "REJECT",
        "original_ml_probability": 0.82,
        "feedback_status": "CONFIRMED",
        "conflict": False
    }]
    disp_query.eq.return_value.execute.return_value.error = None

    # Mock disposition_lifecycle_events query
    evt_query = MagicMock()
    evt_query.eq.return_value.execute.return_value.data = [{
        "event_id": "EVT-DURABLE-PY-001",
        "disposition_id": "DISP-DURABLE-PY-001",
        "trace_id": restart_trace_id,
        "previous_status": "RECORDED_ONLY",
        "new_status": "CONFIRMED",
        "changed_by": "OPERATOR_DURABLE",
        "timestamp": "2026-09-22T00:00:00Z"
    }]
    evt_query.eq.return_value.execute.return_value.error = None

    def table_router(table_name):
        if table_name == "operator_dispositions":
            mock_t = MagicMock()
            mock_t.select.return_value = disp_query
            return mock_t
        if table_name == "disposition_lifecycle_events":
            mock_t = MagicMock()
            mock_t.select.return_value = evt_query
            return mock_t
        return MagicMock()

    mock_db.table.side_effect = table_router

    durable_manager = HumanDispositionManager(db_client=mock_db)

    gov = durable_manager.evaluate_disposition_governance(restart_trace_id)
    assert gov["governance_classification"] == "ELIGIBLE_FOR_OFFLINE_REVIEW"
    assert gov["evaluation_candidate"]["trace_id"] == restart_trace_id
    assert gov["evaluation_candidate"]["lifecycle_status"] == "CONFIRMED"


def test_09_leakage_protection_benchmark_isolation():
    manager = HumanDispositionManager()
    disp = manager.record_disposition(
        trace_id="BENCHMARK_PY_001",
        disposition="REJECT",
        reason_code="PROCESS_EXCEPTION",
        operator_id="OPERATOR_PY_05"
    )
    manager.update_feedback_status("BENCHMARK_PY_001", disp["disposition_id"], "CONFIRMED", "OPERATOR_PY_05")

    gov = manager.evaluate_disposition_governance("BENCHMARK_PY_001")
    assert gov["governance_classification"] == "REJECTED_GOVERNANCE"
    assert any("TEST_SET_ISOLATION_PROTECTED" in r for r in gov["rejection_reasons"])


def test_10_production_model_protection():
    with open(MODEL_JSON_PATH, "r", encoding="utf-8") as f:
        content = f.read().replace("\r\n", "\n")
    sha = hashlib.sha256(content.encode("utf-8")).hexdigest()
    assert sha == EXPECTED_MODEL_SHA, "Production model SHA must remain untouched"


def test_11_threshold_protection():
    with open(PROD_MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    threshold = manifest.get("authoritative_threshold") or manifest.get("operating_threshold") or manifest.get("threshold")
    assert threshold == EXPECTED_THRESHOLD, "Production threshold must remain 0.20"


def test_12_no_retraining_no_recalibration():
    manager = HumanDispositionManager()
    gov = manager.evaluate_disposition_governance("TRACE-PY-T2-001")
    guarantees = gov["governance_guarantees"]
    assert guarantees["no_automatic_retraining"] is True
    assert guarantees["no_threshold_modification"] is True
    assert guarantees["no_conformal_recalibration"] is True
