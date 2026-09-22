"""
PREDICTA — PHASE 11 TASK 3 GOVERNED OUTCOME EVIDENCE & ADJUDICATION TEST SUITE (Python)
File: tests/test_phase11_task3_governance.py

Verifies Phase 11 Task 3 Requirements (Tests A through L):
A. Operator is not ground truth (CONFIRMED status != VALIDATED_GROUND_TRUTH)
B. False-negative suspicion is not ground truth (FALSE_NEGATIVE_SUSPECTED != ground truth)
C. Missing evidence rejection (adjudication without evidence raises MISSING_OUTCOME_EVIDENCE)
D. Unauthorized adjudicator rejection (OPERATOR role raises UNAUTHORIZED_ROLE / PermissionError)
E. Valid authorized adjudication (QUALITY_ENGINEER yields VALIDATED_PASS/FAIL & VALIDATED_GROUND_TRUTH)
F. Conflicting evidence -> UNRESOLVED_AMBIGUITY (PASS vs FAIL without rationale yields UNRESOLVED)
G. Client ground-truth injection rejection (prohibited ML/GT fields raise CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED)
H. Protected test set rejection (BENCHMARK_ trace raises TEST_SET_ISOLATION_PROTECTED)
I. Persistence failure fail closed (require_durable_persistence raises PERSISTENCE_ERROR when DB fails)
J. Restart reconstruction (evidence and adjudications retrievable from store/DB)
K. Production model/threshold isolation (Model SHA 91bb59..., threshold 0.20 remain untouched)
L. Synthetic disclosure verification (SYNTHETIC_PHYSICS_GROUND_TRUTH includes retrospective disclosure)
"""

import os
import sys
import json
import hashlib
import pytest
from unittest.mock import MagicMock

os.environ["NODE_ENV"] = "test"

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
    _LIFECYCLE_EVENTS,
    _EVIDENCE_STORE,
    _ADJUDICATION_STORE
)


@pytest.fixture(autouse=True)
def setup_test_predictions():
    _FEEDBACK_STORE.clear()
    _LIFECYCLE_EVENTS.clear()
    _EVIDENCE_STORE.clear()
    _ADJUDICATION_STORE.clear()

    register_authoritative_prediction({
        "trace_id": "TRACE-PY-T3-001",
        "component_id": "COMP-PY-001",
        "lot_id": "LOT-PY-001",
        "prediction": "REJECT",
        "probability": 0.85,
        "anomaly_score": 0.92,
        "prognostic_summary": "CRITICAL_DEGRADATION"
    })

    register_authoritative_prediction({
        "trace_id": "TRACE-PY-T3-FN-001",
        "component_id": "COMP-PY-FN",
        "lot_id": "LOT-PY-FN",
        "prediction": "ACCEPT",
        "probability": 0.12,
        "anomaly_score": 0.15
    })

    register_authoritative_prediction({
        "trace_id": "TRACE-PY-T3-CONFLICT",
        "component_id": "COMP-PY-CONF",
        "lot_id": "LOT-PY-CONF",
        "prediction": "REJECT",
        "probability": 0.88,
        "anomaly_score": 0.90
    })

    register_authoritative_prediction({
        "trace_id": "BENCHMARK_PY_T3_001",
        "component_id": "COMP-BENCH-PY-01",
        "lot_id": "LOT-BENCH-PY-01",
        "prediction": "REJECT",
        "probability": 0.75
    })

    register_authoritative_prediction({
        "trace_id": "TRACE-PY-T3-SYNTHETIC",
        "component_id": "COMP-SYNTH-PY-01",
        "lot_id": "LOT-SYNTH-PY-01",
        "prediction": "REJECT",
        "probability": 0.82
    })


