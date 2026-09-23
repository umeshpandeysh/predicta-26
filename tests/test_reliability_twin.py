"""
Authoritative Phase 13 Task 2 — Digital Reliability Twin Comprehensive Test Suite (Python)
File: tests/test_reliability_twin.py

Validates complete 10-stage evidence chain & anti-fabrication constraints:
 - Test Group A: Model Identifier (explicit preserved vs missing null)
 - Test Group B: Prognostic Identifier (explicit preserved vs missing null)
 - Test Group C: Physics Provenance (explicit preserved vs missing null with AVAILABLE evidence)
 - Test Group D: Risk Fusion Provenance (explicit preserved vs missing null with AVAILABLE evidence)
 - Test Group E: Secondary Test (explicit ATE_RETEST_SIMULATOR / SYNTHETIC_SIMULATION vs missing/unknown/invalid fails closed)
 - Test Group F: Zero-recomputation spies (0 live inference / physics / risk-fusion calls across present/absent/unregistered)
 - Test Group G: Strict Anti-Fabrication assertions (checks forbidden outputs when unprovided)
 - Identity, immutability, determinism, and Phase 11/12 compatibility
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


# -------------------------------------------------------------------------
# TEST GROUP A: ML MODEL IDENTIFIER
# -------------------------------------------------------------------------
def test_group_a1_explicit_ml_model_identifier_preserved():
    rec = {
        "trace_id": "TR-A1-PY-001",
        "component_id": "CMP-A1-PY-001",
        "prediction": "PASS",
        "probability": 0.05,
        "model_identifier": "historical-model-xyz",
        "created_at": "2026-01-02T00:00:00.000Z",
    }
    register_authoritative_prediction(rec)
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-A1-PY-001")
    assert twin["evidence_blocks"]["ml_evaluation"]["provenance"]["model_identifier"] == "historical-model-xyz"


def test_group_a2_missing_ml_model_identifier_remains_none():
    rec = {
        "trace_id": "TR-A2-PY-001",
        "component_id": "CMP-A2-PY-001",
        "prediction": "PASS",
        "probability": 0.05,
        "created_at": "2026-01-02T00:00:00.000Z",
    }
    register_authoritative_prediction(rec)
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-A2-PY-001")
    assert twin["evidence_blocks"]["ml_evaluation"]["provenance"]["model_identifier"] is None


# -------------------------------------------------------------------------
# TEST GROUP B: PROGNOSTIC IDENTIFIER
# -------------------------------------------------------------------------
def test_group_b1_explicit_prognostic_identifier_preserved():
    rec = {
        "trace_id": "TR-B1-PY-001",
        "component_id": "CMP-B1-PY-001",
        "prediction": "PASS",
        "probability": 0.05,
        "created_at": "2026-01-02T00:00:00.000Z",
        "ml_details": {
            "drift_prediction": {
                "drift_detected": False,
                "model_identifier": "historical-gpr-custom-v2",
            }
        },
    }
    register_authoritative_prediction(rec)
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-B1-PY-001")
    assert twin["evidence_summary"]["prognostic_evidence"] == "AVAILABLE"
    prg_evts = [e for e in twin["longitudinal_timeline"] if e["stage"] == "PROGNOSTIC_EVIDENCE"]
    assert prg_evts[0]["provenance"]["model_identifier"] == "historical-gpr-custom-v2"


def test_group_b2_missing_prognostic_identifier_remains_none():
    rec = {
        "trace_id": "TR-B2-PY-001",
        "component_id": "CMP-B2-PY-001",
        "prediction": "PASS",
        "probability": 0.05,
        "created_at": "2026-01-02T00:00:00.000Z",
        "ml_details": {
            "drift_prediction": {
                "drift_detected": False,
            }
        },
    }
    register_authoritative_prediction(rec)
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-B2-PY-001")
    assert twin["evidence_summary"]["prognostic_evidence"] == "AVAILABLE"
    prg_evts = [e for e in twin["longitudinal_timeline"] if e["stage"] == "PROGNOSTIC_EVIDENCE"]
    assert prg_evts[0]["provenance"]["model_identifier"] is None


# -------------------------------------------------------------------------
# TEST GROUP C: PHYSICS PROVENANCE
# -------------------------------------------------------------------------
def test_group_c1_physics_explicit_provenance_preserved():
    rec = {
        "trace_id": "TR-C1-PY-001",
        "component_id": "CMP-C1-PY-001",
        "prediction": "PASS",
        "probability": 0.05,
        "created_at": "2026-01-02T00:00:00.000Z",
        "ml_details": {
            "physics": {
                "physics_consistency_status": "PHYSICS_CONSISTENT",
                "physics_consistency_score": 1.0,
                "provenance": {
                    "source_type": "PHYSICS_AGING_ENGINE",
                    "model_identifier": "historical-physics-engine",
                    "model_version": "2.3.1",
                    "model_sha256": "a1b2c3d4e5f6",
                },
            }
        },
    }
    register_authoritative_prediction(rec)
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-C1-PY-001")
    assert twin["evidence_summary"]["physics_reliability"] == "AVAILABLE"
    phys_evts = [e for e in twin["longitudinal_timeline"] if e["stage"] == "PHYSICS_RELIABILITY_EVIDENCE"]
    assert len(phys_evts) == 1
    assert phys_evts[0]["provenance"]["source_type"] == "PHYSICS_AGING_ENGINE"
    assert phys_evts[0]["provenance"]["model_identifier"] == "historical-physics-engine"
    assert phys_evts[0]["provenance"]["model_version"] == "2.3.1"
    assert phys_evts[0]["provenance"]["model_sha256"] == "a1b2c3d4e5f6"


def test_group_c2_physics_missing_provenance_yields_none_fields_and_available():
    rec = {
        "trace_id": "TR-C2-PY-001",
        "component_id": "CMP-C2-PY-001",
        "prediction": "PASS",
        "probability": 0.05,
        "created_at": "2026-01-02T00:00:00.000Z",
        "ml_details": {
            "physics": {
                "physics_consistency_status": "PHYSICS_CONSISTENT",
                "physics_consistency_score": 1.0,
            }
        },
    }
    register_authoritative_prediction(rec)
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-C2-PY-001")
    assert twin["evidence_summary"]["physics_reliability"] == "AVAILABLE"
    phys_evts = [e for e in twin["longitudinal_timeline"] if e["stage"] == "PHYSICS_RELIABILITY_EVIDENCE"]
    assert len(phys_evts) == 1
    assert phys_evts[0]["provenance"]["source_type"] is None
    assert phys_evts[0]["provenance"]["model_identifier"] is None
    assert phys_evts[0]["provenance"]["model_version"] is None
    assert phys_evts[0]["provenance"]["model_sha256"] is None


# -------------------------------------------------------------------------
# TEST GROUP D: RISK FUSION PROVENANCE
# -------------------------------------------------------------------------
def test_group_d1_risk_fusion_explicit_provenance_preserved():
    rec = {
        "trace_id": "TR-D1-PY-001",
        "component_id": "CMP-D1-PY-001",
        "prediction": "PASS",
        "probability": 0.05,
        "created_at": "2026-01-02T00:00:00.000Z",
        "ml_details": {
            "risk_engine": {
                "governed_risk_fusion": {
                    "risk_score": 15.5,
                    "risk_class": "SAFE",
                    "disposition": "PASS",
                    "provenance": {
                        "source_type": "RISK_FUSION_GATE",
                        "model_identity": "rf-model-custom",
                        "contract_version": "2.0.0",
                        "contract_sha256": "44a8dfe889568c9ad91f1a4b6bd0ad10fdca691758b318f40d71b7b71681d6bf",
                    },
                }
            }
        },
    }
    register_authoritative_prediction(rec)
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-D1-PY-001")
    assert twin["evidence_summary"]["risk_fusion"] == "AVAILABLE"
    rf_evts = [e for e in twin["longitudinal_timeline"] if e["stage"] == "RISK_FUSION_DECISION"]
    assert len(rf_evts) == 1
    assert rf_evts[0]["provenance"]["source_type"] == "RISK_FUSION_GATE"
    assert rf_evts[0]["provenance"]["model_identifier"] == "rf-model-custom"
    assert rf_evts[0]["provenance"]["model_version"] == "2.0.0"
    assert rf_evts[0]["provenance"]["model_sha256"] == "44a8dfe889568c9ad91f1a4b6bd0ad10fdca691758b318f40d71b7b71681d6bf"


def test_group_d2_risk_fusion_missing_provenance_yields_none_fields_and_available():
    rec = {
        "trace_id": "TR-D2-PY-001",
        "component_id": "CMP-D2-PY-001",
        "prediction": "PASS",
        "probability": 0.05,
        "created_at": "2026-01-02T00:00:00.000Z",
        "ml_details": {
            "risk_engine": {
                "governed_risk_fusion": {
                    "risk_score": 15.5,
                    "risk_class": "SAFE",
                    "disposition": "PASS",
                }
            }
        },
    }
    register_authoritative_prediction(rec)
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-D2-PY-001")
    assert twin["evidence_summary"]["risk_fusion"] == "AVAILABLE"
    rf_evts = [e for e in twin["longitudinal_timeline"] if e["stage"] == "RISK_FUSION_DECISION"]
    assert len(rf_evts) == 1
    assert rf_evts[0]["provenance"]["source_type"] is None
    assert rf_evts[0]["provenance"]["model_identifier"] is None
    assert rf_evts[0]["provenance"]["model_version"] is None
    assert rf_evts[0]["provenance"]["model_sha256"] is None


# -------------------------------------------------------------------------
# TEST GROUP E: SECONDARY TEST PROVENANCE FAIL-CLOSED
# -------------------------------------------------------------------------
def test_group_e1_explicit_ate_retest_simulator():
    rec = {
        "trace_id": "TR-E1-PY-001",
        "component_id": "CMP-E1-PY-001",
        "prediction": "PASS",
        "probability": 0.15,
        "secondary_test_result": "PASS",
        "secondary_test_source_type": "ATE_RETEST_SIMULATOR",
        "created_at": "2026-01-02T00:00:00.000Z",
    }
    register_authoritative_prediction(rec)
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-E1-PY-001")
    assert twin["evidence_summary"]["secondary_test"] == "AVAILABLE"
    assert twin["evidence_blocks"]["secondary_test"]["secondary_test_source_type"] == "ATE_RETEST_SIMULATOR"


def test_group_e2_explicit_synthetic_simulation():
    rec = {
        "trace_id": "TR-E2-PY-001",
        "component_id": "CMP-E2-PY-001",
        "prediction": "PASS",
        "probability": 0.15,
        "secondary_test_result": "PASS",
        "secondary_test_source_type": "SYNTHETIC_SIMULATION",
        "created_at": "2026-01-02T00:00:00.000Z",
    }
    register_authoritative_prediction(rec)
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-E2-PY-001")
    assert twin["evidence_summary"]["secondary_test"] == "AVAILABLE"
    assert twin["evidence_blocks"]["secondary_test"]["secondary_test_source_type"] == "SYNTHETIC_SIMULATION"


def test_group_e3_missing_secondary_test_source_type_fails_closed():
    rec = {
        "trace_id": "TR-E3-PY-001",
        "component_id": "CMP-E3-PY-001",
        "prediction": "PASS",
        "probability": 0.15,
        "secondary_test_result": "PASS",
        "created_at": "2026-01-02T00:00:00.000Z",
    }
    register_authoritative_prediction(rec)
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-E3-PY-001")
    assert twin["evidence_summary"]["secondary_test"] == "INSUFFICIENT_EVIDENCE"
    assert twin["evidence_blocks"]["secondary_test"] is None
    evts = [e for e in twin["longitudinal_timeline"] if e["stage"] == "SECONDARY_TEST"]
    assert len(evts) == 0


def test_group_e4_invalid_secondary_test_source_type_fails_closed():
    rec = {
        "trace_id": "TR-E4-PY-001",
        "component_id": "CMP-E4-PY-001",
        "prediction": "PASS",
        "probability": 0.15,
        "secondary_test_result": "PASS",
        "secondary_test_source_type": "INVALID_LAB_SIMULATOR",
        "created_at": "2026-01-02T00:00:00.000Z",
    }
    register_authoritative_prediction(rec)
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-E4-PY-001")
    assert twin["evidence_summary"]["secondary_test"] == "INSUFFICIENT_EVIDENCE"
    assert twin["evidence_blocks"]["secondary_test"] is None
    evts = [e for e in twin["longitudinal_timeline"] if e["stage"] == "SECONDARY_TEST"]
    assert len(evts) == 0


# -------------------------------------------------------------------------
# TEST GROUP F: ZERO RECOMPUTATION SPIES
# -------------------------------------------------------------------------
def test_group_f1_direct_spy_zero_physics_calls():
    manager = ReliabilityTwinManagerPy()
    with patch.object(PhysicsReliabilityEngine, "evaluate_bti_consistency") as mock_bti:
        twin_present = manager.build_reliability_twin("CMP-C1-PY-001")
        assert twin_present["evidence_summary"]["physics_reliability"] == "AVAILABLE"
        assert mock_bti.call_count == 0

        twin_absent = manager.build_reliability_twin("CMP-PARTIAL-PY-001")
        assert twin_absent["evidence_summary"]["physics_reliability"] == "INSUFFICIENT_EVIDENCE"
        assert mock_bti.call_count == 0

        twin_unreg = manager.build_reliability_twin("CMP-UNREGISTERED-PY-SPY")
        assert twin_unreg["evidence_summary"]["physics_reliability"] == "INSUFFICIENT_EVIDENCE"
        assert mock_bti.call_count == 0


def test_group_f2_direct_spy_zero_risk_fusion_calls():
    manager = ReliabilityTwinManagerPy()
    with patch.object(GovernedRiskFusionEngine, "evaluate") as mock_rf:
        twin_present = manager.build_reliability_twin("CMP-D1-PY-001")
        assert twin_present["evidence_summary"]["risk_fusion"] == "AVAILABLE"
        assert mock_rf.call_count == 0

        twin_absent = manager.build_reliability_twin("CMP-PARTIAL-PY-001")
        assert twin_absent["evidence_summary"]["risk_fusion"] == "INSUFFICIENT_EVIDENCE"
        assert mock_rf.call_count == 0

        twin_unreg = manager.build_reliability_twin("CMP-UNREGISTERED-PY-SPY")
        assert twin_unreg["evidence_summary"]["risk_fusion"] == "INSUFFICIENT_EVIDENCE"
        assert mock_rf.call_count == 0


# -------------------------------------------------------------------------
# TEST GROUP G: ANTI-FABRICATION CATCH TEST
# -------------------------------------------------------------------------
def test_group_g1_anti_fabrication_forbidden_defaults_never_appear():
    unadorned_rec = {
        "trace_id": "TR-ANTI-FAB-PY-001",
        "component_id": "CMP-ANTI-FAB-PY-001",
        "prediction": "PASS",
        "probability": 0.10,
        "created_at": "2026-01-02T00:00:00.000Z",
        "ml_details": {
            "anomaly_detection": {"copod_score": 0.1},
            "drift_prediction": {"drift_detected": False},
            "physics": {"physics_consistency_status": "PHYSICS_CONSISTENT"},
            "risk_engine": {"governed_risk_fusion": {"risk_score": 10}},
        },
    }
    register_authoritative_prediction(unadorned_rec)
    manager = ReliabilityTwinManagerPy()
    twin = manager.build_reliability_twin("CMP-ANTI-FAB-PY-001")

    # 1. ML model identifier must not be "predicta_xgboost_model"
    assert twin["evidence_blocks"]["ml_evaluation"]["provenance"]["model_identifier"] is not "predicta_xgboost_model"
    assert twin["evidence_blocks"]["ml_evaluation"]["provenance"]["model_identifier"] is None

    # 2. Prognostic model identifier must not be "predicta_gpr_kernel_artifacts"
    prg_evts = [e for e in twin["longitudinal_timeline"] if e["stage"] == "PROGNOSTIC_EVIDENCE"]
    assert prg_evts[0]["provenance"]["model_identifier"] is not "predicta_gpr_kernel_artifacts"
    assert prg_evts[0]["provenance"]["model_identifier"] is None

    # 3. Physics source_type must not be "PHYSICS_AGING_ENGINE"
    phys_evts = [e for e in twin["longitudinal_timeline"] if e["stage"] == "PHYSICS_RELIABILITY_EVIDENCE"]
    assert phys_evts[0]["provenance"]["source_type"] is not "PHYSICS_AGING_ENGINE"
    assert phys_evts[0]["provenance"]["source_type"] is None

    # 4. Risk fusion source_type must not be "RISK_FUSION_GATE"
    rf_evts = [e for e in twin["longitudinal_timeline"] if e["stage"] == "RISK_FUSION_DECISION"]
    assert rf_evts[0]["provenance"]["source_type"] is not "RISK_FUSION_GATE"
    assert rf_evts[0]["provenance"]["source_type"] is None

    # 5. Risk fusion contract_version / model_version must not default to "1.0.0"
    assert rf_evts[0]["provenance"]["model_version"] is not "1.0.0"
    assert rf_evts[0]["provenance"]["model_version"] is None

    # 6. Historical model SHA must not default to current production model SHA
    assert twin["provenance"]["historical_model_sha256"] is not manager.expected_model_sha
    assert twin["provenance"]["historical_model_sha256"] is None


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
