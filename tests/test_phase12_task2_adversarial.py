"""
PREDICTA — PHASE 12 TASK 2 ADVERSARIAL TEST SUITE (Python)
File: tests/test_phase12_task2_adversarial.py

Verifies 24 exact independent adversarial cases (A01 through A24) for Phase 12 Task 2.
"""

import os
import sys
import json
import pytest

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.api.inference_service import PredictaInferenceService

MANIFEST_PATH = os.path.join(BASE_DIR, "tests", "artifacts", "phase12_task2_adversarial_manifest.json")

VECTOR_BASE = {
    "supply_voltage": 1.20, "output_voltage": 1.20, "current": 10.7, "leakage_current": 111.7,
    "resistance": 10.0, "capacitance": 5.0, "threshold_voltage": 0.45, "frequency": 1000.0,
    "propagation_delay": 10.98, "setup_time": 1.0, "hold_time": 0.5, "timing_margin": 2.0,
    "temperature": 25.0, "dynamic_power": 30.0, "total_power": 35.0, "test_duration": 1.0,
    "equipment_id": "EQP-101"
}

VECTOR_HIGH_RISK = {
    **VECTOR_BASE,
    "current": 150.0, "leakage_current": 240.0, "temperature": 55.0
}


@pytest.fixture(scope="module")
def py_service():
    service = PredictaInferenceService()
    assert service.is_loaded
    return service


def test_adversarial_manifest_completeness():
    """Verify that adversarial manifest exists and contains exactly 24 cases (A01-A24)."""
    assert os.path.exists(MANIFEST_PATH), f"Adversarial manifest missing at {MANIFEST_PATH}"
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    assert manifest.get("total_adversarial_cases") == 24
    cases = manifest.get("cases", [])
    assert len(cases) == 24
    ids = [c["id"] for c in cases]
    for i in range(1, 25):
        expected_id = f"A{i:02d}"
        assert expected_id in ids, f"Missing required adversarial ID {expected_id} in manifest"


def test_a01_threshold_just_below(py_service):
    """A01: Threshold just below (0.199999)."""
    dec = py_service.determine_risk_level(0.199999, "NORMAL")
    assert dec == "LOW"


def test_a02_exact_authoritative_threshold(py_service):
    """A02: Exact authoritative threshold (0.200000)."""
    dec = py_service.determine_risk_level(0.200000, "NORMAL")
    assert dec == "MEDIUM"


def test_a03_threshold_just_above(py_service):
    """A03: Threshold just above (0.200001)."""
    dec = py_service.determine_risk_level(0.200001, "NORMAL")
    assert dec == "MEDIUM"


def test_a04_nan_numerical_input(py_service):
    """A04: NaN numerical input fails validation."""
    nan_vec = {**VECTOR_BASE, "supply_voltage": float("nan")}
    with pytest.raises(ValueError, match="valid finite number"):
        py_service.validate_input_record(nan_vec)


def test_a05_infinity_numerical_input(py_service):
    """A05: Infinity numerical input fails validation."""
    inf_vec = {**VECTOR_BASE, "current": float("inf")}
    with pytest.raises(ValueError, match="valid finite number"):
        py_service.validate_input_record(inf_vec)


def test_a06_negative_forbidden_physical_value(py_service):
    """A06: Negative forbidden physical value fails validation."""
    neg_vec = {**VECTOR_BASE, "supply_voltage": -1.2}
    with pytest.raises(ValueError, match="positive number"):
        py_service.validate_input_record(neg_vec)


def test_a07_missing_required_feature(py_service):
    """A07: Missing required feature fails validation."""
    missing_vec = {**VECTOR_BASE}
    del missing_vec["supply_voltage"]
    with pytest.raises(ValueError, match="Missing required numerical feature"):
        py_service.validate_input_record(missing_vec)


def test_a08_wrong_feature_datatype(py_service):
    """A08: Numeric string datatype handling."""
    str_vec = {**VECTOR_BASE, "current": "10.7"}
    val = py_service.validate_input_record(str_vec)
    assert val["current"] == 10.7


def test_a09_empty_batch(py_service):
    """A09: Empty batch request."""
    with pytest.raises(ValueError, match="non-empty array"):
        py_service.predict_batch([])


def test_a10_malformed_batch_payload(py_service):
    """A10: Malformed batch payload."""
    with pytest.raises(ValueError, match="non-empty array|must be a list"):
        py_service.predict_batch("not_a_list")


