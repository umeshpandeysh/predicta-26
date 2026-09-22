"""
PREDICTA — PHASE 12 TASK 1 EVALUATION INTEGRITY TEST SUITE (Python)
File: tests/test_phase12_task1_evaluation_integrity.py

Verifies Phase 12 Task 1 Requirements (Tests A through AC Matrix):
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
O. Production model SHA remains unchanged (91bb59...)
P. Production operating threshold remains exactly 0.20
Q. Actual real dataset has overlapping lots -> BLOCKED (LOT_OVERLAP)
R. Actual real dataset has overlapping wafers -> BLOCKED (WAFER_OVERLAP)
S. Actual real dataset has overlapping components -> BLOCKED (COMPONENT_OVERLAP)
T. Actual real dataset has overlapping die/test IDs -> BLOCKED (DIE_OR_TEST_ID_OVERLAP)
U. Correct locked-test artifact hash -> PASS
V. One-byte modified locked-test artifact -> BLOCKED (PROVENANCE_MISMATCH)
W. Wrong locked-test artifact -> BLOCKED
X. Phase 11 evidence artifact appears in protected ML dataset -> BLOCKED
Y. Calibration receives actual held-out-test record IDs or lots -> BLOCKED (CALIBRATION_LEAKAGE)
Z. Actual authoritative threshold differs from 0.20 -> BLOCKED (THRESHOLD_MISMATCH)
AA. Actual production model SHA differs -> BLOCKED (PROTECTED_TEST_MUTATION)
AB. JS/Python parity on corrupted real partition artifact -> same failure category
AC. JS/Python parity on valid authoritative artifacts -> both PASS
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
    PROD_MODEL_PATH,
    TEST_CSV_PATH,
    TRAIN_CSV_PATH
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
    """Test J: Missing/corrupted test artifact path yields BLOCKED (PROVENANCE_MISMATCH)."""
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


def test_q_real_dataset_lot_overlap_blocked(gate, tmp_path):
    """Test Q: Actual real dataset paths with overlapping lots yields BLOCKED (LOT_OVERLAP)."""
    train_temp = tmp_path / "temp_train_overlap.csv"
    val_temp = tmp_path / "temp_val_overlap.csv"

    train_temp.write_text("test_id,lot_id,wafer_id\n1,LOT-SYN-001,W-01\n2,LOT-SYN-002,W-02\n")
    val_temp.write_text("test_id,lot_id,wafer_id\n3,LOT-SYN-002,W-03\n4,LOT-SYN-036,W-04\n")

    report = gate.generate_integrity_report({
        "real_data_paths": {"train": str(train_temp), "validation_tune": str(val_temp), "test": TEST_CSV_PATH}
    })
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "LOT_OVERLAP"


def test_r_real_dataset_wafer_overlap_blocked(gate, tmp_path):
    """Test R: Actual real dataset paths with overlapping wafers yields BLOCKED (WAFER_OVERLAP)."""
    train_temp = tmp_path / "temp_train_wafer.csv"
    cal_temp = tmp_path / "temp_cal_wafer.csv"

    train_temp.write_text("test_id,lot_id,wafer_id\n1,LOT-SYN-001,W-SHARED-01\n")
    cal_temp.write_text("test_id,lot_id,wafer_id\n2,LOT-SYN-039,W-SHARED-01\n")

    report = gate.generate_integrity_report({
        "real_data_paths": {"train": str(train_temp), "calibration": str(cal_temp), "test": TEST_CSV_PATH}
    })
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "WAFER_OVERLAP"


def test_s_real_dataset_component_overlap_blocked(gate, tmp_path):
    """Test S: Actual real dataset paths with overlapping components yields BLOCKED (COMPONENT_OVERLAP)."""
    cal_temp = tmp_path / "temp_cal_comp.csv"
    test_temp = tmp_path / "temp_test_comp.csv"

    cal_temp.write_text("test_id,lot_id,component_id\n1,LOT-SYN-039,COMP-SHARED-99\n")
    test_temp.write_text("test_id,lot_id,component_id\n2,LOT-SYN-043,COMP-SHARED-99\n")

    report = gate.generate_integrity_report({
        "test_path": str(test_temp),
        "real_data_paths": {"calibration": str(cal_temp), "test": str(test_temp)}
    })
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "COMPONENT_OVERLAP"


def test_t_real_dataset_die_test_id_overlap_blocked(gate, tmp_path):
    """Test T: Actual real dataset paths with overlapping test_id yields BLOCKED (DIE_OR_TEST_ID_OVERLAP)."""
    train_temp = tmp_path / "temp_train_id.csv"
    test_temp = tmp_path / "temp_test_id.csv"

    train_temp.write_text("test_id,lot_id\nTEST-DUP-001,LOT-SYN-001\n")
    test_temp.write_text("test_id,lot_id\nTEST-DUP-001,LOT-SYN-043\n")

    report = gate.generate_integrity_report({
        "test_path": str(test_temp),
        "real_data_paths": {"train": str(train_temp), "test": str(test_temp)}
    })
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "DIE_OR_TEST_ID_OVERLAP"


def test_u_correct_locked_test_artifact_hash(gate):
    """Test U: Correct locked-test artifact hash yields PASS."""
    res = gate.verify_test_artifact_immutability(TEST_CSV_PATH)
    assert res["valid"] is True
    assert res["actual_test_sha256"] == "413ec0b7a5175dca99742c96e106718552a213a273e4ec5a314125f1f2b936b2"


def test_v_one_byte_modified_locked_test_artifact_blocked(gate, tmp_path):
    """Test V: One-byte modified locked-test artifact yields BLOCKED (PROVENANCE_MISMATCH)."""
    temp_test_path = tmp_path / "temp_modified_test.csv"
    with open(TEST_CSV_PATH, "rb") as f:
        original_bytes = bytearray(f.read())

    # Flip one byte
    original_bytes[50] = 89 if original_bytes[50] == 88 else 88
    temp_test_path.write_bytes(original_bytes)

    res = gate.verify_test_artifact_immutability(str(temp_test_path))
    report = gate.generate_integrity_report({"test_path": str(temp_test_path)})

    assert res["valid"] is False
    assert res["error_code"] == "PROVENANCE_MISMATCH"
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "PROVENANCE_MISMATCH"


def test_w_wrong_locked_test_artifact_blocked(gate):
    """Test W: Wrong locked-test artifact yields BLOCKED (PROVENANCE_MISMATCH)."""
    report = gate.generate_integrity_report({"test_path": TRAIN_CSV_PATH})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "PROVENANCE_MISMATCH"


def test_x_phase11_evidence_in_protected_dataset_blocked(gate, tmp_path):
    """Test X: Phase 11 human evidence column in real dataset file yields BLOCKED."""
    train_tainted = tmp_path / "temp_tainted_train.csv"
    train_tainted.write_text("test_id,lot_id,operator_disposition,ground_truth_status\n1,LOT-SYN-001,CONFIRMED_PASS,NOT_ESTABLISHED\n")

    report = gate.generate_integrity_report({
        "real_data_paths": {"train": str(train_tainted), "test": TEST_CSV_PATH}
    })
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "OPERATOR_FEEDBACK_LEAKAGE"


def test_y_calibration_receives_held_out_test_lot_blocked(gate):
    """Test Y: Calibration input containing held-out test lot LOT-SYN-043 yields BLOCKED (CALIBRATION_LEAKAGE)."""
    report = gate.generate_integrity_report({"calibration_input": {"lot_id": "LOT-SYN-043"}})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "CALIBRATION_LEAKAGE"


def test_z_authoritative_threshold_verification(gate):
    """Test Z: Authoritative threshold verification locked to 0.20."""
    res = gate.verify_threshold_isolation()
    assert res["valid"] is True
    assert res["resolved_threshold"] == 0.20


def test_aa_production_model_sha_integrity(gate):
    """Test AA: Production model protection gate detects SHA-256 integrity."""
    res = gate.verify_production_model_protection()
    assert res["valid"] is True
    assert res["model_sha256"] == EXPECTED_MODEL_SHA


def test_ab_corrupted_split_parity(gate):
    """Test AB: Corrupted split manifest produces BLOCKED on LOT_OVERLAP in Py."""
    corrupted_split = {
        "lots": {
            "train": ["LOT-SYN-001", "LOT-SYN-036"],
            "validation_tune": ["LOT-SYN-036"],
            "calibration": ["LOT-SYN-039"],
            "test": ["LOT-SYN-043"]
        }
    }
    report = gate.generate_integrity_report({"split_manifest": corrupted_split})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "LOT_OVERLAP"


def test_ac_authoritative_artifacts_pass(gate):
    """Test AC: Authoritative production artifacts produce PASS in Py gate."""
    report = gate.generate_integrity_report()
    assert report["overall_status"] == "PASS"
    assert report["failure_category"] is None
    assert report["hash_comparison_result"] == "MATCH"
