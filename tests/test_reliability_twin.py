"""
Authoritative Phase 13 Task 1 — Digital Reliability Twin & Lineage Test Suite (Python)
File: tests/test_reliability_twin.py

Strict 24-point lineage verification without evidence fabrication:
 - T01: Canonical twin construction
 - T02: Authoritative component linkage
 - T03: Authoritative trace linkage
 - T04: Missing lot/wafer/die remains missing (None)
 - T05: Missing equipment remains missing (None)
 - T06: No fabricated manufacturing event
 - T07: Actual telemetry preserved when available
 - T08: Chronological ordering
 - T09: Deterministic equal-timestamp ordering
 - T10: Prediction evidence preserved exactly
 - T11: Probability preserved exactly
 - T12: Threshold not rewritten
 - T13: Model provenance preserved
 - T14: Missing anomaly = INSUFFICIENT_EVIDENCE
 - T15: Missing prognostic = INSUFFICIENT_EVIDENCE
 - T16: Missing physics / unestablished signals = INSUFFICIENT_EVIDENCE
 - T17: Missing operator evidence = INSUFFICIENT_EVIDENCE
 - T18: Missing outcome evidence = INSUFFICIENT_EVIDENCE
 - T19: Missing adjudication = NOT_ESTABLISHED
 - T20: Synthetic evidence explicitly labelled (is_synthetic: True)
 - T21: Twin cannot mutate source evidence
 - T22: No fabricated timestamps (None when not authoritative)
 - T23: Deterministic twin output
 - T24: Phase 11/12 compatibility
"""

import copy
import pytest

from src.reliability_twin.reliability_twin import ReliabilityTwinManagerPy
from src.governance.disposition import (
    HumanDispositionManager as HumanDispositionManagerPy,
    register_authoritative_prediction,
)
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
    "test_id": "TST-T13-001",
    "created_at": "2026-01-01T00:00:00.000Z",
}


@pytest.fixture
def setup_auth_prediction():
    svc = PredictaInferenceService()
    pred = svc.predict_single(BASE_RECORD)
    merged = {
        **pred,
        "trace_id": BASE_RECORD["trace_id"],
        "test_id": BASE_RECORD["test_id"],
        "component_id": BASE_RECORD["component_id"],
        "lot_id": BASE_RECORD["lot_id"],
        "wafer_id": BASE_RECORD["wafer_id"],
        "die_id": BASE_RECORD["die_id"],
        "equipment_id": BASE_RECORD["equipment_id"],
        "created_at": "2026-01-01T00:00:00.000Z",
    }
    register_authoritative_prediction(merged)
    return merged