def test_a11_duplicate_records_in_batch(py_service):
    """A11: Duplicate records in batch."""
    batch_res = py_service.predict_batch([VECTOR_BASE, VECTOR_BASE])
    assert batch_res["total"] == 2
    assert batch_res["results"][0]["probability"] == batch_res["results"][1]["probability"]


def test_a12_reordered_records_in_batch(py_service):
    """A12: Reordered records in batch preserve order."""
    batch_res = py_service.predict_batch([VECTOR_BASE, VECTOR_HIGH_RISK])
    assert batch_res["results"][0]["prediction"] == "PASS"
    assert batch_res["results"][1]["prediction"] == "FAIL"


def test_a13_extremely_large_finite_physical_value(py_service):
    """A13: Extremely large finite physical value."""
    large_vec = {**VECTOR_BASE, "current": 100000.0}
    with pytest.raises(ValueError, match="exceeds physical upper bound|cannot exceed"):
        py_service.validate_input_record(large_vec)


def test_a14_unseen_equipment_id(py_service):
    """A14: Unseen equipment ID."""
    unseen_vec = {**VECTOR_BASE, "equipment_id": "EQP-999"}
    res = py_service.predict_single(unseen_vec)
    assert res["is_unseen_equipment"] is True


def test_a15_strict_mode_invalid_equipment_id(py_service):
    """A15: Strict-mode invalid equipment ID."""
    unseen_vec = {**VECTOR_BASE, "equipment_id": "EQP-999"}
    with pytest.raises(ValueError, match="Invalid equipment_id"):
        py_service.validate_input_record(unseen_vec, strict_equipment=True)


def test_a16_missing_prognostic_baseline(py_service):
    """A16: Missing prognostic baseline produces INSUFFICIENT_HISTORY."""
    drift = py_service.evaluate_gpr_drift(VECTOR_BASE)
    assert drift["iddq"]["status"] == "INSUFFICIENT_HISTORY"
    assert drift["iddq"]["has_history"] is False


def test_a17_future_168h_feature_injection(py_service):
    """A17: Future-feature injection proven excluded from predictive vector."""
    from src.api.inference_service import extract_feature_vector
    base_record = dict(VECTOR_BASE)
    future_injected_record = {
        **VECTOR_BASE,
        "tpd_168h": 99.0,
        "iddq_168h_ground_truth": 999.0,
        "ileak_168h_ground_truth": 9999.0,
        "future_degradation_label": 1,
        "operator_disposition": "REJECT",
        "adjudicated_outcome": "DEFECT"
    }

    feature_names = py_service.metadata["feature_contract"]["feature_names"]
    base_vec, _ = extract_feature_vector(base_record, base_record["equipment_id"])
    future_vec, _ = extract_feature_vector(future_injected_record, future_injected_record["equipment_id"])

    assert len(base_vec) == 28, "Base feature vector must contain exactly 28 features."
    assert len(future_vec) == 28, "Future injected feature vector must contain exactly 28 features."
    assert base_vec == future_vec, "Future-feature injection altered authoritative predictive feature vector!"

    forbidden_fields = ["tpd_168h", "iddq_168h_ground_truth", "ileak_168h_ground_truth", "future_degradation_label", "operator_disposition", "adjudicated_outcome"]
    for forbidden_field in forbidden_fields:
        assert forbidden_field not in feature_names, f"Forbidden field '{forbidden_field}' found in predictive feature schema!"


def test_a18_phase9_benchmark_threshold_override_injection(py_service):
    """A18: Phase-9 benchmark threshold override injection."""
    injected_vec = {**VECTOR_BASE, "operating_threshold_override": 0.45}
    res = py_service.predict_single(injected_vec)
    assert res["operating_threshold"] == 0.20


def test_a19_phase11_feedback_field_injection(py_service):
    """A19: Phase-11 feedback field injection."""
    injected_vec = {**VECTOR_HIGH_RISK, "operator_disposition": "PASS"}
    res = py_service.predict_single(injected_vec)
    assert res["prediction"] == "FAIL"


def test_a20_client_supplied_probability_injection(py_service):
    """A20: Client-supplied probability injection."""
    injected_vec = {**VECTOR_HIGH_RISK, "probability": 0.000001}
    res = py_service.predict_single(injected_vec)
    assert res["probability"] > 0.50


def test_a21_client_supplied_model_sha_injection(py_service):
    """A21: Client-supplied model SHA injection."""
    injected_vec = {**VECTOR_BASE, "model_sha256": "fake_client_sha"}
    res = py_service.predict_single(injected_vec)
    assert res["model_version"] == "4.0.0_authoritative"


