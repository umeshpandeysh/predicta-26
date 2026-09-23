"""
Authoritative Phase 13 Task 1 — Digital Reliability Twin & Lineage Test Suite (Python)
File: tests/test_reliability_twin.py

Verifies T01 through T24 for Python twin implementation:
- T01: Complete twin construction
- T02: Component identity linkage
- T03: Trace_id linkage
- T04: Lot/wafer/die linkage
- T05: Chronological ordering
- T06: Deterministic ordering for equal timestamps
- T07: Prediction evidence preserved
- T08: Operator lifecycle preserved
- T09: Secondary-test evidence preserved
- T10: Outcome evidence preserved
- T11: Adjudication evidence preserved
- T12: Provenance preserved
- T13: Synthetic source explicitly preserved
- T14: Missing evidence returns INSUFFICIENT_EVIDENCE
- T15: NOT_ESTABLISHED is not converted into a fabricated conclusion
- T16: Original prediction cannot be mutated through twin construction
- T17: Original probability cannot be mutated
- T18: Original model provenance cannot be mutated
- T19: Duplicate events do not silently create duplicate canonical evidence
- T20: Unknown component/trace fails safely
- T21: Malformed evidence fails safely
- T22: Deterministic twin output
- T23: Existing Phase 11 evidence remains compatible
- T24: Existing Phase 12 integrity contracts remain compatible
"""

import os
import pytest

from src.reliability_twin.reliability_twin import ReliabilityTwinManagerPy
from src.governance.disposition import HumanDispositionManager as HumanDispositionManagerPy, register_authoritative_prediction
from src.api.inference_service import PredictaInferenceService
from src.evaluation.phase12_evaluation_integrity import EvaluationIntegrityGatePy

BASE_RECORD = {
    "supply_voltage": 1.20,
    "output_voltage": 1.20,
    "current": 10.7,
    "leakage_current": 111.7,
    "resistance": 10.0,
    "capacitance": 5.0,
    "threshold_voltage": 0.45,
    "frequency": 1000.0,
    "propagation_delay": 10.98,
    "setup_time": 1.0,
    "hold_time": 0.5,
    "timing_margin": 2.0,
    "temperature": 25.0,
    "dynamic_power": 30.0,
    "total_power": 35.0,
    "test_duration": 1.0,
    "equipment_id": "EQP-101",
    "component_id": "CMP-T13-001",
    "lot_id": "LOT-T13-001",
    "wafer_id": "LOT-T13-001-W01",
    "die_id": "DIE-T13-001",
    "trace_id": "TR-T13-001",
    "test_id": "TST-T13-001"
}


@pytest.fixture
def setup_auth_prediction():
    svc = PredictaInferenceService()
    pred = svc.predict_single(BASE_RECORD)
    # Merge component_id, trace_id, and stable created_at so twin resolver works and T22 (determinism) passes
    # Note: predict_single may return trace_id=None; we must explicitly include it for store indexing
    merged = {
        **pred,
        "trace_id": BASE_RECORD["trace_id"],
        "test_id": BASE_RECORD["test_id"],
        "component_id": BASE_RECORD["component_id"],
        "lot_id": BASE_RECORD["lot_id"],
        "created_at": "2026-01-01T00:00:00.000Z"
    }
    register_authoritative_prediction(merged)
    return merged


