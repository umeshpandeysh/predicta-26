"""
Authoritative Phase 13 Task 2 — Digital Reliability Twin Comprehensive Test Suite (Python)
File: tests/test_reliability_twin.py

Validates complete 10-stage evidence chain & anti-fabrication constraints:
 - Secondary test: explicit ATE_RETEST_SIMULATOR vs SYNTHETIC_SIMULATION vs missing source (INSUFFICIENT_EVIDENCE)
 - Physics: present vs absent vs zero live engine calls (direct spy)
 - Risk Fusion: present vs absent vs zero live engine calls (direct spy)
 - Identity provenance: registered vs unregistered (component_id is None, UNREGISTERED)
 - Provenance integrity: missing provenance is None (no 1.0.0 fallbacks), historical SHA preserved
 - Anti-fabrication & immutability across all stores
 - Deterministic serialization across all 10 stages
"""

import copy
import pytest
from unittest.mock import patch, MagicMock

from src.reliability_twin.reliability_twin import ReliabilityTwinManagerPy
from src.governance.disposition import (
    HumanDispositionManager as HumanDispositionManagerPy,
    register_authoritative_prediction,
)
from src.api.inference_service import PredictaInferenceService
from src.physics.reliability_engine import PhysicsReliabilityEngine
from src.risk_fusion.risk_fusion import GovernedRiskFusionEngine
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


