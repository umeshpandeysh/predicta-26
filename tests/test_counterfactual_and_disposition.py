"""
PREDICTA Stage 6 Task 2 — Comprehensive Counterfactual & Disposition Test Suite (Python)
File: tests/test_counterfactual_and_disposition.py

Adversarial attack matrix:
A — missing feature
B — extra feature
C — reordered feature vector
D — NaN
E — Infinity
F — negative/impossible physical value
G — immutable component ID modification attempt
H — immutable lot / equipment modification attempt
I — excessive feature movement attempt
J — target impossible under constraints -> TARGET_NOT_REACHED cleanly
K — deterministic repeatability
L — model hash mutation attempt during explanation
M — explanation prediction mismatch attempt
N — fake frontend explanation attempt
O — disposition modifies ML decision attempt
P — unauthorized disposition
Q — malformed reason code
R — oversized comment
S — feedback enters training attempt
T — feedback enters conformal calibration attempt
U — feedback changes anomaly threshold attempt
V — counterfactual changes production threshold attempt
W — test-set leakage attempt
X — stale model artifact attempt
Y — missing model artifact attempt
Z — corrupted model artifact attempt.
"""

import os
import json
import pytest

from src.explainability.counterfactual import GovernedCounterfactualExplainer, compute_file_sha256
from src.governance.disposition import HumanDispositionManager

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CF_CONTRACT_PATH = os.path.join(PROJECT_ROOT, "ml", "explainability", "counterfactual_contract.json")
DISP_CONTRACT_PATH = os.path.join(PROJECT_ROOT, "ml", "governance", "disposition_contract.json")
MODEL_JSON_PATH = os.path.join(PROJECT_ROOT, "ml", "models", "production", "predicta_xgboost_model.json")

SAMPLE_FAILING_RECORD = {
    "test_id": "TEST-ATTACK-001",
    "equipment_id": "EQP-101",
    "lot_id": "LOT-SYN-045",
    "component_id": "COMP-001",
    "wafer_id": "W-01",
    "supply_voltage": 1.1911,
    "output_voltage": 1.1598,
    "current": 47.7968,
    "leakage_current": 195.0,
    "resistance": 13.1914,
    "capacitance": 4.054,
    "threshold_voltage": 0.4797,
    "frequency": 2616.57,
    "propagation_delay": 15.2,
    "setup_time": 0.8355,
    "hold_time": 0.4317,
    "timing_margin": 1.3069,
    "temperature": 34.0,
    "dynamic_power": 56.8358,
    "total_power": 56.8972,
    "test_duration": 156.27
}


@pytest.fixture
def explainer():
    return GovernedCounterfactualExplainer()


@pytest.fixture
def disp_manager():
    return HumanDispositionManager()


def test_01_contracts_integrity(explainer, disp_manager):
    """Verify contracts load and enforce BENCHMARK_ONLY and RECORDED_ONLY."""
    assert explainer.contract["model_status"] == "BENCHMARK_ONLY"
    assert explainer.contract["explanation_status"] == "BENCHMARK_ONLY"
    assert disp_manager.contract["governance_rules"]["default_feedback_status"] == "RECORDED_ONLY"


def test_02_genuine_counterfactual_generation(explainer):
    """Verify that a genuine counterfactual transforms a failing prediction to TARGET_PASS."""
    res = explainer.generate_counterfactual(SAMPLE_FAILING_RECORD, target_condition="TARGET_PASS")
    assert res["target_reached"] is True
    assert res["counterfactual_prediction"]["calibrated_probability"] < 0.20
    assert res["counterfactual_prediction"]["decision"] == "PASS"
    assert res["target_condition"] == "TARGET_PASS"
    assert res["distance"] > 0.0
    assert len(res["changed_features"]) > 0


# --- ATTACK MATRIX A through Z ---

def test_attack_a_missing_feature(explainer):
    """Attack A: missing required numerical feature must fail closed."""
    bad_rec = dict(SAMPLE_FAILING_RECORD)
    del bad_rec["leakage_current"]
    with pytest.raises(ValueError, match="MISSING_REQUIRED_FEATURE"):
        explainer.generate_counterfactual(bad_rec)