def test_a22_production_model_mutation_detection_simulation():
    """A22: Production model SHA mutation validation."""
    import tempfile
    from src.evaluation.phase12_evaluation_integrity import EvaluationIntegrityGatePy
    gate = EvaluationIntegrityGatePy()

    prod_model_path = os.path.join(BASE_DIR, "ml", "models", "production", "predicta_xgboost_model.json")
    orig_sha = gate._compute_file_sha256(prod_model_path)
    assert orig_sha == "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_model_path = os.path.join(tmp_dir, "predicta_xgboost_model.json")
        with open(prod_model_path, "rb") as f:
            content = f.read() + b"\n"
        with open(tmp_model_path, "wb") as f:
            f.write(content)

        mutated_sha = gate._compute_file_sha256(tmp_model_path)
        assert mutated_sha != orig_sha, "Mutated model SHA must differ from authoritative SHA."

        res = gate.verify_production_model_protection(tmp_model_path)
        assert res["valid"] is False, "Mutated production model must fail validation."
        assert res["error_code"] == "PROTECTED_TEST_MUTATION"


def test_a23_calibration_artifact_mutation_detection_simulation():
    """A23: Calibration artifact SHA mutation validation."""
    import tempfile
    from src.evaluation.phase12_evaluation_integrity import EvaluationIntegrityGatePy
    gate = EvaluationIntegrityGatePy()

    real_cal_path = os.path.join(BASE_DIR, "ml", "data", "processed", "calibration.csv")
    orig_sha = gate._compute_file_sha256(real_cal_path)
    assert orig_sha == "f8a9c67889ebca9561cb925ffc8579d41a17bf540c6c2d48a5d54833140df339"

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_cal_path = os.path.join(tmp_dir, "calibration.csv")
        with open(real_cal_path, "r", encoding="utf-8") as f:
            content = f.read() + "\n# mutated_row,999,999\n"
        with open(tmp_cal_path, "w", encoding="utf-8") as f:
            f.write(content)

        mutated_sha = gate._compute_file_sha256(tmp_cal_path)
        assert mutated_sha != orig_sha, "Mutated calibration SHA must differ from authoritative SHA."

        res = gate.verify_calibration_artifact_immutability(tmp_cal_path)
        assert res["valid"] is False, "Mutated calibration artifact must fail validation."
        assert res["error_code"] == "PROVENANCE_MISMATCH"


def test_a24_manifest_threshold_mismatch_simulation():
    """A24: Production manifest SHA mutation validation."""
    import tempfile
    from src.evaluation.phase12_evaluation_integrity import EvaluationIntegrityGatePy
    gate = EvaluationIntegrityGatePy()

    prod_manifest_path = os.path.join(BASE_DIR, "ml", "models", "production", "predicta_production_manifest.json")
    orig_sha = gate._compute_file_sha256(prod_manifest_path)
    assert orig_sha == "065a278afa4c45636e6235bb879d68e19c1e0f44e8ff13682ff6ccffbfb5bb11"

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_manifest_path = os.path.join(tmp_dir, "predicta_production_manifest.json")
        with open(prod_manifest_path, "r", encoding="utf-8") as f:
            manifest_data = json.load(f)

        manifest_data["authoritative_threshold"] = 0.45
        with open(tmp_manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest_data, f, indent=2)

        mutated_sha = gate._compute_file_sha256(tmp_manifest_path)
        assert mutated_sha != orig_sha, "Mutated manifest SHA must differ from authoritative SHA."

        res = gate.verify_production_manifest_protection(tmp_manifest_path)
        assert res["valid"] is False, "Mutated production manifest must fail validation."
        assert res["error_code"] == "PROVENANCE_MISMATCH"

    # Verify CRLF line endings fail validation against canonical LF SHA
    with open(prod_manifest_path, "rb") as f:
        crlf_bytes = f.read().replace(b"\n", b"\r\n").replace(b"\r\r\n", b"\r\n")
    with tempfile.TemporaryDirectory() as tmp_dir:
        crlf_manifest_path = os.path.join(tmp_dir, "predicta_production_manifest.json")
        with open(crlf_manifest_path, "wb") as f:
            f.write(crlf_bytes)
        crlf_res = gate.verify_production_manifest_protection(crlf_manifest_path)
        assert crlf_res["valid"] is False, "CRLF line-ended manifest must fail canonical LF validation."
        assert crlf_res["error_code"] == "PROVENANCE_MISMATCH"