def test_t01_canonical_twin_construction_10_stages(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    assert twin is not None
    assert twin["twin_id"].startswith("TWIN-")
    assert twin["identity"]["identity_status"] == "REGISTERED"
    summary = twin["evidence_summary"]
    for stage in [
        "manufacturing_observation",
        "ml_evaluation",
        "anomaly_evidence",
        "prognostic_evidence",
        "physics_reliability",
        "risk_fusion",
        "operator_disposition",
        "secondary_test",
        "outcome_evidence",
        "adjudication",
    ]:
        assert stage in summary
        assert isinstance(summary[stage], str)


def test_t02_authoritative_component_linkage(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    assert twin["identity"]["component_id"] == "CMP-T13-001"


def test_t03_authoritative_trace_linkage(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("TR-T13-001")
    assert twin["identity"]["trace_id"] == "TR-T13-001"


def test_t04_unregistered_lookup_does_not_become_component_id():
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-UNREGISTERED-PY-999")
    assert twin["identity"]["component_id"] is None
    assert twin["identity"]["requested_identifier"] == "CMP-UNREGISTERED-PY-999"
    assert twin["identity"]["identity_status"] == "UNREGISTERED"
    assert twin["evidence_summary"]["ml_evaluation"] == "INSUFFICIENT_EVIDENCE"


def test_t05_missing_identity_fields_remain_none():
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
    assert twin["identity"]["equipment_id"] is None


def test_t06_physics_evidence_present_is_preserved_verbatim():
    physics_rec = {
        "trace_id": "TR-PHYS-PY-001",
        "component_id": "CMP-PHYS-PY-001",
        "prediction": "PASS",
        "probability": 0.05,
        "created_at": "2026-01-02T00:00:00.000Z",
        "ml_details": {
            "physics": {
                "physics_consistency_status": "PHYSICS_CONSISTENT",
                "physics_consistency_score": 1.0,
                "passed_physics_checks": ["PHYS_CHECK_001_BTI_MONOTONICITY"],
            }
        },
    }
    register_authoritative_prediction(physics_rec)
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-PHYS-PY-001")
    assert twin["evidence_summary"]["physics_reliability"] == "AVAILABLE"
    assert twin["evidence_blocks"]["physics_reliability"] is not None
    assert twin["evidence_blocks"]["physics_reliability"]["physics_consistency_status"] == "PHYSICS_CONSISTENT"
    phys_evts = [e for e in twin["longitudinal_timeline"] if e["stage"] == "PHYSICS_RELIABILITY_EVIDENCE"]
    assert len(phys_evts) == 1
    assert phys_evts[0]["provenance"]["source_type"] == "PHYSICS_AGING_ENGINE"


def test_t07_missing_physics_evidence_returns_insufficient():
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-PARTIAL-PY-001")
    assert twin["evidence_summary"]["physics_reliability"] == "INSUFFICIENT_EVIDENCE"
    assert twin["evidence_blocks"]["physics_reliability"] is None
    phys_evts = [e for e in twin["longitudinal_timeline"] if e["stage"] == "PHYSICS_RELIABILITY_EVIDENCE"]
    assert len(phys_evts) == 0


def test_t08_direct_spy_zero_physics_calls():
    manager = ReliabilityTwinManagerPy()
    with patch.object(PhysicsReliabilityEngine, "evaluate_physics_evidence") as mock_phys:
        # 1. On record with physics evidence
        twin_present = manager.build_reliability_twin("CMP-PHYS-PY-001")
        assert twin_present["evidence_summary"]["physics_reliability"] == "AVAILABLE"
        assert mock_phys.call_count == 0

        # 2. On record without physics evidence
        twin_absent = manager.build_reliability_twin("CMP-PARTIAL-PY-001")
        assert twin_absent["evidence_summary"]["physics_reliability"] == "INSUFFICIENT_EVIDENCE"
        assert mock_phys.call_count == 0


def test_t09_risk_fusion_evidence_present_is_preserved_verbatim():
    rf_rec = {
        "trace_id": "TR-RF-PY-001",
        "component_id": "CMP-RF-PY-001",
        "prediction": "PASS",
        "probability": 0.05,
        "created_at": "2026-01-02T00:00:00.000Z",
        "ml_details": {
            "risk_engine": {
                "governed_risk_fusion": {
                    "risk_score": 15.5,
                    "risk_class": "SAFE",
                    "disposition": "PASS",
                    "contract_version": "1.0.0",
                    "contract_sha256": "44a8dfe889568c9ad91f1a4b6bd0ad10fdca691758b318f40d71b7b71681d6bf",
                }
            }
        },
    }
    register_authoritative_prediction(rf_rec)
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-RF-PY-001")
    assert twin["evidence_summary"]["risk_fusion"] == "AVAILABLE"
    assert twin["evidence_blocks"]["risk_fusion"] is not None
    assert twin["evidence_blocks"]["risk_fusion"]["risk_score"] == 15.5
    rf_evts = [e for e in twin["longitudinal_timeline"] if e["stage"] == "RISK_FUSION_DECISION"]
    assert len(rf_evts) == 1
    assert rf_evts[0]["provenance"]["source_type"] == "RISK_FUSION_GATE"


def test_t10_missing_risk_fusion_returns_insufficient():
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-PARTIAL-PY-001")
    assert twin["evidence_summary"]["risk_fusion"] == "INSUFFICIENT_EVIDENCE"
    assert twin["evidence_blocks"]["risk_fusion"] is None
    rf_evts = [e for e in twin["longitudinal_timeline"] if e["stage"] == "RISK_FUSION_DECISION"]
    assert len(rf_evts) == 0


def test_t11_direct_spy_zero_risk_fusion_calls():
    manager = ReliabilityTwinManagerPy()
    with patch.object(GovernedRiskFusionEngine, "evaluate") as mock_rf:
        twin_present = manager.build_reliability_twin("CMP-RF-PY-001")
        assert twin_present["evidence_summary"]["risk_fusion"] == "AVAILABLE"
        assert mock_rf.call_count == 0

        twin_absent = manager.build_reliability_twin("CMP-PARTIAL-PY-001")
        assert twin_absent["evidence_summary"]["risk_fusion"] == "INSUFFICIENT_EVIDENCE"
        assert mock_rf.call_count == 0


def test_t12_explicit_ate_retest_simulator_secondary_test():
    retest_rec = {
        "trace_id": "TR-SEC-ATE-PY-001",
        "component_id": "CMP-SEC-ATE-PY-001",
        "prediction": "PASS",
        "probability": 0.15,
        "secondary_test_result": "PASS",
        "secondary_test_source_type": "ATE_RETEST_SIMULATOR",
        "created_at": "2026-01-02T00:00:00.000Z",
    }
    register_authoritative_prediction(retest_rec)
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-SEC-ATE-PY-001")
    assert twin["evidence_summary"]["secondary_test"] == "AVAILABLE"
    assert twin["evidence_blocks"]["secondary_test"]["secondary_test_source_type"] == "ATE_RETEST_SIMULATOR"
    sec_evts = [e for e in twin["longitudinal_timeline"] if e["stage"] == "SECONDARY_TEST"]
    assert len(sec_evts) == 1
    assert sec_evts[0]["provenance"]["source_type"] == "ATE_RETEST_SIMULATOR"


def test_t13_explicit_synthetic_simulation_secondary_test():
    syn_sec_rec = {
        "trace_id": "TR-SEC-SYN-PY-001",
        "component_id": "CMP-SYN-SEC-PY-001",
        "prediction": "PASS",
        "probability": 0.15,
        "secondary_test_result": "PASS",
        "secondary_test_source_type": "SYNTHETIC_SIMULATION",
        "created_at": "2026-01-02T00:00:00.000Z",
    }
    register_authoritative_prediction(syn_sec_rec)
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-SYN-SEC-PY-001")
    assert twin["evidence_summary"]["secondary_test"] == "AVAILABLE"
    assert twin["evidence_blocks"]["secondary_test"]["secondary_test_source_type"] == "SYNTHETIC_SIMULATION"
    sec_evts = [e for e in twin["longitudinal_timeline"] if e["stage"] == "SECONDARY_TEST"]
    assert len(sec_evts) == 1
    assert sec_evts[0]["provenance"]["source_type"] == "SYNTHETIC_SIMULATION"


def test_t14_secondary_test_with_missing_source_fails_closed():
    unspec_sec_rec = {
        "trace_id": "TR-SEC-UNSPEC-PY-001",
        "component_id": "CMP-SEC-UNSPEC-PY-001",
        "prediction": "PASS",
        "probability": 0.15,
        "secondary_test_result": "PASS",
        # secondary_test_source_type omitted
        "created_at": "2026-01-02T00:00:00.000Z",
    }
    register_authoritative_prediction(unspec_sec_rec)
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-SEC-UNSPEC-PY-001")
    assert twin["evidence_summary"]["secondary_test"] == "INSUFFICIENT_EVIDENCE"
    assert twin["evidence_blocks"]["secondary_test"] is None
    sec_evts = [e for e in twin["longitudinal_timeline"] if e["stage"] == "SECONDARY_TEST"]
    assert len(sec_evts) == 0


def test_t15_historical_model_sha_and_version_preserved():
    rec_with_sha = {
        "trace_id": "TR-HIST-PY-001",
        "component_id": "CMP-HIST-PY-001",
        "prediction": "PASS",
        "probability": 0.05,
        "model_sha256": "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98",
        "model_version": "4.0.0_authoritative",
        "created_at": "2026-01-02T00:00:00.000Z",
    }
    register_authoritative_prediction(rec_with_sha)
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-HIST-PY-001")
    assert twin["provenance"]["historical_model_sha256"] == "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"
    assert twin["provenance"]["historical_model_version"] == "4.0.0_authoritative"
    assert twin["provenance"]["system_verified_model_sha256"] == manager.expected_model_sha


def test_t16_missing_historical_model_sha_remains_none():
    rec_no_sha = {
        "trace_id": "TR-NOSHA-PY-001",
        "component_id": "CMP-NOSHA-PY-001",
        "prediction": "PASS",
        "probability": 0.05,
        "created_at": "2026-01-02T00:00:00.000Z",
    }
    register_authoritative_prediction(rec_no_sha)
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-NOSHA-PY-001")
    assert twin["provenance"]["historical_model_sha256"] is None


def test_t17_operator_disposition_preserved(setup_auth_prediction):
    disp_mgr = HumanDispositionManagerPy()
    disp_mgr.record_disposition(
        trace_id="TR-T13-001",
        disposition="HOLD",
        reason_code="FALSE_POSITIVE_SUSPECTED",
        operator_id="OP-T13",
        comment="Testing operator disposition stage",
        require_durable_persistence=False,
    )
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("TR-T13-001")
    assert twin["evidence_summary"]["operator_disposition"] == "AVAILABLE"
    assert len(twin["evidence_blocks"]["operator_dispositions"]) > 0


def test_t18_outcome_evidence_preserved(setup_auth_prediction):
    disp_mgr = HumanDispositionManagerPy()
    disp_mgr.register_outcome_evidence(
        trace_id="TR-T13-001",
        disposition_id="DISP-T13-001",
        evidence_type="QUALIFIED_LAB_REPORT",
        evidence_status="EVIDENCE_RECORDED",
        evidence_source="PHYSICAL_LAB",
        recorded_by="ENG-T13",
        require_durable_persistence=False,
    )
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("TR-T13-001")
    assert twin["evidence_summary"]["outcome_evidence"] == "AVAILABLE"
    assert len(twin["evidence_blocks"]["outcome_evidence"]) > 0


def test_t19_adjudication_preserved(setup_auth_prediction):
    disp_mgr = HumanDispositionManagerPy()
    disp_mgr.adjudicate_outcome(
        "TR-T13-001",
        adjudicator_identity="QUAL-LEAD-01",
        adjudicator_role="QUALITY_ENGINEER",
        proposed_outcome="PASS",
        rationale="Formal QA review completed",
        require_durable_persistence=False,
    )
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("TR-T13-001")
    assert twin["evidence_summary"]["adjudication"] == "AVAILABLE"
    assert twin["evidence_summary"]["ground_truth_status"] == "VALIDATED_GROUND_TRUTH"


def test_t20_immutability_across_twin_mutations(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-T13-001")
    twin["evidence_blocks"]["ml_evaluation"]["prediction"] = "MUTATED"
    twin["evidence_blocks"]["ml_evaluation"]["probability"] = 0.99999
    fresh_twin = manager.build_reliability_twin("CMP-T13-001")
    assert fresh_twin["evidence_blocks"]["ml_evaluation"]["prediction"] == setup_auth_prediction["prediction"]
    assert fresh_twin["evidence_blocks"]["ml_evaluation"]["probability"] == setup_auth_prediction["probability"]


def test_t21_deterministic_twin_output(setup_auth_prediction):
    manager = ReliabilityTwinManagerPy()
    twin1 = manager.build_reliability_twin("CMP-T13-001")
    twin2 = manager.build_reliability_twin("CMP-T13-001")
    assert twin1 == twin2


def test_t22_phase11_12_compatibility():
    gate = EvaluationIntegrityGatePy()
    m_check = gate.verify_production_model_protection()
    p_check = gate.verify_production_manifest_protection()
    assert m_check["valid"] is True
    assert p_check["valid"] is True