def helper_setup_confirmed_disposition(manager, trace_id, disposition="REJECT", reason_code="FALSE_POSITIVE_SUSPECTED"):
    disp = manager.record_disposition(
        trace_id=trace_id,
        disposition=disposition,
        reason_code=reason_code,
        operator_id="OPERATOR_PY_01",
        comment="Test disposition setup"
    )
    manager.update_feedback_status(
        trace_id=trace_id,
        disposition_id=disp["disposition_id"],
        new_status="CONFIRMED",
        operator_id="OPERATOR_PY_01",
        comment="Confirmed by operator"
    )
    return disp


def test_a_operator_is_not_ground_truth():
    """Test A: Operator confirmation does NOT establish ground truth."""
    manager = HumanDispositionManager()
    helper_setup_confirmed_disposition(manager, "TRACE-PY-T3-001")
    gov = manager.evaluate_disposition_governance("TRACE-PY-T3-001")
    candidate = gov["evaluation_candidate"]
    assert candidate["ground_truth_status"] == "NOT_ESTABLISHED"
    assert candidate.get("ground_truth_label") is None
    assert candidate["production_effect"] is False


def test_b_false_negative_suspicion_is_not_ground_truth():
    """Test B: FALSE_NEGATIVE_SUSPECTED disposition is NOT ground truth."""
    manager = HumanDispositionManager()
    helper_setup_confirmed_disposition(manager, "TRACE-PY-T3-FN-001", disposition="ACCEPT", reason_code="FALSE_NEGATIVE_SUSPECTED")
    gov = manager.evaluate_disposition_governance("TRACE-PY-T3-FN-001")
    candidate = gov["evaluation_candidate"]
    assert candidate["ground_truth_status"] == "NOT_ESTABLISHED"
    assert candidate.get("ground_truth_label") is None


def test_c_missing_evidence_rejection():
    """Test C: Adjudication without outcome evidence raises MISSING_OUTCOME_EVIDENCE."""
    manager = HumanDispositionManager()
    helper_setup_confirmed_disposition(manager, "TRACE-PY-T3-001")
    with pytest.raises(ValueError) as excinfo:
        manager.adjudicate_outcome(
            trace_id="TRACE-PY-T3-001",
            adjudicator_identity="QUALITY_ENG_PY_01",
            adjudicator_role="QUALITY_ENGINEER",
            proposed_outcome="FAIL",
            rationale="Testing missing evidence"
        )
    assert "MISSING_OUTCOME_EVIDENCE" in str(excinfo.value)


def test_d_unauthorized_adjudicator_rejection():
    """Test D: Adjudication by OPERATOR role raises UNAUTHORIZED_ROLE."""
    manager = HumanDispositionManager()
    helper_setup_confirmed_disposition(manager, "TRACE-PY-T3-001")
    manager.register_outcome_evidence(
        trace_id="TRACE-PY-T3-001",
        evidence_type="ATE_RETEST_LOG",
        evidence_source="ATE_STATION_42",
        source_record_identifier="ATE-LOG-88192",
        provenance_metadata={"result": "FAIL"}
    )
    with pytest.raises(PermissionError) as excinfo:
        manager.adjudicate_outcome(
            trace_id="TRACE-PY-T3-001",
            adjudicator_identity="OPERATOR_PY_01",
            adjudicator_role="OPERATOR",
            proposed_outcome="FAIL",
            rationale="Operator attempting adjudication"
        )
    assert "UNAUTHORIZED_ROLE" in str(excinfo.value)


def test_e_valid_authorized_adjudication():
    """Test E: Valid adjudication by QUALITY_ENGINEER yields VALIDATED_FAIL and VALIDATED_GROUND_TRUTH."""
    manager = HumanDispositionManager()
    helper_setup_confirmed_disposition(manager, "TRACE-PY-T3-001")
    manager.register_outcome_evidence(
        trace_id="TRACE-PY-T3-001",
        evidence_type="ATE_RETEST_LOG",
        evidence_source="ATE_STATION_42",
        source_record_identifier="ATE-LOG-88192",
        provenance_metadata={"result": "FAIL"}
    )

    adj = manager.adjudicate_outcome(
        trace_id="TRACE-PY-T3-001",
        adjudicator_identity="QUALITY_ENG_PY_01",
        adjudicator_role="QUALITY_ENGINEER",
        proposed_outcome="FAIL",
        rationale="ATE Retest confirmed physical gate breakdown under 125C stress."
    )

    assert adj["adjudication_status"] == "VALIDATED_FAIL"
    assert adj["validated_outcome"] == "FAIL"
    assert adj["ground_truth_status"] == "VALIDATED_GROUND_TRUTH"
    assert adj["adjudicator_role"] == "QUALITY_ENGINEER"
    assert adj["governance_guarantees"]["operator_is_not_ground_truth"] is True
    assert adj["governance_guarantees"]["no_automatic_retraining"] is True