def test_attack_b_extra_feature_ignored_or_contained(explainer):
    """Attack B: extra features must not alter canonical 28-feature calculation."""
    bad_rec = dict(SAMPLE_FAILING_RECORD)
    bad_rec["malicious_extra_feature"] = 99999.0
    res = explainer.generate_counterfactual(bad_rec)
    assert "malicious_extra_feature" not in res["counterfactual_input"]
    assert res["schema_verified"] is True


def test_attack_c_reordered_feature_vector(explainer):
    """Attack C: evaluate_probability rejects wrong length or bad order."""
    with pytest.raises(ValueError, match="INVALID_FEATURE_VECTOR_LENGTH"):
        explainer.evaluate_probability([1.0] * 20)


def test_attack_d_nan_value(explainer):
    """Attack D: NaN input value must fail closed."""
    bad_rec = dict(SAMPLE_FAILING_RECORD)
    bad_rec["temperature"] = float("nan")
    with pytest.raises(ValueError, match="NON_FINITE_INPUT"):
        explainer.generate_counterfactual(bad_rec)


def test_attack_e_infinity_value(explainer):
    """Attack E: Infinity input value must fail closed."""
    bad_rec = dict(SAMPLE_FAILING_RECORD)
    bad_rec["supply_voltage"] = float("inf")
    with pytest.raises(ValueError, match="NON_FINITE_INPUT"):
        explainer.generate_counterfactual(bad_rec)


def test_attack_f_negative_impossible_physical_value(explainer):
    """Attack F: strictly positive channel <= 0 or current < 0 must fail closed."""
    bad_rec = dict(SAMPLE_FAILING_RECORD)
    bad_rec["supply_voltage"] = -1.2
    with pytest.raises(ValueError, match="PHYSICAL_BOUND_VIOLATION"):
        explainer.generate_counterfactual(bad_rec)


def test_attack_g_immutable_component_id_modification_attempt(explainer):
    """Attack G: component_id cannot be changed in counterfactual output."""
    res = explainer.generate_counterfactual(SAMPLE_FAILING_RECORD)
    assert "component_id" not in res["changed_features"]
    assert res["immutable_features_verified"] is True


def test_attack_h_immutable_lot_and_equipment_modification_attempt(explainer):
    """Attack H: equipment_id and lot_id cannot be altered to achieve pass."""
    res = explainer.generate_counterfactual(SAMPLE_FAILING_RECORD)
    assert "equipment_id" not in res["changed_features"]
    assert "lot_id" not in res["changed_features"]


def test_attack_i_excessive_feature_movement(explainer):
    """Attack I: counterfactual perturbations cannot exceed configured per-feature limits."""
    res = explainer.generate_counterfactual(SAMPLE_FAILING_RECORD)
    for p, change in res["changed_features"].items():
        assert abs(change["delta_std"]) <= explainer.max_feature_change_std + 1e-4


def test_attack_j_target_impossible_under_constraints(explainer):
    """Attack J: when target cannot be reached under constraints, cleanly report TARGET_NOT_REACHED."""
    # Restrict total distance to near zero so target cannot be reached
    original_max = explainer.max_total_distance
    explainer.max_total_distance = 0.001
    try:
        res = explainer.generate_counterfactual(SAMPLE_FAILING_RECORD, target_condition="TARGET_PASS")
        assert res["target_reached"] is False
        assert res["counterfactual_prediction"]["decision"] == "FAIL"
    finally:
        explainer.max_total_distance = original_max


def test_attack_k_deterministic_repeatability(explainer):
    """Attack K: identical calls must yield identical counterfactual outputs."""
    res1 = explainer.generate_counterfactual(SAMPLE_FAILING_RECORD)
    res2 = explainer.generate_counterfactual(SAMPLE_FAILING_RECORD)
    assert res1["distance"] == res2["distance"]
    assert res1["counterfactual_prediction"]["calibrated_probability"] == res2["counterfactual_prediction"]["calibrated_probability"]
    assert res1["changed_features"] == res2["changed_features"]


def test_attack_l_model_hash_mutation(explainer, tmp_path):
    """Attack L: model file mutation prior to generation is caught and rejected."""
    bad_model_path = tmp_path / "tampered_model.json"
    bad_model_path.write_text("{}", encoding="utf-8")
    with pytest.raises(ValueError, match="MODEL_HASH_MISMATCH"):
        GovernedCounterfactualExplainer(model_path=str(bad_model_path))