def test_t01_complete_twin_construction(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    assert twin is not None
    assert twin["twin_id"].startswith("TWIN-")
    assert "identity" in twin
    assert "evidence_summary" in twin
    assert "longitudinal_timeline" in twin
    assert "provenance" in twin


def test_t02_component_identity_linkage(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    assert twin["identity"]["component_id"] == "CMP-T13-001"


def test_t03_trace_id_linkage(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("TR-T13-001")
    assert twin["identity"]["trace_id"] == "TR-T13-001"


def test_t04_lot_wafer_die_linkage(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    assert twin["identity"]["lot_id"] == "LOT-T13-001"
    assert twin["identity"]["wafer_id"] == "LOT-T13-001-W01"
    assert twin["identity"]["die_id"] == "DIE-T13-001"


def test_t05_chronological_ordering(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    timeline = twin["longitudinal_timeline"]
    assert len(timeline) > 0
    for i in range(1, len(timeline)):
        t_prev = timeline[i - 1]["timestamp"]
        t_curr = timeline[i]["timestamp"]
        assert t_prev <= t_curr, "Timeline events must be chronologically ordered."


def test_t06_deterministic_ordering_equal_timestamps(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    timeline = twin["longitudinal_timeline"]
    for i in range(1, len(timeline)):
        if timeline[i - 1]["timestamp"] == timeline[i]["timestamp"]:
            assert str(timeline[i - 1]["event_id"]) <= str(timeline[i]["event_id"])


def test_t07_prediction_evidence_preserved(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    assert twin["evidence_summary"]["ml_evaluation"] == "AVAILABLE"
    assert twin["evidence_blocks"]["ml_evaluation"]["threshold"] == 0.20
    assert twin["evidence_blocks"]["ml_evaluation"]["prediction"] == setup_auth_prediction["prediction"]


def test_t08_operator_lifecycle_preserved(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    disp_mgr = HumanDispositionManagerPy()
    disp_mgr.record_disposition(
        trace_id="TR-T13-001",
        disposition="HOLD",
        reason_code="FALSE_POSITIVE_SUSPECTED",
        operator_id="OP-T13",
        comment="Testing operator lifecycle preservation",
        require_durable_persistence=False
    )
    twin = manager.build_reliability_twin("TR-T13-001")
    assert twin["evidence_summary"]["operator_disposition"] == "AVAILABLE"
    assert len(twin["evidence_blocks"]["operator_dispositions"]) > 0
    assert twin["evidence_blocks"]["operator_dispositions"][0]["disposition"] == "HOLD"


def test_t09_secondary_test_evidence_preserved():
    svc = PredictaInferenceService()
    rec_sec = {**BASE_RECORD, "trace_id": "TR-T13-SEC", "test_id": "TST-T13-SEC", "secondary_test_result": "PASS", "requires_secondary_test": True}
    pred_sec = svc.predict_single(rec_sec)
    # predict_single may not preserve trace_id — merge it explicitly
    pred_sec_merged = {**pred_sec, "trace_id": "TR-T13-SEC", "test_id": "TST-T13-SEC", "secondary_test_result": "PASS"}
    register_authoritative_prediction(pred_sec_merged)

    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("TR-T13-SEC")
    assert twin["evidence_summary"]["secondary_test"] == "AVAILABLE"


def test_t10_outcome_evidence_preserved(setup_auth_prediction):
    disp_mgr = HumanDispositionManagerPy()
    disp_mgr.register_outcome_evidence(
        trace_id="TR-T13-001",
        disposition_id="DISP-T13-001",
        evidence_type="QUALIFIED_LAB_REPORT",
        evidence_status="EVIDENCE_RECORDED",
        evidence_source="PHYSICAL_LAB",
        recorded_by="ENG-T13",
        require_durable_persistence=False
    )
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("TR-T13-001")
    assert twin["evidence_summary"]["outcome_evidence"] == "AVAILABLE"


def test_t11_adjudication_evidence_preserved(setup_auth_prediction):
    disp_mgr = HumanDispositionManagerPy()
    disp_mgr.adjudicate_outcome(
        "TR-T13-001",
        adjudicator_identity="QUAL-LEAD-01",
        adjudicator_role="QUALITY_ENGINEER",
        proposed_outcome="PASS",
        rationale="Physical lab analysis confirms clean gate oxide",
        require_durable_persistence=False
    )
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("TR-T13-001")
    assert twin["evidence_summary"]["adjudication"] == "AVAILABLE"
    assert twin["evidence_summary"]["ground_truth_status"] == "VALIDATED_GROUND_TRUTH"


def test_t12_provenance_preserved(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    assert twin["provenance"]["model_identifier"] == "predicta_xgboost_model"
    assert twin["provenance"]["authoritative_threshold"] == 0.20
    assert twin["provenance"]["model_sha256"] == manager.expected_model_sha


def test_t13_synthetic_source_explicitly_preserved():
    svc = PredictaInferenceService()
    syn_rec = {**BASE_RECORD, "component_id": "CMP-SYN-999", "lot_id": "LOT-SYN-999", "trace_id": "TR-SYN-999", "test_id": "TST-SYN-999"}
    syn_pred = svc.predict_single(syn_rec)
    syn_pred_merged = {**syn_pred, "component_id": "CMP-SYN-999", "trace_id": "TR-SYN-999", "test_id": "TST-SYN-999", "lot_id": "LOT-SYN-999"}
    register_authoritative_prediction(syn_pred_merged)

    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-SYN-999")
    assert twin["identity"]["is_synthetic"] is True
    assert twin["provenance"]["is_synthetic_provenance"] is True


def test_t14_missing_evidence_returns_insufficient_evidence():
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-UNSEEN-NO-EVIDENCE")
    assert twin["evidence_summary"]["operator_disposition"] == "INSUFFICIENT_EVIDENCE"
    assert twin["evidence_summary"]["outcome_evidence"] == "INSUFFICIENT_EVIDENCE"


def test_t15_not_established_not_fabricated():
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-UNSEEN-NO-EVIDENCE")
    assert twin["evidence_summary"]["adjudication"] == "NOT_ESTABLISHED"
    assert twin["evidence_summary"]["ground_truth_status"] == "NOT_ESTABLISHED"


def test_t16_original_prediction_cannot_be_mutated(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    twin["evidence_blocks"]["ml_evaluation"]["prediction"] = "MUTATED_PREDICTION"
    fresh_twin = manager.build_reliability_twin("CMP-T13-001")
    assert fresh_twin["evidence_blocks"]["ml_evaluation"]["prediction"] == setup_auth_prediction["prediction"]


def test_t17_original_probability_cannot_be_mutated(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    twin["evidence_blocks"]["ml_evaluation"]["probability"] = 0.000001
    fresh_twin = manager.build_reliability_twin("CMP-T13-001")
    assert fresh_twin["evidence_blocks"]["ml_evaluation"]["probability"] == setup_auth_prediction["probability"]


def test_t18_original_model_provenance_cannot_be_mutated(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    twin["provenance"]["model_sha256"] = "FAKE_SHA"
    fresh_twin = manager.build_reliability_twin("CMP-T13-001")
    assert fresh_twin["provenance"]["model_sha256"] == manager.expected_model_sha


def test_t19_duplicate_events_deduplicated(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    timeline = twin["longitudinal_timeline"]
    event_summaries = [f"{e['stage']}:{e['summary']}" for e in timeline]
    assert len(timeline) == len(set(event_summaries))


def test_t20_unknown_component_fails_safely():
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("UNKNOWN-COMPONENT-ID-999")
    assert twin is not None
    assert twin["identity"]["component_id"] == "UNKNOWN-COMPONENT-ID-999"
    assert twin["evidence_summary"]["ml_evaluation"] == "INSUFFICIENT_EVIDENCE"


def test_t21_malformed_evidence_fails_safely():
    manager = ReliabilityTwinManagerPy()
    with pytest.raises(ValueError, match="INVALID_IDENTIFIER"):
        manager.build_reliability_twin(None)

    with pytest.raises(ValueError, match="INVALID_IDENTIFIER"):
        manager.build_reliability_twin("")


def test_t22_deterministic_twin_output(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin1 = manager.build_reliability_twin("CMP-T13-001")
    twin2 = manager.build_reliability_twin("CMP-T13-001")
    assert twin1 == twin2


def test_t23_existing_phase11_evidence_compatible(setup_auth_prediction):
    disp_mgr = HumanDispositionManagerPy()
    gov = disp_mgr.evaluate_disposition_governance("TR-T13-001", require_durable_persistence=False)
    assert gov is not None
    assert gov["trace_id"] == "TR-T13-001"


def test_t24_existing_phase12_integrity_contracts_compatible():
    gate = EvaluationIntegrityGatePy()
    m_check = gate.verify_production_model_protection()
    p_check = gate.verify_production_manifest_protection()
    assert m_check["valid"] is True
    assert p_check["valid"] is True
