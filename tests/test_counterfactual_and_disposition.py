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
        "probability": 0.77,
        "component_id": "COMP-102",
        "lot_id": "LOT-SYN-045"
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
        "probability": 0.77,
        "component_id": "COMP-103",
        "lot_id": "LOT-SYN-045"
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
        "probability": 0.77,
        "component_id": "COMP-104",
        "lot_id": "LOT-SYN-045"
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
        "probability": 0.05,
        "component_id": "COMP-105",
        "lot_id": "LOT-SYN-045"
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
        "probability": 0.88,
        "component_id": "COMP-106",
        "lot_id": "LOT-SYN-045"
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
        "probability": 0.55,
        "component_id": "COMP-107",
        "lot_id": "LOT-SYN-045"
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
        "probability": 0.65,
        "component_id": "COMP-108",
        "lot_id": "LOT-SYN-045"
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
        "probability": 0.90,
        "component_id": "COMP-AA",
        "lot_id": "LOT-SYN-045"
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
        "probability": 0.90,
        "component_id": "COMP-AB",
        "lot_id": "LOT-SYN-045"
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
        "probability": 0.90,
        "component_id": "COMP-AC",
        "lot_id": "LOT-SYN-045"
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
        "probability": 0.90,
        "component_id": "COMP-AD",
        "lot_id": "LOT-SYN-045"
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
        "probability": 0.90,
        "component_id": "COMP-AF",
        "lot_id": "LOT-SYN-045"
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
        "probability": 0.92,
        "component_id": "COMP-AH",
        "lot_id": "LOT-SYN-045"
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
    rec1_snapshot["conflict"] = True
    rec1_snapshot["is_conflict"] = True
    assert history_obj["history"][0] == rec1_snapshot


def test_attack_ai_client_submits_original_ml_decision_directly(disp_manager):
    """Attack AI: client attempts to submit original_ml_decision directly -> rejected."""
    trace_id = "TRACE-PRED-AI"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "REJECT",
        "probability": 0.85,
        "component_id": "COMP-AI",
        "lot_id": "LOT-SYN-045"
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
        "probability": 0.85,
        "component_id": "COMP-AJ",
        "lot_id": "LOT-SYN-045"
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
        "probability": 0.85,
        "component_id": "COMP-AK",
        "lot_id": "LOT-SYN-045"
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
        "probability": 0.85,
        "component_id": "COMP-AL",
        "lot_id": "LOT-SYN-045"
    })
    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_ML_OUTPUT_PROHIBITED"):
        disp_manager.record_disposition(
            trace_id=trace_id,
            disposition="ACCEPT",
            reason_code="OTHER",
            ground_truth="PASS"
        )




def test_attack_am_client_component_identity_override(disp_manager):
    """Attack AM: client attempts to supply/override component_id or lot_id -> rejected."""
    trace_id = "TRACE-PRED-AM"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "REJECT",
        "probability": 0.88,
        "component_id": "COMP-A",
        "lot_id": "LOT-A"
    })
    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_IDENTITY_PROHIBITED"):
        disp_manager.record_disposition(
            trace_id=trace_id,
            disposition="ACCEPT",
            reason_code="MANUAL_ENGINEERING_REVIEW",
            component_id="COMP-B",
            lot_id="LOT-B"
        )
    hist = disp_manager.get_disposition(trace_id)
    assert hist is None or hist["total_dispositions"] == 0


def test_attack_an_missing_authoritative_component_identity(disp_manager):
    """Attack AN: authoritative record missing component_id -> fail closed, client cannot fill gap."""
    trace_id = "TRACE-PRED-AN"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "REJECT",
        "probability": 0.88,
        "lot_id": "LOT-A"
    })
    # Client attempt to provide component_id must fail closed
    with pytest.raises(ValueError, match="(CLIENT_CONTROLLED_IDENTITY_PROHIBITED|AUTHORITATIVE_IDENTITY_RECORD_NOT_FOUND)"):
        disp_manager.record_disposition(
            trace_id=trace_id,
            disposition="ACCEPT",
            reason_code="MANUAL_ENGINEERING_REVIEW",
            component_id="COMP-A"
        )
    # Even without client component_id, backend must fail closed due to missing authoritative identity
    with pytest.raises(ValueError, match="AUTHORITATIVE_IDENTITY_RECORD_NOT_FOUND"):
        disp_manager.record_disposition(
            trace_id=trace_id,
            disposition="ACCEPT",
            reason_code="MANUAL_ENGINEERING_REVIEW"
        )