def test_f_conflicting_evidence_unresolved_ambiguity():
    """Test F: Conflicting PASS and FAIL evidence without resolution rationale yields UNRESOLVED_AMBIGUITY."""
    manager = HumanDispositionManager()
    helper_setup_confirmed_disposition(manager, "TRACE-PY-T3-CONFLICT")

    manager.register_outcome_evidence(
        trace_id="TRACE-PY-T3-CONFLICT",
        evidence_type="ATE_RETEST_LOG",
        evidence_source="ATE_STATION_01",
        source_record_identifier="ATE-PASS-01",
        provenance_metadata={"result": "PASS"}
    )
    manager.register_outcome_evidence(
        trace_id="TRACE-PY-T3-CONFLICT",
        evidence_type="QUALIFIED_LAB_REPORT",
        evidence_source="RELIABILITY_LAB",
        source_record_identifier="LAB-FAIL-01",
        provenance_metadata={"result": "FAIL"}
    )

    adj = manager.adjudicate_outcome(
        trace_id="TRACE-PY-T3-CONFLICT",
        adjudicator_identity="RELIABILITY_LEAD_PY_01",
        adjudicator_role="RELIABILITY_LEAD",
        proposed_outcome=None,
        rationale=""
    )

    assert adj["adjudication_status"] == "UNRESOLVED_AMBIGUITY"
    assert adj["validated_outcome"] is None
    assert adj["ground_truth_status"] == "UNRESOLVED"


def test_g_client_ground_truth_injection_rejection():
    """Test G: Client attempting ground_truth field injection raises CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED."""
    manager = HumanDispositionManager()
    helper_setup_confirmed_disposition(manager, "TRACE-PY-T3-001")
    with pytest.raises(ValueError) as excinfo:
        manager.adjudicate_outcome(
            trace_id="TRACE-PY-T3-001",
            adjudicator_identity="ATTACKER_PY_01",
            adjudicator_role="QUALITY_ENGINEER",
            ground_truth="PASS",
            rationale="Attempting injection"
        )
    assert "CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED" in str(excinfo.value)

    with pytest.raises(ValueError) as excinfo:
        manager.adjudicate_outcome(
            trace_id="TRACE-PY-T3-001",
            adjudicator_identity="ATTACKER_PY_01",
            adjudicator_role="QUALITY_ENGINEER",
            model_hash="MALICIOUS_HASH",
            rationale="Attempting model hash override"
        )
    assert "CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED" in str(excinfo.value)


def test_h_protected_test_set_rejection():
    """Test H: Attempting adjudication on BENCHMARK_ trace raises TEST_SET_ISOLATION_PROTECTED."""
    manager = HumanDispositionManager()
    with pytest.raises(ValueError) as excinfo:
        manager.adjudicate_outcome(
            trace_id="BENCHMARK_PY_T3_001",
            adjudicator_identity="QUALITY_ENG_PY_01",
            adjudicator_role="QUALITY_ENGINEER",
            proposed_outcome="FAIL",
            rationale="Benchmarking trace"
        )
    assert "TEST_SET_ISOLATION_PROTECTED" in str(excinfo.value)