def test_t01_canonical_twin_construction(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    assert twin is not None
    assert twin["twin_id"].startswith("TWIN-")
    assert "identity" in twin
    assert "evidence_summary" in twin
    assert "evidence_blocks" in twin
    assert isinstance(twin["longitudinal_timeline"], list)
    assert "provenance" in twin


def test_t02_authoritative_component_linkage(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    assert twin["identity"]["component_id"] == "CMP-T13-001"


def test_t03_authoritative_trace_linkage(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("TR-T13-001")
    assert twin["identity"]["trace_id"] == "TR-T13-001"


def test_t04_missing_lot_wafer_die_remains_missing():
    partial = {
        "trace_id": "TR-PARTIAL-PY-001",
        "component_id": "CMP-PARTIAL-PY-001",
        "prediction": "PASS",
        "probability": 0.05,
        "threshold": 0.20,
        "risk_level": "LOW_RISK",
        "created_at": "2026-01-02T00:00:00.000Z",
    }
    register_authoritative_prediction(partial)
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-PARTIAL-PY-001")
    assert twin["identity"]["lot_id"] is None
    assert twin["identity"]["wafer_id"] is None
    assert twin["identity"]["die_id"] is None


def test_t05_missing_equipment_remains_missing():
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-PARTIAL-PY-001")
    assert twin["identity"]["equipment_id"] is None


def test_t06_no_fabricated_manufacturing_event():
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-PARTIAL-PY-001")
    mfg_events = [e for e in twin["longitudinal_timeline"] if e["stage"] == "MANUFACTURING_OBSERVATION"]
    assert len(mfg_events) == 0


def test_t07_actual_telemetry_preserved_when_available(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    assert twin["identity"]["equipment_id"] == "EQP-101"
    assert twin["identity"]["lot_id"] == "LOT-T13-001"
    assert twin["identity"]["wafer_id"] == "LOT-T13-001-W01"
    assert twin["identity"]["die_id"] == "DIE-T13-001"


def test_t08_chronological_ordering(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    timeline = twin["longitudinal_timeline"]
    for i in range(1, len(timeline)):
        if timeline[i - 1]["timestamp"] and timeline[i]["timestamp"]:
            assert timeline[i - 1]["timestamp"] <= timeline[i]["timestamp"]


def test_t09_deterministic_equal_timestamp_ordering(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    timeline = twin["longitudinal_timeline"]
    for i in range(1, len(timeline)):
        if timeline[i - 1]["timestamp"] == timeline[i]["timestamp"]:
            assert str(timeline[i - 1]["event_id"]) <= str(timeline[i]["event_id"])


def test_t10_prediction_evidence_preserved_exactly(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    assert twin["evidence_summary"]["ml_evaluation"] == "AVAILABLE"
    assert twin["evidence_blocks"]["ml_evaluation"]["prediction"] == setup_auth_prediction["prediction"]


def test_t11_probability_preserved_exactly(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    assert twin["evidence_blocks"]["ml_evaluation"]["probability"] == setup_auth_prediction["probability"]


def test_t12_threshold_not_rewritten(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    assert twin["evidence_blocks"]["ml_evaluation"]["threshold"] == 0.20


def test_t13_model_provenance_preserved(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    assert twin["provenance"]["model_identifier"] == "predicta_xgboost_model"
    assert twin["provenance"]["model_sha256"] == manager.expected_model_sha


def test_t14_missing_anomaly_insufficient_evidence():
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-PARTIAL-PY-001")
    assert twin["evidence_summary"]["anomaly_evidence"] == "INSUFFICIENT_EVIDENCE"
    assert twin["evidence_blocks"]["anomaly_evidence"] is None


def test_t15_missing_prognostic_insufficient_evidence():
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-PARTIAL-PY-001")
    assert twin["evidence_summary"]["prognostic_evidence"] == "INSUFFICIENT_EVIDENCE"
    assert twin["evidence_blocks"]["prognostic_evidence"] is None


def test_t16_missing_physics_insufficient_evidence():
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-UNSEEN-SIGNAL-PY")
    assert twin["evidence_summary"]["secondary_test"] == "INSUFFICIENT_EVIDENCE"
    assert twin["evidence_summary"]["ml_evaluation"] == "INSUFFICIENT_EVIDENCE"


def test_t17_missing_operator_evidence_insufficient_evidence():
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-PARTIAL-PY-001")
    assert twin["evidence_summary"]["operator_disposition"] == "INSUFFICIENT_EVIDENCE"


def test_t18_missing_outcome_evidence_insufficient_evidence():
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-PARTIAL-PY-001")
    assert twin["evidence_summary"]["outcome_evidence"] == "INSUFFICIENT_EVIDENCE"


def test_t19_missing_adjudication_not_established():
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-PARTIAL-PY-001")
    assert twin["evidence_summary"]["adjudication"] == "NOT_ESTABLISHED"
    assert twin["evidence_summary"]["ground_truth_status"] == "NOT_ESTABLISHED"


def test_t20_synthetic_evidence_explicitly_labelled():
    syn_rec = {
        "trace_id": "TR-SYN-PY-T20",
        "component_id": "CMP-SYN-PY-020",
        "lot_id": "LOT-SYN-PY-020",
        "prediction": "PASS",
        "probability": 0.08,
        "is_synthetic": True,
        "created_at": "2026-01-03T00:00:00.000Z",
    }
    register_authoritative_prediction(syn_rec)
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-SYN-PY-020")
    assert twin["identity"]["is_synthetic"] is True
    assert twin["provenance"]["is_synthetic_provenance"] is True


def test_t21_twin_cannot_mutate_source_evidence(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    twin["evidence_blocks"]["ml_evaluation"]["prediction"] = "MUTATED_PREDICTION"
    twin["evidence_blocks"]["ml_evaluation"]["probability"] = 0.99999
    fresh_twin = manager.build_reliability_twin("CMP-T13-001")
    assert fresh_twin["evidence_blocks"]["ml_evaluation"]["prediction"] == setup_auth_prediction["prediction"]
    assert fresh_twin["evidence_blocks"]["ml_evaluation"]["probability"] == setup_auth_prediction["probability"]


def test_t22_no_fabricated_timestamps():
    untimed = {
        "trace_id": "TR-UNTIMED-PY-001",
        "component_id": "CMP-UNTIMED-PY-001",
        "prediction": "PASS",
        "probability": 0.05,
        "created_at": None,
    }
    register_authoritative_prediction(untimed)
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-UNTIMED-PY-001")
    assert twin["created_at"] is None


def test_t23_deterministic_twin_output(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin1 = manager.build_reliability_twin("CMP-T13-001")
    twin2 = manager.build_reliability_twin("CMP-T13-001")
    assert twin1 == twin2


def test_t24_phase11_12_compatibility(setup_auth_prediction):
    disp_mgr = HumanDispositionManagerPy()
    gov = disp_mgr.evaluate_disposition_governance("TR-T13-001", require_durable_persistence=False)
    assert gov is not None
    assert gov["trace_id"] == "TR-T13-001"

    gate = EvaluationIntegrityGatePy()
    m_check = gate.verify_production_model_protection()
    p_check = gate.verify_production_manifest_protection()
    assert m_check["valid"] is True
    assert p_check["valid"] is True
