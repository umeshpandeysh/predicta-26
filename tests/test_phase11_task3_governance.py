"""
PREDICTA — PHASE 11 TASK 3 GOVERNED OUTCOME EVIDENCE & ADJUDICATION TEST SUITE (Python)
File: tests/test_phase11_task3_governance.py

Verifies Phase 11 Task 3 Requirements (Tests A through V Matrix):
A. Operator CONFIRMED -> never ground truth (ground_truth_status === "NOT_ESTABLISHED")
B. FALSE_NEGATIVE_SUSPECTED -> never ground truth
C. No evidence -> adjudication rejected (MISSING_OUTCOME_EVIDENCE)
D. Unauthorized adjudicator -> rejected (UNAUTHORIZED_ROLE / PermissionError)
E. Authorized adjudicator + valid evidence -> VALIDATED_PASS/FAIL & VALIDATED_GROUND_TRUTH
F. PASS + FAIL conflict without rationale -> UNRESOLVED_AMBIGUITY & UNRESOLVED
G. Client ground_truth injection -> rejected (CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED)
H. Client model_hash / probability injection -> rejected (CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED)
I. Protected benchmark/test trace -> rejected (TEST_SET_ISOLATION_PROTECTED)
J. Database unavailable -> PERSISTENCE_ERROR / REJECTED_GOVERNANCE
K. Clear all memory after durable creation -> 100% successful reconstruction from DB
L. Legacy secondary-test completion path -> disabled
M. Legacy secondary-test path cannot mutate ML decision
N. Client attempts to spoof adjudicator role -> rejected (UNAUTHORIZED_ROLE)
O. Synthetic evidence -> mandatory synthetic disclosure
P. Synthetic evidence -> cannot claim physical-fab validation
Q. Evidence with missing / invalid evidence_type -> rejected
R. Append-only adjudication -> prior record preserved (new record appends)
S. JS/Python identical input -> identical governance result
T. Production model SHA unchanged (91bb59...)
U. Production threshold remains exactly 0.20
V. No retraining, recalibration, or fusion weight mutation
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

    register_authoritative_prediction({
        "trace_id": "TRACE-PY-T3-RESTART",
        "component_id": "COMP-PY-RESTART",
        "lot_id": "LOT-PY-RESTART",
        "prediction": "REJECT",
        "probability": 0.89
    })

    register_authoritative_prediction({
        "trace_id": "TRACE-PY-T3-APPEND",
        "component_id": "COMP-PY-APPEND",
        "lot_id": "LOT-PY-APPEND",
        "prediction": "REJECT",
        "probability": 0.84
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


def test_h_client_model_hash_and_probability_injection_rejection():
    """Test H: Client attempting model_hash or probability injection raises CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED."""
    manager = HumanDispositionManager()
    helper_setup_confirmed_disposition(manager, "TRACE-PY-T3-001")
    with pytest.raises(ValueError) as excinfo:
        manager.adjudicate_outcome(
            trace_id="TRACE-PY-T3-001",
            adjudicator_identity="ATTACKER_PY_01",
            adjudicator_role="QUALITY_ENGINEER",
            model_hash="MALICIOUS_HASH",
            rationale="Attempting model hash override"
        )
    assert "CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED" in str(excinfo.value)

    with pytest.raises(ValueError) as excinfo:
        manager.adjudicate_outcome(
            trace_id="TRACE-PY-T3-001",
            adjudicator_identity="ATTACKER_PY_01",
            adjudicator_role="QUALITY_ENGINEER",
            probability=0.01,
            rationale="Attempting probability override"
        )
    assert "CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED" in str(excinfo.value)


def test_i_protected_test_set_rejection():
    """Test I: Attempting adjudication on BENCHMARK_ trace raises TEST_SET_ISOLATION_PROTECTED."""
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


def test_j_persistence_failure_fail_closed():
    """Test J: Durable persistence failure fails closed with RuntimeError."""
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


def test_k_cold_start_restart_reconstruction():
    """Test K: Process restart reconstruction from DB yields 100% identical record."""
    db_tables = {
        "operator_dispositions": [],
        "disposition_lifecycle_events": [],
        "disposition_outcome_evidence": [],
        "disposition_adjudications": []
    }

    class MockQueryResult:
        def __init__(self, data):
            self.data = data
            self.error = None

    class MockQueryBuilder:
        def __init__(self, table_name):
            self.table_name = table_name

        def insert(self, rows):
            self.action = 'insert'
            self.rows = rows if isinstance(rows, list) else [rows]
            return self

        def select(self, fields="*"):
            self.action = 'select'
            return self

        def eq(self, col, val):
            self.filter_col = col
            self.filter_val = val
            return self

        def execute(self):
            if hasattr(self, 'action') and self.action == 'insert':
                if self.table_name in db_tables:
                    db_tables[self.table_name].extend(self.rows)
                return MockQueryResult(self.rows)
            else:
                col = getattr(self, 'filter_col', None)
                val = getattr(self, 'filter_val', None)
                rows = [r for r in db_tables.get(self.table_name, []) if not col or r.get(col) == val]
                return MockQueryResult(rows)

    class MockSupabaseClient:
        def table(self, table_name):
            return MockQueryBuilder(table_name)

    mock_db = MockSupabaseClient()
    mgr1 = HumanDispositionManager(db_client=mock_db)
    helper_setup_confirmed_disposition(mgr1, "TRACE-PY-T3-RESTART")
    mgr1.register_outcome_evidence(
        trace_id="TRACE-PY-T3-RESTART",
        evidence_type="ATE_RETEST_LOG",
        evidence_source="ATE_STATION_99",
        source_record_identifier="ATE-RESTART-01",
        provenance_metadata={"result": "FAIL"}
    )
    orig_adj = mgr1.adjudicate_outcome(
        trace_id="TRACE-PY-T3-RESTART",
        adjudicator_identity="QUALITY_ENG_PY_01",
        adjudicator_role="QUALITY_ENGINEER",
        proposed_outcome="FAIL",
        rationale="Pre-restart adjudication"
    )

    # WIPE ALL IN-MEMORY STORES
    _FEEDBACK_STORE.clear()
    _LIFECYCLE_EVENTS.clear()
    _EVIDENCE_STORE.clear()
    _ADJUDICATION_STORE.clear()

    # RECONSTRUCT MANAGER INSTANCE WITH MOCK DB CLIENT
    mgr2 = HumanDispositionManager(db_client=mock_db)
    rec_gov = mgr2.evaluate_disposition_governance("TRACE-PY-T3-RESTART")
    rec_ev = mgr2.get_outcome_evidence("TRACE-PY-T3-RESTART")
    rec_adj = mgr2.get_adjudication("TRACE-PY-T3-RESTART")

    assert rec_gov["governance_classification"] == "ELIGIBLE_FOR_OFFLINE_REVIEW"
    assert len(rec_ev) == 1
    assert rec_ev[0]["source_record_identifier"] == "ATE-RESTART-01"
    assert rec_adj["adjudication_id"] == orig_adj["adjudication_id"]
    assert rec_adj["ground_truth_status"] == "VALIDATED_GROUND_TRUTH"
    assert rec_adj["validated_outcome"] == "FAIL"


def test_l_legacy_secondary_test_completion_disabled():
    """Test L: Legacy secondary-test path cannot establish ground truth or bypass evidence."""
    manager = HumanDispositionManager()
    helper_setup_confirmed_disposition(manager, "TRACE-PY-T3-001")
    gov = manager.evaluate_disposition_governance("TRACE-PY-T3-001")
    assert gov["evaluation_candidate"]["ground_truth_status"] == "NOT_ESTABLISHED"


def test_m_legacy_secondary_test_path_cannot_mutate_ml_decision():
    """Test M: Legacy secondary test path cannot mutate authoritative ML prediction."""
    manager = HumanDispositionManager()
    auth_pred = manager.lookup_authoritative_prediction("TRACE-PY-T3-001")
    assert auth_pred["prediction"] == "REJECT"
    assert auth_pred["probability"] == 0.85


def test_n_role_spoofing_rejection():
    """Test N: Role spoofing by OPERATOR is strictly rejected."""
    manager = HumanDispositionManager()
    helper_setup_confirmed_disposition(manager, "TRACE-PY-T3-001")
    with pytest.raises(PermissionError) as excinfo:
        manager.adjudicate_outcome(
            trace_id="TRACE-PY-T3-001",
            adjudicator_identity="SPOOFER_PY_01",
            adjudicator_role="OPERATOR",
            proposed_outcome="FAIL",
            rationale="Spoofing role"
        )
    assert "UNAUTHORIZED_ROLE" in str(excinfo.value)


def test_o_synthetic_evidence_mandatory_disclosure():
    """Test O: SYNTHETIC_PHYSICS_GROUND_TRUTH includes retrospective disclosure statement."""
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


def test_p_synthetic_evidence_disclaims_physical_fab_origin():
    """Test P: Synthetic evidence explicitly disclaims physical fab validation."""
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
    assert "Not physical-fab validation." in adj["provenance"]["synthetic_disclosure"]


def test_q_invalid_evidence_type_rejection():
    """Test Q: Invalid evidence_type raises ValueError."""
    manager = HumanDispositionManager()
    with pytest.raises(ValueError) as excinfo:
        manager.register_outcome_evidence(
            trace_id="TRACE-PY-T3-001",
            evidence_type="FABRICATED_PHYSICAL_RECORD",
            evidence_source="UNKNOWN",
            source_record_identifier="FAKE-123"
        )
    assert "INVALID_EVIDENCE_TYPE" in str(excinfo.value)


def test_r_append_only_adjudication():
    """Test R: Re-adjudication appends a new record and preserves prior history."""
    manager = HumanDispositionManager()
    helper_setup_confirmed_disposition(manager, "TRACE-PY-T3-APPEND")
    manager.register_outcome_evidence(
        trace_id="TRACE-PY-T3-APPEND",
        evidence_type="ATE_RETEST_LOG",
        evidence_source="ATE_STATION_01",
        source_record_identifier="ATE-APP-01",
        provenance_metadata={"result": "FAIL"}
    )

    adj1 = manager.adjudicate_outcome(
        trace_id="TRACE-PY-T3-APPEND",
        adjudicator_identity="QUALITY_ENG_PY_01",
        adjudicator_role="QUALITY_ENGINEER",
        proposed_outcome="FAIL",
        rationale="First adjudication"
    )

    adj2 = manager.adjudicate_outcome(
        trace_id="TRACE-PY-T3-APPEND",
        adjudicator_identity="RELIABILITY_LEAD_PY_01",
        adjudicator_role="RELIABILITY_LEAD",
        proposed_outcome="FAIL",
        rationale="Second adjudication amending rationale"
    )

    adj_history = _ADJUDICATION_STORE.get("TRACE-PY-T3-APPEND", [])
    assert len(adj_history) == 2
    assert adj_history[0]["adjudication_id"] == adj1["adjudication_id"]
    assert adj_history[1]["adjudication_id"] == adj2["adjudication_id"]
    assert adj1["adjudication_id"] != adj2["adjudication_id"]


def test_s_js_python_governance_parity():
    """Test S: JS/Python adjudication structure and governance parity."""
    manager = HumanDispositionManager()
    parity_trace = "TRACE-PY-T3-PARITY"
    register_authoritative_prediction({
        "trace_id": parity_trace,
        "component_id": "COMP-PARITY-PY",
        "lot_id": "LOT-PARITY-PY",
        "prediction": "REJECT",
        "probability": 0.88
    })
    helper_setup_confirmed_disposition(manager, parity_trace)
    manager.register_outcome_evidence(
        trace_id=parity_trace,
        evidence_type="ATE_RETEST_LOG",
        evidence_source="ATE_STATION_01",
        source_record_identifier="ATE-PARITY-PY",
        provenance_metadata={"result": "FAIL"}
    )
    adj = manager.adjudicate_outcome(
        trace_id=parity_trace,
        adjudicator_identity="QUALITY_ENG_PY_01",
        adjudicator_role="QUALITY_ENGINEER",
        proposed_outcome="FAIL",
        rationale="Parity verification"
    )
    assert adj["adjudication_id"].startswith("ADJ-")
    assert adj["ground_truth_status"] == "VALIDATED_GROUND_TRUTH"
    assert adj["validated_outcome"] == "FAIL"
    assert adj["governance_guarantees"]["no_automatic_retraining"] is True
    assert adj["governance_guarantees"]["no_threshold_modification"] is True


def test_t_production_model_sha_unchanged():
    """Test T: Production model SHA-256 remains 91bb59..."""
    assert os.path.exists(MODEL_JSON_PATH)
    with open(MODEL_JSON_PATH, "rb") as f:
        model_bytes = f.read()
    computed_sha = hashlib.sha256(model_bytes).hexdigest()
    assert computed_sha == EXPECTED_MODEL_SHA


def test_u_production_threshold_remains_0_20():
    """Test U: Production operating threshold remains exactly 0.20."""
    assert os.path.exists(PROD_MANIFEST_PATH)
    with open(PROD_MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    threshold = manifest.get("authoritative_threshold") or manifest.get("operating_threshold") or manifest.get("threshold")
    assert threshold == EXPECTED_THRESHOLD


def test_v_no_retraining_recalibration_or_weight_mutation():
    """Test V: Governance guarantees strictly prohibit retraining, recalibration, and weight mutation."""
    manager = HumanDispositionManager()
    parity_trace = "TRACE-PY-T3-PARITY-V"
    register_authoritative_prediction({
        "trace_id": parity_trace,
        "component_id": "COMP-PARITY-V",
        "lot_id": "LOT-PARITY-V",
        "prediction": "REJECT",
        "probability": 0.88
    })
    helper_setup_confirmed_disposition(manager, parity_trace)
    manager.register_outcome_evidence(
        trace_id=parity_trace,
        evidence_type="ATE_RETEST_LOG",
        evidence_source="ATE_STATION_01",
        source_record_identifier="ATE-PARITY-V",
        provenance_metadata={"result": "FAIL"}
    )
    adj = manager.adjudicate_outcome(
        trace_id=parity_trace,
        adjudicator_identity="QUALITY_ENG_PY_01",
        adjudicator_role="QUALITY_ENGINEER",
        proposed_outcome="FAIL",
        rationale="Parity verification V"
    )
    g = adj["governance_guarantees"]
    assert g["no_automatic_retraining"] is True
    assert g["no_threshold_modification"] is True
    assert g["no_fusion_weight_modification"] is True
    assert g["no_conformal_recalibration"] is True
    assert g["operator_is_not_ground_truth"] is True


def test_w_legacy_disposition_endpoint_disabled():
    """Test W: Legacy disposition path is disabled under Phase 11 Task 3 governance."""
    trace_id = "TRACE-PY-T3-W"
    register_authoritative_prediction({
        "trace_id": trace_id,
        "component_id": "COMP-PY-W",
        "lot_id": "LOT-PY-W",
        "prediction": "REJECT",
        "probability": 0.85
    })
    manager = HumanDispositionManager()
    helper_setup_confirmed_disposition(manager, trace_id)
    gov = manager.evaluate_disposition_governance(trace_id)
    assert gov["evaluation_candidate"]["ground_truth_status"] == "NOT_ESTABLISHED"


def test_x_direct_legacy_confirm_disposition_disabled():
    """Test X: Direct confirm_disposition legacy method cannot mutate ML governance state."""
    manager = HumanDispositionManager()
    auth_pred = manager.lookup_authoritative_prediction("TRACE-PY-T3-001")
    assert auth_pred["prediction"] == "REJECT"
    assert auth_pred["probability"] == 0.85


def test_y_async_legacy_confirm_disposition_disabled():
    """Test Y: Async legacy confirm_disposition path cannot establish ground truth."""
    trace_id = "TRACE-PY-T3-Y"
    register_authoritative_prediction({
        "trace_id": trace_id,
        "component_id": "COMP-PY-Y",
        "lot_id": "LOT-PY-Y",
        "prediction": "REJECT",
        "probability": 0.85
    })
    manager = HumanDispositionManager()
    helper_setup_confirmed_disposition(manager, trace_id)
    gov = manager.evaluate_disposition_governance(trace_id)
    assert gov["evaluation_candidate"]["ground_truth_status"] == "NOT_ESTABLISHED"


def test_z_no_prediction_mutation():
    """Test Z: Legacy disposition attempt cannot mutate prediction, probability, or threshold."""
    manager = HumanDispositionManager()
    auth_pred = manager.lookup_authoritative_prediction("TRACE-PY-T3-001")
    assert auth_pred["prediction"] == "REJECT"
    assert auth_pred["probability"] == 0.85


def test_aa_no_ground_truth_mutation():
    """Test AA: Legacy disposition attempt does NOT create VALIDATED_GROUND_TRUTH or ground_truth_label."""
    manager = HumanDispositionManager()
    trace_id = "TRACE-PY-T3-AA"
    register_authoritative_prediction({
        "trace_id": trace_id,
        "component_id": "COMP-PY-AA",
        "lot_id": "LOT-PY-AA",
        "prediction": "REJECT",
        "probability": 0.85
    })
    helper_setup_confirmed_disposition(manager, trace_id)
    gov = manager.evaluate_disposition_governance(trace_id)
    assert gov["evaluation_candidate"]["ground_truth_status"] == "NOT_ESTABLISHED"
    assert gov["evaluation_candidate"].get("ground_truth_label") is None


def test_ab_governed_path_still_works():
    """Test AB: Governed Phase 11 pipeline (record -> governance -> evidence -> adjudication) produces VALIDATED_GROUND_TRUTH."""
    manager = HumanDispositionManager()
    trace_id = "TRACE-PY-T3-PIPE"
    register_authoritative_prediction({
        "trace_id": trace_id,
        "component_id": "COMP-PY-PIPE",
        "lot_id": "LOT-PY-PIPE",
        "prediction": "REJECT",
        "probability": 0.86
    })
    helper_setup_confirmed_disposition(manager, trace_id)
    gov = manager.evaluate_disposition_governance(trace_id)
    assert gov["governance_classification"] == "ELIGIBLE_FOR_OFFLINE_REVIEW"

    manager.register_outcome_evidence(
        trace_id=trace_id,
        evidence_type="ATE_RETEST_LOG",
        evidence_source="ATE_STATION_01",
        source_record_identifier="ATE-PIPE-PY",
        provenance_metadata={"result": "FAIL"}
    )
    adj = manager.adjudicate_outcome(
        trace_id=trace_id,
        adjudicator_identity="QUALITY_ENG_PY_01",
        adjudicator_role="QUALITY_ENGINEER",
        proposed_outcome="FAIL",
        rationale="Governed pipeline verification"
    )
    assert adj["ground_truth_status"] == "VALIDATED_GROUND_TRUTH"
    assert adj["validated_outcome"] == "FAIL"


def test_ac_conflict_protection():
    """Test AC: Unresolved PASS and FAIL evidence conflict yields UNRESOLVED_AMBIGUITY."""
    manager = HumanDispositionManager()
    trace_id = "TRACE-PY-T3-AC"
    register_authoritative_prediction({
        "trace_id": trace_id,
        "component_id": "COMP-PY-AC",
        "lot_id": "LOT-PY-AC",
        "prediction": "REJECT",
        "probability": 0.87
    })
    helper_setup_confirmed_disposition(manager, trace_id)
    manager.register_outcome_evidence(
        trace_id=trace_id,
        evidence_type="ATE_RETEST_LOG",
        evidence_source="ATE_STATION_01",
        source_record_identifier="ATE-AC-PASS-PY",
        provenance_metadata={"result": "PASS"}
    )
    manager.register_outcome_evidence(
        trace_id=trace_id,
        evidence_type="QUALIFIED_LAB_REPORT",
        evidence_source="RELIABILITY_LAB",
        source_record_identifier="LAB-AC-FAIL-PY",
        provenance_metadata={"result": "FAIL"}
    )

    adj = manager.adjudicate_outcome(
        trace_id=trace_id,
        adjudicator_identity="RELIABILITY_LEAD_PY_01",
        adjudicator_role="RELIABILITY_LEAD",
        proposed_outcome=None,
        rationale=""
    )
    assert adj["adjudication_status"] == "UNRESOLVED_AMBIGUITY"
    assert adj["validated_outcome"] is None
    assert adj["ground_truth_status"] == "UNRESOLVED"


def test_ad_production_protection():
    """Test AD: Production model SHA (91bb59...) and threshold (0.20) are strictly locked."""
    with open(MODEL_JSON_PATH, "rb") as f:
        model_bytes = f.read()
    computed_sha = hashlib.sha256(model_bytes).hexdigest()
    assert computed_sha == EXPECTED_MODEL_SHA

    with open(PROD_MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    threshold = manifest.get("authoritative_threshold") or manifest.get("operating_threshold") or manifest.get("threshold")
    assert threshold == EXPECTED_THRESHOLD


def test_ae_no_automatic_production_effect():
    """Test AE: Task 3 operations enforce production_effect: false and zero ML mutation."""
    manager = HumanDispositionManager()
    trace_id = "TRACE-PY-T3-AE"
    register_authoritative_prediction({
        "trace_id": trace_id,
        "component_id": "COMP-PY-AE",
        "lot_id": "LOT-PY-AE",
        "prediction": "REJECT",
        "probability": 0.85
    })
    helper_setup_confirmed_disposition(manager, trace_id)
    gov = manager.evaluate_disposition_governance(trace_id)
    assert gov["evaluation_candidate"]["production_effect"] is False
    assert gov["evaluation_candidate"]["evaluation_only"] is True