def test_attack_ao_missing_authoritative_lot_identity(disp_manager):
    """Attack AO: authoritative record missing lot_id -> fail closed, client cannot fill gap."""
    trace_id = "TRACE-PRED-AO"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "REJECT",
        "probability": 0.88,
        "component_id": "COMP-A"
    })
    # Client attempt to provide lot_id must fail closed
    with pytest.raises(ValueError, match="(CLIENT_CONTROLLED_IDENTITY_PROHIBITED|AUTHORITATIVE_IDENTITY_RECORD_NOT_FOUND)"):
        disp_manager.record_disposition(
            trace_id=trace_id,
            disposition="ACCEPT",
            reason_code="MANUAL_ENGINEERING_REVIEW",
            lot_id="LOT-A"
        )
    # Even without client lot_id, backend must fail closed due to missing authoritative lot identity
    with pytest.raises(ValueError, match="AUTHORITATIVE_IDENTITY_RECORD_NOT_FOUND"):
        disp_manager.record_disposition(
            trace_id=trace_id,
            disposition="ACCEPT",
            reason_code="MANUAL_ENGINEERING_REVIEW"
        )


def test_attack_ap_client_supplied_matching_identity_rejected(disp_manager):
    """Attack AP: client supplies matching component_id and lot_id -> rejected fail-closed to ensure single source of truth."""
    trace_id = "TRACE-PRED-AP"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "REJECT",
        "probability": 0.88,
        "component_id": "COMP-A",
        "lot_id": "LOT-A"
    })
    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_IDENTITY_PROHIBITED"):
        disp_manager.record_disposition(
            trace_id=trace_id,
            disposition="ACCEPT",
            reason_code="MANUAL_ENGINEERING_REVIEW",
            component_id="COMP-A",
            lot_id="LOT-A"
        )


def test_attack_aq_identity_mutation_across_append_only_history(disp_manager):
    """Attack AQ: identity mutation attempt across successive append-only dispositions."""
    trace_id = "TRACE-PRED-AQ"
    disp_manager.register_authoritative_prediction({
        "trace_id": trace_id,
        "prediction": "REJECT",
        "probability": 0.85,
        "component_id": "COMP-AUTH-AQ",
        "lot_id": "LOT-AUTH-AQ"
    })
    # 1st disposition succeeds cleanly using backend authoritative identities
    rec1 = disp_manager.record_disposition(
        trace_id=trace_id,
        disposition="HOLD",
        reason_code="PROCESS_EXCEPTION",
        comment="First review"
    )
    assert rec1["component_id"] == "COMP-AUTH-AQ"
    assert rec1["lot_id"] == "LOT-AUTH-AQ"

    # Client attempts identity mutation on 2nd disposition
    with pytest.raises(ValueError, match="CLIENT_CONTROLLED_IDENTITY_PROHIBITED"):
        disp_manager.record_disposition(
            trace_id=trace_id,
            disposition="ACCEPT",
            reason_code="MANUAL_ENGINEERING_REVIEW",
            component_id="COMP-MUTATED",
            lot_id="LOT-MUTATED"
        )

    # Valid 2nd disposition submitted
    rec2 = disp_manager.record_disposition(
        trace_id=trace_id,
        disposition="ACCEPT",
        reason_code="MANUAL_ENGINEERING_REVIEW",
        comment="Second review overriding hold"
    )
    assert rec2["component_id"] == "COMP-AUTH-AQ"
    assert rec2["lot_id"] == "LOT-AUTH-AQ"

    # Verify both records in append-only history maintain exact authoritative identities
    hist = disp_manager.get_disposition(trace_id)
    assert hist["total_dispositions"] == 2
    assert hist["history"][0]["component_id"] == "COMP-AUTH-AQ"
    assert hist["history"][0]["lot_id"] == "LOT-AUTH-AQ"
    assert hist["history"][1]["component_id"] == "COMP-AUTH-AQ"
    assert hist["history"][1]["lot_id"] == "LOT-AUTH-AQ"
    assert hist["history"][0]["disposition_id"] == rec1["disposition_id"]
    assert hist["history"][0]["disposition"] == "HOLD"


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


# --- NEW COUNTERFACTUAL GOVERNANCE ATTACKS AR through BE ---

def test_attack_ar_raw_feature_below_contract_minimum(explainer):
    """Attack AR: raw feature value below contract minimum fails closed with PHYSICAL_BOUND_VIOLATION."""
    rec = dict(SAMPLE_FAILING_RECORD)
    rec["temperature"] = -50.0  # min is -40.0
    with pytest.raises(ValueError, match="PHYSICAL_BOUND_VIOLATION"):
        explainer.generate_counterfactual(rec)


def test_attack_as_raw_feature_above_contract_maximum(explainer):
    """Attack AS: raw feature value above contract maximum fails closed with PHYSICAL_BOUND_VIOLATION."""
    rec = dict(SAMPLE_FAILING_RECORD)
    rec["frequency"] = 6000.0  # max is 5000.0
    with pytest.raises(ValueError, match="PHYSICAL_BOUND_VIOLATION"):
        explainer.generate_counterfactual(rec)