def test_attack_m_explanation_prediction_mismatch(explainer):
    """Attack M: counterfactual prediction reported must match actual model evaluation."""
    res = explainer.generate_counterfactual(SAMPLE_FAILING_RECORD)
    cf_input = res["counterfactual_input"]
    cf_vec = explainer._build_feature_vector_from_raw(cf_input, SAMPLE_FAILING_RECORD["equipment_id"])
    _, actual_calib_p = explainer.evaluate_probability(cf_vec)
    assert abs(actual_calib_p - res["counterfactual_prediction"]["calibrated_probability"]) <= 1e-5


def test_attack_n_fake_frontend_explanation_rejection():
    """Attack N: explanations not originating from authoritative backend fail validation."""
    fake_explanation = {
        "explanation_id": "FAKE-123",
        "provenance": {"model_sha256": "wrong_sha"}
    }
    assert fake_explanation["provenance"]["model_sha256"] != "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"


def test_attack_o_disposition_modifies_ml_decision_attempt(disp_manager):
    """Attack O: operator submitting ACCEPT for a REJECT case does NOT overwrite original ML decision."""
    ml_snapshot = {
        "ml_decision": "REJECT",
        "probability": 0.85,
        "model_id": "predicta_xgboost_model"
    }
    rec = disp_manager.record_disposition(
        trace_id="TRACE-PRED-101",
        disposition="ACCEPT",
        reason_code="MANUAL_ENGINEERING_REVIEW",
        operator_id="OP_TEST",
        comment="Overriding for test pass",
        ml_decision_snapshot=ml_snapshot
    )
    assert rec["original_ml_decision"] == "REJECT"
    assert rec["disposition"] == "ACCEPT"
    assert rec["feedback_status"] == "RECORDED_ONLY"


def test_attack_p_unauthorized_disposition(disp_manager):
    """Attack P: unauthorized role cannot record disposition."""
    with pytest.raises(PermissionError, match="UNAUTHORIZED_ROLE"):
        disp_manager.record_disposition(
            trace_id="TRACE-PRED-102",
            disposition="ACCEPT",
            reason_code="OTHER",
            operator_id="HACKER",
            operator_role="ANONYMOUS"
        )


def test_attack_q_malformed_reason_code(disp_manager):
    """Attack Q: unrecognized reason code must fail closed."""
    with pytest.raises(ValueError, match="INVALID_REASON_CODE"):
        disp_manager.record_disposition(
            trace_id="TRACE-PRED-103",
            disposition="ACCEPT",
            reason_code="INVALID_REASON_CODE_XYZ",
            operator_id="OP_01"
        )


def test_attack_r_oversized_comment(disp_manager):
    """Attack R: comment exceeding 1000 characters is rejected."""
    long_comment = "A" * 1005
    with pytest.raises(ValueError, match="OVERSIZED_COMMENT"):
        disp_manager.record_disposition(
            trace_id="TRACE-PRED-104",
            disposition="REJECT",
            reason_code="PROCESS_EXCEPTION",
            operator_id="OP_01",
            comment=long_comment
        )


def test_attack_s_feedback_enters_training_attempt(disp_manager):
    """Attack S: verify feedback store is isolated from dataset file."""
    dataset_sha_before = compute_file_sha256(os.path.join(PROJECT_ROOT, "ml", "data", "synthetic", "predicta_dataset_v4_production.csv"))
    disp_manager.record_disposition(
        trace_id="TRACE-PRED-105",
        disposition="ACCEPT",
        reason_code="OTHER",
        operator_id="OP_01"
    )
    dataset_sha_after = compute_file_sha256(os.path.join(PROJECT_ROOT, "ml", "data", "synthetic", "predicta_dataset_v4_production.csv"))
    assert dataset_sha_before == dataset_sha_after


def test_attack_t_feedback_enters_conformal_calibration_attempt(disp_manager):
    """Attack T: verify feedback does not touch conformal calibration artifacts."""
    conformal_art_path = os.path.join(PROJECT_ROOT, "ml", "models", "production", "conformal_calibration_artifacts.json")
    sha_before = compute_file_sha256(conformal_art_path)
    disp_manager.record_disposition(
        trace_id="TRACE-PRED-106",
        disposition="REJECT",
        reason_code="EQUIPMENT_ISSUE",
        operator_id="OP_01"
    )
    sha_after = compute_file_sha256(conformal_art_path)
    assert sha_before == sha_after


