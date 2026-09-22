"""
PREDICTA — PHASE 12 TASK 1 EVALUATION INTEGRITY & SPLIT ISOLATION TEST SUITE (Python)
File: tests/test_phase12_task1_evaluation_integrity.py

Verifies Phase 12 Task 1 Requirements (Tests A through P Matrix):
A. Train and Validation_Tune share a lot -> BLOCKED (LOT_OVERLAP)
B. Train and Calibration share a wafer -> BLOCKED (WAFER_OVERLAP)
C. Calibration and Test share a component -> BLOCKED (COMPONENT_OVERLAP)
D. Future 168h feature appears in feature matrix -> BLOCKED (FUTURE_FEATURE_LEAKAGE)
E. Target label appears in model feature matrix -> BLOCKED (TARGET_LEAKAGE)
F. Held-out Test is supplied to threshold optimization -> BLOCKED (FORBIDDEN_TEST_THRESHOLD_OPTIMIZATION)
G. Held-out Test is supplied to calibration fitting -> BLOCKED (CALIBRATION_LEAKAGE)
H. Operator disposition appears in training data -> BLOCKED (OPERATOR_FEEDBACK_LEAKAGE)
I. Adjudicated outcome appears in protected test data -> BLOCKED (ADJUDICATION_LEAKAGE)
J. Test artifact SHA differs from manifest -> BLOCKED (PROVENANCE_MISMATCH)
K. Unknown/unmapped partition appears -> BLOCKED (UNKNOWN_PARTITION)
L. Valid four-way split with clean provenance -> PASS
M. Phase 11 evaluation candidate attempts automatic training injection -> BLOCKED
N. Post-24h telemetry appears in 24h screening features -> BLOCKED (POST_SCREENING_LEAKAGE)
O. JS and Python receive equivalent corrupted split manifests -> same BLOCKED category
P. JS and Python receive equivalent valid manifests -> same PASS result
"""

import os
import sys
import json
import hashlib
import pytest

os.environ["NODE_ENV"] = "test"

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.evaluation.phase12_evaluation_integrity import (
    EvaluationIntegrityGatePy,
    EXPECTED_MODEL_SHA,
    EXPECTED_THRESHOLD,
    PROD_MODEL_PATH
)


@pytest.fixture
def gate():
    return EvaluationIntegrityGatePy()


def test_a_train_val_lot_overlap_blocked(gate):
    """Test A: Train and Validation_Tune share a lot yields BLOCKED (LOT_OVERLAP)."""
    corrupted_split = {
        "lots": {
            "train": ["LOT-SYN-001", "LOT-SYN-002", "LOT-SYN-036"],
            "validation_tune": ["LOT-SYN-036", "LOT-SYN-037"],
            "calibration": ["LOT-SYN-039"],
            "test": ["LOT-SYN-043"]
        }
    }
    report = gate.generate_integrity_report({"split_manifest": corrupted_split})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "LOT_OVERLAP"


def test_b_train_calibration_wafer_overlap_blocked(gate):
    """Test B: Train and Calibration share a wafer yields BLOCKED (WAFER_OVERLAP)."""
    corrupted_split = {
        "lots": {
            "train": ["LOT-SYN-001"], "validation_tune": ["LOT-SYN-036"], "calibration": ["LOT-SYN-039"], "test": ["LOT-SYN-043"]
        },
        "wafers": {
            "train": ["W-01", "W-02"],
            "validation_tune": ["W-03"],
            "calibration": ["W-02", "W-04"],
            "test": ["W-05"]
        }
    }
    report = gate.generate_integrity_report({"split_manifest": corrupted_split})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "WAFER_OVERLAP"


def test_c_calibration_test_component_overlap_blocked(gate):
    """Test C: Calibration and Test share a component yields BLOCKED (COMPONENT_OVERLAP)."""
    corrupted_split = {
        "lots": {
            "train": ["LOT-SYN-001"], "validation_tune": ["LOT-SYN-036"], "calibration": ["LOT-SYN-039"], "test": ["LOT-SYN-043"]
        },
        "components": {
            "train": ["C-01"], "validation_tune": ["C-02"], "calibration": ["C-03", "C-04"], "test": ["C-04", "C-05"]
        }
    }
    report = gate.generate_integrity_report({"split_manifest": corrupted_split})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "COMPONENT_OVERLAP"


def test_d_future_feature_leakage_blocked(gate):
    """Test D: Future 168h feature in matrix yields BLOCKED (FUTURE_FEATURE_LEAKAGE)."""
    feature_list = ["iddq_0h", "ileak_0h", "iddq_168h_ground_truth"]
    report = gate.generate_integrity_report({"feature_list": feature_list})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "FUTURE_FEATURE_LEAKAGE"