def test_i_persistence_failure_fail_closed():
    """Test I: Durable persistence failure fails closed with RuntimeError."""
    mock_db = MagicMock()
    mock_table = MagicMock()
    mock_db.table.return_value = mock_table
    mock_table.insert.side_effect = Exception("DATABASE_CONNECTION_LOST")

    manager = HumanDispositionManager(db_client=mock_db)

    with pytest.raises(RuntimeError) as excinfo:
        manager.register_outcome_evidence(
            trace_id="TRACE-FAIL-PERSIST-PY",
            evidence_type="ATE_RETEST_LOG",
            evidence_source="ATE_STATION",
            source_record_identifier="ATE-FAIL-99",
            require_durable_persistence=True
        )
    assert "PERSISTENCE_ERROR" in str(excinfo.value)


def test_j_restart_reconstruction():
    """Test J: Outcome evidence and adjudication records are retrievable across inquiries."""
    manager = HumanDispositionManager()
    helper_setup_confirmed_disposition(manager, "TRACE-PY-T3-001")
    manager.register_outcome_evidence(
        trace_id="TRACE-PY-T3-001",
        evidence_type="ATE_RETEST_LOG",
        evidence_source="ATE_STATION_42",
        source_record_identifier="ATE-LOG-88192",
        provenance_metadata={"result": "FAIL"}
    )
    manager.adjudicate_outcome(
        trace_id="TRACE-PY-T3-001",
        adjudicator_identity="QUALITY_ENG_PY_01",
        adjudicator_role="QUALITY_ENGINEER",
        proposed_outcome="FAIL",
        rationale="Lab confirmation"
    )

    evidence_list = manager.get_outcome_evidence("TRACE-PY-T3-001")
    assert len(evidence_list) > 0
    assert evidence_list[0]["evidence_type"] == "ATE_RETEST_LOG"

    adj_record = manager.get_adjudication("TRACE-PY-T3-001")
    assert adj_record is not None
    assert adj_record["ground_truth_status"] == "VALIDATED_GROUND_TRUTH"


def test_k_production_model_and_threshold_isolation():
    """Test K: Production model SHA and threshold 0.20 remain strictly unchanged."""
    assert os.path.exists(PROD_MANIFEST_PATH), "Production manifest must exist"
    with open(PROD_MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    threshold = manifest.get("authoritative_threshold") or manifest.get("operating_threshold") or manifest.get("threshold")
    assert threshold == EXPECTED_THRESHOLD, "Production threshold must remain 0.20"

    assert os.path.exists(MODEL_JSON_PATH), "Production model JSON must exist"
    with open(MODEL_JSON_PATH, "rb") as f:
        model_bytes = f.read()
    computed_sha = hashlib.sha256(model_bytes).hexdigest()
    assert computed_sha == EXPECTED_MODEL_SHA, f"Model SHA mismatch! Expected {EXPECTED_MODEL_SHA}, got {computed_sha}"


def test_l_synthetic_disclosure_verification():
    """Test L: SYNTHETIC_PHYSICS_GROUND_TRUTH includes retrospective disclosure statement."""
    manager = HumanDispositionManager()
    helper_setup_confirmed_disposition(manager, "TRACE-PY-T3-SYNTHETIC")

    manager.register_outcome_evidence(
        trace_id="TRACE-PY-T3-SYNTHETIC",
        evidence_type="SYNTHETIC_PHYSICS_GROUND_TRUTH",
        evidence_source="SIMULATED_168H_BURNIN",
        source_record_identifier="SYNTH-BURNIN-99",
        provenance_metadata={"result": "FAIL", "burnin_hours": 168}
    )

    adj = manager.adjudicate_outcome(
        trace_id="TRACE-PY-T3-SYNTHETIC",
        adjudicator_identity="RELIABILITY_LEAD_PY_01",
        adjudicator_role="RELIABILITY_LEAD",
        proposed_outcome="FAIL",
        rationale="Retrospective physics simulation burn-in verification"
    )

    disc = adj["provenance"]["synthetic_disclosure"]
    assert disc is not None
    assert "Retrospective evaluation dataset telemetry. Not physical-fab validation." in disc