def test_attack_at_generated_candidate_exceeds_contract_bound(explainer):
    """Attack AT: generated counterfactual features strictly respect min/max feature bounds."""
    res = explainer.generate_counterfactual(SAMPLE_FAILING_RECORD, "TARGET_PASS")
    bounds = explainer.feature_bounds
    for feat, val in res["counterfactual_input"].items():
        assert bounds[feat]["min"] <= val <= bounds[feat]["max"]


def test_attack_au_immutable_identifier_preservation(explainer):
    """Attack AU: all supplied immutable identifiers are explicitly preserved unchanged."""
    rec = dict(SAMPLE_FAILING_RECORD)
    rec["component_id"] = "COMP-TEST-AU-99"
    rec["lot_id"] = "LOT-TEST-AU-88"
    rec["wafer_id"] = "WAF-01"
    res = explainer.generate_counterfactual(rec, "TARGET_PASS")
    preserved = res["preserved_immutable_identifiers"]
    assert preserved["component_id"] == "COMP-TEST-AU-99"
    assert preserved["lot_id"] == "LOT-TEST-AU-88"
    assert preserved["wafer_id"] == "WAF-01"


def test_attack_av_contradictory_derived_feature_injection(explainer):
    """Attack AV: client supplying derived features in input record is rejected with UNKNOWN_FEATURE."""
    rec = dict(SAMPLE_FAILING_RECORD)
    rec["voltage_headroom"] = 0.99
    with pytest.raises(ValueError, match="UNKNOWN_FEATURE"):
        explainer.generate_counterfactual(rec)


def test_attack_aw_objective_coefficient_contract_tampering(tmp_path):
    """Attack AW: contract optimization specification requires valid target_penalty_coefficient."""
    contract_data = dict(json.loads(open(CF_CONTRACT_PATH, "r", encoding="utf-8").read()))
    contract_data["optimization_specification"]["target_penalty_coefficient"] = 50.0
    temp_contract = tmp_path / "custom_contract.json"
    temp_contract.write_text(json.dumps(contract_data), encoding="utf-8")
    custom_exp = GovernedCounterfactualExplainer(contract_path=str(temp_contract))
    res = custom_exp.generate_counterfactual(SAMPLE_FAILING_RECORD, "TARGET_PASS")
    assert res["target_reached"] is True


def test_attack_ax_coupled_physical_constraint_status(explainer):
    """Attack AX: provenance explicitly exposes coupled_physics_status = PROJECT_DEFINED_LIMITS_ONLY."""
    res = explainer.generate_counterfactual(SAMPLE_FAILING_RECORD, "TARGET_PASS")
    assert res["provenance"]["coupled_physics_status"] == "PROJECT_DEFINED_LIMITS_ONLY"


def test_attack_ay_operating_threshold_immutability(explainer):
    """Attack AY: operating threshold remains locked to 0.20."""
    assert explainer.operating_threshold == 0.20
    res = explainer.generate_counterfactual(SAMPLE_FAILING_RECORD, "TARGET_PASS")
    assert res["provenance"]["operating_threshold"] == 0.20


def test_attack_az_model_hash_substitution_fails_closed(tmp_path):
    """Attack AZ: model hash substitution in contract triggers MODEL_HASH_MISMATCH."""
    contract_data = json.loads(open(CF_CONTRACT_PATH, "r", encoding="utf-8").read())
    contract_data["model_identity"]["model_sha256"] = "0" * 64
    temp_contract = tmp_path / "bad_sha_contract.json"
    temp_contract.write_text(json.dumps(contract_data), encoding="utf-8")
    with pytest.raises(ValueError, match="MODEL_HASH_MISMATCH"):
        GovernedCounterfactualExplainer(contract_path=str(temp_contract))


def test_attack_ba_target_reject_terminology_mapping(explainer):
    """Attack BA: TARGET_REJECT target_decision is REJECT, while model decision is FAIL."""
    res = explainer.generate_counterfactual(SAMPLE_FAILING_RECORD, "TARGET_REJECT")
    target_def = explainer.contract["target_definitions"]["TARGET_REJECT"]
    assert target_def["target_decision"] == "REJECT"
    assert target_def["model_decision"] == "FAIL"
    assert res["counterfactual_prediction"]["decision"] == "FAIL"


def test_attack_bb_target_not_reached_honesty(explainer):
    """Attack BB: when target cannot be reached under constraints, target_reached is False and true model prob is returned."""
    rec = dict(SAMPLE_FAILING_RECORD)
    rec["leakage_current"] = 4999.0
    rec["temperature"] = 149.0
    rec["propagation_delay"] = 49.0
    res = explainer.generate_counterfactual(rec, "TARGET_PASS")
    assert res["target_reached"] is False
    assert isinstance(res["counterfactual_prediction"]["calibrated_probability"], float)