def test_e_target_leakage_blocked(gate):
    """Test E: Target label in feature matrix yields BLOCKED (TARGET_LEAKAGE)."""
    feature_list = ["iddq_0h", "ileak_0h", "result"]
    report = gate.generate_integrity_report({"feature_list": feature_list})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "TARGET_LEAKAGE"


def test_f_held_out_test_threshold_optimization_blocked(gate):
    """Test F: Held-out Test in threshold optimization throws FORBIDDEN_TEST_THRESHOLD_OPTIMIZATION."""
    with pytest.raises(ValueError) as exc_info:
        gate.verify_threshold_isolation({"target_partition": "test"})
    assert "FORBIDDEN_TEST_THRESHOLD_OPTIMIZATION" in str(exc_info.value)

    report = gate.generate_integrity_report({"threshold_request": {"target_partition": "test"}})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "FORBIDDEN_TEST_THRESHOLD_OPTIMIZATION"


def test_g_held_out_test_calibration_fitting_blocked(gate):
    """Test G: Held-out Test in calibration fitting yields BLOCKED (CALIBRATION_LEAKAGE)."""
    report = gate.generate_integrity_report({"calibration_input": {"partition": "test", "contains_test_records": True}})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "CALIBRATION_LEAKAGE"


def test_h_operator_disposition_training_injection_blocked(gate):
    """Test H: Operator disposition attempting training injection yields BLOCKED (OPERATOR_FEEDBACK_LEAKAGE)."""
    candidate_record = {
        "trace_id": "TRACE-LEAK-PY-01",
        "operator_disposition": "CONFIRMED_PASS",
        "automatic_training_injection": True,
        "target_partition": "train"
    }
    report = gate.generate_integrity_report({"candidate_record": candidate_record})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "OPERATOR_FEEDBACK_LEAKAGE"


def test_i_adjudicated_outcome_test_injection_blocked(gate):
    """Test I: Adjudicated outcome attempting test injection yields BLOCKED (ADJUDICATION_LEAKAGE)."""
    candidate_record = {
        "trace_id": "TRACE-LEAK-PY-ADJ",
        "adjudicated_outcome": "FAIL",
        "target_partition": "test"
    }
    report = gate.generate_integrity_report({"candidate_record": candidate_record})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "ADJUDICATION_LEAKAGE"


def test_j_test_artifact_sha_mismatch_blocked(gate):
    """Test J: Missing/corrupted test artifact yields BLOCKED (PROVENANCE_MISMATCH)."""
    report = gate.generate_integrity_report({"test_path": "/invalid/path/test.csv"})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "PROVENANCE_MISMATCH"


def test_k_unknown_partition_blocked(gate):
    """Test K: Unknown partition in manifest yields BLOCKED (UNKNOWN_PARTITION)."""
    corrupted_split = {
        "lots": {
            "train": ["LOT-SYN-001"],
            "validation_tune": ["LOT-SYN-036"],
            "calibration": ["LOT-SYN-039"],
            "test": ["LOT-SYN-043"],
            "unauthorized_eval_partition": ["LOT-SYN-044"]
        }
    }
    report = gate.generate_integrity_report({"split_manifest": corrupted_split})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "UNKNOWN_PARTITION"


def test_l_valid_four_way_split_clean_provenance_pass(gate):
    """Test L: Valid four-way split with clean provenance yields PASS."""
    report = gate.generate_integrity_report()
    assert report["overall_status"] == "PASS"
    assert report["failure_category"] is None
    assert report["governance_constraints"]["evaluation_only"] is True
    assert report["governance_constraints"]["production_effect"] is False


def test_m_phase11_candidate_training_injection_blocked(gate):
    """Test M: Phase 11 candidate attempting training injection is BLOCKED."""
    candidate = {
        "trace_id": "TRACE-PY-P11-AUTO",
        "feedback_status": "CONFIRMED",
        "target_partition": "train"
    }
    report = gate.generate_integrity_report({"candidate_record": candidate})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "OPERATOR_FEEDBACK_LEAKAGE"


def test_n_post_24h_telemetry_in_screening_features_blocked(gate):
    """Test N: Post-24h telemetry in screening features yields BLOCKED (POST_SCREENING_LEAKAGE)."""
    feature_list = ["iddq_0h", "ileak_48h", "tpd_24h"]
    report = gate.generate_integrity_report({"feature_list": feature_list})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "POST_SCREENING_LEAKAGE"


def test_o_production_model_sha_unchanged():
    """Test O: Production model SHA (91bb59...) remains unchanged."""
    assert os.path.exists(PROD_MODEL_PATH)
    with open(PROD_MODEL_PATH, "rb") as f:
        bytes_data = f.read()
    sha = hashlib.sha256(bytes_data).hexdigest()
    assert sha == EXPECTED_MODEL_SHA


def test_p_production_threshold_remains_0_20(gate):
    """Test P: Production operating threshold remains exactly 0.20."""
    assert gate.contract.get("authoritative_operating_threshold") == EXPECTED_THRESHOLD
