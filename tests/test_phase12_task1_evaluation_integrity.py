"""
PREDICTA — PHASE 12 TASK 1 EVALUATION INTEGRITY TEST SUITE (Python)
File: tests/test_phase12_task1_evaluation_integrity.py

Verifies Phase 12 Task 1 Final Certification Requirements (Tests A through AX Matrix):
A-AK: Initial & Intermediate Adversarial Matrix
AL: Actual four-way partition scan (TRAIN, VALIDATION_TUNE, CALIBRATION, HELD_OUT_TEST) -> PASS
AM: Actual calibration artifact contamination (contains test lot) -> CALIBRATION_LEAKAGE
AN: Actual calibration component overlap -> COMPONENT_OVERLAP
AO: Actual calibration test-ID overlap -> DIE_OR_TEST_ID_OVERLAP
AP: Actual record/manifest mismatch -> PARTITION_MEMBERSHIP_CONFLICT
AQ: Missing authoritative test SHA in temporary manifest -> PROVENANCE_MISMATCH
AR: Missing production threshold in temporary production manifest -> THRESHOLD_MISMATCH
AS: Corrupted production threshold (0.25 in temp manifest file) -> THRESHOLD_MISMATCH
AT: Genuine one-byte production model mutation -> PROTECTED_TEST_MUTATION
AU: Complete scan overlap occurring only after row 500 -> LOT_OVERLAP
AV: Missing required group identifier column -> GROUP_PROVENANCE_UNVERIFIABLE
AW: Missing calibration artifact file -> PROVENANCE_MISMATCH
AX: Valid clean four-way authority (all actual artifacts + manifests + group sets) -> PASS
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
    PROD_MANIFEST_PATH,
    DATASET_MANIFEST_PATH,
    SPLIT_MANIFEST_PATH,
    DEFAULT_TRAIN_CSV,
    DEFAULT_VAL_CSV,
    DEFAULT_CAL_CSV,
    DEFAULT_TEST_CSV,
    PROD_TEST_CSV
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
        "real_data_paths": {"train": str(train_temp), "validation_tune": str(val_temp), "calibration": DEFAULT_CAL_CSV, "test": DEFAULT_TEST_CSV}
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
        "real_data_paths": {"train": str(train_temp), "validation_tune": DEFAULT_VAL_CSV, "calibration": str(cal_temp), "test": DEFAULT_TEST_CSV}
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
        "real_data_paths": {"train": DEFAULT_TRAIN_CSV, "validation_tune": DEFAULT_VAL_CSV, "calibration": str(cal_temp), "test": str(test_temp)}
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
        "real_data_paths": {"train": str(train_temp), "validation_tune": DEFAULT_VAL_CSV, "calibration": DEFAULT_CAL_CSV, "test": str(test_temp)}
    })
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "DIE_OR_TEST_ID_OVERLAP"


def test_u_correct_locked_test_artifact_hash(gate):
    """Test U: Correct locked-test artifact hash yields PASS."""
    res = gate.verify_test_artifact_immutability(PROD_TEST_CSV)
    assert res["valid"] is True
    assert res["actual_test_sha256"] == "413ec0b7a5175dca99742c96e106718552a213a273e4ec5a314125f1f2b936b2"


def test_v_one_byte_modified_locked_test_artifact_blocked(gate, tmp_path):
    """Test V: One-byte modified locked-test artifact yields BLOCKED (PROVENANCE_MISMATCH)."""
    temp_test_path = tmp_path / "temp_modified_test.csv"
    with open(DEFAULT_TEST_CSV, "rb") as f:
        original_bytes = bytearray(f.read())

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
    report = gate.generate_integrity_report({"test_path": DEFAULT_TRAIN_CSV})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "PROVENANCE_MISMATCH"


def test_x_phase11_evidence_in_protected_dataset_blocked(gate, tmp_path):
    """Test X: Phase 11 human evidence column in real dataset file yields BLOCKED."""
    train_tainted = tmp_path / "temp_tainted_train.csv"
    train_tainted.write_text("test_id,lot_id,operator_disposition,ground_truth_status\n1,LOT-SYN-001,CONFIRMED_PASS,NOT_ESTABLISHED\n")

    report = gate.generate_integrity_report({
        "real_data_paths": {"train": str(train_tainted), "validation_tune": DEFAULT_VAL_CSV, "calibration": DEFAULT_CAL_CSV, "test": DEFAULT_TEST_CSV}
    })
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "OPERATOR_FEEDBACK_LEAKAGE"


def test_y_calibration_receives_held_out_test_lot_blocked(gate):
    """Test Y: Calibration input containing held-out test lot LOT-SYN-043 yields BLOCKED (CALIBRATION_LEAKAGE)."""
    report = gate.generate_integrity_report({"calibration_input": {"lot_id": "LOT-SYN-043"}})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "CALIBRATION_LEAKAGE"


def test_z_corrupted_production_manifest_blocked(gate, tmp_path):
    """Test Z: Temporary corrupted production manifest (authoritative_threshold: 0.25) yields BLOCKED (THRESHOLD_MISMATCH)."""
    temp_prod_manifest = tmp_path / "temp_corrupted_prod_manifest.json"
    with open(PROD_MANIFEST_PATH, "r", encoding="utf-8") as f:
        real_manifest = json.load(f)
    corrupted_manifest = dict(real_manifest)
    corrupted_manifest["authoritative_threshold"] = 0.25
    temp_prod_manifest.write_text(json.dumps(corrupted_manifest, indent=2))

    report = gate.generate_integrity_report({"custom_prod_manifest_path": str(temp_prod_manifest)})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "THRESHOLD_MISMATCH"


def test_aa_one_byte_mutated_model_blocked(gate, tmp_path):
    """Test AA: Temporary byte-mutated production model yields BLOCKED (PROTECTED_TEST_MUTATION)."""
    temp_model_path = tmp_path / "temp_mutated_model.json"
    with open(PROD_MODEL_PATH, "rb") as f:
        original_bytes = bytearray(f.read())
    original_bytes[20] = 89 if original_bytes[20] == 88 else 88
    temp_model_path.write_bytes(original_bytes)

    report = gate.generate_integrity_report({"custom_model_path": str(temp_model_path)})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "PROTECTED_TEST_MUTATION"


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


def test_ad_row_over_500_overlap_blocked(gate, tmp_path):
    """Test AD: Overlap occurring after row 500 yields BLOCKED (LOT_OVERLAP, 100% scan)."""
    train_large = tmp_path / "temp_train_505.csv"
    test_small = tmp_path / "temp_test_small.csv"

    lines = ["test_id,lot_id,wafer_id"]
    for i in range(1, 501):
        lines.append(f"TEST-L-{i},LOT-SYN-001,W-01")
    lines.append("TEST-L-501,LOT-SYN-043,W-01")
    lines.append("TEST-L-502,LOT-SYN-001,W-01")

    train_large.write_text("\n".join(lines))
    test_small.write_text("test_id,lot_id,wafer_id\nTEST-T-1,LOT-SYN-043,W-50\n")

    report = gate.generate_integrity_report({
        "test_path": str(test_small),
        "real_data_paths": {"train": str(train_large), "validation_tune": DEFAULT_VAL_CSV, "calibration": DEFAULT_CAL_CSV, "test": str(test_small)}
    })

    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "LOT_OVERLAP"


def test_ae_calibration_reconstruction_test_lot_leakage(gate):
    """Test AE: Calibration input referencing test lot LOT-SYN-043 yields BLOCKED (CALIBRATION_LEAKAGE)."""
    report = gate.generate_integrity_report({"calibration_input": {"lot_id": "LOT-SYN-043"}})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "CALIBRATION_LEAKAGE"


def test_af_manifest_membership_conflict_blocked(gate):
    """Test AF: Manifest partition authority conflict yields BLOCKED (PARTITION_MEMBERSHIP_CONFLICT)."""
    report = gate.generate_integrity_report({"check_membership_conflict": True})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "PARTITION_MEMBERSHIP_CONFLICT"


def test_ag_missing_authoritative_test_sha_blocked(gate, tmp_path):
    """Test AG: Missing authoritative test SHA yields BLOCKED (PROVENANCE_MISMATCH)."""
    res = gate.verify_test_artifact_immutability(DEFAULT_TEST_CSV, str(tmp_path / "no1.json"), str(tmp_path / "no2.json"))
    assert res["valid"] is False
    assert res["error_code"] == "PROVENANCE_MISMATCH"


def test_ah_missing_authoritative_threshold_blocked(gate, tmp_path):
    """Test AH: Missing authoritative threshold yields BLOCKED (THRESHOLD_MISMATCH)."""
    temp_no_thresh = tmp_path / "temp_nothresh_prod.json"
    temp_no_thresh.write_text(json.dumps({"model_version": "1.0.0"}))
    with pytest.raises(ValueError) as exc_info:
        gate.verify_threshold_isolation(None, str(temp_no_thresh))
    assert "THRESHOLD_MISMATCH" in str(exc_info.value)


def test_ai_missing_partition_artifact_blocked(gate):
    """Test AI: Missing partition artifact file yields BLOCKED (PROVENANCE_MISMATCH)."""
    report = gate.generate_integrity_report({
        "real_data_paths": {"train": "/nonexistent/train.csv"},
        "require_artifacts_exist": True
    })
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "PROVENANCE_MISMATCH"


def test_aj_missing_group_identifier_blocked(gate, tmp_path):
    """Test AJ: Missing lot_id column yields BLOCKED (GROUP_PROVENANCE_UNVERIFIABLE)."""
    train_no_lot = tmp_path / "temp_train_nolot.csv"
    train_no_lot.write_text("test_id,wafer_id\n1,W-01\n")

    report = gate.generate_integrity_report({
        "real_data_paths": {"train": str(train_no_lot), "validation_tune": DEFAULT_VAL_CSV, "calibration": DEFAULT_CAL_CSV, "test": DEFAULT_TEST_CSV}
    })

    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "GROUP_PROVENANCE_UNVERIFIABLE"


def test_ak_duplicate_lot_assignment_in_manifest_blocked(gate):
    """Test AK: Duplicate lot assignment in manifest yields BLOCKED (PARTITION_MEMBERSHIP_CONFLICT)."""
    corrupted_split = {
        "lots": {
            "train": ["LOT-SYN-001", "LOT-SYN-043"],
            "test": ["LOT-SYN-043"]
        }
    }
    report = gate.generate_integrity_report({"split_manifest": corrupted_split, "expect_conflict": True})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "PARTITION_MEMBERSHIP_CONFLICT"


def test_al_actual_four_way_partition_scan_pass(gate):
    """Test AL: Actual four-way partition scan (TRAIN, VAL, CAL, HELD_OUT_TEST) yields PASS."""
    report = gate.generate_integrity_report({
        "real_data_paths": {
            "train": DEFAULT_TRAIN_CSV,
            "validation_tune": DEFAULT_VAL_CSV,
            "calibration": DEFAULT_CAL_CSV,
            "test": DEFAULT_TEST_CSV
        }
    })
    assert report["overall_status"] == "PASS"
    assert report["manifest_record_consistency"] == "PASS"
    assert "TRAIN" in report["partition_artifacts"]
    assert "VALIDATION_TUNE" in report["partition_artifacts"]
    assert "CALIBRATION" in report["partition_artifacts"]
    assert "HELD_OUT_TEST" in report["partition_artifacts"]


def test_am_actual_calibration_artifact_contamination_blocked(gate, tmp_path):
    """Test AM: Actual calibration artifact containing test lot LOT-SYN-043 yields BLOCKED (CALIBRATION_LEAKAGE)."""
    temp_cal_tainted = tmp_path / "temp_cal_tainted_lot.csv"
    temp_cal_tainted.write_text("component_id,lot_id\nCOMP-001,LOT-SYN-043\n")

    report = gate.generate_integrity_report({
        "calibration_input": {"calibration_path": str(temp_cal_tainted)}
    })
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "CALIBRATION_LEAKAGE"


def test_an_actual_calibration_component_overlap_blocked(gate, tmp_path):
    """Test AN: Actual calibration artifact component overlap yields BLOCKED (COMPONENT_OVERLAP)."""
    temp_cal_comp = tmp_path / "temp_cal_comp.csv"
    temp_test_comp = tmp_path / "temp_test_comp.csv"

    temp_cal_comp.write_text("test_id,lot_id,component_id\n1,LOT-SYN-039,COMP-OVERLAP-01\n")
    temp_test_comp.write_text("test_id,lot_id,component_id\n2,LOT-SYN-043,COMP-OVERLAP-01\n")

    report = gate.generate_integrity_report({
        "test_path": str(temp_test_comp),
        "calibration_input": {"calibration_path": str(temp_cal_comp)}
    })
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "COMPONENT_OVERLAP"


def test_ao_actual_calibration_test_id_overlap_blocked(gate, tmp_path):
    """Test AO: Actual calibration artifact test-ID overlap yields BLOCKED (DIE_OR_TEST_ID_OVERLAP)."""
    temp_cal_testid = tmp_path / "temp_cal_testid.csv"
    temp_test_testid = tmp_path / "temp_test_testid.csv"

    temp_cal_testid.write_text("test_id,lot_id\nTST-DUP-99,LOT-SYN-039\n")
    temp_test_testid.write_text("test_id,lot_id\nTST-DUP-99,LOT-SYN-043\n")

    report = gate.generate_integrity_report({
        "test_path": str(temp_test_testid),
        "calibration_input": {"calibration_path": str(temp_cal_testid)}
    })
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "DIE_OR_TEST_ID_OVERLAP"


def test_ap_record_manifest_mismatch_blocked(gate, tmp_path):
    """Test AP: Record lot assigned to train in manifest placed in validation file yields PARTITION_MEMBERSHIP_CONFLICT."""
    temp_train_clean = tmp_path / "temp_train_clean_lot.csv"
    temp_val_wrong = tmp_path / "temp_val_wrong_lot.csv"
    temp_train_clean.write_text("test_id,lot_id\n1,LOT-SYN-002\n")
    temp_val_wrong.write_text("test_id,lot_id\n2,LOT-SYN-001\n") # LOT-SYN-001 is TRAIN in manifest

    report = gate.generate_integrity_report({
        "real_data_paths": {
            "train": str(temp_train_clean),
            "validation_tune": str(temp_val_wrong),
            "calibration": DEFAULT_CAL_CSV,
            "test": DEFAULT_TEST_CSV
        }
    })
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "PARTITION_MEMBERSHIP_CONFLICT"


def test_aq_missing_authoritative_test_sha_blocked(gate, tmp_path):
    """Test AQ: Missing authoritative test SHA in manifest yields BLOCKED (PROVENANCE_MISMATCH)."""
    temp_dataset_manifest = tmp_path / "temp_no_sha_dataset_manifest.json"
    temp_split_manifest = tmp_path / "temp_no_sha_split_manifest.json"

    with open(DATASET_MANIFEST_PATH, "r", encoding="utf-8") as f:
        ds = json.load(f)
    ds.pop("locked_test_artifact", None)
    temp_dataset_manifest.write_text(json.dumps(ds, indent=2))

    with open(SPLIT_MANIFEST_PATH, "r", encoding="utf-8") as f:
        sp = json.load(f)
    sp.pop("test_partition_governance", None)
    temp_split_manifest.write_text(json.dumps(sp, indent=2))

    report = gate.generate_integrity_report({
        "custom_dataset_manifest_path": str(temp_dataset_manifest),
        "custom_split_manifest_path": str(temp_split_manifest)
    })

    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "PROVENANCE_MISMATCH"


def test_ar_missing_production_threshold_blocked(gate, tmp_path):
    """Test AR: Missing authoritative_threshold in temporary production manifest yields THRESHOLD_MISMATCH."""
    temp_no_thresh = tmp_path / "temp_nothresh_prod_manifest.json"
    temp_no_thresh.write_text(json.dumps({"model_version": "1.0.0"}))

    report = gate.generate_integrity_report({"custom_prod_manifest_path": str(temp_no_thresh)})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "THRESHOLD_MISMATCH"


def test_as_corrupted_production_threshold_blocked(gate, tmp_path):
    """Test AS: Corrupted production threshold (0.25 in temp manifest file) yields THRESHOLD_MISMATCH."""
    temp_prod = tmp_path / "temp_corrupted_threshold.json"
    with open(PROD_MANIFEST_PATH, "r", encoding="utf-8") as f:
        real_prod = json.load(f)
    real_prod["authoritative_threshold"] = 0.25
    temp_prod.write_text(json.dumps(real_prod, indent=2))

    report = gate.generate_integrity_report({"custom_prod_manifest_path": str(temp_prod)})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "THRESHOLD_MISMATCH"


def test_at_genuine_one_byte_production_model_mutation_blocked(gate, tmp_path):
    """Test AT: Genuine one-byte production model mutation yields BLOCKED (PROTECTED_TEST_MUTATION)."""
    temp_model_path = tmp_path / "temp_mutated_model_at.json"
    with open(PROD_MODEL_PATH, "rb") as f:
        original_bytes = bytearray(f.read())
    original_bytes[100] = 89 if original_bytes[100] == 88 else 88
    temp_model_path.write_bytes(original_bytes)

    report = gate.generate_integrity_report({"custom_model_path": str(temp_model_path)})
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "PROTECTED_TEST_MUTATION"


def test_au_complete_scan_overlap_after_row_500_blocked(gate, tmp_path):
    """Test AU: Complete scan overlap occurring only after row 500 yields BLOCKED (LOT_OVERLAP)."""
    train_505 = tmp_path / "temp_train_au_505.csv"
    test_small = tmp_path / "temp_test_au_small.csv"

    lines = ["test_id,lot_id,wafer_id"]
    for i in range(1, 501):
        lines.append(f"TEST-L-{i},LOT-SYN-001,W-01")
    lines.append("TEST-L-501,LOT-SYN-043,W-01")

    train_505.write_text("\n".join(lines))
    test_small.write_text("test_id,lot_id,wafer_id\nTEST-T-1,LOT-SYN-043,W-50\n")

    report = gate.generate_integrity_report({
        "test_path": str(test_small),
        "real_data_paths": {"train": str(train_505), "validation_tune": DEFAULT_VAL_CSV, "calibration": DEFAULT_CAL_CSV, "test": str(test_small)}
    })
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "LOT_OVERLAP"


def test_av_missing_required_group_identifier_blocked(gate, tmp_path):
    """Test AV: Missing required lot_id column yields BLOCKED (GROUP_PROVENANCE_UNVERIFIABLE)."""
    train_no_lot = tmp_path / "temp_train_av_nolot.csv"
    train_no_lot.write_text("test_id,wafer_id\n1,W-01\n")

    report = gate.generate_integrity_report({
        "real_data_paths": {"train": str(train_no_lot), "validation_tune": DEFAULT_VAL_CSV, "calibration": DEFAULT_CAL_CSV, "test": DEFAULT_TEST_CSV}
    })
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "GROUP_PROVENANCE_UNVERIFIABLE"


def test_aw_missing_calibration_artifact_blocked(gate):
    """Test AW: Missing calibration artifact file yields BLOCKED (PROVENANCE_MISMATCH)."""
    report = gate.generate_integrity_report({
        "real_data_paths": {
            "train": DEFAULT_TRAIN_CSV,
            "validation_tune": DEFAULT_VAL_CSV,
            "calibration": "/nonexistent/calibration.csv",
            "test": DEFAULT_TEST_CSV
        },
        "require_artifacts_exist": True
    })
    assert report["overall_status"] == "BLOCKED"
    assert report["failure_category"] == "PROVENANCE_MISMATCH"


def test_ax_valid_clean_four_way_authority_pass(gate):
    """Test AX: Valid clean four-way authority yields PASS cleanly."""
    report = gate.generate_integrity_report({
        "real_data_paths": {
            "train": DEFAULT_TRAIN_CSV,
            "validation_tune": DEFAULT_VAL_CSV,
            "calibration": DEFAULT_CAL_CSV,
            "test": DEFAULT_TEST_CSV
        }
    })
    assert report["overall_status"] == "PASS"
    assert report["manifest_record_consistency"] == "PASS"
    assert report["hash_comparison_result"] == "MATCH"
    assert report["authoritative_operating_threshold"] == 0.20
    assert report["authoritative_model_sha"] == EXPECTED_MODEL_SHA