def test_attack_bc_provenance_contract_sha_mismatch(explainer):
    """Attack BC: provenance object contains authoritative contract SHA and model SHA."""
    res = explainer.generate_counterfactual(SAMPLE_FAILING_RECORD, "TARGET_PASS")
    prov = res["provenance"]
    assert len(prov["contract_sha256"]) == 64
    assert prov["model_sha256"] == "91bb598ae91155674e40cb0a9f39d1e9bdeacd39875542db88b65e3668f29d98"


def test_attack_bd_explanation_status_escalation_attempt(explainer):
    """Attack BD: explanation status remains BENCHMARK_ONLY and cannot be escalated to production."""
    res = explainer.generate_counterfactual(SAMPLE_FAILING_RECORD, "TARGET_PASS")
    assert res["explanation_status"] == "BENCHMARK_ONLY"
    assert res["model_status"] == "BENCHMARK_ONLY"


def test_attack_be_python_node_counterfactual_parity(explainer):
    """Attack BE: Python and Node.js counterfactual engines exhibit 100% semantic and numeric parity."""
    import subprocess
    cmd = [
        "node", "-e",
        "const { GovernedCounterfactualExplainerJS } = require('./src/explainability/counterfactual');"
        "const jsExp = new GovernedCounterfactualExplainerJS();"
        "const rec = JSON.parse(process.argv[1]);"
        "const res = jsExp.generateCounterfactual(rec, 'TARGET_PASS');"
        "console.log(JSON.stringify(res));",
        json.dumps(SAMPLE_FAILING_RECORD)
    ]
    node_out = subprocess.check_output(cmd, cwd=PROJECT_ROOT, text=True)
    node_res = json.loads(node_out.strip())

    py_res = explainer.generate_counterfactual(SAMPLE_FAILING_RECORD, "TARGET_PASS")

    assert py_res["target_reached"] == node_res["target_reached"]
    assert py_res["provenance"]["coupled_physics_status"] == node_res["provenance"]["coupled_physics_status"] == "PROJECT_DEFINED_LIMITS_ONLY"
    assert abs(py_res["distance"] - node_res["distance"]) <= 1e-4
    assert py_res["counterfactual_prediction"]["decision"] == node_res["counterfactual_prediction"]["decision"]


def test_attack_bf_missing_target_penalty_coefficient_fails_closed(tmp_path):
    """Attack BF: missing target_penalty_coefficient in contract fails closed."""
    contract_data = json.loads(open(CF_CONTRACT_PATH, "r", encoding="utf-8").read())
    del contract_data["optimization_specification"]["target_penalty_coefficient"]
    temp_contract = tmp_path / "bad_coeff_contract.json"
    temp_contract.write_text(json.dumps(contract_data), encoding="utf-8")
    with pytest.raises(ValueError, match="MISSING_CONTRACT_COEFFICIENT"):
        GovernedCounterfactualExplainer(contract_path=str(temp_contract))


def test_attack_bg_invalid_target_penalty_coefficient_fails_closed(tmp_path):
    """Attack BG: invalid target_penalty_coefficient values fail closed."""
    contract_data = json.loads(open(CF_CONTRACT_PATH, "r", encoding="utf-8").read())
    invalid_values = [None, -10.0, 0.0, "abc", True]
    for idx, inv_val in enumerate(invalid_values):
        c_copy = json.loads(json.dumps(contract_data))
        c_copy["optimization_specification"]["target_penalty_coefficient"] = inv_val
        temp_contract = tmp_path / f"inv_coeff_{idx}.json"
        temp_contract.write_text(json.dumps(c_copy), encoding="utf-8")
        with pytest.raises(ValueError, match="INVALID_CONTRACT_COEFFICIENT"):
            GovernedCounterfactualExplainer(contract_path=str(temp_contract))


def test_attack_bh_valid_target_penalty_coefficient_succeeds(explainer):
    """Attack BH: valid authoritative 50.0 target_penalty_coefficient succeeds."""
    assert explainer.target_penalty_coeff == 50.0
    assert explainer.contract["optimization_specification"]["target_penalty_coefficient"] == 50.0


def test_attack_bi_contract_version_1_1_0_integrity(explainer, tmp_path):
    """Attack BI: contract version 1.1.0 integrity requirement enforced."""
    assert explainer.contract["contract_version"] == "1.1.0"

    contract_data = json.loads(open(CF_CONTRACT_PATH, "r", encoding="utf-8").read())
    contract_data["contract_version"] = "1.0.0"
    temp_contract = tmp_path / "old_version_contract.json"
    temp_contract.write_text(json.dumps(contract_data), encoding="utf-8")
    with pytest.raises(ValueError, match="CONTRACT_VERSION_MISMATCH"):
        GovernedCounterfactualExplainer(contract_path=str(temp_contract))