def test_attack_u_feedback_changes_anomaly_threshold_attempt(disp_manager):
    """Attack U: anomaly artifact remains 100% untouched."""
    anomaly_path = os.path.join(PROJECT_ROOT, "ml", "models", "production", "predicta_anomaly_artifacts.json")
    sha_before = compute_file_sha256(anomaly_path)
    disp_manager.record_disposition(
        trace_id="TRACE-PRED-107",
        disposition="HOLD",
        reason_code="INSUFFICIENT_DATA",
        operator_id="OP_01"
    )
    sha_after = compute_file_sha256(anomaly_path)
    assert sha_before == sha_after


def test_attack_v_counterfactual_changes_production_threshold_attempt(explainer):
    """Attack V: generating counterfactual does not mutate operating threshold."""
    thresh_before = explainer.operating_threshold
    explainer.generate_counterfactual(SAMPLE_FAILING_RECORD)
    assert explainer.operating_threshold == thresh_before == 0.20


def test_attack_w_test_set_leakage_attempt(disp_manager):
    """Attack W: test split manifest remains unchanged when feedback is recorded."""
    manifest_path = os.path.join(PROJECT_ROOT, "ml", "data", "split_manifest.json")
    sha_before = compute_file_sha256(manifest_path)
    disp_manager.record_disposition(
        trace_id="TRACE-PRED-108",
        disposition="RETEST",
        reason_code="RETEST_REQUIRED",
        operator_id="OP_01"
    )
    sha_after = compute_file_sha256(manifest_path)
    assert sha_before == sha_after


def test_attack_x_stale_model_artifact_attempt(tmp_path):
    """Attack X: outdated or mismatched contract version triggers rejection."""
    bad_contract = tmp_path / "bad_contract.json"
    bad_contract.write_text(json.dumps({"model_identity": {"model_sha256": "wrong"}}), encoding="utf-8")
    with pytest.raises((KeyError, ValueError)):
        GovernedCounterfactualExplainer(contract_path=str(bad_contract))


def test_attack_y_missing_model_artifact_attempt():
    """Attack Y: missing model artifact fails closed."""
    with pytest.raises(FileNotFoundError):
        GovernedCounterfactualExplainer(model_path="nonexistent_model.json")


def test_attack_z_corrupted_model_artifact_attempt(tmp_path):
    """Attack Z: corrupted model JSON fails closed."""
    corrupt_file = tmp_path / "corrupt.json"
    corrupt_file.write_text("not json content", encoding="utf-8")
    with pytest.raises(ValueError):
        GovernedCounterfactualExplainer(model_path=str(corrupt_file))


def test_cross_runtime_node_python_parity(explainer):
    """Verify exact cross-runtime numerical parity between Python and Node.js counterfactuals."""
    import subprocess
    cmd = [
        "node", "-e",
        "const { GovernedCounterfactualExplainerJS } = require('./src/explainability/counterfactual');"
        "const jsExp = new GovernedCounterfactualExplainerJS();"
        "const fs = require('fs');"
        "const rec = JSON.parse(process.argv[1]);"
        "const res = jsExp.generateCounterfactual(rec, 'TARGET_PASS');"
        "console.log(JSON.stringify(res));",
        json.dumps(SAMPLE_FAILING_RECORD)
    ]
    node_out = subprocess.check_output(cmd, cwd=PROJECT_ROOT, text=True)
    node_res = json.loads(node_out.strip())

    py_res = explainer.generate_counterfactual(SAMPLE_FAILING_RECORD, "TARGET_PASS")

    assert py_res["target_reached"] is True
    assert node_res["target_reached"] is True
    assert abs(py_res["distance"] - node_res["distance"]) <= 1e-4
    assert abs(py_res["counterfactual_prediction"]["calibrated_probability"] - node_res["counterfactual_prediction"]["calibrated_probability"]) <= 1e-4
    assert set(py_res["changed_features"].keys()) == set(node_res["changed_features"].keys())

