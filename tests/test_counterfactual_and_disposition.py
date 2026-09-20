"""
PREDICTA Stage 6 Task 2 — Comprehensive Counterfactual & Disposition Test Suite (Python)
File: tests/test_counterfactual_and_disposition.py

Adversarial attack matrix:
A — missing feature
B — unknown extra feature MUST fail closed
C — reordered feature vector / invalid length
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
N — fake frontend explanation attempt / invalid provenance
O — disposition modifies ML decision attempt (authoritative decision preserved)
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
Z — corrupted model artifact attempt

NEW ATTACKS AA-AL:
AA — client supplies fake ml_decision_snapshot
AB — client supplies fake probability
AC — client supplies fake model_hash
AD — client supplies fake model_id
AE — authoritative prediction missing
AF — authoritative model provenance invalid
AG — duplicate disposition does not overwrite history (append-only)
AH — second disposition preserves first record
AI — client attempts to submit original_ml_decision directly
AJ — client attempts to submit anomaly_score
AK — client attempts to submit prognostic_output
AL — client attempts to inject human disposition as ground truth
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


def test_attack_b_unknown_extra_feature_rejected(explainer):
    """Attack B: unknown/extra features must fail closed with UNKNOWN_FEATURE."""
    bad_rec = dict(SAMPLE_FAILING_RECORD)
    bad_rec["malicious_extra_feature"] = 99999.0
    with pytest.raises(ValueError, match="UNKNOWN_FEATURE"):
        explainer.generate_counterfactual(bad_rec)


def test_attack_c_reordered_feature_vector(explainer):
    """Attack C: evaluate_probability rejects wrong length or non-canonical vector."""
    with pytest.raises(ValueError, match="INVALID_FEATURE_VECTOR_LENGTH"):
        explainer.evaluate_probability([1.0, 2.0, 3.0])


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
    """Attack F: strictly positive channel with negative/zero value must fail closed."""
    bad_rec = dict(SAMPLE_FAILING_RECORD)
    bad_rec["supply_voltage"] = -1.2
    with pytest.raises(ValueError, match="PHYSICAL_BOUND_VIOLATION"):
        explainer.generate_counterfactual(bad_rec)


def test_attack_g_immutable_component_id_modification_attempt(explainer):
    """Attack G: component_id cannot be altered to achieve pass."""
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


def test_attack_l_model_hash_mutation(tmp_path):
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


def test_attack_n_fake_frontend_explanation_rejection(tmp_path):
    """Attack N: explanations referencing invalid or mutated model hash fail backend verification."""
    bad_model_path = tmp_path / "fake_model.json"
    bad_model_path.write_text('{"fake": true}', encoding="utf-8")
    with pytest.raises(ValueError, match="MODEL_HASH_MISMATCH"):
        GovernedCounterfactualExplainer(model_path=str(bad_model_path))


def test_attack_o_disposition_modifies_ml_decision_attempt(disp_manager):
    """Attack O: operator submitting ACCEPT for a REJECT case does NOT overwrite original ML decision."""
    trace_id = "TRACE-PRED-ATTACK-O"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "REJECT",
        "probability": 0.85,
        "component_id": "COMP-001",
        "lot_id": "LOT-SYN-045"
    })
    rec = disp_manager.record_disposition(
        trace_id=trace_id,
        disposition="ACCEPT",
        reason_code="MANUAL_ENGINEERING_REVIEW",
        operator_id="OP_TEST",
        comment="Overriding for test pass"
    )
    assert rec["original_ml_decision"] == "REJECT"
    assert rec["disposition"] == "ACCEPT"
    assert rec["feedback_status"] == "RECORDED_ONLY"

    # Verify authoritative record remains unchanged
    auth_after = disp_manager.lookup_authoritative_prediction(trace_id)
    assert auth_after["prediction"] == "REJECT"
    assert auth_after["probability"] == 0.85


def test_attack_p_unauthorized_disposition(disp_manager):
    """Attack P: unauthorized role cannot record disposition."""
    trace_id = "TRACE-PRED-102"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "FAIL",
        "probability": 0.77
    })
    with pytest.raises(PermissionError, match="UNAUTHORIZED_ROLE"):
        disp_manager.record_disposition(
            trace_id=trace_id,
            disposition="ACCEPT",
            reason_code="OTHER",
            operator_id="HACKER",
            operator_role="ANONYMOUS"
        )


def test_attack_q_malformed_reason_code(disp_manager):
    """Attack Q: unrecognized reason code must fail closed."""
    trace_id = "TRACE-PRED-103"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "FAIL",
        "probability": 0.77
    })
    with pytest.raises(ValueError, match="INVALID_REASON_CODE"):
        disp_manager.record_disposition(
            trace_id=trace_id,
            disposition="ACCEPT",
            reason_code="INVALID_REASON_CODE_XYZ",
            operator_id="OP_01"
        )


def test_attack_r_oversized_comment(disp_manager):
    """Attack R: comment exceeding 1000 characters is rejected."""
    trace_id = "TRACE-PRED-104"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "FAIL",
        "probability": 0.77
    })
    long_comment = "A" * 1005
    with pytest.raises(ValueError, match="OVERSIZED_COMMENT"):
        disp_manager.record_disposition(
            trace_id=trace_id,
            disposition="REJECT",
            reason_code="PROCESS_EXCEPTION",
            operator_id="OP_01",
            comment=long_comment
        )


def test_attack_s_feedback_enters_training_attempt(disp_manager):
    """Attack S: verify feedback store is isolated from dataset file."""
    dataset_path = os.path.join(PROJECT_ROOT, "ml", "data", "synthetic", "predicta_dataset_v4_production.csv")
    dataset_sha_before = compute_file_sha256(dataset_path)
    trace_id = "TRACE-PRED-105"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "PASS",
        "probability": 0.05
    })
    disp_manager.record_disposition(
        trace_id=trace_id,
        disposition="ACCEPT",
        reason_code="OTHER",
        operator_id="OP_01"
    )
    dataset_sha_after = compute_file_sha256(dataset_path)
    assert dataset_sha_before == dataset_sha_after


def test_attack_t_feedback_enters_conformal_calibration_attempt(disp_manager):
    """Attack T: verify feedback does not touch conformal calibration artifacts."""
    conformal_art_path = os.path.join(PROJECT_ROOT, "ml", "models", "production", "conformal_calibration_artifacts.json")
    sha_before = compute_file_sha256(conformal_art_path)
    trace_id = "TRACE-PRED-106"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "FAIL",
        "probability": 0.88
    })
    disp_manager.record_disposition(
        trace_id=trace_id,
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
    trace_id = "TRACE-PRED-107"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "FAIL",
        "probability": 0.55
    })
    disp_manager.record_disposition(
        trace_id=trace_id,
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
    trace_id = "TRACE-PRED-108"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "FAIL",
        "probability": 0.65
    })
    disp_manager.record_disposition(
        trace_id=trace_id,
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


# --- NEW REQUIRED ATTACKS AA through AL ---

def test_attack_aa_client_supplies_fake_ml_decision_snapshot(disp_manager):
    """Attack AA: client supplies fake ml_decision_snapshot -> rejected."""
    trace_id = "TRACE-PRED-AA"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "REJECT",
        "probability": 0.90
    })
    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED"):
        disp_manager.record_disposition(
            trace_id=trace_id,
            disposition="ACCEPT",
            reason_code="OTHER",
            ml_decision_snapshot={"ml_decision": "PASS", "probability": 0.01}
        )


def test_attack_ab_client_supplies_fake_probability(disp_manager):
    """Attack AB: client supplies fake probability -> rejected."""
    trace_id = "TRACE-PRED-AB"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "REJECT",
        "probability": 0.90
    })
    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED"):
        disp_manager.record_disposition(
            trace_id=trace_id,
            disposition="ACCEPT",
            reason_code="OTHER",
            probability=0.01
        )


def test_attack_ac_client_supplies_fake_model_hash(disp_manager):
    """Attack AC: client supplies fake model_hash -> rejected."""
    trace_id = "TRACE-PRED-AC"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "REJECT",
        "probability": 0.90
    })
    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED"):
        disp_manager.record_disposition(
            trace_id=trace_id,
            disposition="ACCEPT",
            reason_code="OTHER",
            model_hash="fake_hash_12345"
        )


def test_attack_ad_client_supplies_fake_model_id(disp_manager):
    """Attack AD: client supplies fake model_id -> rejected."""
    trace_id = "TRACE-PRED-AD"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "REJECT",
        "probability": 0.90
    })
    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED"):
        disp_manager.record_disposition(
            trace_id=trace_id,
            disposition="ACCEPT",
            reason_code="OTHER",
            model_id="malicious_model_id"
        )


def test_attack_ae_authoritative_prediction_missing(disp_manager):
    """Attack AE: authoritative prediction missing -> fails closed."""
    nonexistent_trace = "TRACE-NONEXISTENT-99999"
    with pytest.raises(ValueError, match="AUTHORITATIVE_ML_RECORD_NOT_FOUND"):
        disp_manager.record_disposition(
            trace_id=nonexistent_trace,
            disposition="ACCEPT",
            reason_code="OTHER"
        )


def test_attack_af_authoritative_model_provenance_invalid(tmp_path):
    """Attack AF: invalid model provenance fails closed."""
    bad_model = tmp_path / "tampered.json"
    bad_model.write_text("{}", encoding="utf-8")
    bad_manager = HumanDispositionManager(model_path=str(bad_model))
    trace_id = "TRACE-PRED-AF"
    bad_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "REJECT",
        "probability": 0.90
    })
    with pytest.raises(ValueError, match="MODEL_PROVENANCE_INVALID"):
        bad_manager.record_disposition(
            trace_id=trace_id,
            disposition="ACCEPT",
            reason_code="OTHER"
        )


def test_attack_ag_duplicate_disposition_does_not_overwrite_history(disp_manager):
    """Attack AG: multiple dispositions for a trace append to history without overwriting."""
    trace_id = "TRACE-PRED-AG"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "REJECT",
        "probability": 0.88,
        "component_id": "COMP-AG",
        "lot_id": "LOT-AG"
    })
    rec1 = disp_manager.record_disposition(
        trace_id=trace_id,
        disposition="HOLD",
        reason_code="INSUFFICIENT_DATA",
        comment="First disposition: holding"
    )
    rec2 = disp_manager.record_disposition(
        trace_id=trace_id,
        disposition="ACCEPT",
        reason_code="MANUAL_ENGINEERING_REVIEW",
        comment="Second disposition: waiver granted"
    )
    history_obj = disp_manager.get_disposition(trace_id)
    assert history_obj is not None
    assert history_obj["total_dispositions"] == 2
    assert len(history_obj["history"]) == 2
    assert history_obj["history"][0]["disposition_id"] == rec1["disposition_id"]
    assert history_obj["history"][1]["disposition_id"] == rec2["disposition_id"]


def test_attack_ah_second_disposition_preserves_first_record(disp_manager):
    """Attack AH: second disposition preserves first record completely intact."""
    trace_id = "TRACE-PRED-AH"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "FAIL",
        "probability": 0.92
    })
    rec1 = disp_manager.record_disposition(
        trace_id=trace_id,
        disposition="RETEST",
        reason_code="RETEST_REQUIRED",
        comment="Original note 1"
    )
    rec1_snapshot = dict(rec1)

    disp_manager.record_disposition(
        trace_id=trace_id,
        disposition="REJECT",
        reason_code="PROCESS_EXCEPTION",
        comment="Original note 2"
    )
    history_obj = disp_manager.get_disposition(trace_id)
    assert history_obj["history"][0] == rec1_snapshot


def test_attack_ai_client_submits_original_ml_decision_directly(disp_manager):
    """Attack AI: client attempts to submit original_ml_decision directly -> rejected."""
    trace_id = "TRACE-PRED-AI"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "REJECT",
        "probability": 0.85
    })
    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED"):
        disp_manager.record_disposition(
            trace_id=trace_id,
            disposition="ACCEPT",
            reason_code="OTHER",
            original_ml_decision="PASS"
        )


def test_attack_aj_client_submits_anomaly_score(disp_manager):
    """Attack AJ: client attempts to submit anomaly_score directly -> rejected."""
    trace_id = "TRACE-PRED-AJ"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "REJECT",
        "probability": 0.85
    })
    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED"):
        disp_manager.record_disposition(
            trace_id=trace_id,
            disposition="ACCEPT",
            reason_code="OTHER",
            anomaly_score=0.01
        )


def test_attack_ak_client_submits_prognostic_output(disp_manager):
    """Attack AK: client attempts to submit prognostic_output directly -> rejected."""
    trace_id = "TRACE-PRED-AK"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "REJECT",
        "probability": 0.85
    })
    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED"):
        disp_manager.record_disposition(
            trace_id=trace_id,
            disposition="ACCEPT",
            reason_code="OTHER",
            prognostic_output={"state": "HEALTHY"}
        )


def test_attack_al_client_injects_human_disposition_as_ground_truth(disp_manager):
    """Attack AL: client attempts to inject human disposition as ground truth -> rejected."""
    trace_id = "TRACE-PRED-AL"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "REJECT",
        "probability": 0.85
    })
    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED"):
        disp_manager.record_disposition(
            trace_id=trace_id,
            disposition="ACCEPT",
            reason_code="OTHER",
            ground_truth="PASS"
        )


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
